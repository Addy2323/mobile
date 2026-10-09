import { SnippePaymentProvider } from './snippeProvider.js';

export class SnippeReconciliationJob {
  /**
   * Run payment status reconciliation for pending Snippe payments
   */
  static async reconcilePendingPayments(pool) {
    let checkedCount = 0;
    let reconciledCount = 0;

    try {
      // Fetch Snippe payment attempts in PENDING/PROCESSING/CREATED state created in the last 24 hours
      const { rows: pendingAttempts } = await pool.query(
        `SELECT * FROM payment_attempts
         WHERE provider = 'SNIPPE'
           AND status IN ('PENDING', 'PROCESSING', 'CREATED')
           AND created_at >= NOW() - INTERVAL '24 hours'
           AND (last_reconciled_at IS NULL OR last_reconciled_at < NOW() - INTERVAL '30 seconds')
         ORDER BY created_at ASC
         LIMIT 25`
      );

      checkedCount = pendingAttempts.length;
      if (checkedCount === 0) {
        return { checked: 0, reconciled: 0 };
      }

      for (const attempt of pendingAttempts) {
        const reference = attempt.provider_tx_ref || attempt.merchant_reference;
        if (!reference) continue;

        // Mark attempt as currently being reconciled
        await pool.query(
          'UPDATE payment_attempts SET last_reconciled_at = NOW() WHERE id = $1',
          [attempt.id]
        );

        const statusRes = await SnippePaymentProvider.getPaymentStatus(reference);
        if (!statusRes.success) continue;

        if (statusRes.isPaid) {
          // Atomic payment confirmation transition
          const client = await pool.connect();
          try {
            await client.query('BEGIN');

            await client.query(
              `UPDATE payment_attempts
               SET status = 'COMPLETED',
                   provider_tx_ref = COALESCE($1, provider_tx_ref),
                   updated_at = NOW()
               WHERE id = $2`,
              [reference, attempt.id]
            );

            if (attempt.split_participant_id || attempt.metadata?.participant_id) {
              const partId = attempt.split_participant_id || attempt.metadata.participant_id;
              const pRes = await client.query('SELECT * FROM split_participants WHERE id = $1 FOR UPDATE', [partId]);
              if (pRes.rows.length > 0) {
                const participant = pRes.rows[0];
                const allocAmount = Number(participant.allocation_amount || 0);

                await client.query(
                  `UPDATE split_participants
                   SET status = 'PAID',
                       amount_paid = $1,
                       paid_at = NOW(),
                       payment_ref = $2
                   WHERE id = $3`,
                  [allocAmount, reference, partId]
                );

                // Recalculate split summary
                const splitRes = await client.query(
                  `SELECT COALESCE(SUM(amount_paid), 0) AS total_paid
                   FROM split_participants
                   WHERE split_id = $1`,
                  [participant.split_id]
                );
                const totalPaid = Number(splitRes.rows[0]?.total_paid || 0);

                await client.query(
                  `UPDATE splits
                   SET amount_paid = $1
                   WHERE id = $2`,
                  [totalPaid, participant.split_id]
                );
              }
            }

            await client.query('COMMIT');
            reconciledCount++;
            console.log(`[SnippeReconciliationJob] Reconciled payment ${attempt.id} (${reference}) -> COMPLETED`);
          } catch (txErr) {
            await client.query('ROLLBACK');
            console.error(`[SnippeReconciliationJob] Transaction failed for ${attempt.id}:`, txErr.message);
          } finally {
            client.release();
          }
        } else if (statusRes.isFailed) {
          await pool.query(
            `UPDATE payment_attempts
             SET status = 'FAILED',
                 metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{failure_reason}', $1::jsonb),
                 updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(statusRes.rawStatus || 'FAILED'), attempt.id]
          );
          reconciledCount++;
          console.log(`[SnippeReconciliationJob] Reconciled payment ${attempt.id} (${reference}) -> FAILED`);
        }
      }
    } catch (err) {
      console.error('[SnippeReconciliationJob] Reconciliation cycle error:', err.message);
    }

    return { checked: checkedCount, reconciled: reconciledCount };
  }
}
