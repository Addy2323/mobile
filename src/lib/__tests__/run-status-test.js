import assert from 'node:assert';
import { getCalculatedSplitStatus } from '../status.ts';

console.log('Running Status Rule Unit Tests...');

// 1. Must NEVER return Expired if no deadline exists
const test1 = getCalculatedSplitStatus({
  total_amount: 100000,
  amount_paid: 0,
  participant_count: 1,
  deadline: null,
  expires_at: null,
});
assert.notStrictEqual(test1.code, 'EXPIRED', 'Must not be EXPIRED when no deadline');
assert.strictEqual(test1.code, 'AWAITING_FRIENDS', 'Must be AWAITING_FRIENDS');
console.log('✅ Test 1 Passed: No deadline => Never Expired (Awaiting friends)');

// 2. Must return Expired ONLY if deadline exists & passed
const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
const test2 = getCalculatedSplitStatus({
  total_amount: 100000,
  amount_paid: 0,
  participant_count: 3,
  deadline: pastDate,
});
assert.strictEqual(test2.code, 'EXPIRED', 'Must be EXPIRED when deadline passed');
console.log('✅ Test 2 Passed: Deadline passed => Expired');

// 3. Must return Awaiting friends if participant_count <= 1
const test3 = getCalculatedSplitStatus({
  total_amount: 50000,
  amount_paid: 0,
  participant_count: 1,
});
assert.strictEqual(test3.code, 'AWAITING_FRIENDS', 'Must be AWAITING_FRIENDS');
console.log('✅ Test 3 Passed: 1 participant => Awaiting friends');

// 4. Must return Partially paid when amount_paid > 0
const test4 = getCalculatedSplitStatus({
  total_amount: 100000,
  amount_paid: 40000,
  participant_count: 4,
});
assert.strictEqual(test4.code, 'PARTIALLY_PAID', 'Must be PARTIALLY_PAID');
console.log('✅ Test 4 Passed: Partial payment => Partially paid');

// 5. Must return Settled when amount_paid >= total_amount
const test5 = getCalculatedSplitStatus({
  total_amount: 100000,
  amount_paid: 100000,
  participant_count: 4,
});
assert.strictEqual(test5.code, 'SETTLED', 'Must be SETTLED');
console.log('✅ Test 5 Passed: Fully paid => Settled');

console.log('🎉 ALL 5 STATUS UNIT TESTS PASSED SUCCESSFULLY!');
