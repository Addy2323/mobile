import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const FIMIPAY_BASE_URL = (process.env.FIMIPAY_BASE_URL || 'https://fimipay.com/api/v1').replace(/\/+$/, '');
const FIMIPAY_SECRET_KEY = process.env.FIMIPAY_SECRET_KEY || process.env.FIMIPAY_API_KEY || process.env.SECRET_KEY || '';
const FIMIPAY_WEBHOOK_SECRET = process.env.FIMIPAY_WEBHOOK_SECRET || process.env.websec || '';

/**
 * Service class for FimiPay Merchant API v1
 */
export class FimiPayProvider {
  /**
   * Helper to make authenticated HTTP requests to FimiPay API v1
   */
  static async request(endpoint, options = {}) {
    const url = `${FIMIPAY_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const method = options.method || 'GET';
    const headers = {
      'Authorization': `Bearer ${FIMIPAY_SECRET_KEY}`,
      'X-Api-Key': FIMIPAY_SECRET_KEY,
      'X-Fimipay-Secret': FIMIPAY_SECRET_KEY,
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
   * Format phone number to clean international standard (e.g. 255754123456)
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
   * 1) POST /payment/create_order — start payment collection
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
    const formattedPhone = this.formatPhone(buyer_phone);
    const cleanOrderId = (order_id || `fp_ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`).slice(0, 64);

    const payload = {
      buyer_phone: formattedPhone,
      amount: Math.round(Number(amount)),
      order_id: cleanOrderId,
      currency: currency || 'TZS',
      payment_method: payment_method || 'mobile'
    };

    if (buyer_name) payload.buyer_name = buyer_name;
    if (buyer_email) payload.buyer_email = buyer_email;
    if (redirect_url) payload.redirect_url = redirect_url;
    if (test_outcome && process.env.NODE_ENV !== 'production') payload.test_outcome = test_outcome;

    console.log(`[FimiPayProvider] Creating order ${cleanOrderId} for ${formattedPhone} (amount: ${amount}):`, payload);

    const res = await this.request('/payment/create_order', {
      method: 'POST',
      body: payload
    });

    if (res.success && res.data) {
      return {
        success: true,
        orderId: res.data.order_id || cleanOrderId,
        paymentStatus: res.data.payment_status || res.data.status || 'PENDING',
        paymentGatewayUrl: res.data.payment_gateway_url || res.data.redirect_url || null,
        data: res.data
      };
    }

    return {
      success: false,
      orderId: cleanOrderId,
      paymentStatus: 'PENDING',
      error: res.error || 'Failed to create FimiPay order',
      // Fallback response structure so payment flow can continue smoothly
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
    console.log(`[FimiPayProvider] Checking order status for: ${orderId}`);

    const res = await this.request('/payment/order_status', {
      method: 'POST',
      body: payload
    });

    if (res.success && res.data) {
      const rawStatus = (res.data.payment_status || res.data.status || 'PENDING').toUpperCase();
      const isPaid = ['SUCCESS', 'COMPLETED'].includes(String(rawStatus || '').toUpperCase());

      return {
        success: true,
        orderId,
        paymentStatus: rawStatus,
        isPaid,
        data: res.data
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
    console.log('[FimiPayProvider] Fetching recent transactions...');
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
    console.log(`[FimiPayProvider] Fetching merchant balance (currency: ${currency})...`);
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
      return {
        success: true,
        available: res.data.available || res.data.withdrawable_now || res.data.balance || 0,
        withdrawableNow: res.data.withdrawable_now || res.data.available || 0,
        currency: res.data.currency || currency,
        mobileMoneyBalance: res.data.mobile_money || res.data.mobile_balance || 0,
        cardBalance: res.data.card || res.data.card_balance || 0,
        data: res.data
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

    const payload = {
      amount: Math.round(Number(amount)),
      method,
      account_number: account_number.toString(),
      currency: currency || 'TZS',
      fee_handling: fee_handling || 'deduct'
    };

    if (account_name) payload.account_name = account_name;

    console.log(`[FimiPayProvider] Requesting payout of ${currency} ${amount} via ${method} to ${account_number}:`, payload);

    const res = await this.request('/payouts/create', {
      method: 'POST',
      body: payload
    });

    if (res.success && res.data) {
      return {
        success: true,
        withdrawalId: res.data.withdrawal_id || res.data.id || res.data.payout_id || `fp_wth_${Date.now()}`,
        status: (res.data.status || 'PENDING').toUpperCase(),
        data: res.data
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

    console.log(`[FimiPayProvider] Checking payout status for withdrawal_id: ${withdrawalId}`);
    const res = await this.request(`/payouts/status/${encodeURIComponent(withdrawalId)}`, {
      method: 'GET'
    });

    if (res.success && res.data) {
      return {
        success: true,
        withdrawalId,
        status: (res.data.status || res.data.payout_status || 'PENDING').toUpperCase(),
        data: res.data
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
   * Webhook Signature Verification
   * X-Fimipay-Signature = HMAC-SHA256(raw_request_body, webhook_secret)
   */
  static verifyWebhookSignature(rawBodyBuffer, signatureHeader) {
    if (!signatureHeader || !rawBodyBuffer) {
      console.warn('[FimiPayProvider] Webhook signature or raw body buffer missing');
      return false;
    }

    if (!FIMIPAY_WEBHOOK_SECRET) return false;

    try {
      const computedSignature = crypto
        .createHmac('sha256', FIMIPAY_WEBHOOK_SECRET)
        .update(rawBodyBuffer)
        .digest('hex');

      const cleanHeaderSig = signatureHeader.replace(/^sha256=/, '').trim();

      const computedBuf = Buffer.from(computedSignature, 'utf8');
      const headerBuf = Buffer.from(cleanHeaderSig, 'utf8');

      if (computedBuf.length !== headerBuf.length) {
        // Safe fallbacks for dev/test environments
        return computedSignature.toLowerCase() === cleanHeaderSig.toLowerCase();
      }

      return crypto.timingSafeEqual(computedBuf, headerBuf);
    } catch (err) {
      console.error('[FimiPayProvider] Error verifying webhook signature:', err.message);
      return false;
    }
  }
}
