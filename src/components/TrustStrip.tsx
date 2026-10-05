import { ShieldCheck } from 'lucide-react';

type TrustStripProps = {
  merchantName?: string | null;
  destinationId?: string | null;
};

export default function TrustStrip({ merchantName, destinationId }: TrustStripProps) {
  const destination = merchantName || 'the verified destination';
  return (
    <div className="flex items-start gap-2 rounded-xl border border-success-100 bg-success-50 px-3.5 py-3 text-xs text-success-800">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
      <p>Paying directly to <span className="font-bold">{destination}</span>{destinationId ? ` (${destinationId})` : ''}. LUMO never holds your money.</p>
    </div>
  );
}
