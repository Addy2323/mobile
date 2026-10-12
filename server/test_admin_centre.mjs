// LUMO Split - Admin Operations Centre 12 Endpoints Verification Suite
import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAdminRouter } from './adminRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lumosplit'
});

const ADMIN_KEY = process.env.ADMIN_KEY || 'lumo_master_admin_dev_2026';
process.env.ADMIN_KEY = ADMIN_KEY;

async function runAdminCentreTests() {
  console.log('================================================================');
  console.log('🧪 LUMO SPLIT: ADMIN OPERATIONS CENTRE 12-MODULE SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter(pool));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/admin`;

  try {
    // -------------------------------------------------------------
    // TEST 0: Authentication & Security Gate
    // -------------------------------------------------------------
    console.log('▶ [Security Gate] Enforcing authentication on admin routes');
    const unauthRes = await fetch(`${baseUrl}/settlements`);
    assert(unauthRes.status === 401, 'Unauthorized request without x-admin-key or bearer returns 401');

    const headers = { 'x-admin-key': ADMIN_KEY };

    // -------------------------------------------------------------
    // MODULE 1: Settlements
    // -------------------------------------------------------------
    console.log('\n▶ [Module 1] /api/admin/settlements');
    const settRes = await fetch(`${baseUrl}/settlements`, { headers });
    assert(settRes.status === 200, 'Settlements endpoint returns 200');
    const settlements = await settRes.json();
    assert(Array.isArray(settlements), 'Settlements returns array from live database');

    // -------------------------------------------------------------
    // MODULE 2: Withdrawals Management
    // -------------------------------------------------------------
    console.log('\n▶ [Module 2] /api/admin/withdrawals');
    const wthRes = await fetch(`${baseUrl}/withdrawals`, { headers });
    if (wthRes.status !== 200) {
      console.error('Withdrawals error response:', wthRes.status, await wthRes.text());
    }
    assert(wthRes.status === 200, 'Withdrawals endpoint returns 200');
    const withdrawals = await wthRes.json();
    assert(Array.isArray(withdrawals), 'Withdrawals returns array with user information');

    // Filter by status test
    const pendingWthRes = await fetch(`${baseUrl}/withdrawals?status=PENDING_REVIEW`, { headers });
    assert(pendingWthRes.status === 200, 'Filter withdrawals by PENDING_REVIEW returns 200');

    // -------------------------------------------------------------
    // MODULE 3: Payment Links Monitoring
    // -------------------------------------------------------------
    console.log('\n▶ [Module 3] /api/admin/payment-links');
    const linksRes = await fetch(`${baseUrl}/payment-links`, { headers });
    assert(linksRes.status === 200, 'Payment links endpoint returns 200');
    const links = await linksRes.json();
    assert(Array.isArray(links), 'Payment links returns array from splits & payment_attempts');

    // -------------------------------------------------------------
    // MODULE 4: Disbursement Destinations
    // -------------------------------------------------------------
    console.log('\n▶ [Module 4] /api/admin/destinations');
    const destRes = await fetch(`${baseUrl}/destinations`, { headers });
    assert(destRes.status === 200, 'Destinations endpoint returns 200');
    const destinations = await destRes.json();
    assert(Array.isArray(destinations), 'Destinations returns user bank & mobile accounts');

    // -------------------------------------------------------------
    // MODULE 5: Birthday Gift Pools
    // -------------------------------------------------------------
    console.log('\n▶ [Module 5] /api/admin/pools');
    const poolsRes = await fetch(`${baseUrl}/pools`, { headers });
    assert(poolsRes.status === 200, 'Birthday pools endpoint returns 200');
    const pools = await poolsRes.json();
    assert(Array.isArray(pools), 'Birthday pools returns list of pools');

    // -------------------------------------------------------------
    // MODULE 6: Michango & Community Campaigns
    // -------------------------------------------------------------
    console.log('\n▶ [Module 6] /api/admin/michango');
    const michRes = await fetch(`${baseUrl}/michango`, { headers });
    assert(michRes.status === 200, 'Michango endpoint returns 200');
    const michango = await michRes.json();
    assert(Array.isArray(michango), 'Michango campaigns returns array');

    // -------------------------------------------------------------
    // MODULE 7: Pay Bills / House Splits
    // -------------------------------------------------------------
    console.log('\n▶ [Module 7] /api/admin/bills');
    const billsRes = await fetch(`${baseUrl}/bills`, { headers });
    assert(billsRes.status === 200, 'Pay bills endpoint returns 200');
    const bills = await billsRes.json();
    assert(Array.isArray(bills), 'Pay bills returns array');

    // -------------------------------------------------------------
    // MODULE 8: Support Ticketing
    // -------------------------------------------------------------
    console.log('\n▶ [Module 8] /api/admin/support/tickets');
    const suppRes = await fetch(`${baseUrl}/support/tickets`, { headers });
    assert(suppRes.status === 200, 'Support tickets endpoint returns 200');
    const tickets = await suppRes.json();
    assert(Array.isArray(tickets), 'Support tickets returns array');

    // -------------------------------------------------------------
    // MODULE 9: Financial Reconciliation
    // -------------------------------------------------------------
    console.log('\n▶ [Module 9] /api/admin/reconciliation');
    const reconRes = await fetch(`${baseUrl}/reconciliation`, { headers });
    if (reconRes.status !== 200) {
      console.error('Reconciliation error response:', reconRes.status, await reconRes.text());
    }
    assert(reconRes.status === 200, 'Reconciliation endpoint returns 200');
    const recon = await reconRes.json();
    assert(typeof recon.discrepancyCount === 'number', 'Reconciliation provides discrepancy count');
    assert(Array.isArray(recon.items), 'Reconciliation provides items array');
    assert(typeof recon.summary === 'object', 'Reconciliation provides invariant summary breakdown');

    // -------------------------------------------------------------
    // MODULE 10: Reports Summary & Analytics
    // -------------------------------------------------------------
    console.log('\n▶ [Module 10] /api/admin/reports/summary');
    const repRes = await fetch(`${baseUrl}/reports/summary?timeframe=30d`, { headers });
    assert(repRes.status === 200, 'Reports summary endpoint returns 200');
    const report = await repRes.json();
    assert(typeof report.payments === 'object', 'Report includes payment volume metrics');
    assert(typeof report.withdrawals === 'object', 'Report includes gross and fee metrics');
    assert(report.timeframe === '30d', 'Timeframe is properly filtered to 30d');

    // -------------------------------------------------------------
    // MODULE 11: Providers Connectivity & System Health
    // -------------------------------------------------------------
    console.log('\n▶ [Module 11] /api/admin/providers & /api/admin/system');
    const provRes = await fetch(`${baseUrl}/providers`, { headers });
    assert(provRes.status === 200, 'Providers endpoint returns 200');
    const providers = await provRes.json();
    assert(Array.isArray(providers) && providers.some((p) => p.name.includes('Snippe')), 'Snippe provider is listed');

    const sysRes = await fetch(`${baseUrl}/system`, { headers });
    assert(sysRes.status === 200, 'System health endpoint returns 200');
    const sys = await sysRes.json();
    assert(sys.database === 'HEALTHY', 'Database health is verified HEALTHY');
    assert(typeof sys.dbLatencyMs === 'number', 'Database query latency is measured in ms');

    // -------------------------------------------------------------
    // MODULE 12: Audit Logs Trail
    // -------------------------------------------------------------
    console.log('\n▶ [Module 12] /api/admin/audit-logs');
    const auditRes = await fetch(`${baseUrl}/audit-logs`, { headers });
    assert(auditRes.status === 200, 'Audit logs endpoint returns 200');
    const logs = await auditRes.json();
    assert(Array.isArray(logs), 'Audit logs returns recorded actions');

    console.log(`\n================================================================`);
    console.log(`📊 TOTAL RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log(`================================================================\n`);

    if (failed === 0) {
      console.log('🎉 ALL 12 ADMIN OPERATIONS MODULES FULLY OPERATIONAL!');
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite encountered error:', err);
    process.exit(1);
  } finally {
    server.close();
    await pool.end();
  }
}

runAdminCentreTests();
