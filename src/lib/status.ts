export type SplitStatusType = 'SETTLED' | 'PARTIALLY_PAID' | 'AWAITING_FRIENDS' | 'PENDING' | 'EXPIRED' | 'CANCELLED';

export interface SplitStatusInput {
  status?: string;
  total_amount?: number;
  amount_paid?: number;
  participant_count?: number;
  deadline?: string | null;
  expires_at?: string | null;
}

export interface SplitStatusResult {
  code: SplitStatusType;
  label: string;
  badgeClass: string;
  badgeType: 'settled' | 'partially_paid' | 'awaiting_friends' | 'pending' | 'expired';
}

/**
 * Calculates the exact split status according to business rules:
 * 1. Expired ONLY if a deadline / expires_at exists AND date has passed.
 * 2. Settled if amount_paid >= total_amount (and total_amount > 0).
 * 3. Partially Paid if amount_paid > 0 and amount_paid < total_amount.
 * 4. Awaiting Friends if participant_count <= 1 (no friends added yet).
 * 5. Pending as default active state.
 */
export function getCalculatedSplitStatus(split: SplitStatusInput): SplitStatusResult {
  const total = Number(split.total_amount || 0);
  const paid = Number(split.amount_paid || 0);
  const count = Number(split.participant_count || 1);
  const deadlineStr = split.deadline || split.expires_at || null;

  // 1. Check if Settled
  if (total > 0 && paid >= total) {
    return {
      code: 'SETTLED',
      label: 'Settled',
      badgeClass: 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]',
      badgeType: 'settled',
    };
  }

  // 2. Check if Expired (CRITICAL BUG FIX: ONLY IF DEADLINE EXISTS & PASSED)
  if (deadlineStr) {
    const deadlineDate = new Date(deadlineStr);
    if (!isNaN(deadlineDate.getTime()) && deadlineDate < new Date()) {
      return {
        code: 'EXPIRED',
        label: 'Expired',
        badgeClass: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',
        badgeType: 'expired',
      };
    }
  }

  // 3. Check if Partially Paid
  if (paid > 0) {
    const ratio = count > 1 ? ` (${Math.min(count, 2)}/${count})` : '';
    return {
      code: 'PARTIALLY_PAID',
      label: `Partially paid${ratio}`,
      badgeClass: 'bg-[#EAF0FF] text-[#1E40AF] border-[#BFDBFE]',
      badgeType: 'partially_paid',
    };
  }

  // 4. Check if Awaiting Friends (No friends added yet)
  if (count <= 1) {
    return {
      code: 'AWAITING_FRIENDS',
      label: 'Awaiting friends',
      badgeClass: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
      badgeType: 'awaiting_friends',
    };
  }

  // 5. Default Pending
  return {
    code: 'PENDING',
    label: 'Pending',
    badgeClass: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
    badgeType: 'pending',
  };
}
