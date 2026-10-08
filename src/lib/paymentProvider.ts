export type PaymentProviderId = 'mpesa' | 'airtel' | 'mixx' | 'halopesa' | 'bank' | 'card' | 'snippe';

export type PaymentRequest = {
  amount: number;
  phone: string;
  provider: PaymentProviderId;
  idempotencyKey: string;
  destinationRef: string;
  splitRef: string;
  participantName: string;
  participantId?: string;
  buyerEmail?: string;
  redirectUrl?: string;
};

export type PaymentResult = {
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'PENDING';
  txRef: string;
  paymentGatewayUrl?: string;
  failureCode?: string;
  failureMessage?: string;
};

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  initiatePayment(request: PaymentRequest): Promise<PaymentResult>;
}

export const paymentProviders: Record<PaymentProviderId, { id: PaymentProviderId; label: string; desc: string }> = {
  snippe: { id: 'snippe', label: 'Snippe Payment Engine', desc: 'Direct Snippe mobile money push & automated settlement' },
  mpesa: { id: 'mpesa', label: 'M-Pesa (Snippe)', desc: 'Vodacom mobile money via Snippe' },
  airtel: { id: 'airtel', label: 'Airtel Money (Snippe)', desc: 'Airtel mobile money via Snippe' },
  mixx: { id: 'mixx', label: 'Mixx by Yas (Snippe)', desc: 'Yas mobile money via Snippe' },
  halopesa: { id: 'halopesa', label: 'Halopesa (Snippe)', desc: 'HaloPesa mobile money via Snippe' },
  bank: { id: 'bank', label: 'Bank Transfer', desc: 'Direct bank transfer' },
  card: { id: 'card', label: 'Card', desc: 'Visa / Mastercard' },
};

function generateTxRef(): string {
  return `TX${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
}

export class SnippePaymentProviderClient implements PaymentProvider {
  readonly id = 'snippe';
  readonly label = 'Snippe Payment Provider';

  async initiatePayment(request: PaymentRequest): Promise<PaymentResult> {
    const API_BASE = '/api';

    try {
      const res = await fetch(`${API_BASE}/payments/snippe/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          split_participant_id: request.participantId,
          phone: request.phone,
          amount: request.amount,
          idempotency_key: request.idempotencyKey
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          status: 'FAILED',
          txRef: generateTxRef(),
          failureCode: 'PAYMENT_REJECTED',
          failureMessage: errData.error || 'Payment initiation failed.'
        };
      }

      const data = await res.json();
      return {
        status: data.status === 'SUCCESS' ? 'SUCCESS' : 'PENDING',
        txRef: data.providerTxRef || generateTxRef()
      };
    } catch {
      return {
        status: 'PENDING',
        txRef: generateTxRef()
      };
    }
  }
}

export class MockPaymentProvider implements PaymentProvider {
  readonly id = 'mock';
  readonly label = 'Mock Provider';
  private shouldFail: boolean;

  constructor(shouldFail = false) {
    this.shouldFail = shouldFail;
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResult> {
    await new Promise((resolve) => setTimeout(resolve, 2000));

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
