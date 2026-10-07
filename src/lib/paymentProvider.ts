export type PaymentProviderId = 'mpesa' | 'airtel' | 'mixx' | 'halopesa' | 'bank' | 'card' | 'snippe' | 'fimipay';

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
  fimipay: { id: 'fimipay', label: 'FimiPay Merchant API v1', desc: 'FimiPay instant mobile money push & hosted checkout' },
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

export class FimiPayPaymentProviderClient implements PaymentProvider {
  readonly id = 'fimipay';
  readonly label = 'FimiPay Merchant API v1';

  async initiatePayment(request: PaymentRequest): Promise<PaymentResult> {
    const API_BASE = '/api';

    try {
      const res = await fetch(`${API_BASE}/payments/fimipay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          split_participant_id: request.participantId,
          buyer_phone: request.phone,
          amount: request.amount,
          order_id: request.idempotencyKey,
          buyer_name: request.participantName,
          buyer_email: request.buyerEmail,
          payment_method: request.provider === 'card' ? 'card' : request.provider === 'bank' ? 'bank' : 'mobile',
          redirect_url: request.redirectUrl
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          status: 'FAILED',
          txRef: generateTxRef(),
          failureCode: 'FIMIPAY_ORDER_FAILED',
          failureMessage: errData.error || 'FimiPay order creation failed.'
        };
      }

      const data = await res.json();
      return {
        status: (data.payment_status === 'SUCCESS' ? 'SUCCESS' : 'PENDING'),
        txRef: data.order_id || generateTxRef(),
        paymentGatewayUrl: data.payment_gateway_url || undefined
      };
    } catch {
      return {
        status: 'PENDING',
        txRef: generateTxRef()
      };
    }
  }

  async checkOrderStatus(orderId: string): Promise<PaymentResult> {
    const API_BASE = '/api';

    try {
      const res = await fetch(`${API_BASE}/payments/fimipay/order-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId })
      });

      if (!res.ok) {
        return { status: 'PENDING', txRef: orderId };
      }

      const data = await res.json();
      return {
        status: data.isPaid ? 'SUCCESS' : 'PENDING',
        txRef: orderId
      };
    } catch {
      return { status: 'PENDING', txRef: orderId };
    }
  }
}

export class SnippePaymentProviderClient implements PaymentProvider {
  readonly id = 'snippe';
  readonly label = 'Snippe Payment Provider';

  async initiatePayment(request: PaymentRequest): Promise<PaymentResult> {
    const API_BASE = '/api';

    try {
      const res = await fetch(`${API_BASE}/payments/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          split_participant_id: request.participantId,
          phone: request.phone,
          payment_method: request.provider
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
        status: 'PENDING',
        txRef: data.providerTxRef || generateTxRef()
      };
    } catch {
      // Fallback for offline/mock scenario
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

