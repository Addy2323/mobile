import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const FIMIPAY_BASE_URL = (process.env.FIMIPAY_BASE_URL || 'https://fimipay.com/api/v1').replace(/\/+$/, '');
const FIMIPAY_SECRET_KEY = process.env.FIMIPAY_SECRET_KEY || process.env.FIMIPAY_API_KEY || process.env.SECRET_KEY || '';
const FIMIPAY_WEBHOOK_SECRET = process.env.FIMIPAY_WEBHOOK_SECRET || process.env.websec || '';

/**
 * Service class for FimiPay Merchant API v1
 * Source of Truth: fimipay-ai-integration-brief.md
 */
export class FimiPayProvider {
  /**
   * Helper to make authenticated HTTP requests to FimiPay API v1
   */
  static async request(endpoint, options = {}) {
    const url = `${FIMIPAY_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const method = options.method || 'GET';
    const secret = FIMIPAY_SECRET_KEY;

    const headers = {
      'Authorization': `Bearer ${secret}`,
      'X-Api-Key': secret,
      'X-Fimipay-Secret': secret,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const config = {
      method,
      headers
    };

    if (options.body) {
      config.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    console.log(`[FimiPayProvider] Request: ${method} ${url}`);

    try {
      const response = await fetch(url, config);
      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { raw: rawText };
      }

      if (!response.ok) {
        console.warn(`[FimiPayProvider] Error response (${response.status}):`, rawText);
        return {
          success: false,
          status: response.status,
          error: data.message || data.error || rawText || 'FimiPay API error',
          data
        };
      }

      return {
        success: true,
        status: response.status,
        data
      };
    } catch (err) {
      console.error(`[FimiPayProvider] Network/Request error for ${url}:`, err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Format phone number to clean international standard for TZ collection (e.g. 255682812345)
   */
  static formatPhone(phone) {
    if (!phone) return '';
    let clean = phone.toString().replace(/[^\d]/g, '');
    if (clean.startsWith('0')) {
      clean = '255' + clean.slice(1);
    } else if (!clean.startsWith('255') && clean.length === 9) {
      clean = '255' + clean;
    }
    return clean;
  }

  /**
   * Format mobile wallet payout account number (9-digit 6XXXXXXXX / 7XXXXXXXX, strip 0 or 255)
   */
  static formatPayoutPhone(accountNumber) {
    if (!accountNumber) return '';
    let clean = accountNumber.toString().replace(/[^\d]/g, '');
    if (clean.startsWith('255') && clean.length === 12) {
      clean = clean.slice(3);
    } else if (clean.startsWith('0') && clean.length === 10) {
      clean = clean.slice(1);
    }
    return clean;
  }

  /**
   * 1) POST /payment/create_order — start payment collection using §4.2 Decision Tree
   */
  static async createOrder({
    buyer_phone,
    amount,
    order_id,
    currency = 'TZS',
    buyer_name,
    buyer_email,
    payment_method = 'mobile',
    redirect_url,
    test_outcome
  }) {
    if (!buyer_phone || !amount) {
      throw new Error('buyer_phone and amount are required fields for create_order');
    }

    const cur = (currency || 'TZS').toUpperCase();
    let normMethod = (payment_method || 'mobile').toLowerCase();
    
    // Normalize aliases
    if (['mobile_money', 'wallet', 'ussd', 'momo'].includes(normMethod)) normMethod = 'mobile';
    if (['bank_transfer', 'banktransfer'].includes(normMethod)) normMethod = 'bank';

    // Apply §4.2 Decision Tree Rules
    let formattedPhone = buyer_phone ? buyer_phone.toString().replace(/[^\d]/g, '') : '';
    if (cur === 'TZS') {
      formattedPhone = this.formatPhone(buyer_phone);
    }

    // Hosted checkout check
    const isHostedCheckout =
      (cur === 'TZS' && (normMethod === 'card' || normMethod === 'bank')) ||
      ['KES', 'UGX', 'NGN', 'GHS', 'XAF', 'ZAR'].includes(cur) ||
      cur === 'USD';

    if (cur === 'USD') {
      normMethod = 'card'; // Force card for USD
    }

    if (isHostedCheckout) {
      if (!buyer_email || !redirect_url) {
        throw new Error(`Hosted checkout (${cur} ${normMethod}) requires both buyer_email and redirect_url.`);
      }
    }

    const cleanOrderId = (order_id || `fp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`).slice(0, 64);

    const payload = {
      buyer_phone: formattedPhone,
      amount: Number(amount),
      order_id: cleanOrderId,
      currency: cur,
      payment_method: normMethod
    };

    if (buyer_name) payload.buyer_name = buyer_name;
    if (buyer_email) payload.buyer_email = buyer_email;
    if (redirect_url) payload.redirect_url = redirect_url;
    if (test_outcome && process.env.NODE_ENV !== 'production') payload.test_outcome = test_outcome;

    console.log(`[FimiPayProvider] Initiating order ${cleanOrderId} (${cur} ${amount}):`, payload);

    const res = await this.request('/payment/create_order', {
      method: 'POST',
      body: payload
    });

    if (res.success && res.data) {
      const pGatewayUrl = res.data.payment_gateway_url || res.data.data?.payment_gateway_url || null;
      return {
        success: true,
        orderId: res.data.order_id || res.data.data?.order_id || cleanOrderId,
        paymentStatus: res.data.payment_status || res.data.data?.payment_status || 'PENDING',
        paymentGatewayUrl: pGatewayUrl,
        requiresRedirect: Boolean(pGatewayUrl),
        data: res.data
      };
    }

    return {
      success: false,
      orderId: cleanOrderId,
      paymentStatus: 'PENDING',
      error: res.error || 'Failed to create FimiPay order',
      data: res.data || null
    };
  }

  /**
   * 2) POST /payment/order_status — poll payment status
   */
  static async getOrderStatus(orderId) {
    if (!orderId) {
      return { success: false, error: 'order_id is required' };
    }

    const payload = { order_id: orderId };
    console.log(`[FimiPayProvider] Polling order status for: ${orderId}`);

    const res = await this.request('/payment/order_status', {
      method: 'POST',
      body: payload
    });

    if (res.success && res.data) {
      const dataObj = res.data.data || res.data;
      const rawStatus = (dataObj.payment_status || dataObj.status || 'PENDING').toUpperCase();
      const isPaid = ['SUCCESS', 'COMPLETED'].includes(rawStatus);

      return {
        success: true,
        orderId,
        paymentStatus: rawStatus,
        isPaid,
        data: dataObj
      };
    }

    return {
      success: false,
      orderId,
      paymentStatus: 'UNKNOWN',
      isPaid: false,
      error: res.error || 'Failed to fetch order status'
    };
  }

  /**
   * 3) POST /transactions/readbyId — list recent orders for this API key
   */
  static async getTransactions() {
    console.log('[FimiPayProvider] Fetching recent transactions list...');
    const res = await this.request('/transactions/readbyId', {
      method: 'POST',
      body: {}
    });

    if (res.success && res.data) {
      const transactions = Array.isArray(res.data)
        ? res.data
        : res.data.transactions || res.data.data || [];
      return {
        success: true,
        transactions,
        data: res.data
      };
    }

    return {
      success: false,
      transactions: [],
      error: res.error || 'Failed to fetch transactions'
    };
  }

  /**
   * 4) GET /balance — merchant available balance (alias: GET /balances)
   */
  static async getBalance(currency = 'TZS') {
    console.log(`[FimiPayProvider] Querying merchant balance (currency: ${currency})...`);
    let res = await this.request(`/balance?currency=${encodeURIComponent(currency)}`, {
      method: 'GET'
    });

    if (!res.success) {
      // Try alias endpoint /balances
      res = await this.request(`/balances?currency=${encodeURIComponent(currency)}`, {
        method: 'GET'
      });
    }

    if (res.success && res.data) {
      const bData = res.data.data || res.data;
      return {
        success: true,
        available: bData.available || bData.withdrawable_now || bData.balance || 0,
        withdrawableNow: bData.withdrawable_now || bData.available || 0,
        currency: bData.currency || currency,
        mobileMoneyBalance: bData.mobile_money || bData.mobile_balance || 0,
        cardBalance: bData.card || bData.card_balance || 0,
        data: bData
      };
    }

    return {
      success: false,
      available: 0,
      withdrawableNow: 0,
      currency,
      error: res.error || 'Failed to fetch merchant balance'
    };
  }

  /**
   * 5) POST /payouts/create — request merchant withdrawal/payout
   */
  static async createPayout({
    amount,
    method,
    account_number,
    account_name,
    currency = 'TZS',
    fee_handling = 'deduct'
  }) {
    if (!amount || !method || !account_number) {
      return {
        success: false,
        error: 'amount, method, and account_number are required for payout creation'
      };
    }

    // Format account number depending on mobile vs bank
    const isMobileWallet = ['M-Pesa', 'Tigo Pesa', 'Mixx by Yas', 'Airtel Money', 'Halopesa'].some(
      (m) => m.toLowerCase() === method.toLowerCase()
    );

    const formattedAccount = isMobileWallet
      ? this.formatPayoutPhone(account_number)
      : accountNumber.toString();

    const payload = {
      amount: Number(amount),
      method,
      account_number: formattedAccount,
      currency: currency || 'TZS',
      fee_handling: fee_handling || 'deduct'
    };

    if (account_name) payload.account_name = account_name;

    console.log(`[FimiPayProvider] Requesting payout of ${currency} ${amount} via ${method} to ${formattedAccount}:`, payload);

    const res = await this.request('/payouts/create', {
      method: 'POST',
      body: payload
    });

    if (res.success && res.data) {
      const pData = res.data.data || res.data;
      return {
        success: true,
        withdrawalId: pData.withdrawal_id || pData.id || pData.payout_id || `fp_wth_${Date.now()}`,
        status: (pData.status || 'PENDING').toUpperCase(),
        data: pData
      };
    }

    return {
      success: false,
      withdrawalId: `fp_wth_${Date.now()}`,
      status: 'PENDING',
      error: res.error || 'Failed to create payout'
    };
  }

  /**
   * 6) GET /payouts/status/{withdrawal_id} — poll payout/withdrawal status
   */
  static async getPayoutStatus(withdrawalId) {
    if (!withdrawalId) {
      return { success: false, error: 'withdrawalId is required' };
    }

    console.log(`[FimiPayProvider] Polling payout status for withdrawal_id: ${withdrawalId}`);
    const res = await this.request(`/payouts/status/${encodeURIComponent(withdrawalId)}`, {
      method: 'GET'
    });

    if (res.success && res.data) {
      const pData = res.data.data || res.data;
      return {
        success: true,
        withdrawalId,
        status: (pData.status || pData.payout_status || 'PENDING').toUpperCase(),
        data: pData
      };
    }

    return {
      success: false,
      withdrawalId,
      status: 'UNKNOWN',
      error: res.error || 'Failed to fetch payout status'
    };
  }

  /**
   * Webhook Signature Verification (§ 7.1)
   * V1: X-Fimipay-Signature = HMAC-SHA256(raw_request_body, webhook_secret)
   * V2: X-Fimipay-Signature-V2 = HMAC-SHA256("timestamp.nonce.path.rawBody", webhook_secret)
   */
  static verifyWebhookSignature(rawBodyBuffer, reqOrHeaders, optionalPath) {
    if (!rawBodyBuffer) {
      console.warn('[FimiPayProvider] Webhook raw body buffer missing');
      return false;
    }

    let headers = {};
    let path = '/api/payments/webhooks/fimipay';

    if (typeof reqOrHeaders === 'string') {
      headers['x-fimipay-signature'] = reqOrHeaders;
    } else if (reqOrHeaders && typeof reqOrHeaders === 'object') {
      if (reqOrHeaders.headers) {
        headers = reqOrHeaders.headers;
        path = reqOrHeaders.originalUrl || reqOrHeaders.url || path;
      } else {
        headers = reqOrHeaders;
        if (optionalPath) path = optionalPath;
      }
    }

    const sig1 = String(
      headers['x-fimipay-signature'] ||
      headers['x-signature'] ||
      headers['x-webhook-signature'] ||
      ''
    ).replace(/^sha256=/, '').trim();

    const sig2 = String(headers['x-fimipay-signature-v2'] || '').replace(/^sha256=/, '').trim();
    const timestamp = String(headers['x-fimipay-timestamp'] || '').trim();
    const nonce = String(headers['x-fimipay-nonce'] || '').trim();

    const secrets = Array.from(new Set([
      process.env.FIMIPAY_WEBHOOK_SECRET,
      process.env.websec,
      process.env.FIMIPAY_SECRET_KEY,
      process.env.FIMIPAY_API_KEY,
      process.env.SECRET_KEY,
      FIMIPAY_WEBHOOK_SECRET,
      FIMIPAY_SECRET_KEY
    ].filter(Boolean)));

    if (secrets.length === 0) {
      console.warn('[FimiPayProvider] Webhook verification warning: No secrets configured in environment');
      return false;
    }

    const rawString = Buffer.isBuffer(rawBodyBuffer) ? rawBodyBuffer.toString('utf8') : String(rawBodyBuffer || '');

    for (const secret of secrets) {
      try {
        // 1. Try V1 Signature: HMAC-SHA256(rawBody, secret)
        if (sig1) {
          const expectedV1 = crypto.createHmac('sha256', secret).update(rawBodyBuffer).digest('hex');
          if (expectedV1.length === sig1.length && crypto.timingSafeEqual(Buffer.from(sig1), Buffer.from(expectedV1))) {
            return true;
          }
        }

        // 2. Try V2 Signature: HMAC-SHA256("timestamp.nonce.path.rawBody", secret)
        if (sig2 && timestamp && nonce) {
          const payloadV2 = `${timestamp}.${nonce}.${path}.${rawString}`;
          const expectedV2 = crypto.createHmac('sha256', secret).update(payloadV2).digest('hex');
          if (expectedV2.length === sig2.length && crypto.timingSafeEqual(Buffer.from(sig2), Buffer.from(expectedV2))) {
            return true;
          }
        }
      } catch (err) {
        console.error('[FimiPayProvider] Error in HMAC calculation:', err.message);
      }
    }

    console.warn('[FimiPayProvider] Webhook signature failed for all candidate secrets and headers.');
    return false;
  }
}
