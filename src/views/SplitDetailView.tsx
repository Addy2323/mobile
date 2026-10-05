import { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, ArrowLeft, Ban, Bell, Building2, Calendar, Check, CheckCircle2,
  Clock, Copy, Download, Heart, Loader2, MoreHorizontal, PartyPopper, Pencil,
  Plus, Receipt, RefreshCw, Send, Share2, ShieldAlert, StickyNote, Trash2,
  TrendingUp, Users, X,
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

type ActionModal =
  | null
  | { kind: 'edit'; participant: Participant }
  | { kind: 'add' }
  | { kind: 'cancel' }
  | { kind: 'report' }
  | { kind: 'receipt' }
  | { kind: 'thankyou' };

export default function SplitDetailView({ split: initialSplit, onBack, onPay }: SplitDetailViewProps) {
  const [split, setSplit] = useState<Split>(initialSplit);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [payments, setPayments] = useState<PaymentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [reminding, setReminding] = useState<string | null>(null);
  const [remindingAll, setRemindingAll] = useState(false);
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    void loadData();
    setupRealtime();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, []);

  function setupRealtime() {
    channelRef.current = supabase
      .channel(`split-detail-${split.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_participants', filter: `split_id=eq.${split.id}` }, () => { void loadData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_attempts', filter: `split_participant_id=in.(${participants.map((p) => p.id).join(',')})` }, () => { void loadData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'splits', filter: `id=eq.${split.id}` }, (payload) => { if (payload.new) setSplit(payload.new as Split); })
      .subscribe();
  }

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
      const { data: m } = await supabase.from('merchants').select('*').eq('id', split.merchant_id).maybeSingle();
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

  function showToast(message: string) { setToast(message); setTimeout(() => setToast(''), 3000); }

  async function handleRemind(participant: Participant) {
    setReminding(participant.id);
    await supabase.from('audit_logs').insert({
      actor: split.organizer_name, action: 'REMINDER_SENT', entity_type: 'participant', entity_id: participant.id,
      metadata: { split_ref: split.ref_code, participant: participant.name, amount: participant.allocation_amount },
    });
    setTimeout(() => { setReminding(null); showToast(`Reminder sent to ${participant.name}`); }, 1200);
  }

  async function handleRemindAll() {
    setRemindingAll(true);
    const pending = participants.filter((p) => p.status !== 'PAID' && !p.is_organizer);
    for (const p of pending) {
      await supabase.from('audit_logs').insert({
        actor: split.organizer_name, action: 'REMINDER_SENT', entity_type: 'participant', entity_id: p.id,
        metadata: { split_ref: split.ref_code, participant: p.name, amount: p.allocation_amount },
      });
    }
    setTimeout(() => { setRemindingAll(false); showToast(`Reminders sent to ${pending.length} people`); }, 1200);
  }

  async function handleMarkCash(participant: Participant) {
    const txRef = `CASH${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();
    await supabase.from('payment_attempts').insert({
      split_participant_id: participant.id, amount: participant.allocation_amount, provider: 'Cash',
      provider_tx_ref: txRef, status: 'SUCCESS', payment_method: 'cash', completed_at: now,
    });
    await supabase.from('split_participants').update({
      status: 'PAID', amount_paid: participant.allocation_amount, paid_at: now, payment_ref: txRef,
    }).eq('id', participant.id);
    await recalculateSplit();
    await supabase.from('audit_logs').insert({
      actor: split.organizer_name, action: 'MARKED_PAID_CASH', entity_type: 'participant', entity_id: participant.id,
      metadata: { amount: participant.allocation_amount, tx_ref: txRef, split_ref: split.ref_code },
    });
    setMenuOpenFor(null);
    showToast(`${participant.name} marked as paid in cash`);
    void loadData();
  }

  async function recalculateSplit() {
    const { data: allP } = await supabase.from('split_participants').select('amount_paid, allocation_amount, status').eq('split_id', split.id);
    const totalPaid = (allP || []).reduce((s: number, p: { amount_paid: number }) => s + (p.amount_paid || 0), 0);
    const percent = Math.round((totalPaid / split.total_amount) * 100);
    const newStatus = percent === 100 ? 'SETTLED' : 'PARTIALLY_PAID';
    await supabase.from('splits').update({ amount_paid: totalPaid, settlement_percent: percent, status: newStatus }).eq('id', split.id);
    setSplit((prev) => ({ ...prev, amount_paid: totalPaid, settlement_percent: percent, status: newStatus }));
  }

  async function handleEditAmount(participant: Participant, newAmount: number) {
    await supabase.from('split_participants').update({ allocation_amount: newAmount }).eq('id', participant.id);
    await supabase.from('audit_logs').insert({
      actor: split.organizer_name, action: 'AMOUNT_EDITED', entity_type: 'participant', entity_id: participant.id,
      metadata: { old: participant.allocation_amount, new: newAmount, split_ref: split.ref_code },
    });
    setActionModal(null);
    showToast(`${participant.name}'s share updated`);
    void loadData();
  }

  async function handleAddPerson(name: string, phone: string, amount: number) {
    await supabase.from('split_participants').insert({
      split_id: split.id, name, phone: phone || null, allocation_amount: amount, amount_paid: 0, status: 'PENDING', is_organizer: false,
    });
    const newCount = split.participant_count + 1;
    await supabase.from('splits').update({ participant_count: newCount }).eq('id', split.id);
    await supabase.from('audit_logs').insert({
      actor: split.organizer_name, action: 'PERSON_ADDED', entity_type: 'split', entity_id: split.id,
      metadata: { name, phone, amount, split_ref: split.ref_code },
    });
    setActionModal(null);
    showToast(`${name} added`);
    void loadData();
  }

  async function handleRemovePerson(participant: Participant) {
    await supabase.from('split_participants').delete().eq('id', participant.id);
    const newCount = Math.max(0, split.participant_count - 1);
    await supabase.from('splits').update({ participant_count: newCount }).eq('id', split.id);
    await supabase.from('audit_logs').insert({
      actor: split.organizer_name, action: 'PERSON_REMOVED', entity_type: 'split', entity_id: split.id,
      metadata: { name: participant.name, split_ref: split.ref_code },
    });
    setMenuOpenFor(null);
    setActionModal(null);
    showToast(`${participant.name} removed`);
    void loadData();
  }

  async function handleCancelSplit() {
    await supabase.from('splits').update({ status: 'CANCELLED' }).eq('id', split.id);
    await supabase.from('audit_logs').insert({
      actor: split.organizer_name, action: 'SPLIT_CANCELLED', entity_type: 'split', entity_id: split.id,
      metadata: { split_ref: split.ref_code, refund_note: 'Refunds depend on provider. Participants should contact their payment provider.' },
    });
    setActionModal(null);
    showToast('Split cancelled');
    void loadData();
  }

  function handleReportProblem(description: string) {
    void supabase.from('audit_logs').insert({
      actor: split.organizer_name, action: 'PROBLEM_REPORTED', entity_type: 'split', entity_id: split.id,
      metadata: { description, split_ref: split.ref_code },
    });
    setActionModal(null);
    showToast('Problem reported. Support will contact you.');
  }

  function handleDownloadReceipt() {
    const lines = [
      `LUMO Split Receipt`,
      `-------------------`,
      `Bill: ${split.title}`,
      `Ref: ${split.ref_code}`,
      `Destination: ${merchant?.display_name || 'Manual'}`,
      `Total: ${formatMoney(split.total_amount)}`,
      `Collected: ${formatMoney(split.amount_paid)}`,
      `Status: ${split.status}`,
      `Date: ${formatDateTime(new Date().toISOString())}`,
      ``,
      `Participants:`,
      ...participants.map((p) => `  ${p.name} — ${formatMoney(p.allocation_amount)} — ${p.status}${p.payment_ref ? ` (Ref: ${p.payment_ref})` : ''}`),
      ``,
      `Payments:`,
      ...payments.map((pay) => `  ${pay.provider_tx_ref || 'N/A'} — ${formatMoney(pay.amount)} — ${pay.status}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `lumo-receipt-${split.ref_code}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  function handleSendThankYou(message: string) {
    void supabase.from('audit_logs').insert({
      actor: split.organizer_name, action: 'THANKYOU_SENT', entity_type: 'split', entity_id: split.id,
      metadata: { message, split_ref: split.ref_code },
    });
    setActionModal(null);
    showToast('Thank-you sent to all participants');
  }

  const remaining = split.total_amount - split.amount_paid;
  const paidParticipants = participants.filter((p) => p.status === 'PAID');
  const pendingParticipants = participants.filter((p) => p.status !== 'PAID' && !p.is_organizer);
  const isSettled = split.status === 'SETTLED' || split.settlement_percent === 100;
  const isCancelled = split.status === 'CANCELLED';

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-8"><div className="h-64 rounded-2xl shimmer" /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-fade-in">
      <button onClick={onBack} className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> All Splits
      </button>

      {/* Split header */}
      <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-6">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50">
              <CategoryIcon category={split.category} className="h-7 w-7 text-slate-600" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">{split.title}</h1>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-xs text-slate-400">Ref: {split.ref_code}</span>
                <StatusBadge status={split.status} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!isCancelled && <button onClick={() => setShowShare(true)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><Share2 className="h-4 w-4" /></button>}
            {isSettled && <button onClick={() => setActionModal({ kind: 'receipt' })} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><Download className="h-4 w-4" /></button>}
          </div>
        </div>

        {/* Settled banner */}
        {isSettled && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-success-200 bg-gradient-to-r from-success-50 to-success-50/50 p-4">
            <PartyPopper className="h-6 w-6 text-success-600" />
            <div className="flex-1">
              <p className="text-sm font-extrabold text-success-800">Bill fully settled</p>
              <p className="text-xs text-success-700">All {participants.length} participants have paid. {formatMoney(split.total_amount)} collected.</p>
            </div>
            <button onClick={() => setActionModal({ kind: 'thankyou' })} className="flex items-center gap-1.5 rounded-lg bg-success-600 px-3 py-2 text-xs font-bold text-white hover:bg-success-700"><Heart className="h-3.5 w-3.5" /> Send thank-you</button>
          </div>
        )}

        {/* Cancelled banner */}
        {isCancelled && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-error-200 bg-error-50 p-4">
            <Ban className="h-6 w-6 text-error-600" />
            <div><p className="text-sm font-extrabold text-error-800">Split cancelled</p><p className="text-xs text-error-700">Refunds depend on the payment provider. Participants should contact their provider directly.</p></div>
          </div>
        )}

        {/* Segmented progress */}
        <div className="mb-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">Collected vs remaining</span>
            <span className={`text-2xl font-extrabold ${isSettled ? 'text-success-600' : 'text-slate-900'}`}>{split.settlement_percent}%</span>
          </div>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-gradient-to-r from-success-400 to-success-600 transition-all duration-700" style={{ width: `${Math.min(split.settlement_percent, 100)}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-500"><span className="font-bold text-success-600">{formatMoney(split.amount_paid)}</span> collected · {paidParticipants.length} paid</span>
            {remaining > 0 && <span className="font-medium text-amber-600">{formatMoney(remaining)} remaining · {pendingParticipants.length} pending</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoItem icon={Building2} label="Destination" value={merchant?.display_name || 'Manual'} />
          <InfoItem icon={Users} label="Participants" value={`${split.participant_count} people`} />
          <InfoItem icon={Calendar} label="Due Date" value={formatDateTime(split.due_at)} />
          <InfoItem icon={Receipt} label="Total Bill" value={formatMoney(split.total_amount)} />
        </div>

        {split.note && <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/50 p-3"><StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><p className="text-sm text-amber-800">{split.note}</p></div>}
      </div>

      <div className="mb-5"><TrustStrip merchantName={merchant?.display_name} destinationId={merchant?.destination_id} /></div>

      {/* Participants */}
      {!isCancelled && (
        <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Participants & Payments</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">{paidParticipants.length}/{participants.length} paid</span>
              {pendingParticipants.length > 0 && (
                <button onClick={handleRemindAll} disabled={remindingAll} className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                  {remindingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />} Remind all
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {participants.map((p) => (
              <ParticipantRow
                key={p.id}
                participant={p}
                isSettled={isSettled}
                onPay={() => onPay(p, split)}
                onRemind={() => handleRemind(p)}
                onMarkCash={() => handleMarkCash(p)}
                onEdit={() => setActionModal({ kind: 'edit', participant: p })}
                onRemove={() => handleRemovePerson(p)}
                reminding={reminding === p.id}
                menuOpen={menuOpenFor === p.id}
                onToggleMenu={() => setMenuOpenFor(menuOpenFor === p.id ? null : p.id)}
              />
            ))}
          </div>

          {!isSettled && (
            <button onClick={() => setActionModal({ kind: 'add' })} className="mt-4 flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700">
              <Plus className="h-4 w-4" /> Add person
            </button>
          )}
        </div>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-6">
          <h2 className="mb-4 font-bold text-slate-900">Payment History</h2>
          <div className="space-y-2">
            {payments.map((pay) => {
              const p = participants.find((pp) => pp.id === pay.split_participant_id);
              const isCash = pay.provider === 'Cash';
              return (
                <div key={pay.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${pay.status === 'SUCCESS' ? isCash ? 'bg-blue-100 text-blue-600' : 'bg-success-100 text-success-600' : 'bg-amber-100 text-amber-600'}`}>
                      {pay.status === 'SUCCESS' ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div><p className="font-medium text-slate-900">{p?.name || 'Unknown'}</p><p className="text-xs text-slate-400">{pay.provider_tx_ref} · {pay.provider}</p></div>
                  </div>
                  <div className="text-right"><p className="font-bold text-slate-900">{formatMoney(pay.amount)}</p><p className="text-xs text-slate-400">{timeAgo(pay.requested_at)}</p></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Danger zone */}
      {!isCancelled && (
        <div className="mb-5 flex flex-wrap gap-3 rounded-2xl border border-slate-100 bg-white p-4">
          <button onClick={() => setActionModal({ kind: 'report' })} className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"><ShieldAlert className="h-4 w-4" /> Report a problem</button>
          <button onClick={() => setActionModal({ kind: 'cancel' })} className="flex items-center gap-2 rounded-lg border border-error-200 px-4 py-2.5 text-xs font-bold text-error-600 hover:bg-error-50"><Ban className="h-4 w-4" /> Cancel split</button>
        </div>
      )}

      {/* Share modal */}
      <Modal open={showShare} onClose={() => setShowShare(false)} title="Share Split" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Share this link with participants. They can pay without creating a LUMO account.</p>
          <div className="break-all rounded-lg border border-slate-100 bg-slate-50 p-3 font-mono text-sm text-slate-700">/s/{split.ref_code}</div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <div className="mb-1 flex items-center gap-2"><Send className="h-4 w-4 text-blue-600" /><span className="text-xs font-bold text-blue-900">Reminder preview</span></div>
            <p className="text-xs text-blue-800">{pendingParticipants[0]?.name || 'Kelvin'}, your {formatMoney(pendingParticipants[0]?.allocation_amount || 30000)} share is waiting. Pay securely here: /s/{split.ref_code}. Destination: {merchant?.display_name || 'Manual'}.</p>
          </div>
          <button onClick={() => setShowShare(false)} className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">Done</button>
        </div>
      </Modal>

      {/* Action modals */}
      {actionModal?.kind === 'edit' && <EditAmountModal participant={actionModal.participant} onSave={handleEditAmount} onClose={() => setActionModal(null)} />}
      {actionModal?.kind === 'add' && <AddPersonModal onSave={handleAddPerson} onClose={() => setActionModal(null)} />}
      {actionModal?.kind === 'cancel' && <CancelSplitModal onConfirm={handleCancelSplit} onClose={() => setActionModal(null)} />}
      {actionModal?.kind === 'report' && <ReportProblemModal onSubmit={handleReportProblem} onClose={() => setActionModal(null)} />}
      {actionModal?.kind === 'receipt' && <ReceiptModal split={split} merchant={merchant} participants={participants} payments={payments} onDownload={handleDownloadReceipt} onClose={() => setActionModal(null)} />}
      {actionModal?.kind === 'thankyou' && <ThankYouModal onSend={handleSendThankYou} onClose={() => setActionModal(null)} />}

      {/* Toast */}
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg animate-slide-up">{toast}</div>}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="mb-1 flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-slate-400" /><span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span></div>
      <p className="truncate text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ParticipantRow({ participant, isSettled, onPay, onRemind, onMarkCash, onEdit, onRemove, reminding, menuOpen, onToggleMenu }: {
  participant: Participant; isSettled: boolean; onPay: () => void; onRemind: () => void; onMarkCash: () => void; onEdit: () => void; onRemove: () => void; reminding: boolean; menuOpen: boolean; onToggleMenu: () => void;
}) {
  const isPaid = participant.status === 'PAID';
  const initials = participant.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={`relative flex items-center gap-3 rounded-xl border p-3.5 transition-all ${isPaid ? 'border-success-100 bg-success-50/30' : 'border-slate-100 hover:border-slate-200'}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isPaid ? 'bg-success-100 text-success-700' : 'bg-slate-100 text-slate-600'}`}>{initials}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-slate-900">{participant.name}</p>{participant.is_organizer && <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-600">ORGANIZER</span>}</div>
        <div className="mt-0.5 flex items-center gap-2"><span className="text-xs text-slate-400">{participant.phone || 'No phone'}</span><StatusBadge status={participant.status} type="participant" /></div>
      </div>
      <div className="shrink-0 text-right"><p className="text-sm font-bold text-slate-900">{formatMoney(participant.allocation_amount)}</p>{isPaid && participant.paid_at && <p className="text-[10px] font-medium text-success-600">{timeAgo(participant.paid_at)}</p>}</div>
      <div className="flex shrink-0 gap-1.5">
        {!isPaid && !isSettled && (
          <>
            <button onClick={onRemind} disabled={reminding} className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-all hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50" title="Send reminder">{reminding ? <Check className="h-4 w-4 text-success-500" /> : <Bell className="h-4 w-4" />}</button>
            <button onClick={onPay} className="whitespace-nowrap rounded-lg bg-primary-600 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-primary-700">Pay</button>
            <button onClick={onToggleMenu} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-slate-50"><MoreHorizontal className="h-4 w-4" /></button>
          </>
        )}
        {isPaid && <div className="flex items-center gap-1 px-2 text-success-600"><CheckCircle2 className="h-4 w-4" /></div>}
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggleMenu} />
          <div className="absolute right-4 top-full z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-xl animate-scale-in">
            <button onClick={() => { onToggleMenu(); onMarkCash(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"><Check className="h-4 w-4 text-success-600" /> Mark as paid in cash</button>
            <button onClick={() => { onToggleMenu(); onEdit(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"><Pencil className="h-4 w-4 text-slate-500" /> Edit amount</button>
            {!participant.is_organizer && <button onClick={() => { onToggleMenu(); onRemove(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-bold text-error-600 hover:bg-error-50"><Trash2 className="h-4 w-4" /> Remove person</button>}
          </div>
        </>
      )}
    </div>
  );
}

function EditAmountModal({ participant, onSave, onClose }: { participant: Participant; onSave: (p: Participant, amount: number) => void; onClose: () => void }) {
  const [amount, setAmount] = useState(String(participant.allocation_amount));
  return <Modal open onClose={onClose} title="Edit share" size="sm">
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Update {participant.name}'s share amount.</p>
      <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-primary-400" />
      <div className="flex gap-3"><button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button onClick={() => onSave(participant, Number(amount) || 0)} className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-bold text-white hover:bg-primary-700">Save</button></div>
    </div>
  </Modal>;
}

function AddPersonModal({ onSave, onClose }: { onSave: (name: string, phone: string, amount: number) => void; onClose: () => void }) {
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [amount, setAmount] = useState('');
  return <Modal open onClose={onClose} title="Add person" size="sm">
    <div className="space-y-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary-400" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary-400" />
      <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Share amount (TZS)" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-primary-400" />
      <div className="flex gap-3"><button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button onClick={() => name.trim() && onSave(name.trim(), phone.trim(), Number(amount) || 0)} disabled={!name.trim()} className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">Add</button></div>
    </div>
  </Modal>;
}

function CancelSplitModal({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return <Modal open onClose={onClose} title="Cancel this split?" size="sm">
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-error-100 bg-error-50 p-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error-600" /><p className="text-sm text-error-800">This will cancel the split. Refunds depend on the payment provider — participants who already paid should contact their provider directly.</p></div>
      <div className="flex gap-3"><button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-bold text-slate-600">Keep split</button><button onClick={onConfirm} className="flex-1 rounded-lg bg-error-600 py-2.5 text-sm font-bold text-white hover:bg-error-700">Cancel split</button></div>
    </div>
  </Modal>;
}

function ReportProblemModal({ onSubmit, onClose }: { onSubmit: (description: string) => void; onClose: () => void }) {
  const [description, setDescription] = useState('');
  return <Modal open onClose={onClose} title="Report a problem" size="sm">
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Describe the issue and our support team will look into it.</p>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What went wrong?" rows={4} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary-400" />
      <div className="flex gap-3"><button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button onClick={() => onSubmit(description.trim() || 'No description provided')} className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-bold text-white hover:bg-primary-700">Submit</button></div>
    </div>
  </Modal>;
}

function ReceiptModal({ split, merchant, participants, payments, onDownload, onClose }: { split: Split; merchant: Merchant | null; participants: Participant[]; payments: PaymentAttempt[]; onDownload: () => void; onClose: () => void }) {
  return <Modal open onClose={onClose} title="Receipt" size="md">
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3"><span className="text-xs font-bold uppercase text-slate-400">Bill</span><span className="font-bold text-slate-900">{split.title}</span></div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-mono text-slate-700">{split.ref_code}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Destination</span><span className="font-medium text-slate-900">{merchant?.display_name || 'Manual'}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-bold text-slate-900">{formatMoney(split.total_amount)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Collected</span><span className="font-bold text-success-600">{formatMoney(split.amount_paid)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusBadge status={split.status} /></div>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-bold uppercase text-slate-400">Participants</p>
        {participants.map((p) => <div key={p.id} className="flex justify-between text-sm"><span className="text-slate-600">{p.name}</span><span className="font-medium text-slate-900">{formatMoney(p.allocation_amount)} — {p.status}</span></div>)}
      </div>
      <button onClick={onDownload} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-3 text-sm font-bold text-white hover:bg-primary-700"><Download className="h-4 w-4" /> Download receipt</button>
    </div>
  </Modal>;
}

function ThankYouModal({ onSend, onClose }: { onSend: (message: string) => void; onClose: () => void }) {
  const [message, setMessage] = useState('Thank you all for contributing! The bill is fully settled.');
  return <Modal open onClose={onClose} title="Send thank-you" size="sm">
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Send a thank-you message to all participants.</p>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary-400" />
      <div className="flex gap-3"><button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button onClick={() => onSend(message)} className="flex-1 rounded-lg bg-success-600 py-2.5 text-sm font-bold text-white hover:bg-success-700"><Heart className="mr-1 inline h-4 w-4" /> Send</button></div>
    </div>
  </Modal>;
}
