export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'OPERATIONS_ADMIN' | 'FINANCE_ADMIN' | 'SUPPORT_ADMIN' | 'ANALYST';
  permissions: string[];
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  splitsCreated: number;
  paymentsToday: number;
  paymentsThisMonth: number;
  totalPaymentVolume: number;
  successfulPayments: number;
  failedPayments: number;
  pendingSettlements: number;
  activePaymentLinks: number;
  openSupportIssues: number;
  lastUpdated: string;
}

export interface UserRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED' | 'PENDING';
  created_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_name: string;
  user_phone?: string;
  user_email?: string;
  title: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'RESOLVED' | 'CLOSED';
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  admin_email: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  before_state?: any;
  after_state?: any;
  ip_address?: string;
  created_at: string;
}
