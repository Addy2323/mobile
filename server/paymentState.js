// Payment and Settlement State Machine Constants

export const PaymentState = Object.freeze({
  CREATED: 'CREATED',
  INITIATED: 'INITIATED',
  PROCESSING: 'PROCESSING',
  AWAITING_CUSTOMER_CONFIRMATION: 'AWAITING_CUSTOMER_CONFIRMATION',
  PROVIDER_SUCCESS: 'PROVIDER_SUCCESS',
  PROVIDER_FAILED: 'PROVIDER_FAILED',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  STATUS_UNKNOWN: 'STATUS_UNKNOWN',
  CANCELLED: 'CANCELLED',
  REVERSED: 'REVERSED',
});

export const SettlementState = Object.freeze({
  SETTLEMENT_PENDING: 'SETTLEMENT_PENDING',
  SETTLEMENT_PROCESSING: 'SETTLEMENT_PROCESSING',
  SETTLED: 'SETTLED',
  SETTLEMENT_FAILED: 'SETTLEMENT_FAILED',
});

export function isTerminalPaymentState(state) {
  return [
    PaymentState.PROVIDER_SUCCESS,
    PaymentState.PROVIDER_FAILED,
    PaymentState.CANCELLED,
    PaymentState.REVERSED,
  ].includes(state);
}

export function isTerminalSettlementState(state) {
  return [
    SettlementState.SETTLED,
    SettlementState.SETTLEMENT_FAILED,
  ].includes(state);
}

export function mapProviderStatusToPaymentState(providerStatus) {
  if (!providerStatus) return PaymentState.STATUS_UNKNOWN;
  const normalized = String(providerStatus).toUpperCase();
  switch (normalized) {
    case 'SUCCESS':
    case 'SUCCESSFUL':
    case 'COMPLETED':
    case 'PAID':
      return PaymentState.PROVIDER_SUCCESS;
    case 'FAILED':
    case 'FAILURE':
    case 'REJECTED':
    case 'DECLINED':
      return PaymentState.PROVIDER_FAILED;
    case 'CANCELLED':
    case 'CANCELED':
      return PaymentState.CANCELLED;
    case 'EXPIRED':
    case 'TIMEOUT':
      return PaymentState.PROVIDER_TIMEOUT;
    case 'PENDING':
    case 'PROCESSING':
    case 'INITIATED':
    case 'WAITING_FOR_PIN':
      return PaymentState.AWAITING_CUSTOMER_CONFIRMATION;
    default:
      return PaymentState.STATUS_UNKNOWN;
  }
}
