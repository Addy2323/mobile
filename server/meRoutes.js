import express from 'express';
import { authenticateUser } from './userAuth.js';
import { LedgerService, calculateVipTier } from './ledgerService.js';
import { SnippePaymentProvider } from './snippeProvider.js';
import { WithdrawalService } from './withdrawalService.js';

export function createMeRouter(pool) {
  const router = express.Router();

  // All routes in this router require a valid JWT user session
  router.use(authenticateUser);

  // -------------------------------------------------------------
  // 1. GET /api/me/profile (or /api/me)
  // -------------------------------------------------------------
  router.get(['/', '/profile'], async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, phone, name, email, status, account_type, created_at FROM users WHERE id = $1',
        [req.user.id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'User profile not found', code: 'USER_NOT_FOUND' });
      }

      const client = await pool.connect();
      try {
        const balance = await LedgerService.getOrCreateUserBalance(client, req.user.id);
        res.json({
          user: rows[0],
          balance: {
            available: Number(balance.available_balance || 0),
            tier: balance.tier || 'STARTER',
            accountRef: balance.account_ref
          }
        });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[me/profile error]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 2. GET /api/me/balance - Card balance, accountRef, and tier
  // -------------------------------------------------------------
  router.get('/balance', async (req, res) => {
    const client = await pool.connect();
    try {
      const b = await LedgerService.getOrCreateUserBalance(client, req.user.id);

      // Verify transaction count for tier calculation
      const txCountRes = await client.query(
        'SELECT COUNT(*) FROM ledger_transactions WHERE user_id = $1 AND status = \'COMPLETED\'',
        [req.user.id]
      );
      const actualCount = parseInt(txCountRes.rows[0].count, 10) || 0;
      const accurateTier = calculateVipTier(actualCount);

      if (b.tier !== accurateTier || b.qualifying_tx_count !== actualCount) {
        await client.query(
          'UPDATE user_balances SET tier = $1, qualifying_tx_count = $2 WHERE user_id = $3',
          [accurateTier, actualCount, req.user.id]
        );
        b.tier = accurateTier;
        b.qualifying_tx_count = actualCount;
      }

      res.json({
        userId: req.user.id,
        accountRef: b.account_ref,
        availableBalance: Number(b.available_balance || 0),
        pendingBalance: Number(b.pending_balance || 0),
        reservedBalance: Number(b.reserved_balance || 0),
        totalCredits: Number(b.total_credits || 0),
        totalDebits: Number(b.total_debits || 0),
        tier: b.tier || 'STARTER',
        qualifyingTxCount: Number(b.qualifying_tx_count || 0),
        updatedAt: b.updated_at
      });
    } catch (err) {
      console.error('[me/balance error]:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // -------------------------------------------------------------
  // 3. GET /api/me/summary - Comprehensive dashboard statistics
  // -------------------------------------------------------------
  router.get('/summary', async (req, res) => {
    const client = await pool.connect();
    try {
      const balance = await LedgerService.getOrCreateUserBalance(client, req.user.id);

      // Total collected across splits created by this user
      const splitsAgg = await client.query(
        `SELECT 
           COUNT(*) as count,
           COALESCE(SUM(total_amount), 0) as total_volume,
           COALESCE(SUM(amount_paid), 0) as total_collected
         FROM splits 
         WHERE owner_user_id = $1`,
        [req.user.id]
      );

      // Recent 5 transactions
      const txRes = await client.query(
        `SELECT id, transaction_type, direction, amount, currency, status, reference_type, reference_id, metadata, created_at
         FROM ledger_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 5`,
        [req.user.id]
      );

      // Recent 5 splits
      const splitsRes = await client.query(
        `SELECT id, title, total_amount, amount_paid, settlement_percent, status, created_at, ref_code
         FROM splits
         WHERE owner_user_id = $1
         ORDER BY created_at DESC LIMIT 5`,
        [req.user.id]
      );

      res.json({
        balance: {
          available: Number(balance.available_balance || 0),
          pending: Number(balance.pending_balance || 0),
          reserved: Number(balance.reserved_balance || 0),
          tier: balance.tier || 'STARTER',
          accountRef: balance.account_ref,
          qualifyingTxCount: Number(balance.qualifying_tx_count || 0)
        },
        stats: {
          splitsCount: parseInt(splitsAgg.rows[0].count, 10) || 0,
          totalVolume: Number(splitsAgg.rows[0].total_volume || 0),
          totalCollected: Number(splitsAgg.rows[0].total_collected || 0)
        },
        recentTransactions: txRes.rows.map(t => ({
          ...t,
          amount: Number(t.amount)
        })),
        recentSplits: splitsRes.rows.map(s => ({
          ...s,
          total_amount: Number(s.total_amount),
          amount_paid: Number(s.amount_paid)
        }))
      });
    } catch (err) {
      console.error('[me/summary error]:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // -------------------------------------------------------------
  // 4. GET /api/me/transactions - Filtered ledger transactions
  // -------------------------------------------------------------
  router.get('/transactions', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
      const offset = parseInt(req.query.offset, 10) || 0;

      const { rows } = await pool.query(
        `SELECT id, transaction_type, direction, amount, currency, status, reference_type, reference_id, provider_tx_ref, metadata, created_at
         FROM ledger_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user.id, limit, offset]
      );

      const countRes = await pool.query(
        'SELECT COUNT(*) FROM ledger_transactions WHERE user_id = $1',
        [req.user.id]
      );

      res.json({
        transactions: rows.map(t => ({
          ...t,
          amount: Number(t.amount)
        })),
        total: parseInt(countRes.rows[0].count, 10) || 0,
        limit,
        offset
      });
    } catch (err) {
      console.error('[me/transactions error]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 5. GET /api/me/splits - Strictly user's owned and participated splits
  // -------------------------------------------------------------
  router.get('/splits', async (req, res) => {
    try {
      // Find splits where user is the owner OR where their phone matches a participant
      const userPhone = req.user.phone || '';
      const query = `
        SELECT DISTINCT s.*
        FROM splits s
        LEFT JOIN split_participants sp ON sp.split_id = s.id
        WHERE s.owner_user_id = $1 OR ($2 <> '' AND sp.phone = $2)
        ORDER BY s.created_at DESC
      `;
      const { rows: splits } = await pool.query(query, [req.user.id, userPhone]);

      if (splits.length === 0) {
        return res.json({ splits: [] });
      }

      // Fetch participants for these splits
      const splitIds = splits.map(s => s.id);
      const { rows: participants } = await pool.query(
        `SELECT id, split_id, name, phone, allocation_amount, amount_paid, status, paid_at, is_organizer, created_at
         FROM split_participants
         WHERE split_id::text = ANY($1::text[])
         ORDER BY created_at ASC`,
        [splitIds]
      );

      const participantsBySplit = {};
      participants.forEach(p => {
        if (!participantsBySplit[p.split_id]) {
          participantsBySplit[p.split_id] = [];
        }
        participantsBySplit[p.split_id].push({
          ...p,
          allocation_amount: Number(p.allocation_amount),
          amount_paid: Number(p.amount_paid)
        });
      });

      const formattedSplits = splits.map(s => ({
        ...s,
        total_amount: Number(s.total_amount),
        amount_paid: Number(s.amount_paid),
        participants: participantsBySplit[s.id] || []
      }));

      res.json({ splits: formattedSplits });
    } catch (err) {
      console.error('[me/splits error]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 6. GET /api/me/activities - Unified activity timeline for user
  // -------------------------------------------------------------
  router.get('/activities', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 30, 50);

      // Fetch ledger transactions
      const txRes = await pool.query(
        `SELECT id, transaction_type, direction, amount, currency, status, reference_type, reference_id, metadata, created_at
         FROM ledger_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        [req.user.id, limit]
      );

      // Fetch splits created by user
      const splitsRes = await pool.query(
        `SELECT id, title, total_amount, amount_paid, settlement_percent, status, created_at, ref_code
         FROM splits
         WHERE owner_user_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        [req.user.id, limit]
      );

      // Map into uniform activity objects
      const activities = [];

      txRes.rows.forEach(t => {
        activities.push({
          id: `tx_${t.id}`,
          type: 'TRANSACTION',
          title: t.transaction_type === 'DEPOSIT'
            ? 'Wallet Deposit'
            : t.transaction_type === 'SPLIT_COLLECTION'
            ? 'Split Collection'
            : t.transaction_type === 'WITHDRAWAL_PAYOUT'
            ? 'Withdrawal Payout'
            : 'Account Transaction',
          subtitle: `${t.direction === 'CREDIT' ? '+' : '-'} TZS ${Number(t.amount).toLocaleString()}`,
          amount: Number(t.amount),
          direction: t.direction,
          status: t.status,
          timestamp: t.created_at,
          raw: t
        });
      });

      splitsRes.rows.forEach(s => {
        activities.push({
          id: `split_${s.id}`,
          type: 'SPLIT_EVENT',
          title: s.title,
          subtitle: `Split · ${s.settlement_percent}% collected`,
          amount: Number(s.total_amount),
          direction: 'NEUTRAL',
          status: s.status,
          timestamp: s.created_at,
          raw: s
        });
      });

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({
        activities: activities.slice(0, limit)
      });
    } catch (err) {
      console.error('[me/activities error]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 7. POST /api/me/deposits/initiate - Mobile money wallet deposit
  // -------------------------------------------------------------
  router.post('/deposits/initiate', async (req, res) => {
    const client = await pool.connect();
    try {
      const { amount, phone, provider = 'M-Pesa' } = req.body;
      const numAmount = Number(amount);

      if (!numAmount || numAmount <= 0) {
        return res.status(400).json({ error: 'Valid deposit amount required.' });
      }
      const targetPhone = phone || req.user.phone;
      if (!targetPhone || targetPhone.length < 6) {
        return res.status(400).json({ error: 'Valid phone number required for deposit push.' });
      }

      await client.query('BEGIN');
      await LedgerService.getOrCreateUserBalance(client, req.user.id);

      const idempotencyKey = `dep_${req.user.id}_${Date.now()}`;
      const refCode = `DEP-${Date.now().toString().slice(-6)}`;

      let snippeResult;
      try {
        snippeResult = await SnippePaymentProvider.initiatePayment({
          amount: numAmount,
          phone: targetPhone,
          splitId: 'DEPOSIT_WALLET',
          participantId: req.user.id,
          participantName: req.user.name || 'LUMO User Deposit',
          idempotencyKey
        });
      } catch (e) {
        snippeResult = { providerTxRef: refCode, status: 'PENDING' };
      }

      await client.query(
        `INSERT INTO ledger_transactions (user_id, transaction_type, direction, amount, currency, status, reference_type, reference_id, provider_tx_ref, idempotency_key, metadata)
         VALUES ($1, 'DEPOSIT', 'CREDIT', $2, 'TZS', 'PENDING', 'DEPOSIT', $3, $4, $5, $6)`,
        [req.user.id, numAmount, refCode, snippeResult.providerTxRef, idempotencyKey, { phone: targetPhone, provider }]
      );

      let isConfirmedImmediately = false;
      if (process.env.AUTO_CONFIRM_SANDBOX_DEPOSITS === 'true') {
        await LedgerService.postCredit(client, {
          userId: req.user.id,
          amount: numAmount,
          transactionType: 'DEPOSIT',
          referenceType: 'DEPOSIT',
          referenceId: refCode,
          providerTxRef: snippeResult.providerTxRef,
          idempotencyKey: `credit_${idempotencyKey}`,
          metadata: { phone: targetPhone, provider, simulated: true }
        });
        isConfirmedImmediately = true;
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: isConfirmedImmediately
          ? 'Deposit processed & balance credited successfully!'
          : 'Deposit USSD prompt dispatched to phone. Awaiting approval.',
        depositRef: refCode,
        providerTxRef: snippeResult.providerTxRef,
        isConfirmed: isConfirmedImmediately,
        amount: numAmount
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[me/deposits/initiate error]:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // -------------------------------------------------------------
  // 8. GET /api/me/deposits/status - Check deposit status scoped
  // -------------------------------------------------------------
  router.get('/deposits/status', async (req, res) => {
    const client = await pool.connect();
    try {
      const depositRef = req.query.deposit_ref;
      const providerTxRef = req.query.provider_tx_ref;

      if (!depositRef && !providerTxRef) {
        return res.status(400).json({ error: 'deposit_ref or provider_tx_ref required' });
      }

      const txQuery = `
        SELECT * FROM ledger_transactions 
        WHERE user_id = $1 AND (reference_id = $2 OR provider_tx_ref = $3)
        ORDER BY created_at DESC LIMIT 1
      `;
      const { rows } = await client.query(txQuery, [req.user.id, depositRef, providerTxRef]);
      const tx = rows[0];

      if (tx && tx.status === 'COMPLETED') {
        return res.json({
          status: 'SUCCESS',
          isPaid: true,
          depositRef: tx.reference_id,
          amount: Number(tx.amount),
          message: 'Deposit confirmed & balance credited!'
        });
      }

      if (tx && tx.status === 'FAILED') {
        return res.json({
          status: 'FAILED',
          isPaid: false,
          isFailed: true,
          depositRef: tx.reference_id,
          message: 'Deposit transaction failed.'
        });
      }

      const refToCheck = providerTxRef || tx?.provider_tx_ref;
      if (refToCheck && refToCheck !== 'SNP-DEP-CONFIRMED' && !refToCheck.startsWith('DEP-')) {
        const snippeStatus = await SnippePaymentProvider.getPaymentStatus(refToCheck);
        if (snippeStatus && snippeStatus.isPaid) {
          const depositAmount = Number(tx?.amount || req.query.amount || 0);
          if (depositAmount > 0) {
            await client.query('BEGIN');
            await LedgerService.postCredit(client, {
              userId: req.user.id,
              amount: depositAmount,
              transactionType: 'DEPOSIT',
              referenceType: 'DEPOSIT',
              referenceId: depositRef || tx?.reference_id,
              providerTxRef: refToCheck,
              idempotencyKey: `credit_poll_${depositRef || refToCheck}`,
              metadata: snippeStatus.data || {}
            });
            await client.query(
              `UPDATE ledger_transactions SET status = 'COMPLETED' WHERE user_id = $1 AND (reference_id = $2 OR provider_tx_ref = $3)`,
              [req.user.id, depositRef, refToCheck]
            );
            await client.query('COMMIT');
          }

          return res.json({
            status: 'SUCCESS',
            isPaid: true,
            depositRef: depositRef || tx?.reference_id,
            amount: Number(tx?.amount || 0),
            message: 'Deposit confirmed via Snippe & balance credited!'
          });
        }

        if (snippeStatus && snippeStatus.isFailed) {
          await client.query(
            `UPDATE ledger_transactions SET status = 'FAILED' WHERE user_id = $1 AND (reference_id = $2 OR provider_tx_ref = $3)`,
            [req.user.id, depositRef, refToCheck]
          );
          return res.json({
            status: 'FAILED',
            isPaid: false,
            isFailed: true,
            depositRef: depositRef || tx?.reference_id,
            message: 'Deposit was cancelled or rejected by network.'
          });
        }
      }

      return res.json({
        status: 'PENDING',
        isPaid: false,
        depositRef: depositRef || tx?.reference_id,
        message: 'Awaiting USSD PIN approval on user mobile device.'
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[me/deposits/status error]:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // 9a. GET /api/me/withdrawals/quote - Authoritative fee & payout preview
  // -------------------------------------------------------------
  router.get('/withdrawals/quote', async (req, res) => {
    try {
      const { amount } = req.query;
      const balance = await LedgerService.getOrCreateUserBalance(pool, req.user.id);
      const financials = WithdrawalService.calculateWithdrawalFinancials(
        amount,
        balance.available_balance
      );
      res.json(financials);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 9b. POST /api/me/withdrawals/request - Submit withdrawal request
  // -------------------------------------------------------------
  router.post('/withdrawals/request', async (req, res) => {
    const client = await pool.connect();
    try {
      const { amount, destinationType, destinationDetails } = req.body;

      // 1. Destination validation
      WithdrawalService.validateDestination(destinationType, destinationDetails);

      await client.query('BEGIN');

      // 2. Fetch current balance with row-level lock
      const balance = await LedgerService.getOrCreateUserBalance(client, req.user.id);

      // 3. Authoritative financial calculation (requested amount, fee, net payout)
      const financials = WithdrawalService.calculateWithdrawalFinancials(
        amount,
        balance.available_balance
      );

      const refCode = `WTH-${Date.now().toString().slice(-6)}`;
      const idempotencyKey = `wth_res_${req.user.id}_${Date.now()}`;

      // 4. Reserve EXACTLY requestedAmount (never over-deducts or reserves entire balance)
      await LedgerService.reserveFunds(client, {
        userId: req.user.id,
        amount: financials.requestedAmount,
        transactionType: 'WITHDRAWAL_RESERVE',
        referenceType: 'WITHDRAWAL',
        referenceId: refCode,
        idempotencyKey,
        metadata: {
          destinationType,
          destinationDetails,
          requestedAmount: financials.requestedAmount,
          feeAmount: financials.feeAmount,
          netPayout: financials.netPayout,
          tierRate: financials.tierRate,
          tierLabel: financials.tierLabel,
          configVersion: financials.configVersion
        }
      });

      // 5. Store withdrawal request record with strictly preserved amounts
      const wthRes = await client.query(
        `INSERT INTO withdrawal_requests (
          user_id, amount, fee, net_amount, currency, destination_type, destination_details, status, reference_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_REVIEW', $8)
        RETURNING *`,
        [
          req.user.id,
          financials.requestedAmount,
          financials.feeAmount,
          financials.netPayout,
          financials.currency,
          destinationType,
          destinationDetails,
          refCode
        ]
      );

      await client.query('COMMIT');

      // 6. Return response with remaining available balance and full breakdown
      const remainingAvailable = Number(balance.available_balance) - financials.requestedAmount;

      res.json({
        success: true,
        message: 'Withdrawal requested and funds reserved successfully.',
        withdrawal: {
          ...wthRes.rows[0],
          amount: financials.requestedAmount,
          fee: financials.feeAmount,
          net_amount: financials.netPayout
        },
        financials: {
          requestedAmount: financials.requestedAmount,
          feeAmount: financials.feeAmount,
          netPayout: financials.netPayout,
          reservedAmount: financials.requestedAmount,
          remainingAvailableBalance: remainingAvailable
        }
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[me/withdrawals/request error]:', err);
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // -------------------------------------------------------------
  // 10. GET /api/me/withdrawals - History of user withdrawals
  // -------------------------------------------------------------
  router.get('/withdrawals', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, user_id, amount, fee, net_amount, currency, destination_type, destination_details, status, reference_code, rejection_reason, provider_tx_ref, created_at, updated_at
         FROM withdrawal_requests
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [req.user.id]
      );
      res.json({
        withdrawals: rows.map(r => ({
          ...r,
          amount: Number(r.amount),
          fee: Number(r.fee),
          net_amount: Number(r.net_amount)
        }))
      });
    } catch (err) {
      console.error('[me/withdrawals error]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 11. POST /api/me/bill-payments - Pay utility bill from balance
  // -------------------------------------------------------------
  router.post('/bill-payments', async (req, res) => {
    const client = await pool.connect();
    try {
      const { provider, accountMeterNumber, amount } = req.body;
      const numAmount = Number(amount);

      if (!numAmount || numAmount <= 0) {
        return res.status(400).json({ error: 'Valid payment amount required.' });
      }
      if (!provider || !accountMeterNumber) {
        return res.status(400).json({ error: 'Provider and meter/account number required.' });
      }

      await client.query('BEGIN');

      const receiptRef = `RCP-${Date.now().toString().slice(-8)}`;
      const idempotencyKey = `bill_${req.user.id}_${Date.now()}`;

      await LedgerService.reserveFunds(client, {
        userId: req.user.id,
        amount: numAmount,
        transactionType: 'BILL_PAYMENT',
        referenceType: 'BILL_PAYMENT',
        referenceId: receiptRef,
        idempotencyKey,
        metadata: { provider, accountMeterNumber }
      });

      await LedgerService.completeReservedDebit(client, {
        userId: req.user.id,
        amount: numAmount,
        transactionType: 'BILL_PAYMENT',
        referenceType: 'BILL_PAYMENT',
        referenceId: receiptRef,
        metadata: { provider, accountMeterNumber }
      });

      const tokenCode = provider === 'TANESCO'
        ? Array.from({ length: 5 }, () => Math.floor(1000 + Math.random() * 9000)).join('-')
        : null;

      const billRes = await client.query(
        `INSERT INTO bill_payments (user_id, provider, account_meter_number, amount, status, token_code, receipt_ref, metadata)
         VALUES ($1, $2, $3, $4, 'COMPLETED', $5, $6, $7)
         RETURNING *`,
        [req.user.id, provider, accountMeterNumber, numAmount, tokenCode, receiptRef, { paidAt: new Date().toISOString() }]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Bill payment completed successfully from available balance.',
        billPayment: billRes.rows[0]
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[me/bill-payments error]:', err);
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
}
