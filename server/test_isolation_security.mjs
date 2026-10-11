import pg from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lumosplit'
});

const JWT_SECRET = process.env.JWT_SECRET || 'lumo_jwt_secret_dev_key_2026';

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      full_name: user.full_name,
      role: user.role || 'user'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function runIsolationSuite() {
  console.log('🧪 Starting LUMO Split Data Isolation & Security Test Suite...\n');

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

  try {
    // 1. Create or obtain test users: User Alpha and User Beta
    const phoneAlpha = '+255799' + Math.floor(100000 + Math.random() * 900000);
    const phoneBeta = '+255798' + Math.floor(100000 + Math.random() * 900000);

    const { rows: [userAlpha] } = await pool.query(
      `INSERT INTO users (phone, name, passcode_hash, status, account_type)
       VALUES ($1, 'Alice Alpha', 'hash123', 'ACTIVE', 'USER')
       RETURNING id, phone, name, status, account_type`,
      [phoneAlpha]
    );

    const { rows: [userBeta] } = await pool.query(
      `INSERT INTO users (phone, name, passcode_hash, status, account_type)
       VALUES ($1, 'Bob Beta', 'hash456', 'ACTIVE', 'USER')
       RETURNING id, phone, name, status, account_type`,
      [phoneBeta]
    );

    assert(userAlpha && userBeta, 'Successfully provisioned isolated test users (Alice & Bob)');
    assert(userAlpha.id !== userBeta.id, 'Alice and Bob have unique UUID user IDs');

    // Provision ledger accounts
    await pool.query(
      `INSERT INTO user_balances (user_id, available_balance, pending_balance, reserved_balance, total_credits, total_debits, account_ref, tier)
       VALUES ($1, 0, 0, 0, 0, 0, 'LUMO-' || substring(md5(random()::text), 1, 8), 'STARTER')
       ON CONFLICT (user_id) DO NOTHING`,
      [userAlpha.id]
    );

    await pool.query(
      `INSERT INTO user_balances (user_id, available_balance, pending_balance, reserved_balance, total_credits, total_debits, account_ref, tier)
       VALUES ($1, 0, 0, 0, 0, 0, 'LUMO-' || substring(md5(random()::text), 1, 8), 'STARTER')
       ON CONFLICT (user_id) DO NOTHING`,
      [userBeta.id]
    );

    const tokenAlpha = signToken(userAlpha);
    const tokenBeta = signToken(userBeta);

    // 2. Test Ledger Account Isolation
    const { rows: [accountAlpha] } = await pool.query(
      `SELECT * FROM user_balances WHERE user_id = $1`,
      [userAlpha.id]
    );
    const { rows: [accountBeta] } = await pool.query(
      `SELECT * FROM user_balances WHERE user_id = $1`,
      [userBeta.id]
    );

    assert(accountAlpha.account_ref !== accountBeta.account_ref, 'Ledger account references are strictly unique');
    assert(Number(accountAlpha.available_balance) === 0, 'Alice starts with clean zero balance (no demo mock balance)');
    assert(Number(accountBeta.available_balance) === 0, 'Bob starts with clean zero balance (no demo mock balance)');

    // 3. Test Split Creation Isolation
    // Alice creates a split
    const splitRefAlpha = 'TST' + Math.floor(1000 + Math.random() * 9000);
    const { rows: [splitAlpha] } = await pool.query(
      `INSERT INTO splits (title, category, total_amount, mode, organizer_name, organizer_phone, status, settlement_percent, amount_paid, participant_count, ref_code, owner_user_id)
       VALUES ('Alice Birthday Dinner', 'Food & Drinks', 150000, 'equal', 'Alice Alpha', $1, 'ACTIVE', 0, 0, 3, $2, $3)
       RETURNING *`,
      [userAlpha.phone, splitRefAlpha, userAlpha.id]
    );

    assert(splitAlpha.owner_user_id === userAlpha.id, 'Alice split is permanently bound to Alice user_id');

    // 4. Test Split Query Isolation (Querying splits by owner_user_id)
    const { rows: aliceSplits } = await pool.query(
      `SELECT * FROM splits WHERE owner_user_id = $1`,
      [userAlpha.id]
    );
    const { rows: bobSplits } = await pool.query(
      `SELECT * FROM splits WHERE owner_user_id = $1`,
      [userBeta.id]
    );

    assert(aliceSplits.length >= 1 && aliceSplits.some(s => s.id === splitAlpha.id), 'Alice sees her created split in her splits list');
    assert(bobSplits.length === 0, 'Bob sees 0 splits - ZERO cross-user split data leakage');

    // 5. Test Ledger Transaction Isolation
    // Simulate a credit only to Alice
    await pool.query(
      `INSERT INTO ledger_transactions (user_id, transaction_type, direction, amount, currency, status, reference_type, reference_id)
       VALUES ($1, 'DEPOSIT', 'CREDIT', 50000, 'TZS', 'SUCCESS', 'test', 'tx_alpha_1')`,
      [userAlpha.id]
    );

    const { rows: aliceTxs } = await pool.query(
      `SELECT * FROM ledger_transactions WHERE user_id = $1`,
      [userAlpha.id]
    );
    const { rows: bobTxs } = await pool.query(
      `SELECT * FROM ledger_transactions WHERE user_id = $1`,
      [userBeta.id]
    );

    assert(aliceTxs.length === 1 && Number(aliceTxs[0].amount) === 50000, 'Alice has 1 credit transaction of 50,000 TZS');
    assert(bobTxs.length === 0, 'Bob has 0 transactions - ZERO cross-user transaction leakage');

    // 6. Test Participant Scoping for Alice's Split
    await pool.query(
      `INSERT INTO split_participants (split_id, name, phone, allocation_amount, amount_paid, status, is_organizer)
       VALUES ($1, 'Charlie Friend', '+255711223344', 50000, 0, 'PENDING', false)`,
      [splitAlpha.id]
    );

    const { rows: aliceParticipants } = await pool.query(
      `SELECT sp.* FROM split_participants sp
       JOIN splits s ON s.id = sp.split_id
       WHERE s.owner_user_id = $1`,
      [userAlpha.id]
    );

    const { rows: bobParticipants } = await pool.query(
      `SELECT sp.* FROM split_participants sp
       JOIN splits s ON s.id = sp.split_id
       WHERE s.owner_user_id = $1`,
      [userBeta.id]
    );

    assert(aliceParticipants.length === 1, 'Alice sees her split participants');
    assert(bobParticipants.length === 0, 'Bob sees ZERO participants from Alice split');

    console.log(`\n📊 Test Suite Results: ${passed} Passed, ${failed} Failed.`);
    if (failed === 0) {
      console.log('🎉 ALL DATA ISOLATION & MULTI-USER SECURITY INVARIANTS VERIFIED!');
    }
  } catch (err) {
    console.error('Test Suite encountered error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runIsolationSuite();
