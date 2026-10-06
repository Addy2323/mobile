import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Check,
  Users,
  DollarSign,
  Receipt,
  Share2,
  Copy,
  QrCode,
  MessageCircle,
  Plus,
  Trash2,
  Utensils,
  Hotel,
  Car,
  Zap,
  Gift,
  PartyPopper,
  ShoppingBag,
  MoreHorizontal,
  Search,
} from 'lucide-react';
import { supabase, type Split } from '@/lib/supabase';
import { formatMoney } from '@/lib/utils';
import { getTranslation, type Language } from '@/lib/i18n';
import { BottomSheet } from '../components/BottomSheet';

interface CreateSplitScreenProps {
  onComplete: (split: Split) => void;
  onCancel: () => void;
  language: Language;
}

type SplitMethod = 'equal' | 'amount' | 'items' | 'payFirst' | 'payFriend';

interface Contact {
  id: string;
  name: string;
  phone: string;
  selected: boolean;
  amount?: number;
}

const INITIAL_CONTACTS: Contact[] = [
  { id: '1', name: 'Kelvin', phone: '+255 712 345 678', selected: true },
  { id: '2', name: 'Asia', phone: '+255 756 432 111', selected: true },
  { id: '3', name: 'Joseph', phone: '+255 784 321 987', selected: true },
  { id: '4', name: 'Ado', phone: '+255 716 555 123', selected: true },
];

