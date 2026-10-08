// SettlementRouter Service — Direct Destination Settlement & Automated Payout Routing
import { SettlementState } from './paymentState.js';
import { ProviderCapabilityService } from './providerCapabilities.js';
import { SnippePaymentProvider } from './snippePaymentEngine.js';

export class SettlementRouter {
  /**
   * Create an immutable settlement target snapshot for a split/payment link/birthday pool
   */
  static async createTargetSnapshot(client, { entityType, entityId, ownerUserId, destination, destinationRecord }) {
    const dest = destinationRecord || destination || {};
    const destType = (dest.type || dest.destination_type || 'PHONE').toUpperCase();
    const provider = (dest.provider || 'MOBILE_MONEY').toUpperCase();

    const displayName = dest.display_name || dest.beneficiary_full_name || `${dest.bank_name || destType} Destination`;
    const maskedDest = dest.phone_number 
      ? `****${String(dest.phone_number).slice(-4)}`
      : dest.account_number 
        ? `****${String(dest.account_number).slice(-4)}`
        : dest.lipa_number || 'Default Collection';

    const snapshotQuery = `
      INSERT INTO payment_settlement_target_snapshots (entity_type, entity_id, owner_user_id, destination_type, provider, display_name, masked_destination, destination_reference, beneficiary_full_name, snapshot_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const snapshotRef = dest.id || dest.phone_number || dest.account_number || `snap_${Date.now()}`;
    const { rows } = await client.query(snapshotQuery, [
      entityType,
      entityId,
      ownerUserId || null,
      destType,
      provider,
      displayName,
      maskedDest,
      snapshotRef,
      dest.beneficiary_full_name || null,
      dest
    ]);

    return rows[0];
  }

  /**
   * Initiate automated settlement to recipient destination upon payment PROVIDER_SUCCESS
   */
  static async initiateSettlement(client, { paymentId, entityType, entityId, amount, currency = 'TZS', destinationSnapshot, provider = 'SNIPPE' }) {
    const idempotencyKey = `settle_${paymentId}`;

    // 1. Check if settlement record already exists (Idempotency)
    const existing = await client.query('SELECT * FROM settlement_records WHERE idempotency_key = $1 FOR UPDATE', [idempotencyKey]);
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // 2. Validate provider capabilities for payout/direct settlement
    const destType = destinationSnapshot ? destinationSnapshot.destination_type : 'PHONE';
    const capability = await ProviderCapabilityService.validateDestinationSupport(
      { type: destType },
      'PAYOUT',
      provider,
      client
    );

    if (!capability.supported) {
      console.warn(`⚠️ Direct settlement capability unsupported for ${destType}. Marking SETTLEMENT_FAILED.`);
      const { rows: failedRec } = await client.query(
        `INSERT INTO settlement_records (payment_id, entity_type, entity_id, snapshot_id, provider, idempotency_key, amount, currency, settlement_status, failure_code, failure_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SETTLEMENT_FAILED', 'CAPABILITY_UNSUPPORTED', $9)
         RETURNING *`,
        [paymentId, entityType, entityId, destinationSnapshot?.id || null, provider, idempotencyKey, amount, currency, capability.error]
      );
      return failedRec[0];
    }

    // 3. Create Settlement Record (SETTLEMENT_PROCESSING)
    const { rows: setRecs } = await client.query(
      `INSERT INTO settlement_records (payment_id, entity_type, entity_id, snapshot_id, provider, idempotency_key, amount, currency, settlement_status, attempt_count, initiated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SETTLEMENT_PROCESSING', 1, NOW())
       RETURNING *`,
      [paymentId, entityType, entityId, destinationSnapshot?.id || null, provider, idempotencyKey, amount, currency]
    );

    const settlementRecord = setRecs[0];

    // 4. Dispatch Payout/Settlement to Provider API
    try {
      const recipientPhone = destinationSnapshot?.snapshot_json?.phone_number || '255754123456';
      const recipientName = destinationSnapshot?.display_name || 'Destination Recipient';

      const payoutRes = await SnippePaymentProvider.sendPayout({
        splitId: entityId,
        amount: parseFloat(amount),
        channel: destType === 'BANK_ACCOUNT' ? 'bank' : 'mobile',
        recipientPhone,
        recipientName
      });

      // Record Settlement Attempt Log
      await client.query(
        `INSERT INTO settlement_attempts (settlement_id, provider, request_reference, provider_reference, status, response_code, response_payload)
         VALUES ($1, $2, $3, $4, 'SUCCESS', '200', $5)`,
        [settlementRecord.id, provider, idempotencyKey, payoutRes.payoutId, payoutRes]
      );

      // Update Settlement Record to SETTLED
      const { rows: finalRecs } = await client.query(
        `UPDATE settlement_records
         SET settlement_status = 'SETTLED', provider_reference = $1, completed_at = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [payoutRes.payoutId, settlementRecord.id]
      );

      return finalRecs[0];
    } catch (err) {
      console.error('❌ Settlement dispatch error:', err.message);

      // Record Failed Settlement Attempt
      await client.query(
        `INSERT INTO settlement_attempts (settlement_id, provider, request_reference, status, response_code, failure_reason)
         VALUES ($1, $2, $3, 'FAILED', '500', $4)`,
        [settlementRecord.id, provider, idempotencyKey, err.message]
      );

      const { rows: failedRecs } = await client.query(
        `UPDATE settlement_records
         SET settlement_status = 'SETTLEMENT_FAILED', failure_code = 'DISPATCH_ERROR', failure_reason = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [err.message, settlementRecord.id]
      );

      return failedRecs[0];
    }
  }
}
