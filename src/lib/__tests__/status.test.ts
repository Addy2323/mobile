import { describe, it, expect } from 'vitest';
import { getCalculatedSplitStatus } from '../status';

describe('getCalculatedSplitStatus', () => {
  it('must NEVER return Expired if no deadline exists', () => {
    const result = getCalculatedSplitStatus({
      total_amount: 100000,
      amount_paid: 0,
      participant_count: 1,
      deadline: null,
      expires_at: null,
    });
    expect(result.code).not.toBe('EXPIRED');
    expect(result.code).toBe('AWAITING_FRIENDS');
    expect(result.label).toBe('Awaiting friends');
  });

  it('must return Expired ONLY if deadline exists and has passed', () => {
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
    const result = getCalculatedSplitStatus({
      total_amount: 100000,
      amount_paid: 0,
      participant_count: 3,
      deadline: pastDate,
    });
    expect(result.code).toBe('EXPIRED');
    expect(result.label).toBe('Expired');
  });

  it('must return Awaiting friends if participant count is <= 1 and not expired', () => {
    const result = getCalculatedSplitStatus({
      total_amount: 50000,
      amount_paid: 0,
      participant_count: 1,
    });
    expect(result.code).toBe('AWAITING_FRIENDS');
    expect(result.label).toBe('Awaiting friends');
  });

  it('must return Partially paid when some amount is paid', () => {
    const result = getCalculatedSplitStatus({
      total_amount: 100000,
      amount_paid: 30000,
      participant_count: 4,
    });
    expect(result.code).toBe('PARTIALLY_PAID');
    expect(result.label).toContain('Partially paid');
  });

  it('must return Settled when amount_paid >= total_amount', () => {
    const result = getCalculatedSplitStatus({
      total_amount: 100000,
      amount_paid: 100000,
      participant_count: 4,
    });
    expect(result.code).toBe('SETTLED');
    expect(result.label).toBe('Settled');
  });
});
