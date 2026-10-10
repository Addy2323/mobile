import { formatMoney, formatDateTime } from './utils';

export type ReceiptData = {
  title: string;
  refCode: string;
  txRef?: string;
  amount: number;
  totalAmount?: number;
  participantName?: string;
  merchantName?: string;
  providerLabel?: string;
  date?: string;
  status?: string;
  participants?: Array<{
    name: string;
    amount: number;
    status: string;
    payment_ref?: string | null;
  }>;
};

export function generateColoredReceiptHTML(data: ReceiptData): string {
  const dateStr = data.date || formatDateTime(new Date().toISOString());
  const formattedAmount = formatMoney(data.amount);
  const formattedTotal = data.totalAmount ? formatMoney(data.totalAmount) : null;
  const merchant = data.merchantName || 'Verified Destination';
  const provider = data.providerLabel || 'Mobile Money / Card';
  const txReference = data.txRef || `TX-${data.refCode}-${Date.now().toString().slice(-4)}`;

  const participantRows = (data.participants || []).map(p => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">${escapeHtml(p.name)}</td>
      <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; text-align: right;">${formatMoney(p.amount)}</td>
      <td style="padding: 10px 12px; text-align: right;">
        <span style="display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 800; border-radius: 9999px; background-color: ${p.status.toUpperCase() === 'PAID' || p.status.toUpperCase() === 'SETTLED' ? '#dcfce7; color: #15803d;' : '#fef3c7; color: #b45309;'}">
          ${escapeHtml(p.status)}
        </span>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LUMO Split Receipt - ${escapeHtml(txReference)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 24px 16px;
    }

    .receipt-card {
      width: 100%;
      max-width: 480px;
      background: #ffffff;
      border-radius: 24px;
      box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04);
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }

    .header-banner {
      background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%);
      padding: 32px 24px;
      color: #ffffff;
      text-align: center;
      position: relative;
    }

    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 16px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .amount-display {
      font-size: 32px;
      font-weight: 800;
      margin-bottom: 4px;
      color: #ffffff;
      letter-spacing: -0.5px;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #22c55e;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 9999px;
      margin-top: 8px;
      text-transform: uppercase;
    }

    .content-body {
      padding: 28px 24px;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: #f8fafc;
      padding: 16px;
      border-radius: 16px;
      border: 1px solid #f1f5f9;
      margin-bottom: 24px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
      letter-spacing: 0.5px;
    }

    .meta-value {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      word-break: break-all;
    }

    .meta-value.highlight {
      color: #16a34a;
    }

    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 13px;
    }

    .details-table th {
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      padding: 8px 12px;
      background: #f1f5f9;
      letter-spacing: 0.5px;
    }

    .details-table th:last-child {
      text-align: right;
    }

    .details-table td {
      padding: 12px;
      border-bottom: 1px solid #f1f5f9;
    }

    .details-table td:last-child {
      text-align: right;
    }

    .trust-strip {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 14px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
    }

    .trust-strip-icon {
      width: 24px;
      height: 24px;
      background: #16a34a;
      color: #ffffff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
      flex-shrink: 0;
    }

    .trust-strip-text {
      font-size: 12px;
      color: #15803d;
      font-weight: 600;
      line-height: 1.4;
    }

    .action-bar {
      display: flex;
      gap: 12px;
    }

    .btn {
      flex: 1;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      border: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #4f46e5;
      color: #ffffff;
    }

    .btn-primary:hover {
      background: #4338ca;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #e2e8f0;
    }

    .btn-secondary:hover {
      background: #e2e8f0;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .receipt-card {
        box-shadow: none;
        border: none;
        max-width: 100%;
      }
      .action-bar {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-card">
    <div class="header-banner">
      <div class="brand-badge">⚡ LUMO Split Official Receipt</div>
      <div class="amount-display">${formattedAmount}</div>
      <p style="font-size: 13px; opacity: 0.9; font-weight: 600;">${escapeHtml(data.title)}</p>
      <div><span class="status-pill">✓ Payment Confirmed</span></div>
    </div>

    <div class="content-body">
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Transaction Ref</span>
          <span class="meta-value">${escapeHtml(txReference)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Bill Code</span>
          <span class="meta-value">${escapeHtml(data.refCode)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Date & Time</span>
          <span class="meta-value">${escapeHtml(dateStr)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Payment Method</span>
          <span class="meta-value">${escapeHtml(provider)}</span>
        </div>
        ${data.participantName ? `
        <div class="meta-item" style="grid-column: span 2;">
          <span class="meta-label">Payer Name</span>
          <span class="meta-value">${escapeHtml(data.participantName)}</span>
        </div>` : ''}
        <div class="meta-item" style="grid-column: span 2;">
          <span class="meta-label">Paid Directly To</span>
          <span class="meta-value highlight">✓ ${escapeHtml(merchant)}</span>
        </div>
      </div>

      ${formattedTotal && data.participants && data.participants.length > 0 ? `
      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Split Breakdown (Total ${formattedTotal})</h3>
        <table class="details-table">
          <thead>
            <tr>
              <th>Participant</th>
              <th style="text-align: right;">Share</th>
              <th style="text-align: right;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${participantRows}
          </tbody>
        </table>
      </div>` : ''}

      <div class="trust-strip">
        <div class="trust-strip-icon">✓</div>
        <div class="trust-strip-text">
          Direct settlement to verified merchant destination. LUMO never holds your funds.
        </div>
      </div>

      <div class="action-bar">
        <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function downloadColoredReceipt(data: ReceiptData) {
  const htmlContent = generateColoredReceiptHTML(data);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const fileName = `LUMO-Receipt-${(data.txRef || data.refCode).replace(/[^a-zA-Z0-9-]/g, '_')}.html`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
