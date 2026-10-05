export type Language = 'en' | 'sw';

export const translations = {
  en: {
    dashboard: 'Dashboard',
    controlNumbers: 'Control Numbers',
    createSplit: 'Create Split',
    activeSplits: 'Active Splits',
    merchants: 'Merchants',
    operations: 'Operations',
    more: 'More',
    comingSoon: 'Coming soon',
    peopleTotal: 'People total',
    confirmedContributions: 'Confirmed contributions',
    recordedPayments: 'Recorded payments, not a wallet balance',
    confirmedPayments: 'Confirmed payments across split bills',
  },
  sw: {
    dashboard: 'Dashibodi',
    controlNumbers: 'Namba za malipo',
    createSplit: 'Unda mgawanyo',
    activeSplits: 'Migawanyo hai',
    merchants: 'Wafanyabiashara',
    operations: 'Uendeshaji',
    more: 'Zaidi',
    comingSoon: 'Inakuja hivi karibuni',
    peopleTotal: 'Jumla ya watu',
    confirmedContributions: 'Michango iliyothibitishwa',
    recordedPayments: 'Malipo yaliyorekodiwa, si salio la pochi',
    confirmedPayments: 'Malipo yaliyothibitishwa katika migawanyo',
  },
} as const;
