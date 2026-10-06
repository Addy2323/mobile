import React from 'react';
import { Check, Clock, X, Banknote, AlertCircle, UserPlus } from 'lucide-react';

type StatusBadgeProps = {
  status: string;
  type?: 'split' | 'participant';
  size?: 'sm' | 'md';
  customLabel?: string;
};

export default function StatusBadge({ status, type = 'split', size = 'sm', customLabel }: StatusBadgeProps) {
  const normStatus = (status || 'PENDING').toUpperCase();

  const getStyleAndIcon = () => {
    switch (normStatus) {
      case 'SETTLED':
      case 'PAID':
        return {
          bgClass: 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]',
          icon: <Check className="w-3 h-3 stroke-[3px]" />,
          label: 'Paid',
        };
      case 'AWAITING_FRIENDS':
        return {
          bgClass: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
          icon: <Clock className="w-3 h-3 stroke-[2.5px]" />,
          label: 'Awaiting friends',
        };
      case 'PENDING':
      case 'ACTIVE':
      case 'INVITED':
        return {
          bgClass: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
          icon: <Clock className="w-3 h-3 stroke-[2.5px]" />,
          label: 'Pending',
        };
      case 'PARTIALLY_PAID':
        return {
          bgClass: 'bg-[#EAF0FF] text-[#1E40AF] border-[#BFDBFE]',
          icon: <Clock className="w-3 h-3 stroke-[2.5px]" />,
          label: 'Partially Paid',
        };
      case 'FAILED':
      case 'DISPUTED':
      case 'CANCELLED':
        return {
          bgClass: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FCA5A5]',
          icon: <X className="w-3 h-3 stroke-[3px]" />,
          label: 'Failed',
        };
      case 'CASH':
        return {
          bgClass: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
          icon: <Banknote className="w-3 h-3 stroke-[2.5px]" />,
          label: 'Cash',
        };
      case 'EXPIRED':
      default:
        return {
          bgClass: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',
          icon: <AlertCircle className="w-3 h-3 stroke-[2px]" />,
          label: 'Expired',
        };
    }
  };

  const badgeInfo = getStyleAndIcon();
  const labelText = customLabel || badgeInfo.label;
  const sizeClass = size === 'sm' ? 'text-[10px] px-2.5 py-0.5' : 'text-xs px-3 py-1';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-extrabold ${badgeInfo.bgClass} ${sizeClass}`}>
      {badgeInfo.icon}
      <span>{labelText}</span>
    </span>
  );
}
