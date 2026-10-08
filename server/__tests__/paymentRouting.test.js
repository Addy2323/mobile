import { describe, it, expect } from 'vitest';
import { PaymentRoutingService } from '../paymentRoutingService.js';

describe('PaymentRoutingService Unit & Integration Tests', () => {
  describe('Destination Validation', () => {
    it('validates PHONE destination type correctly', () => {
      const dest = {
        type: 'PHONE',
        phone_number: '0754 123 456',
        provider: 'MOBILE_MONEY',
      };
      const validated = PaymentRoutingService.validateDestination(dest);
      expect(validated.type).toBe('PHONE');
      expect(validated.phone_number).toBe('+255754123456');
    });

    it('validates LIPA_NUMBER destination type', () => {
      const dest = {
        type: 'LIPA_NUMBER',
        lipa_number: '1234567',
      };
      const validated = PaymentRoutingService.validateDestination(dest);
      expect(validated.type).toBe('LIPA_NUMBER');
      expect(validated.lipa_number).toBe('1234567');
    });

    it('validates BANK_ACCOUNT destination type', () => {
      const dest = {
        type: 'BANK_ACCOUNT',
        bank_name: 'NMB',
        account_number: '20110023456',
        beneficiary_full_name: 'Kevin Joseph',
      };
      const validated = PaymentRoutingService.validateDestination(dest);
      expect(validated.type).toBe('BANK_ACCOUNT');
      expect(validated.bank_name).toBe('NMB');
      expect(validated.account_number).toBe('20110023456');
      expect(validated.beneficiary_full_name).toBe('Kevin Joseph');
    });

    it('rejects unsupported destination types', () => {
      expect(() => {
        PaymentRoutingService.validateDestination({ type: 'INVALID_TYPE' });
      }).toThrow('Unsupported payment destination type');
    });
  });

  describe('Destination Snapshot Creation', () => {
    it('creates accurate immutable snapshot for Bank destination', () => {
      const dbRecord = {
        id: 'dest_123',
        type: 'BANK_ACCOUNT',
        bank_name: 'CRDB',
        account_number: '0150299887700',
        beneficiary_full_name: 'Asia Msechu',
        display_name: 'CRDB Main Account',
        created_at: new Date().toISOString(),
      };

      const snapshot = PaymentRoutingService.createSnapshot(dbRecord);
      expect(snapshot.enabled).toBe(true);
      expect(snapshot.destinationId).toBe('dest_123');
      expect(snapshot.type).toBe('BANK_ACCOUNT');
      expect(snapshot.accountNumberMasked).toBe('••••7700');
      expect(snapshot.displayName).toBe('CRDB Main Account');
      expect(snapshot.beneficiaryName).toBe('Asia Msechu');
    });

    it('returns default fallback snapshot when destination is null', () => {
      const snapshot = PaymentRoutingService.createSnapshot(null);
      expect(snapshot.enabled).toBe(false);
      expect(snapshot.destinationId).toBeNull();
      expect(snapshot.displayName).toBe('LUMO Platform Collection Account');
    });
  });

  describe('Payment Link Expiration Logic', () => {
    it('correctly calculates expires_at for 24_HOURS mode', () => {
      const expiresAt = PaymentRoutingService.calculateExpirationDate('24_HOURS');
      expect(expiresAt).not.toBeNull();
      const diffHours = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
      expect(Math.round(diffHours)).toBe(24);
    });

    it('correctly identifies expired link', () => {
      const link = {
        status: 'ACTIVE',
        expiration_mode: '24_HOURS',
        expires_at: new Date(Date.now() - 10000).toISOString(),
      };

      const status = PaymentRoutingService.evaluateLinkStatus(link);
      expect(status.isValid).toBe(false);
      expect(status.error).toContain('expired');
    });

    it('correctly identifies used link in AFTER_PAYMENT mode', () => {
      const link = {
        status: 'PAID',
        expiration_mode: 'AFTER_PAYMENT',
        expires_at: null,
      };

      const status = PaymentRoutingService.evaluateLinkStatus(link);
      expect(status.isValid).toBe(false);
      expect(status.error).toContain('already been used');
    });
  });
});
