import { URL } from 'url';

export class ApplicationIntegrationService {
  /**
   * Fetch integration configuration by applicationKey or website domain
   */
  static async getIntegrationByKey(pool, applicationKey = 'lumo-split') {
    const key = (applicationKey || 'lumo-split').trim().toLowerCase();
    
    try {
      const { rows } = await pool.query(
        'SELECT * FROM application_integrations WHERE LOWER(application_key) = $1 AND is_active = true',
        [key]
      );

      if (rows.length > 0) {
        return this.formatIntegration(rows[0]);
      }

      // Fallback lookup by domain if key not directly matched
      const domainRes = await pool.query(
        'SELECT * FROM application_integrations WHERE (LOWER(website_domain) = $1 OR LOWER(website_domain) LIKE $2) AND is_active = true LIMIT 1',
        [key, `%${key}%`]
      );

      if (domainRes.rows.length > 0) {
        return this.formatIntegration(domainRes.rows[0]);
      }
    } catch (err) {
      console.warn('[ApplicationIntegrationService] DB lookup warning:', err.message);
    }

    // Default fallback to LUMO Split platform configuration
    const defaultWebhookUrl = (process.env.SNIPPE_WEBHOOK_URL || 'https://lumo.co.tz/api/webhooks/snippe').trim();
    return {
      id: 'default_lumo',
      applicationKey: 'lumo-split',
      displayName: 'LUMO Split',
      websiteDomain: 'lumo.co.tz',
      webhookUrl: defaultWebhookUrl,
      redirectUrl: 'https://lumo.co.tz',
      isActive: true
    };
  }

  /**
   * Validate trusted webhook URL to prevent SSRF and payment routing hijack.
   */
  static validateWebhookUrl(webhookUrl) {
    if (!webhookUrl || typeof webhookUrl !== 'string') {
      throw new Error('Invalid webhook URL format.');
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(webhookUrl.trim());
    } catch {
      throw new Error(`Invalid webhook URL structure: ${webhookUrl}`);
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Webhook URL must use HTTP or HTTPS protocol.');
    }

    // Prevent SSRF to internal localhost/private IP ranges in production environment
    if (process.env.NODE_ENV === 'production') {
      const host = parsedUrl.hostname.toLowerCase();
      if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host) || host.startsWith('192.168.') || host.startsWith('10.')) {
        throw new Error('Localhost and internal network webhook URLs are prohibited in production environment.');
      }
    }

    return parsedUrl.toString();
  }

  /**
   * Get all registered active website integrations
   */
  static async getAllIntegrations(pool) {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM application_integrations ORDER BY created_at ASC'
      );
      return rows.map(r => this.formatIntegration(r));
    } catch (err) {
      console.error('[ApplicationIntegrationService] Error fetching integrations:', err);
      return [];
    }
  }

  /**
   * Upsert an application integration
   */
  static async upsertIntegration(pool, { applicationKey, displayName, websiteDomain, webhookUrl, redirectUrl, isActive = true }) {
    const validWebhookUrl = this.validateWebhookUrl(webhookUrl);
    const key = applicationKey.trim().toLowerCase();

    const query = `
      INSERT INTO application_integrations (application_key, display_name, website_domain, webhook_url, redirect_url, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (application_key) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          website_domain = EXCLUDED.website_domain,
          webhook_url = EXCLUDED.webhook_url,
          redirect_url = EXCLUDED.redirect_url,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
      RETURNING *
    `;

    const { rows } = await pool.query(query, [key, displayName, websiteDomain, validWebhookUrl, redirectUrl || null, isActive]);
    return this.formatIntegration(rows[0]);
  }

  /**
   * Format integration DB row
   */
  static formatIntegration(row) {
    return {
      id: row.id,
      applicationKey: row.application_key,
      displayName: row.display_name,
      websiteDomain: row.website_domain,
      webhookUrl: row.webhook_url,
      redirectUrl: row.redirect_url,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
