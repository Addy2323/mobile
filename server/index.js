import express from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import pg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { SnippePaymentProvider } from './snippeProvider.js';
import { PaymentRoutingService } from './paymentRoutingService.js';
import { SettlementRouter } from './settlementRouter.js';
import { createAdminRouter } from './adminRoutes.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
app.use('/api/public/', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));
app.use('/api/splits/ref/', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));
app.use(['/api/payments/snippe/initiate'], rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }));
const port = process.env.PORT || 3001;
const dbUrl = process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString: dbUrl,
});

app.use(cors());
// Raw body parser for Snippe HMAC webhook verification
app.use('/api/payments/webhooks/snippe', express.raw({ type: 'application/json' }));
app.use('/api/webhooks/snippe', express.raw({ type: 'application/json' }));
app.use('/webhooks/snippe', express.raw({ type: 'application/json' }));
app.use(express.json());

// Mount Admin API Router
app.use('/api/admin', createAdminRouter(pool));

// Block money-moving and destructive legacy routes unless the admin key is sent
const safeEq = (x, y) => {
  const bx = Buffer.from(x || '');
  const by = Buffer.from(y || '');
  return bx.length === by.length && crypto.timingSafeEqual(bx, by);
};
app.use((req, res, next) => {
  const p = req.path;
  const sensitive =
    req.method === 'DELETE' ||
    p.startsWith('/api/payments/webhooks/snippe') ||
    p === '/api/payments/initiate' ||
    (req.method === 'PATCH' && p.startsWith('/api/splits')) ||
    (req.method === 'POST' && (p === '/api/payment-attempts' || p === '/api/audit-logs' || p === '/api/merchants')) ||
    (req.method === 'GET' && (p === '/api/audit-logs' || p === '/api/payment-attempts')) ||
    (req.method === 'PATCH' && p.startsWith('/api/merchants')) ||
    /^\/api\/payments\/fimipay\/(balance|balances|transactions|payouts)/.test(p);
  if (!sensitive) return next();
  const key = process.env.ADMIN_KEY;
  if (key && safeEq(req.get('x-admin-key'), key)) return next();
  return res.status(403).json({ error: 'Forbidden' });
});

