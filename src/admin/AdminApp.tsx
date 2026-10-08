import React, { useState, useEffect } from 'react';
import { AdminLayout } from './components/AdminLayout';
import { AdminLoginScreen } from './screens/AdminLoginScreen';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen';
import { AdminUsersScreen } from './screens/AdminUsersScreen';
import {
  AdminSplitsScreen,
  AdminPaymentsScreen,
  AdminSettlementsScreen,
  AdminPaymentLinksScreen,
  AdminDestinationsScreen
} from './screens/AdminOperationsScreens';
import {
  AdminPoolsScreen,
  AdminMichangoScreen,
  AdminBillsScreen,
  AdminSupportScreen,
  AdminReconciliationScreen,
  AdminProvidersScreen,
  AdminReportsScreen,
  AdminAuditLogsScreen
} from './screens/AdminModulesScreens';
import { AdminUser } from './types';

export const AdminApp: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('lumo_admin_token'));
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    const saved = sessionStorage.getItem('lumo_admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeSection, setActiveSection] = useState('dashboard');

  const handleLoginSuccess = (newToken: string, newAdmin: AdminUser) => {
    setToken(newToken);
    setAdmin(newAdmin);
    sessionStorage.setItem('lumo_admin_token', newToken);
    sessionStorage.setItem('lumo_admin_user', JSON.stringify(newAdmin));
  };

  const handleLogout = () => {
    setToken(null);
    setAdmin(null);
    sessionStorage.removeItem('lumo_admin_token');
    sessionStorage.removeItem('lumo_admin_user');
  };

  if (!token || !admin) {
    return <AdminLoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <AdminLayout
      admin={admin}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onLogout={handleLogout}
    >
      {activeSection === 'dashboard' && <AdminDashboardScreen token={token} />}
      {activeSection === 'users' && <AdminUsersScreen token={token} />}
      {activeSection === 'splits' && <AdminSplitsScreen token={token} />}
      {activeSection === 'payments' && <AdminPaymentsScreen token={token} />}
      {activeSection === 'settlements' && <AdminSettlementsScreen token={token} />}
      {activeSection === 'links' && <AdminPaymentLinksScreen token={token} />}
      {activeSection === 'destinations' && <AdminDestinationsScreen token={token} />}
      {activeSection === 'pools' && <AdminPoolsScreen token={token} />}
      {activeSection === 'michango' && <AdminMichangoScreen token={token} />}
      {activeSection === 'bills' && <AdminBillsScreen token={token} />}
      {activeSection === 'support' && <AdminSupportScreen token={token} />}
      {activeSection === 'reconciliation' && <AdminReconciliationScreen token={token} />}
      {activeSection === 'reports' && <AdminReportsScreen token={token} />}
      {activeSection === 'providers' && <AdminProvidersScreen token={token} />}
      {activeSection === 'audit' && <AdminAuditLogsScreen token={token} />}
    </AdminLayout>
  );
};
