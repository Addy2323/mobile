import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createAdminAuthMiddleware, requirePermission, logAdminAuditAction, hashPassword } from './adminAuth.js';
import { ApplicationIntegrationService } from './applicationIntegrationService.js';
import { LedgerService } from './ledgerService.js';
import { SnippePaymentProvider } from './snippeProvider.js';

const JWT_SECRET = process.env.JWT_SECRET;

export function createAdminRouter(pool) {
  const router = express.Router();
  const adminAuth = createAdminAuthMiddleware(pool);

  // -------------------------------------------------------------
  // PUBLIC STAFF LOGIN ROUTE
  // -------------------------------------------------------------
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const inputHash = hashPassword(password);
      const { rows } = await pool.query(
        `SELECT a.*, r.name AS role_name
         FROM admin_users a
         LEFT JOIN admin_user_roles aur ON a.id = aur.admin_user_id
         LEFT JOIN roles r ON aur.role_id = r.id
         WHERE LOWER(a.email) = LOWER($1) AND a.status = 'ACTIVE'`,
        [email]
      );

      if (rows.length === 0 || rows[0].password_hash !== inputHash) {
        return res.status(401).json({ error: 'Invalid admin credentials or account suspended' });
      }

      const admin = rows[0];

      // Fetch permissions
      const permRes = await pool.query(
        `SELECT DISTINCT p.key
         FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         JOIN admin_user_roles aur ON rp.role_id = aur.role_id
         WHERE aur.admin_user_id = $1`,
        [admin.id]
      );
      const permissions = permRes.rows.map((r) => r.key);

      // Update last login
      await pool.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [admin.id]);

      // Log audit
      await logAdminAuditAction(pool, {
        adminUserId: admin.id,
        adminEmail: admin.email,
        action: 'ADMIN_LOGIN',
        resourceType: 'auth',
        resourceId: admin.id,
        ipAddress: req.ip
      });

      const token = jwt.sign(
        { id: admin.id, email: admin.email, role: admin.role_name },
        JWT_SECRET,
        { expiresIn: '12h' }
      );

      res.json({
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          fullName: admin.full_name,
          role: admin.role_name || 'ANALYST',
          permissions
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Apply RBAC Auth middleware to all remaining admin endpoints
  router.use(adminAuth);

  // -------------------------------------------------------------
  // DASHBOARD METRICS
  // -------------------------------------------------------------
  router.get('/dashboard-stats', requirePermission('reports.view'), async (req, res) => {
    try {
      // 1. Total & Active Users
      let usersRes = { rows: [{ total_users: 0, active_users: 0 }] };
      try {
        usersRes = await pool.query(`
        SELECT 
          COUNT(*)::int AS total_users,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int AS active_users
        FROM users
      `);
      } catch (e) {
        console.warn('[Admin dashboard] users table query:', e.message);
      }

      // 2. Splits count
      let splitsRes = { rows: [{ total_splits: 0 }] };
      try {
        splitsRes = await pool.query('SELECT COUNT(*)::int AS total_splits FROM splits');
      } catch (e) {
        console.warn('[Admin dashboard] splits table query:', e.message);
      }

      // 3. Payment Statistics Today & Total Volume
      let paymentsRes = { rows: [{ payments_today: 0, payments_this_month: 0, total_volume: 0, successful_payments: 0, failed_payments: 0 }] };
      try {
        paymentsRes = await pool.query(`
        SELECT
          COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END)::int AS payments_today,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END)::int AS payments_this_month,
          COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END), 0)::numeric AS total_volume,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int AS successful_payments,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::int AS failed_payments
        FROM payment_attempts
      `);
      } catch (e) {
        console.warn('[Admin dashboard] payment_attempts table query:', e.message);
      }

      // 4. Pending Settlements
      let settlementsRes = { rows: [{ pending_settlements: 0 }] };
      try {
        settlementsRes = await pool.query(`
        SELECT COUNT(*)::int AS pending_settlements
        FROM payout_records
        WHERE status IN ('PENDING', 'PROCESSING')
      `);
      } catch (e) {
        console.warn('[Admin dashboard] payout_records table query:', e.message);
      }

      // 5. Active Payment Links
      let linksRes = { rows: [{ active_links: 0 }] };
      try {
        linksRes = await pool.query(`
        SELECT COUNT(*)::int AS active_links
        FROM payment_links
        WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > NOW())
      `);
      } catch (e) {
        console.warn('[Admin dashboard] payment_links table query:', e.message);
      }

      // 6. Open Support Issues
      let supportRes = { rows: [{ open_tickets: 0 }] };
      try {
        supportRes = await pool.query(`
        SELECT COUNT(*)::int AS open_tickets
        FROM support_tickets
        WHERE status IN ('OPEN', 'IN_PROGRESS')
      `);
      } catch (e) {
        console.warn('[Admin dashboard] support_tickets table query:', e.message);
      }

      const stats = {
        totalUsers: usersRes.rows[0]?.total_users || 0,
        activeUsers: usersRes.rows[0]?.active_users || 0,
        splitsCreated: splitsRes.rows[0]?.total_splits || 0,
        paymentsToday: paymentsRes.rows[0]?.payments_today || 0,
        paymentsThisMonth: paymentsRes.rows[0]?.payments_this_month || 0,
        totalPaymentVolume: Number(paymentsRes.rows[0]?.total_volume || 0),
        successfulPayments: paymentsRes.rows[0]?.successful_payments || 0,
        failedPayments: paymentsRes.rows[0]?.failed_payments || 0,
        pendingSettlements: settlementsRes.rows[0]?.pending_settlements || 0,
        activePaymentLinks: linksRes.rows[0]?.active_links || 0,
        openSupportIssues: supportRes.rows[0]?.open_tickets || 0,
        lastUpdated: new Date().toISOString()
      };

      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // USER MANAGEMENT & INVESTIGATION
  // -------------------------------------------------------------
  router.get('/users', requirePermission('users.view'), async (req, res) => {
    try {
      const { query, status, limit = 50, offset = 0 } = req.query;
      let sql = 'SELECT id, name, phone, email, status, created_at FROM users WHERE 1=1';
      const params = [];

      if (query) {
        params.push(`%${query}%`);
        sql += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length} OR id::text = $${params.length})`;
      }
      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }

      sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(parseInt(limit), parseInt(offset));

      const { rows } = await pool.query(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/users/:id', requirePermission('users.view'), async (req, res) => {
    try {
      const userId = req.params.id;
      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userRes.rows[0];

      // Fetch user's related splits, payments, destinations, links, tickets
      const [splits, payments, destinations, links, tickets, audit] = await Promise.all([
        pool.query('SELECT * FROM splits WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 20', [userId]),
        pool.query('SELECT * FROM payment_attempts WHERE phone_number = $1 OR metadata->>\'user_id\' = $2 ORDER BY created_at DESC LIMIT 20', [user.phone, userId]),
        pool.query('SELECT * FROM payment_destinations WHERE owner_user_id = $1 ORDER BY created_at DESC', [userId]),
        pool.query('SELECT * FROM payment_links WHERE owner_user_id = $1 ORDER BY created_at DESC', [userId]),
        pool.query('SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
        pool.query('SELECT * FROM admin_audit_logs WHERE resource_id = $1 ORDER BY created_at DESC LIMIT 20', [userId])
      ]);

      res.json({
        profile: user,
        splits: splits.rows,
        payments: payments.rows,
        destinations: destinations.rows,
        paymentLinks: links.rows,
        supportTickets: tickets.rows,
        auditHistory: audit.rows
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/users/:id/status', requirePermission('users.suspend'), async (req, res) => {
    try {
      const userId = req.params.id;
      const { status, reason } = req.body;
      if (!['ACTIVE', 'SUSPENDED', 'DISABLED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid user status' });
      }
      if (!reason) {
        return res.status(400).json({ error: 'Reason is mandatory for account status modifications' });
      }

      const beforeRes = await pool.query('SELECT status FROM users WHERE id = $1', [userId]);
      if (beforeRes.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const beforeState = beforeRes.rows[0];
      await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, userId]);

      await logAdminAuditAction(pool, {
        adminUserId: req.adminUser.id,
        adminEmail: req.adminUser.email,
        action: `USER_STATUS_CHANGE_${status}`,
        resourceType: 'user',
        resourceId: userId,
        beforeState,
        afterState: { status, reason },
        ipAddress: req.ip
      });

      res.json({ message: `User status updated to ${status}`, status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // SPLITS OPERATIONS
  // -------------------------------------------------------------
  router.get('/splits', requirePermission('splits.view'), async (req, res) => {
    try {
      const { query, limit = 50, offset = 0 } = req.query;
      let sql = 'SELECT * FROM splits WHERE 1=1';
      const params = [];

      if (query) {
        params.push(`%${query}%`);
        sql += ` AND (title ILIKE $${params.length} OR ref_code ILIKE $${params.length} OR creator_name ILIKE $${params.length})`;
      }

      sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(parseInt(limit), parseInt(offset));

      const { rows } = await pool.query(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // PAYMENT OPERATIONS
  // -------------------------------------------------------------
  router.get('/payments', requirePermission('payments.view'), async (req, res) => {
    try {
      const { query, status, provider, limit = 50, offset = 0 } = req.query;
      let sql = 'SELECT * FROM payment_attempts WHERE 1=1';
      const params = [];

      if (query) {
        params.push(`%${query}%`);
        sql += ` AND (merchant_reference ILIKE $${params.length} OR provider_reference ILIKE $${params.length} OR phone_number ILIKE $${params.length})`;
      }
      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }
      if (provider) {
        params.push(provider);
        sql += ` AND provider = $${params.length}`;
      }

      sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(parseInt(limit), parseInt(offset));

      const { rows } = await pool.query(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/payments/:id/refund', requirePermission('payments.refund'), async (req, res) => {
    try {
      const paymentId = req.params.id;
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ error: 'Reason required for refund action' });
      }

      const pRes = await pool.query('SELECT * FROM payment_attempts WHERE id = $1', [paymentId]);
      if (pRes.rows.length === 0) {
        return res.status(404).json({ error: 'Payment record not found' });
      }

      const payment = pRes.rows[0];
      if (payment.status !== 'COMPLETED') {
        return res.status(400).json({ error: 'Only COMPLETED payments can be refunded' });
      }

      // Record controlled refund state
      await pool.query(
        "UPDATE payment_attempts SET status = 'REFUNDED', metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{refund_reason}', $1::jsonb) WHERE id = $2",
        [JSON.stringify(reason), paymentId]
      );

      await logAdminAuditAction(pool, {
        adminUserId: req.adminUser.id,
        adminEmail: req.adminUser.email,
        action: 'PAYMENT_REFUND',
        resourceType: 'payment',
        resourceId: paymentId,
        beforeState: { status: payment.status },
        afterState: { status: 'REFUNDED', reason },
        ipAddress: req.ip
      });

      res.json({ message: 'Payment marked as REFUNDED and recorded in audit log', paymentId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // SETTLEMENT MONITORING & SAFE RETRY
  // -------------------------------------------------------------
  router.get('/settlements', requirePermission('settlements.view'), async (req, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      let sql = `
        SELECT 
          s.id,
          s.payment_id,
          s.split_participant_id,
          s.split_id,
          s.destination_snapshot,
          s.provider,
          s.provider_reference,
          s.amount,
          s.currency,
          s.status,
          s.attempt_count,
          s.failure_code,
          s.failure_reason,
          s.initiated_at,
          s.completed_at,
          s.created_at,
          s.updated_at,
          sp.title AS split_title,
          sp.organizer_name,
          sp.organizer_phone
        FROM settlements s
        LEFT JOIN splits sp ON (s.split_id = sp.id::text OR s.split_id = sp.ref_code)
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        sql += ` AND s.status = $${params.length}`;
      }

      sql += ' ORDER BY s.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(parseInt(limit), parseInt(offset));

      const { rows } = await pool.query(sql, params);

      // If settlements table is currently empty, query payout_records for backwards compatibility
      if (rows.length === 0 && !status) {
        const legacyRes = await pool.query(
          `SELECT 
            p.id,
            p.split_id,
            p.amount,
            p.fee,
            p.channel,
            p.recipient_reference,
            p.provider_payout_id AS provider_reference,
            p.status,
            p.created_at,
            sp.title AS split_title,
            sp.organizer_name
          FROM payout_records p
          LEFT JOIN splits sp ON p.split_id = sp.id
          ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
          [parseInt(limit), parseInt(offset)]
        );
        return res.json(legacyRes.rows);
      }

      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/settlements/:id/retry', requirePermission('settlements.retry'), async (req, res) => {
    try {
      const settlementId = req.params.id;
      const sRes = await pool.query('SELECT * FROM settlements WHERE id = $1', [settlementId]);
      
      if (sRes.rows.length === 0) {
        // Fallback to payout_records if it was a legacy payout record
        const pRes = await pool.query('SELECT * FROM payout_records WHERE id = $1', [settlementId]);
        if (pRes.rows.length === 0) {
          return res.status(404).json({ error: 'Settlement record not found' });
        }
        const legacy = pRes.rows[0];
        if (legacy.status === 'SETTLED' || legacy.status === 'COMPLETED') {
          return res.status(400).json({ error: 'Settlement has already completed. Duplicate payout prevented.' });
        }
        await pool.query(
          "UPDATE payout_records SET status = 'PROCESSING' WHERE id = $1",
          [settlementId]
        );
        return res.json({ message: 'Settlement retry queued with idempotency check', settlementId });
      }

      const settlement = sRes.rows[0];
      if (settlement.status === 'SETTLED' || settlement.status === 'COMPLETED') {
        return res.status(400).json({ error: 'Settlement has already completed. Duplicate payout prevented.' });
      }

      // Idempotently update retry status
      await pool.query(
        "UPDATE settlements SET status = 'PROCESSING', attempt_count = COALESCE(attempt_count, 0) + 1, updated_at = NOW() WHERE id = $1",
        [settlementId]
      );

      await logAdminAuditAction(pool, {
        adminUserId: req.adminUser.id,
        adminEmail: req.adminUser.email,
        action: 'SETTLEMENT_RETRY_INITIATED',
        resourceType: 'settlement',
        resourceId: settlementId,
        beforeState: { status: settlement.status },
        afterState: { status: 'PROCESSING' },
        ipAddress: req.ip
      });

      res.json({ message: 'Settlement retry queued with idempotency check', settlementId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // WITHDRAWALS MANAGEMENT & ADMIN APPROVAL / REJECTION / DISBURSEMENT
  // -------------------------------------------------------------
  router.get('/withdrawals', requirePermission('settlements.view'), async (req, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      let sql = `
        SELECT 
          w.*,
          u.name AS user_name,
          u.phone AS user_phone,
          u.email AS user_email
        FROM withdrawal_requests w
        LEFT JOIN users u ON w.user_id::text = u.id::text
        WHERE 1=1
      `;
      const params = [];
      if (status) {
        params.push(status);
        sql += ` AND w.status = $${params.length}`;
      }
      sql += ' ORDER BY w.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(parseInt(limit), parseInt(offset));

      const { rows } = await pool.query(sql, params);
      res.json(rows.map(r => ({
        ...r,
        amount: Number(r.amount),
        fee: Number(r.fee),
        net_amount: Number(r.net_amount)
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/withdrawals/:id/action', requirePermission('settlements.retry'), async (req, res) => {
    const client = await pool.connect();
    try {
      const withdrawalId = req.params.id;
      const { action, reason } = req.body;

      if (!['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({ error: 'Action must be APPROVE or REJECT' });
      }

      await client.query('BEGIN');

      const wRes = await client.query(
        `SELECT w.*, u.name AS user_name, u.phone AS user_phone, u.email AS user_email
         FROM withdrawal_requests w
         LEFT JOIN users u ON w.user_id::text = u.id::text
         WHERE w.id = $1 FOR UPDATE OF w`,
        [withdrawalId]
      );

      if (wRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Withdrawal request not found' });
      }

      const withdrawal = wRes.rows[0];

      if (withdrawal.status !== 'PENDING_REVIEW') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Cannot ${action.toLowerCase()} withdrawal with status ${withdrawal.status}. Must be PENDING_REVIEW.`
        });
      }

      const requestedAmount = Number(withdrawal.amount);
      const fee = Number(withdrawal.fee);
      const netPayout = Number(withdrawal.net_amount);
      const payoutAmount = netPayout > 0 ? netPayout : requestedAmount;

      if (action === 'APPROVE') {
        // 1. Complete reserved debit in ledger for the exact reserved gross amount
        await LedgerService.completeReservedDebit(client, {
          userId: withdrawal.user_id,
          amount: requestedAmount,
          transactionType: 'WITHDRAWAL_PAYOUT',
          referenceType: 'WITHDRAWAL',
          referenceId: withdrawal.reference_code,
          metadata: {
            adminUserId: req.adminUser.id,
            adminEmail: req.adminUser.email,
            fee,
            netPayout: payoutAmount,
            approvedAt: new Date().toISOString()
          }
        });

        // 2. Update withdrawal status to APPROVED
        await client.query(
          `UPDATE withdrawal_requests
           SET status = 'APPROVED', admin_reviewer_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [req.adminUser.id, withdrawalId]
        );

        await client.query('COMMIT');

        // 3. Initiate payment provider mobile/bank payout
        let providerResult = null;
        let dest = withdrawal.destination_details || {};
        if (typeof dest === 'string') {
          try { dest = JSON.parse(dest); } catch {}
        }
        const destType = (withdrawal.destination_type || '').toUpperCase();
        const isBank = destType === 'BANK';
        const recipientPhone = dest.phone || dest.phoneNumber || dest.phone_number || dest.account_number || withdrawal.user_phone;
        const recipientName = dest.recipient_name || dest.accountHolder || dest.account_holder || dest.name || withdrawal.user_name || 'LUMO Customer';

        try {
          const payoutPayload = {
            splitId: withdrawal.reference_code,
            amount: payoutAmount,
            channel: isBank ? 'bank' : 'mobile',
            recipientPhone,
            recipientBank: dest.bankName || dest.bank || dest.bank_name,
            recipientAccount: dest.accountNumber || dest.account || dest.account_number,
            recipientName,
            narration: `LUMO Withdrawal ${withdrawal.reference_code}`,
            metadata: {
              withdrawal_id: withdrawalId,
              user_id: withdrawal.user_id,
              reference_code: withdrawal.reference_code
            },
            idempotencyKey: `wth_pay_${withdrawalId}_${Date.now()}`
          };

          providerResult = await SnippePaymentProvider.sendPayout(payoutPayload);

          if (providerResult && providerResult.payoutId && providerResult.status !== 'FAILED') {
            await pool.query(
              `UPDATE withdrawal_requests
               SET status = $1, provider_tx_ref = $2, rejection_reason = NULL, updated_at = NOW()
               WHERE id = $3`,
              [
                providerResult.status === 'SETTLED' ? 'COMPLETED' : 'PROCESSING',
                providerResult.payoutId,
                withdrawalId
              ]
            );
          } else {
            const failureReason = providerResult?.failureReason || providerResult?.message || 'Payout could not be completed';
            await pool.query(
              `UPDATE withdrawal_requests
               SET status = 'DISBURSEMENT_FAILED', rejection_reason = $1, updated_at = NOW()
               WHERE id = $2`,
              [failureReason, withdrawalId]
            );
          }
        } catch (payoutErr) {
          console.warn('[Admin Payout] Disbursement dispatch error:', payoutErr.message);
          await pool.query(
            `UPDATE withdrawal_requests
             SET status = 'DISBURSEMENT_FAILED', rejection_reason = $1, updated_at = NOW()
             WHERE id = $2`,
            [payoutErr.message, withdrawalId]
          );
        }

        await logAdminAuditAction(pool, {
          adminUserId: req.adminUser.id,
          adminEmail: req.adminUser.email,
          action: 'WITHDRAWAL_APPROVED',
          resourceType: 'withdrawal',
          resourceId: withdrawalId,
          beforeState: { status: withdrawal.status, amount: requestedAmount },
          afterState: { status: 'APPROVED', netPayout: payoutAmount, fee, providerResult },
          ipAddress: req.ip
        });

        const isDisbursementSuccess = providerResult && providerResult.payoutId && providerResult.status !== 'FAILED';

        res.json({
          success: isDisbursementSuccess,
          status: isDisbursementSuccess ? (providerResult.status === 'SETTLED' ? 'COMPLETED' : 'PROCESSING') : 'DISBURSEMENT_FAILED',
          message: isDisbursementSuccess
            ? `Withdrawal approved & mobile money payout dispatched to ${recipientPhone} (Ref: ${providerResult.payoutId})`
            : `Withdrawal approved in ledger, but Snippe mobile disbursement failed: ${providerResult?.failureReason || 'Disbursement rejected'}`,
          payoutId: providerResult?.payoutId || null,
          netPayout: payoutAmount,
          recipientPhone,
          providerResult
        });
      } else if (action === 'REJECT') {
        if (!reason) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Reason is required for rejection' });
        }

        // 1. Release reserved funds back to user's available balance
        await LedgerService.releaseReservation(client, {
          userId: withdrawal.user_id,
          amount: requestedAmount,
          referenceType: 'WITHDRAWAL',
          referenceId: withdrawal.reference_code,
          metadata: {
            adminUserId: req.adminUser.id,
            rejectionReason: reason,
            rejectedAt: new Date().toISOString()
          }
        });

        // 2. Mark withdrawal as REJECTED
        await client.query(
          `UPDATE withdrawal_requests
           SET status = 'REJECTED', admin_reviewer_id = $1, rejection_reason = $2, updated_at = NOW()
           WHERE id = $3`,
          [req.adminUser.id, reason, withdrawalId]
        );

        await client.query('COMMIT');

        await logAdminAuditAction(pool, {
          adminUserId: req.adminUser.id,
          adminEmail: req.adminUser.email,
          action: 'WITHDRAWAL_REJECTED',
          resourceType: 'withdrawal',
          resourceId: withdrawalId,
          beforeState: { status: withdrawal.status },
          afterState: { status: 'REJECTED', reason, releasedAmount: requestedAmount },
          ipAddress: req.ip
        });

        res.json({
          message: 'Withdrawal rejected and funds released back to user available balance',
          status: 'REJECTED',
          releasedAmount: requestedAmount
        });
      }
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[admin/withdrawals/action error]:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // Dedicated endpoint to disburse / retry mobile money payout for approved withdrawals
  router.post('/withdrawals/:id/disburse', requirePermission('withdrawals.approve'), async (req, res) => {
    const { id: withdrawalId } = req.params;
    try {
      const wRes = await pool.query(
        `SELECT w.*, u.name AS user_name, u.phone AS user_phone, u.email AS user_email
         FROM withdrawal_requests w
         LEFT JOIN users u ON w.user_id::text = u.id::text
         WHERE w.id = $1`,
        [withdrawalId]
      );

      if (wRes.rows.length === 0) {
        return res.status(404).json({ error: 'Withdrawal request not found' });
      }

      const withdrawal = wRes.rows[0];
      if (!['APPROVED', 'DISBURSEMENT_FAILED', 'PROCESSING'].includes(withdrawal.status)) {
        return res.status(400).json({
          error: `Cannot disburse payout for withdrawal in status ${withdrawal.status}. Must be APPROVED or DISBURSEMENT_FAILED.`
        });
      }

      let dest = withdrawal.destination_details || {};
      if (typeof dest === 'string') {
        try { dest = JSON.parse(dest); } catch {}
      }
      const destType = (withdrawal.destination_type || '').toUpperCase();
      const isBank = destType === 'BANK';
      const recipientPhone = dest.phone || dest.phoneNumber || dest.phone_number || dest.account_number || withdrawal.user_phone;
      const recipientName = dest.recipient_name || dest.accountHolder || dest.account_holder || dest.name || withdrawal.user_name || 'LUMO Customer';
      const payoutAmount = Number(withdrawal.net_amount) > 0 ? Number(withdrawal.net_amount) : Number(withdrawal.amount);

      const payoutPayload = {
        splitId: withdrawal.reference_code,
        amount: payoutAmount,
        channel: isBank ? 'bank' : 'mobile',
        recipientPhone,
        recipientBank: dest.bankName || dest.bank || dest.bank_name,
        recipientAccount: dest.accountNumber || dest.account || dest.account_number,
        recipientName,
        narration: `LUMO Payout ${withdrawal.reference_code}`,
        metadata: {
          withdrawal_id: withdrawalId,
          user_id: withdrawal.user_id,
          reference_code: withdrawal.reference_code,
          retry: true
        },
        idempotencyKey: `wth_retry_${withdrawalId}_${Date.now()}`
      };

      const providerResult = await SnippePaymentProvider.sendPayout(payoutPayload);

      if (providerResult && providerResult.payoutId && providerResult.status !== 'FAILED') {
        await pool.query(
          `UPDATE withdrawal_requests
           SET status = $1, provider_tx_ref = $2, rejection_reason = NULL, updated_at = NOW()
           WHERE id = $3`,
          [
            providerResult.status === 'SETTLED' ? 'COMPLETED' : 'PROCESSING',
            providerResult.payoutId,
            withdrawalId
          ]
        );
      } else {
        const failureReason = providerResult?.failureReason || providerResult?.message || 'Payout failed';
        await pool.query(
          `UPDATE withdrawal_requests
           SET status = 'DISBURSEMENT_FAILED', rejection_reason = $1, updated_at = NOW()
           WHERE id = $2`,
          [failureReason, withdrawalId]
        );
      }

      await logAdminAuditAction(pool, {
        adminUserId: req.adminUser.id,
        adminEmail: req.adminUser.email,
        action: 'WITHDRAWAL_PAYOUT_TRIGGERED',
        resourceType: 'withdrawal',
        resourceId: withdrawalId,
        beforeState: { status: withdrawal.status },
        afterState: { providerResult, amount: payoutAmount },
        ipAddress: req.ip
      });

      const isSuccess = providerResult && providerResult.payoutId && providerResult.status !== 'FAILED';
      res.json({
        success: isSuccess,
        status: isSuccess ? (providerResult.status === 'SETTLED' ? 'COMPLETED' : 'PROCESSING') : 'DISBURSEMENT_FAILED',
        message: isSuccess
          ? `Mobile money payout successfully dispatched to ${recipientPhone} (Ref: ${providerResult.payoutId})`
          : `Disbursement failed at Snippe gateway: ${providerResult?.failureReason || 'Provider error'}`,
        payoutId: providerResult?.payoutId || null,
        providerResult
      });
    } catch (err) {
      console.error('[admin/withdrawals/disburse error]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // PAYMENT LINKS MANAGEMENT
  // -------------------------------------------------------------
  router.get('/payment-links', requirePermission('payment_links.view'), async (req, res) => {
    try {
      const { query, limit = 50, offset = 0 } = req.query;
      let sql = `
        SELECT 
          pl.*,
          u.name AS creator_name,
          u.phone AS creator_phone,
          COALESCE((
            SELECT COUNT(*) FROM payment_attempts pa 
            WHERE (pa.resource_type = 'payment_link' OR pa.application_id = 'payment_link') 
              AND pa.resource_id = pl.id::text 
              AND pa.status = 'COMPLETED'
          ), 0) AS contributions_count,
          COALESCE((
            SELECT SUM(amount) FROM payment_attempts pa 
            WHERE (pa.resource_type = 'payment_link' OR pa.application_id = 'payment_link') 
              AND pa.resource_id = pl.id::text 
              AND pa.status = 'COMPLETED'
          ), 0) AS collected_amount
        FROM payment_links pl
        LEFT JOIN users u ON pl.owner_user_id::text = u.id::text
        WHERE 1=1
      `;
      const params = [];

      if (query) {
        params.push(`%${query}%`);
        sql += ` AND (pl.title ILIKE $${params.length} OR pl.public_token ILIKE $${params.length} OR u.phone ILIKE $${params.length} OR u.name ILIKE $${params.length})`;
      }

      sql += ' ORDER BY pl.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(parseInt(limit), parseInt(offset));

      const { rows } = await pool.query(sql, params);
      res.json(rows.map(r => ({
        ...r,
        amount: Number(r.amount),
        collected_amount: Number(r.collected_amount || 0),
        contributions_count: Number(r.contributions_count || 0)
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/payment-links/:id/revoke', requirePermission('payment_links.revoke'), async (req, res) => {
    try {
      const linkId = req.params.id;
      const { rows } = await pool.query(
        "UPDATE payment_links SET status = 'REVOKED', updated_at = NOW() WHERE id = $1 RETURNING *",
        [linkId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Payment link not found' });
      }

      await logAdminAuditAction(pool, {
        adminUserId: req.adminUser.id,
        adminEmail: req.adminUser.email,
        action: 'PAYMENT_LINK_REVOKED',
        resourceType: 'payment_link',
        resourceId: linkId,
        afterState: { status: 'REVOKED' },
        ipAddress: req.ip
      });

      res.json({ message: 'Payment link revoked', link: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // DESTINATIONS MANAGEMENT
  // -------------------------------------------------------------
  router.get('/destinations', requirePermission('destinations.view'), async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const { rows } = await pool.query(`
        SELECT 
          pd.*,
          u.name AS owner_name,
          u.phone AS owner_phone,
          u.email AS owner_email
        FROM payment_destinations pd
        LEFT JOIN users u ON pd.owner_user_id::text = u.id::text
        ORDER BY pd.created_at DESC 
        LIMIT $1 OFFSET $2
      `, [parseInt(limit), parseInt(offset)]);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/destinations/:id/verify', requirePermission('destinations.verify'), async (req, res) => {
    try {
      const destId = req.params.id;
      const { rows } = await pool.query(
        "UPDATE payment_destinations SET is_verified = true, verification_status = 'VERIFIED', updated_at = NOW() WHERE id = $1 RETURNING *",
        [destId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Destination not found' });
      }

      await logAdminAuditAction(pool, {
        adminUserId: req.adminUser.id,
        adminEmail: req.adminUser.email,
        action: 'DESTINATION_VERIFIED',
        resourceType: 'destination',
        resourceId: destId,
        afterState: { is_verified: true, verification_status: 'VERIFIED' },
        ipAddress: req.ip
      });

      res.json({ message: 'Destination verified', destination: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/destinations/:id/toggle-status', requirePermission('destinations.verify'), async (req, res) => {
    try {
      const destId = req.params.id;
      const current = await pool.query('SELECT status FROM payment_destinations WHERE id = $1', [destId]);
      if (current.rows.length === 0) {
        return res.status(404).json({ error: 'Destination not found' });
      }
      const nextStatus = current.rows[0].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const { rows } = await pool.query(
        'UPDATE payment_destinations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [nextStatus, destId]
      );

      await logAdminAuditAction(pool, {
        adminUserId: req.adminUser.id,
        adminEmail: req.adminUser.email,
        action: 'DESTINATION_STATUS_TOGGLED',
        resourceType: 'destination',
        resourceId: destId,
        afterState: { status: nextStatus },
        ipAddress: req.ip
      });

      res.json({ message: `Destination status updated to ${nextStatus}`, destination: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // FEATURE MODULES (Pools, Michango, Bills)
  // -------------------------------------------------------------
  router.get('/pools', requirePermission('pools.view'), async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const { rows } = await pool.query(`
        SELECT 
          bp.id,
          bp.birthday_person AS title,
          bp.birthday_person,
          bp.message,
          bp.target_amount,
          bp.collected_amount,
          bp.currency,
          bp.status,
          bp.destination_id,
          bp.destination_snapshot,
          bp.created_at,
          bp.updated_at,
          u.name AS creator_name,
          u.phone AS creator_phone
        FROM birthday_pools bp
        LEFT JOIN users u ON bp.owner_user_id::text = u.id::text
        ORDER BY bp.created_at DESC
        LIMIT $1 OFFSET $2
      `, [parseInt(limit), parseInt(offset)]);

      res.json(rows.map(r => ({
        ...r,
        target_amount: Number(r.target_amount || 0),
        collected_amount: Number(r.collected_amount || 0),
        total_amount: Number(r.target_amount || 0)
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/michango', requirePermission('michango.view'), async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const { rows } = await pool.query(`
        SELECT 
          me.id,
          me.title,
          me.event_type,
          me.description,
          me.target_amount,
          me.collected_amount,
          me.currency,
          me.status,
          me.destination_id,
          me.destination_snapshot,
          me.created_at,
          me.updated_at,
          u.name AS creator_name,
          u.phone AS creator_phone
        FROM michango_events me
        LEFT JOIN users u ON me.owner_user_id::text = u.id::text
        ORDER BY me.created_at DESC
        LIMIT $1 OFFSET $2
      `, [parseInt(limit), parseInt(offset)]);

      res.json(rows.map(r => ({
        ...r,
        target_amount: Number(r.target_amount || 0),
        collected_amount: Number(r.collected_amount || 0),
        total_amount: Number(r.target_amount || 0)
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/bills', requirePermission('bills.view'), async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const { rows } = await pool.query(`
        SELECT 
          hc.id,
          hc.purpose AS title,
          hc.bill_provider,
          hc.biller_control_number,
          hc.amount_per_member,
          hc.target_members,
          hc.total_target_amount AS total_amount,
          hc.collected_amount,
          hc.currency,
          hc.contribution_status AS status,
          hc.bill_payment_status,
          hc.provider_tx_ref,
          hc.created_at,
          hc.updated_at,
          u.name AS creator_name,
          u.phone AS creator_phone
        FROM house_contributions hc
        LEFT JOIN users u ON hc.owner_user_id::text = u.id::text
        ORDER BY hc.created_at DESC
        LIMIT $1 OFFSET $2
      `, [parseInt(limit), parseInt(offset)]);

      res.json(rows.map(r => ({
        ...r,
        total_amount: Number(r.total_amount || 0),
        collected_amount: Number(r.collected_amount || 0),
        amount_per_member: Number(r.amount_per_member || 0)
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // SUPPORT CENTRE TICKETING & NOTES
  // -------------------------------------------------------------
  router.get('/support/tickets', requirePermission('support.view'), async (req, res) => {
    try {
      const { status, limit = 50, offset = 0, query } = req.query;
      let sql = 'SELECT * FROM support_tickets WHERE 1=1';
      const params = [];

      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }

      if (query) {
        params.push(`%${query}%`);
        sql += ` AND (ticket_number ILIKE $${params.length} OR user_name ILIKE $${params.length} OR user_phone ILIKE $${params.length} OR title ILIKE $${params.length})`;
      }

      sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(parseInt(limit), parseInt(offset));

      const { rows } = await pool.query(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/support/tickets/:id', requirePermission('support.view'), async (req, res) => {
    try {
      const ticketId = req.params.id;
      const tRes = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [ticketId]);
      if (tRes.rows.length === 0) {
        return res.status(404).json({ error: 'Support ticket not found' });
      }
      const ticket = tRes.rows[0];
      const notesRes = await pool.query(
        'SELECT * FROM support_notes WHERE ticket_id = $1 ORDER BY created_at ASC',
        [ticketId]
      );
      res.json({
        ...ticket,
        notes: notesRes.rows
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/support/tickets/:id/status', requirePermission('support.manage'), async (req, res) => {
    try {
      const ticketId = req.params.id;
      const { status, assignedAdminId } = req.body;
      const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be OPEN, IN_PROGRESS, RESOLVED, or CLOSED.' });
      }

      const { rows } = await pool.query(
        `UPDATE support_tickets 
         SET status = $1, 
             assigned_admin_id = COALESCE($2, assigned_admin_id),
             updated_at = NOW() 
         WHERE id = $3 RETURNING *`,
        [status, assignedAdminId || null, ticketId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Support ticket not found' });
      }

      await logAdminAuditAction(pool, {
        adminUserId: req.adminUser.id,
        adminEmail: req.adminUser.email,
        action: 'SUPPORT_TICKET_STATUS_UPDATED',
        resourceType: 'support_ticket',
        resourceId: ticketId,
        afterState: { status },
        ipAddress: req.ip
      });

      res.json({ message: 'Ticket status updated', ticket: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/support/tickets', requirePermission('support.manage'), async (req, res) => {
    try {
      const { userName, userPhone, userEmail, title, category, priority, details } = req.body;
      const ticketNum = 'TCK-' + Math.floor(100000 + Math.random() * 900000);

      const { rows } = await pool.query(
        `INSERT INTO support_tickets (ticket_number, user_name, user_phone, user_email, title, category, priority, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [ticketNum, userName || 'Customer', userPhone, userEmail, title, category || 'Payment', priority || 'MEDIUM', JSON.stringify({ details })]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/support/tickets/:id/notes', requirePermission('support.manage'), async (req, res) => {
    try {
      const ticketId = req.params.id;
      const { note, isInternal = true } = req.body;
      if (!note || !note.trim()) {
        return res.status(400).json({ error: 'Note text required' });
      }

      const { rows } = await pool.query(
        `INSERT INTO support_notes (ticket_id, admin_user_id, admin_name, is_internal, note)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [ticketId, req.adminUser.id, req.adminUser.fullName || req.adminUser.email, isInternal, note.trim()]
      );

      const allNotes = await pool.query(
        'SELECT * FROM support_notes WHERE ticket_id = $1 ORDER BY created_at ASC',
        [ticketId]
      );

      res.status(201).json({ note: rows[0], notes: allNotes.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // RECONCILIATION CENTRE
  // -------------------------------------------------------------
  router.get('/reconciliation', requirePermission('reports.view'), async (req, res) => {
    try {
      // Check 1: Payments marked completed without matching successful settlement
      const paymentDiscrepancies = await pool.query(`
        SELECT 
          p.id AS payment_id,
          p.provider_tx_ref,
          p.amount,
          p.status AS payment_status,
          s.id AS settlement_id,
          s.status AS settlement_status,
          p.created_at
        FROM payment_attempts p
        LEFT JOIN settlements s ON (p.provider_tx_ref = s.provider_reference OR p.id::text = s.payment_id::text)
        WHERE p.status = 'COMPLETED' AND (s.status IS NULL OR s.status = 'FAILED')
        ORDER BY p.created_at DESC
        LIMIT 25
      `);

      // Check 2: Withdrawals in PENDING_REVIEW vs user reserved balance
      const withdrawalReservationAudit = await pool.query(`
        SELECT 
          w.id AS withdrawal_id,
          w.reference_code,
          w.user_id,
          w.amount AS withdrawal_amount,
          w.status AS withdrawal_status,
          ub.available_balance,
          ub.reserved_balance,
          w.created_at
        FROM withdrawal_requests w
        LEFT JOIN user_balances ub ON w.user_id::text = ub.user_id::text
        WHERE w.status = 'PENDING_REVIEW' AND (ub.reserved_balance IS NULL OR ub.reserved_balance < w.amount)
        LIMIT 25
      `);

      // Check 3: Users whose ledger invariants are inconsistent
      const ledgerInvariants = await pool.query(`
        SELECT 
          ub.user_id,
          ub.available_balance,
          ub.reserved_balance,
          ub.pending_balance,
          (ub.available_balance + ub.reserved_balance + ub.pending_balance) AS total_sum
        FROM user_balances ub
        WHERE (ub.available_balance < 0 OR ub.reserved_balance < 0)
        LIMIT 25
      `);

      const totalDiscrepancies = 
        paymentDiscrepancies.rows.length + 
        withdrawalReservationAudit.rows.length + 
        ledgerInvariants.rows.length;

      res.json({
        discrepancyCount: totalDiscrepancies,
        items: paymentDiscrepancies.rows,
        reservationAnomalies: withdrawalReservationAudit.rows,
        ledgerAnomalies: ledgerInvariants.rows,
        summary: {
          paymentDiscrepancies: paymentDiscrepancies.rows.length,
          reservationAnomalies: withdrawalReservationAudit.rows.length,
          ledgerAnomalies: ledgerInvariants.rows.length
        },
        auditTimestamp: new Date().toISOString()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // FINANCIAL REPORTS & SUMMARY
  // -------------------------------------------------------------
  router.get('/reports/summary', requirePermission('reports.view'), async (req, res) => {
    try {
      const { timeframe = '30d' } = req.query;
      let days = 30;
      if (timeframe === '7d') days = 7;
      if (timeframe === '90d') days = 90;
      if (timeframe === 'all') days = 3650;

      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - days);

      // Volume & payment stats
      const payStats = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_payments,
          COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_payments,
          COALESCE(SUM(amount) FILTER (WHERE status = 'COMPLETED'), 0) AS total_volume
        FROM payment_attempts
        WHERE created_at >= $1
      `, [dateLimit]);

      // Withdrawal stats
      const wthStats = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status IN ('APPROVED', 'COMPLETED')) AS completed_withdrawals,
          COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW') AS pending_withdrawals,
          COALESCE(SUM(amount) FILTER (WHERE status IN ('APPROVED', 'COMPLETED')), 0) AS gross_withdrawals,
          COALESCE(SUM(fee) FILTER (WHERE status IN ('APPROVED', 'COMPLETED')), 0) AS total_withdrawal_fees,
          COALESCE(SUM(net_amount) FILTER (WHERE status IN ('APPROVED', 'COMPLETED')), 0) AS net_payouts_disbursed
        FROM withdrawal_requests
        WHERE created_at >= $1
      `, [dateLimit]);

      // User & split growth
      const growthStats = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE created_at >= $1) AS new_users,
          (SELECT COUNT(*) FROM splits WHERE created_at >= $1) AS new_splits
      `, [dateLimit]);

      res.json({
        timeframe,
        payments: {
          completed: parseInt(payStats.rows[0].completed_payments || 0),
          failed: parseInt(payStats.rows[0].failed_payments || 0),
          volume: Number(payStats.rows[0].total_volume || 0)
        },
        withdrawals: {
          completed: parseInt(wthStats.rows[0].completed_withdrawals || 0),
          pending: parseInt(wthStats.rows[0].pending_withdrawals || 0),
          grossAmount: Number(wthStats.rows[0].gross_withdrawals || 0),
          feeRevenue: Number(wthStats.rows[0].total_withdrawal_fees || 0),
          netDisbursed: Number(wthStats.rows[0].net_payouts_disbursed || 0)
        },
        growth: {
          newUsers: parseInt(growthStats.rows[0].new_users || 0),
          newSplits: parseInt(growthStats.rows[0].new_splits || 0)
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // PROVIDER HEALTH & SYSTEM MONITORING
  // -------------------------------------------------------------
  router.get('/providers', requirePermission('providers.view'), async (req, res) => {
    try {
      const snippeConfigured = !!process.env.SNIPPE_API_KEY;
      const { rows: caps } = await pool.query('SELECT * FROM provider_capabilities').catch(() => ({ rows: [] }));
      const { rows: apps } = await pool.query('SELECT * FROM application_integrations').catch(() => ({ rows: [] }));

      res.json([
        {
          name: 'Snippe.sh Mobile Money & Cards',
          status: snippeConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
          environment: process.env.NODE_ENV || 'production',
          type: 'PAYMENT_GATEWAY',
          capabilitiesCount: caps.length,
          lastWebhook: new Date().toISOString()
        },
        {
          name: 'Application Integrations Engine',
          status: apps.length > 0 ? 'CONNECTED' : 'STANDALONE',
          environment: process.env.NODE_ENV || 'production',
          type: 'INTERNAL_ROUTER',
          activeAppsCount: apps.filter(a => a.is_active).length,
          lastWebhook: new Date().toISOString()
        }
      ]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system', requirePermission('providers.view'), async (req, res) => {
    const startDb = Date.now();
    try {
      const dbCheck = await pool.query('SELECT NOW()');
      const latencyMs = Date.now() - startDb;
      const mem = process.memoryUsage();

      res.json({
        application: 'HEALTHY',
        database: dbCheck.rows ? 'HEALTHY' : 'DEGRADED',
        databaseLatencyMs: latencyMs,
        dbLatencyMs: latencyMs,
        memoryRssMb: Math.round(mem.rss / 1024 / 1024),
        memoryHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        webhookEngine: 'HEALTHY',
        uptimeSeconds: process.uptime()
      });
    } catch (err) {
      res.status(500).json({
        application: 'HEALTHY',
        database: 'DOWN',
        databaseLatencyMs: -1,
        error: err.message
      });
    }
  });

  // -------------------------------------------------------------
  // AUDIT LOGS
  // -------------------------------------------------------------
  router.get('/audit-logs', requirePermission('audit_logs.view'), async (req, res) => {
    try {
      const { limit = 50, offset = 0, query } = req.query;
      let sql = 'SELECT * FROM admin_audit_logs WHERE 1=1';
      const params = [];

      if (query) {
        params.push(`%${query}%`);
        sql += ` AND (admin_email ILIKE $${params.length} OR action ILIKE $${params.length} OR resource_type ILIKE $${params.length})`;
      }

      sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(parseInt(limit), parseInt(offset));

      const { rows } = await pool.query(sql, params);

      // If admin_audit_logs has 0 rows, check fallback audit_logs
      if (rows.length === 0 && !query) {
        const fallback = await pool.query(
          `SELECT 
            id,
            'system@lumosplit.lumo.co.tz' AS admin_email,
            action,
            entity_type AS resource_type,
            entity_id AS resource_id,
            details AS after_state,
            ip_address,
            created_at
          FROM audit_logs
          ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [parseInt(limit), parseInt(offset)]
        ).catch(() => ({ rows: [] }));

        if (fallback.rows && fallback.rows.length > 0) {
          return res.json(fallback.rows);
        }
      }

      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // WEBSITE INTEGRATIONS MANAGEMENT
  // -------------------------------------------------------------
  router.get('/integrations', requirePermission('providers.view'), async (req, res) => {
    try {
      const integrations = await ApplicationIntegrationService.getAllIntegrations(pool);
      res.json(integrations);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/integrations', requirePermission('providers.view'), async (req, res) => {
    try {
      const { applicationKey, displayName, websiteDomain, webhookUrl, redirectUrl, isActive } = req.body;
      if (!applicationKey || !displayName || !websiteDomain || !webhookUrl) {
        return res.status(400).json({ error: 'applicationKey, displayName, websiteDomain, and webhookUrl are required' });
      }

      const integration = await ApplicationIntegrationService.upsertIntegration(pool, {
        applicationKey,
        displayName,
        websiteDomain,
        webhookUrl,
        redirectUrl,
        isActive
      });

      await logAdminAuditAction(pool, {
        adminUserId: req.adminUser.id,
        adminEmail: req.adminUser.email,
        action: 'INTEGRATION_CONFIGURED',
        resourceType: 'integration',
        resourceId: integration.applicationKey,
        afterState: integration,
        ipAddress: req.ip
      });

      res.status(201).json(integration);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // CAMPAIGNS, CHARITY & SAVINGS INSPECTION
  // -------------------------------------------------------------
  router.get('/campaigns', requirePermission('splits.view'), async (req, res) => {
    try {
      const { category_type, query, status } = req.query;
      let sql = `
        SELECT 
          m.id,
          m.title,
          m.event_type,
          COALESCE(m.category_type, 'GENERAL') AS category_type,
          m.target_amount,
          COALESCE(m.collected_amount, 0) AS collected_amount,
          COALESCE(m.retained_savings, 0) AS retained_savings,
          COALESCE(m.total_withdrawn, 0) AS total_withdrawn,
          m.currency,
          m.status,
          m.owner_user_id,
          m.beneficiary_organization,
          m.beneficiary_name,
          m.created_at,
          COUNT(p.id) AS raw_payment_count,
          COUNT(DISTINCT COALESCE(p.contributor_user_id, p.payer_phone, p.payer_name)) AS distinct_contributor_count
        FROM michango_events m
        LEFT JOIN public_link_payments p ON p.link_id = m.id AND p.status = 'COMPLETED'
        WHERE 1=1
      `;
      const params = [];

      if (category_type && category_type !== 'ALL') {
        params.push(category_type.toUpperCase());
        sql += ` AND UPPER(COALESCE(m.category_type, 'GENERAL')) = $${params.length}`;
      }

      if (status) {
        params.push(status);
        sql += ` AND m.status = $${params.length}`;
      }

      if (query) {
        params.push(`%${query}%`);
        sql += ` AND (m.title ILIKE $${params.length} OR m.beneficiary_organization ILIKE $${params.length} OR m.beneficiary_name ILIKE $${params.length})`;
      }

      sql += `
        GROUP BY m.id
        ORDER BY m.created_at DESC
        LIMIT 100
      `;

      const { rows } = await pool.query(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

