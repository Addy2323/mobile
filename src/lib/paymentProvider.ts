export type PaymentProviderId = 'mpesa' | 'airtel' | 'mixx' | 'halopesa' | 'bank' | 'card';

export type PaymentRequest = {
  amount: number;
  phone: string;
  provider: PaymentProviderId;
  idempotencyKey: string;
  destinationRef: string;
  splitRef: string;
  participantName: string;
};

export type PaymentResult = {
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  txRef: string;
  failureCode?: string;
  failureMessage?: string;
};

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  initiatePayment(request: PaymentRequest): Promise<PaymentResult>;
}

export const paymentProviders: Record<PaymentProviderId, { id: PaymentProviderId; label: string; desc: string }> = {
  mpesa: { id: 'mpesa', label: 'M-Pesa', desc: 'Vodacom mobile money' },
  airtel: { id: 'airtel', label: 'Airtel Money', desc: 'Airtel mobile money' },
  mixx: { id: 'mixx', label: 'Mixx by Yas', desc: 'Yas mobile money' },
  halopesa: { id: 'halopesa', label: 'Halopesa', desc: 'HaloPesa mobile money' },
  bank: { id: 'bank', label: 'Bank Transfer', desc: 'Direct bank transfer' },
  card: { id: 'card', label: 'Card', desc: 'Visa / Mastercard' },
};

function generateTxRef(): string {
  return `TX${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly id = 'mock';
  readonly label = 'Mock Provider';
  private shouldFail: boolean;

  constructor(shouldFail = false) {
    this.shouldFail = shouldFail;
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResult> {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (this.shouldFail || request.phone.length < 6) {
      return {
        status: 'FAILED',
        txRef: generateTxRef(),
        failureCode: 'INSUFFICIENT_FUNDS',
        failureMessage: 'The payment could not be completed. Check your balance and try again.',
      };
    }

    return {
      status: 'SUCCESS',
      txRef: generateTxRef(),
    };
  }
}

export function generateIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
