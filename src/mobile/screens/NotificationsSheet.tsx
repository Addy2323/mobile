import React from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { Bell, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { getTranslation, type Language } from '@/lib/i18n';

interface NotificationsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const NotificationsSheet: React.FC<NotificationsSheetProps> = ({ isOpen, onClose, language }) => {
  const t = (key: any) => getTranslation(key, language);

  const notifications = [
    {
      id: '1',
      title: 'Payment Received',
      body: 'Kelvin paid TZS 30,000 for Dinner at The View.',
      time: '10m ago',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-50',
    },
    {
      id: '2',
      title: 'Split Reminded',
      body: 'Automated reminder sent to 3 participants.',
      time: '1h ago',
      icon: <Clock className="w-5 h-5 text-amber-600" />,
      bg: 'bg-amber-50',
    },
    {
      id: '3',
      title: 'Direct Settlement',
      body: 'Paid directly to Lipa Namba 1234567.',
      time: '3h ago',
      icon: <ShieldCheck className="w-5 h-5 text-indigo-600" />,
      bg: 'bg-indigo-50',
    },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t('notifications')}>
      <div className="space-y-3 pt-1">
        {notifications.map((n) => (
          <div key={n.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-start space-x-3">
            <div className={`p-2.5 rounded-xl ${n.bg} flex-shrink-0`}>{n.icon}</div>
            <div className="flex-1 space-y-0.5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-xs">{n.title}</h4>
                <span className="text-[10px] text-slate-400">{n.time}</span>
              </div>
              <p className="text-xs text-slate-600 leading-snug">{n.body}</p>
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
};
