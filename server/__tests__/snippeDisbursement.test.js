import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnippePaymentProvider } from '../snippeProvider.js';
import { ProviderCapabilityService, PaymentRoutingService } from '../paymentRoutingService.js';
import { SettlementRouter } from '../settlementRouter.js';

describe('Snippe Payment & Automated Settlement Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Idempotency & Payload Formatting', () => {
    it('truncates idempotency key to max 30 chars for Snippe API compliance', () => {
      const longKey = 'very_long_idempotency_key_that_exceeds_thirty_characters_limit';
      const formatted = SnippePaymentProvider.formatIdempotencyKey(longKey, 'pay');
      expect(formatted.length).toBeLessThanOrEqual(30);
    });

    it('handles default idempotency key generation when undefined', () => {
      const formatted = SnippePaymentProvider.formatIdempotencyKey(undefined, 'idem');
      expect(formatted.length).toBeLessThanOrEqual(30);
      expect(formatted.startsWith('idem_')).toBe(true);
    });
  });

  describe('ProviderCapabilityService', () => {
    it('allows mobile money and bank account payouts for Snippe', () => {
      expect(ProviderCapabilityService.isPayoutSupported('SNIPPE', 'PHONE')).toBe(true);
      expect(ProviderCapabilityService.isPayoutSupported('SNIPPE', 'MOBILE_MONEY')).toBe(true);
      expect(ProviderCapabilityService.isPayoutSupported('SNIPPE', 'BANK_ACCOUNT')).toBe(true);
    });

    it('rejects unsupported destination types (LIPA, QR, CARD) for Snippe', () => {
      expect(ProviderCapabilityService.isPayoutSupported('SNIPPE', 'LIPA_NUMBER')).toBe(false);
      expect(ProviderCapabilityService.isPayoutSupported('SNIPPE', 'QR')).toBe(false);
      expect(ProviderCapabilityService.isPayoutSupported('SNIPPE', 'CARD')).toBe(false);
    });

    it('throws explicit error when validating unsupported destination capability', () => {
      expect(() => {
        ProviderCapabilityService.validateDestinationCapability('SNIPPE', { type: 'LIPA_NUMBER' });
      }).toThrow(/not currently supported/i);
    });
  });

  describe('Snippe Payout Dispatch', () => {
    it('rejects payouts under minimum amount threshold of TZS 5,000', async () => {
      const res = await SnippePaymentProvider.sendPayout({
        splitId: 'split_123',
        amount: 3000,
        channel: 'mobile',
        recipientPhone: '255754123456'
      });

      expect(res.status).toBe('FAILED');
      expect(res.failureCode).toBe('MINIMUM_PAYOUT_LIMIT');
    });

    it('dispatches valid mobile money payout request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'completed',
          id: 'SNP-PAYOUT-999',
          message: 'Payout settled'
        })
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await SnippePaymentProvider.sendPayout({
        splitId: 'split_99',
        amount: 15000,
        channel: 'mobile',
        recipientPhone: '0754123456',
        recipientName: 'John Doe'
      });

      expect(res.status).toBe('SETTLED');
      expect(res.payoutId).toBe('SNP-PAYOUT-999');
    });
  });

  describe('SettlementRouter Automated Payout Dispatch', () => {
    it('returns NOT_REQUIRED when no destination is configured', async () => {
      const mockClient = { query: vi.fn() };
      const res = await SettlementRouter.processAutomatedSettlement(mockClient, {
        paymentId: 'pay_1',
        participantId: 'p_1',
        splitId: 's_1',
        amount: 10000,
        destinationSnapshot: null
      });

      expect(res.status).toBe('NOT_REQUIRED');
    });

    it('records FAILED settlement when destination is unsupported', async () => {
      const mockClient = { query: vi.fn().mockResolvedValue({ rows: [{ id: 'settle_1' }] }) };
      const res = await SettlementRouter.processAutomatedSettlement(mockClient, {
        paymentId: 'pay_1',
        participantId: 'p_1',
        splitId: 's_1',
        amount: 10000,
        destinationSnapshot: { enabled: true, type: 'LIPA_NUMBER', provider: 'SNIPPE' }
      });

      expect(res.status).toBe('FAILED');
      expect(res.reason).toBe('UNSUPPORTED_DESTINATION');
    });
  });
});
