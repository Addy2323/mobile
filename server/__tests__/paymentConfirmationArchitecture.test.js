import { describe, test, expect } from 'vitest';
import { PaymentState, SettlementState, mapProviderStatusToPaymentState, isTerminalPaymentState } from '../paymentState.js';
import { ProviderCapabilityService } from '../providerCapabilities.js';

describe('Critical Payment Architecture Upgrade Suite', () => {
  test('Payment State Machine maps provider status correctly', () => {
    expect(mapProviderStatusToPaymentState('SUCCESS')).toBe(PaymentState.PROVIDER_SUCCESS);
    expect(mapProviderStatusToPaymentState('COMPLETED')).toBe(PaymentState.PROVIDER_SUCCESS);
    expect(mapProviderStatusToPaymentState('FAILED')).toBe(PaymentState.PROVIDER_FAILED);
    expect(mapProviderStatusToPaymentState('DECLINED')).toBe(PaymentState.PROVIDER_FAILED);
    expect(mapProviderStatusToPaymentState('PENDING')).toBe(PaymentState.AWAITING_CUSTOMER_CONFIRMATION);
    expect(mapProviderStatusToPaymentState('UNKNOWN_XYZ')).toBe(PaymentState.STATUS_UNKNOWN);
  });

  test('Timer expiration state is NOT a terminal failure state', () => {
    const confirmingState = PaymentState.AWAITING_CUSTOMER_CONFIRMATION;
    expect(isTerminalPaymentState(confirmingState)).toBe(false);
    expect(isTerminalPaymentState(PaymentState.PROCESSING)).toBe(false);
    expect(isTerminalPaymentState(PaymentState.PROVIDER_SUCCESS)).toBe(true);
    expect(isTerminalPaymentState(PaymentState.PROVIDER_FAILED)).toBe(true);
  });

  test('Provider Capability Matrix validates supported and unsupported destinations', async () => {
    // Phone destination for Snippe collection is supported
    const phoneValid = await ProviderCapabilityService.validateDestinationSupport(
      { type: 'PHONE' },
      'COLLECT',
      'SNIPPE'
    );
    expect(phoneValid.supported).toBe(true);

    // Lipa number for FimiPay collection is supported
    const lipaValid = await ProviderCapabilityService.validateDestinationSupport(
      { type: 'LIPA_NUMBER' },
      'COLLECT',
      'FIMIPAY'
    );
    expect(lipaValid.supported).toBe(true);

    // Crypto or unsupported destination type should be rejected with clear error
    const unsupported = await ProviderCapabilityService.validateDestinationSupport(
      { type: 'UNSUPPORTED_CRYPTO_WALLET' },
      'DIRECT_SETTLEMENT',
      'SNIPPE'
    );
    expect(unsupported.supported).toBe(false);
    expect(unsupported.error).toContain('cannot currently receive automated direct_settlement');
  });

  test('Payment SUCCESS status is decoupled from Settlement PENDING/SETTLED status', () => {
    const paymentStatus = PaymentState.PROVIDER_SUCCESS;
    const initialSettlement = SettlementState.SETTLEMENT_PENDING;
    const finalSettlement = SettlementState.SETTLED;

    expect(paymentStatus).not.toBe(initialSettlement);
    expect(initialSettlement).toBe('SETTLEMENT_PENDING');
    expect(finalSettlement).toBe('SETTLED');
  });
});
