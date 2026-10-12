// LUMO Split - Automated Partial Withdrawal & Financial Integrity Verification Suite

import pg from 'pg';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { WithdrawalService } from './withdrawalService.js';
import { LedgerService } from './ledgerService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lumosplit'
});

const JWT_SECRET = process.env.JWT_SECRET || 'lumo_jwt_secret_dev_key_2026';

async function runWithdrawalTests() {
  console.log('================================================================');
  console.log('🧪 LUMO SPLIT: PARTIAL WITHDRAWAL & FINANCIAL INTEGRITY TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------
    // UNIT TEST 1: WithdrawalService Financials Calculation
    // -------------------------------------------------------------
    console.log('▶ [Test 1] Authoritative Financial Calculation (TZS 50,000 available -> TZS 30,000 requested)');
    const calc = WithdrawalService.calculateWithdrawalFinancials(30000, 50000);

    assert(calc.requestedAmount === 30000, 'requestedAmount is preserved as 30,000');
    assert(calc.tierRate === 0.05, 'Configured fee rate is 5% for amounts <= 50,000');
    assert(calc.feeAmount === 1500, 'Fee amount is exactly TZS 1,500 (5% of 30,000)');
    assert(calc.netPayout === 28500, 'Net payout is exactly TZS 28,500 (30,000 - 1,500)');
    assert(calc.amountToReserve === 30000, 'Amount reserved is strictly 30,000 (never over-reserved or whole balance)');
    assert(calc.remainingAvailableBalance === 20000, 'Remaining available balance is strictly 20,000 (50,000 - 30,000)');

    // -------------------------------------------------------------
    // SETUP: Provision Test User A with exactly TZS 50,000
    // -------------------------------------------------------------
    console.log('\n▶ [Test 2] Provisioning Test User A with TZS 50,000 starting available balance');
    const phoneA = '+255761' + Math.floor(100000 + Math.random() * 900000);
    const { rows: [userA] } = await pool.query(
      `INSERT INTO users (phone, name, passcode_hash, status, account_type)
       VALUES ($1, 'Zahra Tester', 'hash_pw', 'ACTIVE', 'USER')
       RETURNING id, phone, name`,
      [phoneA]
    );

    await pool.query(
      `INSERT INTO user_balances (user_id, available_balance, pending_balance, reserved_balance, total_credits, total_debits, account_ref, tier)
       VALUES ($1, 50000, 0, 0, 50000, 0, 'LUMO-' || substring(md5(random()::text), 1, 8), 'STARTER')
       ON CONFLICT (user_id) DO UPDATE SET available_balance = 50000, reserved_balance = 0, total_debits = 0`,
      [userA.id]
    );

    const { rows: [initialBalA] } = await pool.query(
      'SELECT * FROM user_balances WHERE user_id = $1',
      [userA.id]
    );
    assert(Number(initialBalA.available_balance) === 50000, 'User A starts with exactly TZS 50,000 available balance');
    assert(Number(initialBalA.reserved_balance) === 0, 'User A starts with TZS 0 reserved balance');

    // -------------------------------------------------------------
    // TEST 3: User A Requests Partial Withdrawal of TZS 30,000
    // -------------------------------------------------------------
    console.log('\n▶ [Test 3] User A requests partial withdrawal of TZS 30,000');
    await client.query('BEGIN');

    const balCheck = await LedgerService.getOrCreateUserBalance(client, userA.id);
    const fin = WithdrawalService.calculateWithdrawalFinancials(30000, balCheck.available_balance);

    const refCodeA = `WTH-${Date.now().toString().slice(-6)}`;
    const idempotencyKeyA = `wth_test_${userA.id}_${Date.now()}`;

    // Reserve funds atomically
    await LedgerService.reserveFunds(client, {
      userId: userA.id,
      amount: fin.requestedAmount,
      transactionType: 'WITHDRAWAL_RESERVE',
      referenceType: 'WITHDRAWAL',
      referenceId: refCodeA,
      idempotencyKey: idempotencyKeyA,
      metadata: { requestedAmount: fin.requestedAmount, fee: fin.feeAmount, netPayout: fin.netPayout }
    });

    const { rows: [wthReqA] } = await client.query(
      `INSERT INTO withdrawal_requests (
        user_id, amount, fee, net_amount, currency, destination_type, destination_details, status, reference_code
      ) VALUES ($1, $2, $3, $4, $5, 'MOBILE_MONEY', $6, 'PENDING_REVIEW', $7)
      RETURNING *`,
      [
        userA.id,
        fin.requestedAmount,
        fin.feeAmount,
        fin.netPayout,
        fin.currency,
        JSON.stringify({ phone: userA.phone, name: userA.name }),
        refCodeA
      ]
    );

    await client.query('COMMIT');

    // Verify User A balance immediately after partial withdrawal request
    const { rows: [pendingBalA] } = await pool.query(
      'SELECT * FROM user_balances WHERE user_id = $1',
      [userA.id]
    );

    assert(Number(pendingBalA.available_balance) === 20000, 'Remaining available balance is strictly TZS 20,000 while request is pending');
    assert(Number(pendingBalA.reserved_balance) === 30000, 'Reserved balance is strictly TZS 30,000');
    assert(Number(wthReqA.amount) === 30000, 'Stored withdrawal_requests.amount is strictly 30,000 (NOT 50,000 full balance)');
    assert(Number(wthReqA.fee) === 1500, 'Stored fee is TZS 1,500');
    assert(Number(wthReqA.net_amount) === 28500, 'Stored net_amount is TZS 28,500');

    // -------------------------------------------------------------
    // TEST 4: Attempt Over-Withdrawal while Request is Pending
    // -------------------------------------------------------------
    console.log('\n▶ [Test 4] Attempting to withdraw TZS 25,000 when only TZS 20,000 remains available');
    let overWithdrawalBlocked = false;
    try {
      WithdrawalService.calculateWithdrawalFinancials(25000, pendingBalA.available_balance);
    } catch (err) {
      overWithdrawalBlocked = true;
      assert(err.message.includes('Insufficient available balance'), 'Over-withdrawal rejected with Insufficient available balance');
    }
    assert(overWithdrawalBlocked, 'System prevents withdrawing more than remaining available balance');

    // -------------------------------------------------------------
    // TEST 5: Admin Approves User A Withdrawal
    // -------------------------------------------------------------
    console.log('\n▶ [Test 5] Admin Approves User A withdrawal request');
    await client.query('BEGIN');

    await LedgerService.completeReservedDebit(client, {
      userId: userA.id,
      amount: Number(wthReqA.amount),
      transactionType: 'WITHDRAWAL_PAYOUT',
      referenceType: 'WITHDRAWAL',
      referenceId: wthReqA.reference_code,
      metadata: { adminApproval: true }
    });

    await client.query(
      `UPDATE withdrawal_requests SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
      [wthReqA.id]
    );

    await client.query('COMMIT');

    const { rows: [finalBalA] } = await pool.query(
      'SELECT * FROM user_balances WHERE user_id = $1',
      [userA.id]
    );

    assert(Number(finalBalA.available_balance) === 20000, 'Available balance REMAINS TZS 20,000 after admin payout completion');
    assert(Number(finalBalA.reserved_balance) === 0, 'Reserved balance drops to 0 after payout completion');
    assert(Number(finalBalA.total_debits) === 30000, 'Total debits accurately records TZS 30,000');

    // -------------------------------------------------------------
    // TEST 6: Rejection & Automatic Reservation Release
    // -------------------------------------------------------------
    console.log('\n▶ [Test 6] Rejection scenario: Test User B requests TZS 30,000, Admin Rejects -> Funds Released');
    const phoneB = '+255762' + Math.floor(100000 + Math.random() * 900000);
    const { rows: [userB] } = await pool.query(
      `INSERT INTO users (phone, name, passcode_hash, status, account_type)
       VALUES ($1, 'Baraka Tester', 'hash_pw', 'ACTIVE', 'USER')
       RETURNING id, phone, name`,
      [phoneB]
    );

    await pool.query(
      `INSERT INTO user_balances (user_id, available_balance, pending_balance, reserved_balance, total_credits, total_debits, account_ref, tier)
       VALUES ($1, 50000, 0, 0, 50000, 0, 'LUMO-' || substring(md5(random()::text), 1, 8), 'STARTER')`,
      [userB.id]
    );

    // Reserve 30,000 for User B
    const refCodeB = `WTH-${Date.now().toString().slice(-6)}`;
    await client.query('BEGIN');
    await LedgerService.reserveFunds(client, {
      userId: userB.id,
      amount: 30000,
      transactionType: 'WITHDRAWAL_RESERVE',
      referenceType: 'WITHDRAWAL',
      referenceId: refCodeB
    });
    const { rows: [wthReqB] } = await client.query(
      `INSERT INTO withdrawal_requests (user_id, amount, fee, net_amount, destination_type, destination_details, status, reference_code)
       VALUES ($1, 30000, 1500, 28500, 'BANK', '{"bank":"CRDB"}', 'PENDING_REVIEW', $2)
       RETURNING *`,
      [userB.id, refCodeB]
    );
    await client.query('COMMIT');

    // Admin rejects User B request
    await client.query('BEGIN');
    await LedgerService.releaseReservation(client, {
      userId: userB.id,
      amount: Number(wthReqB.amount),
      referenceType: 'WITHDRAWAL',
      referenceId: wthReqB.reference_code,
      metadata: { reason: 'Incorrect bank details' }
    });
    await client.query(
      `UPDATE withdrawal_requests SET status = 'REJECTED', rejection_reason = 'Incorrect bank details' WHERE id = $1`,
      [wthReqB.id]
    );
    await client.query('COMMIT');

    const { rows: [rejectedBalB] } = await pool.query(
      'SELECT * FROM user_balances WHERE user_id = $1',
      [userB.id]
    );
    assert(Number(rejectedBalB.available_balance) === 50000, 'Available balance is fully restored to TZS 50,000 upon rejection');
    assert(Number(rejectedBalB.reserved_balance) === 0, 'Reserved balance is reset to 0 upon rejection');

    // -------------------------------------------------------------
    // TEST 7: Cross-User Withdrawal Query Isolation
    // -------------------------------------------------------------
    console.log('\n▶ [Test 7] Multi-User Withdrawal Request Data Isolation');
    const { rows: userAWithdrawals } = await pool.query(
      'SELECT * FROM withdrawal_requests WHERE user_id = $1',
      [userA.id]
    );
    const { rows: userBWithdrawals } = await pool.query(
      'SELECT * FROM withdrawal_requests WHERE user_id = $1',
      [userB.id]
    );

    assert(userAWithdrawals.length === 1 && userAWithdrawals[0].id === wthReqA.id, 'User A only sees User A withdrawal');
    assert(userBWithdrawals.length === 1 && userBWithdrawals[0].id === wthReqB.id, 'User B only sees User B withdrawal');
    assert(userAWithdrawals.every(w => w.user_id === userA.id), 'Zero cross-user withdrawal request leakage');

    console.log(`\n================================================================`);
    console.log(`📊 TOTAL RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log(`================================================================\n`);

    if (failed === 0) {
      console.log('🎉 ALL PARTIAL WITHDRAWAL & FINANCIAL INVARIANTS PERFECTLY VERIFIED!');
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite encountered error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runWithdrawalTests();
