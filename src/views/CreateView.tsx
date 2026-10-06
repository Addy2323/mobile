import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bike, Calendar, Camera, Check, CheckCircle2, Copy, FileText,
  Hotel, Landmark, Link2, MessageCircle, Plus, QrCode, Receipt, ScanLine,
  Search, Share2, ShieldCheck, ShoppingBag, Smartphone, Store, Trash2, UploadCloud, Users,
  UtensilsCrossed, WalletCards, X, Gift, Zap, ReceiptText, Star, Sparkles
} from 'lucide-react';
import { supabase, type Merchant, type Split } from '@/lib/supabase';
import TrustStrip from '@/components/TrustStrip';
import { formatMoney, formatDateTime } from '@/lib/utils';
import { CategoryIcon } from '@/components/CategoryIcon';

type CreateViewProps = { onComplete: (split: Split) => void; onCancel: () => void };
type DestinationType = 'merchant' | 'reference' | 'recipient';
type SplitMode = 'equal' | 'custom' | 'items' | 'collect_later' | 'pay_friend';
type FeePayer = 'payer' | 'organizer' | 'merchant';
type ParticipantInput = { name: string; phone: string; amount: number };
type LineItem = { name: string; price: number; assignedTo: string };

const categories = [
  { id: 'food_drinks', label: 'Food & Drinks', icon: UtensilsCrossed },
  { id: 'hotel', label: 'Hotel', icon: Hotel },
  { id: 'transport', label: 'Transport', icon: Bike },
  { id: 'bills_rent', label: 'Bills & Rent', icon: Landmark },
  { id: 'gift', label: 'Gift', icon: ShoppingBag },
  { id: 'event', label: 'Event', icon: Calendar },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { id: 'other', label: 'Other', icon: FileText },
];

const contacts = [
  { name: 'Kelvin Mushi', phone: '+255 712 345 678' },
  { name: 'Asha Daniel', phone: '+255 754 222 111' },
  { name: 'Neema Joseph', phone: '+255 765 333 222' },
];

export type CreationType = 'standard' | 'pay_link' | 'birthday' | 'michango';

export type CustomTemplate = {
  id: string;
  name: string;
  category: string;
  splitMode: SplitMode;
  defaultAmount: string;
  note: string;
  icon: string;
};

const DEFAULT_TEMPLATES: CustomTemplate[] = [
  { id: 'rest_squad', name: 'Friday Squad Lunch', category: 'food_drinks', splitMode: 'items', defaultAmount: '120000', note: 'Weekly team lunch bill', icon: 'UtensilsCrossed' },
  { id: 'apt_rent', name: 'Kijitonyama House Rent', category: 'bills_rent', splitMode: 'equal', defaultAmount: '600000', note: 'Monthly rent split', icon: 'Landmark' },
  { id: 'zanzibar_trip', name: 'Zanzibar Trip Expenses', category: 'transport', splitMode: 'custom', defaultAmount: '450000', note: 'Ferry, van & lodge', icon: 'Bike' },
];

const stepLabels = ['Destination', 'Bill details', 'Method', 'Receipt review', 'People', 'Rules', 'Preview'];

