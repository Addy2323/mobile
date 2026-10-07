import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import { SnippePaymentProvider } from './snippeProvider.js';
import { FimiPayProvider } from './fimipayProvider.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:myamba2323@localhost:5432/lumosprit_bd?schema=public';

const pool = new pg.Pool({
  connectionString: dbUrl,
});

app.use(cors());
// Raw body parser for Snippe & FimiPay HMAC webhook verification
app.use('/api/payments/webhooks/snippe', express.raw({ type: 'application/json' }));
app.use('/api/payments/webhooks/fimipay', express.raw({ type: 'application/json' }));
app.use('/webhooks/fimipay', express.raw({ type: 'application/json' }));
app.use(express.json());

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
  try {
    const query = `
      SELECT s.*,
             row_to_json(m.*) AS merchant
      FROM splits s
      LEFT JOIN merchants m ON s.merchant_id = m.id
      ORDER BY s.created_at DESC
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
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

    res.json({ ...split, participants, items });
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

    res.json({ ...split, participants, items });
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
      participants = [],
      items = []
    } = req.body;

    const generatedRef = ref_code || generateRefCode();

    const insertSplitQuery = `
      INSERT INTO splits (title, category, currency, total_amount, mode, organizer_name, organizer_phone, merchant_id, status, due_at, note, settlement_percent, amount_paid, participant_count, ref_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
      generatedRef
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

app.patch('/api/participants/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fields = req.body;
    const setClause = [];
    const values = [req.params.id];

    let idx = 2;
    for (const [key, val] of Object.entries(fields)) {
      setClause.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }

    if (setClause.length === 0) {
      client.release();
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updateQuery = `UPDATE split_participants SET ${setClause.join(', ')} WHERE id = $1 RETURNING *`;
    const { rows } = await client.query(updateQuery, values);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
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
    res.status(500).json({ error: err.message });
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
      client.release();
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
      client.release();
      return res.status(404).json({ error: 'Participant record not found.' });
    }

    const participant = pRes.rows[0];

    if (participant.status === 'PAID') {
      client.release();
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

    client.release();
    res.status(201).json({
      success: true,
      message: 'Payment prompt dispatched successfully.',
      paymentAttempt: paRes.rows[0],
      providerTxRef: snippeRes.providerTxRef
    });
  } catch (err) {
    client.release();
    console.error('Error initiating Snippe payment:', err);
    res.status(500).json({ error: err.message });
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
    // Attempt lookup via payment_attempts or order_id pattern
    const paCheck = await client.query('SELECT split_participant_id FROM payment_attempts WHERE idempotency_key = $1 OR provider_tx_ref = $1 LIMIT 1', [orderId]);
    if (paCheck.rows.length > 0) {
      pId = paCheck.rows[0].split_participant_id;
    }
  }

  if (!pId) {
    console.warn(`[FimiPay] Unable to resolve participant for orderId: ${orderId}`);
    return null;
  }

  const pRes = await client.query('SELECT * FROM split_participants WHERE id = $1 FOR UPDATE', [pId]);
  if (pRes.rows.length === 0) return null;

  const participant = pRes.rows[0];
  const splitId = participant.split_id;
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

  return { splitId, participantId: pId, settlementPercent, status: newStatus };
}

// 1. Create Payment Order (POST /payment/create_order)
app.post(['/api/payments/fimipay/create-order', '/api/payments/fimipay/create_order'], async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      split_participant_id,
      buyer_phone,
      phone,
      amount,
      order_id,
      currency = 'TZS',
      buyer_name,
      buyer_email,
      payment_method = 'mobile',
      redirect_url,
      test_outcome
    } = req.body;

    const targetPhone = buyer_phone || phone;
    let targetAmount = amount;
    let participantId = split_participant_id || null;

    if (participantId) {
      const pRes = await client.query(
        `SELECT p.*, s.title AS split_title, s.id AS split_id
         FROM split_participants p
         JOIN splits s ON p.split_id = s.id
         WHERE p.id = $1`,
        [participantId]
      );

      if (pRes.rows.length > 0) {
        targetAmount = parseInt(pRes.rows[0].allocation_amount, 10);
      }
    }

    if (!targetPhone || !targetAmount) {
      client.release();
      return res.status(400).json({ error: 'buyer_phone (or phone) and amount are required.' });
    }

    const orderId = (order_id || `fp_${participantId || 'ord'}_${Date.now()}`).slice(0, 64);

    const fpResult = await FimiPayProvider.createOrder({
      buyer_phone: targetPhone,
      amount: targetAmount,
      order_id: orderId,
      currency,
      buyer_name,
      buyer_email,
      payment_method,
      redirect_url,
      test_outcome
    });

    // Save intent and attempt in DB if tied to a participant
    if (participantId) {
      const pCheck = await client.query('SELECT split_id FROM split_participants WHERE id = $1', [participantId]);
      if (pCheck.rows.length > 0) {
        const splitId = pCheck.rows[0].split_id;
        await client.query(
          `INSERT INTO payment_intents (split_participant_id, split_id, expected_amount, currency, status, idempotency_key, metadata)
           VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [participantId, splitId, targetAmount, currency, orderId, { buyer_phone: targetPhone, payment_method }]
        );

        await client.query(
          `INSERT INTO payment_attempts (split_participant_id, amount, provider, provider_tx_ref, status, payment_method, idempotency_key, requested_at)
           VALUES ($1, $2, 'FIMIPAY', $3, 'PENDING', $4, $5, NOW())
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [participantId, targetAmount, fpResult.orderId, payment_method, orderId]
        );
      }
    }

    client.release();
    res.status(200).json({
      success: true,
      order_id: fpResult.orderId,
      payment_status: fpResult.paymentStatus,
      payment_gateway_url: fpResult.paymentGatewayUrl,
      data: fpResult.data
    });
  } catch (err) {
    client.release();
    console.error('Error creating FimiPay order:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Poll Order Status (POST /payment/order_status)
app.post(['/api/payments/fimipay/order-status', '/api/payments/fimipay/order_status'], async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id is required' });

    const fpResult = await FimiPayProvider.getOrderStatus(order_id);

    if (fpResult.isPaid) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await applySuccessfulPayment(client, { orderId: order_id, amountPaid: fpResult.data?.amount, providerTxRef: order_id });
        await client.query('COMMIT');
      } catch (dbErr) {
        await client.query('ROLLBACK');
        console.error('Error updating DB on FimiPay order success:', dbErr);
      } finally {
        client.release();
      }
    }

    res.json(fpResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. List Recent Transactions (POST /transactions/readbyId)
app.post(['/api/payments/fimipay/transactions', '/api/payments/fimipay/transactions/readbyId'], async (req, res) => {
  try {
    const fpResult = await FimiPayProvider.getTransactions();
    res.json(fpResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Merchant Balance (GET /balance)
app.get(['/api/payments/fimipay/balance', '/api/payments/fimipay/balances'], async (req, res) => {
  try {
    const currency = req.query.currency || 'TZS';
    const fpResult = await FimiPayProvider.getBalance(currency);
    res.json(fpResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Request Payout / Withdrawal (POST /payouts/create)
app.post(['/api/payments/fimipay/payouts', '/api/payments/fimipay/payouts/create'], async (req, res) => {
  try {
    const { amount, method, account_number, account_name, currency = 'TZS', fee_handling = 'deduct' } = req.body;
    if (!amount || !method || !account_number) {
      return res.status(400).json({ error: 'amount, method, and account_number are required.' });
    }

    const fpResult = await FimiPayProvider.createPayout({
      amount,
      method,
      account_number,
      account_name,
      currency,
      fee_handling
    });

    res.json(fpResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Poll Payout Status (GET /payouts/status/:withdrawalId)
app.get('/api/payments/fimipay/payouts/status/:withdrawalId', async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const fpResult = await FimiPayProvider.getPayoutStatus(withdrawalId);
    res.json(fpResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mandatory Webhook Handler (POST /, /api/payments/webhooks/fimipay, /webhooks/fimipay)
app.post(['/', '/api/payments/webhooks/fimipay', '/webhooks/fimipay'], async (req, res) => {
  const rawBuffer = req.body;
  const sigHeader =
    req.headers['x-fimipay-signature'] ||
    req.headers['x-signature'] ||
    req.headers['x-webhook-signature'];

  const isValid = FimiPayProvider.verifyWebhookSignature(rawBuffer, sigHeader);
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

  const eventId = eventPayload.event_id || eventPayload.id || `evt_fp_${Date.now()}`;
  const eventType = eventPayload.event_type || eventPayload.event || eventPayload.type || 'payment.success';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Idempotency Check
    const existingEvt = await client.query('SELECT 1 FROM webhook_events WHERE event_id = $1', [eventId]);
    if (existingEvt.rows.length > 0) {
      await client.query('COMMIT');
      client.release();
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

    if (paymentStatus === 'SUCCESS' || eventType === 'payment.success') {
      await applySuccessfulPayment(client, {
        orderId,
        participantId,
        amountPaid,
        providerTxRef: orderId || `FMP-TX-${Date.now()}`
      });
    }

    await client.query('COMMIT');
    client.release();
    res.status(200).json({ received: true });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Error processing FimiPay webhook:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`⚡ LUMO Split PostgreSQL Backend API running on http://localhost:${port}`);
});
