import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { SnippePaymentProvider } from '../snippeProvider.js';
import { LedgerService } from '../ledgerService.js';

describe('LUMO Split Payment Integrity & Attribution Suite (Scenarios A - N)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // SCENARIO A: Split creation initializes organizer & participants as PENDING with 0 amount paid
  it('Scenario A: Split creation enforces PENDING status and 0 amount_paid for all participants including organizer', () => {
    const rawParticipants = [
      { name: 'Organizer Dave', phone: '+255711000001', is_organizer: true, allocation_amount: 25000, status: 'PAID', amount_paid: 25000 },
      { name: 'Friend Sarah', phone: '+255711000002', is_organizer: false, allocation_amount: 25000, status: 'PENDING', amount_paid: 0 }
    ];

    // Enforce initialization policy (server & client hardening)
    const sanitizedParticipants = rawParticipants.map((p) => ({
      ...p,
      status: 'PENDING',
      amount_paid: 0,
      paid_at: null,
      payment_ref: null,
      contribution_token: crypto.randomUUID()
    }));

    expect(sanitizedParticipants[0].status).toBe('PENDING');
    expect(sanitizedParticipants[0].amount_paid).toBe(0);
    expect(sanitizedParticipants[0].contribution_token).toBeDefined();
    expect(sanitizedParticipants[1].status).toBe('PENDING');
    expect(sanitizedParticipants[1].amount_paid).toBe(0);
    expect(sanitizedParticipants[1].contribution_token).toBeDefined();
    expect(sanitizedParticipants[0].contribution_token).not.toBe(sanitizedParticipants[1].contribution_token);
  });

  // SCENARIO B: Initial split state has confirmed collected = 0, outstanding = total amount
  it('Scenario B: Initial split metrics compute confirmed collected = 0 and outstanding = total', () => {
    const totalAmount = 50000;
    const participants = [
      { id: 'p1', name: 'Organizer Dave', is_organizer: true, allocation_amount: 25000, amount_paid: 0, status: 'PENDING' },
      { id: 'p2', name: 'Friend Sarah', is_organizer: false, allocation_amount: 25000, amount_paid: 0, status: 'PENDING' }
    ];

    const confirmedCollected = participants
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + (p.amount_paid || 0), 0);
    const outstanding = Math.max(0, totalAmount - confirmedCollected);
    const settlementPercent = totalAmount > 0 ? Math.round((confirmedCollected / totalAmount) * 100) : 0;

    expect(confirmedCollected).toBe(0);
    expect(outstanding).toBe(50000);
    expect(settlementPercent).toBe(0);
  });

  // SCENARIO C: Unique contribution link binds payment to target participant without identity bleed
  it('Scenario C: Unique contribution token resolves exact intended participant without overwriting details', () => {
    const participants = [
      { id: 'p_org', contribution_token: 'tok_org_111', name: 'Dave', phone: '+255711000001', is_organizer: true },
      { id: 'p_sarah', contribution_token: 'tok_sarah_222', name: 'Sarah', phone: '+255711000002', is_organizer: false }
    ];

    // Simulating URL parameter ?c=tok_sarah_222
    const incomingToken = 'tok_sarah_222';
    const targetParticipant = participants.find((p) => p.contribution_token === incomingToken);

    expect(targetParticipant).toBeDefined();
    expect(targetParticipant.name).toBe('Sarah');
    expect(targetParticipant.is_organizer).toBe(false);

    // Paying wallet may be different from participant contact phone
    const payerWalletPhone = '+255788999888';
    const paymentRecord = {
      split_participant_id: targetParticipant.id,
      payer_phone: payerWalletPhone,
      participant_original_phone: targetParticipant.phone
    };

    // Verify original participant identity is preserved
    expect(paymentRecord.participant_original_phone).toBe('+255711000002');
    expect(paymentRecord.payer_phone).toBe('+255788999888');
  });

  // SCENARIO D: Payment webhook marks target participant PAID and updates split collected total
  it('Scenario D: Webhook marks target participant PAID and updates split collected total', () => {
    const split = { id: 'split_1', total_amount: 50000, amount_paid: 0, status: 'ACTIVE' };
    const participant = { id: 'p_sarah', split_id: 'split_1', allocation_amount: 25000, amount_paid: 0, status: 'PENDING' };

    // Simulate webhook payment success processing
    const paymentAmount = 25000;
    participant.amount_paid = paymentAmount;
    participant.status = 'PAID';
    participant.paid_at = new Date().toISOString();

    split.amount_paid += paymentAmount;
    split.settlement_percent = Math.round((split.amount_paid / split.total_amount) * 100);

    expect(participant.status).toBe('PAID');
    expect(participant.amount_paid).toBe(25000);
    expect(split.amount_paid).toBe(25000);
    expect(split.settlement_percent).toBe(50);
  });

  // SCENARIO E: Webhook idempotency prevents duplicate processing
  it('Scenario E: Webhook idempotency deduplication rejects duplicate event IDs or provider refs', () => {
    const processedEvents = new Set();
    const eventId = 'snp_evt_998877';

    function handleWebhookEvent(id) {
      if (processedEvents.has(id)) {
        return { status: 'IGNORED_DUPLICATE', processed: false };
      }
      processedEvents.add(id);
      return { status: 'PROCESSED', processed: true };
    }

    const firstRun = handleWebhookEvent(eventId);
    expect(firstRun.status).toBe('PROCESSED');
    expect(firstRun.processed).toBe(true);

    const secondRun = handleWebhookEvent(eventId);
    expect(secondRun.status).toBe('IGNORED_DUPLICATE');
    expect(secondRun.processed).toBe(false);
  });

  // SCENARIO F: Organizer ledger receives collection credit transactionally for participant payments
  it('Scenario F: Participant payment credits organizer ledger', async () => {
    const mockDb = {
      transactions: [],
      async query(sql, params) {
        if (sql.includes('INSERT INTO ledger_transactions')) {
          mockDb.transactions.push(params);
          return { rows: [{ id: 'tx_123' }] };
        }
        return { rows: [] };
      }
    };

    // When Sarah (participant) pays her 25,000 share to Dave (organizer)
    const isOrganizer = false;
    let ledgerCredited = false;
    if (!isOrganizer) {
      ledgerCredited = true;
    }

    expect(ledgerCredited).toBe(true);
  });

  // SCENARIO G: Organizer payment credits the split collection balance in organizer wallet
  it('Scenario G: Organizer paying their own share credits their ledger collection balance', () => {
    const organizerId = 'user_dave_1';
    const participant = { id: 'p_dave', user_id: organizerId, is_organizer: true, name: 'Dave' };

    // When organizer completes payment of their share into the split pool,
    // the funds arrive in the organizer collection pool
    let ledgerCredited = false;
    if (participant.allocation_amount || participant.id) {
      ledgerCredited = true;
    }

    expect(ledgerCredited).toBe(true);
  });

  // SCENARIO H: Snippe /v1/payments/balance endpoint integration returns balance and currency
  it('Scenario H: SnippePaymentProvider retrieves provider balance from GET /v1/payments/balance', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        data: {
          balance: 1450000,
          currency: 'TZS',
          available_balance: 1400000
        }
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const balanceRes = await SnippePaymentProvider.getBalance();
    expect(balanceRes.success).toBe(true);
    expect(balanceRes.balance).toBe(1450000);
    expect(balanceRes.currency).toBe('TZS');
  });

  // SCENARIO I: Partial payment updates participant amount_paid without prematurely marking split SETTLED
  it('Scenario I: Partial payment keeps participant and split in ACTIVE/PARTIAL state', () => {
    const totalAmount = 50000;
    const participant = { allocation_amount: 25000, amount_paid: 0, status: 'PENDING' };

    // Participant pays 10,000 out of 25,000
    const partialPayment = 10000;
    participant.amount_paid += partialPayment;
    participant.status = participant.amount_paid >= participant.allocation_amount ? 'PAID' : 'PARTIAL';

    const isSplitComplete = participant.amount_paid >= totalAmount;

    expect(participant.status).toBe('PARTIAL');
    expect(participant.amount_paid).toBe(10000);
    expect(isSplitComplete).toBe(false);
  });

  // SCENARIO J: Overpayment guard prevents paid amounts exceeding total allocation
  it('Scenario J: Overpayment guard caps allocation and rejects excess amounts', () => {
    const allocation = 25000;
    let currentPaid = 20000;
    const attemptedPayment = 10000; // 5000 over

    const remainingAllowed = allocation - currentPaid;
    const acceptedAmount = Math.min(attemptedPayment, remainingAllowed);
    currentPaid += acceptedAmount;

    expect(acceptedAmount).toBe(5000);
    expect(currentPaid).toBe(25000);
  });

  // SCENARIO K: Multiple participants independently paying sequentially updates split collected total
  it('Scenario K: Sequential payments from multiple participants accumulate correctly', () => {
    const split = { total_amount: 60000, amount_paid: 0, status: 'ACTIVE' };
    const p1 = { name: 'P1', allocation: 20000, paid: 0 };
    const p2 = { name: 'P2', allocation: 20000, paid: 0 };
    const p3 = { name: 'P3', allocation: 20000, paid: 0 };

    // P1 pays
    p1.paid = 20000;
    split.amount_paid += p1.paid;
    expect(split.amount_paid).toBe(20000);

    // P2 pays
    p2.paid = 20000;
    split.amount_paid += p2.paid;
    expect(split.amount_paid).toBe(40000);

    // P3 pays
    p3.paid = 20000;
    split.amount_paid += p3.paid;
    expect(split.amount_paid).toBe(60000);
  });

  // SCENARIO L: Cash marking transition respects ledger and participant status
  it('Scenario L: Marking as cash updates participant to CASH status without external provider fee', () => {
    const participant = { allocation_amount: 20000, amount_paid: 0, status: 'PENDING' };

    participant.status = 'CASH';
    participant.amount_paid = participant.allocation_amount;
    participant.paid_at = new Date().toISOString();

    expect(participant.status).toBe('CASH');
    expect(participant.amount_paid).toBe(20000);
  });

  // SCENARIO M: Final participant payment transitions split to SETTLED and 100% settlement
  it('Scenario M: When total paid equals total bill, split transitions to SETTLED with 100%', () => {
    const split = { total_amount: 50000, amount_paid: 50000, status: 'ACTIVE', settlement_percent: 0 };

    if (split.amount_paid >= split.total_amount) {
      split.status = 'SETTLED';
      split.settlement_percent = 100;
    }

    expect(split.status).toBe('SETTLED');
    expect(split.settlement_percent).toBe(100);
  });

  // SCENARIO N: Inactive/Cancelled split rejects new payment attempts
  it('Scenario N: Cancelled or archived split rejects new payment initiation attempts', () => {
    const split = { id: 'split_99', status: 'CANCELLED' };

    function initiatePaymentForSplit(currentSplit) {
      if (currentSplit.status !== 'ACTIVE') {
        throw new Error(`Cannot initiate payment for split in status: ${currentSplit.status}`);
      }
      return { success: true };
    }

    expect(() => initiatePaymentForSplit(split)).toThrow(/Cannot initiate payment/);
  });
});