export const CreateSplitScreen: React.FC<CreateSplitScreenProps> = ({ onComplete, onCancel, language }) => {
  const [step, setStep] = useState<number>(1);
  const [category, setCategory] = useState<string>('Food & Drinks');
  const [title, setTitle] = useState<string>('Dinner at The View');
  const [totalAmount, setTotalAmount] = useState<string>('120000');
  const [method, setMethod] = useState<SplitMethod>('equal');
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [items, setItems] = useState([
    { id: '1', name: 'Burger', price: 30000, assignedTo: 'Kelvin' },
    { id: '2', name: 'Pizza', price: 25000, assignedTo: 'Asia' },
    { id: '3', name: 'Chicken', price: 35000, assignedTo: 'Joseph' },
    { id: '4', name: 'Soda & Drinks', price: 30000, assignedTo: 'You' },
  ]);

  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const [createdSplit, setCreatedSplit] = useState<Split | null>(null);
  const [copied, setCopied] = useState(false);

  const t = (key: any) => getTranslation(key, language);

  const categories = [
    { name: 'Food & Drinks', icon: <Utensils className="w-5 h-5" />, bg: 'bg-orange-50 text-orange-600' },
    { name: 'Hotel', icon: <Hotel className="w-5 h-5" />, bg: 'bg-blue-50 text-blue-600' },
    { name: 'Transport', icon: <Car className="w-5 h-5" />, bg: 'bg-purple-50 text-purple-600' },
    { name: 'Bills', icon: <Zap className="w-5 h-5" />, bg: 'bg-emerald-50 text-emerald-600' },
    { name: 'Gift', icon: <Gift className="w-5 h-5" />, bg: 'bg-rose-50 text-rose-600' },
    { name: 'Event', icon: <PartyPopper className="w-5 h-5" />, bg: 'bg-indigo-50 text-indigo-600' },
    { name: 'Shopping', icon: <ShoppingBag className="w-5 h-5" />, bg: 'bg-pink-50 text-pink-600' },
    { name: 'Other', icon: <MoreHorizontal className="w-5 h-5" />, bg: 'bg-slate-50 text-slate-600' },
  ];

  const selectedContacts = contacts.filter((c) => c.selected);
  const totalPeople = selectedContacts.length + 1; // Organizer + selected friends
  const parsedAmount = parseFloat(totalAmount) || 0;
  const equalShare = parsedAmount > 0 ? Math.round(parsedAmount / totalPeople) : 0;

  const toggleContact = (id: string) => {
    setContacts(
      contacts.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleAddCustomContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim()) return;
    const newC: Contact = {
      id: Date.now().toString(),
      name: newContactName,
      phone: newContactPhone || '+255 700 000 000',
      selected: true,
    };
    setContacts([...contacts, newC]);
    setNewContactName('');
    setNewContactPhone('');
    setIsAddingContact(false);
  };

  const handleCreateSplit = async () => {
    const refCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const organizerName = localStorage.getItem('lumo_user_name') || 'Given Mhema';
    const organizerPhone = localStorage.getItem('lumo_user_phone') || '+255 754 123 456';

    const newSplitPayload = {
      title: title || 'Split Bill',
      category,
      currency: 'TZS',
      total_amount: parsedAmount,
      mode: method,
      organizer_name: organizerName,
      organizer_phone: organizerPhone,
      status: 'Collecting',
      settlement_percent: 0,
      amount_paid: 0,
      participant_count: totalPeople,
      ref_code: refCode,
    };

    try {
      const { data, error } = await supabase.from('splits').insert(newSplitPayload);
      if (error) {
        console.error('Split creation error:', error);
      }

      const splitObj: Split = data ? (Array.isArray(data) ? data[0] : data) : {
        id: 'split_' + Date.now(),
        ...newSplitPayload,
        due_at: null,
        note: null,
        merchant_id: null,
        created_at: new Date().toISOString(),
      };

      // Also insert participants
      const participantRows = [
        {
          split_id: splitObj.id,
          name: organizerName + ' (You)',
          phone: organizerPhone,
          allocation_amount: equalShare,
          amount_paid: equalShare, // Organizer share recorded
          status: 'Paid',
          is_organizer: true,
        },
        ...selectedContacts.map((c) => ({
          split_id: splitObj.id,
          name: c.name,
          phone: c.phone,
          allocation_amount: equalShare,
          amount_paid: 0,
          status: 'Pending',
          is_organizer: false,
        })),
      ];

      await supabase.from('split_participants').insert(participantRows);

      setCreatedSplit(splitObj);
      setStep(6); // Move to Share screen
    } catch (err) {
      console.error('Failed creating split:', err);
    }
  };

  const shareUrl = createdSplit
    ? `${window.location.origin}/s/${createdSplit.ref_code}`
    : `https://lumo.co.tz/s/BH7K2`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col justify-between p-4 pb-safe no-tap-highlight">
      {/* Step Indicator Header */}
      {step < 6 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <button
              onClick={() => (step === 1 ? onCancel() : setStep(step - 1))}
              className="p-1.5 -ml-1 text-slate-600 rounded-full hover:bg-slate-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider">
              Step {step} of 5
            </span>
            <div className="w-6" />
          </div>

          {/* Wizard Progress Bar */}
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* STEP 1: Select Category */}
      {step === 1 && (
        <div className="flex-1 flex flex-col justify-between py-4 space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{t('wherePaying')}</h2>
            <p className="text-xs text-slate-500 mt-1">Choose a category for this split bill.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => {
                  setCategory(cat.name);
                  setStep(2);
                }}
                className={`p-4 rounded-2xl border-2 flex items-center space-x-3 transition-all ${
                  category === cat.name
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${cat.bg}`}>{cat.icon}</div>
                <span className="font-bold text-slate-800 text-xs">{cat.name}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
          >
            {t('continue')}
          </button>
        </div>
      )}

      {/* STEP 2: Bill Details */}
      {step === 2 && (
        <div className="flex-1 flex flex-col justify-between py-4 space-y-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{t('billDetails')}</h2>
              <p className="text-xs text-slate-500 mt-1">Enter total bill details and title.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  {t('merchantName')}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('merchantPlaceholder')}
                  className="w-full px-4 py-3.5 bg-white rounded-2xl border-2 border-slate-200 focus:border-indigo-600 focus:outline-none font-bold text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  {t('totalAmount')}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                    TZS
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="120000"
                    className="w-full pl-14 pr-4 py-3.5 bg-white rounded-2xl border-2 border-slate-200 focus:border-indigo-600 focus:outline-none font-black text-xl text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep(3)}
            disabled={!totalAmount || parsedAmount <= 0}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
          >
            {t('continue')}
          </button>
        </div>
      )}

      {/* STEP 3: How to Split */}
      {step === 3 && (
        <div className="flex-1 flex flex-col justify-between py-4 space-y-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{t('howToSplit')}</h2>
              <p className="text-xs text-slate-500 mt-1">Select your preferred split allocation method.</p>
            </div>

            <div className="space-y-2.5">
              {/* Equally */}
              <div
                onClick={() => setMethod('equal')}
                className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  method === 'equal'
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{t('equally')}</h4>
                    <p className="text-xs text-slate-500">Split total bill into equal shares</p>
                  </div>
                </div>
                {method === 'equal' && <Check className="w-5 h-5 text-indigo-600" />}
              </div>

              {/* By Amount */}
              <div
                onClick={() => setMethod('amount')}
                className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  method === 'amount'
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{t('byAmount')}</h4>
                    <p className="text-xs text-slate-500">Set specific custom amount per person</p>
                  </div>
                </div>
                {method === 'amount' && <Check className="w-5 h-5 text-indigo-600" />}
              </div>

              {/* By Items */}
              <div
                onClick={() => setMethod('items')}
                className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  method === 'items'
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{t('byItems')}</h4>
                    <p className="text-xs text-slate-500">Assign individual receipt items to friends</p>
                  </div>
                </div>
                {method === 'items' && <Check className="w-5 h-5 text-indigo-600" />}
              </div>

              {/* I'll Pay First */}
              <div
                onClick={() => setMethod('payFirst')}
                className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  method === 'payFirst'
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{t('payFirst')}</h4>
                    <p className="text-xs text-slate-500">Pay full bill now, collect from friends later</p>
                  </div>
                </div>
                {method === 'payFirst' && <Check className="w-5 h-5 text-indigo-600" />}
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep(4)}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
          >
            {t('continue')}
          </button>
        </div>
      )}

      {/* STEP 4: Add Friends */}
      {step === 4 && (
        <div className="flex-1 flex flex-col justify-between py-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">{t('addFriends')}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedContacts.length} {t('peopleSelected')} (+ You)
                </p>
              </div>
              <button
                onClick={() => setIsAddingContact(true)}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl text-xs flex items-center space-x-1 hover:bg-indigo-100"
              >
                <Plus className="w-4 h-4" />
                <span>Add Contact</span>
              </button>
            </div>

            {/* Contacts List */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => toggleContact(contact.id)}
                  className={`p-3.5 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                    contact.selected
                      ? 'border-indigo-600 bg-indigo-50/50'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-600 text-white font-extrabold rounded-xl flex items-center justify-center text-sm">
                      {contact.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{contact.name}</h4>
                      <p className="text-xs text-slate-500">{contact.phone}</p>
                    </div>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                      contact.selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {contact.selected && <Check className="w-4 h-4" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(5)}
            disabled={selectedContacts.length === 0}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
          >
            {t('continue')} ({totalPeople} People Total)
          </button>
        </div>
      )}

      {/* STEP 5: Preview */}
      {step === 5 && (
        <div className="flex-1 flex flex-col justify-between py-4 space-y-4">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{t('splitPreview')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">Review before creating the split bill.</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="text-center space-y-1 pb-4 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
                <h3 className="text-3xl font-black text-slate-900">{formatMoney(parsedAmount)}</h3>
                <p className="text-xs font-bold text-indigo-600">
                  {totalPeople} people · {formatMoney(equalShare)} each
                </p>
              </div>

              {/* Participant Breakdown List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-indigo-600 text-white font-bold rounded-full flex items-center justify-center text-[10px]">
                      Y
                    </div>
                    <span>You (Organizer)</span>
                  </span>
                  <span>{formatMoney(equalShare)}</span>
                </div>

                {selectedContacts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs font-medium text-slate-700">
                    <span className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-slate-200 text-slate-600 font-bold rounded-full flex items-center justify-center text-[10px]">
                        {c.name.slice(0, 1)}
                      </div>
                      <span>{c.name}</span>
                    </span>
                    <span>{formatMoney(equalShare)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleCreateSplit}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
          >
            {t('createSplitBtn')}
          </button>
        </div>
      )}

      {/* STEP 6: Created & Share Screen */}
      {step === 6 && (
        <div className="flex-1 flex flex-col justify-between py-6 text-center space-y-6">
          <div className="my-auto space-y-6">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
              <Check className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold text-slate-900">Split Bill Created!</h2>
              <p className="text-slate-500 text-xs mt-1 max-w-xs mx-auto">
                Share this payment link with friends to collect their share.
              </p>
            </div>

            {/* Share Card */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
              <div className="p-3 bg-slate-50 rounded-2xl text-xs font-mono font-bold text-slate-700 truncate border border-slate-200">
                {shareUrl}
              </div>

              <div className="space-y-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Hey! Join and pay your share for ${title} on LUMO Split: ${shareUrl}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-md flex items-center justify-center space-x-2 text-sm transition-all"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>{t('shareViaWhatsApp')}</span>
                </a>

                <button
                  onClick={copyToClipboard}
                  className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.98] text-slate-800 font-bold rounded-2xl flex items-center justify-center space-x-2 text-xs transition-all"
                >
                  <Copy className="w-4 h-4 text-indigo-600" />
                  <span>{copied ? t('linkCopied') : t('copyLink')}</span>
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => createdSplit && onComplete(createdSplit)}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
          >
            Done & View Split Status
          </button>
        </div>
      )}

      {/* Add Contact Bottom Sheet */}
      <BottomSheet
        isOpen={isAddingContact}
        onClose={() => setIsAddingContact(false)}
        title="Add Custom Contact"
      >
        <form onSubmit={handleAddCustomContact} className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Friend's Name</label>
            <input
              type="text"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="e.g. Baraka Juma"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-600"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Phone Number</label>
            <input
              type="tel"
              inputMode="tel"
              value={newContactPhone}
              onChange={(e) => setNewContactPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-600"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow hover:bg-indigo-700 transition-colors"
          >
            Add Contact
          </button>
        </form>
      </BottomSheet>
    </div>
  );
};
