// Payment Reconciliation Background Service
import { PaymentState, mapProviderStatusToPaymentState } from './paymentState.js';
import { SnippePaymentProvider } from './snippePaymentEngine.js';
import { SettlementRouter } from './settlementRouter.js';

export class PaymentReconciliationService {
  static isRunning = false;
  static intervalId = null;

  static start(pool, intervalMs = 45000) {
    if (this.intervalId) return;
    console.log(`⏱️ Starting Payment Reconciliation Service (interval: ${intervalMs}ms)...`);
    this.intervalId = setInterval(() => this.reconcileStuckPayments(pool), intervalMs);
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  static async reconcileStuckPayments(pool) {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Find payments stuck in PROCESSING or AWAITING_CUSTOMER_CONFIRMATION for > 30 seconds
      const query = `
        SELECT pa.*, sp.split_id
        FROM payment_attempts pa
        LEFT JOIN split_participants sp ON pa.split_participant_id = sp.id
        WHERE pa.status IN ('PENDING', 'PROCESSING', 'AWAITING_CUSTOMER_CONFIRMATION')
          AND pa.requested_at < NOW() - INTERVAL '30 seconds'
        ORDER BY pa.requested_at ASC
        LIMIT 20
      `;

      const { rows: stuckPayments } = await pool.query(query);
      if (stuckPayments.length === 0) {
        this.isRunning = false;
        return;
      }

      console.log(`🔎 Reconciling ${stuckPayments.length} stuck payment attempts...`);

      for (const payment of stuckPayments) {
        await this.reconcileSinglePayment(pool, payment);
      }
    } catch (err) {
      console.error('❌ Error in payment reconciliation run:', err.message);
    } finally {
      this.isRunning = false;
    }
  }

  static async reconcileSinglePayment(pool, payment) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const providerTxRef = payment.provider_tx_ref || payment.idempotency_key;

      // Query Provider for authoritative transaction status
      let providerStatusRes;
      try {
        providerStatusRes = await SnippePaymentProvider.checkPaymentStatus(providerTxRef);
      } catch (err) {
        console.warn(`⚠️ Could not reach provider status API for ${providerTxRef}:`, err.message);
        await client.query('ROLLBACK');
        return;
      }

      const rawStatus = providerStatusRes.status || providerStatusRes.paymentStatus || 'PENDING';
      const mappedState = mapProviderStatusToPaymentState(rawStatus);

      if (mappedState === PaymentState.PROVIDER_SUCCESS) {
        console.log(`✅ Reconciliation confirmed SUCCESS for payment attempt ${payment.id}`);

        // Update Participant to PAID
        await client.query(
          `UPDATE split_participants
           SET status = 'PAID', amount_paid = allocation_amount, paid_at = NOW(), payment_ref = $1
           WHERE id = $2`,
          [providerTxRef, payment.split_participant_id]
        );

        // Update PaymentAttempt to SUCCESS
        await client.query(
          `UPDATE payment_attempts
           SET status = 'SUCCESS', payment_status = 'PROVIDER_SUCCESS', completed_at = NOW()
           WHERE id = $1`,
          [payment.id]
        );

        // Update Split total paid and status
        if (payment.split_id) {
          const pSumRes = await client.query(
            'SELECT SUM(amount_paid) as total_paid, SUM(allocation_amount) as total_alloc FROM split_participants WHERE split_id = $1',
            [payment.split_id]
          );

          const totalPaid = parseInt(pSumRes.rows[0].total_paid || '0', 10);
          const totalAlloc = parseInt(pSumRes.rows[0].total_alloc || '0', 10);
          const settlementPercent = totalAlloc > 0 ? Math.min(100, Math.round((totalPaid / totalAlloc) * 100)) : 0;
          const newStatus = settlementPercent >= 100 ? 'SETTLED' : totalPaid > 0 ? 'PARTIALLY_PAID' : 'ACTIVE';

          await client.query(
            'UPDATE splits SET amount_paid = $1, settlement_percent = $2, status = $3 WHERE id = $4',
            [totalPaid, settlementPercent, newStatus, payment.split_id]
          );

          // Trigger Settlement Router for destination payout
          await SettlementRouter.initiateSettlement(client, {
            paymentId: payment.id,
            entityType: 'SPLIT',
            entityId: payment.split_id,
            amount: payment.amount,
            currency: 'TZS',
            destinationSnapshot: null,
            provider: 'SNIPPE'
          });
        }

        await client.query('COMMIT');
      } else if (mappedState === PaymentState.PROVIDER_FAILED) {
        console.log(`❌ Reconciliation confirmed FAILED for payment attempt ${payment.id}`);

        await client.query(
          `UPDATE payment_attempts
           SET status = 'FAILED', payment_status = 'PROVIDER_FAILED', failure_reason = $1, completed_at = NOW()
           WHERE id = $1`,
          [providerStatusRes.failureReason || 'Provider reported payment failure', payment.id]
        );

        await client.query('COMMIT');
      } else {
        // Still pending / processing
        await client.query('ROLLBACK');
      }
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Error reconciling payment attempt ${payment.id}:`, err);
    } finally {
      client.release();
    }
  }
}
