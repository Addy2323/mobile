import PDFDocument from 'pdfkit';
import crypto from 'crypto';

/**
 * Format currency with comma separators
 */
function formatTZS(amount) {
  const num = Number(amount || 0);
  return 'TZS ' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Format date in East Africa Time (Dar es Salaam, UTC+3)
 */
function formatDateEAT(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', {
      timeZone: 'Africa/Dar_es_Salaam',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return String(dateStr);
  }
}

export const PDFService = {
  /**
   * REPORT TYPE 1: CONSOLIDATED CAMPAIGN / SAVINGS / BIRTHDAY SUMMARY PDF
   * Colored, high-grade vector PDF report with aggregated contributor deduplication.
   */
  async generateConsolidatedSummaryPDF(reportData) {
    return new Promise((resolve, reject) => {
      try {
        const { campaign, reportingPeriod, metrics, contributors } = reportData;
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 36, bottom: 40, left: 36, right: 36 },
          bufferPages: true
        });

        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', err => reject(err));

        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const leftMargin = 36;
        const rightMargin = 36;
        const contentWidth = pageWidth - leftMargin - rightMargin; // 523.28

        // ==========================================
        // 1. HEADER SECTION (Navy Banner & Brand)
        // ==========================================
        // Background Navy Top Header
        doc.rect(0, 0, pageWidth, 84).fill('#060D0E');

        // Emerald Accent Bar
        doc.rect(0, 84, pageWidth, 4).fill('#00E599');

        // Brand Icon / Badge
        doc.roundedRect(leftMargin, 18, 38, 38, 8).fill('#00E599');
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#060D0E').text('LS', leftMargin + 8, 28);

        // Header Titles
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#FFFFFF').text('LUMO SPLIT', leftMargin + 48, 20);
        doc.font('Helvetica').fontSize(9).fillColor('#94A3B8').text('Michango & Financial Contribution Infrastructure', leftMargin + 48, 38);

        // Right side: Report Type Badge
        const reportBadgeTitle = campaign.categoryType === 'CHARITY'
          ? 'CHARITY CAMPAIGN REPORT'
          : campaign.categoryType === 'SAVINGS'
          ? 'SAVINGS GOAL STATEMENT'
          : campaign.type === 'BIRTHDAY_POOL'
          ? 'BIRTHDAY POOL REPORT'
          : 'MCHANGO CONTRIBUTION REPORT';

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#00E599').text(reportBadgeTitle, pageWidth - rightMargin - 220, 24, { width: 220, align: 'right' });
        doc.font('Helvetica').fontSize(8).fillColor('#94A3B8').text(`REF: ${campaign.token}  |  STATUS: ${campaign.status}`, pageWidth - rightMargin - 220, 38, { width: 220, align: 'right' });

        doc.y = 104;

        // ==========================================
        // 2. CAMPAIGN DETAILS & PERIOD CARD
        // ==========================================
        const cardY = doc.y;
        doc.roundedRect(leftMargin, cardY, contentWidth, 72, 8).fillAndStroke('#F8FAFC', '#E2E8F0');

        // Left Column: Campaign Title & Beneficiary
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#060D0E').text(campaign.title, leftMargin + 14, cardY + 12, { width: 320 });
        doc.font('Helvetica').fontSize(9).fillColor('#64748B');
        
        let subText = `Category: ${campaign.categoryType || 'General'} Fundraiser`;
        if (campaign.beneficiaryName) subText += `  •  Beneficiary: ${campaign.beneficiaryName}`;
        if (campaign.beneficiaryOrganization) subText += ` (${campaign.beneficiaryOrganization})`;
        doc.text(subText, leftMargin + 14, cardY + 32, { width: 320 });

        if (campaign.description) {
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748B').text(campaign.description.slice(0, 90), leftMargin + 14, cardY + 48, { width: 320, lineBreak: false });
        }

        // Right Column: Reporting Period Pill
        const pillX = pageWidth - rightMargin - 165;
        doc.roundedRect(pillX, cardY + 14, 150, 44, 6).fill('#E6FBF4');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#00875A').text('REPORTING TIMEFRAME', pillX + 10, cardY + 20);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#060D0E').text(reportingPeriod.label || 'All-Time', pillX + 10, cardY + 32);
        doc.font('Helvetica').fontSize(7.5).fillColor('#64748B').text(`Generated: ${formatDateEAT(new Date())}`, pillX + 10, cardY + 46);

        doc.y = cardY + 84;

        // ==========================================
        // 3. KEY METRICS TILES (Colored Grid)
        // ==========================================
        const gridY = doc.y;
        const colWidth = (contentWidth - 18) / 4; // 4 columns
        const tileHeight = 56;

        const tiles = [
          {
            label: 'TARGET GOAL',
            value: metrics.hasTarget ? formatTZS(metrics.targetAmount) : 'Open / No Cap',
            sub: metrics.hasTarget ? `${metrics.progressPercentage}% Progress` : 'Discretionary'
          },
          {
            label: campaign.categoryType === 'SAVINGS' ? 'RETAINED SAVINGS' : 'VERIFIED COLLECTED',
            value: campaign.categoryType === 'SAVINGS' ? formatTZS(metrics.retainedSavings) : formatTZS(metrics.verifiedPeriodCollected),
            sub: `All-Time: ${formatTZS(metrics.verifiedAllTimeCollected)}`,
            accent: true
          },
          {
            label: 'REMAINING GOAL',
            value: metrics.hasTarget ? formatTZS(metrics.remainingAmount) : 'N/A',
            sub: metrics.remainingAmount === 0 && metrics.hasTarget ? 'Goal Achieved!' : 'Outstanding'
          },
          {
            label: 'CONTRIBUTORS',
            value: `${metrics.uniqueContributorsCount} Donors`,
            sub: `${metrics.successfulTransactionsCount} Total Payments`
          }
        ];

        tiles.forEach((t, i) => {
          const tx = leftMargin + i * (colWidth + 6);
          const bg = t.accent ? '#060D0E' : '#FFFFFF';
          const stroke = t.accent ? '#00E599' : '#E2E8F0';
          doc.roundedRect(tx, gridY, colWidth, tileHeight, 6).fillAndStroke(bg, stroke);

          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(t.accent ? '#00E599' : '#64748B').text(t.label, tx + 8, gridY + 8);
          doc.font('Helvetica-Bold').fontSize(10.5).fillColor(t.accent ? '#FFFFFF' : '#060D0E').text(t.value, tx + 8, gridY + 20, { width: colWidth - 14, lineBreak: false });
          doc.font('Helvetica').fontSize(7).fillColor(t.accent ? '#94A3B8' : '#64748B').text(t.sub, tx + 8, gridY + 38);
        });

        doc.y = gridY + tileHeight + 10;

        // Visual Progress Bar (if target exists)
        if (metrics.hasTarget) {
          const barY = doc.y;
          doc.roundedRect(leftMargin, barY, contentWidth, 8, 4).fill('#E2E8F0');
          const fillWidth = Math.max(4, Math.min(contentWidth, (contentWidth * metrics.cappedProgressPercentage) / 100));
          doc.roundedRect(leftMargin, barY, fillWidth, 8, 4).fill('#00E599');
          doc.y = barY + 16;
        }

        // ==========================================
        // 4. CONSOLIDATED CONTRIBUTORS TABLE
        // ==========================================
        const tableStartY = doc.y + 4;
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#060D0E').text(`CONSOLIDATED CONTRIBUTORS LEDGER (${contributors.length} Donors)`, leftMargin, tableStartY);
        doc.font('Helvetica').fontSize(8).fillColor('#64748B').text('Unique contributors aggregated by verified mobile identity. Deduplicated across multiple payments.', leftMargin, tableStartY + 14);

        const tableY = tableStartY + 28;
        const colNo = 26;
        const colName = 180;
        const colPhone = 110;
        const colTx = 80;
        const colTotal = contentWidth - colNo - colName - colPhone - colTx;

        // Table Header
        doc.roundedRect(leftMargin, tableY, contentWidth, 22, 4).fill('#060D0E');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
        doc.text('#', leftMargin + 6, tableY + 6);
        doc.text('CONTRIBUTOR NAME', leftMargin + colNo + 6, tableY + 6);
        doc.text('CONTACT / PHONE', leftMargin + colNo + colName + 6, tableY + 6);
        doc.text('PAYMENTS', leftMargin + colNo + colName + colPhone + 6, tableY + 6, { align: 'center', width: colTx });
        doc.text('TOTAL CONTRIBUTED', leftMargin + colNo + colName + colPhone + colTx, tableY + 6, { align: 'right', width: colTotal - 8 });

        let currentY = tableY + 24;
        let rowIndex = 0;

        if (contributors.length === 0) {
          doc.roundedRect(leftMargin, currentY, contentWidth, 28, 2).fill('#F8FAFC');
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#64748B').text('No verified contributions received during this reporting period.', leftMargin, currentY + 9, { align: 'center', width: contentWidth });
          currentY += 32;
        } else {
          for (const item of contributors) {
            rowIndex++;
            // Check for page break
            if (currentY + 22 > pageHeight - 60) {
              doc.addPage();
              currentY = 40;
              // Re-draw table header on new page
              doc.roundedRect(leftMargin, currentY, contentWidth, 22, 4).fill('#060D0E');
              doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
              doc.text('#', leftMargin + 6, currentY + 6);
              doc.text('CONTRIBUTOR NAME', leftMargin + colNo + 6, currentY + 6);
              doc.text('CONTACT / PHONE', leftMargin + colNo + colName + 6, currentY + 6);
              doc.text('PAYMENTS', leftMargin + colNo + colName + colPhone + 6, currentY + 6, { align: 'center', width: colTx });
              doc.text('TOTAL CONTRIBUTED', leftMargin + colNo + colName + colPhone + colTx, currentY + 6, { align: 'right', width: colTotal - 8 });
              currentY += 24;
            }

            const rowBg = rowIndex % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
            doc.rect(leftMargin, currentY, contentWidth, 20).fill(rowBg);

            doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(String(rowIndex), leftMargin + 6, currentY + 5);
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#060D0E').text(item.name, leftMargin + colNo + 6, currentY + 5, { width: colName - 10, lineBreak: false });
            doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(item.phone || '—', leftMargin + colNo + colName + 6, currentY + 5);
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#00875A').text(`${item.transactionCount} txn${item.transactionCount > 1 ? 's' : ''}`, leftMargin + colNo + colName + colPhone + 6, currentY + 5, { align: 'center', width: colTx });
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#060D0E').text(formatTZS(item.totalContributed), leftMargin + colNo + colName + colPhone + colTx, currentY + 5, { align: 'right', width: colTotal - 8 });

            // Bottom subtle border
            doc.rect(leftMargin, currentY + 19, contentWidth, 1).fill('#E2E8F0');
            currentY += 20;
          }

          // Table Total Summary Row
          doc.rect(leftMargin, currentY, contentWidth, 24).fill('#E6FBF4');
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#00875A').text('TOTALS FOR REPORTING PERIOD', leftMargin + colNo + 6, currentY + 7);
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#00875A').text(`${metrics.successfulTransactionsCount} txns`, leftMargin + colNo + colName + colPhone + 6, currentY + 7, { align: 'center', width: colTx });
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#060D0E').text(formatTZS(metrics.verifiedPeriodCollected), leftMargin + colNo + colName + colPhone + colTx, currentY + 6, { align: 'right', width: colTotal - 8 });
          currentY += 32;
        }

        // ==========================================
        // 5. FOOTER & VERIFICATION STAMP
        // ==========================================
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);

          const footerY = pageHeight - 34;
          doc.rect(leftMargin, footerY - 4, contentWidth, 1).fill('#E2E8F0');

          doc.font('Helvetica-Bold').fontSize(7).fillColor('#060D0E').text('LUMO SPLIT DIGITAL FINANCIAL AUDIT', leftMargin, footerY);
          doc.font('Helvetica').fontSize(6.5).fillColor('#94A3B8').text('This is a tamper-resistant statement generated from immutable double-entry ledger transactions.', leftMargin, footerY + 9);

          const pageText = `Page ${i + 1} of ${range.count}`;
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B').text(pageText, pageWidth - rightMargin - 80, footerY + 2, { align: 'right', width: 80 });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },

  /**
   * REPORT TYPE 2: INDIVIDUAL CONTRIBUTOR STATEMENT PDF
   * Itemized individual statement listing every qualifying contribution transaction.
   */
  async generateIndividualStatementPDF(statementData) {
    return new Promise((resolve, reject) => {
      try {
        const { campaign, reportingPeriod, contributor, statementTransactions } = statementData;
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 36, bottom: 40, left: 36, right: 36 },
          bufferPages: true
        });

        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', err => reject(err));

        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const leftMargin = 36;
        const rightMargin = 36;
        const contentWidth = pageWidth - leftMargin - rightMargin;

        // ==========================================
        // 1. HEADER SECTION (Navy & Emerald Accent)
        // ==========================================
        doc.rect(0, 0, pageWidth, 84).fill('#060D0E');
        doc.rect(0, 84, pageWidth, 4).fill('#00E599');

        // Brand Icon / Badge
        doc.roundedRect(leftMargin, 18, 38, 38, 8).fill('#00E599');
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#060D0E').text('LS', leftMargin + 8, 28);

        // Header Titles
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#FFFFFF').text('LUMO SPLIT', leftMargin + 48, 20);
        doc.font('Helvetica').fontSize(9).fillColor('#94A3B8').text('Official Contributor Statement & Payment Voucher', leftMargin + 48, 38);

        // Right side: Contributor Statement Label
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#00E599').text('INDIVIDUAL STATEMENT', pageWidth - rightMargin - 220, 24, { width: 220, align: 'right' });
        doc.font('Helvetica').fontSize(8).fillColor('#94A3B8').text(`CAMPAIGN: ${campaign.token}  |  VERIFIED`, pageWidth - rightMargin - 220, 38, { width: 220, align: 'right' });

        doc.y = 104;

        // ==========================================
        // 2. CONTRIBUTOR & CAMPAIGN INFO CARD
        // ==========================================
        const cardY = doc.y;
        doc.roundedRect(leftMargin, cardY, contentWidth, 76, 8).fillAndStroke('#F8FAFC', '#E2E8F0');

        // Contributor Details
        doc.font('Helvetica').fontSize(8).fillColor('#64748B').text('ISSUED TO CONTRIBUTOR:', leftMargin + 14, cardY + 10);
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#060D0E').text(contributor.name, leftMargin + 14, cardY + 22);
        doc.font('Helvetica').fontSize(9).fillColor('#64748B').text(`Mobile: ${contributor.phone || 'N/A'}  •  Key: ${contributor.identityKey}`, leftMargin + 14, cardY + 40);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#00875A').text(`Campaign: ${campaign.title}`, leftMargin + 14, cardY + 54);

        // Right side: Reporting Period Pill
        const pillX = pageWidth - rightMargin - 165;
        doc.roundedRect(pillX, cardY + 12, 150, 52, 6).fill('#E6FBF4');
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#00875A').text('STATEMENT PERIOD', pillX + 10, cardY + 18);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#060D0E').text(reportingPeriod.label || 'All-Time', pillX + 10, cardY + 30);
        doc.font('Helvetica').fontSize(7).fillColor('#64748B').text(`Date: ${formatDateEAT(new Date())}`, pillX + 10, cardY + 46);

        doc.y = cardY + 86;

        // ==========================================
        // 3. CONTRIBUTOR FINANCIAL SUMMARY TILES
        // ==========================================
        const gridY = doc.y;
        const colWidth = (contentWidth - 12) / 3;
        const tileHeight = 56;

        const tiles = [
          {
            label: 'CONTRIBUTIONS IN PERIOD',
            value: formatTZS(contributor.totalContributed),
            sub: `${contributor.transactionCount} Successful Payment${contributor.transactionCount > 1 ? 's' : ''}`,
            accent: true
          },
          {
            label: 'ALL-TIME CONTRIBUTED',
            value: formatTZS(contributor.allTimeTotal || contributor.totalContributed),
            sub: `Total: ${contributor.allTimeCount || contributor.transactionCount} All-Time Txns`
          },
          {
            label: 'CAMPAIGN COMPLETION',
            value: `${Math.min(100, Math.round(((campaign.collectedAmount || 0) / (campaign.targetAmount || 1)) * 100))}% Settled`,
            sub: `Total Collected: ${formatTZS(campaign.collectedAmount)}`
          }
        ];

        tiles.forEach((t, i) => {
          const tx = leftMargin + i * (colWidth + 6);
          const bg = t.accent ? '#060D0E' : '#FFFFFF';
          const stroke = t.accent ? '#00E599' : '#E2E8F0';
          doc.roundedRect(tx, gridY, colWidth, tileHeight, 6).fillAndStroke(bg, stroke);

          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(t.accent ? '#00E599' : '#64748B').text(t.label, tx + 8, gridY + 8);
          doc.font('Helvetica-Bold').fontSize(11).fillColor(t.accent ? '#FFFFFF' : '#060D0E').text(t.value, tx + 8, gridY + 22, { width: colWidth - 14, lineBreak: false });
          doc.font('Helvetica').fontSize(7).fillColor(t.accent ? '#94A3B8' : '#64748B').text(t.sub, tx + 8, gridY + 40);
        });

        doc.y = gridY + tileHeight + 14;

        // ==========================================
        // 4. ITEMIZED TRANSACTIONS LEDGER TABLE
        // ==========================================
        const tableStartY = doc.y;
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#060D0E').text('ITEMIZED TRANSACTION VOUCHERS', leftMargin, tableStartY);
        doc.font('Helvetica').fontSize(8).fillColor('#64748B').text('Every verified electronic payment credited to this campaign from this contributor.', leftMargin, tableStartY + 14);

        const tableY = tableStartY + 28;
        const colDate = 100;
        const colRef = 140;
        const colMethod = 100;
        const colStatus = 70;
        const colAmt = contentWidth - colDate - colRef - colMethod - colStatus;

        // Header
        doc.roundedRect(leftMargin, tableY, contentWidth, 22, 4).fill('#060D0E');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
        doc.text('DATE & TIME (EAT)', leftMargin + 8, tableY + 6);
        doc.text('TRANSACTION REFERENCE', leftMargin + colDate + 8, tableY + 6);
        doc.text('PAYMENT CHANNEL', leftMargin + colDate + colRef + 8, tableY + 6);
        doc.text('STATUS', leftMargin + colDate + colRef + colMethod + 8, tableY + 6, { align: 'center', width: colStatus });
        doc.text('AMOUNT', leftMargin + colDate + colRef + colMethod + colStatus, tableY + 6, { align: 'right', width: colAmt - 8 });

        let currentY = tableY + 24;
        let rowIndex = 0;

        const txList = statementTransactions || contributor.transactions || [];

        if (txList.length === 0) {
          doc.roundedRect(leftMargin, currentY, contentWidth, 28, 2).fill('#F8FAFC');
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#64748B').text('No transactions recorded for this contributor in the specified period.', leftMargin, currentY + 9, { align: 'center', width: contentWidth });
          currentY += 32;
        } else {
          for (const tx of txList) {
            rowIndex++;
            if (currentY + 22 > pageHeight - 60) {
              doc.addPage();
              currentY = 40;
              doc.roundedRect(leftMargin, currentY, contentWidth, 22, 4).fill('#060D0E');
              doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
              doc.text('DATE & TIME (EAT)', leftMargin + 8, currentY + 6);
              doc.text('TRANSACTION REFERENCE', leftMargin + colDate + 8, currentY + 6);
              doc.text('PAYMENT CHANNEL', leftMargin + colDate + colRef + 8, currentY + 6);
              doc.text('STATUS', leftMargin + colDate + colRef + colMethod + 8, currentY + 6, { align: 'center', width: colStatus });
              doc.text('AMOUNT', leftMargin + colDate + colRef + colMethod + colStatus, currentY + 6, { align: 'right', width: colAmt - 8 });
              currentY += 24;
            }

            const rowBg = rowIndex % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
            doc.rect(leftMargin, currentY, contentWidth, 20).fill(rowBg);

            doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(formatDateEAT(tx.date), leftMargin + 8, currentY + 5);
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#060D0E').text(tx.providerTxRef || tx.id, leftMargin + colDate + 8, currentY + 5, { width: colRef - 10, lineBreak: false });
            doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(tx.paymentMethod || 'Mobile Money', leftMargin + colDate + colRef + 8, currentY + 5);
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#00875A').text('COMPLETED', leftMargin + colDate + colRef + colMethod + 8, currentY + 5, { align: 'center', width: colStatus });
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#060D0E').text(formatTZS(tx.amount), leftMargin + colDate + colRef + colMethod + colStatus, currentY + 5, { align: 'right', width: colAmt - 8 });

            doc.rect(leftMargin, currentY + 19, contentWidth, 1).fill('#E2E8F0');
            currentY += 20;
          }

          // Summary Footer
          doc.rect(leftMargin, currentY, contentWidth, 24).fill('#E6FBF4');
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#00875A').text('STATEMENT PERIOD TOTAL', leftMargin + 8, currentY + 7);
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#060D0E').text(formatTZS(contributor.totalContributed), leftMargin + colDate + colRef + colMethod + colStatus, currentY + 6, { align: 'right', width: colAmt - 8 });
          currentY += 32;
        }

        // ==========================================
        // 5. OFFICIAL VERIFICATION SIGN-OFF
        // ==========================================
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);

          const footerY = pageHeight - 34;
          doc.rect(leftMargin, footerY - 4, contentWidth, 1).fill('#E2E8F0');

          doc.font('Helvetica-Bold').fontSize(7).fillColor('#060D0E').text('LUMO SPLIT OFFICIAL FINANCIAL VOUCHER', leftMargin, footerY);
          doc.font('Helvetica').fontSize(6.5).fillColor('#94A3B8').text('Cryptographically recorded in LUMO Ledger. Authorized as legitimate proof of contribution.', leftMargin, footerY + 9);

          const pageText = `Page ${i + 1} of ${range.count}`;
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B').text(pageText, pageWidth - rightMargin - 80, footerY + 2, { align: 'right', width: 80 });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
};
