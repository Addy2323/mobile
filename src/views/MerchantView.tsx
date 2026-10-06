import { useState, useEffect } from 'react';
import {
  Store, TrendingUp, Users, CheckCircle2, Clock, Download,
  ShieldCheck, Star, Phone, MapPin, Receipt, Plus, QrCode, UserCheck,
  RefreshCw, FileSpreadsheet, X, Calendar, Building2, CreditCard
} from 'lucide-react';
import { supabase, type Merchant, type Split } from '@/lib/supabase';
import { formatMoney, timeAgo } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';
import { CategoryIcon } from '@/components/CategoryIcon';

type MerchantTab = 'overview' | 'payouts' | 'table_qr' | 'staff' | 'refunds';

export default function MerchantView() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [splits, setSplits] = useState<(Split & { participants: any[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MerchantTab>('overview');

  // Modals state
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [newMerchantName, setNewMerchantName] = useState('');
  const [newMerchantCategory, setNewMerchantCategory] = useState('food_drinks');
  const [newMerchantCity, setNewMerchantCity] = useState('Dar es Salaam');
  const [newMerchantPhone, setNewMerchantPhone] = useState('+255 7XX XXX XXX');

  // Table QR state
  const [selectedTable, setSelectedTable] = useState('1');

  // Staff roles state
  const [staffList, setStaffList] = useState([
    { id: '1', name: 'James Kimaro', role: 'Store Manager', phone: '+255 754 111 222' },
    { id: '2', name: 'Mariam Ali', role: 'Cashier', phone: '+255 712 333 444' }
  ]);

  const [toast, setToast] = useState('');

  useEffect(() => {
    void loadMerchants();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function loadMerchants() {
    setLoading(true);
    const { data } = await supabase
      .from('merchants')
      .select('*')
      .eq('verification_status', 'VERIFIED')
      .order('display_name');
    if (data) {
      setMerchants(data as Merchant[]);
      if (data.length > 0 && !selected) {
        setSelected(data[0] as Merchant);
        void loadSplits(data[0].id);
      }
    }
    setLoading(false);
  }

  async function loadSplits(merchantId: string) {
    const { data } = await supabase
      .from('splits')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });
    if (data) setSplits(data as any);
  }

  function selectMerchant(m: Merchant) {
    setSelected(m);
    void loadSplits(m.id);
  }

  function exportCSV() {
    if (!splits.length) {
      showToast('No transaction data to export');
      return;
    }
    const headers = ['Ref Code', 'Title', 'Total Amount', 'Amount Paid', 'Status', 'Date'];
    const rows = splits.map((s) => [
      s.ref_code,
      `"${s.title.replace(/"/g, '""')}"`,
      s.total_amount,
      s.amount_paid,
      s.status,
      s.created_at
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merchant-sales-${selected?.display_name || 'report'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV transaction report exported successfully');
  }

  function handleRegisterMerchant() {
    if (!newMerchantName) {
      showToast('Please enter merchant business name');
      return;
    }
    const newM: Merchant = {
      id: Date.now().toString(),
      display_name: newMerchantName,
      legal_name: `${newMerchantName} Ltd`,
      category: newMerchantCategory,
      phone: newMerchantPhone,
      verification_status: 'VERIFIED',
      destination_id: `DST-${Math.floor(100000 + Math.random() * 900000)}`,
      payment_rail: 'M-Pesa / Tigo Pesa / NMB',
      support_contact: newMerchantPhone,
      city: newMerchantCity,
      rating: 4.9,
      created_at: new Date().toISOString()
    };

    setMerchants((prev) => [newM, ...prev]);
    setSelected(newM);
    setShowOnboardingModal(false);
    setNewMerchantName('');
    showToast(`Merchant "${newM.display_name}" registered & verified!`);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="h-64 rounded-2xl shimmer" />
      </div>
    );
  }

  const totalVolume = splits.reduce((s, sp) => s + sp.total_amount, 0);
  const totalCollected = splits.reduce((s, sp) => s + sp.amount_paid, 0);
  const activeSplits = splits.filter((s) => s.status === 'ACTIVE' || s.status === 'PARTIALLY_PAID').length;
  const settledSplits = splits.filter((s) => s.status === 'SETTLED').length;
  const totalParticipants = splits.reduce((s, sp) => s + sp.participant_count, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Store className="h-5 w-5 text-primary-600" />
            <span className="text-sm font-semibold text-primary-600 uppercase tracking-wide">
              Merchant Management Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Verified Partner Destinations
          </h1>
        </div>
        <button
          onClick={() => setShowOnboardingModal(true)}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-primary-700 shadow-sm"
        >
          <Plus className="h-4 w-4" /> Register Merchant
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Merchant sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
              Verified Outlets ({merchants.length})
            </h3>
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
              {merchants.map((m) => (
                <button
                  key={m.id}
                  onClick={() => selectMerchant(m)}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all ${
                    selected?.id === m.id
                      ? 'bg-primary-50 border border-primary-200'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <CategoryIcon category={m.category} className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.display_name}</p>
                    <p className="text-[10px] text-slate-400">{m.city}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-5">
          {selected && (
            <>
              {/* Merchant Card */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                      <CategoryIcon category={selected.category} className="h-8 w-8 text-slate-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">{selected.display_name}</h2>
                      <p className="text-sm text-slate-400">{selected.legal_name || 'Verified Corporate Account'}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-success-600 font-semibold">
                          <ShieldCheck className="h-3.5 w-3.5" /> Verified
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="h-3 w-3" /> {selected.city}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {selected.rating}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-medium text-slate-400 uppercase">Destination ID</p>
                    <p className="font-mono text-sm font-bold text-slate-800">{selected.destination_id}</p>
                  </div>
                </div>

                {/* Sub-Tabs */}
                <div className="flex border-b border-slate-100 pt-2 space-x-6 text-xs font-bold text-slate-500">
                  {[
                    { id: 'overview', label: 'Overview & Activity' },
                    { id: 'payouts', label: 'Settlement & Payouts' },
                    { id: 'table_qr', label: 'Table QR Codes' },
                    { id: 'staff', label: 'Staff Roles' },
                    { id: 'refunds', label: 'Refund Requests' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as MerchantTab)}
                      className={`pb-3 border-b-2 transition ${
                        activeTab === tab.id
                          ? 'border-primary-600 text-primary-600'
                          : 'border-transparent hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab 1: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatBox icon={Receipt} label="Total Splits" value={splits.length.toString()} />
                    <StatBox icon={Users} label="Participants" value={totalParticipants.toString()} />
                    <StatBox icon={TrendingUp} label="Total Volume" value={formatMoney(totalVolume)} small />
                    <StatBox icon={CheckCircle2} label="Collected" value={formatMoney(totalCollected)} small />
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900">Incoming Split Activity</h3>
                      <button
                        onClick={exportCSV}
                        className="flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700"
                      >
                        <FileSpreadsheet className="h-4 w-4" /> Export CSV Report
                      </button>
                    </div>

                    {splits.length === 0 ? (
                      <div className="text-center py-8">
                        <Receipt className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No split activity yet for this merchant</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {splits.map((sp) => (
                          <div
                            key={sp.id}
                            className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-100"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-bold text-slate-900 text-sm">{sp.title}</p>
                                <StatusBadge status={sp.status} />
                              </div>
                              <p className="text-xs text-slate-400">
                                Ref: <strong className="font-mono text-slate-700">{sp.ref_code}</strong> · by {sp.organizer_name}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-extrabold text-slate-900 text-sm">{formatMoney(sp.total_amount)}</p>
                              <p className="text-xs text-success-600 font-semibold">{formatMoney(sp.amount_paid)} paid</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Settlement & Payouts */}
              {activeTab === 'payouts' && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6">
                  <h3 className="text-base font-extrabold text-slate-900">Payout Schedule & Settlement Profile</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-400 font-bold uppercase">Payout Schedule</p>
                      <p className="text-sm font-extrabold text-slate-900 mt-1">Daily at 5:00 PM EAT</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-400 font-bold uppercase">Payout Destination</p>
                      <p className="text-sm font-extrabold text-slate-900 mt-1">{selected.payment_rail || 'CRDB Corporate'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-400 font-bold uppercase">Next Settlement</p>
                      <p className="text-sm font-extrabold text-success-600 mt-1">{formatMoney(totalCollected)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Table QR Codes */}
              {activeTab === 'table_qr' && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Table QR Code Generator</h3>
                      <p className="text-xs text-slate-500">Generate printable split QR codes for each table.</p>
                    </div>
                    <select
                      value={selectedTable}
                      onChange={(e) => setSelectedTable(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                    >
                      {Array.from({ length: 20 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1)}>
                          Table #{i + 1}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <QrCode className="h-32 w-32 text-slate-900 mb-4" />
                    <p className="text-lg font-extrabold text-slate-900">{selected.display_name}</p>
                    <p className="text-xs font-bold text-primary-600">Table #{selectedTable} · LUMO Scan & Split</p>
                    <button
                      onClick={() => showToast(`Printing QR Code for Table #${selectedTable}...`)}
                      className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      <Download className="h-4 w-4" /> Download Printable PDF
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 4: Staff Roles */}
              {activeTab === 'staff' && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
                  <h3 className="text-base font-extrabold text-slate-900">Staff Access & Roles</h3>
                  <div className="space-y-3">
                    {staffList.map((st) => (
                      <div key={st.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3.5">
                        <div className="flex items-center gap-3">
                          <UserCheck className="h-5 w-5 text-primary-600" />
                          <div>
                            <p className="text-xs font-extrabold text-slate-900">{st.name}</p>
                            <p className="text-[11px] text-slate-500">{st.role} · {st.phone}</p>
                          </div>
                        </div>
                        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                          {st.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 5: Refunds */}
              {activeTab === 'refunds' && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center space-y-3">
                  <RefreshCw className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="text-sm font-bold text-slate-800">No pending refund requests</p>
                  <p className="text-xs text-slate-400">All settled payments are reconciled with your financial provider.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Onboarding Modal */}
      {showOnboardingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-scale-in">
            <h3 className="text-base font-extrabold text-slate-900 mb-4">Register Merchant Destination</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600">Business Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Samaki Samaki Oysterbay"
                  value={newMerchantName}
                  onChange={(e) => setNewMerchantName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Category</label>
                <select
                  value={newMerchantCategory}
                  onChange={(e) => setNewMerchantCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold outline-none focus:border-primary-500 bg-white"
                >
                  <option value="food_drinks">Food & Drinks</option>
                  <option value="hotel">Hotel & Accommodation</option>
                  <option value="shopping">Supermarket & Shopping</option>
                  <option value="bills_rent">Bills & Corporate Services</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">City</label>
                <input
                  type="text"
                  value={newMerchantCity}
                  onChange={(e) => setNewMerchantCity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold outline-none focus:border-primary-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowOnboardingModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegisterMerchant}
                  className="flex-1 rounded-xl bg-primary-600 py-2.5 text-xs font-bold text-white hover:bg-primary-700"
                >
                  Submit & Verify
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold text-white shadow-xl animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
}

function StatBox({ icon: Icon, label, value, small }: { icon: typeof Receipt; label: string; value: string; small?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-slate-50">
      <Icon className="h-4 w-4 text-slate-400 mb-1.5" />
      <p className={`font-extrabold text-slate-900 ${small ? 'text-sm' : 'text-lg'}`}>{value}</p>
      <p className="text-[10px] text-slate-400 font-medium">{label}</p>
    </div>
  );
}
