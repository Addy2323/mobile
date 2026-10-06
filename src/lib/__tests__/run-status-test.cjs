const assert = require('node:assert');

// Implementation of status logic to verify
function getCalculatedSplitStatus(split) {
  const total = Number(split.total_amount || 0);
  const paid = Number(split.amount_paid || 0);
  const count = Number(split.participant_count || 1);
  const deadlineStr = split.deadline || split.expires_at || null;

  if (total > 0 && paid >= total) {
    return { code: 'SETTLED', label: 'Settled' };
  }

  // 1. Expired ONLY if deadline exists and has passed
  if (deadlineStr) {
    const deadlineDate = new Date(deadlineStr);
    if (!isNaN(deadlineDate.getTime()) && deadlineDate < new Date()) {
      return { code: 'EXPIRED', label: 'Expired' };
    }
  }

  // 2. Partially Paid
  if (paid > 0) {
    return { code: 'PARTIALLY_PAID', label: 'Partially paid' };
  }

  // 3. Awaiting Friends (No friends added yet)
  if (count <= 1) {
    return { code: 'AWAITING_FRIENDS', label: 'Awaiting friends' };
  }

  return { code: 'PENDING', label: 'Pending' };
}

console.log('Running Status Rule Unit Tests...');

// Test 1: No deadline => Never Expired (Awaiting friends)
const test1 = getCalculatedSplitStatus({ total_amount: 100000, amount_paid: 0, participant_count: 1, deadline: null });
assert.notStrictEqual(test1.code, 'EXPIRED', 'Must not be EXPIRED when no deadline');
assert.strictEqual(test1.code, 'AWAITING_FRIENDS', 'Must be AWAITING_FRIENDS');
console.log('✅ Test 1 Passed: No deadline => Never Expired (Awaiting friends)');

// Test 2: Deadline passed => Expired
const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
const test2 = getCalculatedSplitStatus({ total_amount: 100000, amount_paid: 0, participant_count: 3, deadline: pastDate });
assert.strictEqual(test2.code, 'EXPIRED', 'Must be EXPIRED when deadline passed');
console.log('✅ Test 2 Passed: Deadline passed => Expired');

// Test 3: 1 participant => Awaiting friends
const test3 = getCalculatedSplitStatus({ total_amount: 50000, amount_paid: 0, participant_count: 1 });
assert.strictEqual(test3.code, 'AWAITING_FRIENDS', 'Must be AWAITING_FRIENDS');
console.log('✅ Test 3 Passed: 1 participant => Awaiting friends');

// Test 4: Partial payment => Partially paid
const test4 = getCalculatedSplitStatus({ total_amount: 100000, amount_paid: 40000, participant_count: 4 });
assert.strictEqual(test4.code, 'PARTIALLY_PAID', 'Must be PARTIALLY_PAID');
console.log('✅ Test 4 Passed: Partial payment => Partially paid');

// Test 5: Fully paid => Settled
const test5 = getCalculatedSplitStatus({ total_amount: 100000, amount_paid: 100000, participant_count: 4 });
assert.strictEqual(test5.code, 'SETTLED', 'Must be SETTLED');
console.log('✅ Test 5 Passed: Fully paid => Settled');

console.log('🎉 ALL 5 STATUS UNIT TESTS PASSED SUCCESSFULLY!');
