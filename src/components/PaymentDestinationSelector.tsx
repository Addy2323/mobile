import React, { useState } from 'react';
import { Smartphone, Building2, CreditCard, QrCode, ShieldCheck, Check, AlertCircle, Sparkles } from 'lucide-react';

export type DestinationType = 'PHONE' | 'LIPA_NUMBER' | 'BANK_ACCOUNT' | 'QR' | 'CARD';
export type BankName = 'NMB' | 'CRDB' | 'OTHER_BANK';

export interface PaymentDestinationConfig {
  type: DestinationType;
  provider: string;
  display_name: string;
  phone_number?: string;
  lipa_number?: string;
  bank_name?: BankName;
  account_number?: string;
  beneficiary_full_name?: string;
  qr_reference?: string;
  card_reference?: string;
}

interface PaymentDestinationSelectorProps {
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  destination: PaymentDestinationConfig | null;
  onChange: (dest: PaymentDestinationConfig | null) => void;
  title?: string;
}

export const PaymentDestinationSelector: React.FC<PaymentDestinationSelectorProps> = ({
  enabled,
  onToggleEnabled,
  destination,
  onChange,
  title = 'Payment Destination',
}) => {
  const [type, setType] = useState<DestinationType>(destination?.type || 'PHONE');
  const [phone, setPhone] = useState(destination?.phone_number || '');
  const [lipaNumber, setLipaNumber] = useState(destination?.lipa_number || '');
  const [bankName, setBankName] = useState<BankName>(destination?.bank_name || 'NMB');
  const [accountNumber, setAccountNumber] = useState(destination?.account_number || '');
  const [beneficiaryName, setBeneficiaryName] = useState(destination?.beneficiary_full_name || '');
  const [qrRef, setQrRef] = useState(destination?.qr_reference || '');
  const [cardRef, setCardRef] = useState(destination?.card_reference || '');

  const updateDestination = (updates: Partial<PaymentDestinationConfig>) => {
    const nextType = updates.type || type;
    const nextPhone = updates.phone_number !== undefined ? updates.phone_number : phone;
    const nextLipa = updates.lipa_number !== undefined ? updates.lipa_number : lipaNumber;
    const nextBank = updates.bank_name !== undefined ? updates.bank_name : bankName;
    const nextAcc = updates.account_number !== undefined ? updates.account_number : accountNumber;
    const nextBen = updates.beneficiary_full_name !== undefined ? updates.beneficiary_full_name : beneficiaryName;
    const nextQr = updates.qr_reference !== undefined ? updates.qr_reference : qrRef;
    const nextCard = updates.card_reference !== undefined ? updates.card_reference : cardRef;

    let provider = 'MOBILE_MONEY';
    let displayName = 'Payment Destination';

    if (nextType === 'PHONE') {
      provider = 'MOBILE_MONEY';
      displayName = `Mobile Money (${nextPhone || 'Phone'})`;
    } else if (nextType === 'LIPA_NUMBER') {
      provider = 'LIPA_NAMBA';
      displayName = `Lipa Namba ${nextLipa}`;
    } else if (nextType === 'BANK_ACCOUNT') {
      provider = nextBank;
      displayName = `${nextBank} Account (${nextAcc ? '••••' + nextAcc.slice(-4) : 'Bank'})`;
    } else if (nextType === 'QR') {
      provider = 'QR_PAYMENT';
      displayName = `QR Reference ${nextQr || 'Configured'}`;
    } else if (nextType === 'CARD') {
      provider = 'CARD_PAYMENT';
      displayName = `Card Settlement (${nextCard || 'Configured'})`;
    }

    onChange({
      type: nextType,
      provider,
      display_name: displayName,
      phone_number: nextPhone,
      lipa_number: nextLipa,
      bank_name: nextBank,
      account_number: nextAcc,
      beneficiary_full_name: nextBen,
      qr_reference: nextQr,
      card_reference: nextCard,
    });
  };

  return (
    <div className="bg-[#0C181A] p-4 sm:p-5 rounded-3xl border border-white/10 shadow-xl space-y-4 text-white">
      {/* Header Toggle */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-xl transition-colors ${enabled ? 'bg-[#00E599]/15 text-[#00E599]' : 'bg-white/5 text-white/40'}`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-sm">{title}</h3>
            <p className="text-[11px] text-white/60 font-medium">
              {enabled ? 'Direct payout to your verified account' : 'Using default LUMO collection flow'}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          onClick={() => onToggleEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            enabled ? 'bg-[#00E599]' : 'bg-white/20'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
              enabled ? 'translate-x-6 bg-[#060D0E]' : 'translate-x-1 bg-white'
            }`}
          />
        </button>
      </div>

      {!enabled ? (
        <div className="p-3.5 bg-[#081214] border border-amber-500/20 rounded-2xl flex items-start space-x-2.5 text-xs text-amber-200/90">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300 block">Destination Routing OFF</span>
            <p className="text-[11px] text-white/60 mt-0.5 leading-relaxed">
              Collected funds will route into default LUMO platform collection and settled upon request. Turn ON to specify instant direct payouts.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Destination Type Selector Tabs */}
          <div>
            <label className="text-xs font-extrabold text-white/80 block mb-2">Payout Destination Type</label>
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-[#081214] border border-white/10 rounded-2xl text-[11px] font-extrabold">
              <button
                type="button"
                onClick={() => { setType('PHONE'); updateDestination({ type: 'PHONE' }); }}
                className={`py-2 rounded-xl flex flex-col items-center justify-center space-y-1 transition-all ${
                  type === 'PHONE' ? 'bg-[#00E599] text-[#060D0E] font-black shadow-md' : 'text-white/60 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Phone</span>
              </button>

              <button
                type="button"
                onClick={() => { setType('LIPA_NUMBER'); updateDestination({ type: 'LIPA_NUMBER' }); }}
                className={`py-2 rounded-xl flex flex-col items-center justify-center space-y-1 transition-all ${
                  type === 'LIPA_NUMBER' ? 'bg-[#00E599] text-[#060D0E] font-black shadow-md' : 'text-white/60 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Lipa</span>
              </button>

              <button
                type="button"
                onClick={() => { setType('BANK_ACCOUNT'); updateDestination({ type: 'BANK_ACCOUNT' }); }}
                className={`py-2 rounded-xl flex flex-col items-center justify-center space-y-1 transition-all ${
                  type === 'BANK_ACCOUNT' ? 'bg-[#00E599] text-[#060D0E] font-black shadow-md' : 'text-white/60 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Bank</span>
              </button>

              <button
                type="button"
                onClick={() => { setType('QR'); updateDestination({ type: 'QR' }); }}
                className={`py-2 rounded-xl flex flex-col items-center justify-center space-y-1 transition-all ${
                  type === 'QR' ? 'bg-[#00E599] text-[#060D0E] font-black shadow-md' : 'text-white/60 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => { setType('CARD'); updateDestination({ type: 'CARD' }); }}
                className={`py-2 rounded-xl flex flex-col items-center justify-center space-y-1 transition-all ${
                  type === 'CARD' ? 'bg-[#00E599] text-[#060D0E] font-black shadow-md' : 'text-white/60 hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Card</span>
              </button>
            </div>
          </div>

          {/* Form Fields based on Type */}
          {type === 'PHONE' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/80 block">Mobile Money Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); updateDestination({ phone_number: e.target.value }); }}
                placeholder="0754 123 456 (M-Pesa, Tigo, Airtel, Halo)"
                className="w-full px-3.5 py-2.5 bg-[#081214] border border-white/10 rounded-xl font-bold text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
              />
            </div>
          )}

          {type === 'LIPA_NUMBER' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/80 block">Lipa Namba Code</label>
              <input
                type="text"
                value={lipaNumber}
                onChange={(e) => { setLipaNumber(e.target.value); updateDestination({ lipa_number: e.target.value }); }}
                placeholder="e.g. 1234567"
                className="w-full px-3.5 py-2.5 bg-[#081214] border border-white/10 rounded-xl font-bold text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
              />
            </div>
          )}

          {type === 'BANK_ACCOUNT' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-white/80 block mb-1">Select Bank</label>
                  <select
                    value={bankName}
                    onChange={(e) => {
                      const b = e.target.value as BankName;
                      setBankName(b);
                      updateDestination({ bank_name: b });
                    }}
                    className="w-full px-3.5 py-2.5 bg-[#081214] border border-white/10 rounded-xl font-extrabold text-xs text-white focus:outline-none focus:border-[#00E599]"
                  >
                    <option value="NMB" className="bg-[#0C181A] text-white">NMB Bank</option>
                    <option value="CRDB" className="bg-[#0C181A] text-white">CRDB Bank</option>
                    <option value="OTHER_BANK" className="bg-[#0C181A] text-white">Other Bank</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-white/80 block mb-1">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => { setAccountNumber(e.target.value); updateDestination({ account_number: e.target.value }); }}
                    placeholder="Account Number"
                    className="w-full px-3.5 py-2.5 bg-[#081214] border border-white/10 rounded-xl font-bold text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">Beneficiary Full Name</label>
                <input
                  type="text"
                  value={beneficiaryName}
                  onChange={(e) => { setBeneficiaryName(e.target.value); updateDestination({ beneficiary_full_name: e.target.value }); }}
                  placeholder="e.g. Kevin Joseph Michael"
                  className="w-full px-3.5 py-2.5 bg-[#081214] border border-white/10 rounded-xl font-bold text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                />
              </div>
            </div>
          )}

          {type === 'QR' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/80 block">QR Reference Code / Payload</label>
              <input
                type="text"
                value={qrRef}
                onChange={(e) => { setQrRef(e.target.value); updateDestination({ qr_reference: e.target.value }); }}
                placeholder="e.g. LUMO-QR-9901"
                className="w-full px-3.5 py-2.5 bg-[#081214] border border-white/10 rounded-xl font-bold text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
              />
            </div>
          )}

          {type === 'CARD' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/80 block">Merchant Card Settlement Reference</label>
              <input
                type="text"
                value={cardRef}
                onChange={(e) => { setCardRef(e.target.value); updateDestination({ card_reference: e.target.value }); }}
                placeholder="e.g. CARD-SETTLE-REF-001"
                className="w-full px-3.5 py-2.5 bg-[#081214] border border-white/10 rounded-xl font-bold text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
              />
              <p className="text-[10px] text-white/40 font-semibold">
                🔒 Security Note: Card settlements route securely via PCI-DSS compliant payment gateways. Never input raw CVVs.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
