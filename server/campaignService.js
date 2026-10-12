import crypto from 'crypto';
import { LedgerService } from './ledgerService.js';
import { PaymentRoutingService } from './paymentRoutingService.js';

export const CampaignService = {
  /**
   * Resolve any Michango event, Charity campaign, Savings goal, or Birthday pool.
   */
  async resolveCampaign(db, type, identifier) {
    if (!identifier) throw new Error('Campaign identifier is required');
    const rawId = String(identifier).trim();
    const cleanId = rawId.replace(/^(MCHANG|CHARITY|SAVE|BDAY)-/i, '');

    // 1. Birthday pool lookup
    if (type === 'BIRTHDAY_POOL' || /^BDAY-/i.test(rawId)) {
      const bRes = await db.query(
        `SELECT * FROM birthday_pools 
         WHERE UPPER(id::text) = UPPER($1) 
            OR UPPER(SUBSTRING(id::text, 1, 6)) = UPPER($2)
            OR UPPER(SUBSTRING(id::text, 1, 8)) = UPPER($2)
            OR UPPER(id::text) LIKE UPPER($3)
         LIMIT 1`,
        [rawId, cleanId, `%${cleanId}%`]
      );
      if (bRes.rows.length > 0) {
        const row = bRes.rows[0];
        const token = `BDAY-${row.id.slice(0, 6).toUpperCase()}`;
        return {
          id: row.id,
          type: 'BIRTHDAY_POOL',
          categoryType: 'BIRTHDAY',
          token,
          title: `${row.birthday_person}'s Birthday Split`,
          description: row.message || 'Group Birthday Gift Fund',
          targetAmount: row.target_amount ? Number(row.target_amount) : 0,
          collectedAmount: Number(row.collected_amount || 0),
          retainedSavings: 0,
          totalWithdrawn: 0,
          currency: row.currency || 'TZS',
          status: row.status || 'ACTIVE',
          ownerUserId: row.owner_user_id || null,
          organizerName: `${row.birthday_person}'s Friends`,
          beneficiaryName: row.birthday_person,
          beneficiaryOrganization: null,
          startDate: row.created_at,
          endDate: row.closing_date || row.event_date || null,
          isPublic: true,
          destinationSnapshot: row.destination_snapshot || PaymentRoutingService.createSnapshot(null),
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      }
    }

    // 2. Michango events (General, Charity, Savings) lookup
    const mRes = await db.query(
      `SELECT * FROM michango_events 
       WHERE UPPER(id::text) = UPPER($1) 
          OR UPPER(SUBSTRING(id::text, 1, 6)) = UPPER($2)
          OR UPPER(SUBSTRING(id::text, 1, 8)) = UPPER($2)
          OR UPPER(id::text) LIKE UPPER($3)
       LIMIT 1`,
      [rawId, cleanId, `%${cleanId}%`]
    );

    if (mRes.rows.length > 0) {
      const row = mRes.rows[0];
      const categoryType = (row.category_type || (row.event_type === 'CHARITY' ? 'CHARITY' : row.event_type === 'SAVINGS' ? 'SAVINGS' : 'GENERAL')).toUpperCase();
      const prefix = categoryType === 'CHARITY' ? 'CHARITY' : categoryType === 'SAVINGS' ? 'SAVE' : 'MCHANG';
      const token = `${prefix}-${row.id.slice(0, 6).toUpperCase()}`;

      const collectedAmount = Number(row.collected_amount || 0);
      const totalWithdrawn = Number(row.total_withdrawn || 0);
      const retainedSavings = row.retained_savings !== null && row.retained_savings !== undefined
        ? Number(row.retained_savings)
        : Math.max(0, collectedAmount - totalWithdrawn);

      return {
        id: row.id,
        type: categoryType === 'CHARITY' ? 'CHARITY' : categoryType === 'SAVINGS' ? 'SAVINGS' : 'MCHANGO',
        categoryType,
        token,
        title: row.title,
        description: row.description || '',
        targetAmount: row.target_amount ? Number(row.target_amount) : 0,
        collectedAmount,
        retainedSavings,
        totalWithdrawn,
        currency: row.currency || 'TZS',
        status: row.status || 'ACTIVE',
        ownerUserId: row.owner_user_id || null,
        organizerName: 'Community Organizer',
        beneficiaryName: row.beneficiary_name || null,
        beneficiaryPhone: row.beneficiary_phone || null,
        beneficiaryOrganization: row.beneficiary_organization || null,
        startDate: row.start_date || row.created_at,
        endDate: row.end_date || null,
        isPublic: row.is_public !== false,
        destinationSnapshot: row.destination_snapshot || PaymentRoutingService.createSnapshot(null),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }

    return null;
  },

  /**
   * Helper to normalize phones for stable deduplication
   */
  normalizeIdentity(phone, name, userId) {
    if (userId) return `USER:${userId}`;
    if (phone) {
      const cleaned = phone.replace(/[^\d+]/g, '');
      if (cleaned.length >= 9) return cleaned;
    }
    return `NAME:${(name || 'Anonymous').trim().toLowerCase()}`;
  },

  /**
   * Build date range SQL clauses
   */
  buildDateRange(timeframe, fromDate, toDate, paramStartIdx = 1) {
    const params = [];
    let condition = '';
    let label = 'All-Time';
    let idx = paramStartIdx;

    const tf = (timeframe || 'all').toLowerCase();
    if (tf === 'today') {
      condition = `created_at >= CURRENT_DATE`;
      label = 'Today';
    } else if (tf === '7d' || tf === 'week') {
      condition = `created_at >= NOW() - INTERVAL '7 days'`;
      label = 'Last 7 Days';
    } else if (tf === '30d' || tf === 'month' || tf === 'this_month') {
      condition = `created_at >= DATE_TRUNC('month', NOW())`;
      label = 'This Month';
    } else if (tf === 'last_30d') {
      condition = `created_at >= NOW() - INTERVAL '30 days'`;
      label = 'Last 30 Days';
    } else if (tf === 'this_year' || tf === 'year') {
      condition = `created_at >= DATE_TRUNC('year', NOW())`;
      label = 'This Year';
    } else if (tf === 'custom' && fromDate) {
      if (fromDate && toDate) {
        condition = `created_at >= $${idx} AND created_at <= $${idx + 1}`;
        params.push(new Date(fromDate).toISOString(), new Date(toDate).toISOString());
        idx += 2;
        label = `${new Date(fromDate).toLocaleDateString()} - ${new Date(toDate).toLocaleDateString()}`;
      } else {
        condition = `created_at >= $${idx}`;
        params.push(new Date(fromDate).toISOString());
        idx += 1;
        label = `Since ${new Date(fromDate).toLocaleDateString()}`;
      }
    }

    return { condition, params, label, nextIdx: idx };
  },

  /**
   * Get Aggregated Campaign Report with Contributor Deduplication.
   * If Jameson contributed 12 times, he appears ONCE with 12 transactions and total sum.
   */
  async getAggregatedCampaignReport(db, type, identifier, options = {}) {
    const campaign = await this.resolveCampaign(db, type, identifier);
    if (!campaign) throw new Error('Campaign or goal not found');

    const { timeframe = 'all', fromDate, toDate } = options;
    const dateFilter = this.buildDateRange(timeframe, fromDate, toDate, 3);

    // Tokens to match: full token, short id, raw uuid
    const shortId = campaign.id.slice(0, 6);
    const tokens = [campaign.token, `MCHANG-${shortId}`, `BDAY-${shortId}`, `CHARITY-${shortId}`, `SAVE-${shortId}`, campaign.id];

    // Base query for payments
    let sql = `
      SELECT * FROM public_link_payments 
      WHERE (
        UPPER(link_token) = ANY($1::text[])
        OR (link_id::text IS NOT NULL AND (link_id = $2 OR UPPER(SUBSTRING(link_id::text, 1, 6)) = UPPER($3)))
      )
    `;
    const params = [tokens.map(t => t.toUpperCase()), campaign.id, shortId];

    if (dateFilter.condition) {
      sql += ` AND (${dateFilter.condition})`;
      params.push(...dateFilter.params);
    }

    sql += ' ORDER BY created_at DESC';

    const { rows: payments } = await db.query(sql, params);

    // Also get all-time completed total for consistent global balance
    const allTimeRes = await db.query(
      `SELECT 
         COALESCE(SUM(amount) FILTER (WHERE status = 'COMPLETED'), 0) AS total_collected,
         COUNT(*) FILTER (WHERE status = 'COMPLETED') AS total_completed_count,
         COUNT(DISTINCT COALESCE(NULLIF(payer_phone, ''), payer_name)) FILTER (WHERE status = 'COMPLETED') AS unique_donors_count
       FROM public_link_payments
       WHERE (
         UPPER(link_token) = ANY($1::text[])
         OR (link_id::text IS NOT NULL AND (link_id = $2 OR UPPER(SUBSTRING(link_id::text, 1, 6)) = UPPER($3)))
       )`,
      [tokens.map(t => t.toUpperCase()), campaign.id, shortId]
    );

    const allTimeCollected = Number(allTimeRes.rows[0]?.total_collected || campaign.collectedAmount || 0);
    const allTimeCompletedCount = parseInt(allTimeRes.rows[0]?.total_completed_count || 0, 10);
    const allTimeUniqueDonorsCount = parseInt(allTimeRes.rows[0]?.unique_donors_count || 0, 10);

    // Contributor aggregation dictionary
    const contributorMap = new Map();
    let periodCompletedSum = 0;
    let periodCompletedCount = 0;
    let periodPendingSum = 0;
    let periodPendingCount = 0;
    let periodFailedSum = 0;
    let periodFailedCount = 0;

    for (const payment of payments) {
      const amount = Number(payment.amount || 0);
      const isCompleted = payment.status === 'COMPLETED';

      if (isCompleted) {
        periodCompletedSum += amount;
        periodCompletedCount += 1;

        const identityKey = this.normalizeIdentity(payment.payer_phone, payment.payer_name, payment.contributor_user_id);
        const displayName = payment.is_anonymous ? 'Anonymous Contributor' : (payment.payer_name || 'Contributor').trim();
        const displayPhone = payment.is_anonymous ? 'Hidden' : (payment.payer_phone || '');

        if (!contributorMap.has(identityKey)) {
          contributorMap.set(identityKey, {
            identityKey,
            name: displayName,
            phone: displayPhone,
            isAnonymous: !!payment.is_anonymous,
            transactionCount: 0,
            totalContributed: 0,
            firstPaymentDate: payment.created_at,
            lastPaymentDate: payment.created_at,
            transactions: []
          });
        }

        const entry = contributorMap.get(identityKey);
        entry.transactionCount += 1;
        entry.totalContributed += amount;
        if (new Date(payment.created_at) > new Date(entry.lastPaymentDate)) {
          entry.lastPaymentDate = payment.created_at;
          if (!entry.isAnonymous) entry.name = displayName;
        }
        if (new Date(payment.created_at) < new Date(entry.firstPaymentDate)) {
          entry.firstPaymentDate = payment.created_at;
        }

        entry.transactions.push({
          id: payment.id,
          date: payment.created_at,
          amount,
          currency: payment.currency || campaign.currency,
          paymentMethod: payment.payment_method || 'Mobile Money',
          providerTxRef: payment.provider_tx_ref || `TX-${payment.id.slice(0, 8)}`,
          status: payment.status
        });
      } else if (payment.status === 'PENDING') {
        periodPendingSum += amount;
        periodPendingCount += 1;
      } else {
        periodFailedSum += amount;
        periodFailedCount += 1;
      }
    }

    // Convert aggregated map to sorted list (highest total contributed first)
    const aggregatedContributors = Array.from(contributorMap.values())
      .sort((a, b) => b.totalContributed - a.totalContributed);

    // Financial Metrics
    const targetAmount = campaign.targetAmount;
    const hasTarget = targetAmount > 0;
    const remainingAmount = hasTarget ? Math.max(0, targetAmount - allTimeCollected) : 0;
    const progressPercentage = hasTarget ? Math.round((allTimeCollected / targetAmount) * 100) : 0;
    const cappedProgressPercentage = Math.min(100, progressPercentage);

    // Retained savings (for savings goals)
    const retainedSavings = campaign.categoryType === 'SAVINGS'
      ? Math.max(0, allTimeCollected - campaign.totalWithdrawn)
      : 0;

    return {
      campaign: {
        ...campaign,
        collectedAmount: allTimeCollected,
        retainedSavings: campaign.categoryType === 'SAVINGS' ? retainedSavings : 0
      },
      reportingPeriod: {
        timeframe,
        label: dateFilter.label,
        fromDate: fromDate || null,
        toDate: toDate || null
      },
      metrics: {
        targetAmount,
        hasTarget,
        verifiedPeriodCollected: periodCompletedSum,
        verifiedAllTimeCollected: allTimeCollected,
        remainingAmount,
        progressPercentage,
        cappedProgressPercentage,
        retainedSavings,
        totalWithdrawn: campaign.totalWithdrawn,
        uniqueContributorsCount: aggregatedContributors.length,
        allTimeUniqueDonorsCount: Math.max(aggregatedContributors.length, allTimeUniqueDonorsCount),
        successfulTransactionsCount: periodCompletedCount,
        allTimeTransactionsCount: Math.max(periodCompletedCount, allTimeCompletedCount),
        pendingAmount: periodPendingSum,
        pendingTransactionsCount: periodPendingCount,
        failedAmount: periodFailedSum,
        failedTransactionsCount: periodFailedCount,
        currency: campaign.currency
      },
      contributors: aggregatedContributors
    };
  },

  /**
   * Get Individual Contributor Statement Data with every qualifying transaction listed
   */
  async getIndividualContributorStatement(db, type, identifier, contributorKey, options = {}) {
    const report = await this.getAggregatedCampaignReport(db, type, identifier, options);
    const targetKey = String(contributorKey).trim().toLowerCase();

    // Match contributor by key, phone, or name
    const contributor = report.contributors.find(c =>
      c.identityKey.toLowerCase() === targetKey ||
      (c.phone && c.phone.replace(/[^\d+]/g, '') === targetKey.replace(/[^\d+]/g, '')) ||
      c.name.toLowerCase() === targetKey
    );

    if (!contributor) {
      throw new Error(`Contributor statement for '${contributorKey}' was not found for this campaign.`);
    }

    // Query all-time transactions for this individual contributor
    const shortId = report.campaign.id.slice(0, 6);
    const tokens = [report.campaign.token, `MCHANG-${shortId}`, `BDAY-${shortId}`, `CHARITY-${shortId}`, `SAVE-${shortId}`, report.campaign.id];
    
    const allTimeTxRes = await db.query(
      `SELECT * FROM public_link_payments 
       WHERE (
         UPPER(link_token) = ANY($1::text[])
         OR (link_id::text IS NOT NULL AND (link_id = $2 OR UPPER(SUBSTRING(link_id::text, 1, 6)) = UPPER($3)))
       )
       AND status = 'COMPLETED'
       ORDER BY created_at DESC`,
      [tokens.map(t => t.toUpperCase()), report.campaign.id, shortId]
    );

    const allTimeContributorTxs = allTimeTxRes.rows.filter(p => {
      const k = CampaignService.normalizeIdentity(p.payer_phone, p.payer_name, p.contributor_user_id);
      return k.toLowerCase() === contributor.identityKey.toLowerCase();
    });

    const allTimeTotal = allTimeContributorTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    return {
      campaign: report.campaign,
      reportingPeriod: report.reportingPeriod,
      contributor: {
        ...contributor,
        allTimeTotal,
        allTimeCount: allTimeContributorTxs.length
      },
      statementTransactions: contributor.transactions,
      generatedAt: new Date().toISOString()
    };
  },

  /**
   * Secure Savings Goal Withdrawal.
   * Debits the goal's retained savings, credits the owner's balance, and records a double-entry ledger entry.
   */
  async withdrawFromSavings(pool, { campaignId, userId, amount, destinationDetails = null, narration = null }) {
    if (!campaignId) throw new Error('Goal ID is required');
    if (!userId) throw new Error('Authentication required');
    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch savings goal with FOR UPDATE lock
      const goalRes = await client.query(
        'SELECT * FROM michango_events WHERE id = $1 FOR UPDATE',
        [campaignId]
      );
      if (goalRes.rows.length === 0) {
        throw new Error('Savings goal not found');
      }

      const goal = goalRes.rows[0];
      const categoryType = (goal.category_type || '').toUpperCase();
      if (categoryType !== 'SAVINGS' && goal.event_type !== 'SAVINGS') {
        throw new Error('This campaign is not configured as a savings goal');
      }

      // Check ownership
      if (goal.owner_user_id && goal.owner_user_id !== userId) {
        throw new Error('Unauthorized: You are not the owner of this savings goal');
      }

      // Current retained savings
      const collected = Number(goal.collected_amount || 0);
      const withdrawn = Number(goal.total_withdrawn || 0);
      const currentRetained = goal.retained_savings !== null && goal.retained_savings !== undefined
        ? Number(goal.retained_savings)
        : Math.max(0, collected - withdrawn);

      if (withdrawAmount > currentRetained) {
        throw new Error(`Insufficient savings balance. Available: TZS ${currentRetained.toLocaleString()}, Requested: TZS ${withdrawAmount.toLocaleString()}`);
      }

      // 2. Debit savings goal
      const newRetained = currentRetained - withdrawAmount;
      const newTotalWithdrawn = withdrawn + withdrawAmount;

      await client.query(
        `UPDATE michango_events 
         SET retained_savings = $1, total_withdrawn = $2, updated_at = NOW() 
         WHERE id = $3`,
        [newRetained, newTotalWithdrawn, goal.id]
      );

      // 3. Post Ledger Credit to user balance
      const refCode = `SAV-WTH-${Date.now().toString().slice(-6)}`;
      await LedgerService.getOrCreateUserBalance(client, userId);
      await LedgerService.postCredit(client, {
        userId,
        amount: withdrawAmount,
        transactionType: 'SAVINGS_WITHDRAWAL',
        referenceType: 'SAVINGS_GOAL',
        referenceId: goal.id,
        providerTxRef: refCode,
        idempotencyKey: `sav_wth_${goal.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        metadata: {
          goalTitle: goal.title,
          narration: narration || `Withdrawal from Savings: ${goal.title}`,
          destination: destinationDetails || goal.destination_snapshot
        }
      });

      // 4. Audit Log
      await client.query(
        `INSERT INTO audit_logs (actor, action, entity_type, entity_id, metadata)
         VALUES ($1, 'SAVINGS_GOAL_WITHDRAWAL', 'michango_events', $2, $3)`,
        [userId, goal.id, {
          amount: withdrawAmount,
          previousRetained: currentRetained,
          newRetained,
          refCode
        }]
      );

      await client.query('COMMIT');

      return {
        success: true,
        referenceCode: refCode,
        withdrawnAmount: withdrawAmount,
        remainingRetainedSavings: newRetained,
        goalTitle: goal.title
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
};
