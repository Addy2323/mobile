import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignService } from '../campaignService.js';
import { PDFService } from '../pdfService.js';
import { LedgerService } from '../ledgerService.js';

describe('LUMO Split Charity, Savings & PDF Reporting Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------
  // SUITE 1: CONTRIBUTOR DEDUPLICATION & AGGREGATION VIA REPORT
  // -------------------------------------------------------------
  describe('Suite 1: Contributor Deduplication & Aggregation', () => {
    it('aggregates multiple payments from the same donor into a single deduplicated entry', async () => {
      const mockCampaign = {
        id: 'camp_001',
        title: 'Watoto Fundraiser',
        category_type: 'CHARITY',
        target_amount: 500000,
        collected_amount: 175000,
        total_withdrawn: 0,
        currency: 'TZS',
        status: 'ACTIVE'
      };

      const rawPayments = [
        {
          id: 'pay_1',
          payer_name: 'Kelvin Mushi',
          payer_phone: '0754111222',
          amount: 50000,
          currency: 'TZS',
          status: 'COMPLETED',
          payment_method: 'Mobile Money',
          provider_tx_ref: 'SNIPPE_001',
          created_at: new Date('2026-10-01T10:00:00Z'),
          contributor_user_id: 'user_km',
          is_anonymous: false
        },
        {
          id: 'pay_2',
          payer_name: 'Kelvin Mushi',
          payer_phone: '0754111222',
          amount: 25000,
          currency: 'TZS',
          status: 'COMPLETED',
          payment_method: 'Mobile Money',
          provider_tx_ref: 'SNIPPE_002',
          created_at: new Date('2026-10-03T14:30:00Z'),
          contributor_user_id: 'user_km',
          is_anonymous: false
        },
        {
          id: 'pay_3',
          payer_name: 'Kelvin Mushi',
          payer_phone: '0754111222',
          amount: 100000,
          currency: 'TZS',
          status: 'COMPLETED',
          payment_method: 'Mobile Money',
          provider_tx_ref: 'SNIPPE_003',
          created_at: new Date('2026-10-08T09:15:00Z'),
          contributor_user_id: 'user_km',
          is_anonymous: false
        },
        {
          id: 'pay_4',
          payer_name: 'Amina Salum',
          payer_phone: '0688333444',
          amount: 200000,
          currency: 'TZS',
          status: 'COMPLETED',
          payment_method: 'Bank',
          provider_tx_ref: 'SNIPPE_004',
          created_at: new Date('2026-10-05T12:00:00Z'),
          contributor_user_id: null,
          is_anonymous: false
        }
      ];

      const mockDb = {
        query: vi.fn().mockImplementation((query) => {
          if (query.includes('FROM michango_events')) {
            return Promise.resolve({ rows: [mockCampaign] });
          }
          if (query.includes('COUNT(*) FILTER')) {
            return Promise.resolve({
              rows: [{
                total_collected: 375000,
                total_completed_count: 4,
                unique_donors_count: 2
              }]
            });
          }
          if (query.includes('FROM public_link_payments')) {
            return Promise.resolve({ rows: rawPayments });
          }
          return Promise.resolve({ rows: [] });
        })
      };

      const report = await CampaignService.getAggregatedCampaignReport(mockDb, 'CHARITY', 'camp_001');

      // Deduplication verification: exactly 2 distinct contributors
      expect(report.contributors).toHaveLength(2);

      // Find Kelvin
      const kelvin = report.contributors.find((c) => c.name === 'Kelvin Mushi');
      expect(kelvin).toBeDefined();
      expect(kelvin.transactionCount).toBe(3);
      expect(kelvin.totalContributed).toBe(175000); // 50000 + 25000 + 100000
      expect(kelvin.transactions).toHaveLength(3);

      // Find Amina
      const amina = report.contributors.find((c) => c.name === 'Amina Salum');
      expect(amina).toBeDefined();
      expect(amina.transactionCount).toBe(1);
      expect(amina.totalContributed).toBe(200000);
    });

    it('honors anonymous contributor privacy flag in public summary display', async () => {
      const mockCampaign = {
        id: 'camp_002',
        title: 'Emergency Medical',
        category_type: 'CHARITY',
        target_amount: 1000000,
        collected_amount: 500000,
        total_withdrawn: 0,
        currency: 'TZS',
        status: 'ACTIVE'
      };

      const rawPayments = [
        {
          id: 'pay_anon',
          payer_name: 'Secret Benefactor',
          payer_phone: '0712999888',
          amount: 500000,
          currency: 'TZS',
          status: 'COMPLETED',
          is_anonymous: true,
          created_at: new Date()
        }
      ];

      const mockDb = {
        query: vi.fn().mockImplementation((query) => {
          if (query.includes('FROM michango_events')) {
            return Promise.resolve({ rows: [mockCampaign] });
          }
          if (query.includes('COUNT(*) FILTER')) {
            return Promise.resolve({
              rows: [{
                total_collected: 500000,
                total_completed_count: 1,
                unique_donors_count: 1
              }]
            });
          }
          if (query.includes('FROM public_link_payments')) {
            return Promise.resolve({ rows: rawPayments });
          }
          return Promise.resolve({ rows: [] });
        })
      };

      const report = await CampaignService.getAggregatedCampaignReport(mockDb, 'CHARITY', 'camp_002');
      expect(report.contributors).toHaveLength(1);
      expect(report.contributors[0].isAnonymous).toBe(true);
      expect(report.contributors[0].name).toBe('Anonymous Contributor');
      expect(report.contributors[0].phone).toBe('Hidden');
    });
  });

  // -------------------------------------------------------------
  // SUITE 2: FINANCIAL METRICS & TIMEFRAME CALCULATIONS
  // -------------------------------------------------------------
  describe('Suite 2: Financial Metrics & Timelines', () => {
    it('accurately calculates campaign metrics, remaining balances, and progress percentages', async () => {
      const mockCampaign = {
        id: 'camp_003',
        title: 'Church Roof Fund',
        category_type: 'GENERAL',
        target_amount: 1000000,
        collected_amount: 650000,
        total_withdrawn: 0,
        currency: 'TZS',
        status: 'ACTIVE'
      };

      const mockDb = {
        query: vi.fn().mockImplementation((query) => {
          if (query.includes('FROM michango_events')) {
            return Promise.resolve({ rows: [mockCampaign] });
          }
          if (query.includes('COUNT(*) FILTER')) {
            return Promise.resolve({
              rows: [{
                total_collected: 650000,
                total_completed_count: 2,
                unique_donors_count: 2
              }]
            });
          }
          if (query.includes('FROM public_link_payments')) {
            return Promise.resolve({
              rows: [
                { id: 'p1', payer_name: 'John', payer_phone: '0711', amount: 350000, status: 'COMPLETED', created_at: new Date() },
                { id: 'p2', payer_name: 'Mary', payer_phone: '0722', amount: 300000, status: 'COMPLETED', created_at: new Date() }
              ]
            });
          }
          return Promise.resolve({ rows: [] });
        })
      };

      const report = await CampaignService.getAggregatedCampaignReport(mockDb, 'MCHANGO', 'camp_003');

      expect(report.metrics.targetAmount).toBe(1000000);
      expect(report.metrics.verifiedAllTimeCollected).toBe(650000);
      expect(report.metrics.verifiedPeriodCollected).toBe(650000);
      expect(report.metrics.remainingAmount).toBe(350000);
      expect(report.metrics.progressPercentage).toBe(65);
      expect(report.metrics.cappedProgressPercentage).toBe(65);
    });

    it('builds valid SQL timeframe clauses for all supported filter intervals', () => {
      expect(CampaignService.buildDateRange('all').condition).toBe('');
      expect(CampaignService.buildDateRange('today').condition).toContain('CURRENT_DATE');
      expect(CampaignService.buildDateRange('7d').condition).toContain("INTERVAL '7 days'");
      expect(CampaignService.buildDateRange('30d').condition).toContain("DATE_TRUNC('month'");
      expect(CampaignService.buildDateRange('last_30d').condition).toContain("INTERVAL '30 days'");
      expect(CampaignService.buildDateRange('this_year').condition).toContain("DATE_TRUNC('year'");
    });
  });

  // -------------------------------------------------------------
  // SUITE 3: SAVINGS GOAL DEPOSITS & SECURE WITHDRAWALS
  // -------------------------------------------------------------
  describe('Suite 3: Savings Goal Deposits & Withdrawals', () => {
    it('prevents over-withdrawal when requested amount exceeds retained savings', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((query) => {
          if (query.includes('FROM michango_events')) {
            return Promise.resolve({
              rows: [{
                id: 'goal_123',
                owner_user_id: 'user_dave',
                category_type: 'SAVINGS',
                collected_amount: 50000,
                retained_savings: 50000, // Only 50K retained
                total_withdrawn: 0
              }]
            });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn()
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient)
      };

      await expect(
        CampaignService.withdrawFromSavings(mockPool, {
          campaignId: 'goal_123',
          userId: 'user_dave',
          amount: 100000 // requesting 100K > 50K
        })
      ).rejects.toThrow('Insufficient savings balance');
    });

    it('successfully processes savings withdrawal, updates campaign and posts ledger credit to user', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((query) => {
          if (query.includes('FROM michango_events')) {
            return Promise.resolve({
              rows: [{
                id: 'goal_123',
                title: 'Emergency Fund',
                owner_user_id: 'user_dave',
                category_type: 'SAVINGS',
                collected_amount: 150000,
                retained_savings: 150000,
                total_withdrawn: 0,
                currency: 'TZS'
              }]
            });
          }
          if (query.includes('UPDATE michango_events')) {
            return Promise.resolve({
              rows: [{
                id: 'goal_123',
                retained_savings: 100000,
                total_withdrawn: 50000
              }]
            });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn()
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient)
      };

      vi.spyOn(LedgerService, 'getOrCreateUserBalance').mockResolvedValue({ id: 'bal_1', available_balance: 200000 });
      vi.spyOn(LedgerService, 'postCredit').mockResolvedValue({ id: 'tx_credit_1' });

      const result = await CampaignService.withdrawFromSavings(mockPool, {
        campaignId: 'goal_123',
        userId: 'user_dave',
        amount: 50000,
        narration: 'Transfer to main card'
      });

      expect(result.success).toBe(true);
      expect(result.withdrawnAmount).toBe(50000);
      expect(result.remainingRetainedSavings).toBe(100000);
      expect(result.referenceCode).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // SUITE 4: SERVER-SIDE VECTOR PDF GENERATION
  // -------------------------------------------------------------
  describe('Suite 4: Server-Side Vector PDF Engine', () => {
    it('generates a valid, beautifully styled Consolidated Summary PDF buffer with LUMO Split branding', async () => {
      const reportData = {
        campaign: {
          id: 'camp_001',
          token: 'CHARITY-A1B2C3',
          title: 'Watoto Foundation Orphanage Fund',
          categoryType: 'CHARITY',
          description: 'Providing food, healthcare and educational materials.',
          beneficiaryOrganization: 'Watoto Foundation Tanzania',
          beneficiaryName: 'Sister Grace',
          beneficiaryPhone: '+255754000111',
          currency: 'TZS',
          status: 'ACTIVE'
        },
        reportingPeriod: {
          timeframe: 'all',
          label: 'All-Time'
        },
        metrics: {
          targetAmount: 5000000,
          hasTarget: true,
          verifiedAllTimeCollected: 3200000,
          verifiedPeriodCollected: 3200000,
          remainingAmount: 1800000,
          retainedSavings: 0,
          progressPercentage: 64,
          cappedProgressPercentage: 64,
          uniqueContributorsCount: 2,
          successfulTransactionsCount: 4,
          isGoalMet: false
        },
        contributors: [
          {
            identityKey: 'key_1',
            name: 'Baraka Mushi',
            phone: '0754111222',
            transactionCount: 3,
            totalContributed: 1200000,
            firstPaymentDate: new Date('2026-10-01'),
            lastPaymentDate: new Date('2026-10-09')
          },
          {
            identityKey: 'key_2',
            name: 'Fatma Juma',
            phone: '0688999888',
            transactionCount: 1,
            totalContributed: 2000000,
            firstPaymentDate: new Date('2026-10-05'),
            lastPaymentDate: new Date('2026-10-05')
          }
        ]
      };

      const pdfBuffer = await PDFService.generateConsolidatedSummaryPDF(reportData);

      // Verification: Ensure the output is a valid binary Buffer
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000); // Non-empty PDF

      // Vector PDF signature verification: Must start with %PDF-
      const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
      expect(pdfHeader).toBe('%PDF-');
    });

    it('generates a valid, personalized Individual Contributor Statement PDF buffer', async () => {
      const statementData = {
        campaign: {
          id: 'camp_002',
          token: 'SAVE-VAULT1',
          title: 'Business Expansion Vault',
          categoryType: 'SAVINGS',
          currency: 'TZS',
          status: 'ACTIVE'
        },
        reportingPeriod: {
          timeframe: 'all',
          label: 'All-Time'
        },
        contributor: {
          identityKey: 'key_baraka',
          name: 'Baraka Mushi',
          phone: '+255754111222',
          totalContributed: 450000,
          allTimeTotal: 450000,
          transactionCount: 2,
          allTimeCount: 2,
          firstPaymentDate: new Date('2026-10-01'),
          lastPaymentDate: new Date('2026-10-08'),
          transactions: [
            {
              id: 'tx_1',
              amount: 250000,
              paymentMethod: 'Mobile Money',
              providerTxRef: 'SNIPPE_B1',
              date: new Date('2026-10-01')
            },
            {
              id: 'tx_2',
              amount: 200000,
              paymentMethod: 'Bank Transfer',
              providerTxRef: 'SNIPPE_B2',
              date: new Date('2026-10-08')
            }
          ]
        },
        statementTransactions: [
          {
            id: 'tx_1',
            amount: 250000,
            paymentMethod: 'Mobile Money',
            providerTxRef: 'SNIPPE_B1',
            date: new Date('2026-10-01')
          },
          {
            id: 'tx_2',
            amount: 200000,
            paymentMethod: 'Bank Transfer',
            providerTxRef: 'SNIPPE_B2',
            date: new Date('2026-10-08')
          }
        ]
      };

      const pdfBuffer = await PDFService.generateIndividualStatementPDF(statementData);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);

      // Verify PDF header signature
      const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
      expect(pdfHeader).toBe('%PDF-');
    });
  });
});

