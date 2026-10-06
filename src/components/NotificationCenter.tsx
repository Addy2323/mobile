import { useState } from 'react';
import { Bell, Check, CheckCircle2, AlertTriangle, Send, PartyPopper, X, Filter } from 'lucide-react';
import { formatDateTime, formatMoney } from '@/lib/utils';

export type AppNotification = {
  id: string;
  type: 'payment_received' | 'payment_failed' | 'reminder_sent' | 'split_settled';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  amount?: number;
  ref_code?: string;
};

const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    type: 'payment_received',
    title: 'Payment Received',
    message: 'Kelvin paid their TZS 30,000 share via M-Pesa.',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    read: false,
    amount: 30000,
    ref_code: 'LUMO-8821'
  },
  {
    id: 'n2',
    type: 'split_settled',
    title: 'Split Settled!',
    message: 'Samaki Samaki Dinner (TZS 120,000) is 100% settled.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    read: false,
    amount: 120000,
    ref_code: 'LUMO-3941'
  },
  {
    id: 'n3',
    type: 'reminder_sent',
    title: 'Reminders Dispatched',
    message: 'SMS payment reminders sent to 2 pending participants.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    read: true,
    ref_code: 'LUMO-7712'
  },
  {
    id: 'n4',
    type: 'payment_failed',
    title: 'Payment Attempt Failed',
    message: 'M-Pesa transaction timed out for participant Amina.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read: true,
    amount: 25000,
    ref_code: 'LUMO-1029'
  }
];

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(DEFAULT_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredList = notifications.filter((n) => (filter === 'unread' ? !n.read : true));

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markSingleRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  function deleteNotification(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'payment_received':
        return <CheckCircle2 className="h-4 w-4 text-success-600" />;
      case 'split_settled':
        return <PartyPopper className="h-4 w-4 text-purple-600" />;
      case 'reminder_sent':
        return <Send className="h-4 w-4 text-amber-600" />;
      case 'payment_failed':
        return <AlertTriangle className="h-4 w-4 text-error-600" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-full border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-500 text-[10px] font-extrabold text-white shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-slate-700" />
                <h3 className="text-sm font-extrabold text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex border-b border-slate-100 px-4 py-2 text-xs font-bold text-slate-500">
              <button
                onClick={() => setFilter('all')}
                className={`mr-4 border-b-2 pb-1 transition ${
                  filter === 'all' ? 'border-primary-600 text-primary-600' : 'border-transparent hover:text-slate-700'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`border-b-2 pb-1 transition ${
                  filter === 'unread' ? 'border-primary-600 text-primary-600' : 'border-transparent hover:text-slate-700'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <Filter className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  No {filter === 'unread' ? 'unread ' : ''}notifications
                </div>
              ) : (
                filteredList.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markSingleRead(n.id)}
                    className={`group flex items-start gap-3 p-3.5 transition cursor-pointer hover:bg-slate-50 ${
                      !n.read ? 'bg-primary-50/30' : ''
                    }`}
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      {getIcon(n.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900">{n.title}</p>
                        <span className="text-[10px] text-slate-400">{formatDateTime(n.timestamp)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600 leading-snug">{n.message}</p>
                      {n.amount && (
                        <span className="mt-1 inline-block text-[11px] font-bold text-success-600">
                          {formatMoney(n.amount)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-slate-600 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
