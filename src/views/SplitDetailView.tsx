import { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, ArrowLeft, Ban, Bell, Building2, Calendar, Check, CheckCircle2,
  Clock, Copy, Download, Heart, Loader2, MoreHorizontal, PartyPopper, Pencil,
  Plus, Receipt, RefreshCw, Send, Share2, ShieldAlert, Sparkles, StickyNote, Trash2,
  TrendingUp, Users, X,
} from 'lucide-react';
import { supabase, type Split, type Participant, type Merchant, type PaymentAttempt } from '@/lib/supabase';
import { formatMoney, formatDateTime, timeAgo } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';
import { CategoryIcon } from '@/components/CategoryIcon';
import Modal from '@/components/Modal';
import TrustStrip from '@/components/TrustStrip';
import { downloadColoredReceipt } from '@/lib/coloredReceipt';

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

    const participantIds = (p || []).map((pp: Participant) => pp.id);
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

    const newAmountPaid = split.amount_paid + participant.allocation_amount;
    const newPercent = Math.round((newAmountPaid / split.total_amount) * 100);
    const newStatus = newPercent >= 100 ? 'SETTLED' : 'PARTIALLY_PAID';
    await supabase.from('splits').update({
      amount_paid: newAmountPaid, settlement_percent: Math.min(newPercent, 100), status: newStatus,
    }).eq('id', split.id);

    showToast(`Marked ${participant.name} as paid in cash`);
    void loadData();
  }

  async function handleEditAmount(participant: Participant, newAmount: number) {
    await supabase.from('split_participants').update({ allocation_amount: newAmount }).eq('id', participant.id);
    setActionModal(null);
    showToast(`Updated ${participant.name}'s share to ${formatMoney(newAmount)}`);
    void loadData();
  }

  async function handleAddPerson(name: string, phone: string, amount: number) {
    await supabase.from('split_participants').insert({
      split_id: split.id, name, phone, allocation_amount: amount, status: 'PENDING', is_organizer: false,
    });
    const newCount = split.participant_count + 1;
    await supabase.from('splits').update({ participant_count: newCount }).eq('id', split.id);
    setActionModal(null);
    showToast(`Added ${name} to split`);
    void loadData();
  }

  async function handleRemovePerson(participant: Participant) {
    await supabase.from('split_participants').delete().eq('id', participant.id);
    const newCount = Math.max(1, split.participant_count - 1);
    await supabase.from('splits').update({ participant_count: newCount }).eq('id', split.id);
    showToast(`Removed ${participant.name}`);
    void loadData();
  }

  async function handleCancelSplit() {
    await supabase.from('splits').update({ status: 'CANCELLED' }).eq('id', split.id);
    setActionModal(null);
    showToast('Split cancelled');
    void loadData();
  }

  async function handleReportProblem(description: string) {
    await supabase.from('audit_logs').insert({
      actor: split.organizer_name, action: 'PROBLEM_REPORTED', entity_type: 'split', entity_id: split.id,
      metadata: { description, split_ref: split.ref_code },
    });
    setActionModal(null);
    showToast('Problem reported. Our support team will review it.');
  }

  function handleDownloadReceipt() {
    downloadColoredReceipt({
      title: split.title,
      refCode: split.ref_code,
      amount: split.amount_paid,
      totalAmount: split.total_amount,
      merchantName: merchant?.display_name || undefined,
      status: split.status,
      participants: participants.map((p) => ({
        name: p.name,
        amount: p.allocation_amount,
        status: p.status,
        payment_ref: p.payment_ref,
      })),
    });
  }

  function handleSendThankYou(message: string) {
    void supabase.from('audit_logs').insert({
      actor: split.organizer_name, action: 'THANKYOU_SENT', entity_type: 'split', entity_id: split.id,
      metadata: { message, split_ref: split.ref_code },
    });
    setActionModal(null);
    showToast('Thank-you sent to all participants');
  }

  const isParticipantPaid = (p: Participant) => {
    const st = (p.status || '').toUpperCase();
    return st === 'PAID' || st === 'SETTLED' || st === 'CASH' || Boolean(p.is_paid) || (Number(p.amount_paid || 0) >= Number(p.allocation_amount || 0) && Number(p.allocation_amount || 0) > 0);
  };
  const remaining = Math.max(0, split.total_amount - split.amount_paid);
  const paidParticipants = participants.filter(isParticipantPaid);
  const pendingParticipants = participants.filter((p) => !isParticipantPaid(p) && !p.is_organizer);
  const isSettled = split.status === 'SETTLED' || split.settlement_percent === 100;
  const isCancelled = split.status === 'CANCELLED';

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-8"><div className="h-64 rounded-3xl bg-[#0C1816] border border-slate-800 animate-pulse" /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-fade-in text-white">
      <button onClick={onBack} className="mb-5 flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition">
        <ArrowLeft className="h-4 w-4" /> All Splits
      </button>

      {/* Split header */}
      <div className="mb-6 rounded-3xl border border-slate-800/80 bg-[#0C1816] p-6 sm:p-7 shadow-2xl">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#081B17] border border-[#0D382E] text-[#00E599]">
              <CategoryIcon category={split.category} className="h-7 w-7 text-[#00E599]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">{split.title}</h1>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono">Ref: {split.ref_code}</span>
                <StatusBadge status={split.status} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!isCancelled && (
              <button
                onClick={() => setShowShare(true)}
                className="rounded-xl border border-slate-800 bg-[#060D0E] p-2.5 text-slate-400 hover:text-white hover:border-[#00E599]/40 transition"
                title="Share Split"
              >
                <Share2 className="h-4 w-4" />
              </button>
            )}
            {isSettled && (
              <button
                onClick={() => setActionModal({ kind: 'receipt' })}
                className="rounded-xl border border-slate-800 bg-[#060D0E] p-2.5 text-slate-400 hover:text-white hover:border-[#00E599]/40 transition"
                title="Download Receipt"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Settled banner */}
        {isSettled && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#0D382E] bg-gradient-to-r from-[#081B17] via-[#0C1816] to-[#081B17] p-5 sm:flex-row sm:items-center sm:justify-between shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00E599] text-[#060D0E] shadow-[0_0_15px_rgba(0,229,153,0.3)]">
                <PartyPopper className="h-6 w-6" />
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-black text-[#00E599]"><Sparkles className="h-4 w-4 text-[#00E599] shrink-0" /> SPLIT SETTLED 100%</p>
                <p className="text-xs font-semibold text-slate-300">All {participants.length} participants have paid! {formatMoney(split.total_amount)} collected successfully.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3 sm:border-t-0 sm:pt-0">
              <button onClick={() => setActionModal({ kind: 'thankyou' })} className="flex items-center gap-1.5 rounded-xl bg-[#060D0E] border border-slate-800 px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white hover:border-[#00E599]/40 transition">
                <Heart className="h-3.5 w-3.5 text-[#00E599]" /> Send Thank-You
              </button>
              <button onClick={onBack} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00E599] to-[#00C782] px-4 py-2 text-xs font-black text-[#060D0E] shadow-[0_0_15px_rgba(0,229,153,0.2)] hover:brightness-110 transition">
                <Plus className="h-3.5 w-3.5" /> Create another
              </button>
            </div>
          </div>
        )}

        {/* Cancelled banner */}
        {isCancelled && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-red-300">
            <Ban className="h-6 w-6 text-red-400 shrink-0" />
            <div><p className="text-sm font-extrabold text-red-300">Split cancelled</p><p className="text-xs text-red-400/80">Refunds depend on the payment provider. Participants should contact their provider directly.</p></div>
          </div>
        )}

        {/* Segmented progress */}
        <div className="mb-5 rounded-2xl border border-slate-800/80 bg-[#060D0E] p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Collected vs remaining</span>
            <span className={`text-2xl font-black ${isSettled ? 'text-[#00E599]' : 'text-white'}`}>{split.settlement_percent}%</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-gradient-to-r from-[#00E599] to-[#00C782] transition-all duration-700 shadow-[0_0_12px_rgba(0,229,153,0.4)]" style={{ width: `${Math.min(split.settlement_percent, 100)}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-400"><span className="font-bold text-[#00E599]">{formatMoney(split.amount_paid)}</span> collected · {paidParticipants.length} paid</span>
            {remaining > 0 && <span className="font-bold text-amber-400">{formatMoney(remaining)} remaining · {pendingParticipants.length} pending</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoItem icon={Building2} label="Destination" value={merchant?.display_name || 'Manual'} />
          <InfoItem icon={Users} label="Participants" value={`${split.participant_count} people`} />
          <InfoItem icon={Calendar} label="Due Date" value={formatDateTime(split.due_at)} />
          <InfoItem icon={Receipt} label="Total Bill" value={formatMoney(split.total_amount)} />
        </div>

        {split.note && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3.5">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs font-semibold text-amber-300">{split.note}</p>
          </div>
        )}
      </div>

      <div className="mb-6"><TrustStrip merchantName={merchant?.display_name} destinationId={merchant?.destination_id} /></div>

      {/* Participants */}
      {!isCancelled && (
        <div className="mb-6 rounded-3xl border border-slate-800/80 bg-[#0C1816] p-6 sm:p-7 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-black text-white text-base">Participants & Payments</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400">{paidParticipants.length}/{participants.length} paid</span>
              {pendingParticipants.length > 0 && (
                <button
                  onClick={handleRemindAll}
                  disabled={remindingAll}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition disabled:opacity-50"
                >
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
            <button
              onClick={() => setActionModal({ kind: 'add' })}
              className="mt-5 flex items-center gap-2 text-xs font-extrabold text-[#00E599] hover:underline"
            >
              <Plus className="h-4 w-4" /> Add person
            </button>
          )}
        </div>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="mb-6 rounded-3xl border border-slate-800/80 bg-[#0C1816] p-6 shadow-2xl">
          <h2 className="mb-4 font-black text-white text-base">Payment History</h2>
          <div className="space-y-2.5">
            {payments.map((pay) => {
              const p = participants.find((pp) => pp.id === pay.split_participant_id);
              const isCash = pay.provider === 'Cash';
              return (
                <div key={pay.id} className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-[#060D0E] p-3.5 text-sm">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                      pay.status === 'SUCCESS'
                        ? isCash ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-[#081B17] text-[#00E599] border border-[#0D382E]'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {pay.status === 'SUCCESS' ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-bold text-white text-xs">{p?.name || 'Unknown'}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{pay.provider_tx_ref} · {pay.provider}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-white text-xs">{formatMoney(pay.amount)}</p>
                    <p className="text-[11px] text-slate-500">{timeAgo(pay.requested_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Danger zone */}
      {!isCancelled && (
        <div className="mb-6 flex flex-wrap gap-3 rounded-3xl border border-slate-800/80 bg-[#0C1816] p-4 shadow-xl">
          <button onClick={() => setActionModal({ kind: 'report' })} className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-700 transition">
            <ShieldAlert className="h-4 w-4 text-slate-400" /> Report a problem
          </button>
          <button onClick={() => setActionModal({ kind: 'cancel' })} className="flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-950/60 transition">
            <Ban className="h-4 w-4" /> Cancel split
          </button>
        </div>
      )}

      {/* Share modal */}
      <Modal open={showShare} onClose={() => setShowShare(false)} title="Share Split" size="sm">
        <div className="space-y-4 text-white">
          <p className="text-xs text-slate-400">Share this link with participants. They can pay directly without creating a LUMO account.</p>
          <div className="break-all rounded-2xl border border-slate-800 bg-[#060D0E] p-3 font-mono text-xs text-[#00E599]">{window.location.origin}/s/{split.ref_code}</div>
          <div className="rounded-2xl border border-[#0D382E] bg-[#081B17] p-3.5">
            <div className="mb-1 flex items-center gap-2"><Send className="h-4 w-4 text-[#00E599]" /><span className="text-xs font-extrabold text-[#00E599]">Reminder Preview</span></div>
            <p className="text-xs text-slate-300">{pendingParticipants[0]?.name || 'Participant'}, your {formatMoney(pendingParticipants[0]?.allocation_amount || 30000)} share is waiting. Pay securely here: /s/{split.ref_code}.</p>
          </div>
          <button onClick={() => setShowShare(false)} className="w-full rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C782] py-2.5 text-xs font-black text-[#060D0E] hover:brightness-110 transition">Done</button>
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
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-[#081B17] border border-[#00E599]/40 px-5 py-3 text-xs font-bold text-[#00E599] shadow-2xl animate-slide-up">{toast}</div>}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#060D0E] border border-slate-800/80 p-3.5">
      <div className="mb-1 flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-slate-500" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span></div>
      <p className="truncate text-xs font-bold text-white">{value}</p>
    </div>
  );
}

function ParticipantRow({ participant, isSettled, onPay, onRemind, onMarkCash, onEdit, onRemove, reminding, menuOpen, onToggleMenu }: {
  participant: Participant; isSettled: boolean; onPay: () => void; onRemind: () => void; onMarkCash: () => void; onEdit: () => void; onRemove: () => void; reminding: boolean; menuOpen: boolean; onToggleMenu: () => void;
}) {
  const isPaid = participant.status === 'PAID';
  const initials = participant.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={`relative flex items-center gap-3 rounded-2xl border p-3.5 transition-all ${
      isPaid ? 'border-[#0D382E] bg-[#081B17]/60' : 'border-slate-800/80 bg-[#060D0E]/60 hover:border-slate-700'
    }`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
        isPaid ? 'bg-[#0D382E] text-[#00E599] border border-[#00E599]/30' : 'bg-slate-800 text-slate-300'
      }`}>{initials}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-bold text-white">{participant.name}</p>
          {participant.is_organizer && <span className="rounded-lg bg-[#0D382E] border border-[#00E599]/30 px-1.5 py-0.5 text-[9px] font-black text-[#00E599]">ORGANIZER</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[11px] text-slate-500">{participant.phone || 'No phone'}</span>
          <StatusBadge status={participant.status} type="participant" />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-black text-white">{formatMoney(participant.allocation_amount)}</p>
        {isPaid && participant.paid_at && <p className="text-[10px] font-semibold text-[#00E599]">{timeAgo(participant.paid_at)}</p>}
      </div>
      <div className="flex shrink-0 gap-1.5">
        {!isPaid && !isSettled && (
          <>
            <button onClick={onRemind} disabled={reminding} className="rounded-xl border border-slate-800 bg-[#0C1816] p-2 text-slate-400 transition-all hover:border-amber-500/40 hover:text-amber-400 disabled:opacity-50" title="Send reminder">
              {reminding ? <Check className="h-4 w-4 text-[#00E599]" /> : <Bell className="h-4 w-4" />}
            </button>
            <button onClick={onPay} className="whitespace-nowrap rounded-xl bg-gradient-to-r from-[#00E599] to-[#00C782] px-3 py-1.5 text-xs font-black text-[#060D0E] shadow-[0_0_12px_rgba(0,229,153,0.25)] hover:brightness-110 transition">
              Pay
            </button>
            <button onClick={onToggleMenu} className="rounded-xl border border-slate-800 bg-[#0C1816] p-2 text-slate-400 hover:text-white">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </>
        )}
        {isPaid && <div className="flex items-center gap-1 px-2 text-[#00E599]"><CheckCircle2 className="h-4 w-4" /></div>}
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggleMenu} />
          <div className="absolute right-4 top-full z-20 mt-1 w-48 rounded-2xl border border-slate-800 bg-[#0C1816] py-1.5 shadow-2xl animate-scale-in">
            <button onClick={() => { onToggleMenu(); onMarkCash(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800/60 hover:text-white transition">
              <Check className="h-4 w-4 text-[#00E599]" /> Mark as paid in cash
            </button>
            <button onClick={() => { onToggleMenu(); onEdit(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800/60 hover:text-white transition">
              <Pencil className="h-4 w-4 text-slate-400" /> Edit amount
            </button>
            {!participant.is_organizer && (
              <button onClick={() => { onToggleMenu(); onRemove(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-950/40 transition">
                <Trash2 className="h-4 w-4" /> Remove person
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EditAmountModal({ participant, onSave, onClose }: { participant: Participant; onSave: (p: Participant, amount: number) => void; onClose: () => void }) {
  const [amount, setAmount] = useState(String(participant.allocation_amount));
  return (
    <Modal open onClose={onClose} title="Edit Share" size="sm">
      <div className="space-y-4 text-white">
        <p className="text-xs text-slate-400">Update {participant.name}'s share amount.</p>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#00E599]"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-800 bg-[#060D0E] py-2.5 text-xs font-bold text-slate-400 hover:text-white">Cancel</button>
          <button onClick={() => onSave(participant, Number(amount) || 0)} className="flex-1 rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C782] py-2.5 text-xs font-black text-[#060D0E]">Save</button>
        </div>
      </div>
    </Modal>
  );
}

function AddPersonModal({ onSave, onClose }: { onSave: (name: string, phone: string, amount: number) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  return (
    <Modal open onClose={onClose} title="Add Person" size="sm">
      <div className="space-y-4 text-white">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#00E599]"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          className="w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#00E599]"
        />
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Share amount (TZS)"
          className="w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#00E599]"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-800 bg-[#060D0E] py-2.5 text-xs font-bold text-slate-400 hover:text-white">Cancel</button>
          <button
            onClick={() => name.trim() && onSave(name.trim(), phone.trim(), Number(amount) || 0)}
            disabled={!name.trim()}
            className="flex-1 rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C782] py-2.5 text-xs font-black text-[#060D0E] disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CancelSplitModal({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Cancel this Split?" size="sm">
      <div className="space-y-4 text-white">
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-950/40 p-3.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <p className="text-xs text-red-300">This will cancel the split. Refunds depend on the payment provider — participants who already paid should contact their provider directly.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-800 bg-[#060D0E] py-2.5 text-xs font-bold text-slate-400 hover:text-white">Keep Split</button>
          <button onClick={onConfirm} className="flex-1 rounded-2xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700">Cancel Split</button>
        </div>
      </div>
    </Modal>
  );
}

function ReportProblemModal({ onSubmit, onClose }: { onSubmit: (description: string) => void; onClose: () => void }) {
  const [description, setDescription] = useState('');
  return (
    <Modal open onClose={onClose} title="Report a Problem" size="sm">
      <div className="space-y-4 text-white">
        <p className="text-xs text-slate-400">Describe the issue and our support team will look into it.</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What went wrong?"
          rows={4}
          className="w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-xs font-medium text-white outline-none focus:border-[#00E599]"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-800 bg-[#060D0E] py-2.5 text-xs font-bold text-slate-400 hover:text-white">Cancel</button>
          <button onClick={() => onSubmit(description.trim() || 'No description provided')} className="flex-1 rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C782] py-2.5 text-xs font-black text-[#060D0E]">Submit</button>
        </div>
      </div>
    </Modal>
  );
}

function ReceiptModal({ split, merchant, participants, payments, onDownload, onClose }: { split: Split; merchant: Merchant | null; participants: Participant[]; payments: PaymentAttempt[]; onDownload: () => void; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Receipt" size="md">
      <div className="space-y-4 text-white">
        <div className="rounded-2xl border border-slate-800/80 bg-[#060D0E] p-4">
          <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold uppercase text-slate-500">Bill</span>
            <span className="font-extrabold text-white text-sm">{split.title}</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Reference</span><span className="font-mono text-white">{split.ref_code}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Destination</span><span className="font-bold text-white">{merchant?.display_name || 'Manual'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="font-black text-white">{formatMoney(split.total_amount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Collected</span><span className="font-black text-[#00E599]">{formatMoney(split.amount_paid)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Status</span><StatusBadge status={split.status} /></div>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Participants</p>
          {participants.map((p) => (
            <div key={p.id} className="flex justify-between text-xs py-1 border-b border-slate-800/40">
              <span className="text-slate-300">{p.name}</span>
              <span className="font-bold text-white">{formatMoney(p.allocation_amount)} — {p.status}</span>
            </div>
          ))}
        </div>
        <button onClick={onDownload} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C782] py-3 text-xs font-black text-[#060D0E] hover:brightness-110 transition">
          <Download className="h-4 w-4" /> Download Receipt
        </button>
      </div>
    </Modal>
  );
}

function ThankYouModal({ onSend, onClose }: { onSend: (message: string) => void; onClose: () => void }) {
  const [message, setMessage] = useState('Thank you all for contributing! The bill is fully settled.');
  return (
    <Modal open onClose={onClose} title="Send Thank-You" size="sm">
      <div className="space-y-4 text-white">
        <p className="text-xs text-slate-400">Send a thank-you message to all participants.</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-xs font-medium text-white outline-none focus:border-[#00E599]"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-800 bg-[#060D0E] py-2.5 text-xs font-bold text-slate-400 hover:text-white">Cancel</button>
          <button onClick={() => onSend(message)} className="flex-1 rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C782] py-2.5 text-xs font-black text-[#060D0E] hover:brightness-110 transition">
            <Heart className="mr-1 inline h-4 w-4 fill-current" /> Send
          </button>
        </div>
      </div>
    </Modal>
  );
}