export default function CreateView({ onComplete, onCancel }: CreateViewProps) {
  const [creationType, setCreationType] = useState<CreationType>('standard');
  const [step, setStep] = useState(0); // 0 = Product Selection Menu, 1+ = Product Wizard / Form
  const [activeTemplateName, setActiveTemplateName] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => {
    try {
      const stored = localStorage.getItem('lumo_custom_templates');
      return stored ? JSON.parse(stored) : DEFAULT_TEMPLATES;
    } catch {
      return DEFAULT_TEMPLATES;
    }
  });

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('food_drinks');
  const [totalAmount, setTotalAmount] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  
  // Pay Link specific state
  const [payLinkType, setPayLinkType] = useState<'fixed' | 'open'>('fixed');
  
  // Birthday specific state
  const [birthdayPerson, setBirthdayPerson] = useState('');
  const [birthdayWish, setBirthdayWish] = useState('');
  const [birthdayRevealed, setBirthdayRevealed] = useState(false);
  
  // Michango specific state
  const [michangoCause, setMichangoCause] = useState('Wedding / Harusi');
  const [publicContributors, setPublicContributors] = useState(true);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [destinationType, setDestinationType] = useState<DestinationType>('merchant');
  const [destinationReference, setDestinationReference] = useState('');
  const [recipient, setRecipient] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [participants, setParticipants] = useState<ParticipantInput[]>([{ name: '', phone: '', amount: 0 }]);
  const [organizerName, setOrganizerName] = useState('Ado Daniel');
  const [organizerPhone, setOrganizerPhone] = useState('');
  const [organizerCustomAmount, setOrganizerCustomAmount] = useState(0);
  const [items, setItems] = useState<LineItem[]>([{ name: '', price: 0, assignedTo: '' }]);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [vat, setVat] = useState(0);
  const [tip, setTip] = useState(0);
  const [splitFeesProportionally, setSplitFeesProportionally] = useState(true);
  const [receiptReviewed, setReceiptReviewed] = useState(false);
  const [reminderFrequency, setReminderFrequency] = useState('Every 2 days');
  const [reminderWording, setReminderWording] = useState('Friendly reminder: your share is waiting.');
  const [feePayer, setFeePayer] = useState<FeePayer>('payer');
  const [allowCash, setAllowCash] = useState(true);
  const [createdSplit, setCreatedSplit] = useState<Split | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [templateSavedMsg, setTemplateSavedMsg] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('lumo_custom_templates', JSON.stringify(customTemplates));
    } catch (e) {
      console.error(e);
    }
  }, [customTemplates]);

  function applyPresetTemplate(templateId: string, label: string) {
    setActiveTemplateName(`${label} Template`);
    setCreationType('standard');
    setCategory(templateId);
    
    switch (templateId) {
      case 'food_drinks':
        setTitle('Restaurant & Dining Bill');
        setTotalAmount('110000');
        setSplitMode('items');
        setItems([
          { name: 'Mains & Shared Dishes', price: 65000, assignedTo: '' },
          { name: 'Drinks & Desserts', price: 35000, assignedTo: '' },
        ]);
        setServiceCharge(5000);
        setTip(5000);
        setVat(0);
        setReceiptReviewed(true);
        break;
      case 'hotel':
        setTitle('Hotel Room & Lodging');
        setTotalAmount('250000');
        setSplitMode('equal');
        setNote('Group lodging expense');
        break;
      case 'transport':
        setTitle('Group Trip & Travel Expenses');
        setTotalAmount('180000');
        setSplitMode('equal');
        setParticipants([
          { name: 'Kelvin Mushi', phone: '+255 712 345 678', amount: 0 },
          { name: 'Asha Daniel', phone: '+255 754 222 111', amount: 0 },
        ]);
        break;
      case 'bills_rent':
        setTitle('Monthly Rent & Utilities');
        setTotalAmount('600000');
        setSplitMode('custom');
        setFeePayer('organizer');
        setNote('Fee paid by organizer for house split');
        break;
      case 'event':
        setTitle('Party & Event Budget');
        setTotalAmount('300000');
        setSplitMode('equal');
        setNote('Venue & catering split');
        break;
      case 'gift':
        setTitle('Group Gift Contribution');
        setTotalAmount('150000');
        setSplitMode('equal');
        setNote('Shared gift for celebration');
        break;
      default:
        setTitle(`${label} Bill`);
        break;
    }
    setStep(1);
  }

  function applyCustomTemplate(tpl: CustomTemplate) {
    setActiveTemplateName(tpl.name);
    setCreationType('standard');
    setTitle(tpl.name);
    setCategory(tpl.category);
    setTotalAmount(tpl.defaultAmount);
    setSplitMode(tpl.splitMode);
    setNote(tpl.note);
    setStep(1);
  }

  function saveCurrentAsTemplate() {
    if (!title.trim()) return;
    const newTpl: CustomTemplate = {
      id: `custom_${Date.now()}`,
      name: title.trim(),
      category,
      splitMode,
      defaultAmount: totalAmount || '0',
      note: note || '',
      icon: category === 'food_drinks' ? 'UtensilsCrossed' : category === 'hotel' ? 'Hotel' : category === 'transport' ? 'Bike' : category === 'bills_rent' ? 'Landmark' : 'FileText',
    };
    setCustomTemplates((prev) => [newTpl, ...prev]);
    setTemplateSavedMsg(`Saved "${title.trim()}" as a reusable template!`);
    setTimeout(() => setTemplateSavedMsg(''), 4000);
  }

  function deleteCustomTemplate(id: string) {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => { void searchMerchants(''); }, []);

  async function searchMerchants(query: string) {
    setSearchLoading(true);
    let request = supabase.from('merchants').select('*').eq('verification_status', 'VERIFIED');
    if (query) request = request.or(`display_name.ilike.%${query}%,city.ilike.%${query}%,category.ilike.%${query}%`);
    const { data } = await request.limit(20);
    if (data) setMerchants(data as Merchant[]);
    setSearchLoading(false);
  }

  const totalNum = Number(totalAmount) || 0;
  const validParticipants = participants.filter((participant) => participant.name.trim());
  const peopleCount = validParticipants.length + 1;
  const equalAmounts = useMemo(() => {
    const share = peopleCount > 0 ? Math.floor(totalNum / peopleCount) : 0;
    const remainder = totalNum - share * peopleCount;
    return Array.from({ length: peopleCount }, (_, index) => share + (index < remainder ? 1 : 0));
  }, [peopleCount, totalNum]);
  const itemSubtotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
  const itemFees = serviceCharge + vat + tip;
  const customAllocated = organizerCustomAmount + validParticipants.reduce((sum, participant) => sum + participant.amount, 0);
  const customRemaining = totalNum - customAllocated;
  const calculatedItemTotal = itemSubtotal + itemFees;
  const selectedDestinationName = selectedMerchant?.display_name || (destinationType === 'recipient' ? recipient || 'verified recipient' : destinationReference || 'verified destination');
  const shareLink = createdSplit ? `lumo.co.tz/s/${createdSplit.ref_code}` : '';

  function updateParticipant(index: number, field: keyof ParticipantInput, value: string | number) {
    setParticipants((current) => current.map((participant, participantIndex) => participantIndex === index ? { ...participant, [field]: value } : participant));
  }

  function addParticipant(contact?: { name: string; phone: string }) {
    setParticipants((current) => [...current, { name: contact?.name || '', phone: contact?.phone || '', amount: 0 }]);
  }

  function addItem() { setItems((current) => [...current, { name: '', price: 0, assignedTo: '' }]); }
  function updateItem(index: number, field: keyof LineItem, value: string | number) { setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)); }
  function removeItem(index: number) { setItems((current) => current.filter((_, itemIndex) => itemIndex !== index)); }

  function canContinue(): boolean {
    if (step === 1) return destinationType === 'merchant' ? selectedMerchant !== null : destinationType === 'recipient' ? recipient.trim().length > 0 : destinationReference.trim().length > 0;
    if (step === 2) return title.trim().length > 0 && totalNum > 0;
    if (step === 3) return splitMode !== 'items' || (items.some((item) => item.name.trim() && item.price > 0) && calculatedItemTotal === totalNum);
    if (step === 4) return receiptReviewed;
    if (step === 5) return organizerName.trim().length > 0 && validParticipants.length > 0 && (splitMode !== 'custom' || customRemaining === 0);
    if (step === 6) return true;
    return true;
  }

  function nextStep() {
    setError('');
    if (!canContinue()) {
      setError(step === 3 && splitMode === 'items' ? 'Review the items and make sure items, service charge, VAT, and tip equal the bill total.' : step === 5 && splitMode === 'custom' ? `Allocate the full bill. Remaining: ${formatMoney(customRemaining)}.` : 'Complete the required fields to continue.');
      return;
    }
    if (step === 3 && splitMode !== 'items') setStep(5);
    else setStep(Math.min(step + 1, 7));
  }

  function previousStep() {
    setError('');
    if (step === 5 && splitMode !== 'items') setStep(3);
    else setStep(Math.max(1, step - 1));
  }

  async function handleCreate() {
    if (!canContinue()) { setError('Check the preview details before creating this split.'); return; }
    setCreating(true);
    setError('');
    const participantAmounts = splitMode === 'equal'
      ? equalAmounts.slice(1)
      : splitMode === 'custom'
        ? validParticipants.map((participant) => participant.amount)
        : equalAmounts.slice(1);
    const organizerAmount = splitMode === 'equal' ? equalAmounts[0] : splitMode === 'custom' ? organizerCustomAmount : equalAmounts[0];
    const { data: splitData, error: splitError } = await supabase.from('splits').insert({
      title: title.trim(), category, total_amount: totalNum, mode: splitMode, organizer_name: organizerName.trim(), organizer_phone: organizerPhone.trim(),
      merchant_id: selectedMerchant?.id || null, status: 'ACTIVE', settlement_percent: 0, amount_paid: 0, participant_count: peopleCount,
      due_at: dueDate ? new Date(dueDate).toISOString() : null,
      note: [note.trim(), `Fee paid by ${feePayer}. ${allowCash ? 'Cash payments allowed.' : 'Cash payments not allowed.'}`].filter(Boolean).join(' '),
    }).select().maybeSingle();
    if (splitError || !splitData) { setCreating(false); setError('We could not create this split. Please try again.'); return; }
    const split = splitData as Split;
    const allParticipants = [
      { split_id: split.id, name: organizerName.trim(), phone: organizerPhone.trim() || null, allocation_amount: organizerAmount, amount_paid: 0, status: 'PENDING', is_organizer: true },
      ...validParticipants.map((participant, index) => ({ split_id: split.id, name: participant.name.trim(), phone: participant.phone.trim() || null, allocation_amount: participantAmounts[index] || 0, amount_paid: 0, status: 'PENDING', is_organizer: false })),
    ];
    const { error: participantError } = await supabase.from('split_participants').insert(allParticipants);
    if (participantError) { setCreating(false); setError('The split was created, but people could not be added. Please open it and try again.'); return; }
    await supabase.from('audit_logs').insert({ actor: organizerName.trim(), action: 'SPLIT_CREATED', entity_type: 'split', entity_id: split.id, metadata: { title: split.title, total_amount: split.total_amount, fee_payer: feePayer, receipt_reviewed: receiptReviewed } });
    setCreatedSplit(split);
    setCreating(false);
    setStep(8);
  }

  async function handleCreateDirect(type: 'pay_link' | 'birthday' | 'michango', payload: { title: string; category: string; amount: number; note: string }) {
    if (!payload.title.trim()) { setError('Please enter a title'); return; }
    setCreating(true);
    setError('');
    const { data: splitData, error: splitError } = await supabase.from('splits').insert({
      title: payload.title.trim(), category: payload.category, total_amount: payload.amount, mode: 'equal', organizer_name: organizerName.trim(), organizer_phone: organizerPhone.trim(),
      status: 'ACTIVE', settlement_percent: 0, amount_paid: 0, participant_count: 1, due_at: dueDate ? new Date(dueDate).toISOString() : null, note: payload.note,
    }).select().maybeSingle();
    if (splitError || !splitData) { setCreating(false); setError('Could not create this experience. Please try again.'); return; }
    const split = splitData as Split;
    await supabase.from('split_participants').insert({ split_id: split.id, name: organizerName.trim(), phone: organizerPhone.trim() || null, allocation_amount: payload.amount, amount_paid: 0, status: 'PENDING', is_organizer: true });
    setCreatedSplit(split);
    setCreating(false);
    setStep(8);
  }

  if (createdSplit && step === 8) return <ShareView split={createdSplit} merchant={selectedMerchant} shareLink={shareLink} copied={copied} onCopy={() => { void navigator.clipboard?.writeText(shareLink); setCopied(true); }} onComplete={() => onComplete(createdSplit)} />;

  // STEP 0: LANDING PRODUCT SELECTION MENU
  if (step === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 animate-fade-in space-y-6">
        {/* Top Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">What would you like to create?</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">Choose what you're collecting or paying for. We'll guide you through the rest.</p>
          </div>
          <button
            onClick={() => { setCreationType('standard'); setDestinationType('reference'); setDestinationReference('99123456'); setStep(1); }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-xs hover:border-slate-300 transition"
          >
            <QrCode className="h-4 w-4 text-primary-600" /> Scan QR
          </button>
        </div>

        {/* Tiered Product Cards */}
        <div className="space-y-4">
          {/* HERO PRODUCT: Split a bill */}
          <div
            onClick={() => { setCreationType('standard'); setStep(1); }}
            className="group cursor-pointer rounded-2xl border-2 border-primary-100 bg-gradient-to-r from-primary-900 to-slate-900 p-5 text-white shadow-sm hover:border-primary-400 transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-md">
                  <ReceiptText className="h-6 w-6" />
                </div>
                <div>
                  <span className="rounded-full bg-primary-400/20 px-2.5 py-0.5 text-[10px] font-bold text-primary-300 uppercase tracking-wider">Main Product</span>
                  <h2 className="text-xl font-extrabold mt-0.5">Split a Bill</h2>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-white/50 group-hover:translate-x-1 group-hover:text-white transition" />
            </div>
            <p className="mt-3 text-xs text-white/80 leading-relaxed">
              Divide a restaurant, hotel, trip, rent, event, or group expense between people.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-bold text-primary-200">
              <span className="rounded-lg bg-white/10 px-2.5 py-1">Equal Share</span>
              <span>•</span>
              <span className="rounded-lg bg-white/10 px-2.5 py-1">Custom Share</span>
              <span>•</span>
              <span className="rounded-lg bg-white/10 px-2.5 py-1">By Item Breakdown</span>
            </div>
          </div>

          {/* SECONDARY PRODUCTS GRID */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Pay Link */}
            <div
              onClick={() => { setCreationType('pay_link'); setStep(1); }}
              className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-amber-300 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 font-bold">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Pay Link</h3>
                    <p className="text-[10px] text-slate-400">Quick Payments</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:translate-x-0.5 group-hover:text-slate-600 transition" />
              </div>
              <p className="text-xs text-slate-500">Create one secure payment link for fixed or open amounts and share anywhere.</p>
            </div>

            {/* Birthday */}
            <div
              onClick={() => { setCreationType('birthday'); setStep(1); }}
              className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-purple-300 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-bold">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Birthday Fund</h3>
                    <p className="text-[10px] text-slate-400">Personal Celebration</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:translate-x-0.5 group-hover:text-slate-600 transition" />
              </div>
              <p className="text-xs text-slate-500">Collect birthday contributions and messages in one private celebration page with secret reveal.</p>
            </div>
          </div>

          {/* COMMUNITY PRODUCT: Michango */}
          <div
            onClick={() => { setCreationType('michango'); setStep(1); }}
            className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-success-300 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 font-bold">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-success-700 uppercase tracking-wider">Community Campaign</span>
                  <h3 className="text-sm font-extrabold text-slate-900">Michango Campaign</h3>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:translate-x-0.5 group-hover:text-slate-600 transition" />
            </div>
            <p className="mt-2 text-xs text-slate-500">Structured contributions with target goals, pledged vs paid progress, and closing dates for weddings, send-offs & community needs.</p>
          </div>
        </div>

        {/* Start Faster Templates */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-400">Start Faster (Category Templates)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              {[
                { id: 'food_drinks', label: 'Restaurant', icon: UtensilsCrossed },
                { id: 'hotel', label: 'Hotel', icon: Hotel },
                { id: 'transport', label: 'Trip', icon: Bike },
                { id: 'bills_rent', label: 'Rent', icon: Landmark },
                { id: 'event', label: 'Event', icon: Calendar },
                { id: 'gift', label: 'Gift', icon: ShoppingBag },
              ].map((item) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => applyPresetTemplate(item.id, item.label)}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center transition hover:border-primary-300 hover:bg-primary-50/50"
                  >
                    <IconComp className="h-4 w-4 text-slate-600" />
                    <span className="text-xs font-bold text-slate-800">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* My Saved Templates */}
          {customTemplates.length > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">My Saved Templates</p>
                <span className="text-[10px] font-bold text-slate-400">{customTemplates.length} saved</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {customTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="group relative flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 hover:border-primary-300 hover:bg-primary-50/40 transition"
                  >
                    <button
                      onClick={() => applyCustomTemplate(tpl)}
                      className="flex-1 text-left"
                    >
                      <span className="block text-xs font-bold text-slate-900 group-hover:text-primary-700">{tpl.name}</span>
                      <span className="text-[10px] text-slate-400">{tpl.defaultAmount ? `${formatMoney(Number(tpl.defaultAmount))} · ` : ''}{tpl.splitMode.replace('_', ' ')}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCustomTemplate(tpl.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-error-500 transition"
                      title="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STEP >= 1: DEDICATED PRODUCT FORMS & STEPPER WIZARD
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-fade-in space-y-6">
      {/* Back to Create menu top bar */}
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between border-b border-slate-100/80 pb-4">
        <button
          onClick={() => { setStep(0); setActiveTemplateName(null); setError(''); }}
          className="group flex items-center gap-2 rounded-xl bg-slate-100/70 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" /> Back to Create menu
        </button>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-extrabold text-slate-700 tracking-wide">
          {activeTemplateName ? activeTemplateName : creationType === 'standard' ? 'Split a Bill' : creationType === 'pay_link' ? 'Pay Link' : creationType === 'birthday' ? 'Birthday Fund' : 'Michango Campaign'}
        </span>
      </div>

      {/* Active Template Banner */}
      {activeTemplateName && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-primary-50/40 px-4 py-3 text-xs shadow-xs animate-slide-up">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600">
              <Zap className="h-4 w-4 fill-amber-500" />
            </div>
            <div>
              <span className="text-slate-500 font-semibold text-[11px] block">Active Template</span>
              <span className="font-extrabold text-amber-950 text-xs">{activeTemplateName}</span>
            </div>
          </div>
          <button
            onClick={() => setActiveTemplateName(null)}
            className="rounded-lg border border-amber-200 bg-white px-3 py-1 text-[11px] font-extrabold text-amber-800 hover:bg-amber-100/50 transition shadow-xs"
          >
            Clear Template
          </button>
        </div>
      )}

      {templateSavedMsg && (
        <div className="rounded-xl border border-success-200 bg-success-50 p-3 text-xs font-bold text-success-800 animate-slide-up">
          {templateSavedMsg}
        </div>
      )}

      {/* DEDICATED FORM: PAY LINK */}
      {creationType === 'pay_link' && (
        <Panel>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 font-bold">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Create Pay Link</h2>
              <p className="text-xs text-slate-500">Fixed or open amount payment link anyone can pay using M-Pesa / Tigo / Card.</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="block text-xs font-bold text-slate-700">Link Title / Purpose
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Design Consulting Fee or Event Ticket" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-amber-400" />
            </label>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Amount Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPayLinkType('fixed')} className={`p-3 rounded-xl border text-xs font-bold ${payLinkType === 'fixed' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600'}`}>Fixed Amount</button>
                <button onClick={() => setPayLinkType('open')} className={`p-3 rounded-xl border text-xs font-bold ${payLinkType === 'open' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600'}`}>Open (Payer decides)</button>
              </div>
            </div>
            {payLinkType === 'fixed' && (
              <label className="block text-xs font-bold text-slate-700">Fixed Amount (TZS)
                <input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="50000" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-bold outline-none focus:border-amber-400" />
              </label>
            )}
            <label className="block text-xs font-bold text-slate-700">Expiry Date (optional)
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none" />
            </label>
            <label className="block text-xs font-bold text-slate-700">Description / Instructions (optional)
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is this payment for?" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none" />
            </label>
            <button
              onClick={() => void handleCreateDirect('pay_link', { title: title || 'Pay Link Payment', category: 'other', amount: Number(totalAmount) || 0, note })}
              disabled={creating}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 p-3.5 text-sm font-bold text-white hover:bg-amber-700 transition"
            >
              {creating ? 'Generating Link...' : 'Create Pay Link & QR Code'} <CheckCircle2 className="h-4 w-4" />
            </button>
          </div>
        </Panel>
      )}

      {/* DEDICATED FORM: BIRTHDAY FUND */}
      {creationType === 'birthday' && (
        <Panel>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-bold">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Create Birthday Fund</h2>
              <p className="text-xs text-slate-500">Collect birthday contributions and private celebration wishes.</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="block text-xs font-bold text-slate-700">Birthday Person Full Name
              <input value={birthdayPerson} onChange={(e) => setBirthdayPerson(e.target.value)} placeholder="e.g. Kelvin Mushi's Birthday" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-purple-400" />
            </label>
            <label className="block text-xs font-bold text-slate-700">Birthday Celebration Date
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none" />
            </label>
            <label className="block text-xs font-bold text-slate-700">Target Gift Goal (TZS)
              <input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="200000" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-bold outline-none focus:border-purple-400" />
            </label>
            <label className="block text-xs font-bold text-slate-700">Organizer Wish / Welcome Note
              <input value={birthdayWish} onChange={(e) => setBirthdayWish(e.target.value)} placeholder="e.g. Let's get Kelvin a nice smartwatch for his 30th!" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none" />
            </label>
            <button
              onClick={() => setBirthdayRevealed(!birthdayRevealed)}
              className="flex items-center gap-3 text-left p-3 rounded-xl border border-purple-100 bg-purple-50/50"
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded border ${birthdayRevealed ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300'}`}>{birthdayRevealed && <Check className="h-3 w-3" />}</span>
              <div>
                <span className="block text-xs font-bold text-purple-950">Secret Birthday Mode</span>
                <span className="text-[11px] text-purple-700">Hide messages and total collected from recipient until reveal date.</span>
              </div>
            </button>
            <button
              onClick={() => void handleCreateDirect('birthday', { title: birthdayPerson || 'Birthday Fund', category: 'gift', amount: Number(totalAmount) || 0, note: birthdayWish })}
              disabled={creating}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 p-3.5 text-sm font-bold text-white hover:bg-purple-700 transition"
            >
              {creating ? 'Creating Fund...' : 'Create Birthday Fund & Page'} <CheckCircle2 className="h-4 w-4" />
            </button>
          </div>
        </Panel>
      )}

      {/* DEDICATED FORM: MICHANGO CAMPAIGN */}
      {creationType === 'michango' && (
        <Panel>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 font-bold">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Create Michango Campaign</h2>
              <p className="text-xs text-slate-500">Structured contributions for weddings, send-offs, and community causes.</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="block text-xs font-bold text-slate-700">Cause Type
              <select value={michangoCause} onChange={(e) => setMichangoCause(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm">
                <option value="Wedding / Harusi">Wedding / Harusi</option>
                <option value="Send-off Party">Send-off Party</option>
                <option value="Funeral Support / Msiba">Funeral Support / Msiba</option>
                <option value="Medical Assistance">Medical Assistance</option>
                <option value="Community Project">Community Project</option>
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-700">Campaign Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Asha & John Wedding Michango" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-success-400" />
            </label>
            <label className="block text-xs font-bold text-slate-700">Target Goal (TZS)
              <input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="5000000" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-bold outline-none focus:border-success-400" />
            </label>
            <label className="block text-xs font-bold text-slate-700">Closing Date
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none" />
            </label>
            <label className="block text-xs font-bold text-slate-700">Campaign Description / Details
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Details regarding payout and event" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none" />
            </label>
            <button
              onClick={() => void handleCreateDirect('michango', { title: title || `${michangoCause} Michango`, category: 'event', amount: Number(totalAmount) || 0, note: `${michangoCause}: ${note}` })}
              disabled={creating}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-success-600 p-3.5 text-sm font-bold text-white hover:bg-success-700 transition"
            >
              {creating ? 'Creating Campaign...' : 'Launch Michango Campaign'} <CheckCircle2 className="h-4 w-4" />
            </button>
          </div>
        </Panel>
      )}

      {/* DEDICATED FORM: SPLIT A BILL WIZARD */}
      {creationType === 'standard' && (
        <>
          {/* Stepper Wizard Progress */}
          <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 shadow-xs">
            <div className="flex items-center justify-between overflow-x-auto pb-1 scrollbar-none">
              {stepLabels.map((label, index) => {
                const number = index + 1;
                const visible = !(number === 4 && splitMode !== 'items');
                const isCurrent = step === number;
                const isPassed = step > number;
                return (
                  <div key={label} className={`flex min-w-max items-center gap-2 ${visible ? '' : 'opacity-30'}`}>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition-all ${
                      isCurrent
                        ? 'bg-primary-600 text-white shadow-md shadow-primary-500/25 ring-4 ring-primary-100'
                        : isPassed
                        ? 'bg-success-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {isPassed ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : number}
                    </div>
                    <span className={`text-xs font-extrabold ${isCurrent ? 'text-slate-950' : isPassed ? 'text-slate-700' : 'text-slate-400'}`}>
                      {label}
                    </span>
                    {number < 7 && (
                      <div className={`mx-2 h-1 w-6 rounded-full sm:w-10 transition-all ${isPassed ? 'bg-success-400' : 'bg-slate-200/80'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {step === 1 && <DestinationStep destinationType={destinationType} setDestinationType={setDestinationType} selectedMerchant={selectedMerchant} setSelectedMerchant={setSelectedMerchant} merchants={merchants} searchQuery={searchQuery} onSearch={(value) => { setSearchQuery(value); void searchMerchants(value); }} searchLoading={searchLoading} destinationReference={destinationReference} setDestinationReference={setDestinationReference} recipient={recipient} setRecipient={setRecipient} />}
          {step === 2 && <DetailsStep title={title} setTitle={setTitle} category={category} setCategory={setCategory} totalAmount={totalAmount} setTotalAmount={setTotalAmount} photoName={photoName} setPhotoName={setPhotoName} note={note} setNote={setNote} onSaveAsTemplate={saveCurrentAsTemplate} />}
          {step === 3 && <MethodStep splitMode={splitMode} setSplitMode={setSplitMode} items={items} addItem={addItem} updateItem={updateItem} removeItem={removeItem} serviceCharge={serviceCharge} setServiceCharge={setServiceCharge} vat={vat} setVat={setVat} tip={tip} setTip={setTip} splitFeesProportionally={splitFeesProportionally} setSplitFeesProportionally={setSplitFeesProportionally} totalNum={totalNum} calculatedItemTotal={calculatedItemTotal} />}
          {step === 4 && <ReceiptReviewStep items={items} serviceCharge={serviceCharge} vat={vat} tip={tip} totalNum={totalNum} receiptReviewed={receiptReviewed} onReview={() => setReceiptReviewed(true)} />}
          {step === 5 && <PeopleStep organizerName={organizerName} setOrganizerName={setOrganizerName} organizerPhone={organizerPhone} setOrganizerPhone={setOrganizerPhone} participants={participants} updateParticipant={updateParticipant} addParticipant={addParticipant} removeParticipant={(index) => setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index))} splitMode={splitMode} organizerCustomAmount={organizerCustomAmount} setOrganizerCustomAmount={setOrganizerCustomAmount} equalAmounts={equalAmounts} totalNum={totalNum} customRemaining={customRemaining} />}
          {step === 6 && <RulesStep dueDate={dueDate} setDueDate={setDueDate} reminderFrequency={reminderFrequency} setReminderFrequency={setReminderFrequency} reminderWording={reminderWording} setReminderWording={setReminderWording} feePayer={feePayer} setFeePayer={setFeePayer} allowCash={allowCash} setAllowCash={setAllowCash} />}
          {step === 7 && <PreviewStep title={title} totalNum={totalNum} selectedDestinationName={selectedDestinationName} selectedMerchant={selectedMerchant} splitMode={splitMode} peopleCount={peopleCount} equalAmounts={equalAmounts} customRemaining={customRemaining} customAllocated={customAllocated} feePayer={feePayer} allowCash={allowCash} note={note} calculatedItemTotal={calculatedItemTotal} onCreate={handleCreate} creating={creating} onSaveAsTemplate={saveCurrentAsTemplate} />}

          {step < 7 && (
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                onClick={step === 1 ? () => setStep(0) : previousStep}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-2xs"
              >
                {step === 1 ? 'Cancel' : <><ArrowLeft className="h-4 w-4" /> Back</>}
              </button>
              {step !== 7 && (
                <button
                  onClick={nextStep}
                  className="flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-xs font-extrabold text-white transition hover:bg-primary-700 shadow-md shadow-primary-600/20"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="mt-4 rounded-xl border border-error-100 bg-error-50 px-4 py-3 text-sm font-semibold text-error-700">{error}</p>}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 animate-slide-up">{children}</div>; }

function QrScannerModal({
  isOpen,
  onClose,
  onScanComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (payload: { type: DestinationType; value: string; merchantName?: string; category?: string; amount?: string }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedValue, setDetectedValue] = useState<string | null>(null);

  const processPayload = (raw: string) => {
    // Extract control number or numeric string (e.g. 68119496)
    const matchedDigits = raw.match(/\d{6,12}/);
    const parsedRef = matchedDigits ? matchedDigits[0] : raw.replace(/[^\w]/g, '') || '68119496';
    setDetectedValue(parsedRef);

    setTimeout(() => {
      onScanComplete({
        type: 'reference',
        value: parsedRef,
        merchantName: raw.toLowerCase().includes('afrotech') ? 'AFROTECH ENTERPRISES' : undefined,
        category: 'bills_rent'
      });
      onClose();
    }, 450);
  };

  useEffect(() => {
    if (!isOpen) return;

    let currentStream: MediaStream | null = null;
    let detectorInterval: NodeJS.Timeout | null = null;

    const startCamera = async () => {
      try {
        setCameraError(null);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('WebRTC camera API is not supported in this browser environment.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } }
        });
        currentStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);

          // Native WebRTC BarcodeDetector scanning loop
          if ('BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
              detectorInterval = setInterval(async () => {
                if (videoRef.current && videoRef.current.readyState === 4) {
                  try {
                    const barcodes = await detector.detect(videoRef.current);
                    if (barcodes && barcodes.length > 0) {
                      const rawVal = barcodes[0].rawValue;
                      if (rawVal) {
                        if (detectorInterval) clearInterval(detectorInterval);
                        processPayload(rawVal);
                      }
                    }
                  } catch {
                    // Frame detection error ignored
                  }
                }
              }, 200);
            } catch (err) {
              console.warn('BarcodeDetector error:', err);
            }
          }
        }
      } catch (err: unknown) {
        console.warn('WebRTC Camera error:', err);
        const errMsg = err instanceof Error ? err.message : 'Camera permissions needed or no video device detected.';
        setCameraError(errMsg);
      }
    };

    void startCamera();

    return () => {
      if (detectorInterval) clearInterval(detectorInterval);
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-scale-up border border-slate-100 text-center flex flex-col items-center">
        {/* Header */}
        <div className="flex w-full items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 text-left">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-700 shadow-xs">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-950">Scan Payment QR Code</h3>
              <p className="text-[10px] font-medium text-slate-500">Auto-Detecting Live Feed</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Real WebRTC Viewfinder Box */}
        <div
          onClick={() => processPayload('68119496')}
          className="mt-6 relative w-full aspect-square max-w-[260px] mx-auto rounded-2xl bg-slate-950 flex flex-col items-center justify-center overflow-hidden border-2 border-slate-800 shadow-2xl cursor-pointer group"
        >
          {/* Live Video Stream */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
          />

          {/* Detection Success Flash */}
          {detectedValue && (
            <div className="absolute inset-0 bg-emerald-600/90 z-30 flex flex-col items-center justify-center text-white animate-fade-in">
              <CheckCircle2 className="h-12 w-12 text-white animate-bounce" />
              <p className="mt-2 text-xs font-black">QR Detected!</p>
              <p className="text-sm font-mono font-extrabold">{detectedValue}</p>
            </div>
          )}

          {/* Camera Loading / Fallback Indicator */}
          {!cameraActive && !detectedValue && (
            <div className="z-10 flex flex-col items-center px-4 text-center">
              <Camera className="h-8 w-8 text-slate-500 animate-pulse mb-2" />
              <p className="text-xs font-bold text-slate-300">{cameraError ? 'Camera Access Required' : 'Starting camera...'}</p>
              {cameraError && <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">{cameraError}</p>}
            </div>
          )}

          {/* Corner Framing Brackets */}
          <div className="absolute top-3 left-3 h-6 w-6 border-t-2 border-l-2 border-primary-400 rounded-tl-md z-20" />
          <div className="absolute top-3 right-3 h-6 w-6 border-t-2 border-r-2 border-primary-400 rounded-tr-md z-20" />
          <div className="absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-primary-400 rounded-bl-md z-20" />
          <div className="absolute bottom-3 right-3 h-6 w-6 border-b-2 border-r-2 border-primary-400 rounded-br-md z-20" />

          {/* Laser Scanner Line */}
          <div className="absolute inset-x-3 top-0 bottom-0 pointer-events-none flex flex-col justify-center z-20">
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary-400 to-transparent shadow-md shadow-primary-400/80 animate-pulse" />
          </div>

          {/* Tap-to-Scan Frame Overlay hint */}
          <div className="absolute bottom-2 inset-x-2 z-20 bg-slate-900/80 backdrop-blur-xs py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition text-[9px] font-extrabold text-primary-300">
            Click frame to capture code (e.g. 68119496)
          </div>
        </div>

        {/* Status Indicator */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Real-time QR auto-detector active</span>
        </div>
      </div>
    </div>
  );
}

function DestinationStep({ destinationType, setDestinationType, selectedMerchant, setSelectedMerchant, merchants, searchQuery, onSearch, searchLoading, destinationReference, setDestinationReference, recipient, setRecipient }: { destinationType: DestinationType; setDestinationType: (value: DestinationType) => void; selectedMerchant: Merchant | null; setSelectedMerchant: (value: Merchant | null) => void; merchants: Merchant[]; searchQuery: string; onSearch: (value: string) => void; searchLoading: boolean; destinationReference: string; setDestinationReference: (value: string) => void; recipient: string; setRecipient: (value: string) => void }) {
  const [invitedMerchant, setInvitedMerchant] = useState(false);
  const [customPhone, setCustomPhone] = useState('');
  const [isCustomRecipient, setIsCustomRecipient] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Smart Control Number presets & lookup logic
  const controlPresets = [
    { num: '99123456', name: 'TANESCO Tanzania', psp: 'GePG / Selcom Gateway', category: 'Electricity Bill', defaultAmount: '120000' },
    { num: '88234567', name: 'Golden Hotel Lipa Namba', psp: 'Tigo Pesa Merchant', category: 'Hospitality & Dining', defaultAmount: '' },
    { num: '77345678', name: 'DAWASA Water Utility', psp: 'NMB Direct Pay', category: 'Water Utility', defaultAmount: '45000' },
  ];

  const matchedControl = controlPresets.find(p => p.num === destinationReference.replace(/\s+/g, '')) || (
    destinationReference.trim().length >= 7 ? {
      num: destinationReference.trim(),
      name: `Control Reference #${destinationReference.trim()}`,
      psp: 'Tanzania Interbank Settlement System (TISS)',
      category: 'Government & Utility Biller',
      defaultAmount: ''
    } : null
  );

  // Mobile Money Carrier auto-detection logic
  const detectCarrier = (phone: string) => {
    const clean = phone.replace(/[^\d]/g, '');
    if (clean.startsWith('25575') || clean.startsWith('25576') || clean.startsWith('075') || clean.startsWith('076') || clean.startsWith('074')) {
      return { name: 'Vodacom M-Pesa', color: 'bg-red-50 text-red-700 border-red-200', icon: Zap };
    }
    if (clean.startsWith('25571') || clean.startsWith('25565') || clean.startsWith('071') || clean.startsWith('065') || clean.startsWith('067')) {
      return { name: 'Tigo Pesa', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Zap };
    }
    if (clean.startsWith('25578') || clean.startsWith('25568') || clean.startsWith('078') || clean.startsWith('068')) {
      return { name: 'Airtel Money', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: Zap };
    }
    if (clean.startsWith('25562') || clean.startsWith('062')) {
      return { name: 'Halopesa', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Zap };
    }
    return { name: 'Mobile Money Wallet', color: 'bg-slate-50 text-slate-700 border-slate-200', icon: ShieldCheck };
  };

  const carrierInfo = detectCarrier(isCustomRecipient ? customPhone : recipient);

  const presetRecipients = [
    { name: 'Asha Daniel', phone: '+255 754 222 111', carrier: 'Vodacom M-Pesa' },
    { name: 'Kelvin Mushi', phone: '+255 712 345 678', carrier: 'Tigo Pesa' },
    { name: 'Fatma Hassan', phone: '+255 784 999 888', carrier: 'Airtel Money' },
  ];

  const handleScanPayload = (payload: { type: DestinationType; value: string; merchantName?: string; category?: string; amount?: string }) => {
    setDestinationType(payload.type);
    if (payload.type === 'reference') {
      setDestinationReference(payload.value);
    } else if (payload.type === 'merchant') {
      const found = merchants.find(m => m.display_name.toLowerCase().includes(payload.value.toLowerCase()));
      if (found) {
        setSelectedMerchant(found);
      } else if (merchants.length > 0) {
        setSelectedMerchant(merchants[0]);
      }
    }
  };

  return (
    <Panel>
      <QrScannerModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        onScanComplete={handleScanPayload}
      />

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-950">Choose a destination</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">Payments route directly to a verified merchant or recipient account.</p>
        </div>

        <button
          type="button"
          onClick={() => setShowQrModal(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-primary-600/20 hover:from-primary-700 hover:to-indigo-700 transition"
        >
          <QrCode className="h-4 w-4" /> Scan Payment QR Code
        </button>
      </div>

      {/* Destination Tabs */}
      <div className="grid grid-cols-3 gap-2.5">
        {([
          ['merchant', Store, 'Merchant', 'Verified Business'],
          ['reference', ScanLine, 'Lipa / Control', 'Invoice No.'],
          ['recipient', Users, 'Recipient', 'Direct Person']
        ] as const).map(([id, Icon, label, desc]) => {
          const active = destinationType === id;
          return (
            <button
              key={id}
              onClick={() => setDestinationType(id)}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-3.5 text-center transition-all ${
                active
                  ? 'border-primary-500 bg-gradient-to-b from-primary-50/80 to-primary-100/30 text-primary-900 shadow-sm ring-2 ring-primary-500/20'
                  : 'border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                active ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'
              }`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <span className="block text-xs font-extrabold text-slate-900">{label}</span>
                <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">{desc}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MERCHANT */}
      {destinationType === 'merchant' && (
        <div className="mt-6">
          {selectedMerchant ? (
            <div className="flex items-center justify-between rounded-2xl border border-primary-200 bg-primary-50/70 p-4 shadow-xs animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-xs text-primary-600">
                  <CategoryIcon category={selectedMerchant.category} className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-slate-900 text-sm">{selectedMerchant.display_name}</p>
                    <span className="rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-extrabold text-success-700 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{selectedMerchant.city || 'Tanzania'} · ID: <span className="font-mono text-slate-600 font-bold">{selectedMerchant.destination_id}</span></p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMerchant(null)}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => { setInvitedMerchant(false); onSearch(event.target.value); }}
                  placeholder="Search verified merchants (e.g. Golden Hotel, Shoppers)"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/40 py-3 pl-10 pr-4 text-xs font-semibold outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 transition"
                />
              </div>

              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {searchLoading ? (
                  <div className="space-y-2">
                    <div className="h-14 rounded-2xl shimmer" />
                    <div className="h-14 rounded-2xl shimmer" />
                  </div>
                ) : merchants.length > 0 ? (
                  merchants.map((merchant) => (
                    <button
                      key={merchant.id}
                      onClick={() => setSelectedMerchant(merchant)}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 text-left transition hover:border-primary-300 hover:bg-primary-50/30 hover:shadow-xs"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-primary-100 group-hover:text-primary-700">
                        <CategoryIcon category={merchant.category} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-extrabold text-slate-900">{merchant.display_name}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500 uppercase">{merchant.category}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">{merchant.city || 'Tanzania'} · Verified destination</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
                    </button>
                  ))
                ) : searchQuery ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-center">
                    <p className="text-xs font-extrabold text-amber-900">We couldn't find "{searchQuery}" as a verified merchant.</p>
                    <p className="mt-1 text-[11px] text-amber-700">Unverified accounts cannot accept direct automated split payouts.</p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setInvitedMerchant(true)}
                        className="flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 transition"
                      >
                        {invitedMerchant ? <><Check className="h-3.5 w-3.5" /> Invitation Sent</> : 'Invite this merchant'}
                      </button>
                      <button
                        onClick={() => { setDestinationType('reference'); setDestinationReference('99123456'); }}
                        className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition"
                      >
                        Use Lipa / Control No.
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: LIPA / CONTROL NUMBER SMART LOOKUP */}
      {destinationType === 'reference' && (
        <div className="mt-6 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-slate-800">Lipa Namba or Control Number</label>
              <span className="text-[11px] font-semibold text-slate-400">Quick Test Presets:</span>
            </div>

            {/* Presets Toolbar */}
            <div className="mt-2 flex flex-wrap gap-2">
              {controlPresets.map((preset) => (
                <button
                  key={preset.num}
                  type="button"
                  onClick={() => setDestinationReference(preset.num)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                    destinationReference.replace(/\s+/g, '') === preset.num
                      ? 'border-primary-500 bg-primary-50 text-primary-800 shadow-2xs'
                      : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <ScanLine className="h-3.5 w-3.5 text-primary-600" />
                  <span className="font-mono">{preset.num}</span>
                  <span className="text-[10px] text-slate-400">({preset.name.split(' ')[0]})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/40 px-3.5 py-3 focus-within:border-primary-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary-500/10 transition">
            <ScanLine className="h-4 w-4 text-slate-400" />
            <input
              value={destinationReference}
              onChange={(event) => setDestinationReference(event.target.value)}
              placeholder="Enter or scan 8-digit control number (e.g. 99123456)"
              className="w-full text-xs font-semibold outline-none bg-transparent font-mono tracking-wider"
            />
            {destinationReference && (
              <button onClick={() => setDestinationReference('')} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Real-time Biller Verification Preview Card */}
          {matchedControl ? (
            <div className="rounded-2xl border border-success-200 bg-gradient-to-r from-success-50/60 via-emerald-50/40 to-teal-50/30 p-4 text-xs animate-slide-up shadow-2xs">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-500 text-white shadow-xs">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-sm">{matchedControl.name}</span>
                      <span className="rounded-full bg-success-100 px-2 py-0.5 text-[9px] font-extrabold text-success-800">
                        Verified Biller
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-600">
                      Provider: <span className="font-semibold text-slate-800">{matchedControl.psp}</span> · Category: {matchedControl.category}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : destinationReference.trim().length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Checking control number with Tanzania Payment Service Provider (GePG / NMB)...</span>
            </div>
          ) : (
            <p className="text-[11px] font-medium text-slate-400">
              The merchant name and payment details will be validated automatically via PSP integration.
            </p>
          )}
        </div>
      )}

      {/* TAB 3: VERIFIED RECIPIENT SELECTOR */}
      {destinationType === 'recipient' && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-extrabold text-slate-800">Select Recipient Contact</label>
            <button
              type="button"
              onClick={() => {
                setIsCustomRecipient(!isCustomRecipient);
                if (!isCustomRecipient) setRecipient('');
              }}
              className="text-[11px] font-extrabold text-primary-700 hover:underline"
            >
              {isCustomRecipient ? 'Select Saved Contact' : '+ Add New Phone Number'}
            </button>
          </div>

          {!isCustomRecipient ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {presetRecipients.map((item) => {
                const fullValue = `${item.name} · ${item.phone}`;
                const active = recipient === fullValue;
                return (
                  <button
                    key={item.phone}
                    type="button"
                    onClick={() => setRecipient(fullValue)}
                    className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${
                      active
                        ? 'border-primary-500 bg-primary-50/70 shadow-2xs ring-2 ring-primary-500/20'
                        : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-extrabold text-xs text-slate-900">{item.name}</span>
                      {active && <Check className="h-4 w-4 text-primary-600" />}
                    </div>
                    <span className="mt-1 text-[11px] font-mono font-semibold text-slate-500">{item.phone}</span>
                    <span className="mt-2 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                      {item.carrier}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3 animate-fade-in">
              <div className="relative flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/40 px-3.5 py-3 focus-within:border-primary-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary-500/10 transition">
                <Users className="h-4 w-4 text-slate-400" />
                <input
                  value={customPhone}
                  onChange={(event) => {
                    const val = event.target.value;
                    setCustomPhone(val);
                    setRecipient(val ? `Direct Recipient · ${val}` : '');
                  }}
                  placeholder="Enter phone number (e.g. 0754 222 111)"
                  className="w-full text-xs font-semibold outline-none bg-transparent"
                />
              </div>

              {customPhone.length >= 4 && (
                <div className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold ${carrierInfo.color} animate-slide-up`}>
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Carrier Auto-Detected: <strong className="font-black">{carrierInfo.name}</strong> · Account Verified</span>
                </div>
              )}
            </div>
          )}

          {recipient && (
            <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-3.5 text-xs text-primary-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary-600" />
                <span>Active Recipient: <strong className="font-black">{recipient}</strong></span>
              </div>
              <button onClick={() => setRecipient('')} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function DetailsStep({ title, setTitle, category, setCategory, totalAmount, setTotalAmount, photoName, setPhotoName, note, setNote, onSaveAsTemplate }: { title: string; setTitle: (value: string) => void; category: string; setCategory: (value: string) => void; totalAmount: string; setTotalAmount: (value: string) => void; photoName: string; setPhotoName: (value: string) => void; note: string; setNote: (value: string) => void; onSaveAsTemplate: () => void }) {
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-950">Bill details</h1>
          <p className="mt-1 text-sm text-slate-500">Add the details everyone will see when they pay.</p>
        </div>
        <button
          onClick={onSaveAsTemplate}
          disabled={!title.trim()}
          className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-40 transition"
        >
          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" /> Save as Template
        </button>
      </div>
      <label className="mt-6 block text-sm font-bold text-slate-700">Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Dinner at The View" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-primary-400" /></label><div className="mt-5"><p className="text-sm font-bold text-slate-700">Category</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{categories.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setCategory(id)} className={`flex items-center gap-2 rounded-lg border p-3 text-left text-xs font-bold ${category === id ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500'}`}><Icon className="h-4 w-4" />{label}</button>)}</div></div><label className="mt-5 block text-sm font-bold text-slate-700">Total amount (TZS)<input type="number" min="1" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} placeholder="120000" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm font-bold outline-none focus:border-primary-400" />{totalAmount && <span className="mt-1 block text-xs text-slate-400">{formatMoney(Number(totalAmount) || 0)}</span>}</label><label className="mt-5 block text-sm font-bold text-slate-700">Receipt photo (optional)<span className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm font-medium text-slate-500"><Receipt className="h-4 w-4" />{photoName || 'Attach a receipt'}<input type="file" accept="image/*" onChange={(event) => setPhotoName(event.target.files?.[0]?.name || '')} className="hidden" /></span></label><label className="mt-5 block text-sm font-bold text-slate-700">Note (optional)<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What is this bill for?" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-primary-400" /></label>
    </Panel>
  );
}

function MethodStep({ splitMode, setSplitMode, items, addItem, updateItem, removeItem, serviceCharge, setServiceCharge, vat, setVat, tip, setTip, splitFeesProportionally, setSplitFeesProportionally, totalNum, calculatedItemTotal }: { splitMode: SplitMode; setSplitMode: (value: SplitMode) => void; items: LineItem[]; addItem: () => void; updateItem: (index: number, field: keyof LineItem, value: string | number) => void; removeItem: (index: number) => void; serviceCharge: number; setServiceCharge: (value: number) => void; vat: number; setVat: (value: number) => void; tip: number; setTip: (value: number) => void; splitFeesProportionally: boolean; setSplitFeesProportionally: (value: boolean) => void; totalNum: number; calculatedItemTotal: number }) { const methods: [SplitMode, string, string][] = [['equal', 'Equally', 'Everyone pays the same share'], ['custom', 'By amount', 'Set a share for each person'], ['items', 'By items', 'Add items and review the receipt'], ['collect_later', "I'll pay first", 'Collect from friends later'], ['pay_friend', 'Pay for a friend', 'Cover selected people']]; return <Panel><h1 className="text-xl font-extrabold text-slate-950">How should this bill split?</h1><div className="mt-6 space-y-2">{methods.map(([id, label, description]) => <button key={id} onClick={() => setSplitMode(id)} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left ${splitMode === id ? 'border-primary-300 bg-primary-50' : 'border-slate-200'}`}><span className={`mt-0.5 h-4 w-4 rounded-full border-4 ${splitMode === id ? 'border-primary-600' : 'border-slate-300'}`} /><span><span className="block text-sm font-bold text-slate-900">{label}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span></button>)}</div>{splitMode === 'items' && <div className="mt-6 border-t border-slate-100 pt-5"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-bold text-slate-900">Receipt items</p><p className="text-xs text-slate-400">Add or correct the mock scan results.</p></div><button onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-primary-600"><Plus className="h-4 w-4" /> Add item</button></div><div className="space-y-2">{items.map((item, index) => <div key={index} className="flex gap-2"><input value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} placeholder="Item name" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" /><input type="number" value={item.price || ''} onChange={(event) => updateItem(index, 'price', Number(event.target.value) || 0)} placeholder="Price" className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button onClick={() => removeItem(index)} disabled={items.length === 1} className="p-2 text-slate-300 hover:text-error-500 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div>)}</div><div className="mt-4 grid grid-cols-3 gap-2">{[['Service charge', serviceCharge, setServiceCharge], ['VAT', vat, setVat], ['Tip', tip, setTip]].map(([label, value, setter]) => <label key={label as string} className="text-xs font-bold text-slate-500">{label as string}<input type="number" value={value as number || ''} onChange={(event) => (setter as (value: number) => void)(Number(event.target.value) || 0)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-900" /></label>)}</div><button onClick={() => setSplitFeesProportionally(!splitFeesProportionally)} className="mt-4 text-xs font-bold text-primary-600">Fees split {splitFeesProportionally ? 'proportionally' : 'equally'} · Change</button><div className={`mt-4 rounded-lg p-3 text-xs font-bold ${calculatedItemTotal === totalNum ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>Receipt total: {formatMoney(calculatedItemTotal)} · Bill total: {formatMoney(totalNum)}</div></div>}</Panel>; }

function ReceiptReviewStep({ items, serviceCharge, vat, tip, totalNum, receiptReviewed, onReview }: { items: LineItem[]; serviceCharge: number; vat: number; tip: number; totalNum: number; receiptReviewed: boolean; onReview: () => void }) { return <Panel><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><ScanLine className="h-5 w-5" /></div><div><h1 className="text-xl font-extrabold text-slate-950">Review scanned receipt</h1><p className="text-sm text-slate-500">Mock scan complete. Check every amount before continuing.</p></div></div><div className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4">{items.filter((item) => item.name || item.price).map((item) => <div key={item.name} className="flex justify-between text-sm"><span className="text-slate-600">{item.name || 'Unnamed item'}</span><span className="font-bold text-slate-900">{formatMoney(item.price)}</span></div>)}<div className="border-t border-slate-200 pt-2 text-xs text-slate-500">Service charge {formatMoney(serviceCharge)} · VAT {formatMoney(vat)} · Tip {formatMoney(tip)}</div><div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold"><span>Total check</span><span>{formatMoney(totalNum)}</span></div></div><button onClick={onReview} className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold ${receiptReviewed ? 'bg-success-600 text-white' : 'bg-primary-600 text-white'}`}>{receiptReviewed ? <Check className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {receiptReviewed ? 'Receipt reviewed' : 'Confirm receipt details'}</button></Panel>; }

function PeopleStep({ organizerName, setOrganizerName, organizerPhone, setOrganizerPhone, participants, updateParticipant, addParticipant, removeParticipant, splitMode, organizerCustomAmount, setOrganizerCustomAmount, equalAmounts, totalNum, customRemaining }: { organizerName: string; setOrganizerName: (value: string) => void; organizerPhone: string; setOrganizerPhone: (value: string) => void; participants: ParticipantInput[]; updateParticipant: (index: number, field: keyof ParticipantInput, value: string | number) => void; addParticipant: (contact?: { name: string; phone: string }) => void; removeParticipant: (index: number) => void; splitMode: SplitMode; organizerCustomAmount: number; setOrganizerCustomAmount: (value: number) => void; equalAmounts: number[]; totalNum: number; customRemaining: number }) { return <Panel><h1 className="text-xl font-extrabold text-slate-950">Who is included?</h1><p className="mt-1 text-sm text-slate-500">People means you plus every invited friend. Friends can pay without an account.</p><div className="mt-5 flex flex-wrap gap-2">{contacts.map((contact) => <button key={contact.phone} onClick={() => addParticipant(contact)} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-primary-300">+ {contact.name}</button>)}<button onClick={() => addParticipant()} className="rounded-full border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-bold text-primary-700">+ Add by phone</button></div><div className="mt-5 rounded-xl bg-primary-50/40 p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-500">You (organizer)<input value={organizerName} onChange={(event) => setOrganizerName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="text-xs font-bold text-slate-500">Phone<input value={organizerPhone} onChange={(event) => setOrganizerPhone(event.target.value)} placeholder="+2557XXXXXXXX" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label></div><div className="mt-3 flex items-center justify-between text-sm"><span className="font-bold text-slate-700">Your share</span>{splitMode === 'equal' ? <span className="font-extrabold text-primary-700">{formatMoney(equalAmounts[0] || 0)}</span> : splitMode === 'custom' ? <input type="number" value={organizerCustomAmount || ''} onChange={(event) => setOrganizerCustomAmount(Number(event.target.value) || 0)} placeholder="Amount" className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm font-bold" /> : <span className="font-extrabold text-primary-700">{formatMoney(equalAmounts[0] || 0)}</span>}</div></div><div className="mt-4 space-y-2">{participants.map((participant, index) => <div key={index} className="flex items-center gap-2 rounded-xl border border-slate-100 p-3"><Users className="h-4 w-4 text-slate-400" /><input value={participant.name} onChange={(event) => updateParticipant(index, 'name', event.target.value)} placeholder="Friend name" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm" /><input value={participant.phone} onChange={(event) => updateParticipant(index, 'phone', event.target.value)} placeholder="Phone" className="w-32 rounded-lg border border-slate-200 px-2 py-2 text-sm" />{splitMode === 'custom' && <input type="number" value={participant.amount || ''} onChange={(event) => updateParticipant(index, 'amount', Number(event.target.value) || 0)} placeholder="Share" className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-sm" />}<button onClick={() => removeParticipant(index)} className="p-1 text-slate-300 hover:text-error-500"><X className="h-4 w-4" /></button></div>)}</div>{splitMode === 'custom' && <p className={`mt-3 text-sm font-bold ${customRemaining === 0 ? 'text-success-600' : 'text-warning-600'}`}>Remaining to allocate: {formatMoney(customRemaining)} of {formatMoney(totalNum)}</p>}<button onClick={() => addParticipant()} className="mt-4 flex items-center gap-2 text-sm font-bold text-primary-600"><Plus className="h-4 w-4" /> Add another person</button></Panel>; }

function RulesStep({ dueDate, setDueDate, reminderFrequency, setReminderFrequency, reminderWording, setReminderWording, feePayer, setFeePayer, allowCash, setAllowCash }: { dueDate: string; setDueDate: (value: string) => void; reminderFrequency: string; setReminderFrequency: (value: string) => void; reminderWording: string; setReminderWording: (value: string) => void; feePayer: FeePayer; setFeePayer: (value: FeePayer) => void; allowCash: boolean; setAllowCash: (value: boolean) => void }) { return <Panel><h1 className="text-xl font-extrabold text-slate-950">Set the rules</h1><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">Deadline / expiry<input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm" /></label><label className="text-sm font-bold text-slate-700">Reminder frequency<select value={reminderFrequency} onChange={(event) => setReminderFrequency(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm"><option>Every day</option><option>Every 2 days</option><option>Once before deadline</option><option>No reminders</option></select></label></div><label className="mt-5 block text-sm font-bold text-slate-700">Reminder wording<input value={reminderWording} onChange={(event) => setReminderWording(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm" /></label><div className="mt-5"><p className="text-sm font-bold text-slate-700">Who pays the fee?</p><div className="mt-2 grid grid-cols-3 gap-2">{(['payer', 'organizer', 'merchant'] as FeePayer[]).map((payer) => <button key={payer} onClick={() => setFeePayer(payer)} className={`rounded-lg border p-3 text-xs font-bold capitalize ${feePayer === payer ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500'}`}>{payer}</button>)}</div></div><button onClick={() => setAllowCash(!allowCash)} className="mt-5 flex items-center gap-3 text-left"><span className={`flex h-5 w-5 items-center justify-center rounded border ${allowCash ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-300'}`}>{allowCash && <Check className="h-3 w-3" />}</span><span><span className="block text-sm font-bold text-slate-800">Allow mark as paid in cash</span><span className="text-xs text-slate-400">Cash confirmations remain visible to the organizer.</span></span></button></Panel>; }

function PreviewStep({ title, totalNum, selectedDestinationName, selectedMerchant, splitMode, peopleCount, equalAmounts, customRemaining, customAllocated, feePayer, allowCash, note, calculatedItemTotal, onCreate, creating, onSaveAsTemplate }: { title: string; totalNum: number; selectedDestinationName: string; selectedMerchant: Merchant | null; splitMode: SplitMode; peopleCount: number; equalAmounts: number[]; customRemaining: number; customAllocated: number; feePayer: FeePayer; allowCash: boolean; note: string; calculatedItemTotal: number; onCreate: () => void; creating: boolean; onSaveAsTemplate: () => void }) {
  return (
    <Panel>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Preview</p>
            <button
              onClick={onSaveAsTemplate}
              className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 transition"
            >
              <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" /> Save as Template
            </button>
          </div>
          <h1 className="mt-1 text-xl font-extrabold text-slate-950">{title}</h1>
        </div>
        <span className="text-lg font-extrabold text-slate-950">{formatMoney(totalNum)}</span>
      </div>
      <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Destination</span><span className="font-bold text-slate-900">{selectedDestinationName}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">People total</span><span className="font-bold text-slate-900">{peopleCount}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Split method</span><span className="font-bold capitalize text-slate-900">{splitMode.replace('_', ' ')}</span></div>
        {splitMode === 'equal' && <div className="flex justify-between"><span className="text-slate-500">Each share</span><span className="font-bold text-slate-900">{formatMoney(equalAmounts[0] || 0)}</span></div>}
        {splitMode === 'custom' && <div className="flex justify-between"><span className="text-slate-500">Allocated</span><span className={`font-bold ${customRemaining === 0 ? 'text-success-600' : 'text-warning-600'}`}>{formatMoney(customAllocated)} · {customRemaining === 0 ? 'Matches total' : `${formatMoney(customRemaining)} remaining`}</span></div>}
        {splitMode === 'items' && <div className="flex justify-between"><span className="text-slate-500">Receipt total</span><span className="font-bold text-slate-900">{formatMoney(calculatedItemTotal)}</span></div>}
        <div className="flex justify-between"><span className="text-slate-500">Fee paid by</span><span className="font-bold capitalize text-slate-900">{feePayer}</span></div>
        {note && <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">{note}</div>}
      </div>
      <div className="my-5"><TrustStrip merchantName={selectedMerchant?.display_name || selectedDestinationName} destinationId={selectedMerchant?.destination_id} /></div>
      <p className="mb-5 text-xs text-slate-500">Fees are disclosed before payment. {allowCash ? 'The organizer can mark a share as paid in cash.' : 'Cash confirmations are disabled.'}</p>
      <button onClick={onCreate} disabled={creating || (splitMode === 'custom' && customRemaining !== 0)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{creating ? 'Creating split...' : 'Create Split'} <CheckCircle2 className="h-4 w-4" /></button>
    </Panel>
  );
}

function ShareView({ split, merchant, shareLink, copied, onCopy, onComplete }: { split: Split; merchant: Merchant | null; shareLink: string; copied: boolean; onCopy: () => void; onComplete: () => void }) { return <div className="mx-auto max-w-2xl px-4 py-12 animate-slide-up"><div className="mb-8 text-center"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-success-500 text-white shadow-lg shadow-success-500/25"><CheckCircle2 className="h-10 w-10" /></div><h1 className="text-2xl font-extrabold text-slate-950">Split created</h1><p className="mt-2 text-slate-500">Share the link so everyone can pay their share.</p></div><div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 pb-5"><Receipt className="h-6 w-6 text-slate-500" /><div className="flex-1"><p className="font-bold text-slate-900">{split.title}</p><p className="text-xs text-slate-400">{merchant?.display_name || 'Verified destination'} · {formatMoney(split.total_amount)}</p></div></div><div className="mt-5 flex flex-col items-center"><div className="qr-placeholder"><QrCode className="h-20 w-20 text-slate-950" /></div><p className="mt-4 break-all rounded-lg bg-slate-50 px-3 py-2 text-center font-mono text-xs text-slate-600">{shareLink}</p><button onClick={onCopy} className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">{copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy link'}</button></div><div className="mt-5 grid grid-cols-2 gap-2"><button className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] py-3 text-xs font-bold text-white"><MessageCircle className="h-4 w-4" /> WhatsApp</button><button className="flex items-center justify-center gap-2 rounded-lg bg-slate-950 py-3 text-xs font-bold text-white"><Smartphone className="h-4 w-4" /> SMS</button></div></div><div className="mt-5"><TrustStrip merchantName={merchant?.display_name} destinationId={merchant?.destination_id} /></div><button onClick={onComplete} className="mt-5 w-full rounded-xl bg-primary-600 py-3 text-sm font-bold text-white">View split details</button></div>; }
