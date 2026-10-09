import crypto from 'crypto';

function getAuthHeader() {
  let key = (process.env.SNIPPE_API_KEY || '').trim();
  key = key.replace(/^["']|["']$/g, '').trim();
  if (!key) return '';
  if (key.toLowerCase().startsWith('bearer ')) return key;
  return `Bearer ${key}`;
}

const SNIPPE_BASE_URL = (process.env.SNIPPE_API_URL || process.env.SNIPPE_BASE_URL || 'https://api.snippe.sh').trim();
function getWebhookSecret() {
  return (process.env.SNIPPE_WEBHOOK_SECRET || process.env.SNIPPE_SECRET_KEY || '').trim();
}

export class SnippePaymentProvider {
  /**
   * Helper to format idempotency key to max 30 characters per Snippe spec
   */
  static formatIdempotencyKey(key, prefix = 'pay') {
    if (!key) return `${prefix}_${Date.now().toString().slice(-18)}`;
    const cleanKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '');
    if (cleanKey.length <= 30) return cleanKey;
    return `${prefix}_${cleanKey.slice(-22)}`;
  }

  /**
   * 1) Initiates a mobile money collection payment via Snippe API v2026-01-25 (POST /v1/payments)
   * Dynamically passes application webhook URL and standardized metadata structure.
   */
  static async initiatePayment({
    amount,
    phone,
    currency = 'TZS',
    splitId,
    participantId,
    participantName,
    buyerEmail,
    idempotencyKey,
    webhookUrl,
    applicationKey,
    resourceType,
    resourceId,
    internalPaymentId
  }) {
    const numericAmount = Math.round(amount);

    // Enforce Snippe minimum collection limit of 500 TZS
    if (numericAmount < 500) {
      console.warn(`[SnippeProvider] Amount TZS ${numericAmount} is below Snippe minimum of TZS 500.`);
      return {
        status: 'FAILED',
        failureCode: 'MINIMUM_AMOUNT_NOT_MET',
        failureMessage: 'Minimum payment amount is TZS 500.'
      };
    }

    let cleanPhone = (phone || '').replace(/[^\d]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '255' + cleanPhone.slice(1);
    } else if (!cleanPhone.startsWith('255') && cleanPhone.length === 9) {
      cleanPhone = '255' + cleanPhone;
    }

    const nameParts = (participantName || 'Guest User').trim().split(/\s+/);
    const firstname = nameParts[0] || 'Guest';
    const lastname = nameParts.slice(1).join(' ') || 'User';

    const resolvedWebhookUrl = (webhookUrl || process.env.SNIPPE_WEBHOOK_URL || 'https://lumo.co.tz/api/webhooks/snippe').trim();

    const payload = {
      payment_type: 'mobile',
      details: {
        amount: numericAmount,
        currency: currency || 'TZS'
      },
      phone_number: cleanPhone,
      customer: {
        firstname,
        lastname,
        email: buyerEmail || 'guest@lumo.co.tz'
      },
      webhook_url: resolvedWebhookUrl,
      metadata: {
        application: applicationKey || 'lumo-split',
        internal_payment_id: internalPaymentId || participantId || `payment_${Date.now()}`,
        resource_type: resourceType || 'split',
        resource_id: resourceId || splitId || '',
        split_id: splitId,
        participant_id: participantId,
        participant_name: participantName
      }
    };

    const validIdempotencyKey = this.formatIdempotencyKey(idempotencyKey, 'pay');
    console.log(`[SnippeProvider] Initiating payment for internal_payment_id ${payload.metadata.internal_payment_id} to ${resolvedWebhookUrl}:`, payload);

    try {
      const response = await fetch(`${SNIPPE_BASE_URL}/v1/payments`, {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
          'Idempotency-Key': validIdempotencyKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[SnippeProvider] Collection API error (${response.status}):`, errorText);
        let parsedErr = {};
        try { parsedErr = JSON.parse(errorText); } catch {}
        return {
          status: 'FAILED',
          failureCode: parsedErr.error_code || 'PAYMENT_REJECTED',
          failureMessage: parsedErr.message || `Payment initiation failed with status ${response.status}`
        };
      }

      const body = await response.json();
      const pData = body.data || body;
      const rawStatus = (pData.status || 'pending').toLowerCase();
      const isSuccess = ['completed', 'success'].includes(rawStatus);

      return {
        status: isSuccess ? 'SUCCESS' : 'PENDING',
        providerTxRef: pData.reference || pData.id || `SNP-TX-${Date.now().toString().slice(-8)}`,
        webhookUrlUsed: resolvedWebhookUrl,
        message: body.message || 'USSD Push prompt sent to user phone.'
      };
    } catch (err) {
      console.error('[SnippeProvider] Initiate payment exception:', err.message);
      return {
        status: 'FAILED',
        failureCode: 'NETWORK_ERROR',
        failureMessage: 'Could not connect to Snippe payment service.'
      };
    }
  }

  /**
   * 2) GET /v1/payments/{reference} — poll collection payment status
   */
  static async getPaymentStatus(reference) {
    if (!reference) return { success: false, error: 'Reference is required' };

    try {
      const res = await fetch(`${SNIPPE_BASE_URL}/v1/payments/${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        return { success: false, isPaid: false, isFailed: false, paymentStatus: 'PENDING' };
      }

      const body = await res.json();
      const dataObj = body.data || body;
      const rawStatus = (dataObj.status || 'pending').toLowerCase();
      const isPaid = ['completed', 'success'].includes(rawStatus);
      const isFailed = ['failed', 'voided', 'expired', 'cancelled', 'rejected'].includes(rawStatus);

      return {
        success: true,
        reference,
        paymentStatus: isPaid ? 'SUCCESS' : isFailed ? 'FAILED' : 'PENDING',
        rawStatus,
        isPaid,
        isFailed,
        data: dataObj
      };
    } catch (err) {
      return { success: false, isPaid: false, isFailed: false, paymentStatus: 'PENDING', error: err.message };
    }
  }

  /**
   * 3) Disburses funds via Snippe Payout API (POST /v1/payouts/send)
   */
  static async sendPayout({
    splitId,
    amount,
    channel = 'mobile',
    mobileProvider = 'airtel',
    bankCode = 'CRDB',
    recipientPhone,
    recipientBank,
    recipientAccount,
    recipientName,
    idempotencyKey,
    webhookUrl
  }) {
    const numericAmount = Math.round(amount);

    if (numericAmount < 5000) {
      console.warn(`[SnippeProvider] Payout amount TZS ${numericAmount} below Snippe minimum of TZS 5,000.`);
      return {
        status: 'FAILED',
        failureCode: 'MINIMUM_PAYOUT_LIMIT',
        failureReason: 'Payout amount must be at least TZS 5,000 for Snippe disbursement.',
        payoutId: null
      };
    }

    let cleanPhone = (recipientPhone || '').replace(/[^\d]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '255' + cleanPhone.slice(1);
    if (!cleanPhone.startsWith('255') && cleanPhone.length === 9) cleanPhone = '255' + cleanPhone;

    const resolvedWebhookUrl = (webhookUrl || process.env.SNIPPE_WEBHOOK_URL || 'https://lumo.co.tz/api/webhooks/snippe').trim();
    const isBank = channel === 'bank';
    const payload = isBank
      ? {
          amount: numericAmount,
          channel: 'bank',
          recipient_bank: recipientBank || bankCode || 'CRDB',
          recipient_account: recipientAccount,
          recipient_name: recipientName || 'LUMO Split Beneficiary',
          narration: `LUMO Split ${splitId || ''} Settlement`.slice(0, 64),
          webhook_url: resolvedWebhookUrl,
          metadata: { split_id: splitId }
        }
      : {
          amount: numericAmount,
          channel: 'mobile',
          recipient_phone: cleanPhone,
          recipient_name: recipientName || 'LUMO Split Beneficiary',
          narration: `LUMO Split ${splitId || ''} Settlement`.slice(0, 64),
          webhook_url: resolvedWebhookUrl,
          metadata: { split_id: splitId }
        };

    const validIdempotencyKey = this.formatIdempotencyKey(idempotencyKey || `payout_${splitId || Date.now()}`, 'payout');

    try {
      const response = await fetch(`${SNIPPE_BASE_URL}/v1/payouts/send`, {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
          'Idempotency-Key': validIdempotencyKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[SnippeProvider] Payout API error (${response.status}):`, errorText);
        let parsedErr = {};
        try { parsedErr = JSON.parse(errorText); } catch {}
        return {
          status: 'FAILED',
          payoutId: null,
          message: parsedErr.message || 'Settlement payout request failed.'
        };
      }

      const body = await response.json();
      const pData = body.data || body;
      const rawStatus = (pData.status || 'pending').toLowerCase();

      return {
        status: rawStatus === 'completed' ? 'SETTLED' : rawStatus === 'failed' ? 'FAILED' : 'PROCESSING',
        payoutId: pData.reference || pData.id || `PAYOUT-SNP-${Date.now().toString().slice(-8)}`,
        data: pData,
        message: 'Settlement payout request dispatched to Snippe.'
      };
    } catch (err) {
      console.error('[SnippeProvider] Payout dispatch error:', err.message);
      return {
        status: 'FAILED',
        payoutId: null,
        message: 'Settlement payout request network error.'
      };
    }
  }

  /**
   * 4) GET /v1/payouts/{reference} — poll payout status
   */
  static async getPayoutStatus(reference) {
    if (!reference) return { success: false, error: 'Payout reference is required' };

    try {
      const res = await fetch(`${SNIPPE_BASE_URL}/v1/payouts/${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        return { success: false, status: 'PROCESSING' };
      }

      const body = await res.json();
      const dataObj = body.data || body;
      const rawStatus = (dataObj.status || 'pending').toLowerCase();

      return {
        success: true,
        reference,
        status: rawStatus === 'completed' ? 'SETTLED' : rawStatus === 'failed' ? 'FAILED' : rawStatus === 'reversed' ? 'REVERSED' : 'PROCESSING',
        data: dataObj
      };
    } catch (err) {
      return { success: false, status: 'PROCESSING', error: err.message };
    }
  }

  /**
   * 5) GET /v1/payouts/fee?amount={amount} — calculate payout fee
   */
  static async getPayoutFee(amount) {
    try {
      const res = await fetch(`${SNIPPE_BASE_URL}/v1/payouts/fee?amount=${Math.round(amount)}`, {
        method: 'GET',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        return { success: false, feeAmount: 1000, totalAmount: amount + 1000 };
      }

      const body = await res.json();
      const data = body.data || body;
      return {
        success: true,
        amount: data.amount || amount,
        feeAmount: data.fee_amount || 1000,
        totalAmount: data.total_amount || (amount + 1000),
        currency: data.currency || 'TZS'
      };
    } catch {
      return { success: false, feeAmount: 1000, totalAmount: amount + 1000 };
    }
  }

  /**
   * 6) GET /v1/payments/balance — check available account balance
   */
  static async getBalance() {
    try {
      const res = await fetch(`${SNIPPE_BASE_URL}/v1/payments/balance`, {
        method: 'GET',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        return { success: false, availableBalance: 0, currency: 'TZS' };
      }

      const body = await res.json();
      const data = body.data || body;
      const availableVal = data.available?.value !== undefined ? data.available.value : (data.available || data.balance || 0);

      return {
        success: true,
        availableBalance: availableVal,
        currency: 'TZS'
      };
    } catch {
      return { success: false, availableBalance: 0, currency: 'TZS' };
    }
  }

  /**
   * 7) Verifies Snippe Webhook HMAC-SHA256 signature (v2026-01-25)
   * Header format: X-Webhook-Timestamp and X-Webhook-Signature
   * Signature payload: "${timestamp}.${raw_body}"
   * Includes timestamp freshness check (<5 mins) for replay attack prevention.
   */
  static verifyWebhookSignature(rawBodyBuffer, reqOrHeader) {
    const headers = typeof reqOrHeader === 'object' && reqOrHeader?.headers ? reqOrHeader.headers : (reqOrHeader || {});
    
    const signature = headers['x-webhook-signature'] || headers['x-snippe-signature'] || headers['x-signature'];
    const timestamp = headers['x-webhook-timestamp'] || headers['x-timestamp'];

    if (!signature || rawBodyBuffer === undefined || rawBodyBuffer === null) return false;
    
    const secret = getWebhookSecret();
    if (!secret) return true; // Accept in dev if secret not configured

    // Verify timestamp freshness window (5 minutes / 300 seconds) if timestamp header provided
    if (timestamp) {
      const reqTimeSec = Number(timestamp);
      const nowSec = Math.floor(Date.now() / 1000);
      if (!isNaN(reqTimeSec) && Math.abs(nowSec - reqTimeSec) > 300) {
        console.warn(`[SnippeProvider] Webhook signature rejected: timestamp difference ${Math.abs(nowSec - reqTimeSec)}s exceeds 300s threshold`);
        return false;
      }
    }

    try {
      const rawString = typeof rawBodyBuffer === 'string' ? rawBodyBuffer : rawBodyBuffer.toString('utf8');
      const message = timestamp ? `${timestamp}.${rawString}` : rawString;
      
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(message)
        .digest('hex');

      const cleanSig = String(signature).replace(/^sha256=/, '').trim();
      const bufComputed = Buffer.from(computedSignature, 'utf8');
      const bufClean = Buffer.from(cleanSig, 'utf8');

      if (bufComputed.length !== bufClean.length) {
        return false;
      }

      return crypto.timingSafeEqual(bufComputed, bufClean);
    } catch (err) {
      console.error('[SnippeProvider] Webhook signature verification error:', err.message);
      return false;
    }
  }
}
