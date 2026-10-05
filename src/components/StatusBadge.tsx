type StatusBadgeProps = {
  status: string;
  type?: 'split' | 'participant';
  size?: 'sm' | 'md';
};

const splitColors: Record<string, string> = {
  ACTIVE: 'bg-primary-50 text-primary-700 border-primary-200',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700 border-amber-200',
  SETTLED: 'bg-success-50 text-success-700 border-success-200',
  EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
  CANCELLED: 'bg-error-50 text-error-700 border-error-200',
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  DISPUTED: 'bg-error-50 text-error-700 border-error-200',
};

const participantColors: Record<string, string> = {
  INVITED: 'bg-slate-100 text-slate-600 border-slate-200',
  VIEWED: 'bg-primary-50 text-primary-600 border-primary-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PAYMENT_PROCESSING: 'bg-primary-50 text-primary-700 border-primary-200',
  PAID: 'bg-success-50 text-success-700 border-success-200',
  FAILED: 'bg-error-50 text-error-700 border-error-200',
  EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
  CANCELLED: 'bg-error-50 text-error-700 border-error-200',
  REFUNDED: 'bg-warning-50 text-warning-700 border-warning-200',
  REVERSED: 'bg-warning-50 text-warning-700 border-warning-200',
};

const splitLabels: Record<string, string> = {
  ACTIVE: 'Active',
  PARTIALLY_PAID: 'Partially Paid',
  SETTLED: 'Settled',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  DRAFT: 'Draft',
  DISPUTED: 'Disputed',
};

const participantLabels: Record<string, string> = {
  INVITED: 'Invited',
  VIEWED: 'Viewed',
  PENDING: 'Pending',
  PAYMENT_PROCESSING: 'Processing',
  PAID: 'Paid',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  REVERSED: 'Reversed',
};

export default function StatusBadge({ status, type = 'split', size = 'sm' }: StatusBadgeProps) {
  const colors = type === 'split' ? splitColors : participantColors;
  const labels = type === 'split' ? splitLabels : participantLabels;

  const colorClass = colors[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  const label = labels[status] || status;
  const sizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${colorClass} ${sizeClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${colorClass.includes('success') ? 'bg-success-500' : colorClass.includes('amber') ? 'bg-amber-500' : colorClass.includes('error') ? 'bg-error-500' : colorClass.includes('primary') ? 'bg-primary-500' : 'bg-slate-400'}`} />
      {label}
    </span>
  );
}
