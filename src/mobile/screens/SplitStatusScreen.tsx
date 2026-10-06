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

  const paidParticipants = participants.filter((p) => p.status === 'Paid');
  const pendingParticipants = participants.filter((p) => p.status !== 'Paid');
  const collectedAmount = participants.reduce((sum, p) => sum + (p.status === 'Paid' ? p.allocation_amount : 0), 0);
  const remainingAmount = split.total_amount - collectedAmount;
  const pct = Math.round((collectedAmount / (split.total_amount || 1)) * 100);

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
    <div className="p-4 space-y-5 no-tap-highlight">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="p-1.5 -ml-1 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-slate-900 text-sm">Split Status</span>
        <button className="p-1.5 text-slate-600 hover:text-slate-900">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Bill Summary Hero Card */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{split.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Organized by {split.organizer_name} · Ref {split.ref_code}
            </p>
          </div>
          <span className="text-sm font-black text-slate-900">{formatMoney(split.total_amount)}</span>
        </div>

        {/* Progress Bar & Amounts */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-slate-500">
              {paidParticipants.length} of {participants.length || split.participant_count} people paid
            </span>
            <span className={pct === 100 ? 'text-emerald-600 font-extrabold' : 'text-indigo-600 font-extrabold'}>
              {pct}% Settled
            </span>
          </div>
          <ProgressBar percent={pct} />

          <div className="grid grid-cols-2 gap-3 pt-2 text-center">
            <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100/60">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                {t('collected')}
              </span>
              <span className="text-base font-black text-emerald-600 block mt-0.5">
                {formatMoney(collectedAmount)}
              </span>
            </div>

            <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100/60">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                {t('remaining')}
              </span>
              <span className="text-base font-black text-amber-600 block mt-0.5">
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
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
          Participants ({participants.length})
        </h3>

        <div className="space-y-2.5">
          {participants.map((p) => (
            <div
              key={p.id}
              className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-600 text-white font-extrabold rounded-xl flex items-center justify-center text-sm">
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {p.name} {p.is_organizer && '(Organizer)'}
                  </h4>
                  <p className="text-xs text-slate-500">{formatMoney(p.allocation_amount)}</p>
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
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
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
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg flex items-center justify-center space-x-2 text-sm transition-all"
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
          <div className="space-y-4 pt-1">
            <p className="text-xs text-slate-600">
              Confirm that <span className="font-bold text-slate-900">{selectedParticipant.name}</span> has paid{' '}
              <span className="font-bold text-indigo-600">{formatMoney(selectedParticipant.allocation_amount)}</span> in cash directly to the merchant.
            </p>

            <button
              onClick={() => handleMarkCash(selectedParticipant)}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition-all"
            >
              Confirm Cash Payment
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
