import dotenv from 'dotenv';
dotenv.config();

/**
 * Normalizes Tanzanian phone numbers to standard format (255XXXXXXXXX)
 */
export function normalizeTzPhone(rawPhone) {
  if (!rawPhone) return '';
  let cleaned = String(rawPhone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '255' + cleaned.substring(1);
  } else if ((cleaned.startsWith('7') || cleaned.startsWith('6')) && cleaned.length === 9) {
    cleaned = '255' + cleaned;
  }
  return cleaned;
}

export class SmsService {
  constructor() {
    this.apiKey = process.env.MESEJI_API_KEY || 'zs_dec45832bc9cb22a90279a7a8e9867b2607c7c1b37c0f938';
    this.senderId = process.env.MESEJI_SENDER_ID || 'LUMO';
    this.baseUrl = (process.env.MESEJI_BASE_URL || 'https://meseji.co.tz/api/v1').replace(/\/+$/, '');
    this.enabled = process.env.SMS_ENABLED === 'true';
    this.dryRun = process.env.SMS_DRY_RUN === 'true';
  }

  /**
   * Dispatch single or batch SMS via Meseji API
   */
  async sendSms({ phone, message, senderId = null }) {
    const recipient = normalizeTzPhone(phone);
    if (!recipient || recipient.length < 10) {
      throw new Error(`Invalid phone number provided: ${phone}`);
    }

    if (!message || !message.trim()) {
      throw new Error('Message body cannot be empty');
    }

    const effectiveSenderId = senderId || this.senderId || 'LUMO';

    console.log(`[SMS Service] Dispatching SMS to ${recipient} via Meseji (Sender: ${effectiveSenderId})...`);

    if (this.dryRun) {
      console.log(`[SMS Service: DRY-RUN] Would send to ${recipient}: "${message}"`);
      return {
        success: true,
        dryRun: true,
        batch_id: 'dryrun_' + Date.now(),
        total_recipients: 1,
        status: 'queued'
      };
    }

    try {
      const endpoint = `${this.baseUrl}/sms/send`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender_id: effectiveSenderId,
          message: message,
          contacts: recipient
        })
      });

      const responseText = await response.text();
      let data = {};
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        data = { raw: responseText };
      }

      if (!response.ok) {
        console.error(`[SMS Service] Meseji API Error (${response.status}):`, data);
        throw new Error(data.message || data.error || `Meseji HTTP Error ${response.status}`);
      }

      console.log(`✅ [SMS Service] SMS dispatched successfully to ${recipient}:`, data);
      return {
        success: true,
        batch_id: data.batch_id,
        total_recipients: data.total_recipients || 1,
        status: data.status || 'queued',
        data
      };
    } catch (err) {
      console.error(`❌ [SMS Service] Delivery failed for ${recipient}:`, err.message);
      throw err;
    }
  }

  /**
   * Helper to send 6-digit OTP verification codes
   */
  async sendOtp({ phone, code, purpose = 'VERIFICATION' }) {
    let actionText = 'verification code';
    if (purpose === 'REGISTER') actionText = 'registration code';
    if (purpose === 'FORGOT_PASSCODE') actionText = 'passcode reset code';

    const message = `Your LUMO ${actionText} is ${code}. Valid for 10 minutes. Do not share this code with anyone.`;
    return await this.sendSms({ phone, message });
  }
}

export const smsService = new SmsService();
