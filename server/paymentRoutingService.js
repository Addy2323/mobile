// LUMO Split - Reusable Payment Routing Service & Provider Capability Engine

export class ProviderCapabilityService {
  /**
   * Check if a provider supports automated payouts for a specific destination type
   */
  static isPayoutSupported(provider = 'SNIPPE', destinationType) {
    let p = String(provider).toUpperCase();
    if (['MOBILE_MONEY', 'LIPA_NAMBA', 'DEFAULT', 'PHONE'].includes(p)) p = 'SNIPPE';
    const type = String(destinationType).toUpperCase();

    if (p === 'SNIPPE') {
      switch (type) {
        case 'PHONE':
        case 'MOBILE_MONEY':
        case 'BANK_ACCOUNT':
          return true;
        case 'LIPA_NUMBER':
        case 'QR':
        case 'CARD':
        default:
          return false;
      }
    }

    if (p === 'FIMIPAY') {
      return type === 'PHONE' || type === 'MOBILE_MONEY';
    }

    return false;
  }

  /**
   * Check if a provider supports a specific payment collection method
   */
  static isCollectionSupported(provider = 'SNIPPE', paymentMethod) {
    let p = String(provider).toUpperCase();
    if (['MOBILE_MONEY', 'DEFAULT'].includes(p)) p = 'SNIPPE';
    const m = String(paymentMethod).toLowerCase();

    if (p === 'SNIPPE') {
      return ['mobile', 'mobile_money', 'mpesa', 'airtel', 'mixx', 'halopesa'].includes(m);
    }

    if (p === 'FIMIPAY') {
      return ['mobile', 'card', 'bank'].includes(m);
    }

    return true;
  }

  /**
   * Validate destination capability and throw user-friendly error if unsupported
   */
  static validateDestinationCapability(provider = 'SNIPPE', destinationData) {
    const type = (destinationData?.type || 'PHONE').toUpperCase();
    const supported = this.isPayoutSupported(provider, type);

    if (!supported) {
      if (['LIPA_NUMBER', 'QR', 'CARD'].includes(type)) {
        throw new Error(`The selected payment destination (${type}) is not currently supported for automated payout disbursement via ${provider}. Please select a Mobile Money or Bank Account destination.`);
      }
      throw new Error(`Destination type ${type} is unsupported by provider ${provider}.`);
    }

    return true;
  }
}

