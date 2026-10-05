import { useState, useEffect } from 'react';
import {
  ArrowLeft, Users, CheckCircle2, Clock, AlertCircle, Share2,
  Bell, Download, RefreshCw, Building2, Calendar, StickyNote, Receipt,
  Smartphone, Landmark, Wallet, Check, Loader2,
} from 'lucide-react';
import { supabase, type Split, type Participant, type Merchant, type PaymentAttempt } from '@/lib/supabase';
import { formatMoney, formatDateTime, timeAgo } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';
import { CategoryIcon } from '@/components/CategoryIcon';
import Modal from '@/components/Modal';
import TrustStrip from '@/components/TrustStrip';

type SplitDetailViewProps = {
  split: Split;
  onBack: () => void;
  onPay: (participant: Participant, split: Split) => void;
};

export default function SplitDetailView({ split: initialSplit, onBack, onPay }: SplitDetailViewProps) {
  const [split, setSplit] = useState<Split>(initialSplit);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [payments, setPayments] = useState<PaymentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [reminding, setReminding] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [split.id]);

  async function loadData() {
    setLoading(true);
    const { data: p } = await supabase
      .from('split_participants')
      .select('*')
      .eq('split_id', split.id)
      .order('is_organizer', { ascending: false })
      .order('created_at', { ascending: true });

    if (p) setParticipants(p as Participant[]);

    if (split.merchant_id) {
      const { data: m } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', split.merchant_id)
        .maybeSingle();
      if (m) setMerchant(m as Merchant);
    }

    const participantIds = (p || []).map((pp) => pp.id);
    if (participantIds.length > 0) {
      const { data: pays } = await supabase
        .from('payment_attempts')
        .select('*')
        .in('split_participant_id', participantIds)
        .order('requested_at', { ascending: false });
      if (pays) setPayments(pays as PaymentAttempt[]);
    }

    setLoading(false);
  }

  async function handleRemind(participant: Participant) {
    setReminding(participant.id);
    await supabase.from('audit_logs').insert({
      actor: split.organizer_name,
      action: 'REMINDER_SENT',
      entity_type: 'participant',
      entity_id: participant.id,
      metadata: { split_ref: split.ref_code, participant: participant.name },
    });
    setTimeout(() => setReminding(null), 1500);
  }

  async function handleMarkPaid(participant: Participant) {
    const txRef = `MP${Date.now().toString().slice(-7)}`;
    const now = new Date().toISOString();

    // Create payment attempt
    await supabase.from('payment_attempts').insert({
      split_participant_id: participant.id,
      amount: participant.allocation_amount,
      provider: 'M-PESA',
      provider_tx_ref: txRef,
      status: 'SUCCESS',
      payment_method: 'mobile_money',
      completed_at: now,
    });

    // Update participant
    await supabase
      .from('split_participants')
      .update({
        status: 'PAID',
        amount_paid: participant.allocation_amount,
        paid_at: now,
        payment_ref: txRef,
      })
      .eq('id', participant.id);

    // Recalculate split
    const updatedParticipants = participants.map((p) =>
      p.id === participant.id
        ? { ...p, status: 'PAID', amount_paid: p.allocation_amount, paid_at: now, payment_ref: txRef }
        : p
    );
    setParticipants(updatedParticipants);

    const totalPaid = updatedParticipants.reduce((s, p) => s + p.amount_paid, 0);
    const percent = Math.round((totalPaid / split.total_amount) * 100);
    const newStatus = percent === 100 ? 'SETTLED' : 'PARTIALLY_PAID';

    await supabase
      .from('splits')
      .update({ amount_paid: totalPaid, settlement_percent: percent, status: newStatus })
      .eq('id', split.id);

    setSplit({ ...split, amount_paid: totalPaid, settlement_percent: percent, status: newStatus });

    // Audit log
    await supabase.from('audit_logs').insert({
      actor: participant.name,
      action: 'PAYMENT_CONFIRMED',
      entity_type: 'participant',
      entity_id: participant.id,
      metadata: { amount: participant.allocation_amount, tx_ref: txRef, split_ref: split.ref_code },
    });

    loadData();
  }

  const remaining = split.total_amount - split.amount_paid;
  const paidParticipants = participants.filter((p) => p.status === 'PAID');
  const pendingParticipants = participants.filter((p) => p.status === 'PENDING' || p.status === 'INVITED');

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-64 rounded-2xl shimmer" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 mb-5">
        <ArrowLeft className="h-4 w-4" /> All Splits
      </button>

      {/* Split header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-5">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center">
              <CategoryIcon category={split.category} className="h-7 w-7 text-slate-600" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">{split.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-400">Ref: {split.ref_code}</span>
                <StatusBadge status={split.status} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowShare(true)}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Settlement progress */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-slate-700">Settlement Progress</span>
            <span className={`text-2xl font-extrabold ${split.settlement_percent === 100 ? 'text-success-600' : 'text-slate-900'}`}>
              {split.settlement_percent}%
            </span>
          </div>
          <ProgressBar percent={split.settlement_percent} size="lg" />
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-slate-500">
              <span className="font-bold text-slate-900">{formatMoney(split.amount_paid)}</span> collected
            </span>
            {remaining > 0 && (
              <span className="text-amber-600 font-medium">{formatMoney(remaining)} remaining</span>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InfoItem icon={Building2} label="Destination" value={merchant?.display_name || 'Manual'} />
          <InfoItem icon={Users} label="Participants" value={`${split.participant_count} people`} />
          <InfoItem icon={Calendar} label="Due Date" value={formatDateTime(split.due_at)} />
          <InfoItem icon={Receipt} label="Total Bill" value={formatMoney(split.total_amount)} />
        </div>

        {split.note && (
          <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-amber-50/50 border border-amber-100">
            <StickyNote className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">{split.note}</p>
          </div>
        )}
      </div>

      <div className="mb-5"><TrustStrip merchantName={merchant?.display_name} destinationId={merchant?.destination_id} /></div>

      {/* Participants */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900">Participants & Payments</h2>
          <span className="text-xs text-slate-400">
            {paidParticipants.length}/{participants.length} paid
          </span>
        </div>

        <div className="space-y-3">
          {participants.map((p) => (
            <ParticipantRow
              key={p.id}
              participant={p}
              split={split}
              onPay={() => onPay(p, split)}
              onMarkPaid={() => handleMarkPaid(p)}
              onRemind={() => handleRemind(p)}
              reminding={reminding === p.id}
            />
          ))}
        </div>
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-5">
          <h2 className="font-bold text-slate-900 mb-4">Payment History</h2>
          <div className="space-y-2">
            {payments.map((pay) => {
              const participant = participants.find((p) => p.id === pay.split_participant_id);
              return (
                <div key={pay.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 text-sm">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${pay.status === 'SUCCESS' ? 'bg-success-100 text-success-600' : 'bg-amber-100 text-amber-600'}`}>
                      {pay.status === 'SUCCESS' ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{participant?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{pay.provider_tx_ref} · {pay.provider}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{formatMoney(pay.amount)}</p>
                    <p className="text-xs text-slate-400">{timeAgo(pay.requested_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Share modal */}
      <Modal open={showShare} onClose={() => setShowShare(false)} title="Share Split" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Share this link with participants. They can pay without creating a LUMO account.
          </p>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <p className="font-mono text-sm text-slate-700 break-all">
              lumo-split.app/pay/{split.ref_code}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <Smartphone className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold text-blue-900">SMS Preview</span>
            </div>
            <p className="text-xs text-blue-800">
              LUMO Split: You have a {formatMoney(participants[0]?.allocation_amount || 0)} share for "{split.title}". Pay securely here: [LINK]. Destination: {merchant?.display_name || 'Manual'}. Ref: {split.ref_code}.
            </p>
          </div>
          <button
            onClick={() => setShowShare(false)}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg text-sm font-semibold"
          >
            Done
          </button>
        </div>
      </Modal>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-slate-50">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-bold text-slate-900 truncate">{value}</p>
    </div>
  );
}

function ParticipantRow({
  participant, split, onPay, onMarkPaid, onRemind, reminding,
}: {
  participant: Participant;
  split: Split;
  onPay: () => void;
  onMarkPaid: () => void;
  onRemind: () => void;
  reminding: boolean;
}) {
  const isPaid = participant.status === 'PAID';
  const initials = participant.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
      isPaid ? 'border-success-100 bg-success-50/30' : 'border-slate-100 hover:border-slate-200'
    }`}>
      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
        isPaid ? 'bg-success-100 text-success-700' : 'bg-slate-100 text-slate-600'
      }`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-900 text-sm truncate">{participant.name}</p>
          {participant.is_organizer && (
            <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">ORGANIZER</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-400">{participant.phone || 'No phone'}</span>
          <StatusBadge status={participant.status} type="participant" />
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-bold text-slate-900 text-sm">{formatMoney(participant.allocation_amount)}</p>
        {isPaid && participant.paid_at && (
          <p className="text-[10px] text-success-600 font-medium">{timeAgo(participant.paid_at)}</p>
        )}
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        {!isPaid && (
          <>
            <button
              onClick={onRemind}
              disabled={reminding}
              className="p-2 rounded-lg border border-slate-200 hover:bg-amber-50 hover:border-amber-200 text-slate-400 hover:text-amber-600 transition-all"
              title="Send reminder"
            >
              {reminding ? <Check className="h-4 w-4 text-success-500" /> : <Bell className="h-4 w-4" />}
            </button>
            <button
              onClick={onPay}
              className="px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-all whitespace-nowrap"
            >
              Pay
            </button>
          </>
        )}
        {isPaid && (
          <div className="flex items-center gap-1 text-success-600 px-2">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}
