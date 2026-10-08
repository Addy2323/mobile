// Provider Capability Matrix & Destination Eligibility Service
import pg from 'pg';

export class ProviderCapabilityService {
  static matrix = [
    { provider: 'SNIPPE', operation: 'COLLECT', destination_type: 'PHONE', enabled: true },
    { provider: 'SNIPPE', operation: 'PAYOUT', destination_type: 'PHONE', enabled: true },
    { provider: 'SNIPPE', operation: 'DIRECT_SETTLEMENT', destination_type: 'PHONE', enabled: true },
    { provider: 'SNIPPE', operation: 'COLLECT', destination_type: 'BANK_ACCOUNT', enabled: true },
    { provider: 'SNIPPE', operation: 'PAYOUT', destination_type: 'BANK_ACCOUNT', enabled: true },
    { provider: 'FIMIPAY', operation: 'COLLECT', destination_type: 'PHONE', enabled: true },
    { provider: 'FIMIPAY', operation: 'COLLECT', destination_type: 'LIPA_NUMBER', enabled: true },
    { provider: 'FIMIPAY', operation: 'PAYOUT', destination_type: 'PHONE', enabled: true },
    { provider: 'FIMIPAY', operation: 'DIRECT_SETTLEMENT', destination_type: 'PHONE', enabled: true },
  ];

  static async isCapabilitySupported(provider, operation, destinationType, pool = null) {
    if (!destinationType) return true; // Default collection fallback
    const prov = (provider || 'SNIPPE').toUpperCase();
    const op = (operation || 'COLLECT').toUpperCase();
    const dest = (destinationType || 'PHONE').toUpperCase();

    if (pool) {
      try {
        const { rows } = await pool.query(
          `SELECT enabled FROM provider_capabilities 
           WHERE UPPER(provider) = $1 AND UPPER(operation) = $2 AND UPPER(destination_type) = $3`,
          [prov, op, dest]
        );
        if (rows.length > 0) return rows[0].enabled;
      } catch (err) {
        console.warn('⚠️ DB ProviderCapability lookup error, falling back to static matrix:', err.message);
      }
    }

    const match = this.matrix.find(
      (m) => m.provider === prov && m.operation === op && m.destination_type === dest
    );
    return match ? match.enabled : false;
  }

  static async validateDestinationSupport(destination, operation = 'DIRECT_SETTLEMENT', provider = 'SNIPPE', pool = null) {
    if (!destination) {
      return { supported: true, note: 'Default platform collection' };
    }

    const destType = (destination.type || 'PHONE').toUpperCase();
    const supported = await this.isCapabilitySupported(provider, operation, destType, pool);

    if (!supported) {
      return {
        supported: false,
        error: `This destination (${destType}) cannot currently receive automated ${operation.toLowerCase()} through the connected payment provider (${provider}). Please choose another supported destination.`
      };
    }

    return { supported: true };
  }
}
