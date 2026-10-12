import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, ArrowLeft, Banknote, Building2, Check, CheckCircle2, Clock,
  Copy, CreditCard, Download, Landmark, Loader2, Lock, MessageCircle, Phone,
  ShieldCheck, Smartphone, Timer, X, XCircle,
} from 'lucide-react';
import { supabase, type Split, type Participant, type Merchant } from '@/lib/supabase';
import { formatMoney, formatDateTime } from '@/lib/utils';
import { downloadColoredReceipt } from '@/lib/coloredReceipt';
import { CategoryIcon } from '@/components/CategoryIcon';
import TrustStrip from '@/components/TrustStrip';
import StatusBadge from '@/components/StatusBadge';
import {
  type PaymentProviderId, type PaymentResult,
  paymentProviders, MockPaymentProvider, SnippePaymentProviderClient, generateIdempotencyKey,
} from '@/lib/paymentProvider';
import Logo from '@/components/Logo';

type Stage = 'choose' | 'loading' | 'not_found' | 'select' | 'processing' | 'confirming' | 'success' | 'failed' | 'timeout' | 'already_paid' | 'claim_submitted';

type FriendPaymentViewProps = {
  token: string;
};

export default function FriendPaymentView({ token }: FriendPaymentViewProps) {
  const [stage, setStage] = useState<Stage>('loading');
  const [others, setOthers] = useState<Participant[]>([]);
  const [split, setSplit] = useState<Split | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [provider, setProvider] = useState<PaymentProviderId>('snippe');
  const [phone, setPhone] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [countdown, setCountdown] = useState(120);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [txRef, setTxRef] = useState('');
  const [error, setError] = useState('');
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [claimSent, setClaimSent] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [lastPaidAmount, setLastPaidAmount] = useState<number | null>(null);

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

    if (!splitData) {
      try {
        const pubRes = await fetch(`/api/public/payment-links/${encodeURIComponent(token)}`);
        if (pubRes.ok) {
          window.location.reload();
          return;
        }
      } catch {}
      setStage('not_found');
      return;
    }
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

    const { data: plist } = await supabase
      .from('split_participants')
      .select('*')
      .eq('split_id', s.id);
    const payers = Array.isArray(plist) ? (plist as Participant[]) : [];
    setOthers(payers);

    const searchParams = new URLSearchParams(window.location.search);
    const targetToken = searchParams.get('c') || searchParams.get('token') || searchParams.get('p');

    if (targetToken) {
      const match = payers.find((p) => (p as any).contribution_token === targetToken || p.id === targetToken);
      if (match) {
        setParticipant(match);
        if (match.status === 'PAID') { setStage('already_paid'); return; }
        setStage('select');
        return;
      }
    }

    if (payers.length > 1) { setStage('choose'); return; }
    if (payers.length === 1) {
      const p = payers[0];
      setParticipant(p);
      if (p.status === 'PAID') { setStage('already_paid'); return; }
    }

    setStage('select');
  }

  const alloc = participant
    ? Number(participant.allocation_amount || 0)
    : (split ? Number(split.total_amount || 0) / Math.max(1, split.participant_count || 1) : 0);
  const paid = participant ? Number(participant.amount_paid || 0) : 0;
  const remaining = Math.max(0, alloc - paid);
  const payAmountNum = remaining;

  function startCountdown() {
    setCountdown(120);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setStage('confirming');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopCountdown() {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }

  async function checkPaymentStatusNow(orderId?: string) {
    if (!participant) return false;
    setIsCheckingStatus(true);

    const checkOrderId = orderId || txRef;

    try {
      // 1. Check dedicated payment status endpoint first if orderId exists
      if (checkOrderId) {
        const pRes = await fetch(`/api/payments/${encodeURIComponent(checkOrderId)}/status`);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.isPaid || pData.status === 'COMPLETED') {
            stopCountdown();
            setParticipant({ ...participant, amount_paid: participant.allocation_amount, status: 'PAID' });
            setStage('success');
            setIsCheckingStatus(false);
            return true;
          }
          if (pData.isFailed || pData.status === 'FAILED') {
            stopCountdown();
            setPaymentResult({
              status: 'FAILED',
              txRef: checkOrderId,
              failureCode: 'CANCELLED',
              failureMessage: 'Payment was cancelled or rejected on your phone.'
            });
            setStage('failed');
            setIsCheckingStatus(false);
            return true;
          }
        }
      }

      // 2. Check participant status endpoint
      const res = await fetch(`/api/participants/${participant.id}/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'PAID' || data.is_paid) {
          stopCountdown();
          setParticipant({ ...participant, amount_paid: participant.allocation_amount, status: 'PAID' });
          setStage('success');
          setIsCheckingStatus(false);
          return true;
        }
        if (data.status === 'FAILED') {
          stopCountdown();
          setPaymentResult({
            status: 'FAILED',
            txRef: checkOrderId,
            failureCode: data.payment_status || 'CANCELLED',
            failureMessage: data.failure_reason || 'Payment was cancelled or rejected on your phone.'
          });
          setStage('failed');
          setIsCheckingStatus(false);
          return true;
        }
      }

      // 3. Fallback: query Supabase directly
      const { data: dbPart } = await supabase
        .from('split_participants')
        .select('status, amount_paid, allocation_amount')
        .eq('id', participant.id)
        .maybeSingle();

      if (dbPart && dbPart.status === 'PAID') {
        stopCountdown();
        setParticipant({ ...participant, amount_paid: dbPart.allocation_amount, status: 'PAID' });
        setStage('success');
        setIsCheckingStatus(false);
        return true;
      }
    } catch {
      // ignore check error
    } finally {
      setIsCheckingStatus(false);
    }

    return false;
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
    setLastPaidAmount(payAmountNum);
    startCountdown();

    const idempotencyKey = generateIdempotencyKey();
    const providerClient = new SnippePaymentProviderClient();

    const result = await providerClient.initiatePayment({
      amount: payAmountNum,
      phone,
      provider,
      idempotencyKey,
      destinationRef: merchant?.destination_id || split.ref_code,
      splitRef: split.ref_code,
      participantName: participant.name,
      participantId: participant.id
    });
    setPaymentResult(result);

    if (result.paymentGatewayUrl) {
      stopCountdown();
      window.location.href = result.paymentGatewayUrl;
      return;
    }

    if (result.status === 'FAILED') {
      stopCountdown();
      setStage('failed');
      return;
    }

    setTxRef(result.txRef);

    // Continuous polling loop (up to 5 minutes)
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const paidSuccess = await checkPaymentStatusNow(result.txRef);
      if (paidSuccess) return;
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

  if (stage === 'choose') {
    return (
      <Shell>
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-xl font-extrabold text-white mb-1">Who are you?</h1>
          <p className="text-sm text-slate-400 mb-5">Pick your name to pay your share of "{split?.title}".</p>
          <div className="space-y-2.5">
            {others.map((p) => (
              <button
                key={p.id}
                disabled={p.status === 'PAID'}
                onClick={() => { setParticipant(p); setStage('select'); }}
                className="w-full flex items-center justify-between rounded-2xl border border-white/10 bg-[#0C181A] px-4 py-3.5 text-left hover:border-[#00E599]/40 hover:bg-[#00E599]/5 transition-all disabled:opacity-50"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-[#00E599]/15 text-[#00E599] border border-[#00E599]/30 font-extrabold flex items-center justify-center text-xs">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-bold text-white text-sm">
                    {p.name} {p.is_organizer && <span className="text-xs text-[#00E599] font-normal">(Organizer)</span>}
                  </span>
                </div>
                <span className="text-sm font-bold text-slate-300">
                  {p.status === 'PAID' ? <span className="text-[#00E599]">Paid ✓</span> : formatMoney(Math.max(0, Number(p.allocation_amount || 0) - Number(p.amount_paid || 0)))}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  if (stage === 'loading') {
    return <Shell><div className="mx-auto max-w-md px-4 py-16 text-center"><div className="h-20 w-20 rounded-2xl shimmer mx-auto bg-white/5" /></div></Shell>;
  }

  if (stage === 'not_found') {
    return <Shell><div className="mx-auto max-w-md px-4 py-16 text-center"><XCircle className="mx-auto mb-4 h-12 w-12 text-slate-600" /><h1 className="text-xl font-extrabold text-white">Split not found</h1><p className="mt-2 text-sm text-slate-400">This payment link is invalid or has expired.</p></div></Shell>;
  }

  if (stage === 'already_paid' && split && participant) {
    return <Shell><div className="mx-auto max-w-md px-4 py-8 animate-fade-in">
      <div className="mb-6 text-center"><CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-[#00E599]" /><h1 className="text-xl font-extrabold text-white">You already paid</h1><p className="mt-1 text-sm text-slate-400">Your share for this bill has been settled.</p></div>
      {txRef && <Receipt split={split} participant={participant} merchant={merchant} txRef={participant.payment_ref || txRef} providerLabel={paymentProviders[provider].label} amount={participant.amount_paid} />}
    </div></Shell>;
  }

  if (stage === 'success' && split && participant) {
    return <Shell><div className="mx-auto max-w-md px-4 py-8 animate-slide-up">
      <div className="mb-6 text-center"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00E599] to-[#00C880] shadow-xl shadow-[#00E599]/20 animate-scale-in"><CheckCircle2 className="h-10 w-10 text-[#060D0E]" strokeWidth={2.5} /></div><h1 className="text-2xl font-extrabold text-white">Payment Confirmed</h1><p className="mt-2 text-sm text-slate-400">Your contribution has been recorded and the organizer notified.</p></div>
      <Receipt split={split} participant={participant} merchant={merchant} txRef={txRef} providerLabel={paymentProviders[provider].label} amount={lastPaidAmount || participant.amount_paid || participant.allocation_amount} />
      {participant.allocation_amount - participant.amount_paid > 0 && <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">Remaining balance: {formatMoney(participant.allocation_amount - participant.amount_paid)}. You can pay the rest later.</div>}
      <div className="mb-4 rounded-2xl border border-[#00E599]/20 bg-[#0C181A] p-4 text-center"><p className="text-sm font-bold text-white">Create your LUMO account</p><p className="mt-1 text-xs text-slate-400">Track all your splits, get reminders, and pay faster next time.</p><button className="mt-3 rounded-xl bg-gradient-to-r from-[#00E599] to-[#00C880] px-4 py-2.5 text-xs font-black text-[#060D0E]">Sign up free</button></div>
    </div></Shell>;
  }

  if (stage === 'processing') {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return <Shell><div className="mx-auto max-w-md px-4 py-12 text-center animate-fade-in">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#00E599]/15 border border-[#00E599]/30"><Loader2 className="h-10 w-10 text-[#00E599] animate-spin" /></div>
      <h1 className="text-xl font-bold text-white">Waiting for approval on your phone</h1>
      <p className="mt-2 text-sm text-slate-400">Dial your {paymentProviders[provider].label} PIN to confirm {formatMoney(payAmountNum)}.</p>
      <div className="mx-auto mt-6 flex items-center justify-center gap-2 rounded-2xl bg-[#0C181A] border border-[#00E599]/30 px-6 py-3 text-[#00E599] shadow-lg"><Timer className="h-5 w-5" /><span className="text-2xl font-extrabold tabular-nums">{minutes}:{seconds.toString().padStart(2, '0')}</span></div>
      <div className="mx-auto mt-6 max-w-xs space-y-2">
        <StepRow label="Payment request sent" done />
        <StepRow label="Awaiting PIN confirmation" active />
        <StepRow label="Webhook verification" />
        <StepRow label="Recording payment" />
      </div>
      <button onClick={handleCancel} className="mt-8 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-slate-300 hover:bg-white/10 transition-colors">Cancel payment</button>
    </div></Shell>;
  }

  if (stage === 'confirming') {
    return <Shell><div className="mx-auto max-w-md px-4 py-12 text-center animate-fade-in">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30">
        <Clock className="h-10 w-10 text-amber-400 animate-pulse" />
      </div>
      <h1 className="text-xl font-bold text-white">Confirming payment with operator</h1>
      <p className="mt-2 text-sm text-slate-400">We sent the payment prompt to your phone. If you entered your PIN, please do not pay again — we are verifying with your provider.</p>

      {txRef && <div className="mt-4 rounded-xl border border-white/10 bg-[#0C181A] p-3 text-xs text-slate-300 font-mono">Ref: {txRef}</div>}

      <div className="mt-6 space-y-3">
        <button
          onClick={() => void checkPaymentStatusNow()}
          disabled={isCheckingStatus}
          className="w-full rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C880] py-3.5 text-sm font-black text-[#060D0E] shadow-lg shadow-[#00E599]/20 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isCheckingStatus && <Loader2 className="h-4 w-4 animate-spin text-[#060D0E]" />}
          {isCheckingStatus ? 'Checking operator status...' : 'Check Payment Status Now'}
        </button>

        <button onClick={handleClaim} className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-slate-300 hover:bg-white/10 transition-colors">
          I already paid — tell the organizer
        </button>

        <button onClick={handleRetry} className="text-xs text-slate-400 hover:text-white underline transition-colors">
          Try paying again
        </button>
      </div>
    </div></Shell>;
  }

  if (stage === 'failed') {
    return <Shell><div className="mx-auto max-w-md px-4 py-8 animate-fade-in">
      <div className="mb-6 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/30"><AlertCircle className="h-8 w-8 text-rose-400" /></div><h1 className="text-xl font-extrabold text-white">Payment failed</h1><p className="mt-2 text-sm text-slate-400">{paymentResult?.failureMessage || 'The payment could not be completed. Please try again.'}</p></div>
      {paymentResult?.failureCode === 'INSUFFICIENT_FUNDS' && <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">Wrong amount? Check that you have enough balance and the amount matches your share.</div>}
      <button onClick={handleRetry} className="w-full rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C880] py-3.5 text-sm font-black text-[#060D0E] shadow-lg shadow-[#00E599]/20">Retry payment</button>
      <button onClick={handleClaim} className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-slate-300 hover:bg-white/10 transition-colors">I already paid — tell the organizer</button>
    </div></Shell>;
  }

  if (stage === 'timeout') {
    return <Shell><div className="mx-auto max-w-md px-4 py-8 animate-fade-in">
      <div className="mb-6 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30"><Clock className="h-8 w-8 text-amber-400" /></div><h1 className="text-xl font-extrabold text-white">Payment timed out</h1><p className="mt-2 text-sm text-slate-400">We did not receive confirmation from your phone in time.</p></div>
      <button onClick={handleRetry} className="w-full rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C880] py-3.5 text-sm font-black text-[#060D0E] shadow-lg shadow-[#00E599]/20">Retry payment</button>
      <button onClick={handleClaim} className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-slate-300 hover:bg-white/10 transition-colors">I already paid — tell the organizer</button>
    </div></Shell>;
  }

  if (stage === 'claim_submitted') {
    return <Shell><div className="mx-auto max-w-md px-4 py-8 animate-fade-in">
      <div className="mb-6 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00E599]/15 border border-[#00E599]/30"><CheckCircle2 className="h-8 w-8 text-[#00E599]" /></div><h1 className="text-xl font-extrabold text-white">Claim sent to organizer</h1><p className="mt-2 text-sm text-slate-400">{claimSent ? `${split?.organizer_name || 'The organizer'} will review your claim and confirm the payment.` : 'The organizer has been notified.'}</p></div>
    </div></Shell>;
  }

  if (stage === 'select' && split && participant) {
    return <Shell><div className="mx-auto max-w-md px-4 py-6 animate-fade-in">
      <div className="mb-4 flex items-center justify-between"><Logo size="sm" showText={false} /><StatusBadge status={split.status} /></div>

      <div className="rounded-3xl border border-[#00E599]/20 bg-[#0C181A] p-5 shadow-xl shadow-black/40 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#00E599]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="mb-4 flex items-center gap-3 relative z-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 border border-white/10">
            <CategoryIcon category={split.category} className="h-5 w-5 text-[#00E599]" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">{split.title}</h2>
            <p className="text-xs text-slate-400">Ref: <span className="text-[#00E599] font-mono">{split.ref_code}</span></p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-[#060D0E] border border-white/5 p-3.5 relative z-10">
          <Building2 className="h-5 w-5 text-slate-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{merchant?.display_name || 'Verified destination'}</p>
            {merchant && <p className="flex items-center gap-1 text-[10px] font-medium text-[#00E599]"><ShieldCheck className="h-3 w-3" /> Verified · {merchant.destination_id}</p>}
          </div>
        </div>

        <p className="mb-3 text-xs text-slate-400 relative z-10">{split.organizer_name} invited you to this bill.</p>
        <div className="grid grid-cols-2 gap-3 relative z-10">
          <div className="rounded-2xl bg-[#060D0E] border border-white/5 p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total bill</p>
            <p className="mt-1 text-sm font-black text-white">{formatMoney(split.total_amount)}</p>
          </div>
          <div className="rounded-2xl bg-[#00E599]/10 border border-[#00E599]/30 p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#00E599]">Your share</p>
            <p className="mt-1 text-lg font-black text-[#00E599]">{formatMoney(remaining)}</p>
          </div>
        </div>
        {participant.amount_paid > 0 && <p className="mt-3 text-center text-xs text-[#00E599] font-medium relative z-10">You have already paid {formatMoney(participant.amount_paid)}.</p>}
      </div>

      <div className="mt-4"><TrustStrip merchantName={merchant?.display_name} destinationId={merchant?.destination_id} /></div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-[#0C181A] p-5 shadow-xl shadow-black/40">
        <h3 className="mb-3 text-sm font-bold text-white">Choose provider</h3>
        <div className="space-y-2">
          {Object.values(paymentProviders).filter((p) => p.id === 'snippe').map((p) => {
            const Icon = providerIcon(p.id);
            return (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${provider === p.id ? 'border-[#00E599] bg-[#00E599]/10' : 'border-white/10 hover:border-white/20 bg-[#060D0E]'}`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${provider === p.id ? 'bg-[#00E599] text-[#060D0E]' : 'bg-white/5 text-slate-400'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{p.label}</p>
                  <p className="text-xs text-slate-400">{p.desc}</p>
                </div>
                <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${provider === p.id ? 'border-[#00E599] bg-[#00E599]' : 'border-white/20'}`}>
                  {provider === p.id && <Check className="h-3 w-3 text-[#060D0E]" strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-[#0C181A] p-5 shadow-xl shadow-black/40">
        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Phone number for payment</label>
        <div className="flex overflow-hidden rounded-2xl border border-white/15 bg-[#060D0E] focus-within:border-[#00E599] transition-colors">
          <span className="flex items-center border-r border-white/15 bg-white/5 px-3.5 text-sm font-bold text-slate-400">+255</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="712 345 678"
            className="min-w-0 flex-1 px-3 py-3 text-sm text-white bg-transparent outline-none placeholder:text-slate-600 font-medium"
          />
        </div>

        <label className="mt-4 block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Amount to pay (TZS)</label>
        <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-[#060D0E] px-4 py-3.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fixed Share Amount</span>
          <span className="text-base font-black text-[#00E599]">{formatMoney(remaining)}</span>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">The payment amount is automatically locked to your share of this split.</p>
      </div>

      {error && <p className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</p>}

      <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#0C181A] border border-white/5 p-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#00E599]" />
        <p className="text-xs text-slate-400">Payment is processed securely by licensed payment partner Snippe. LUMO never holds your funds.</p>
      </div>

      <button
        onClick={handlePay}
        disabled={remaining <= 0 || phone.length < 6}
        className="mt-4 w-full rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C880] hover:brightness-105 active:scale-[0.98] py-4 text-sm font-black text-[#060D0E] shadow-xl shadow-[#00E599]/20 transition-all disabled:cursor-not-allowed disabled:opacity-40"
      >
        Pay {formatMoney(remaining)}
      </button>

      <button onClick={handleClaim} className="mt-3 w-full text-center text-xs font-semibold text-slate-400 hover:text-white transition-colors">
        I already paid — tell the organizer
      </button>
    </div></Shell>;
  }

  if (stage === 'select' && split && !participant) {
    return <Shell><div className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="text-lg font-extrabold text-white">Nothing to pay yet</h1><p className="mt-2 text-sm text-slate-400">{split.organizer_name || 'The organizer'} has not added anyone to pay on this split. Ask them to add participants and share the link again.</p></div></Shell>;
  }

  return <Shell><div className="mx-auto max-w-md px-4 py-16 text-center"><p className="text-sm text-slate-400">Loading...</p></div></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#060D0E] text-slate-100">{children}</div>;
}

function Receipt({ split, participant, merchant, txRef, providerLabel, amount }: { split: Split; participant: Participant; merchant: Merchant | null; txRef: string; providerLabel: string; amount: number }) {
  const [copied, setCopied] = useState(false);
  return <div className="rounded-3xl border border-white/10 bg-[#0C181A] p-6 shadow-xl shadow-black/40">
    <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4"><span className="text-sm text-slate-400">Amount Paid</span><span className="text-xl font-extrabold text-[#00E599]">{formatMoney(amount)}</span></div>
    <Row label="Transaction ID" value={txRef} />
    <Row label="Date" value={formatDateTime(new Date().toISOString())} />
    <Row label="Paid directly to" value={merchant?.display_name || 'Verified destination'} highlight />
    <Row label="Method" value={providerLabel} />
    <Row label="Bill" value={split.title} />
    <Row label="Status" value="Confirmed" />
    <div className="mt-4"><TrustStrip merchantName={merchant?.display_name} destinationId={merchant?.destination_id} /></div>
    <div className="mt-4 flex gap-2">
      <button onClick={() => downloadColoredReceipt({ title: split.title, refCode: split.ref_code, txRef, amount, participantName: participant.name, merchantName: merchant?.display_name || undefined, providerLabel })} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00E599] to-[#00C880] py-3 text-xs font-black text-[#060D0E] shadow-md shadow-[#00E599]/20 hover:brightness-105 transition-all"><Download className="h-4 w-4" /> Download Receipt</button>
      <button onClick={() => { void navigator.clipboard?.writeText(txRef); setCopied(true); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-slate-300 hover:bg-white/10 transition-all">{copied ? <Check className="h-4 w-4 text-[#00E599]" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy Ref'}</button>
    </div>
  </div>;
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className="flex items-center justify-between py-2 text-sm"><span className="text-slate-400">{label}</span><span className={`font-semibold ${highlight ? 'text-[#00E599]' : 'text-white'}`}>{value}</span></div>;
}

function StepRow({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-[#0C181A] p-3"><div className={`flex h-6 w-6 items-center justify-center rounded-full ${done ? 'bg-[#00E599]/20 text-[#00E599]' : active ? 'bg-[#00E599]/20 text-[#00E599]' : 'bg-white/5 text-slate-600'}`}>{done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <div className="h-2 w-2 rounded-full bg-current" />}</div><span className={`text-sm ${done || active ? 'font-bold text-white' : 'text-slate-500'}`}>{label}</span></div>;
}

function providerIcon(id: PaymentProviderId): typeof Smartphone {
  switch (id) {
    case 'bank': return Landmark;
    case 'card': return CreditCard;
    default: return Smartphone;
  }
}