// Helper for generating ref code if not provided
function generateRefCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Healthcheck
app.get('/api/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: dbRes.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PAYMENT DESTINATIONS ---
app.get('/api/destinations', async (req, res) => {
  try {
    const { owner_user_id } = req.query;
    if (!owner_user_id) return res.status(400).json({ error: 'owner_user_id required' });
    const { rows } = await pool.query("SELECT * FROM payment_destinations WHERE status = 'ACTIVE' AND owner_user_id = $1 ORDER BY created_at DESC", [owner_user_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/destinations', async (req, res) => {
  try {
    const validatedData = PaymentRoutingService.validateDestination(req.body);
    const {
      owner_user_id = null,
      type,
      provider = 'MOBILE_MONEY',
      display_name,
      phone_number = null,
      lipa_number = null,
      bank_name = null,
      account_number = null,
      beneficiary_full_name = null,
      qr_reference = null,
      card_reference = null,
      is_verified = true,
      metadata = null
    } = validatedData;

    const label = display_name || beneficiary_full_name || `${bank_name || type} Destination`;

    const query = `
      INSERT INTO payment_destinations (owner_user_id, type, provider, display_name, phone_number, lipa_number, bank_name, account_number, beneficiary_full_name, qr_reference, card_reference, is_verified, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      owner_user_id,
      type,
      provider,
      label,
      phone_number,
      lipa_number,
      bank_name,
      account_number,
      beneficiary_full_name,
      qr_reference,
      card_reference,
      is_verified,
      metadata
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/destinations/:id', async (req, res) => {
  try {
    const { owner_user_id } = req.query;
    if (!owner_user_id) return res.status(400).json({ error: 'owner_user_id required' });
    const { rows } = await pool.query('SELECT * FROM payment_destinations WHERE id = $1 AND owner_user_id = $2', [req.params.id, owner_user_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Destination not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PAYMENT LINKS ---
app.post('/api/payment-links', async (req, res) => {
  try {
    const {
      title,
      amount,
      currency = 'TZS',
      expiration_mode = '7_DAYS',
      owner_user_id = null,
      destination_id = null,
      destination = null
    } = req.body;

    if (!title || !amount) {
      return res.status(400).json({ error: 'Title and amount are required.' });
    }

    let destRecord = null;
    if (destination_id) {
      const dRes = await pool.query('SELECT * FROM payment_destinations WHERE id = $1', [destination_id]);
      if (dRes.rows.length > 0) destRecord = dRes.rows[0];
    } else if (destination && destination.type) {
      const validated = PaymentRoutingService.validateDestination(destination);
      const label = destination.display_name || destination.beneficiary_full_name || `${destination.bank_name || destination.type} Destination`;
      const dRes = await pool.query(
        `INSERT INTO payment_destinations (owner_user_id, type, provider, display_name, phone_number, lipa_number, bank_name, account_number, beneficiary_full_name, qr_reference, card_reference, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
         RETURNING *`,
        [
          owner_user_id,
          validated.type,
          validated.provider || 'MOBILE_MONEY',
          label,
          validated.phone_number || null,
          validated.lipa_number || null,
          validated.bank_name || null,
          validated.account_number || null,
          validated.beneficiary_full_name || null,
          validated.qr_reference || null,
          validated.card_reference || null
        ]
      );
      destRecord = dRes.rows[0];
    }

    const destSnapshot = PaymentRoutingService.createSnapshot(destRecord);
    const publicToken = 'PL-' + generateRefCode() + Math.random().toString(36).substring(2, 5).toUpperCase();

    let expiresAt = null;
    const now = new Date();
    if (expiration_mode === '24_HOURS') {
      expiresAt = new Date(now.getTime() + 24 * 3600 * 1000);
    } else if (expiration_mode === '7_DAYS') {
      expiresAt = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    } else if (expiration_mode === '30_DAYS') {
      expiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    }

    const query = `
      INSERT INTO payment_links (public_token, owner_user_id, title, amount, currency, expiration_mode, expires_at, status, destination_id, destination_snapshot)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $9)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      publicToken,
      owner_user_id,
      title,
      parseInt(amount, 10),
      currency,
      expiration_mode,
      expiresAt,
      destRecord ? destRecord.id : null,
      destSnapshot
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payment-links', async (req, res) => {
  try {
    const { owner_user_id } = req.query;
    if (!owner_user_id) return res.status(400).json({ error: 'owner_user_id required' });
    const { rows } = await pool.query(
      'SELECT * FROM payment_links WHERE owner_user_id = $1 ORDER BY created_at DESC',
      [owner_user_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC PAYMENT LINK LOOKUP (FIXES "Split not found" END-TO-END)
app.get(['/api/public/payment-links/:token', '/api/public/pay/:token'], async (req, res) => {
  try {
    const token = req.params.token;

    // 1. Check payment_links table
    const plRes = await pool.query('SELECT * FROM payment_links WHERE UPPER(public_token) = UPPER($1)', [token]);
    if (plRes.rows.length > 0) {
      const link = plRes.rows[0];

      if (link.status === 'REVOKED') {
        return res.status(400).json({ error: 'Payment link has been revoked.' });
      }

      if (link.expiration_mode === 'AFTER_PAYMENT' && link.status === 'PAID') {
        return res.status(400).json({ error: 'Payment link already used.' });
      }

      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        await pool.query("UPDATE payment_links SET status = 'EXPIRED' WHERE id = $1", [link.id]);
        return res.status(400).json({ error: 'Payment link has expired.' });
      }

      return res.json({
        type: 'PAYMENT_LINK',
        id: link.id,
        token: link.public_token,
        title: link.title,
        amount: parseInt(link.amount, 10),
        currency: link.currency,
        status: link.status,
        expirationMode: link.expiration_mode,
        expiresAt: link.expires_at,
        destinationSnapshot: link.destination_snapshot
      });
    }

    // 2. Fallback check splits table by ref_code
    const splitRes = await pool.query(
      `SELECT s.*, row_to_json(m.*) AS merchant
       FROM splits s
       LEFT JOIN merchants m ON s.merchant_id = m.id
       WHERE UPPER(s.ref_code) = UPPER($1)`,
      [token]
    );

    if (splitRes.rows.length > 0) {
      const split = splitRes.rows[0];
      const pRes = await pool.query('SELECT * FROM split_participants WHERE split_id = $1 ORDER BY created_at ASC', [split.id]);

      return res.json({
        type: 'SPLIT',
        id: split.id,
        token: split.ref_code,
        title: split.title,
        amount: parseInt(split.total_amount, 10),
        currency: split.currency,
        status: split.status,
        organizerName: split.organizer_name,
        participantCount: split.participant_count,
        participants: pRes.rows.map(p => ({ id: p.id, name: p.name, allocation_amount: p.allocation_amount, amount_paid: p.amount_paid, status: p.status, is_organizer: p.is_organizer, claim_status: p.claim_status })),
        destinationSnapshot: split.destination_snapshot || PaymentRoutingService.createSnapshot(null)
      });
    }

    return res.status(404).json({ error: 'Payment link not found.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC PAYMENT LINK PAY
app.post(['/api/public/payment-links/:token/pay', '/api/public/pay/:token/pay'], async (req, res) => {
  if (process.env.ALLOW_SIMULATED_PAYMENTS !== 'true') return res.status(503).json({ error: 'Online payment is not enabled yet.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const token = req.params.token;
    const { phone, payment_method = 'M-Pesa' } = req.body;

    if (!phone) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    // Lookup link in payment_links
    const plRes = await client.query('SELECT * FROM payment_links WHERE UPPER(public_token) = UPPER($1) FOR UPDATE', [token]);

    if (plRes.rows.length > 0) {
      const link = plRes.rows[0];

      if (link.status === 'REVOKED') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Payment link has been revoked.' });
      }

      if (link.expiration_mode === 'AFTER_PAYMENT' && link.status === 'PAID') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Payment link already used.' });
      }

      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        await client.query("UPDATE payment_links SET status = 'EXPIRED' WHERE id = $1", [link.id]);
        await client.query('COMMIT');
        return res.status(400).json({ error: 'Payment link has expired.' });
      }

      const txRef = `PL-${Date.now().toString().slice(-6)}`;

      // Update link status
      const newStatus = link.expiration_mode === 'AFTER_PAYMENT' ? 'PAID' : link.status;
      await client.query(
        'UPDATE payment_links SET status = $1, paid_at = NOW(), payment_ref = $2 WHERE id = $3',
        [newStatus, txRef, link.id]
      );

      // Record Audit Log
      await client.query(
        `INSERT INTO audit_logs (actor, action, entity_type, entity_id, metadata)
         VALUES ($1, 'PAYMENT_LINK_PAID', 'payment_link', $2, $3)`,
        [phone, link.id, { amount: link.amount, phone, txRef, destinationSnapshot: link.destination_snapshot }]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        message: 'Payment received successfully.',
        txRef,
        amountPaid: parseInt(link.amount, 10),
        destinationSnapshot: link.destination_snapshot || PaymentRoutingService.createSnapshot(null)
      });
    }

    await client.query('ROLLBACK');
    return res.status(404).json({ error: 'Payment link not found.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('payment link pay failed:', err);
    res.status(500).json({ error: 'Payment failed.' });
  } finally {
    client.release();
  }
});

// --- BIRTHDAY POOLS ---
app.post('/api/birthday-pools', async (req, res) => {
  try {
    const { birthday_person, message, target_amount, currency = 'TZS', owner_user_id = null, destination_id = null, destination = null } = req.body;
    let destRecord = null;
    if (destination_id) {
      const dRes = await pool.query('SELECT * FROM payment_destinations WHERE id = $1', [destination_id]);
      if (dRes.rows.length > 0) destRecord = dRes.rows[0];
    } else if (destination && destination.type) {
      const validated = PaymentRoutingService.validateDestination(destination);
      const label = destination.display_name || destination.beneficiary_full_name || `${destination.bank_name || destination.type} Destination`;
      const dRes = await pool.query(
        `INSERT INTO payment_destinations (owner_user_id, type, provider, display_name, phone_number, lipa_number, bank_name, account_number, beneficiary_full_name, qr_reference, card_reference, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true) RETURNING *`,
        [owner_user_id, validated.type, validated.provider || 'MOBILE_MONEY', label, validated.phone_number || null, validated.lipa_number || null, validated.bank_name || null, validated.account_number || null, validated.beneficiary_full_name || null, validated.qr_reference || null, validated.card_reference || null]
      );
      destRecord = dRes.rows[0];
    }

    const destSnapshot = PaymentRoutingService.createSnapshot(destRecord);
    const { rows } = await pool.query(
      `INSERT INTO birthday_pools (owner_user_id, birthday_person, message, target_amount, currency, status, destination_id, destination_snapshot)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7) RETURNING *`,
      [owner_user_id, birthday_person, message, target_amount, currency, destRecord ? destRecord.id : null, destSnapshot]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/birthday-pools', async (req, res) => {
  try {
    const { owner_user_id } = req.query;
    let query = 'SELECT * FROM birthday_pools';
    const values = [];
    if (owner_user_id) { query += ' WHERE owner_user_id = $1'; values.push(owner_user_id); }
    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, values);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MICHANGO / COMMUNITY EVENTS ---
app.post('/api/michango-events', async (req, res) => {
  try {
    const { title, event_type = 'WEDDING', description, target_amount, currency = 'TZS', owner_user_id = null, destination_id = null, destination = null } = req.body;
    let destRecord = null;
    if (destination_id) {
      const dRes = await pool.query('SELECT * FROM payment_destinations WHERE id = $1', [destination_id]);
      if (dRes.rows.length > 0) destRecord = dRes.rows[0];
    } else if (destination && destination.type) {
      const validated = PaymentRoutingService.validateDestination(destination);
      const label = destination.display_name || destination.beneficiary_full_name || `${destination.bank_name || destination.type} Destination`;
      const dRes = await pool.query(
        `INSERT INTO payment_destinations (owner_user_id, type, provider, display_name, phone_number, lipa_number, bank_name, account_number, beneficiary_full_name, qr_reference, card_reference, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true) RETURNING *`,
        [owner_user_id, validated.type, validated.provider || 'MOBILE_MONEY', label, validated.phone_number || null, validated.lipa_number || null, validated.bank_name || null, validated.account_number || null, validated.beneficiary_full_name || null, validated.qr_reference || null, validated.card_reference || null]
      );
      destRecord = dRes.rows[0];
    }

    const destSnapshot = PaymentRoutingService.createSnapshot(destRecord);
    const { rows } = await pool.query(
      `INSERT INTO michango_events (owner_user_id, title, event_type, description, target_amount, currency, status, destination_id, destination_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $8) RETURNING *`,
      [owner_user_id, title, event_type, description, target_amount, currency, destRecord ? destRecord.id : null, destSnapshot]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/michango-events', async (req, res) => {
  try {
    const { owner_user_id } = req.query;
    let query = 'SELECT * FROM michango_events';
    const values = [];
    if (owner_user_id) { query += ' WHERE owner_user_id = $1'; values.push(owner_user_id); }
    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, values);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PAY BILLS / HOUSE CONTRIBUTIONS ---
app.post('/api/house-contributions', async (req, res) => {
  try {
    const { purpose, bill_provider = 'TANESCO', biller_control_number = null, amount_per_member, target_members = 1, currency = 'TZS', owner_user_id = null, destination_id = null, destination = null } = req.body;
    const total_target_amount = amount_per_member * target_members;

    let destRecord = null;
    if (destination_id) {
      const dRes = await pool.query('SELECT * FROM payment_destinations WHERE id = $1', [destination_id]);
      if (dRes.rows.length > 0) destRecord = dRes.rows[0];
    } else if (destination && destination.type) {
      const validated = PaymentRoutingService.validateDestination(destination);
      const label = destination.display_name || destination.beneficiary_full_name || `${destination.bank_name || destination.type} Destination`;
      const dRes = await pool.query(
        `INSERT INTO payment_destinations (owner_user_id, type, provider, display_name, phone_number, lipa_number, bank_name, account_number, beneficiary_full_name, qr_reference, card_reference, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true) RETURNING *`,
        [owner_user_id, validated.type, validated.provider || 'MOBILE_MONEY', label, validated.phone_number || null, validated.lipa_number || null, validated.bank_name || null, validated.account_number || null, validated.beneficiary_full_name || null, validated.qr_reference || null, validated.card_reference || null]
      );
      destRecord = dRes.rows[0];
    }

    const destSnapshot = PaymentRoutingService.createSnapshot(destRecord);
    const { rows } = await pool.query(
      `INSERT INTO house_contributions (owner_user_id, purpose, bill_provider, biller_control_number, amount_per_member, target_members, total_target_amount, currency, contribution_status, bill_payment_status, destination_id, destination_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN', 'UNPAID', $9, $10) RETURNING *`,
      [owner_user_id, purpose, bill_provider, biller_control_number, amount_per_member, target_members, total_target_amount, currency, destRecord ? destRecord.id : null, destSnapshot]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/house-contributions', async (req, res) => {
  try {
    const { owner_user_id } = req.query;
    let query = 'SELECT * FROM house_contributions';
    const values = [];
    if (owner_user_id) { query += ' WHERE owner_user_id = $1'; values.push(owner_user_id); }
    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, values);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MERCHANTS ---
app.get('/api/merchants', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM merchants ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/merchants/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM merchants WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Merchant not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/merchants', async (req, res) => {
  try {
    const {
      display_name,
      legal_name,
      category,
      phone,
      verification_status = 'VERIFIED',
      destination_id,
      payment_rail = 'mobile_money',
      support_contact,
      logo_url,
      city,
      rating = 4.5
    } = req.body;

    const query = `
      INSERT INTO merchants (display_name, legal_name, category, phone, verification_status, destination_id, payment_rail, support_contact, logo_url, city, rating)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      display_name,
      legal_name,
      category,
      phone,
      verification_status,
      destination_id || `MERCH-${Date.now()}`,
      payment_rail,
      support_contact,
      logo_url,
      city,
      rating
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/merchants/:id', async (req, res) => {
  try {
    const fields = req.body;
    const setClause = [];
    const values = [req.params.id];
    let idx = 2;
    for (const [key, val] of Object.entries(fields)) {
      setClause.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
    if (setClause.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const query = `UPDATE merchants SET ${setClause.join(', ')} WHERE id = $1 RETURNING *`;
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Merchant not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SPLITS ---
app.get('/api/splits', async (req, res) => {
  const k = process.env.ADMIN_KEY;
  const isAdmin = !!k && safeEq(req.get('x-admin-key'), k);
  const ownerQ = req.query.owner_user_id;
  if (!isAdmin && !ownerQ) return res.status(400).json({ error: 'owner_user_id required' });
  try {
    const query = `
      SELECT s.*,
             row_to_json(m.*) AS merchant
      FROM splits s
      LEFT JOIN merchants m ON s.merchant_id = m.id
      ORDER BY s.created_at DESC
    `;
    const { rows } = await pool.query(query);
    res.json(rows.filter(r => isAdmin || r.owner_user_id === ownerQ).map(({ organizer_phone, ...rest }) => rest));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/splits/ref/:refCode', async (req, res) => {
  try {
    const splitQuery = `
      SELECT s.*, row_to_json(m.*) AS merchant
      FROM splits s
      LEFT JOIN merchants m ON s.merchant_id = m.id
      WHERE UPPER(s.ref_code) = UPPER($1)
    `;
    const { rows: splitRows } = await pool.query(splitQuery, [req.params.refCode]);
    if (splitRows.length === 0) return res.status(404).json({ error: 'Split not found' });

    const split = splitRows[0];

    const participantsQuery = 'SELECT * FROM split_participants WHERE split_id = $1 ORDER BY created_at ASC';
    const { rows: participants } = await pool.query(participantsQuery, [split.id]);

    const itemsQuery = 'SELECT * FROM allocation_items WHERE split_id = $1 ORDER BY created_at ASC';
    const { rows: items } = await pool.query(itemsQuery, [split.id]);

    { const { organizer_phone, ...pubSplit } = split; res.json({ ...pubSplit, participants: participants.map(({ phone, payment_ref, ...p }) => p), items }); }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/splits/:id', async (req, res) => {
  try {
    const splitQuery = `
      SELECT s.*, row_to_json(m.*) AS merchant
      FROM splits s
      LEFT JOIN merchants m ON s.merchant_id = m.id
      WHERE s.id = $1
    `;
    const { rows: splitRows } = await pool.query(splitQuery, [req.params.id]);
    if (splitRows.length === 0) return res.status(404).json({ error: 'Split not found' });

    const split = splitRows[0];

    const participantsQuery = 'SELECT * FROM split_participants WHERE split_id = $1 ORDER BY created_at ASC';
    const { rows: participants } = await pool.query(participantsQuery, [split.id]);

    const itemsQuery = 'SELECT * FROM allocation_items WHERE split_id = $1 ORDER BY created_at ASC';
    const { rows: items } = await pool.query(itemsQuery, [split.id]);

    { const { organizer_phone, ...pubSplit } = split; res.json({ ...pubSplit, participants: participants.map(({ phone, payment_ref, ...p }) => p), items }); }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/splits', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      title,
      category = 'restaurant',
      currency = 'TZS',
      total_amount,
      mode = 'equal',
      organizer_name,
      organizer_phone,
      merchant_id = null,
      status = 'ACTIVE',
      due_at = null,
      note = null,
      ref_code,
      owner_user_id = null,
      destination_id = null,
      destination = null,
      participants = [],
      items = []
    } = req.body;

    let destRecord = null;
    if (destination_id) {
      const dRes = await client.query('SELECT * FROM payment_destinations WHERE id = $1', [destination_id]);
      if (dRes.rows.length > 0) destRecord = dRes.rows[0];
    } else if (destination && destination.type) {
      const validated = PaymentRoutingService.validateDestination(destination);
      const label = destination.display_name || destination.beneficiary_full_name || `${destination.bank_name || destination.type} Destination`;
      const dRes = await client.query(
        `INSERT INTO payment_destinations (owner_user_id, type, provider, display_name, phone_number, lipa_number, bank_name, account_number, beneficiary_full_name, qr_reference, card_reference, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
         RETURNING *`,
        [
          owner_user_id,
          validated.type,
          validated.provider || 'MOBILE_MONEY',
          label,
          validated.phone_number || null,
          validated.lipa_number || null,
          validated.bank_name || null,
          validated.account_number || null,
          validated.beneficiary_full_name || null,
          validated.qr_reference || null,
          validated.card_reference || null
        ]
      );
      destRecord = dRes.rows[0];
    }

    const destSnapshot = PaymentRoutingService.createSnapshot(destRecord);
    const generatedRef = ref_code || generateRefCode();

    const insertSplitQuery = `
      INSERT INTO splits (title, category, currency, total_amount, mode, organizer_name, organizer_phone, merchant_id, status, due_at, note, settlement_percent, amount_paid, participant_count, ref_code, owner_user_id, destination_id, destination_snapshot)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;
    const splitRes = await client.query(insertSplitQuery, [
      title,
      category,
      currency,
      total_amount,
      mode,
      organizer_name,
      organizer_phone,
      merchant_id || null,
      status,
      due_at,
      note,
      0,
      0,
      participants.length,
      generatedRef,
      owner_user_id,
      destRecord ? destRecord.id : null,
      destSnapshot
    ]);

    const createdSplit = splitRes.rows[0];

    const createdParticipants = [];
    const participantIdMap = {};

    for (const p of participants) {
      const pRes = await client.query(
        `INSERT INTO split_participants (split_id, name, phone, allocation_amount, amount_paid, status, paid_at, payment_ref, is_organizer, claim_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          createdSplit.id,
          p.name,
          p.phone || null,
          p.allocation_amount || 0,
          p.amount_paid || 0,
          p.status || 'PENDING',
          p.paid_at || null,
          p.payment_ref || null,
          p.is_organizer || false,
          p.claim_status || 'none'
        ]
      );
      createdParticipants.push(pRes.rows[0]);
      if (p.id) {
        participantIdMap[p.id] = pRes.rows[0].id;
      }
    }

    const createdItems = [];
    for (const item of items) {
      const assignedId = item.assigned_participant_id
        ? (participantIdMap[item.assigned_participant_id] || item.assigned_participant_id)
        : null;

      const itemRes = await client.query(
        `INSERT INTO allocation_items (split_id, item_name, qty, price, assigned_participant_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [createdSplit.id, item.item_name, item.qty || 1, item.price || 0, assignedId]
      );
      createdItems.push(itemRes.rows[0]);
    }

    // Insert Audit Log
    await client.query(
      `INSERT INTO audit_logs (actor, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [organizer_name, 'SPLIT_CREATED', 'split', createdSplit.id, { total_amount, mode, ref_code: generatedRef }]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...createdSplit, participants: createdParticipants, items: createdItems });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.patch('/api/splits/:id', async (req, res) => {
  try {
    const fields = req.body;
    const setClause = [];
    const values = [req.params.id];

    let idx = 2;
    for (const [key, val] of Object.entries(fields)) {
      setClause.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }

    if (setClause.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const query = `UPDATE splits SET ${setClause.join(', ')} WHERE id = $1 RETURNING *`;
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Split not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PARTICIPANTS ---
app.get('/api/participants', async (req, res) => {
  try {
    if (!req.query.split_id) return res.status(400).json({ error: 'split_id required' });
    const { split_id } = req.query;
    let query = 'SELECT * FROM split_participants';
    const values = [];
    if (split_id) {
      query += ' WHERE split_id = $1';
      values.push(split_id);
    }
    query += ' ORDER BY created_at ASC';
    const { rows } = await pool.query(query, values);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/participants/:id/status', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM split_participants WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Participant not found' });
    res.json({ status: rows[0].status });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/participants/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const BLOCKED = ['id','status','amount_paid','paid_at','payment_ref','split_id','allocation_amount','is_organizer'];
    const fields = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => /^[a-z_]+$/.test(k) && !BLOCKED.includes(k)));
    const setClause = [];
    const values = [req.params.id];

    let idx = 2;
    for (const [key, val] of Object.entries(fields)) {
      setClause.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }

    if (setClause.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updateQuery = `UPDATE split_participants SET ${setClause.join(', ')} WHERE id = $1 RETURNING *`;
    const { rows } = await client.query(updateQuery, values);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Participant not found' });
    }

    const updatedParticipant = rows[0];

    // Recalculate split total paid and settlement percentage
    const splitId = updatedParticipant.split_id;
    const pSumRes = await client.query(
      'SELECT SUM(amount_paid) as total_paid, SUM(allocation_amount) as total_alloc FROM split_participants WHERE split_id = $1',
      [splitId]
    );

    const totalPaid = parseInt(pSumRes.rows[0].total_paid || '0', 10);
    const totalAlloc = parseInt(pSumRes.rows[0].total_alloc || '0', 10);
    const settlementPercent = totalAlloc > 0 ? Math.min(100, Math.round((totalPaid / totalAlloc) * 100)) : 0;

    let newStatus = 'ACTIVE';
    if (settlementPercent >= 100) {
      newStatus = 'SETTLED';
    } else if (totalPaid > 0) {
      newStatus = 'PARTIALLY_PAID';
    }

    await client.query(
      'UPDATE splits SET amount_paid = $1, settlement_percent = $2, status = $3 WHERE id = $4',
      [totalPaid, settlementPercent, newStatus, splitId]
    );

    await client.query('COMMIT');
    res.json(updatedParticipant);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('participants patch failed:', err);
    res.status(500).json({ error: 'Update failed.' });
  } finally {
    client.release();
  }
});

app.delete('/api/participants/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM split_participants WHERE id = $1 RETURNING *', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Participant not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PAYMENT ATTEMPTS ---
app.get('/api/payment-attempts', async (req, res) => {
  try {
    const { split_participant_id } = req.query;
    let query = `
      SELECT pa.*,
             row_to_json(p_joined.*) AS participant
      FROM payment_attempts pa
      LEFT JOIN (
        SELECT p.id, p.name, p.phone,
               row_to_json(s_joined.*) AS split
        FROM split_participants p
        LEFT JOIN splits s_joined ON p.split_id = s_joined.id
      ) p_joined ON pa.split_participant_id = p_joined.id
    `;
    const values = [];
    if (split_participant_id) {
      query += ' WHERE pa.split_participant_id = $1';
      values.push(split_participant_id);
    }
    query += ' ORDER BY pa.created_at DESC';
    const { rows } = await pool.query(query, values);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payment-attempts', async (req, res) => {
  try {
    const {
      split_participant_id,
      amount,
      provider = 'M-PESA',
      provider_tx_ref = null,
      status = 'PENDING',
      payment_method = 'Mobile Money',
      idempotency_key = null,
      failure_code = null
    } = req.body;

    // Check idempotency if provided
    if (idempotency_key) {
      const existing = await pool.query('SELECT * FROM payment_attempts WHERE idempotency_key = $1', [idempotency_key]);
      if (existing.rows.length > 0) {
        return res.json(existing.rows[0]);
      }
    }

    const query = `
      INSERT INTO payment_attempts (split_participant_id, amount, provider, provider_tx_ref, status, payment_method, idempotency_key, failure_code, requested_at, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
      RETURNING *
    `;
    const completedAt = status === 'SUCCESS' ? new Date() : null;
    const { rows } = await pool.query(query, [
      split_participant_id,
      amount,
      provider,
      provider_tx_ref,
      status,
      payment_method,
      idempotency_key,
      failure_code,
      completedAt
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    // If unique constraint violation on idempotency_key
    if (err.code === '23505' && req.body.idempotency_key) {
      const existing = await pool.query('SELECT * FROM payment_attempts WHERE idempotency_key = $1', [req.body.idempotency_key]);
      if (existing.rows.length > 0) {
        return res.json(existing.rows[0]);
      }
    }
    res.status(500).json({ error: err.message });
  }
});

// --- SNIPPE PAYMENT ENGINE ENDPOINTS ---

// 1. Initiate Payment (DB-enforced fixed amount!)
app.post('/api/payments/initiate', async (req, res) => {
  const client = await pool.connect();
  try {
    const { split_participant_id, phone, payment_method = 'M-Pesa' } = req.body;

    if (!split_participant_id || !phone) {
      return res.status(400).json({ error: 'split_participant_id and phone are required.' });
    }

    // SECURITY: Fetch authoritative allocation_amount directly from database! Ignore frontend amount.
    const pRes = await client.query(
      `SELECT p.*, s.title AS split_title, s.id AS split_id, s.merchant_id
       FROM split_participants p
       JOIN splits s ON p.split_id = s.id
       WHERE p.id = $1`,
      [split_participant_id]
    );

    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'Participant record not found.' });
    }

    const participant = pRes.rows[0];

    if (participant.status === 'PAID') {
      return res.status(400).json({ error: 'Participant obligation has already been PAID.' });
    }

    const expectedAmount = parseInt(participant.allocation_amount, 10);
    const idempotencyKey = `idem_${split_participant_id}_${Date.now()}`;

    // Create PaymentIntent
    await client.query(
      `INSERT INTO payment_intents (split_participant_id, split_id, expected_amount, currency, status, idempotency_key, metadata)
       VALUES ($1, $2, $3, 'TZS', 'PENDING', $4, $5)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [split_participant_id, participant.split_id, expectedAmount, idempotencyKey, { phone, payment_method }]
    );

    // Trigger Snippe Collection API
    const snippeRes = await SnippePaymentProvider.initiatePayment({
      amount: expectedAmount,
      phone: phone,
      splitId: participant.split_id,
      participantId: split_participant_id,
      participantName: participant.name,
      idempotencyKey: idempotencyKey
    });

    // Record PaymentAttempt
    const paRes = await client.query(
      `INSERT INTO payment_attempts (split_participant_id, amount, provider, provider_tx_ref, status, payment_method, idempotency_key, requested_at)
       VALUES ($1, $2, 'SNIPPE', $3, 'PENDING', $4, $5, NOW())
       RETURNING *`,
      [split_participant_id, expectedAmount, snippeRes.providerTxRef, payment_method, idempotencyKey]
    );

    res.status(201).json({
      success: true,
      message: 'Payment prompt dispatched successfully.',
      paymentAttempt: paRes.rows[0],
      providerTxRef: snippeRes.providerTxRef
    });
  } catch (err) {
    console.error('Error initiating Snippe payment:', err);
    res.status(500).json({ error: 'Could not start payment.' });
  } finally {
    client.release();
  }
});

// 2. Real-Time Snippe Webhook Endpoint (HMAC Signed & Idempotent)
app.post('/api/payments/webhooks/snippe', async (req, res) => {
  const rawBuffer = req.body;
  const sigHeader = req.headers['x-webhook-signature'] || req.headers['x-snippe-signature'];

  // Verify HMAC signature
  const isValid = SnippePaymentProvider.verifyWebhookSignature(rawBuffer, sigHeader);
  if (!isValid) {
    console.warn('⚠️ Webhook signature verification failed.');
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  let eventPayload;
  try {
    eventPayload = JSON.parse(rawBuffer.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }

  const eventId = eventPayload.event_id || eventPayload.id || `evt_${Date.now()}`;
  const eventType = eventPayload.event_type || eventPayload.type || 'payment.success';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Strict Idempotency Check
    const existingEvt = await client.query('SELECT 1 FROM webhook_events WHERE event_id = $1', [eventId]);
    if (existingEvt.rows.length > 0) {
      await client.query('COMMIT');
      client.release();
      return res.status(200).json({ received: true, note: 'Event already processed' });
    }

    await client.query(
      `INSERT INTO webhook_events (event_id, provider, event_type, payload)
       VALUES ($1, 'SNIPPE', $2, $3)`,
      [eventId, eventType, eventPayload]
    );

    const metadata = eventPayload.data?.metadata || eventPayload.metadata || {};
    const participantId = metadata.participant_id;
    const providerTxRef = eventPayload.data?.reference || eventPayload.reference;

    if (participantId) {
      // Fetch participant details
      const pRes = await client.query('SELECT * FROM split_participants WHERE id = $1 FOR UPDATE', [participantId]);
      if (pRes.rows.length > 0) {
        const participant = pRes.rows[0];
        const splitId = participant.split_id;

        // Update Participant to PAID
        await client.query(
          `UPDATE split_participants
           SET status = 'PAID', amount_paid = allocation_amount, paid_at = NOW(), payment_ref = $1
           WHERE id = $2`,
          [providerTxRef || 'SNP-CONFIRMED', participantId]
        );

        // Update PaymentAttempt to SUCCESS
        await client.query(
          `UPDATE payment_attempts
           SET status = 'SUCCESS', completed_at = NOW()
           WHERE split_participant_id = $1 AND status = 'PENDING'`,
          [participantId]
        );

        // Recalculate Split Total Paid & Settlement Percentage
        const pSumRes = await client.query(
          'SELECT SUM(amount_paid) as total_paid, SUM(allocation_amount) as total_alloc FROM split_participants WHERE split_id = $1',
          [splitId]
        );

        const totalPaid = parseInt(pSumRes.rows[0].total_paid || '0', 10);
        const totalAlloc = parseInt(pSumRes.rows[0].total_alloc || '0', 10);
        const settlementPercent = totalAlloc > 0 ? Math.min(100, Math.round((totalPaid / totalAlloc) * 100)) : 0;

        let newStatus = 'ACTIVE';
        if (settlementPercent >= 100) {
          newStatus = 'SETTLED';
        } else if (totalPaid > 0) {
          newStatus = 'PARTIALLY_PAID';
        }

        await client.query(
          'UPDATE splits SET amount_paid = $1, settlement_percent = $2, status = $3 WHERE id = $4',
          [totalPaid, settlementPercent, newStatus, splitId]
        );

        // AUTOMATED SETTLEMENT DISPATCH: If split is 100% SETTLED, trigger payout to merchant
        if (newStatus === 'SETTLED') {
          console.log(`🎉 Split ${splitId} reached 100% SETTLED! Dispatching Automated Snippe Payout...`);
          const payoutRes = await SnippePaymentProvider.sendPayout({
            splitId: splitId,
            amount: totalPaid,
            channel: 'mobile',
            recipientPhone: '255754123456',
            recipientName: 'Golden Hotel / Verified Merchant'
          });

          await client.query(
            `INSERT INTO payout_records (split_id, amount, fee, channel, recipient_reference, provider_payout_id, status)
             VALUES ($1, $2, 1500, 'mobile', '255754123456', $3, $4)`,
            [splitId, totalPaid, payoutRes.payoutId, payoutRes.status]
          );
        }
      }
    }

    await client.query('COMMIT');
    client.release();
    res.status(200).json({ received: true });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Error processing Snippe webhook:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Webhook Simulator (for instant frontend testing)
app.post('/api/payments/simulate-webhook', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not found' });
  const { participant_id } = req.body;
  if (!participant_id) return res.status(400).json({ error: 'participant_id required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pRes = await client.query('SELECT * FROM split_participants WHERE id = $1', [participant_id]);
    if (pRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Participant not found' });
    }

    const participant = pRes.rows[0];
    const splitId = participant.split_id;
    const txRef = `SNP-SIM-${Date.now().toString().slice(-6)}`;

    // Update Participant to PAID
    await client.query(
      `UPDATE split_participants
       SET status = 'PAID', amount_paid = allocation_amount, paid_at = NOW(), payment_ref = $1
       WHERE id = $2`,
      [txRef, participant_id]
    );

    // Update PaymentAttempt
    await client.query(
      `UPDATE payment_attempts
       SET status = 'SUCCESS', completed_at = NOW()
       WHERE split_participant_id = $1`,
      [participant_id]
    );

    // Recalculate Split Total Paid & Settlement Percentage
    const pSumRes = await client.query(
      'SELECT SUM(amount_paid) as total_paid, SUM(allocation_amount) as total_alloc FROM split_participants WHERE split_id = $1',
      [splitId]
    );

    const totalPaid = parseInt(pSumRes.rows[0].total_paid || '0', 10);
    const totalAlloc = parseInt(pSumRes.rows[0].total_alloc || '0', 10);
    const settlementPercent = totalAlloc > 0 ? Math.min(100, Math.round((totalPaid / totalAlloc) * 100)) : 0;

    let newStatus = 'ACTIVE';
    if (settlementPercent >= 100) {
      newStatus = 'SETTLED';
    } else if (totalPaid > 0) {
      newStatus = 'PARTIALLY_PAID';
    }

    await client.query(
      'UPDATE splits SET amount_paid = $1, settlement_percent = $2, status = $3 WHERE id = $4',
      [totalPaid, settlementPercent, newStatus, splitId]
    );

    // Trigger settlement payout if 100%
    if (newStatus === 'SETTLED') {
      const payoutRes = await SnippePaymentProvider.sendPayout({
        splitId: splitId,
        amount: totalPaid,
        channel: 'mobile',
        recipientPhone: '255754123456',
        recipientName: 'Golden Hotel / Verified Merchant'
      });

      await client.query(
        `INSERT INTO payout_records (split_id, amount, fee, channel, recipient_reference, provider_payout_id, status)
         VALUES ($1, $2, 1500, 'mobile', '255754123456', $3, $4)`,
        [splitId, totalPaid, payoutRes.payoutId, payoutRes.status]
      );
    }

    await client.query('COMMIT');
    client.release();
    res.json({ success: true, message: 'Simulated Snippe webhook processed successfully.', status: newStatus, amountPaid: totalPaid });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    res.status(500).json({ error: err.message });
  }
});

// 4. Admin Payment Reconciliation Endpoint
app.get('/api/admin/reconciliation', async (req, res) => {
  try {
    const attemptsRes = await pool.query(`
      SELECT pa.*, sp.name AS participant_name, s.title AS split_title, s.ref_code
      FROM payment_attempts pa
      JOIN split_participants sp ON pa.split_participant_id = sp.id
      JOIN splits s ON sp.split_id = s.id
      ORDER BY pa.created_at DESC
      LIMIT 50
    `);

    const payoutsRes = await pool.query(`
      SELECT pr.*, s.title AS split_title, s.ref_code
      FROM payout_records pr
      JOIN splits s ON pr.split_id = s.id
      ORDER BY pr.created_at DESC
      LIMIT 20
    `);

    res.json({
      transactions: attemptsRes.rows,
      payouts: payoutsRes.rows,
      reconciliationStatus: 'HEALTHY',
      lastReconciled: new Date()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- AUDIT LOGS ---
app.get('/api/audit-logs', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
  // Payment Links Resolution (GET /api/payment-links/:token, /api/public/payment-links/:token)
app.get(['/api/payment-links/:token', '/api/public/payment-links/:token'], async (req, res) => {
  try {
    const { token } = req.params;
    const { rows } = await pool.query(
      `SELECT pl.*, pd.display_name AS dest_display_name, pd.type AS dest_type, pd.provider AS dest_provider, pd.phone_number AS dest_phone, pd.bank_name AS dest_bank, pd.account_number AS dest_account, pd.beneficiary_full_name AS dest_beneficiary
       FROM payment_links pl
       LEFT JOIN payment_destinations pd ON pl.destination_id = pd.id
       WHERE pl.public_token = $1 OR pl.id::text = $1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Payment link not found.' });
    }

    const link = rows[0];
    const statusCheck = PaymentRoutingService.evaluateLinkStatus(link);
    if (!statusCheck.isValid) {
      return res.status(400).json({ error: statusCheck.error, status: link.status });
    }

    res.json({
      id: link.id,
      public_token: link.public_token,
      title: link.title,
      amount: parseInt(link.amount, 10),
      currency: link.currency,
      status: link.status,
      expiration_mode: link.expiration_mode,
      expires_at: link.expires_at,
      destination_snapshot: link.destination_snapshot,
      created_at: link.created_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audit-logs', async (req, res) => {
  try {
    const { actor = 'system', action, entity_type, entity_id = null, metadata = null } = req.body;
    const query = `
      INSERT INTO audit_logs (actor, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [actor, action, entity_type, entity_id, metadata]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN METRICS ---
app.get('/api/admin/metrics', async (req, res) => {
  try {
    const splitsCountRes = await pool.query('SELECT COUNT(*) FROM splits');
    const totalVolumeRes = await pool.query('SELECT SUM(total_amount) FROM splits');
    const totalPaidRes = await pool.query('SELECT SUM(amount_paid) FROM splits');
    const merchantsCountRes = await pool.query('SELECT COUNT(*) FROM merchants');
    const participantsCountRes = await pool.query('SELECT COUNT(*) FROM split_participants');
    const paymentsCountRes = await pool.query("SELECT COUNT(*) FROM payment_attempts WHERE status = 'SUCCESS'");

    res.json({
      totalSplits: parseInt(splitsCountRes.rows[0].count, 10),
      totalVolume: parseInt(totalVolumeRes.rows[0].sum || '0', 10),
      totalPaid: parseInt(totalPaidRes.rows[0].sum || '0', 10),
      totalMerchants: parseInt(merchantsCountRes.rows[0].count, 10),
      totalParticipants: parseInt(participantsCountRes.rows[0].count, 10),
      successfulPayments: parseInt(paymentsCountRes.rows[0].count, 10)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// --- FIMIPAY MERCHANT API v1 ENDPOINTS ---
// ==========================================

// Helper function to handle successful payment state updates
async function applySuccessfulPayment(client, { orderId, participantId, amountPaid, providerTxRef }) {
  let pId = participantId;

  if (!pId && orderId) {
    // 1. Direct match on split_participants.payment_ref or id
    const pDirect = await client.query('SELECT id FROM split_participants WHERE payment_ref = $1 OR id = $1 LIMIT 1', [orderId]);
    if (pDirect.rows.length > 0) {
      pId = pDirect.rows[0].id;
    }

    // 2. Lookup via payment_attempts
    if (!pId) {
      const paCheck = await client.query('SELECT split_participant_id FROM payment_attempts WHERE idempotency_key = $1 OR provider_tx_ref = $1 LIMIT 1', [orderId]);
      if (paCheck.rows.length > 0) {
        pId = paCheck.rows[0].split_participant_id;
      }
    }

    // 3. Lookup via payment_intents
    if (!pId) {
      const piCheck = await client.query('SELECT split_participant_id FROM payment_intents WHERE idempotency_key = $1 LIMIT 1', [orderId]);
      if (piCheck.rows.length > 0) {
        pId = piCheck.rows[0].split_participant_id;
      }
    }

    // 4. Extract participant ID pattern if orderId is fp_<participantId>_<timestamp>
    if (!pId && String(orderId).startsWith('fp_')) {
      const parts = String(orderId).split('_');
      if (parts.length >= 2 && parts[1]) {
        const potentialId = parts[1];
        const pCheck = await client.query('SELECT id FROM split_participants WHERE id = $1 LIMIT 1', [potentialId]);
        if (pCheck.rows.length > 0) {
          pId = pCheck.rows[0].id;
        }
      }
    }
  }

  if (!pId) {
    console.warn(`[FimiPay] Unable to resolve participant for orderId: ${orderId}`);
    return null;
  }

  const pRes = await client.query('SELECT * FROM split_participants WHERE id = $1 FOR UPDATE', [pId]);
  if (pRes.rows.length === 0) return null;

  const participant = pRes.rows[0];
  if (participant.status === 'PAID') return { splitId: participant.split_id, participantId: pId, alreadyPaid: true };
  const splitId = participant.split_id;
  if (amountPaid != null && Number(amountPaid) !== Number(participant.allocation_amount)) {
    console.warn(`[FimiPay] Amount mismatch for ${orderId}: provider ${amountPaid}, expected ${participant.allocation_amount}`);
  }
  const finalPaid = amountPaid || participant.allocation_amount;

  // Update Participant status
  await client.query(
    `UPDATE split_participants
     SET status = 'PAID', amount_paid = $1, paid_at = NOW(), payment_ref = $2
     WHERE id = $3`,
    [finalPaid, providerTxRef || orderId || 'FMP-CONFIRMED', pId]
  );

  // Update PaymentAttempt
  await client.query(
    `UPDATE payment_attempts
     SET status = 'SUCCESS', completed_at = NOW(), provider_tx_ref = $1
     WHERE (split_participant_id = $2 AND status = 'PENDING') OR idempotency_key = $3`,
    [providerTxRef || orderId, pId, orderId]
  );

  // Recalculate Split status & settlement percentage
  const pSumRes = await client.query(
    'SELECT SUM(amount_paid) as total_paid, SUM(allocation_amount) as total_alloc FROM split_participants WHERE split_id = $1',
    [splitId]
  );

  const totalPaid = parseInt(pSumRes.rows[0].total_paid || '0', 10);
  const totalAlloc = parseInt(pSumRes.rows[0].total_alloc || '0', 10);
  const settlementPercent = totalAlloc > 0 ? Math.min(100, Math.round((totalPaid / totalAlloc) * 100)) : 0;

  let newStatus = 'ACTIVE';
  if (settlementPercent >= 100) {
    newStatus = 'SETTLED';
  } else if (totalPaid > 0) {
    newStatus = 'PARTIALLY_PAID';
  }

  await client.query(
    'UPDATE splits SET amount_paid = $1, settlement_percent = $2, status = $3 WHERE id = $4',
    [totalPaid, settlementPercent, newStatus, splitId]
  );

  // Trigger automated payout settlement if destination snapshot exists
  try {
    const destRes = await client.query(
      `SELECT destination_snapshot FROM split_participants WHERE id = $1 
       UNION ALL 
       SELECT destination_snapshot FROM splits WHERE id = $2`,
      [pId, splitId]
    );
    let dSnapshot = null;
    for (const r of destRes.rows) {
      if (r.destination_snapshot && r.destination_snapshot.enabled) {
        dSnapshot = r.destination_snapshot;
        break;
      }
    }
    if (dSnapshot) {
      await SettlementRouter.processAutomatedSettlement(client, {
        paymentId: providerTxRef || orderId,
        participantId: pId,
        splitId,
        amount: finalPaid,
        destinationSnapshot: dSnapshot
      });
    }
  } catch (settleErr) {
    console.warn('[Automated Settlement Notice]:', settleErr.message);
  }

  return { splitId, participantId: pId, settlementPercent, status: newStatus };
}



// Snippe Collection Initiation API (POST /api/payments/snippe/initiate)
app.post('/api/payments/snippe/initiate', async (req, res) => {
  const client = await pool.connect();
  try {
    const { split_participant_id, phone, amount, idempotency_key } = req.body;
    if (!split_participant_id || !phone) {
      return res.status(400).json({ error: 'split_participant_id and phone are required.' });
    }

    const pRes = await client.query(
      `SELECT p.*, s.title AS split_title, s.id AS split_id
       FROM split_participants p
       JOIN splits s ON p.split_id = s.id
       WHERE p.id = $1`,
      [split_participant_id]
    );

    if (pRes.rows.length === 0) return res.status(404).json({ error: 'Participant not found.' });
    if (pRes.rows[0].status === 'PAID') return res.status(400).json({ error: 'Already paid.' });

    const participant = pRes.rows[0];
    const targetAmount = amount || participant.allocation_amount;
    const idemKey = SnippePaymentProvider.formatIdempotencyKey(idempotency_key || `pay_${participant.id.slice(0, 18)}`);

    const snippeResult = await SnippePaymentProvider.initiatePayment({
      amount: targetAmount,
      phone,
      currency: 'TZS',
      splitId: participant.split_id,
      participantId: participant.id,
      participantName: participant.name,
      idempotencyKey: idemKey
    });

    await client.query('UPDATE split_participants SET payment_ref = $1 WHERE id = $2', [snippeResult.providerTxRef, participant.id]);
    try {
      await client.query(
        `INSERT INTO payment_attempts (split_participant_id, amount, provider, provider_tx_ref, status, payment_method, idempotency_key, requested_at)
         VALUES ($1, $2, 'SNIPPE', $3, 'PENDING', 'mobile_money', $4, NOW())`,
        [participant.id, targetAmount, snippeResult.providerTxRef, idemKey]
      );
    } catch (attErr) {
      console.warn('[Snippe Attempt Notice]:', attErr.message);
    }

    res.json({
      success: true,
      providerTxRef: snippeResult.providerTxRef,
      status: snippeResult.status,
      message: snippeResult.message
    });
  } catch (err) {
    console.error('Error initiating Snippe payment:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Snippe Webhook Handler (POST /api/webhooks/snippe, /webhooks/snippe)
app.post(['/api/payments/webhooks/snippe', '/api/webhooks/snippe', '/webhooks/snippe'], async (req, res) => {
  const rawBuffer = req.body;
  const isValid = SnippePaymentProvider.verifyWebhookSignature(rawBuffer, req);
  if (!isValid) {
    console.warn('⚠️ Snippe Webhook signature verification failed.');
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  let eventPayload;
  try {
    eventPayload = JSON.parse(rawBuffer.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }

  console.log('[Snippe Webhook Received]:', eventPayload);

  const eventId = eventPayload.event_id || eventPayload.id || 'snp_evt_' + crypto.createHash('sha256').update(rawBuffer).digest('hex');
  const eventType = (eventPayload.event_type || eventPayload.event || eventPayload.type || '').toLowerCase();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingEvt = await client.query('SELECT 1 FROM webhook_events WHERE provider = \'SNIPPE\' AND event_id = $1', [eventId]);
    if (existingEvt.rows.length > 0) {
      await client.query('COMMIT');
      return res.status(200).json({ received: true, note: 'Event already processed' });
    }

    await client.query(
      `INSERT INTO webhook_events (event_id, provider, event_type, payload)
       VALUES ($1, 'SNIPPE', $2, $3)
       ON CONFLICT (provider, event_id) DO NOTHING`,
      [eventId, eventType, eventPayload]
    );

    const dataObj = eventPayload.data || eventPayload;
    const ref = dataObj.reference || dataObj.external_reference || eventPayload.order_id;
    const metadata = dataObj.metadata || {};
    const participantId = metadata.participant_id || dataObj.participant_id;

    if (['payment.completed', 'payment.success'].includes(eventType)) {
      await applySuccessfulPayment(client, {
        orderId: ref,
        participantId,
        amountPaid: dataObj.amount?.value || dataObj.amount,
        providerTxRef: ref
      });
    } else if (eventType === 'payout.completed') {
      await client.query(
        `UPDATE settlements SET status = 'SETTLED', completed_at = NOW(), updated_at = NOW() WHERE provider_reference = $1 OR split_id = $2`,
        [ref, metadata.split_id]
      );
    } else if (eventType === 'payout.failed') {
      await client.query(
        `UPDATE settlements SET status = 'FAILED', failure_reason = $1, updated_at = NOW() WHERE provider_reference = $2 OR split_id = $3`,
        [dataObj.failure_reason || 'Payout failed', ref, metadata.split_id]
      );
    } else if (eventType === 'payout.reversed') {
      await client.query(
        `UPDATE settlements SET status = 'REVERSED', failure_reason = 'Payout was reversed', updated_at = NOW() WHERE provider_reference = $1 OR split_id = $2`,
        [ref, metadata.split_id]
      );
    }

    await client.query('COMMIT');
    res.status(200).json({ received: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error processing Snippe webhook:', err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  } finally {
    client.release();
  }
});
app.post(['/', '/api/payments/webhooks/fimipay', '/webhooks/fimipay'], async (req, res) => {
  const rawBuffer = req.body;
  const sigHeader =
    req.headers['x-fimipay-signature'] ||
    req.headers['x-signature'] ||
    req.headers['x-webhook-signature'];

  const isValid = FimiPayProvider.verifyWebhookSignature(rawBuffer, req);
  if (!isValid) {
    console.warn('⚠️ FimiPay Webhook signature verification failed.');
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  let eventPayload;
  try {
    eventPayload = JSON.parse(rawBuffer.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }

  console.log('[FimiPay Webhook Received]:', eventPayload);

  // hardened:fimipay
  const eventId = eventPayload.event_id || eventPayload.id || 'sha_' + crypto.createHash('sha256').update(rawBuffer).digest('hex');
  const eventType = eventPayload.event_type || eventPayload.event || eventPayload.type || 'unknown';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Idempotency Check
    const existingEvt = await client.query('SELECT 1 FROM webhook_events WHERE event_id = $1', [eventId]);
    if (existingEvt.rows.length > 0) {
      await client.query('COMMIT');
      return res.status(200).json({ received: true, note: 'Event already processed' });
    }

    await client.query(
      `INSERT INTO webhook_events (event_id, provider, event_type, payload)
       VALUES ($1, 'FIMIPAY', $2, $3)`,
      [eventId, eventType, eventPayload]
    );

    const orderId = eventPayload.order_id || eventPayload.data?.order_id || eventPayload.orderId;
    const paymentStatus = (eventPayload.payment_status || eventPayload.status || eventPayload.data?.payment_status || '').toUpperCase();
    const amountPaid = eventPayload.amount || eventPayload.data?.amount;
    const participantId = eventPayload.participant_id || eventPayload.data?.participant_id || eventPayload.metadata?.participant_id;

    if (['SUCCESS', 'COMPLETED'].includes(paymentStatus) || (!paymentStatus && eventType === 'payment.success')) {
      await applySuccessfulPayment(client, {
        orderId,
        participantId,
        amountPaid,
        providerTxRef: orderId || `FMP-TX-${Date.now()}`
      });
    }

    await client.query('COMMIT');
    res.status(200).json({ received: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error processing FimiPay webhook:', err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  } finally {
    client.release();
  }
});

// Participant Status API (GET /api/participants/:id/status)
app.get('/api/participants/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      'SELECT id, split_id, name, status, amount_paid, allocation_amount, payment_ref FROM split_participants WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Participant not found.' });
    }

    const p = rows[0];

    // If still pending, check recent payment attempts / intents to trigger active provider reconciliation
    if (p.status !== 'PAID') {
      try {
        const attRes = await pool.query(
          `SELECT provider_tx_ref, idempotency_key, provider FROM payment_attempts 
           WHERE split_participant_id = $1 ORDER BY requested_at DESC LIMIT 1`,
          [id]
        );

        if (attRes.rows.length > 0) {
          const attempt = attRes.rows[0];
          const orderId = attempt.provider_tx_ref || attempt.idempotency_key;
          
          if (attempt.provider === 'FIMIPAY' && orderId) {
            const fpStatus = await FimiPayProvider.getOrderStatus(orderId);
            if (fpStatus.isPaid) {
              const client = await pool.connect();
              try {
                await client.query('BEGIN');
                await applySuccessfulPayment(client, {
                  orderId,
                  participantId: id,
                  amountPaid: fpStatus.data?.amount || p.allocation_amount,
                  providerTxRef: orderId
                });
                await client.query('COMMIT');
                p.status = 'PAID';
                p.amount_paid = p.allocation_amount;
              } catch (recErr) {
                await client.query('ROLLBACK').catch(() => {});
                console.error('[Participant Status Recon Error]:', recErr);
              } finally {
                client.release();
              }
            } else if (['CANCELLED', 'USERCANCELLED', 'REJECTED', 'FAILED', 'EXPIRED'].includes(fpStatus.paymentStatus)) {
              return res.json({
                id: p.id,
                split_id: p.split_id,
                name: p.name,
                status: 'FAILED',
                payment_status: fpStatus.paymentStatus,
                is_paid: false,
                failure_reason: 'Payment cancelled or rejected by user on phone.',
                amount_paid: p.amount_paid,
                allocation_amount: p.allocation_amount,
                payment_ref: p.payment_ref
              });
            }
          }
        }
      } catch (attErr) {
        console.warn('[Participant Status Check Attempt Notice]:', attErr.message);
      }
    }

    res.json({
      id: p.id,
      split_id: p.split_id,
      name: p.name,
      status: p.status,
      is_paid: p.status === 'PAID',
      amount_paid: p.amount_paid,
      allocation_amount: p.allocation_amount,
      payment_ref: p.payment_ref
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`⚡ LUMO Split PostgreSQL Backend API running on http://localhost:${port}`);
});
