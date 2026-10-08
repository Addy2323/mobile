// LUMO Split - Automated Settlement Router

import { SnippePaymentProvider } from './snippeProvider.js';
import { ProviderCapabilityService } from './paymentRoutingService.js';

export class SettlementRouter {
  /**
   * Process automated settlement after a payment completes
   */
  static async processAutomatedSettlement(client, {
    paymentId,
    participantId,
    splitId,
    amount,
    currency = 'TZS',
    destinationSnapshot
  }) {
    if (!destinationSnapshot || !destinationSnapshot.enabled || destinationSnapshot.isFallback) {
      console.log(`[SettlementRouter] No destination configured for participant ${participantId}. Marking settlement NOT_REQUIRED.`);
      return { status: 'NOT_REQUIRED', note: 'No destination configured' };
    }

    const destType = (destinationSnapshot.type || 'PHONE').toUpperCase();
    const provider = destinationSnapshot.provider || 'SNIPPE';

    // 1. Check Capability
    const isSupported = ProviderCapabilityService.isPayoutSupported(provider, destType);
    if (!isSupported) {
      console.warn(`[SettlementRouter] Destination type ${destType} unsupported for payout via ${provider}.`);
      await client.query(
        `INSERT INTO settlements (split_participant_id, split_id, destination_snapshot, provider, amount, currency, status, failure_code, failure_reason)
         VALUES ($1, $2, $3, $4, $5, $6, 'FAILED', 'UNSUPPORTED_DESTINATION', $7)`,
        [participantId, splitId, destinationSnapshot, provider, amount, currency, `Destination ${destType} unsupported for payout.`]
      );
      return { status: 'FAILED', reason: 'UNSUPPORTED_DESTINATION' };
    }

    // 2. Insert PENDING Settlement Record
    const sRes = await client.query(
      `INSERT INTO settlements (split_participant_id, split_id, destination_snapshot, provider, amount, currency, status, initiated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'PROCESSING', NOW())
       RETURNING id`,
      [participantId, splitId, destinationSnapshot, provider, amount, currency]
    );

    const settlementId = sRes.rows[0].id;
    const idempotencyKey = `payout_${participantId}_${Date.now()}`;

    // 3. Dispatch Snippe Payout
    let payoutRes;
    try {
      if (destType === 'BANK_ACCOUNT') {
        payoutRes = await SnippePaymentProvider.sendPayout({
          splitId,
          amount,
          channel: 'bank',
          bankCode: destinationSnapshot.bankName || 'CRDB',
          recipientBank: destinationSnapshot.bankName || 'CRDB',
          recipientAccount: destinationSnapshot.accountNumber || destinationSnapshot.accountNumberMasked,
          recipientName: destinationSnapshot.beneficiaryName || destinationSnapshot.displayName,
          idempotencyKey
        });
      } else {
        // Mobile money
        payoutRes = await SnippePaymentProvider.sendPayout({
          splitId,
          amount,
          channel: 'mobile',
          mobileProvider: destinationSnapshot.provider || 'airtel',
          recipientPhone: destinationSnapshot.phoneNumber,
          recipientName: destinationSnapshot.beneficiaryName || destinationSnapshot.displayName,
          idempotencyKey
        });
      }

      // Record Settlement Attempt
      await client.query(
        `INSERT INTO settlement_attempts (settlement_id, provider, idempotency_key, provider_reference, status, payload)
         VALUES ($1, 'SNIPPE', $2, $3, $4, $5)`,
        [settlementId, idempotencyKey, payoutRes.payoutId, payoutRes.status === 'SETTLED' ? 'SUCCESS' : payoutRes.status, payoutRes]
      );

      // Update Settlement State
      const newStatus = payoutRes.status === 'SETTLED' ? 'SETTLED' : payoutRes.status === 'FAILED' ? 'FAILED' : 'PROCESSING';
      await client.query(
        `UPDATE settlements
         SET status = $1, provider_reference = $2, failure_code = $3, failure_reason = $4, completed_at = $5, updated_at = NOW()
         WHERE id = $6`,
        [
          newStatus,
          payoutRes.payoutId,
          payoutRes.failureCode || null,
          payoutRes.failureReason || payoutRes.message || null,
          newStatus === 'SETTLED' ? new Date().toISOString() : null,
          settlementId
        ]
      );

      return {
        status: newStatus,
        payoutId: payoutRes.payoutId,
        message: payoutRes.message
      };
    } catch (err) {
      console.error('[SettlementRouter] Error dispatching payout:', err);
      await client.query(
        `UPDATE settlements SET status = 'FAILED', failure_reason = $1, updated_at = NOW() WHERE id = $2`,
        [err.message, settlementId]
      );
      return { status: 'FAILED', reason: err.message };
    }
  }
}
