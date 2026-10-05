import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, ArrowLeft, Banknote, Building2, Check, CheckCircle2, Clock,
  Copy, CreditCard, Landmark, Loader2, Lock, MessageCircle, Phone,
  ShieldCheck, Smartphone, Timer, X, XCircle,
} from 'lucide-react';
import { supabase, type Split, type Participant, type Merchant } from '@/lib/supabase';
import { formatMoney, formatDateTime } from '@/lib/utils';
import { CategoryIcon } from '@/components/CategoryIcon';
import TrustStrip from '@/components/TrustStrip';
import StatusBadge from '@/components/StatusBadge';
import {
  type PaymentProviderId, type PaymentResult,
  paymentProviders, MockPaymentProvider, generateIdempotencyKey,
} from '@/lib/paymentProvider';
import Logo from '@/components/Logo';

type Stage = 'loading' | 'not_found' | 'select' | 'processing' | 'success' | 'failed' | 'timeout' | 'already_paid' | 'claim_submitted';

type FriendPaymentViewProps = {
  token: string;
};

export default function FriendPaymentView({ token }: FriendPaymentViewProps) {
  const [stage, setStage] = useState<Stage>('loading');
  const [split, setSplit] = useState<Split | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [provider, setProvider] = useState<PaymentProviderId>('mpesa');
  const [phone, setPhone] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [countdown, setCountdown] = useState(120);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [txRef, setTxRef] = useState('');
  const [error, setError] = useState('');
  const [providerRef] = useState(new MockPaymentProvider(false));
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [claimSent, setClaimSent] = useState(false);

  useEffect(() => {
    void loadData();
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  async function loadData() {
    const { data: splitData } = await supabase
      .from('splits')
      .select('*')
      .eq('ref_code', token.toUpperCase())
      .maybeSingle();

    if (!splitData) { setStage('not_found'); return; }
    const s = splitData as Split;
    setSplit(s);

    if (s.merchant_id) {
      const { data: m } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', s.merchant_id)
        .maybeSingle();
      if (m) setMerchant(m as Merchant);
    }

    const { data: participants } = await supabase
      .from('split_participants')
      .select('*')
      .eq('split_id', s.id)
      .neq('is_organizer', true)
      .limit(1)
      .maybeSingle();

    if (participants) {
      const p = participants as Participant;
      setParticipant(p);
      setPayAmount(String(p.allocation_amount - p.amount_paid));
      if (p.status === 'PAID') { setStage('already_paid'); return; }
    }

    setStage('select');
  }

  const remaining = participant ? participant.allocation_amount - participant.amount_paid : 0;
  const payAmountNum = Number(payAmount) || 0;

  function startCountdown() {
    setCountdown(120);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setStage('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopCountdown() {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }

  async function handlePay() {
    if (!split || !participant) return;
    if (payAmountNum <= 0 || payAmountNum > remaining) {
      setError('Enter an amount between 1 and your remaining share.');
      return;
    }
    if (phone.length < 6) { setError('Enter a valid phone number.'); return; }

    setError('');
    setStage('processing');
    startCountdown();

    const idempotencyKey = generateIdempotencyKey();
    const providerLabel = paymentProviders[provider].label;

    const result = await providerRef.initiatePayment({
      amount: payAmountNum,
      phone,
      provider,
      idempotencyKey,
      destinationRef: merchant?.destination_id || split.ref_code,
      splitRef: split.ref_code,
      participantName: participant.name,
    });

    stopCountdown();
    setPaymentResult(result);

    if (result.status === 'SUCCESS') {
      const now = new Date().toISOString();
      const newAmountPaid = participant.amount_paid + payAmountNum;
      const isFullyPaid = newAmountPaid >= participant.allocation_amount;

      await supabase.from('payment_attempts').insert({
        split_participant_id: participant.id,
        amount: payAmountNum,
        provider: providerLabel,
        provider_tx_ref: result.txRef,
        status: 'SUCCESS',
        payment_method: provider,
        completed_at: now,
        idempotency_key: idempotencyKey,
      });

      await supabase
        .from('split_participants')
        .update({
          status: isFullyPaid ? 'PAID' : 'PENDING',
          amount_paid: newAmountPaid,
          paid_at: isFullyPaid ? now : null,
          payment_ref: result.txRef,
        })
        .eq('id', participant.id);

      const { data: allP } = await supabase
        .from('split_participants')
        .select('amount_paid, allocation_amount, status')
        .eq('split_id', split.id);
      const totalPaid = (allP || []).reduce((sum: number, p: { amount_paid: number }) => sum + (p.amount_paid || 0), 0);
      const percent = Math.round((totalPaid / split.total_amount) * 100);
      const newStatus = percent === 100 ? 'SETTLED' : 'PARTIALLY_PAID';
      await supabase.from('splits').update({ amount_paid: totalPaid, settlement_percent: percent, status: newStatus }).eq('id', split.id);

      await supabase.from('audit_logs').insert({
        actor: participant.name,
        action: 'PAYMENT_CONFIRMED',
        entity_type: 'participant',
        entity_id: participant.id,
        metadata: { amount: payAmountNum, tx_ref: result.txRef, method: provider, split_ref: split.ref_code, idempotency_key: idempotencyKey },
      });

      setTxRef(result.txRef);
      setParticipant({ ...participant, amount_paid: newAmountPaid, status: isFullyPaid ? 'PAID' : 'PENDING' });
      setStage('success');
    } else if (result.status === 'TIMEOUT') {
      setStage('timeout');
    } else {
      await supabase.from('payment_attempts').insert({
        split_participant_id: participant.id,
        amount: payAmountNum,
        provider: providerLabel,
        provider_tx_ref: result.txRef,
        status: 'FAILED',
        payment_method: provider,
        failure_code: result.failureCode || 'UNKNOWN',
        idempotency_key: idempotencyKey,
      });
      setStage('failed');
    }
  }

  function handleCancel() {
    stopCountdown();
    setStage('select');
    setPaymentResult(null);
  }

  async function handleClaim() {
    if (!split || !participant) return;
    await supabase.from('split_participants').update({ claim_status: 'claimed' }).eq('id', participant.id);
    await supabase.from('audit_logs').insert({
      actor: participant.name,
      action: 'CLAIM_ALREADY_PAID',
      entity_type: 'participant',
      entity_id: participant.id,
      metadata: { split_ref: split.ref_code, participant: participant.name },
    });
    setClaimSent(true);
    setStage('claim_submitted');
  }

  function handleRetry() {
    setStage('select');
    setPaymentResult(null);
    setError('');
  }

  if (stage === 'loading') {
    return <Shell><div className="mx-auto max-w-md px-4 py-16 text-center"><div className="h-20 w-20 rounded-2xl shimmer mx-auto" /></div></Shell>;
  }

  if (stage === 'not_found') {
    return <Shell><div className="mx-auto max-w-md px-4 py-16 text-center"><XCircle className="mx-auto mb-4 h-12 w-12 text-slate-300" /><h1 className="text-xl font-extrabold text-slate-900">Split not found</h1><p className="mt-2 text-sm text-slate-500">This payment link is invalid or has expired.</p></div></Shell>;
  }

  if (stage === 'already_paid' && split && participant) {
    return <Shell><div className="mx-auto max-w-md px-4 py-8 animate-fade-in">
      <div className="mb-6 text-center"><CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-success-500" /><h1 className="text-xl font-extrabold text-slate-900">You already paid</h1><p className="mt-1 text-sm text-slate-500">Your share for this bill has been settled.</p></div>
      {txRef && <Receipt split={split} participant={participant} merchant={merchant} txRef={participant.payment_ref || txRef} providerLabel={paymentProviders[provider].label} amount={participant.amount_paid} />}
    </div></Shell>;
  }

  if (stage === 'success' && split && participant) {
    return <Shell><div className="mx-auto max-w-md px-4 py-8 animate-slide-up">
      <div className="mb-6 text-center"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-success-400 to-success-600 shadow-lg shadow-success-500/30 animate-scale-in"><CheckCircle2 className="h-10 w-10 text-white" strokeWidth={2.5} /></div><h1 className="text-2xl font-extrabold text-slate-900">Payment Confirmed</h1><p className="mt-2 text-sm text-slate-500">Your contribution has been recorded and the organizer notified.</p></div>
      <Receipt split={split} participant={participant} merchant={merchant} txRef={txRef} providerLabel={paymentProviders[provider].label} amount={payAmountNum} />
      {participant.allocation_amount - participant.amount_paid > 0 && <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">Remaining balance: {formatMoney(participant.allocation_amount - participant.amount_paid)}. You can pay the rest later.</div>}
      <div className="mb-4 rounded-xl border border-primary-100 bg-primary-50 p-4 text-center"><p className="text-sm font-bold text-primary-900">Create your LUMO account</p><p className="mt-1 text-xs text-primary-700">Track all your splits, get reminders, and pay faster next time.</p><button className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white">Sign up free</button></div>
    </div></Shell>;
  }

  if (stage === 'processing') {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return <Shell><div className="mx-auto max-w-md px-4 py-12 text-center animate-fade-in">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-50"><Loader2 className="h-10 w-10 text-primary-600 animate-spin" /></div>
      <h1 className="text-xl font-bold text-slate-900">Waiting for approval on your phone</h1>
      <p className="mt-2 text-sm text-slate-500">Dial your {paymentProviders[provider].label} PIN to confirm {formatMoney(payAmountNum)}.</p>
      <div className="mx-auto mt-6 flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-white"><Timer className="h-5 w-5" /><span className="text-2xl font-extrabold tabular-nums">{minutes}:{seconds.toString().padStart(2, '0')}</span></div>
      <div className="mx-auto mt-6 max-w-xs space-y-2">
        <StepRow label="Payment request sent" done />
        <StepRow label="Awaiting PIN confirmation" active />
        <StepRow label="Webhook verification" />
        <StepRow label="Recording payment" />
      </div>
      <button onClick={handleCancel} className="mt-8 rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel payment</button>
    </div></Shell>;
  }

  if (stage === 'failed') {
    return <Shell><div className="mx-auto max-w-md px-4 py-8 animate-fade-in">
      <div className="mb-6 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-50"><AlertCircle className="h-8 w-8 text-error-600" /></div><h1 className="text-xl font-extrabold text-slate-900">Payment failed</h1><p className="mt-2 text-sm text-slate-500">{paymentResult?.failureMessage || 'The payment could not be completed. Please try again.'}</p></div>
      {paymentResult?.failureCode === 'INSUFFICIENT_FUNDS' && <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">Wrong amount? Check that you have enough balance and the amount matches your share.</div>}
      <button onClick={handleRetry} className="w-full rounded-xl bg-primary-600 py-3.5 text-sm font-bold text-white">Retry payment</button>
      <button onClick={handleClaim} className="mt-3 w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600">I already paid — tell the organizer</button>
    </div></Shell>;
  }

  if (stage === 'timeout') {
    return <Shell><div className="mx-auto max-w-md px-4 py-8 animate-fade-in">
      <div className="mb-6 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50"><Clock className="h-8 w-8 text-amber-600" /></div><h1 className="text-xl font-extrabold text-slate-900">Payment timed out</h1><p className="mt-2 text-sm text-slate-500">We did not receive confirmation from your phone in time.</p></div>
      <button onClick={handleRetry} className="w-full rounded-xl bg-primary-600 py-3.5 text-sm font-bold text-white">Retry payment</button>
      <button onClick={handleClaim} className="mt-3 w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600">I already paid — tell the organizer</button>
    </div></Shell>;
  }

  if (stage === 'claim_submitted') {
    return <Shell><div className="mx-auto max-w-md px-4 py-8 animate-fade-in">
      <div className="mb-6 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50"><CheckCircle2 className="h-8 w-8 text-primary-600" /></div><h1 className="text-xl font-extrabold text-slate-900">Claim sent to organizer</h1><p className="mt-2 text-sm text-slate-500">{claimSent ? `${split?.organizer_name || 'The organizer'} will review your claim and confirm the payment.` : 'The organizer has been notified.'}</p></div>
    </div></Shell>;
  }

  if (stage === 'select' && split && participant) {
    return <Shell><div className="mx-auto max-w-md px-4 py-6 animate-fade-in">
      <div className="mb-4 flex items-center justify-between"><Logo size="sm" showText={false} /><StatusBadge status={split.status} /></div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50"><CategoryIcon category={split.category} className="h-5 w-5 text-slate-600" /></div><div className="flex-1"><h2 className="text-sm font-bold text-slate-900">{split.title}</h2><p className="text-xs text-slate-400">Ref: {split.ref_code}</p></div></div>
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3"><Building2 className="h-5 w-5 text-slate-400" /><div className="flex-1"><p className="text-sm font-medium text-slate-900">{merchant?.display_name || 'Verified destination'}</p>{merchant && <p className="flex items-center gap-1 text-[10px] font-medium text-success-600"><ShieldCheck className="h-3 w-3" /> Verified · {merchant.destination_id}</p>}</div></div>
        <p className="mb-3 text-sm text-slate-500">{split.organizer_name} invited you to this bill.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-[10px] font-medium uppercase text-slate-400">Total bill</p><p className="mt-1 text-sm font-extrabold text-slate-900">{formatMoney(split.total_amount)}</p></div>
          <div className="rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/50 p-3 text-center border border-primary-100"><p className="text-[10px] font-medium uppercase text-primary-600">Your share</p><p className="mt-1 text-lg font-extrabold text-primary-900">{formatMoney(remaining)}</p></div>
        </div>
        {participant.amount_paid > 0 && <p className="mt-3 text-center text-xs text-success-600 font-medium">You have already paid {formatMoney(participant.amount_paid)}.</p>}
      </div>

      <div className="mt-3"><TrustStrip merchantName={merchant?.display_name} destinationId={merchant?.destination_id} /></div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-900">Choose provider</h3>
        <div className="space-y-2">{Object.values(paymentProviders).map((p) => { const Icon = providerIcon(p.id); return <button key={p.id} onClick={() => setProvider(p.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition ${provider === p.id ? 'border-primary-300 bg-primary-50/50' : 'border-slate-100 hover:border-slate-200'}`}><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${provider === p.id ? 'bg-primary-100 text-primary-600' : 'bg-slate-50 text-slate-400'}`}><Icon className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-semibold text-slate-900">{p.label}</p><p className="text-xs text-slate-400">{p.desc}</p></div><div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${provider === p.id ? 'border-primary-600 bg-primary-600' : 'border-slate-200'}`}>{provider === p.id && <Check className="h-3 w-3 text-white" strokeWidth={3} />}</div></button>; })}</div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone number</label>
        <div className="flex overflow-hidden rounded-lg border border-slate-200"><span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500">+255</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="712 345 678" className="min-w-0 flex-1 px-3 py-3 text-sm outline-none" /></div>
        <label className="mt-4 block text-sm font-medium text-slate-700 mb-1.5">Amount to pay (TZS)</label>
        <input type="number" min="1" max={remaining} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-primary-400" />
        <p className="mt-1 text-xs text-slate-400">You can pay part of your share now. Remaining: {formatMoney(remaining - payAmountNum > 0 ? remaining - payAmountNum : 0)}</p>
      </div>

      {error && <p className="mt-3 rounded-xl border border-error-100 bg-error-50 px-4 py-3 text-sm font-semibold text-error-700">{error}</p>}

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><p className="text-xs text-slate-500">Payment is processed by a licensed payment provider. LUMO never holds your money.</p></div>

      <button onClick={handlePay} disabled={payAmountNum <= 0 || payAmountNum > remaining || phone.length < 6} className="mt-4 w-full rounded-xl bg-primary-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary-500/20 disabled:cursor-not-allowed disabled:bg-slate-200">Pay {formatMoney(payAmountNum || 0)}</button>

      <button onClick={handleClaim} className="mt-3 w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600">I already paid — tell the organizer</button>
    </div></Shell>;
  }

  return <Shell><div className="mx-auto max-w-md px-4 py-16 text-center"><p className="text-sm text-slate-500">Loading...</p></div></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}

function Receipt({ split, participant, merchant, txRef, providerLabel, amount }: { split: Split; participant: Participant; merchant: Merchant | null; txRef: string; providerLabel: string; amount: number }) {
  const [copied, setCopied] = useState(false);
  return <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4"><span className="text-sm text-slate-500">Amount Paid</span><span className="text-xl font-extrabold text-success-600">{formatMoney(amount)}</span></div>
    <Row label="Transaction ID" value={txRef} />
    <Row label="Date" value={formatDateTime(new Date().toISOString())} />
    <Row label="Paid directly to" value={merchant?.display_name || 'Verified destination'} highlight />
    <Row label="Method" value={providerLabel} />
    <Row label="Bill" value={split.title} />
    <Row label="Status" value="Confirmed" />
    <div className="mt-4"><TrustStrip merchantName={merchant?.display_name} destinationId={merchant?.destination_id} /></div>
    <button onClick={() => { void navigator.clipboard?.writeText(txRef); setCopied(true); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-xs font-bold text-slate-600">{copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy transaction ID'}</button>
  </div>;
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className="flex items-center justify-between py-2 text-sm"><span className="text-slate-500">{label}</span><span className={`font-medium ${highlight ? 'text-success-600' : 'text-slate-900'}`}>{value}</span></div>;
}

function StepRow({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-2.5"><div className={`flex h-6 w-6 items-center justify-center rounded-full ${done ? 'bg-success-100 text-success-600' : active ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-300'}`}>{done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <div className="h-2 w-2 rounded-full bg-current" />}</div><span className={`text-sm ${done || active ? 'font-medium text-slate-900' : 'text-slate-400'}`}>{label}</span></div>;
}

function providerIcon(id: PaymentProviderId): typeof Smartphone {
  switch (id) {
    case 'bank': return Landmark;
    case 'card': return CreditCard;
    default: return Smartphone;
  }
}
