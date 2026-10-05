import { useState, useEffect } from 'react';
import {
  Search, Plus, X, Check, ArrowRight, ArrowLeft, Users, Store,
  ShieldCheck, Calculator, Calendar, StickyNote, CheckCircle2, Share2,
  Hotel, UtensilsCrossed, Plane, Calendar as CalIcon, ShoppingBag, Home, Receipt,
} from 'lucide-react';
import { supabase, type Merchant, type Split } from '@/lib/supabase';
import TrustStrip from '@/components/TrustStrip';
import { formatMoney, formatDateTime } from '@/lib/utils';
import { CategoryIcon } from '@/components/CategoryIcon';

type CreateViewProps = {
  onComplete: (split: Split) => void;
  onCancel: () => void;
};

type SplitMode = 'equal' | 'custom' | 'items';
type ParticipantInput = { name: string; phone: string; amount: number };

const categories = [
  { id: 'hotel', label: 'Hotel', icon: Hotel },
  { id: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  { id: 'travel', label: 'Travel', icon: Plane },
  { id: 'events', label: 'Events', icon: CalIcon },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { id: 'rent', label: 'Rent', icon: Home },
];

export default function CreateView({ onComplete, onCancel }: CreateViewProps) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('restaurant');
  const [totalAmount, setTotalAmount] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Destination
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Participants
  const [participants, setParticipants] = useState<ParticipantInput[]>([
    { name: '', phone: '', amount: 0 },
  ]);
  const [organizerName, setOrganizerName] = useState('');
  const [organizerPhone, setOrganizerPhone] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');

  // Success
  const [createdSplit, setCreatedSplit] = useState<Split | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    searchMerchants('');
  }, []);

  async function searchMerchants(query: string) {
    setSearchLoading(true);
    let q = supabase
      .from('merchants')
      .select('*')
      .eq('verification_status', 'VERIFIED');

    if (query) {
      q = q.or(`display_name.ilike.%${query}%,city.ilike.%${query}%,category.ilike.%${query}%`);
    }

    const { data } = await q.limit(20);
    if (data) setMerchants(data as Merchant[]);
    setSearchLoading(false);
  }

  function handleSearchChange(val: string) {
    setSearchQuery(val);
    searchMerchants(val);
  }

  function addParticipant() {
    setParticipants([...participants, { name: '', phone: '', amount: 0 }]);
  }

  function removeParticipant(idx: number) {
    setParticipants(participants.filter((_, i) => i !== idx));
  }

  function updateParticipant(idx: number, field: keyof ParticipantInput, value: string | number) {
    const updated = [...participants];
    updated[idx] = { ...updated[idx], [field]: value };
    setParticipants(updated);
  }

  const totalNum = parseInt(totalAmount) || 0;

  function computeEqualAmounts(): number[] {
    const count = participants.length + 1; // +1 for organizer
    if (count === 0 || totalNum === 0) return participants.map(() => 0);
    const base = Math.floor(totalNum / count);
    const remainder = totalNum - base * count;
    return participants.map((_, i) => base + (i < remainder ? 1 : 0));
  }

  const equalAmounts = computeEqualAmounts();
  const organizerAmount = totalNum - equalAmounts.reduce((s, a) => s + a, 0) - participants.reduce((s, p) => s + (splitMode === 'custom' ? p.amount : 0), 0);

  const customTotal = participants.reduce((s, p) => s + (p.amount || 0), 0) + (splitMode === 'custom' ? organizerAmount : 0);
  const customRemaining = totalNum - customTotal;

  function canProceedStep1() {
    return title.trim() && totalAmount && parseInt(totalAmount) > 0;
  }

  function canProceedStep2() {
    return selectedMerchant !== null;
  }

  function canProceedStep3() {
    const validParticipants = participants.filter((p) => p.name.trim());
    if (!organizerName.trim()) return false;
    if (validParticipants.length === 0) return false;

    if (splitMode === 'custom') {
      return customRemaining === 0;
    }
    return true;
  }

  async function handleCreate() {
    setCreating(true);
    const validParticipants = participants.filter((p) => p.name.trim());

    // Determine amounts
    let orgAmount: number;
    let participantAmounts: number[];

    if (splitMode === 'equal') {
      participantAmounts = equalAmounts;
      orgAmount = organizerAmount;
    } else {
      participantAmounts = validParticipants.map((p) => p.amount || 0);
      orgAmount = totalNum - participantAmounts.reduce((s, a) => s + a, 0);
    }

    // Insert split
    const { data: splitData, error: splitError } = await supabase
      .from('splits')
      .insert({
        title: title.trim(),
        category,
        total_amount: totalNum,
        mode: splitMode,
        organizer_name: organizerName.trim(),
        organizer_phone: organizerPhone.trim(),
        merchant_id: selectedMerchant?.id || null,
        status: 'ACTIVE',
        settlement_percent: 0,
        amount_paid: 0,
        participant_count: validParticipants.length + 1,
        due_at: dueDate ? new Date(dueDate).toISOString() : null,
        note: note.trim() || null,
      })
      .select()
      .single();

    if (splitError || !splitData) {
      setCreating(false);
      return;
    }

    const split = splitData as Split;

    // Insert participants (organizer first)
    const allParticipants = [
      {
        split_id: split.id,
        name: organizerName.trim(),
        phone: organizerPhone.trim() || null,
        allocation_amount: orgAmount,
        amount_paid: 0,
        status: 'PENDING',
        is_organizer: true,
      },
      ...validParticipants.map((p, i) => ({
        split_id: split.id,
        name: p.name.trim(),
        phone: p.phone.trim() || null,
        allocation_amount: participantAmounts[i] || 0,
        amount_paid: 0,
        status: 'PENDING',
        is_organizer: false,
      })),
    ];

    await supabase.from('split_participants').insert(allParticipants);

    // Audit log
    await supabase.from('audit_logs').insert({
      actor: organizerName.trim(),
      action: 'SPLIT_CREATED',
      entity_type: 'split',
      entity_id: split.id,
      metadata: { title: split.title, total_amount: split.total_amount },
    });

    setCreatedSplit(split);
    setCreating(false);
    setStep(4);
  }

  if (createdSplit && step === 4) {
    return <SuccessView split={createdSplit} merchant={selectedMerchant} onComplete={() => onComplete(createdSplit)} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Stepper */}
      <div className="flex items-center justify-between mb-8">
        {[
          { num: 1, label: 'Bill Details' },
          { num: 2, label: 'Destination' },
          { num: 3, label: 'Participants' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= s.num ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                {step > s.num ? <Check className="h-4 w-4" strokeWidth={3} /> : s.num}
              </div>
              <span className={`text-sm font-medium hidden sm:inline ${step >= s.num ? 'text-slate-900' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </div>
            {i < 2 && (
              <div className={`flex-1 h-0.5 mx-3 rounded-full transition-all ${step > s.num ? 'bg-primary-500' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Bill Details */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-slide-up">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Bill Details</h2>
          <p className="text-sm text-slate-500 mb-6">Tell us what this bill is for and how much it totals.</p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Bill Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Golden Hotel Weekend Stay"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${
                        category === cat.id
                          ? 'border-primary-300 bg-primary-50 text-primary-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-500'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-[10px] font-medium">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Total Amount (TZS)</label>
              <div className="relative">
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="500000"
                  className="w-full px-4 py-2.5 pr-20 rounded-lg border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm font-semibold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">TZS</span>
              </div>
              {totalAmount && (
                <p className="text-xs text-slate-500 mt-1.5">
                  {formatMoney(parseInt(totalAmount) || 0)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <Calendar className="h-3.5 w-3.5 inline mr-1" />
                  Due Date (optional)
                </label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <StickyNote className="h-3.5 w-3.5 inline mr-1" />
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Please pay before check-in"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
            <button onClick={onCancel} className="text-sm font-medium text-slate-500 hover:text-slate-700">
              Cancel
            </button>
            <button
              onClick={() => canProceedStep1() && setStep(2)}
              disabled={!canProceedStep1()}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Destination */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-slide-up">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Select Payment Destination</h2>
          <p className="text-sm text-slate-500 mb-6">
            Search for a verified merchant. LUMO resolves it to a trusted destination record — no bank details to type.
          </p>

          {selectedMerchant ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border-2 border-primary-200 bg-primary-50/50">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <CategoryIcon category={selectedMerchant.category} className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{selectedMerchant.display_name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{selectedMerchant.city}</span>
                      <span className="flex items-center gap-1 text-xs text-success-600 font-medium">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMerchant(null)}
                  className="p-2 rounded-lg hover:bg-white text-slate-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <Store className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">Destination ID</span>
                </div>
                <p className="font-mono text-sm text-slate-700">{selectedMerchant.destination_id}</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search by name, city, or category..."
                  className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm"
                  autoFocus
                />
              </div>

              {searchLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl shimmer" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {merchants.length === 0 ? (
                    <div className="text-center py-8">
                      <Store className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No merchants found</p>
                    </div>
                  ) : (
                    merchants.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMerchant(m)}
                        className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center">
                            <CategoryIcon category={m.category} className="h-5 w-5 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{m.display_name}</p>
                            <p className="text-xs text-slate-400">{m.city} · {m.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-[10px] text-success-600 font-semibold bg-success-50 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="h-3 w-3" /> Verified
                          </span>
                          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary-500 transition-colors" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={() => canProceedStep2() && setStep(3)}
              disabled={!canProceedStep2()}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Participants */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-slide-up">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Add Participants</h2>
          <p className="text-sm text-slate-500 mb-6">
            Participants don't need a LUMO account. They'll receive a payment request and can pay as guests.
          </p>

          {/* Split Mode */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Calculator className="h-3.5 w-3.5 inline mr-1" />
              Split Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'equal', label: 'Equal', desc: 'Split evenly' },
                { id: 'custom', label: 'Custom', desc: 'Set amounts' },
                { id: 'items', label: 'By Items', desc: 'Line items' },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSplitMode(m.id)}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    splitMode === m.id
                      ? 'border-primary-300 bg-primary-50 text-primary-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-500'
                  }`}
                >
                  <p className="text-sm font-bold">{m.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Organizer */}
          <div className="p-4 rounded-xl bg-primary-50/30 border border-primary-100 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-bold text-slate-900">You (Organizer)</span>
              {splitMode !== 'items' && (
                <span className="ml-auto text-sm font-bold text-primary-700">
                  {formatMoney(splitMode === 'equal' ? organizerAmount : (totalNum - customTotal + (parseInt(totalAmount) > 0 ? 0 : 0)))}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                placeholder="Your name"
                className="px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-sm bg-white"
              />
              <input
                type="tel"
                value={organizerPhone}
                onChange={(e) => setOrganizerPhone(e.target.value)}
                placeholder="+2557XXXXXXXX"
                className="px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-sm bg-white"
              />
            </div>
          </div>

          {/* Participants list */}
          <div className="space-y-3 mb-4">
            {participants.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2 p-3 rounded-xl border border-slate-100">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                  {idx + 1}
                </div>
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updateParticipant(idx, 'name', e.target.value)}
                  placeholder="Name"
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-sm"
                />
                <input
                  type="tel"
                  value={p.phone}
                  onChange={(e) => updateParticipant(idx, 'phone', e.target.value)}
                  placeholder="Phone"
                  className="w-28 sm:w-36 px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-sm"
                />
                {splitMode === 'custom' && (
                  <input
                    type="number"
                    value={p.amount || ''}
                    onChange={(e) => updateParticipant(idx, 'amount', parseInt(e.target.value) || 0)}
                    placeholder="Amount"
                    className="w-24 px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-sm font-semibold"
                  />
                )}
                {splitMode === 'equal' && (
                  <span className="text-sm font-semibold text-slate-700 w-20 text-right">
                    {formatMoney(equalAmounts[idx] || 0)}
                  </span>
                )}
                <button
                  onClick={() => removeParticipant(idx)}
                  disabled={participants.length === 1}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-error-500 disabled:opacity-30"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addParticipant}
            className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 mb-5"
          >
            <Plus className="h-4 w-4" /> Add participant
          </button>

          {/* Summary */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Bill Total</span>
              <span className="font-bold text-slate-900">{formatMoney(totalNum)}</span>
            </div>
            {splitMode === 'custom' && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Allocated</span>
                <span className={`font-bold ${customRemaining === 0 ? 'text-success-600' : 'text-amber-600'}`}>
                  {formatMoney(customTotal)}
                </span>
              </div>
            )}
            {splitMode === 'custom' && customRemaining !== 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Remaining</span>
                <span className="font-bold text-amber-600">{formatMoney(customRemaining)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
              <span className="text-slate-500">Participants</span>
              <span className="font-bold text-slate-900">{participants.filter((p) => p.name.trim()).length + 1}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={handleCreate}
              disabled={!canProceedStep3() || creating}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
            >
              {creating ? 'Creating...' : 'Create Split'} <CheckCircle2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SuccessView({ split, merchant, onComplete }: { split: Split; merchant: Merchant | null; onComplete: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 animate-slide-up">
      <div className="text-center mb-8">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-success-400 to-success-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-success-500/30">
          <CheckCircle2 className="h-10 w-10 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Split Created!</h1>
        <p className="text-slate-500">Your split is now active. Share the link with participants to start collecting.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
          <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center">
            <Receipt className="h-6 w-6 text-slate-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900">{split.title}</h3>
            <p className="text-xs text-slate-400">Ref: {split.ref_code}</p>
          </div>
          <span className="text-lg font-extrabold text-slate-900">{formatMoney(split.total_amount)}</span>
        </div>

        {merchant && (
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-slate-500">Destination</span>
            <span className="font-medium text-slate-900">{merchant.display_name}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-slate-500">Due Date</span>
          <span className="font-medium text-slate-900">{formatDateTime(split.due_at)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Participants</span>
          <span className="font-medium text-slate-900">{split.participant_count} people</span>
        </div>
      </div>

      <div className="mb-6"><TrustStrip merchantName={merchant?.display_name} destinationId={merchant?.destination_id} /></div>

      <div className="p-4 rounded-xl bg-primary-50 border border-primary-100 mb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <Share2 className="h-4 w-4 text-primary-600" />
          <span className="text-sm font-bold text-primary-900">Share Link</span>
        </div>
        <p className="text-xs text-primary-700 font-mono break-all bg-white rounded-lg px-3 py-2">
          lumo-split.app/pay/{split.ref_code}
        </p>
      </div>

      <button
        onClick={onComplete}
        className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-xl text-sm font-bold transition-all"
      >
        View Split Details
      </button>
    </div>
  );
}
