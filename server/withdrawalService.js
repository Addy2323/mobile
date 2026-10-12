// LUMO Split - Authoritative Withdrawal Calculation & Financial Isolation Service

export const WITHDRAWAL_CONFIG = {
  version: '2026.1.0',
  currency: 'TZS',
  minWithdrawalAmount: 1000, // Minimum withdrawal amount
  maxWithdrawalAmount: 10000000, // Maximum single withdrawal amount (10M TZS)
  // Configured Tiered Fee Schedule
  feeTiers: [
    { min: 1, max: 50000, rate: 0.05, label: '5.0%' },
    { min: 50001, max: 200000, rate: 0.045, label: '4.5%' },
    { min: 200001, max: 1000000, rate: 0.02, label: '2.0%' },
    { min: 1000001, max: 5000000, rate: 0.015, label: '1.5%' },
    { min: 5000001, max: Infinity, rate: 0.01, label: '1.0%' }
  ]
};

export class WithdrawalService {
  /**
   * Determine fee tier based on user-requested withdrawal amount
   */
  static getFeeTier(requestedAmount) {
    const amount = Number(requestedAmount);
    for (const tier of WITHDRAWAL_CONFIG.feeTiers) {
      if (amount >= tier.min && amount <= tier.max) {
        return tier;
      }
    }
    return WITHDRAWAL_CONFIG.feeTiers[0];
  }

  /**
   * Authoritatively calculate financial breakdown for a withdrawal request.
   * NON-NEGOTIABLE PRINCIPLE:
   * - requestedAmount is the SOLE base amount reserved from available balance.
   * - fee is calculated from requestedAmount.
   * - netPayout is the amount disbursed to recipient (requestedAmount - fee).
   * - availableBalance is NEVER substituted as the withdrawal amount.
   */
  static calculateWithdrawalFinancials(requestedAmount, availableBalance = null) {
    const numAmount = Number(requestedAmount);

    if (isNaN(numAmount) || !Number.isFinite(numAmount) || numAmount <= 0) {
      throw new Error('Withdrawal amount must be a valid positive number.');
    }

    if (numAmount < WITHDRAWAL_CONFIG.minWithdrawalAmount) {
      throw new Error(
        `Withdrawal amount must be at least TZS ${WITHDRAWAL_CONFIG.minWithdrawalAmount.toLocaleString()}.`
      );
    }

    if (numAmount > WITHDRAWAL_CONFIG.maxWithdrawalAmount) {
      throw new Error(
        `Withdrawal amount exceeds maximum limit of TZS ${WITHDRAWAL_CONFIG.maxWithdrawalAmount.toLocaleString()}.`
      );
    }

    if (availableBalance !== null) {
      const numAvailable = Number(availableBalance);
      if (numAvailable < numAmount) {
        throw new Error(
          `Insufficient available balance. Available: TZS ${numAvailable.toLocaleString()}, Requested: TZS ${numAmount.toLocaleString()}.`
        );
      }
    }

    const tier = this.getFeeTier(numAmount);
    const feeAmount = Math.round(numAmount * tier.rate);
    const netPayout = Math.max(0, numAmount - feeAmount);

    return {
      requestedAmount: numAmount,
      feeAmount,
      netPayout,
      tierRate: tier.rate,
      tierLabel: tier.label,
      currency: WITHDRAWAL_CONFIG.currency,
      configVersion: WITHDRAWAL_CONFIG.version,
      // Clear demonstration of financial impact on balance
      amountToReserve: numAmount,
      remainingAvailableBalance: availableBalance !== null ? Number(availableBalance) - numAmount : null
    };
  }

  /**
   * Validate destination parameters
   */
  static validateDestination(destinationType, destinationDetails) {
    const type = (destinationType || '').toUpperCase();
    if (!['MOBILE_MONEY', 'BANK'].includes(type)) {
      throw new Error('Invalid destination type. Must be MOBILE_MONEY or BANK.');
    }

    if (!destinationDetails || typeof destinationDetails !== 'object') {
      throw new Error('Destination details are required.');
    }

    if (type === 'MOBILE_MONEY') {
      const phone = destinationDetails.phone || destinationDetails.phoneNumber;
      if (!phone || String(phone).replace(/[^\d]/g, '').length < 9) {
        throw new Error('Valid mobile phone number is required for mobile money payout.');
      }
    } else if (type === 'BANK') {
      const account = destinationDetails.accountNumber || destinationDetails.account;
      const bank = destinationDetails.bankName || destinationDetails.bank;
      if (!account || !bank) {
        throw new Error('Bank name and account number are required for bank payout.');
      }
    }

    return true;
  }
}
