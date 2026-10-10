// LUMO Double-Entry Ledger Service

export const VIP_TIERS = {
  STARTER: { name: 'LUMO Starter', minTx: 0, color: 'blue' },
  GREEN: { name: 'LUMO Green', minTx: 10, color: 'emerald' },
  PRO: { name: 'LUMO Pro', minTx: 20, color: 'dark-emerald' },
  ELITE: { name: 'LUMO Elite', minTx: 50, color: 'metallic-emerald' },
  VVIP: { name: 'LUMO VVIP', minTx: 100, color: 'gold-black' }
};

export function calculateVipTier(qualifyingTxCount = 0) {
  if (qualifyingTxCount >= 100) return 'VVIP';
  if (qualifyingTxCount >= 50) return 'ELITE';
  if (qualifyingTxCount >= 20) return 'PRO';
  if (qualifyingTxCount >= 10) return 'GREEN';
  return 'STARTER';
}

function generateAccountRef() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `LUMO-••••${num}`;
}

export class LedgerService {
  static async getOrCreateUserBalance(client, userId) {
    if (!userId) throw new Error('userId is required');

    const res = await client.query('SELECT * FROM user_balances WHERE user_id = $1 FOR UPDATE', [userId]);
    if (res.rows.length > 0) {
      return res.rows[0];
    }

    const accountRef = generateAccountRef();
    const insertRes = await client.query(
      `INSERT INTO user_balances (user_id, available_balance, pending_balance, reserved_balance, total_credits, total_debits, tier, qualifying_tx_count, account_ref)
       VALUES ($1, 0.00, 0.00, 0.00, 0.00, 0.00, 'STARTER', 0, $2)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [userId, accountRef]
    );

    return insertRes.rows[0];
  }

  static async postCredit(client, {
    userId,
    amount,
    transactionType,
    referenceType = 'GENERAL',
    referenceId = null,
    providerTxRef = null,
    idempotencyKey = null,
    metadata = {}
  }) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Invalid credit amount');
    }

    // Check idempotency if key is provided
    if (idempotencyKey) {
      const existingTx = await client.query('SELECT * FROM ledger_transactions WHERE idempotency_key = $1', [idempotencyKey]);
      if (existingTx.rows.length > 0) {
        return { duplicate: true, transaction: existingTx.rows[0] };
      }
    }

    const currentBalance = await this.getOrCreateUserBalance(client, userId);
    const newTxCount = (currentBalance.qualifying_tx_count || 0) + 1;
    const newTier = calculateVipTier(newTxCount);

    // Update user balance record
    const updatedBalanceRes = await client.query(
      `UPDATE user_balances
       SET available_balance = available_balance + $1,
           total_credits = total_credits + $1,
           qualifying_tx_count = $2,
           tier = $3,
           updated_at = NOW()
       WHERE user_id = $4
       RETURNING *`,
      [numAmount, newTxCount, newTier, userId]
    );

    // Record immutable ledger entry
    const ledgerRes = await client.query(
      `INSERT INTO ledger_transactions (user_id, transaction_type, direction, amount, currency, status, reference_type, reference_id, provider_tx_ref, idempotency_key, metadata)
       VALUES ($1, $2, 'CREDIT', $3, 'TZS', 'COMPLETED', $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, transactionType, numAmount, referenceType, referenceId, providerTxRef, idempotencyKey, metadata]
    );

    return {
      balance: updatedBalanceRes.rows[0],
      transaction: ledgerRes.rows[0]
    };
  }

  static async reserveFunds(client, {
    userId,
    amount,
    transactionType,
    referenceType = 'WITHDRAWAL',
    referenceId = null,
    idempotencyKey = null,
    metadata = {}
  }) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Invalid reservation amount');
    }

    if (idempotencyKey) {
      const existing = await client.query('SELECT * FROM ledger_transactions WHERE idempotency_key = $1', [idempotencyKey]);
      if (existing.rows.length > 0) {
        return { duplicate: true, transaction: existing.rows[0] };
      }
    }

    const balance = await this.getOrCreateUserBalance(client, userId);
    if (Number(balance.available_balance) < numAmount) {
      throw new Error(`Insufficient funds. Available: TZS ${balance.available_balance}, Requested: TZS ${numAmount}`);
    }

    const updatedBalanceRes = await client.query(
      `UPDATE user_balances
       SET available_balance = available_balance - $1,
           reserved_balance = reserved_balance + $1,
           updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [numAmount, userId]
    );

    const ledgerRes = await client.query(
      `INSERT INTO ledger_transactions (user_id, transaction_type, direction, amount, currency, status, reference_type, reference_id, idempotency_key, metadata)
       VALUES ($1, $2, 'DEBIT', $3, 'TZS', 'PENDING', $4, $5, $6, $7)
       RETURNING *`,
      [userId, transactionType, numAmount, referenceType, referenceId, idempotencyKey, metadata]
    );

    return {
      balance: updatedBalanceRes.rows[0],
      transaction: ledgerRes.rows[0]
    };
  }

  static async releaseReservation(client, { userId, amount, referenceType, referenceId, metadata = {} }) {
    const numAmount = Number(amount);

    const updatedBalanceRes = await client.query(
      `UPDATE user_balances
       SET available_balance = available_balance + $1,
           reserved_balance = GREATEST(0, reserved_balance - $1),
           updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [numAmount, userId]
    );

    const ledgerRes = await client.query(
      `INSERT INTO ledger_transactions (user_id, transaction_type, direction, amount, currency, status, reference_type, reference_id, metadata)
       VALUES ($1, 'WITHDRAWAL_RELEASE', 'CREDIT', $2, 'TZS', 'COMPLETED', $3, $4, $5)
       RETURNING *`,
      [userId, numAmount, referenceType, referenceId, metadata]
    );

    return {
      balance: updatedBalanceRes.rows[0],
      transaction: ledgerRes.rows[0]
    };
  }

  static async completeReservedDebit(client, { userId, amount, transactionType, referenceType, referenceId, providerTxRef = null, metadata = {} }) {
    const numAmount = Number(amount);

    const updatedBalanceRes = await client.query(
      `UPDATE user_balances
       SET reserved_balance = GREATEST(0, reserved_balance - $1),
           total_debits = total_debits + $1,
           updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [numAmount, userId]
    );

    const ledgerRes = await client.query(
      `INSERT INTO ledger_transactions (user_id, transaction_type, direction, amount, currency, status, reference_type, reference_id, provider_tx_ref, metadata)
       VALUES ($1, $2, 'DEBIT', $3, 'TZS', 'COMPLETED', $4, $5, $6, $7)
       RETURNING *`,
      [userId, transactionType, numAmount, referenceType, referenceId, providerTxRef, metadata]
    );

    return {
      balance: updatedBalanceRes.rows[0],
      transaction: ledgerRes.rows[0]
    };
  }
}
