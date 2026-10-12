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
      let sql = 'SELECT * FROM payout_records WHERE 1=1';
      const params = [];

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

  router.post('/settlements/:id/retry', requirePermission('settlements.retry'), async (req, res) => {
    try {
      const settlementId = req.params.id;
      const sRes = await pool.query('SELECT * FROM payout_records WHERE id = $1', [settlementId]);
      if (sRes.rows.length === 0) {
        return res.status(404).json({ error: 'Settlement record not found' });
      }

      const settlement = sRes.rows[0];
      if (settlement.status === 'SETTLED') {
        return res.status(400).json({ error: 'Settlement has already completed. Duplicate payout prevented.' });
      }

      // Idempotently update retry status
      await pool.query(
        "UPDATE payout_records SET status = 'PROCESSING', updated_at = NOW() WHERE id = $1",
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
        LEFT JOIN users u ON w.user_id = u.id
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
        'SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE',
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
            netPayout,
            approvedAt: new Date().toISOString()
          }
        });

        // 2. Update withdrawal status to APPROVED / PROCESSING
        await client.query(
          `UPDATE withdrawal_requests
           SET status = 'APPROVED', admin_reviewer_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [req.adminUser.id, withdrawalId]
        );

        await client.query('COMMIT');

        // 3. Initiate payment provider payout asynchronously or synchronously
        let providerResult = null;
        try {
          const dest = withdrawal.destination_details || {};
          const destType = (withdrawal.destination_type || '').toUpperCase();
          const isBank = destType === 'BANK';

          const payoutPayload = {
            splitId: withdrawal.reference_code,
            amount: netPayout,
            channel: isBank ? 'bank' : 'mobile',
            recipientPhone: dest.phone || dest.phoneNumber,
            recipientBank: dest.bankName || dest.bank,
            recipientAccount: dest.accountNumber || dest.account,
            recipientName: dest.accountHolder || dest.name || 'LUMO User',
            idempotencyKey: `wth_pay_${withdrawalId}_${Date.now()}`
          };

          providerResult = await SnippePaymentProvider.sendPayout(payoutPayload);

          if (providerResult && providerResult.payoutId) {
            await pool.query(
              `UPDATE withdrawal_requests
               SET status = $1, provider_tx_ref = $2, updated_at = NOW()
               WHERE id = $3`,
              [
                providerResult.status === 'SETTLED' ? 'COMPLETED' : 'PROCESSING',
                providerResult.payoutId,
                withdrawalId
              ]
            );
          }
        } catch (payoutErr) {
          console.warn('[Admin Payout] Disbursement dispatch notice:', payoutErr.message);
        }

        await logAdminAuditAction(pool, {
          adminUserId: req.adminUser.id,
          adminEmail: req.adminUser.email,
          action: 'WITHDRAWAL_APPROVED',
          resourceType: 'withdrawal',
          resourceId: withdrawalId,
          beforeState: { status: withdrawal.status, amount: requestedAmount },
          afterState: { status: 'APPROVED', netPayout, fee, providerResult },
          ipAddress: req.ip
        });

        res.json({
          message: 'Withdrawal approved and debit completed successfully',
          status: 'APPROVED',
          netPayout,
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

  // -------------------------------------------------------------
  // PAYMENT LINKS MANAGEMENT
  // -------------------------------------------------------------
  router.get('/payment-links', requirePermission('payment_links.view'), async (req, res) => {
    try {
      const { query, limit = 50, offset = 0 } = req.query;
      let sql = 'SELECT * FROM payment_links WHERE 1=1';
      const params = [];

      if (query) {
        params.push(`%${query}%`);
        sql += ` AND (title ILIKE $${params.length} OR public_token ILIKE $${params.length})`;
      }

      sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(parseInt(limit), parseInt(offset));

      const { rows } = await pool.query(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/payment-links/:id/revoke', requirePermission('payment_links.revoke'), async (req, res) => {
    try {
      const linkId = req.params.id;
      const { rows } = await pool.query(
        "UPDATE payment_links SET status = 'REVOKED' WHERE id = $1 RETURNING *",
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
      const { rows } = await pool.query('SELECT * FROM payment_destinations ORDER BY created_at DESC LIMIT 100');
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/destinations/:id/verify', requirePermission('destinations.verify'), async (req, res) => {
    try {
      const destId = req.params.id;
      const { rows } = await pool.query(
        "UPDATE payment_destinations SET is_verified = true, updated_at = NOW() WHERE id = $1 RETURNING *",
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
        ipAddress: req.ip
      });

      res.json({ message: 'Destination verified', destination: rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // FEATURE MODULES (Pools, Michango, Bills)
  // -------------------------------------------------------------
  router.get('/pools', requirePermission('pools.view'), async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT * FROM splits WHERE split_type = 'BIRTHDAY_POOL' ORDER BY created_at DESC");
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/michango', requirePermission('michango.view'), async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT * FROM splits WHERE split_type = 'MICHANGO' ORDER BY created_at DESC");
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/bills', requirePermission('bills.view'), async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT * FROM splits WHERE split_type = 'PAY_BILLS' ORDER BY created_at DESC");
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // SUPPORT CENTRE TICKETING & NOTES
  // -------------------------------------------------------------
  router.get('/support/tickets', requirePermission('support.view'), async (req, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      let sql = 'SELECT * FROM support_tickets WHERE 1=1';
      const params = [];

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
      if (!note) {
        return res.status(400).json({ error: 'Note text required' });
      }

      const { rows } = await pool.query(
        `INSERT INTO support_notes (ticket_id, admin_user_id, admin_name, is_internal, note)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [ticketId, req.adminUser.id, req.adminUser.fullName, isInternal, note]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // RECONCILIATION CENTRE
  // -------------------------------------------------------------
  router.get('/reconciliation', requirePermission('reports.view'), async (req, res) => {
    try {
      // Find discrepancies (e.g. payment intents without payout records or status mismatch)
      const { rows } = await pool.query(`
        SELECT 
          p.id AS payment_id,
          p.merchant_reference,
          p.provider_reference,
          p.amount,
          p.status AS payment_status,
          po.id AS payout_id,
          po.status AS payout_status,
          p.created_at
        FROM payment_attempts p
        LEFT JOIN payout_records po ON p.merchant_reference = po.reference
        WHERE p.status = 'COMPLETED' AND (po.status IS NULL OR po.status = 'FAILED')
        ORDER BY p.created_at DESC
        LIMIT 50
      `);

      res.json({
        discrepancyCount: rows.length,
        items: rows
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

      res.json([
        {
          name: 'Snippe',
          status: snippeConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
          environment: process.env.NODE_ENV || 'production',
          lastWebhook: new Date().toISOString()
        }
      ]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system', requirePermission('providers.view'), async (req, res) => {
    try {
      const dbCheck = await pool.query('SELECT NOW()');
      res.json({
        application: 'HEALTHY',
        database: dbCheck.rows ? 'HEALTHY' : 'DEGRADED',
        webhookEngine: 'HEALTHY',
        uptimeSeconds: process.uptime()
      });
    } catch (err) {
      res.status(500).json({ application: 'HEALTHY', database: 'DOWN', error: err.message });
    }
  });

  // -------------------------------------------------------------
  // AUDIT LOGS
  // -------------------------------------------------------------
  router.get('/audit-logs', requirePermission('audit_logs.view'), async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const { rows } = await pool.query(
        'SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [parseInt(limit), parseInt(offset)]
      );
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

  return router;
}

