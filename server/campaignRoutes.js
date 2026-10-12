import express from 'express';
import { CampaignService } from './campaignService.js';
import { PDFService } from './pdfService.js';

export function createCampaignRouter(pool, resolveUser) {
  const router = express.Router();

  /**
   * GET /api/campaigns/:type/:id
   * Retrieve campaign details, aggregated metrics, and deduplicated contributor list
   */
  router.get('/:type/:id', async (req, res) => {
    try {
      const { type, id } = req.params;
      const { timeframe = 'all', fromDate, toDate } = req.query;

      const report = await CampaignService.getAggregatedCampaignReport(pool, type, id, {
        timeframe,
        fromDate,
        toDate
      });

      res.json(report);
    } catch (err) {
      console.error('[GET /api/campaigns/:type/:id error]:', err);
      res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
    }
  });

  /**
   * GET /api/campaigns/:type/:id/reports/summary
   * JSON summary with period filters
   */
  router.get('/:type/:id/reports/summary', async (req, res) => {
    try {
      const { type, id } = req.params;
      const { timeframe = 'all', fromDate, toDate } = req.query;

      const report = await CampaignService.getAggregatedCampaignReport(pool, type, id, {
        timeframe,
        fromDate,
        toDate
      });

      res.json({
        campaign: report.campaign,
        reportingPeriod: report.reportingPeriod,
        metrics: report.metrics
      });
    } catch (err) {
      res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
    }
  });

  /**
   * GET /api/campaigns/:type/:id/reports/pdf
   * Generate & download the Colored Consolidated Summary PDF Report
   */
  router.get('/:type/:id/reports/pdf', async (req, res) => {
    try {
      const { type, id } = req.params;
      const { timeframe = 'all', fromDate, toDate } = req.query;

      const report = await CampaignService.getAggregatedCampaignReport(pool, type, id, {
        timeframe,
        fromDate,
        toDate
      });

      const pdfBuffer = await PDFService.generateConsolidatedSummaryPDF(report);

      const filename = `${report.campaign.token || 'CAMPAIGN'}_Summary_Report_${timeframe}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      console.error('[GET /api/campaigns/:type/:id/reports/pdf error]:', err);
      res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
    }
  });

  /**
   * GET /api/campaigns/:type/:id/statements/:contributorKey/pdf
   * Generate & download the Colored Individual Contributor Statement PDF
   */
  router.get('/:type/:id/statements/:contributorKey/pdf', async (req, res) => {
    try {
      const { type, id, contributorKey } = req.params;
      const { timeframe = 'all', fromDate, toDate } = req.query;

      const statementData = await CampaignService.getIndividualContributorStatement(
        pool,
        type,
        id,
        contributorKey,
        { timeframe, fromDate, toDate }
      );

      const pdfBuffer = await PDFService.generateIndividualStatementPDF(statementData);

      const safeKey = String(contributorKey).replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${statementData.campaign.token || 'CAMPAIGN'}_Statement_${safeKey}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      console.error('[GET statement pdf error]:', err);
      res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
    }
  });

  /**
   * POST /api/campaigns/:id/savings/withdraw
   * Secure, authoritative savings goal withdrawal
   */
  router.post('/:id/savings/withdraw', async (req, res) => {
    try {
      const userId = resolveUser(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required. Please log in.' });
      }

      const { id: campaignId } = req.params;
      const { amount, destinationDetails, narration } = req.body;

      const result = await CampaignService.withdrawFromSavings(pool, {
        campaignId,
        userId,
        amount,
        destinationDetails,
        narration
      });

      res.json(result);
    } catch (err) {
      console.error('[POST /api/campaigns/:id/savings/withdraw error]:', err);
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
