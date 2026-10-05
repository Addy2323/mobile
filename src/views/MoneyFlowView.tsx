import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Building2, Check, ChevronDown, CircleDollarSign,
  FileText, Hash, Landmark, Phone, Send, ShieldCheck, Store, UserRound,
  WalletCards,
} from 'lucide-react';
import { supabase, type Merchant } from '@/lib/supabase';
import { formatMoney } from '@/lib/utils';

export type MoneyFlowMode = 'send' | 'deposit' | 'transfer' | 'control';

type MoneyFlowViewProps = {
  mode: MoneyFlowMode;
  onBack: () => void;
};

type RecipientKind = 'individual' | 'merchant';

const titles: Record<MoneyFlowMode, { eyebrow: string; title: string; description: string }> = {
  send: { eyebrow: 'Send money', title: 'Choose how to send money', description: 'Send securely to another LUMO account or a verified merchant.' },
  deposit: { eyebrow: 'Deposit', title: 'Add money to your account', description: 'Choose a mobile-money network and enter the amount you want to deposit.' },
  transfer: { eyebrow: 'Send money', title: 'LUMO to LUMO', description: 'Instant, free transfers between LUMO accounts.' },
  control: { eyebrow: 'Control number', title: 'Create a control number', description: 'Create a number your customer can pay with mobile money or bank.' },
};

