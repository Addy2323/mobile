import React from 'react';
import {
  LayoutDashboard,
  Users,
  GitFork,
  CreditCard,
  Building2,
  Link,
  ShieldCheck,
  Gift,
  HeartHandshake,
  Receipt,
  LifeBuoy,
  Scale,
  Activity,
  FileSpreadsheet,
  FileText,
  LogOut,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { AdminUser } from '../types';

interface AdminLayoutProps {
  admin: AdminUser;
  activeSection: string;
  onSelectSection: (section: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  admin,
  activeSection,
  onSelectSection,
  onLogout,
  children
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, category: 'Overview' },
    { id: 'users', label: 'Users', icon: Users, permission: 'users.view', category: 'Operations' },
    { id: 'splits', label: 'Splits', icon: GitFork, permission: 'splits.view', category: 'Operations' },
    { id: 'payments', label: 'Payments', icon: CreditCard, permission: 'payments.view', category: 'Operations' },
    { id: 'withdrawals', label: 'Withdrawal Approvals', icon: ArrowUpRight, permission: 'payments.view', category: 'Operations' },
    { id: 'settlements', label: 'Settlements', icon: Building2, permission: 'settlements.view', category: 'Operations' },
    { id: 'links', label: 'Payment Links', icon: Link, permission: 'payment_links.view', category: 'Operations' },
    { id: 'destinations', label: 'Destinations', icon: ShieldCheck, permission: 'destinations.view', category: 'Operations' },

    { id: 'pools', label: 'Birthday Pools', icon: Gift, permission: 'pools.view', category: 'Modules' },
    { id: 'michango', label: 'Michango & Events', icon: HeartHandshake, permission: 'michango.view', category: 'Modules' },
    { id: 'bills', label: 'Pay Bills', icon: Receipt, permission: 'bills.view', category: 'Modules' },

    { id: 'support', label: 'Support Centre', icon: LifeBuoy, permission: 'support.view', category: 'Support' },
    { id: 'reconciliation', label: 'Reconciliation', icon: Scale, permission: 'reports.view', category: 'Finance' },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet, permission: 'reports.view', category: 'Finance' },

    { id: 'providers', label: 'Providers & System', icon: Activity, permission: 'providers.view', category: 'System' },
    { id: 'audit', label: 'Audit Logs', icon: FileText, permission: 'audit_logs.view', category: 'System' }
  ];

  const hasPermission = (itemPerm?: string) => {
    if (!itemPerm) return true;
    if (admin.role === 'SUPER_ADMIN' || admin.permissions.includes('*')) return true;
    return admin.permissions.includes(itemPerm);
  };

  const categories = ['Overview', 'Operations', 'Modules', 'Support', 'Finance', 'System'];

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-4 flex-shrink-0">
        <div>
          {/* Logo & Environment */}
          <div className="flex items-center space-x-3 px-2 py-3 border-b border-slate-800 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-700 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-indigo-500/30">
              L
            </div>
            <div>
              <div className="font-extrabold text-white text-base tracking-tight leading-none">
                LUMO Admin
              </div>
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ops Centre
              </div>
            </div>
          </div>

          {/* Nav Items grouped by category */}
          <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-180px)] pr-1 custom-scrollbar">
            {categories.map((cat) => {
              const catItems = navItems.filter((i) => i.category === cat && hasPermission(i.permission));
              if (catItems.length === 0) return null;
              return (
                <div key={cat} className="space-y-1">
                  <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {cat}
                  </div>
                  {catItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectSection(item.id)}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* User Badge & Logout */}
        <div className="border-t border-slate-800 pt-3">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900/80 mb-2">
            <div className="truncate">
              <div className="text-xs font-bold text-slate-200 truncate">{admin.fullName}</div>
              <div className="text-[10px] text-indigo-400 font-mono font-semibold uppercase">
                {admin.role.replace('_', ' ')}
              </div>
            </div>
            <ShieldAlert className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 border border-rose-900/30 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Staff</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-950/60 backdrop-blur flex-shrink-0">
          <div className="flex items-center space-x-3">
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">
              {navItems.find((n) => n.id === activeSection)?.label || 'Admin Centre'}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-[11px] text-slate-400 bg-slate-900 px-3 py-1 rounded-md border border-slate-800 font-mono">
              ENV: <span className="text-emerald-400 font-bold">PRODUCTION</span>
            </div>
          </div>
        </header>

        {/* Dynamic Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
};
