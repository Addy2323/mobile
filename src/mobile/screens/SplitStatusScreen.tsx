import React, { useState, useEffect } from 'react';
import { ArrowLeft, MessageCircle, DollarSign, CheckCircle2, Clock, AlertCircle, Share2, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { supabase, type Split, type Participant } from '@/lib/supabase';
import { formatMoney } from '@/lib/utils';
import ProgressBar from '@/components/ProgressBar';
import StatusBadge from '@/components/StatusBadge';
import TrustStrip from '@/components/TrustStrip';
import { BottomSheet } from '../components/BottomSheet';
import { getTranslation, type Language } from '@/lib/i18n';

interface SplitStatusScreenProps {
  split: Split;
  onBack: () => void;
  onPay: (participant: Participant, split: Split) => void;
  language: Language;
}

export const SplitStatusScreen: React.FC<SplitStatusScreenProps> = ({ split, onBack, onPay, language }) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCashSheetOpen, setIsCashSheetOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

  const t = (key: any) => getTranslation(key, language);

  async function loadParticipants() {
    try {
      const { data } = await supabase
        .from('split_participants')
        .select('*')
        .eq('split_id', split.id);

      if (data) {
        setParticipants(data);
      }
    } catch (err) {
      console.error('Failed loading participants:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParticipants();
  }, [split.id]);

  const isParticipantPaid = (p: Participant) => {
    const st = (p.status || '').toUpperCase();
    return st === 'PAID' || st === 'SETTLED' || st === 'CASH' || Boolean(p.is_paid) || (Number(p.amount_paid || 0) >= Number(p.allocation_amount || 0) && Number(p.allocation_amount || 0) > 0);
  };

  const getPaidAmount = (p: Participant) => {
    if (!isParticipantPaid(p)) return Number(p.amount_paid || 0);
    return Number(p.amount_paid || 0) > 0 ? Number(p.amount_paid) : Number(p.allocation_amount || 0);
  };

  const paidParticipants = participants.filter(isParticipantPaid);
  const pendingParticipants = participants.filter((p) => !isParticipantPaid(p));
  const collectedAmount = participants.reduce((sum, p) => sum + getPaidAmount(p), 0);
  const remainingAmount = Math.max(0, split.total_amount - collectedAmount);
  const pct = Math.min(100, Math.round((collectedAmount / (split.total_amount || 1)) * 100));

  const handleMarkCash = async (p: Participant) => {
    try {
      await supabase
        .from('split_participants')
        .update({ status: 'Paid', payment_ref: 'CASH_OFFLINE' })
        .eq('id', p.id);

      setIsCashSheetOpen(false);
      loadParticipants();
    } catch (err) {
      console.error('Failed marking cash:', err);
    }
  };

  const shareUrl = `${window.location.origin}/s/${split.ref_code}`;

  return (
    <div className="min-h-screen bg-[#060D0E] text-slate-100 p-4 space-y-5 no-tap-highlight">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-1 text-slate-300 hover:text-white rounded-full hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-white text-sm tracking-wide">Split Status</span>
        <button className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Bill Summary Hero Card */}
      <div className="bg-[#0C181A] p-5 rounded-3xl border border-[#00E599]/20 shadow-xl shadow-black/40 space-y-4 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#00E599]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-start justify-between relative z-10">
          <div>
            <h2 className="text-lg font-bold text-white leading-snug">{split.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Organized by {split.organizer_name} · Ref <span className="font-mono text-[#00E599]">{split.ref_code}</span>
            </p>
          </div>
          <span className="text-base font-black text-[#00E599]">{formatMoney(split.total_amount)}</span>
        </div>

        {/* Progress Bar & Amounts */}
        <div className="space-y-2 pt-2 border-t border-white/10 relative z-10">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-slate-400">
              {paidParticipants.length} of {participants.length || split.participant_count} people paid
            </span>
            <span className={pct === 100 ? 'text-[#00E599] font-extrabold' : 'text-emerald-400 font-extrabold'}>
              {pct}% Settled
            </span>
          </div>
          <ProgressBar percent={pct} />

          <div className="grid grid-cols-2 gap-3 pt-2 text-center">
            <div className="p-3 bg-[#00E599]/10 rounded-2xl border border-[#00E599]/25">
              <span className="text-[11px] font-bold text-[#00E599] uppercase tracking-wider block">
                {t('collected')}
              </span>
              <span className="text-base font-black text-white block mt-0.5">
                {formatMoney(collectedAmount)}
              </span>
            </div>

            <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/25">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                {t('remaining')}
              </span>
              <span className="text-base font-black text-amber-300 block mt-0.5">
                {formatMoney(remainingAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Strip */}
      <TrustStrip />

      {/* Participant List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Participants ({participants.length})
        </h3>

        <div className="space-y-2.5">
          {participants.map((p) => (
            <div
              key={p.id}
              className="bg-[#0C181A] p-4 rounded-2xl border border-white/10 hover:border-[#00E599]/30 transition-all flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#00E599]/15 text-[#00E599] border border-[#00E599]/30 font-extrabold rounded-xl flex items-center justify-center text-sm">
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">
                    {p.name} {p.is_organizer && <span className="text-xs text-[#00E599] font-normal">(Organizer)</span>}
                  </h4>
                  <p className="text-xs text-slate-400">{formatMoney(p.allocation_amount)}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <StatusBadge status={p.status as any} />

                {p.status !== 'Paid' && (
                  <button
                    onClick={() => {
                      setSelectedParticipant(p);
                      setIsCashSheetOpen(true);
                    }}
                    className="p-2 bg-white/5 hover:bg-[#00E599]/20 text-slate-300 hover:text-[#00E599] rounded-xl text-xs font-semibold transition-colors"
                    title="Mark Cash"
                  >
                    <DollarSign className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Sticky Action Buttons */}
      <div className="space-y-2 pt-2">
        {pendingParticipants.length > 0 && (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Reminder: Please pay your share for ${split.title} on LUMO Split: ${shareUrl}`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="w-full py-4 bg-gradient-to-r from-[#00E599] to-[#00C880] hover:brightness-105 active:scale-[0.98] text-[#060D0E] font-black rounded-2xl shadow-lg shadow-[#00E599]/20 flex items-center justify-center space-x-2 text-sm transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{t('remindFriends')} via WhatsApp</span>
          </a>
        )}
      </div>

      {/* Mark Cash Sheet */}
      <BottomSheet
        isOpen={isCashSheetOpen}
        onClose={() => setIsCashSheetOpen(false)}
        title="Mark Cash Payment"
      >
        {selectedParticipant && (
          <div className="space-y-4 pt-1 text-slate-200">
            <p className="text-xs text-slate-300">
              Confirm that <span className="font-bold text-white">{selectedParticipant.name}</span> has paid{' '}
              <span className="font-bold text-[#00E599]">{formatMoney(selectedParticipant.allocation_amount)}</span> in cash directly to the merchant.
            </p>

            <button
              onClick={() => handleMarkCash(selectedParticipant)}
              className="w-full py-3.5 bg-gradient-to-r from-[#00E599] to-[#00C880] text-[#060D0E] font-black rounded-2xl shadow-lg shadow-[#00E599]/20 transition-all hover:brightness-105"
            >
              Confirm Cash Payment
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