export default function MoneyFlowView({ mode, onBack }: MoneyFlowViewProps) {
  const [recipientKind, setRecipientKind] = useState<RecipientKind>('individual');
  const [accountNumber, setAccountNumber] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [amount, setAmount] = useState(mode === 'control' ? '10000' : '');
  const [phone, setPhone] = useState('');
  const [network, setNetwork] = useState('Mixx by Yas');
  const [note, setNote] = useState('');
  const [paymentMode, setPaymentMode] = useState('Exact amount');
  const [customerName, setCustomerName] = useState('');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [generatedNumber, setGeneratedNumber] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (mode !== 'send') return;
    async function loadMerchants() {
      const { data } = await supabase.from('merchants').select('*').eq('verification_status', 'VERIFIED').order('display_name');
      if (data) setMerchants(data as Merchant[]);
    }
    void loadMerchants();
  }, [mode]);

  const page = titles[mode];
  const amountNumber = Number(amount) || 0;

  function submit() {
    if (mode === 'control') {
      setGeneratedNumber(String(Math.floor(100000000 + Math.random() * 900000000)));
    }
    setSubmitted(true);
  }

  async function copyControlNumber() {
    await navigator.clipboard.writeText(generatedNumber);
    setCopied(true);
  }

  if (submitted && mode !== 'control') {
    return <FlowShell onBack={onBack} eyebrow={page.eyebrow} title="Request ready" description="Review the details below before continuing with your provider."><div className="rounded-2xl border border-success-200 bg-success-50 p-5"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-success-500 text-white"><Check className="h-5 w-5" /></div><h2 className="text-lg font-extrabold text-slate-950">Everything looks good</h2><p className="mt-1 text-sm text-slate-600">Your payment request is ready to continue.</p><div className="mt-5 space-y-3 rounded-xl bg-white p-4 text-sm"><Summary label="Amount" value={formatMoney(amountNumber)} />{mode === 'send' && <Summary label={recipientKind === 'merchant' ? 'Merchant' : 'Account'} value={recipientKind === 'merchant' ? merchants.find((merchant) => merchant.id === merchantId)?.display_name || 'Selected merchant' : accountNumber} />}{mode === 'deposit' && <Summary label="Network" value={network} />}</div></div><button onClick={onBack} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-sm font-bold text-white transition hover:bg-slate-800"><ArrowLeft className="h-4 w-4" /> Back to dashboard</button></FlowShell>;
  }

  if (mode === 'send') {
    return <FlowShell onBack={onBack} eyebrow={page.eyebrow} title={page.title} description={page.description}><div className="mb-6 grid grid-cols-2 gap-3"><ChoiceCard active={recipientKind === 'individual'} icon={UserRound} title="Individual" description="Send to a LUMO account" onClick={() => setRecipientKind('individual')} /><ChoiceCard active={recipientKind === 'merchant'} icon={Store} title="Merchant" description="Pay a verified destination" onClick={() => setRecipientKind('merchant')} /></div><Field label={recipientKind === 'individual' ? 'Recipient account number' : 'Choose merchant'} icon={recipientKind === 'individual' ? WalletCards : Store}>{recipientKind === 'individual' ? <input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="e.g. 123456789012" className="field-input" /> : <select value={merchantId} onChange={(event) => setMerchantId(event.target.value)} className="field-input"><option value="">Select a verified merchant</option>{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.display_name} · {merchant.city}</option>)}</select>}</Field><Field label="Amount (TZS)" icon={CircleDollarSign}><input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="50000" className="field-input" /></Field><Field label="Note (optional)" icon={FileText}><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What is this payment for?" className="field-input" /></Field><SubmitButton disabled={amountNumber <= 0 || (recipientKind === 'individual' ? !accountNumber : !merchantId)} onClick={submit} label="Continue" /></FlowShell>;
  }

  if (mode === 'deposit') {
    return <FlowShell onBack={onBack} eyebrow={page.eyebrow} title={page.title} description={page.description}><Field label="Country"><div className="select-display"><span>TZ&nbsp; Tanzania</span><ChevronDown className="h-4 w-4 text-slate-400" /></div></Field><p className="mb-5 text-xs text-slate-400">Deposits in TZS.</p><Field label="Amount (TZS)" icon={CircleDollarSign}><input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" className="field-input" /></Field><Field label="Phone number" icon={Phone}><div className="flex overflow-hidden rounded-lg border border-slate-200"><span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500">TZ +255</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="712 345 678" className="min-w-0 flex-1 px-3 py-3 text-sm outline-none" /></div></Field><p className="-mt-2 mb-5 text-xs text-slate-400">You’ll receive a USSD push to approve.</p><div className="mb-5 grid grid-cols-3 gap-3">{['Mixx by Yas', 'airtel money', 'HaloPesa'].map((item) => <button key={item} onClick={() => setNetwork(item)} className={`rounded-xl border p-3 text-xs font-bold transition ${network === item ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{item}</button>)}</div><SubmitButton disabled={amountNumber <= 0 || phone.length < 6} onClick={submit} label="Continue" /></FlowShell>;
  }

  if (mode === 'transfer') {
    return <FlowShell onBack={onBack} eyebrow={page.eyebrow} title={page.title} description={page.description}><Field label="Recipient account number" icon={WalletCards}><input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="e.g. 123456789012" className="field-input" /></Field><p className="-mt-2 mb-5 text-xs text-slate-400">We’ll show the recipient’s name before you send.</p><Field label="Amount (TZS)" icon={CircleDollarSign}><input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="50000" className="field-input" /></Field><SubmitButton disabled={!accountNumber || amountNumber <= 0} onClick={submit} label="Continue" /></FlowShell>;
  }

  return <FlowShell onBack={onBack} eyebrow={page.eyebrow} title={page.title} description={page.description}>{submitted && <div className="mb-5 rounded-2xl border border-slate-900 bg-white p-5 text-center shadow-sm"><div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500"><Hash className="h-3.5 w-3.5" /> Control number ready</div><p className="font-mono text-2xl font-bold tracking-[0.12em] text-slate-950">{generatedNumber}</p><p className="mt-1 text-xs uppercase text-slate-400">TZS {amountNumber.toLocaleString()} · {note || 'Payment request'}</p><button onClick={copyControlNumber} className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">{copied ? <Check className="h-3.5 w-3.5 text-success-500" /> : <FileText className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy number'}</button></div>}<div className="mb-5 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-white"><FileText className="h-4 w-4" /></div><div><h2 className="text-base font-bold text-slate-950">New control number</h2><p className="text-xs text-slate-400">Customer name is filled from your profile.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Amount (TZS)" icon={CircleDollarSign}><input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} className="field-input" /></Field><Field label="Payment mode"><select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)} className="field-input"><option>Exact amount</option><option>Any amount</option></select></Field></div><Field label="Invoice description" icon={FileText}><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Auto invoice description" className="field-input" /></Field><Field label="Customer name" icon={UserRound}><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" className="field-input" /></Field><SubmitButton disabled={amountNumber <= 0 || !customerName} onClick={submit} label="Generate control number" icon={Hash} /></FlowShell>;
}

function FlowShell({ onBack, eyebrow, title, description, children }: { onBack: () => void; eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <div className="mx-auto max-w-[650px] px-4 py-8 sm:px-6 lg:py-12"><button onClick={onBack} className="mb-7 flex items-center gap-2 text-xs font-bold text-slate-400 transition hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> {eyebrow}</button><div className="mb-7"><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">LUMO</p><h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 text-sm text-slate-500">{description}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{children}</div><div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4 text-success-500" /> Secure LUMO payment workspace</div></div>;
}

function ChoiceCard({ active, icon: Icon, title, description, onClick }: { active: boolean; icon: typeof UserRound; title: string; description: string; onClick: () => void }) { return <button onClick={onClick} className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${active ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300'}`}><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Icon className="h-4 w-4" /></div><div><p className="text-sm font-bold text-slate-900">{title}</p><p className="mt-1 text-xs text-slate-400">{description}</p></div></button>; }
function Field({ label, icon: Icon, children }: { label: string; icon?: typeof CircleDollarSign; children: React.ReactNode }) { return <label className="mb-5 block"><span className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</span>{children}</label>; }
function SubmitButton({ disabled, onClick, label, icon: Icon = ArrowRight }: { disabled: boolean; onClick: () => void; label: string; icon?: typeof ArrowRight }) { return <button disabled={disabled} onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"><Icon className="h-4 w-4" /> {label}</button>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0"><span className="text-slate-500">{label}</span><span className="font-bold text-slate-900">{value}</span></div>; }
