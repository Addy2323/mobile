import React from 'react';
import { WalletScreen } from './WalletScreen';
import { type Language } from '@/lib/i18n';

interface RewardsScreenProps {
  language: Language;
}

export const RewardsScreen: React.FC<RewardsScreenProps> = (props) => {
  return <WalletScreen {...props} />;
};

export default RewardsScreen;

