import React, { useEffect, useState } from 'react';
import {
  Users,
  GitFork,
  CreditCard,
  Building2,
  AlertTriangle,
  Link as LinkIcon,
  LifeBuoy,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { DashboardStats } from '../types';

interface AdminDashboardScreenProps {
  token: string;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ token }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const headers: Record<string, string> = {};
      if (token.startsWith('Bearer ')) {
        headers['Authorization'] = token;
      } else {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-admin-key'] = token;
      }

      const res = await fetch('/api/admin/dashboard-stats', { headers });
      if (!res.ok) {
        throw new Error('Failed to load dashboard metrics');
      }

      const data = await res.json();
      setStats(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Error fetching metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Auto refresh every 60s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-indigo-500" />
        <span>Loading production metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold">
        {error}
      </div>
    );
  }

  const kpis = [
    {
      title: 'Total Registered Users',
      value: stats?.totalUsers.toLocaleString() || '0',
      subtitle: `${stats?.activeUsers || 0} active past 30 days`,
      icon: Users,
      color: 'indigo'
    },
    {
      title: 'Splits Created',
      value: stats?.splitsCreated.toLocaleString() || '0',
      subtitle: 'Total multi-participant splits',
      icon: GitFork,
      color: 'blue'
    },
    {
      title: 'Payments Today',
      value: stats?.paymentsToday.toLocaleString() || '0',
      subtitle: `${stats?.paymentsThisMonth || 0} this month`,
      icon: CreditCard,
      color: 'emerald'
    },
    {
      title: 'Total Volume Settled',
      value: `TZS ${(stats?.totalPaymentVolume || 0).toLocaleString()}`,
      subtitle: `${stats?.successfulPayments || 0} successful completed payments`,
      icon: TrendingUp,
      color: 'purple'
    },
    {
      title: 'Pending Settlements',
      value: stats?.pendingSettlements.toString() || '0',
      subtitle: 'Awaiting provider confirmation',
      icon: Building2,
      color: 'amber'
    },
    {
      title: 'Failed Payments',
      value: stats?.failedPayments.toString() || '0',
      subtitle: 'Require operational review',
      icon: AlertTriangle,
      color: 'rose'
    },
    {
      title: 'Active Payment Links',
      value: stats?.activePaymentLinks.toString() || '0',
      subtitle: 'Live public URLs',
      icon: LinkIcon,
      color: 'cyan'
    },
    {
      title: 'Open Support Tickets',
      value: stats?.openSupportIssues.toString() || '0',
      subtitle: 'Pending customer resolution',
      icon: LifeBuoy,
      color: 'teal'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
        <div>
          <h2 className="text-base font-extrabold text-white">Operations Centre Overview</h2>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            Last updated:{' '}
            <span className="font-mono text-slate-300">
              {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleTimeString() : 'Just now'}
            </span>
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={refreshing}
          className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-200 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Operations Data'}</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400">{kpi.title}</span>
                <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-xl font-black text-white tracking-tight">{kpi.value}</div>
                <div className="text-[11px] font-medium text-slate-500 mt-1">{kpi.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* System Operational Status */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
          Core Engine Operational Health
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">Destination Routing Engine</div>
              <div className="text-[10px] text-slate-400">Snapshot Integrity Active</div>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">Payment Providers</div>
              <div className="text-[10px] text-slate-400">Snippe & FimiPay Webhooks Operational</div>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">RBAC Security Layer</div>
              <div className="text-[10px] text-slate-400">Server-Side Permission Enforcement</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
