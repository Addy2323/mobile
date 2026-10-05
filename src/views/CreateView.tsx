import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bike, Calendar, Check, CheckCircle2, Copy, FileText,
  Hotel, Landmark, Link2, MessageCircle, Plus, QrCode, Receipt, ScanLine,
  Search, Share2, ShieldCheck, ShoppingBag, Smartphone, Store, Trash2, Users,
  UtensilsCrossed, WalletCards, X,
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

const stepLabels = ['Destination', 'Bill details', 'Method', 'Receipt review', 'People', 'Rules', 'Preview'];

export default function CreateView({ onComplete, onCancel }: CreateViewProps) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('food_drinks');
  const [totalAmount, setTotalAmount] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
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

  if (createdSplit && step === 8) return <ShareView split={createdSplit} merchant={selectedMerchant} shareLink={shareLink} copied={copied} onCopy={() => { void navigator.clipboard?.writeText(shareLink); setCopied(true); }} onComplete={() => onComplete(createdSplit)} />;

  return <div className="mx-auto max-w-3xl px-4 py-8 animate-fade-in">
    <div className="mb-8 flex items-center justify-between gap-2 overflow-x-auto pb-1">{stepLabels.map((label, index) => { const number = index + 1; const visible = !(number === 4 && splitMode !== 'items'); return <div key={label} className={`flex min-w-max items-center gap-2 ${visible ? '' : 'opacity-40'}`}><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step >= number ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{step > number ? <Check className="h-4 w-4" /> : number}</div><span className={`hidden text-xs font-semibold sm:inline ${step >= number ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>{number < 7 && <span className={`mx-1 h-0.5 w-6 rounded-full sm:w-10 ${step > number ? 'bg-primary-500' : 'bg-slate-200'}`} />}</div>; })}</div>
    {step === 1 && <DestinationStep destinationType={destinationType} setDestinationType={setDestinationType} selectedMerchant={selectedMerchant} setSelectedMerchant={setSelectedMerchant} merchants={merchants} searchQuery={searchQuery} onSearch={(value) => { setSearchQuery(value); void searchMerchants(value); }} searchLoading={searchLoading} destinationReference={destinationReference} setDestinationReference={setDestinationReference} recipient={recipient} setRecipient={setRecipient} />}
    {step === 2 && <DetailsStep title={title} setTitle={setTitle} category={category} setCategory={setCategory} totalAmount={totalAmount} setTotalAmount={setTotalAmount} photoName={photoName} setPhotoName={setPhotoName} note={note} setNote={setNote} />}
    {step === 3 && <MethodStep splitMode={splitMode} setSplitMode={setSplitMode} items={items} addItem={addItem} updateItem={updateItem} removeItem={removeItem} serviceCharge={serviceCharge} setServiceCharge={setServiceCharge} vat={vat} setVat={setVat} tip={tip} setTip={setTip} splitFeesProportionally={splitFeesProportionally} setSplitFeesProportionally={setSplitFeesProportionally} totalNum={totalNum} calculatedItemTotal={calculatedItemTotal} />}
    {step === 4 && <ReceiptReviewStep items={items} serviceCharge={serviceCharge} vat={vat} tip={tip} totalNum={totalNum} receiptReviewed={receiptReviewed} onReview={() => setReceiptReviewed(true)} />}
    {step === 5 && <PeopleStep organizerName={organizerName} setOrganizerName={setOrganizerName} organizerPhone={organizerPhone} setOrganizerPhone={setOrganizerPhone} participants={participants} updateParticipant={updateParticipant} addParticipant={addParticipant} removeParticipant={(index) => setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index))} splitMode={splitMode} organizerCustomAmount={organizerCustomAmount} setOrganizerCustomAmount={setOrganizerCustomAmount} equalAmounts={equalAmounts} totalNum={totalNum} customRemaining={customRemaining} />}
    {step === 6 && <RulesStep dueDate={dueDate} setDueDate={setDueDate} reminderFrequency={reminderFrequency} setReminderFrequency={setReminderFrequency} reminderWording={reminderWording} setReminderWording={setReminderWording} feePayer={feePayer} setFeePayer={setFeePayer} allowCash={allowCash} setAllowCash={setAllowCash} />}
    {step === 7 && <PreviewStep title={title} totalNum={totalNum} selectedDestinationName={selectedDestinationName} selectedMerchant={selectedMerchant} splitMode={splitMode} peopleCount={peopleCount} equalAmounts={equalAmounts} customRemaining={customRemaining} customAllocated={customAllocated} feePayer={feePayer} allowCash={allowCash} note={note} calculatedItemTotal={calculatedItemTotal} onCreate={handleCreate} creating={creating} />}
    {step < 7 && <div className="mt-6 flex items-center justify-between"><button onClick={step === 1 ? onCancel : previousStep} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800">{step === 1 ? 'Cancel' : <><ArrowLeft className="h-4 w-4" /> Back</>}</button>{step !== 7 && <button onClick={nextStep} className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700">Continue <ArrowRight className="h-4 w-4" /></button>}</div>}
    {error && <p className="mt-4 rounded-xl border border-error-100 bg-error-50 px-4 py-3 text-sm font-semibold text-error-700">{error}</p>}
  </div>;
}

function Panel({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 animate-slide-up">{children}</div>; }
function DestinationStep({ destinationType, setDestinationType, selectedMerchant, setSelectedMerchant, merchants, searchQuery, onSearch, searchLoading, destinationReference, setDestinationReference, recipient, setRecipient }: { destinationType: DestinationType; setDestinationType: (value: DestinationType) => void; selectedMerchant: Merchant | null; setSelectedMerchant: (value: Merchant | null) => void; merchants: Merchant[]; searchQuery: string; onSearch: (value: string) => void; searchLoading: boolean; destinationReference: string; setDestinationReference: (value: string) => void; recipient: string; setRecipient: (value: string) => void }) { return <Panel><h1 className="text-xl font-extrabold text-slate-950">Choose a destination</h1><p className="mt-1 text-sm text-slate-500">Payments route to a verified merchant or recipient. Bank details cannot be free-typed.</p><div className="mt-6 grid grid-cols-3 gap-2">{([['merchant', Store, 'Merchant'], ['reference', ScanLine, 'Lipa / Control'], ['recipient', Users, 'Recipient']] as const).map(([id, Icon, label]) => <button key={id} onClick={() => setDestinationType(id)} className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center text-xs font-bold ${destinationType === id ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500'}`}><Icon className="h-5 w-5" />{label}</button>)}</div>{destinationType === 'merchant' && <div className="mt-5">{selectedMerchant ? <div className="flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50 p-4"><div className="flex items-center gap-3"><CategoryIcon category={selectedMerchant.category} className="h-6 w-6 text-primary-600" /><div><p className="font-bold text-slate-900">{selectedMerchant.display_name}</p><p className="text-xs text-slate-500">{selectedMerchant.city} · {selectedMerchant.destination_id}</p></div></div><button onClick={() => setSelectedMerchant(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white"><X className="h-4 w-4" /></button></div> : <><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchQuery} onChange={(event) => onSearch(event.target.value)} placeholder="Search verified merchants" className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-primary-400" /></div><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{searchLoading ? <div className="h-20 rounded-xl shimmer" /> : merchants.map((merchant) => <button key={merchant.id} onClick={() => setSelectedMerchant(merchant)} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left hover:border-primary-200"><CategoryIcon category={merchant.category} className="h-5 w-5 text-slate-500" /><span className="flex-1"><span className="block text-sm font-bold text-slate-900">{merchant.display_name}</span><span className="text-xs text-slate-400">{merchant.city} · Verified</span></span><ArrowRight className="h-4 w-4 text-slate-300" /></button>)}</div></>}</div>}{destinationType === 'reference' && <div className="mt-5"><label className="text-sm font-bold text-slate-700">Lipa Namba or control number</label><div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3"><ScanLine className="h-4 w-4 text-slate-400" /><input value={destinationReference} onChange={(event) => setDestinationReference(event.target.value)} placeholder="Enter or scan a number" className="w-full py-3 text-sm outline-none" /></div><p className="mt-2 text-xs text-slate-400">The verified name and amount will be confirmed by the provider.</p></div>}{destinationType === 'recipient' && <div className="mt-5"><label className="text-sm font-bold text-slate-700">Verified recipient</label><select value={recipient} onChange={(event) => setRecipient(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm"><option value="">Select a verified recipient</option><option value="Asha Daniel · +255 754 222 111">Asha Daniel · +255 754 222 111</option><option value="Kelvin Mushi · +255 712 345 678">Kelvin Mushi · +255 712 345 678</option></select></div>}</Panel>; }

function DetailsStep({ title, setTitle, category, setCategory, totalAmount, setTotalAmount, photoName, setPhotoName, note, setNote }: { title: string; setTitle: (value: string) => void; category: string; setCategory: (value: string) => void; totalAmount: string; setTotalAmount: (value: string) => void; photoName: string; setPhotoName: (value: string) => void; note: string; setNote: (value: string) => void }) { return <Panel><h1 className="text-xl font-extrabold text-slate-950">Bill details</h1><p className="mt-1 text-sm text-slate-500">Add the details everyone will see when they pay.</p><label className="mt-6 block text-sm font-bold text-slate-700">Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Dinner at The View" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-primary-400" /></label><div className="mt-5"><p className="text-sm font-bold text-slate-700">Category</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{categories.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setCategory(id)} className={`flex items-center gap-2 rounded-lg border p-3 text-left text-xs font-bold ${category === id ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500'}`}><Icon className="h-4 w-4" />{label}</button>)}</div></div><label className="mt-5 block text-sm font-bold text-slate-700">Total amount (TZS)<input type="number" min="1" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} placeholder="120000" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm font-bold outline-none focus:border-primary-400" />{totalAmount && <span className="mt-1 block text-xs text-slate-400">{formatMoney(Number(totalAmount) || 0)}</span>}</label><label className="mt-5 block text-sm font-bold text-slate-700">Receipt photo (optional)<span className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm font-medium text-slate-500"><Receipt className="h-4 w-4" />{photoName || 'Attach a receipt'}<input type="file" accept="image/*" onChange={(event) => setPhotoName(event.target.files?.[0]?.name || '')} className="hidden" /></span></label><label className="mt-5 block text-sm font-bold text-slate-700">Note (optional)<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What is this bill for?" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-primary-400" /></label></Panel>; }

function MethodStep({ splitMode, setSplitMode, items, addItem, updateItem, removeItem, serviceCharge, setServiceCharge, vat, setVat, tip, setTip, splitFeesProportionally, setSplitFeesProportionally, totalNum, calculatedItemTotal }: { splitMode: SplitMode; setSplitMode: (value: SplitMode) => void; items: LineItem[]; addItem: () => void; updateItem: (index: number, field: keyof LineItem, value: string | number) => void; removeItem: (index: number) => void; serviceCharge: number; setServiceCharge: (value: number) => void; vat: number; setVat: (value: number) => void; tip: number; setTip: (value: number) => void; splitFeesProportionally: boolean; setSplitFeesProportionally: (value: boolean) => void; totalNum: number; calculatedItemTotal: number }) { const methods: [SplitMode, string, string][] = [['equal', 'Equally', 'Everyone pays the same share'], ['custom', 'By amount', 'Set a share for each person'], ['items', 'By items', 'Add items and review the receipt'], ['collect_later', "I'll pay first", 'Collect from friends later'], ['pay_friend', 'Pay for a friend', 'Cover selected people']]; return <Panel><h1 className="text-xl font-extrabold text-slate-950">How should this bill split?</h1><div className="mt-6 space-y-2">{methods.map(([id, label, description]) => <button key={id} onClick={() => setSplitMode(id)} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left ${splitMode === id ? 'border-primary-300 bg-primary-50' : 'border-slate-200'}`}><span className={`mt-0.5 h-4 w-4 rounded-full border-4 ${splitMode === id ? 'border-primary-600' : 'border-slate-300'}`} /><span><span className="block text-sm font-bold text-slate-900">{label}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span></button>)}</div>{splitMode === 'items' && <div className="mt-6 border-t border-slate-100 pt-5"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-bold text-slate-900">Receipt items</p><p className="text-xs text-slate-400">Add or correct the mock scan results.</p></div><button onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-primary-600"><Plus className="h-4 w-4" /> Add item</button></div><div className="space-y-2">{items.map((item, index) => <div key={index} className="flex gap-2"><input value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} placeholder="Item name" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" /><input type="number" value={item.price || ''} onChange={(event) => updateItem(index, 'price', Number(event.target.value) || 0)} placeholder="Price" className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button onClick={() => removeItem(index)} disabled={items.length === 1} className="p-2 text-slate-300 hover:text-error-500 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div>)}</div><div className="mt-4 grid grid-cols-3 gap-2">{[['Service charge', serviceCharge, setServiceCharge], ['VAT', vat, setVat], ['Tip', tip, setTip]].map(([label, value, setter]) => <label key={label as string} className="text-xs font-bold text-slate-500">{label as string}<input type="number" value={value as number || ''} onChange={(event) => (setter as (value: number) => void)(Number(event.target.value) || 0)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-900" /></label>)}</div><button onClick={() => setSplitFeesProportionally(!splitFeesProportionally)} className="mt-4 text-xs font-bold text-primary-600">Fees split {splitFeesProportionally ? 'proportionally' : 'equally'} · Change</button><div className={`mt-4 rounded-lg p-3 text-xs font-bold ${calculatedItemTotal === totalNum ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>Receipt total: {formatMoney(calculatedItemTotal)} · Bill total: {formatMoney(totalNum)}</div></div>}</Panel>; }

function ReceiptReviewStep({ items, serviceCharge, vat, tip, totalNum, receiptReviewed, onReview }: { items: LineItem[]; serviceCharge: number; vat: number; tip: number; totalNum: number; receiptReviewed: boolean; onReview: () => void }) { return <Panel><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><ScanLine className="h-5 w-5" /></div><div><h1 className="text-xl font-extrabold text-slate-950">Review scanned receipt</h1><p className="text-sm text-slate-500">Mock scan complete. Check every amount before continuing.</p></div></div><div className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4">{items.filter((item) => item.name || item.price).map((item) => <div key={item.name} className="flex justify-between text-sm"><span className="text-slate-600">{item.name || 'Unnamed item'}</span><span className="font-bold text-slate-900">{formatMoney(item.price)}</span></div>)}<div className="border-t border-slate-200 pt-2 text-xs text-slate-500">Service charge {formatMoney(serviceCharge)} · VAT {formatMoney(vat)} · Tip {formatMoney(tip)}</div><div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold"><span>Total check</span><span>{formatMoney(totalNum)}</span></div></div><button onClick={onReview} className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold ${receiptReviewed ? 'bg-success-600 text-white' : 'bg-primary-600 text-white'}`}>{receiptReviewed ? <Check className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {receiptReviewed ? 'Receipt reviewed' : 'Confirm receipt details'}</button></Panel>; }

function PeopleStep({ organizerName, setOrganizerName, organizerPhone, setOrganizerPhone, participants, updateParticipant, addParticipant, removeParticipant, splitMode, organizerCustomAmount, setOrganizerCustomAmount, equalAmounts, totalNum, customRemaining }: { organizerName: string; setOrganizerName: (value: string) => void; organizerPhone: string; setOrganizerPhone: (value: string) => void; participants: ParticipantInput[]; updateParticipant: (index: number, field: keyof ParticipantInput, value: string | number) => void; addParticipant: (contact?: { name: string; phone: string }) => void; removeParticipant: (index: number) => void; splitMode: SplitMode; organizerCustomAmount: number; setOrganizerCustomAmount: (value: number) => void; equalAmounts: number[]; totalNum: number; customRemaining: number }) { return <Panel><h1 className="text-xl font-extrabold text-slate-950">Who is included?</h1><p className="mt-1 text-sm text-slate-500">People means you plus every invited friend. Friends can pay without an account.</p><div className="mt-5 flex flex-wrap gap-2">{contacts.map((contact) => <button key={contact.phone} onClick={() => addParticipant(contact)} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-primary-300">+ {contact.name}</button>)}<button onClick={() => addParticipant()} className="rounded-full border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-bold text-primary-700">+ Add by phone</button></div><div className="mt-5 rounded-xl bg-primary-50/40 p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-500">You (organizer)<input value={organizerName} onChange={(event) => setOrganizerName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="text-xs font-bold text-slate-500">Phone<input value={organizerPhone} onChange={(event) => setOrganizerPhone(event.target.value)} placeholder="+2557XXXXXXXX" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label></div><div className="mt-3 flex items-center justify-between text-sm"><span className="font-bold text-slate-700">Your share</span>{splitMode === 'equal' ? <span className="font-extrabold text-primary-700">{formatMoney(equalAmounts[0] || 0)}</span> : splitMode === 'custom' ? <input type="number" value={organizerCustomAmount || ''} onChange={(event) => setOrganizerCustomAmount(Number(event.target.value) || 0)} placeholder="Amount" className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm font-bold" /> : <span className="font-extrabold text-primary-700">{formatMoney(equalAmounts[0] || 0)}</span>}</div></div><div className="mt-4 space-y-2">{participants.map((participant, index) => <div key={index} className="flex items-center gap-2 rounded-xl border border-slate-100 p-3"><Users className="h-4 w-4 text-slate-400" /><input value={participant.name} onChange={(event) => updateParticipant(index, 'name', event.target.value)} placeholder="Friend name" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm" /><input value={participant.phone} onChange={(event) => updateParticipant(index, 'phone', event.target.value)} placeholder="Phone" className="w-32 rounded-lg border border-slate-200 px-2 py-2 text-sm" />{splitMode === 'custom' && <input type="number" value={participant.amount || ''} onChange={(event) => updateParticipant(index, 'amount', Number(event.target.value) || 0)} placeholder="Share" className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-sm" />}<button onClick={() => removeParticipant(index)} className="p-1 text-slate-300 hover:text-error-500"><X className="h-4 w-4" /></button></div>)}</div>{splitMode === 'custom' && <p className={`mt-3 text-sm font-bold ${customRemaining === 0 ? 'text-success-600' : 'text-warning-600'}`}>Remaining to allocate: {formatMoney(customRemaining)} of {formatMoney(totalNum)}</p>}<button onClick={() => addParticipant()} className="mt-4 flex items-center gap-2 text-sm font-bold text-primary-600"><Plus className="h-4 w-4" /> Add another person</button></Panel>; }

function RulesStep({ dueDate, setDueDate, reminderFrequency, setReminderFrequency, reminderWording, setReminderWording, feePayer, setFeePayer, allowCash, setAllowCash }: { dueDate: string; setDueDate: (value: string) => void; reminderFrequency: string; setReminderFrequency: (value: string) => void; reminderWording: string; setReminderWording: (value: string) => void; feePayer: FeePayer; setFeePayer: (value: FeePayer) => void; allowCash: boolean; setAllowCash: (value: boolean) => void }) { return <Panel><h1 className="text-xl font-extrabold text-slate-950">Set the rules</h1><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">Deadline / expiry<input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm" /></label><label className="text-sm font-bold text-slate-700">Reminder frequency<select value={reminderFrequency} onChange={(event) => setReminderFrequency(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm"><option>Every day</option><option>Every 2 days</option><option>Once before deadline</option><option>No reminders</option></select></label></div><label className="mt-5 block text-sm font-bold text-slate-700">Reminder wording<input value={reminderWording} onChange={(event) => setReminderWording(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm" /></label><div className="mt-5"><p className="text-sm font-bold text-slate-700">Who pays the fee?</p><div className="mt-2 grid grid-cols-3 gap-2">{(['payer', 'organizer', 'merchant'] as FeePayer[]).map((payer) => <button key={payer} onClick={() => setFeePayer(payer)} className={`rounded-lg border p-3 text-xs font-bold capitalize ${feePayer === payer ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500'}`}>{payer}</button>)}</div></div><button onClick={() => setAllowCash(!allowCash)} className="mt-5 flex items-center gap-3 text-left"><span className={`flex h-5 w-5 items-center justify-center rounded border ${allowCash ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-300'}`}>{allowCash && <Check className="h-3 w-3" />}</span><span><span className="block text-sm font-bold text-slate-800">Allow mark as paid in cash</span><span className="text-xs text-slate-400">Cash confirmations remain visible to the organizer.</span></span></button></Panel>; }

function PreviewStep({ title, totalNum, selectedDestinationName, selectedMerchant, splitMode, peopleCount, equalAmounts, customRemaining, customAllocated, feePayer, allowCash, note, calculatedItemTotal, onCreate, creating }: { title: string; totalNum: number; selectedDestinationName: string; selectedMerchant: Merchant | null; splitMode: SplitMode; peopleCount: number; equalAmounts: number[]; customRemaining: number; customAllocated: number; feePayer: FeePayer; allowCash: boolean; note: string; calculatedItemTotal: number; onCreate: () => void; creating: boolean }) { return <Panel><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Preview</p><h1 className="mt-1 text-xl font-extrabold text-slate-950">{title}</h1></div><span className="text-lg font-extrabold text-slate-950">{formatMoney(totalNum)}</span></div><div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 text-sm"><div className="flex justify-between"><span className="text-slate-500">Destination</span><span className="font-bold text-slate-900">{selectedDestinationName}</span></div><div className="flex justify-between"><span className="text-slate-500">People total</span><span className="font-bold text-slate-900">{peopleCount}</span></div><div className="flex justify-between"><span className="text-slate-500">Split method</span><span className="font-bold capitalize text-slate-900">{splitMode.replace('_', ' ')}</span></div>{splitMode === 'equal' && <div className="flex justify-between"><span className="text-slate-500">Each share</span><span className="font-bold text-slate-900">{formatMoney(equalAmounts[0] || 0)}</span></div>}{splitMode === 'custom' && <div className="flex justify-between"><span className="text-slate-500">Allocated</span><span className={`font-bold ${customRemaining === 0 ? 'text-success-600' : 'text-warning-600'}`}>{formatMoney(customAllocated)} · {customRemaining === 0 ? 'Matches total' : `${formatMoney(customRemaining)} remaining`}</span></div>}{splitMode === 'items' && <div className="flex justify-between"><span className="text-slate-500">Receipt total</span><span className="font-bold text-slate-900">{formatMoney(calculatedItemTotal)}</span></div>}<div className="flex justify-between"><span className="text-slate-500">Fee paid by</span><span className="font-bold capitalize text-slate-900">{feePayer}</span></div>{note && <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">{note}</div>}</div><div className="my-5"><TrustStrip merchantName={selectedMerchant?.display_name || selectedDestinationName} destinationId={selectedMerchant?.destination_id} /></div><p className="mb-5 text-xs text-slate-500">Fees are disclosed before payment. {allowCash ? 'The organizer can mark a share as paid in cash.' : 'Cash confirmations are disabled.'}</p><button onClick={onCreate} disabled={creating || (splitMode === 'custom' && customRemaining !== 0)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{creating ? 'Creating split...' : 'Create Split'} <CheckCircle2 className="h-4 w-4" /></button></Panel>; }

function ShareView({ split, merchant, shareLink, copied, onCopy, onComplete }: { split: Split; merchant: Merchant | null; shareLink: string; copied: boolean; onCopy: () => void; onComplete: () => void }) { return <div className="mx-auto max-w-2xl px-4 py-12 animate-slide-up"><div className="mb-8 text-center"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-success-500 text-white shadow-lg shadow-success-500/25"><CheckCircle2 className="h-10 w-10" /></div><h1 className="text-2xl font-extrabold text-slate-950">Split created</h1><p className="mt-2 text-slate-500">Share the link so everyone can pay their share.</p></div><div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 pb-5"><Receipt className="h-6 w-6 text-slate-500" /><div className="flex-1"><p className="font-bold text-slate-900">{split.title}</p><p className="text-xs text-slate-400">{merchant?.display_name || 'Verified destination'} · {formatMoney(split.total_amount)}</p></div></div><div className="mt-5 flex flex-col items-center"><div className="qr-placeholder"><QrCode className="h-20 w-20 text-slate-950" /></div><p className="mt-4 break-all rounded-lg bg-slate-50 px-3 py-2 text-center font-mono text-xs text-slate-600">{shareLink}</p><button onClick={onCopy} className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">{copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy link'}</button></div><div className="mt-5 grid grid-cols-2 gap-2"><button className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] py-3 text-xs font-bold text-white"><MessageCircle className="h-4 w-4" /> WhatsApp</button><button className="flex items-center justify-center gap-2 rounded-lg bg-slate-950 py-3 text-xs font-bold text-white"><Smartphone className="h-4 w-4" /> SMS</button></div></div><div className="mt-5"><TrustStrip merchantName={merchant?.display_name} destinationId={merchant?.destination_id} /></div><button onClick={onComplete} className="mt-5 w-full rounded-xl bg-primary-600 py-3 text-sm font-bold text-white">View split details</button></div>; }
