import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { SnippePaymentProvider } from '../snippeProvider.js';
import { ApplicationIntegrationService } from '../applicationIntegrationService.js';
import { SnippeReconciliationJob } from '../reconciliationJob.js';

describe('Snippe Webhooks & Multi-Website Integration Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ApplicationIntegrationService URL & Domain Validation', () => {
    it('validates allowed website webhook URLs and prevents SSRF', () => {
      const validUrl = 'https://mhemalogistics.co.tz/api/webhooks/snippe';
      const result = ApplicationIntegrationService.validateWebhookUrl(validUrl);
      expect(result).toBe(validUrl);
    });

    it('rejects invalid non-HTTP/HTTPS webhook URLs', () => {
      expect(() => {
        ApplicationIntegrationService.validateWebhookUrl('ftp://invalid-domain.com/webhook');
      }).toThrow(/must use HTTP or HTTPS/i);
    });

    it('formats integration object correctly', () => {
      const dbRow = {
        id: 'int_123',
        application_key: 'rewamart',
        display_name: 'RewaMart E-Commerce',
        website_domain: 'rewamart.co.tz',
        webhook_url: 'https://rewamart.co.tz/api/webhooks/snippe',
        redirect_url: 'https://rewamart.co.tz/checkout/success',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const formatted = ApplicationIntegrationService.formatIntegration(dbRow);
      expect(formatted.applicationKey).toBe('rewamart');
      expect(formatted.webhookUrl).toBe('https://rewamart.co.tz/api/webhooks/snippe');
      expect(formatted.isActive).toBe(true);
    });
  });

  describe('Snippe Payment Initiation & Payload Metadata', () => {
    it('sends top-level webhook_url and structured metadata in POST /v1/payments payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'pending',
          reference: 'SNP-REF-8899',
          message: 'USSD prompt dispatched'
        })
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await SnippePaymentProvider.initiatePayment({
        amount: 15000,
        phone: '0754123456',
        splitId: 'split_abc_123',
        participantId: 'part_xyz_456',
        participantName: 'Juma Hassan',
        webhookUrl: 'https://mhemalogistics.co.tz/api/webhooks/snippe',
        applicationKey: 'mhema-logistics',
        resourceType: 'split',
        resourceId: 'split_abc_123',
        internalPaymentId: 'PAY-100200'
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [callUrl, callOptions] = mockFetch.mock.calls[0];

      expect(callUrl).toContain('/v1/payments');
      const body = JSON.parse(callOptions.body);

      // Verify top-level dynamic webhook URL
      expect(body.webhook_url).toBe('https://mhemalogistics.co.tz/api/webhooks/snippe');

      // Verify metadata structure
      expect(body.metadata).toEqual({
        application: 'mhema-logistics',
        internal_payment_id: 'PAY-100200',
        resource_type: 'split',
        resource_id: 'split_abc_123',
        split_id: 'split_abc_123',
        participant_id: 'part_xyz_456',
        participant_name: 'Juma Hassan'
      });

      expect(result.status).toBe('PENDING');
      expect(result.providerTxRef).toBe('SNP-REF-8899');
    });

    it('rejects collection amounts below TZS 500 threshold', async () => {
      const res = await SnippePaymentProvider.initiatePayment({
        amount: 300,
        phone: '0754123456'
      });

      expect(res.status).toBe('FAILED');
      expect(res.failureCode).toBe('MINIMUM_AMOUNT_NOT_MET');
    });
  });

  describe('HMAC Webhook Signature & Timestamp Freshness Verification', () => {
    it('verifies valid HMAC SHA256 signature with timestamp header', () => {
      const secret = process.env.SNIPPE_WEBHOOK_SECRET || 'test_secret_key';
      process.env.SNIPPE_WEBHOOK_SECRET = secret;

      const rawBody = JSON.stringify({
        event_type: 'payment.completed',
        data: { reference: 'SNP-12345', amount: 15000 }
      });

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const message = `${timestamp}.${rawBody}`;
      const computedSignature = crypto.createHmac('sha256', secret).update(message).digest('hex');

      const isValid = SnippePaymentProvider.verifyWebhookSignature(rawBody, {
        headers: {
          'x-webhook-signature': computedSignature,
          'x-webhook-timestamp': timestamp
        }
      });

      expect(isValid).toBe(true);
    });

    it('rejects stale webhook timestamps exceeding 5 minutes', () => {
      const secret = 'test_secret_key';
      process.env.SNIPPE_WEBHOOK_SECRET = secret;

      const rawBody = JSON.stringify({ event_type: 'payment.completed' });
      const staleTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes old
      const message = `${staleTimestamp}.${rawBody}`;
      const computedSignature = crypto.createHmac('sha256', secret).update(message).digest('hex');

      const isValid = SnippePaymentProvider.verifyWebhookSignature(rawBody, {
        headers: {
          'x-webhook-signature': computedSignature,
          'x-webhook-timestamp': staleTimestamp
        }
      });

      expect(isValid).toBe(false);
    });

    it('rejects invalid HMAC signatures', () => {
      const secret = 'test_secret_key';
      process.env.SNIPPE_WEBHOOK_SECRET = secret;

      const rawBody = JSON.stringify({ event_type: 'payment.completed' });
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const isValid = SnippePaymentProvider.verifyWebhookSignature(rawBody, {
        headers: {
          'x-webhook-signature': 'invalid_signature_hash_string',
          'x-webhook-timestamp': timestamp
        }
      });

      expect(isValid).toBe(false);
    });
  });

  describe('SnippeReconciliationJob Payment Status Recovery', () => {
    it('polls GET /v1/payments/{reference} and updates pending payment status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            reference: 'SNP-REF-100',
            status: 'completed',
            amount: 25000
          }
        })
      });
      vi.stubGlobal('fetch', mockFetch);

      const statusRes = await SnippePaymentProvider.getPaymentStatus('SNP-REF-100');
      expect(statusRes.success).toBe(true);
      expect(statusRes.isPaid).toBe(true);
      expect(statusRes.paymentStatus).toBe('SUCCESS');
    });

    it('handles failed payments correctly during provider lookup', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            reference: 'SNP-REF-200',
            status: 'failed',
            failure_reason: 'User entered wrong PIN'
          }
        })
      });
      vi.stubGlobal('fetch', mockFetch);

      const statusRes = await SnippePaymentProvider.getPaymentStatus('SNP-REF-200');
      expect(statusRes.success).toBe(true);
      expect(statusRes.isPaid).toBe(false);
      expect(statusRes.isFailed).toBe(true);
      expect(statusRes.paymentStatus).toBe('FAILED');
    });
  });
});
