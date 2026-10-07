import { useState, useEffect } from 'react';
import {
  ArrowLeft, CheckCircle2, Loader2, Shield, Smartphone, Landmark,
  Wallet, Building2, Lock, Receipt, Check, AlertCircle,
} from 'lucide-react';
import { supabase, type Split, type Participant, type Merchant } from '@/lib/supabase';
import { formatMoney, formatDateTime } from '@/lib/utils';
import { CategoryIcon } from '@/components/CategoryIcon';
import StatusBadge from '@/components/StatusBadge';
import Logo from '@/components/Logo';
import TrustStrip from '@/components/TrustStrip';

type PaymentViewProps = {
  split: Split;
  participant: Participant;
  onBack: () => void;
  onComplete: () => void;
};

type PaymentMethod = 'fimipay' | 'mpesa' | 'tigo' | 'airtel' | 'bank' | 'card';

export default function PaymentView({ split, participant: initialParticipant, onBack, onComplete }: PaymentViewProps) {
  const [participant, setParticipant] = useState<Participant>(initialParticipant);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('fimipay');
  const [phoneNumber, setPhoneNumber] = useState(initialParticipant.phone || '');
  const [stage, setStage] = useState<'select' | 'processing' | 'success' | 'failed'>('select');
  const [paymentRef, setPaymentRef] = useState('');

  useEffect(() => {
    if (split.merchant_id) {
      supabase
        .from('merchants')
        .select('*')
        .eq('id', split.merchant_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setMerchant(data as Merchant);
        });
    }
  }, [split.merchant_id]);

  const methods: { id: PaymentMethod; label: string; icon: typeof Smartphone; desc: string }[] = [
    { id: 'fimipay', label: 'FimiPay Merchant v1', icon: Smartphone, desc: 'Instant mobile money & hosted checkout' },
    { id: 'bank', label: 'Bank Transfer', icon: Landmark, desc: 'Direct bank transfer' },
    { id: 'card', label: 'Card', icon: Wallet, desc: 'Visa / Mastercard' },
  ];

  useEffect(() => {
    if (stage !== 'processing') return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      try {
        const res = await fetch(`/api/participants/${participant.id}/status`);
        const data = await res.json();
        if (data.status === 'PAID') {
          clearInterval(timer);
          setStage('success');
        }
      } catch (err) {
        console.error('Status check failed:', err);
      }
      if (tries >= 100) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [stage, participant.id]);

  async function handlePay() {
    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 9) {
      window.alert('Enter a valid phone number.');
      return;
    }
    setStage('processing');

    const txRef = `FMP-TX-${Date.now().toString().slice(-7)}`;
    setPaymentRef(txRef);

    try {
      {
        const res = await fetch('/api/payments/fimipay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            split_participant_id: participant.id,
            buyer_phone: phoneNumber,
            amount: participant.allocation_amount,
            order_id: `idem_${Date.now()}`,
            buyer_name: participant.name,
            payment_method: method === 'card' ? 'card' : method === 'bank' ? 'bank' : 'mobile'
          })
        });
        const data = await res.json();
        if (data.payment_gateway_url) {
          window.location.href = data.payment_gateway_url;
          return;
        }
      }
    } catch (err) {
      console.error('Error initiating payment:', err);
    }
  }

  if (stage === 'success') {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 animate-slide-up">
        <div className="text-center mb-6">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-success-400 to-success-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-success-500/30 animate-scale-in">
            <CheckCircle2 className="h-10 w-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Payment Confirmed</h1>
          <p className="text-slate-500">Your contribution has been recorded and the organizer has been notified.</p>
        </div>

        <TrustStrip merchantName={merchant?.display_name} destinationId={merchant?.destination_id} />
        <div className="mt-5 bg-white rounded-2xl border border-slate-100 p-6 space-y-4 mb-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <span className="text-sm text-slate-500">Amount Paid</span>
            <span className="text-xl font-extrabold text-success-600">{formatMoney(participant.allocation_amount)}</span>
          </div>
          <ReceiptRow label="Payment Reference" value={paymentRef} />
          <ReceiptRow label="Method" value={methods.find((m) => m.id === method)?.label || ''} />
          <ReceiptRow label="Destination" value={merchant?.display_name || 'Manual'} />
          <ReceiptRow label="Bill" value={split.title} />
          <ReceiptRow label="Date" value={formatDateTime(new Date().toISOString())} />
        </div>

        <div className="p-4 rounded-xl bg-success-50 border border-success-100 mb-5">
          <p className="text-xs text-success-800 text-center font-medium">
            LUMO Split: Your {formatMoney(participant.allocation_amount)} payment for "{split.title}" is confirmed. Ref: {paymentRef}.
          </p>
        </div>

        <button
          onClick={onComplete}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-xl text-sm font-bold transition-all"
        >
          Back to Split
        </button>
      </div>
    );
  }

  if (stage === 'processing') {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center animate-fade-in">
        <div className="h-20 w-20 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-5">
          <Loader2 className="h-10 w-10 text-primary-600 animate-spin" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Payment Request Sent</h1>
        <p className="text-sm text-slate-500 mb-6">
          USSD Push prompt sent to {phoneNumber || 'phone'}. Enter your PIN to confirm.
        </p>
        <div className="max-w-xs mx-auto space-y-2 mb-8">
          <ProcessingStep label="USSD Push dispatched" done />
          <ProcessingStep label="Awaiting PIN entry on phone" active />
          <ProcessingStep label="Payment confirmation" />
          <ProcessingStep label="Settlement calculation" />
        </div>

      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <Logo size="sm" showText={false} />
      </div>

      {/* Bill summary */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-xl bg-slate-50 flex items-center justify-center">
            <CategoryIcon category={split.category} className="h-5 w-5 text-slate-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-slate-900 text-sm">{split.title}</h2>
            <p className="text-xs text-slate-400">Ref: {split.ref_code}</p>
          </div>
          <StatusBadge status={split.status} />
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-4">
          <Building2 className="h-5 w-5 text-slate-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">{merchant?.display_name || 'Manual destination'}</p>
            {merchant && (
              <p className="text-[10px] text-success-600 font-medium flex items-center gap-1">
                <Shield className="h-3 w-3" /> Verified Destination · {merchant.destination_id}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-100">
          <div>
            <p className="text-xs text-primary-600 font-medium">Your share</p>
            <p className="text-2xl font-extrabold text-primary-900">{formatMoney(participant.allocation_amount)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">{participant.name}</p>
            <p className="text-xs text-slate-400">{participant.phone || 'Guest'}</p>
          </div>
        </div>
      </div>

      <div className="mb-5"><TrustStrip merchantName={merchant?.display_name} destinationId={merchant?.destination_id} /></div>

      {/* Payment method */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
        <h3 className="font-bold text-slate-900 text-sm mb-4">Choose Payment Method</h3>
        <div className="space-y-2">
          {methods.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                  method === m.id
                    ? 'border-primary-300 bg-primary-50/50'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  method === m.id ? 'bg-primary-100 text-primary-600' : 'bg-slate-50 text-slate-400'
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{m.label}</p>
                  <p className="text-xs text-slate-400">{m.desc}</p>
                </div>
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  method === m.id ? 'border-primary-600 bg-primary-600' : 'border-slate-200'
                }`}>
                  {method === m.id && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Phone input for mobile money */}
      {method === 'fimipay' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {methods.find((m) => m.id === method)?.label} Phone Number
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+2557XXXXXXXX"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-sm"
          />
          <p className="text-xs text-slate-400 mt-2">
            You'll receive a USSD prompt on this phone to confirm the payment.
          </p>
        </div>
      )}

      {/* Security note */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 mb-5">
        <Lock className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-500">
          Payment is processed by a licensed/authorized payment provider. LUMO records obligations and confirmations — no funds are held by LUMO.
        </p>
      </div>

      {/* Pay button */}
      <button
        onClick={handlePay}
        className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2"
      >
        <Receipt className="h-4 w-4" />
        Pay {formatMoney(participant.allocation_amount)}
      </button>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function ProcessingStep({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100">
      <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${
        done ? 'bg-success-100 text-success-600' :
        active ? 'bg-primary-100 text-primary-600' :
        'bg-slate-100 text-slate-300'
      }`}>
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> :
         active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
         <div className="h-2 w-2 rounded-full bg-current" />}
      </div>
      <span className={`text-sm ${done || active ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
        {label}
      </span>
    </div>
  );
}
