import { describe, test, expect } from 'vitest';
import crypto from 'crypto';
import { FimiPayProvider } from '../fimipayProvider.js';

describe('FimiPay Merchant API v1 Integration Brief Suite', () => {
  test('Phone formatting normalizes TZ MSISDN to 255 prefix for collection', () => {
    expect(FimiPayProvider.formatPhone('0754123456')).toBe('255754123456');
    expect(FimiPayProvider.formatPhone('255682812345')).toBe('255682812345');
    expect(FimiPayProvider.formatPhone('754123456')).toBe('255754123456');
  });

  test('Payout wallet phone formatting strips 0 or 255 to 9 digits', () => {
    expect(FimiPayProvider.formatPayoutPhone('0754123456')).toBe('754123456');
    expect(FimiPayProvider.formatPayoutPhone('255682812345')).toBe('682812345');
    expect(FimiPayProvider.formatPayoutPhone('754123456')).toBe('754123456');
  });

  test('Decision tree: TZS Mobile Push does NOT require buyer_email or redirect_url', async () => {
    // Override request method for unit test mock
    const originalRequest = FimiPayProvider.request;
    FimiPayProvider.request = async (endpoint, options) => {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      return {
        success: true,
        data: {
          order_id: body.order_id,
          payment_status: 'PENDING',
          payment_method: 'mobile',
          amount: body.amount,
          currency: 'TZS',
          buyer_phone: body.buyer_phone
        }
      };
    };

    try {
      const res = await FimiPayProvider.createOrder({
        buyer_phone: '0682812345',
        amount: 10000,
        currency: 'TZS',
        payment_method: 'mobile'
      });

      expect(res.success).toBe(true);
      expect(res.requiresRedirect).toBe(false);
      expect(res.paymentGatewayUrl).toBeNull();
    } finally {
      FimiPayProvider.request = originalRequest;
    }
  });

  test('Decision tree: Hosted checkout (Card/KES/USD) REQUIRES buyer_email and redirect_url', async () => {
    // Missing email/redirect_url should throw Error
    await expect(
      FimiPayProvider.createOrder({
        buyer_phone: '254712345678',
        amount: 1000,
        currency: 'KES',
        payment_method: 'mobile'
      })
    ).rejects.toThrow('Hosted checkout (KES mobile) requires both buyer_email and redirect_url.');

    // USD currency forces card and requires buyer_email + redirect_url
    await expect(
      FimiPayProvider.createOrder({
        buyer_phone: '255754123456',
        amount: 10,
        currency: 'USD'
      })
    ).rejects.toThrow('Hosted checkout (USD card) requires both buyer_email and redirect_url.');
  });

  test('Decision tree: Hosted checkout with valid buyer_email and redirect_url succeeds', async () => {
    const originalRequest = FimiPayProvider.request;
    FimiPayProvider.request = async (endpoint, options) => {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      return {
        success: true,
        data: {
          order_id: body.order_id,
          payment_status: 'PENDING',
          payment_method: body.payment_method,
          payment_gateway_url: 'https://pay.fimipay.com/checkout/test123',
          amount: body.amount,
          currency: body.currency
        }
      };
    };

    try {
      const res = await FimiPayProvider.createOrder({
        buyer_phone: '254712345678',
        amount: 1000,
        currency: 'KES',
        buyer_email: 'test@example.com',
        redirect_url: 'https://yourapp.com/payments/return'
      });

      expect(res.success).toBe(true);
      expect(res.requiresRedirect).toBe(true);
      expect(res.paymentGatewayUrl).toBe('https://pay.fimipay.com/checkout/test123');
    } finally {
      FimiPayProvider.request = originalRequest;
    }
  });

  test('Webhook raw body HMAC-SHA256 verification works timing-safely', () => {
    const secret = process.env.FIMIPAY_WEBHOOK_SECRET || 'test_webhook_secret_123';
    process.env.FIMIPAY_WEBHOOK_SECRET = secret;

    const rawPayload = Buffer.from(JSON.stringify({ event: 'payment.success', order_id: 'fp_123', payment_status: 'SUCCESS' }));
    const signature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

    const isValid = FimiPayProvider.verifyWebhookSignature(rawPayload, signature);
    expect(isValid).toBe(true);

    const isInvalid = FimiPayProvider.verifyWebhookSignature(rawPayload, 'invalid_signature_string_that_is_64_chars_long_12345678901234567890');
    expect(isInvalid).toBe(false);
  });

  test('All 6 Merchant API v1 endpoints are implemented on FimiPayProvider class', () => {
    expect(typeof FimiPayProvider.createOrder).toBe('function');
    expect(typeof FimiPayProvider.getOrderStatus).toBe('function');
    expect(typeof FimiPayProvider.getTransactions).toBe('function');
    expect(typeof FimiPayProvider.getBalance).toBe('function');
    expect(typeof FimiPayProvider.createPayout).toBe('function');
    expect(typeof FimiPayProvider.getPayoutStatus).toBe('function');
  });
});