export class PaymentRoutingService {
  /**
   * Validate destination parameters according to strict payment rules.
   */
  static validateDestination(data, options = {}) {
    const { type, provider, phone_number, lipa_number, bank_name, account_number, beneficiary_full_name } = data;

    if (!type) {
      throw new Error('Destination type is required.');
    }

    const validTypes = ['PHONE', 'LIPA_NUMBER', 'BANK_ACCOUNT', 'QR', 'CARD', 'VERIFIED_MERCHANT'];
    if (!validTypes.includes(type.toUpperCase())) {
      throw new Error(`Unsupported payment destination type: ${type}. Must be one of ${validTypes.join(', ')}`);
    }

    // Explicit capability check if requested during payout dispatch
    if (options.checkCapability) {
      ProviderCapabilityService.validateDestinationCapability(provider || 'SNIPPE', data);
    }

    switch (type.toUpperCase()) {
      case 'PHONE':
        if (!phone_number) throw new Error('Phone number is required for PHONE destination.');
        let cleanPhone = phone_number.replace(/\s+/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '+255' + cleanPhone.slice(1);
        return { ...data, phone_number: cleanPhone };

      case 'LIPA_NUMBER':
        if (!lipa_number || !lipa_number.trim()) {
          throw new Error('Lipa number is required for LIPA_NUMBER destination.');
        }
        return { ...data, lipa_number: lipa_number.trim() };

      case 'BANK_ACCOUNT':
        if (!bank_name || !['NMB', 'CRDB', 'OTHER_BANK', 'NBC', 'ABSA'].includes(bank_name.toUpperCase())) {
          throw new Error('Supported bank (NMB, CRDB, etc.) is required for BANK_ACCOUNT destination.');
        }
        if (!account_number || !account_number.trim()) {
          throw new Error('Account number is required for BANK_ACCOUNT destination.');
        }
        return {
          ...data,
          bank_name: bank_name.toUpperCase(),
          account_number: account_number.trim(),
          beneficiary_full_name: (beneficiary_full_name || 'Verified Recipient').trim()
        };

      case 'QR':
        if (!data.qr_reference && !data.metadata?.qr_payload) {
          throw new Error('Valid QR reference or payload is required.');
        }
        return data;

      case 'CARD':
        if (data.cvv || data.card_number) {
          throw new Error('Raw card numbers or CVVs must never be sent to or stored in backend destinations.');
        }
        return data;

      default:
        return data;
    }
  }

  /**
   * Create an immutable snapshot of destination details at time of resource creation.
   */
  static createSnapshot(destination) {
    if (!destination) {
      return {
        enabled: false,
        destinationId: null,
        type: 'DEFAULT_FALLBACK',
        provider: 'SNIPPE_LUMO_DEFAULT',
        displayName: 'LUMO Platform Collection Account',
        maskedValue: 'Default Collection Account',
        beneficiaryName: 'LUMO Split Collection',
        isFallback: true,
        createdAt: new Date().toISOString()
      };
    }

    const type = (destination.type || 'PHONE').toUpperCase();
    let maskedValue = '';
    let beneficiaryName = destination.beneficiary_full_name || destination.display_name || 'Verified Recipient';

    if (type === 'PHONE') {
      const p = destination.phone_number || '';
      maskedValue = p.length >= 7 ? `${p.slice(0, 4)} XXX XXX ${p.slice(-3)}` : p;
    } else if (type === 'LIPA_NUMBER') {
      maskedValue = `Lipa ${destination.lipa_number || ''}`;
    } else if (type === 'BANK_ACCOUNT') {
      const acc = destination.account_number || '';
      const last4 = acc.slice(-4);
      maskedValue = `••••${last4}`;
    } else if (type === 'QR') {
      maskedValue = `QR Reference ${destination.qr_reference || 'Configured'}`;
    } else if (type === 'CARD') {
      maskedValue = `Card Destination Reference ${destination.card_reference || 'Configured'}`;
    }

    return {
      id: destination.id || 'dest_123',
      enabled: true,
      destinationId: destination.id || 'dest_123',
      type: type,
      provider: destination.provider || 'SNIPPE',
      bankName: destination.bank_name || null,
      accountNumberMasked: maskedValue,
      phoneNumber: destination.phone_number || null,
      lipaNumber: destination.lipa_number || null,
      beneficiaryName: beneficiaryName,
      displayName: destination.display_name || beneficiaryName,
      isVerified: destination.is_verified ?? true,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Calculate link expiration date based on expiration rule.
   */
  static calculateExpirationDate(mode) {
    const now = new Date();
    if (mode === '24_HOURS') {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    } else if (mode === '7_DAYS') {
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (mode === '30_DAYS') {
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    return null;
  }

  /**
   * Evaluate payment link status and expiration.
   */
  static evaluateLinkStatus(link) {
    if (!link) return { isValid: false, error: 'Link not found' };

    if (link.expiration_mode === 'AFTER_PAYMENT' && link.status === 'PAID') {
      return { isValid: false, error: 'This payment link has already been used.' };
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return { isValid: false, error: 'This payment link has expired.' };
    }

    if (link.status === 'CANCELLED' || link.status === 'EXPIRED') {
      return { isValid: false, error: `This payment link is ${link.status.toLowerCase()}.` };
    }

    return { isValid: true, status: 'ACTIVE' };
  }

  /**
   * Determine settlement routing status for a confirmed payment.
   */
  static determineSettlementStatus(providerResponse, snapshot) {
    if (!snapshot || snapshot.isFallback) {
      return {
        settlementStatus: 'SETTLED',
        settlementNote: 'Collected via default LUMO/Snippe collection account.'
      };
    }

    if (providerResponse && providerResponse.payoutConfirmed) {
      return {
        settlementStatus: 'SETTLED',
        settlementNote: `Settled to ${snapshot.displayName} (${snapshot.accountNumberMasked})`
      };
    }

    return {
      settlementStatus: 'SETTLEMENT_PENDING',
      settlementNote: `Payment received. Settlement to ${snapshot.displayName} (${snapshot.accountNumberMasked}) is processing.`
    };
  }
}
