import { BESTSMS_AUTH_KEY, BESTSMS_SENDER, BESTSMS_DLT_TE_ID } from "@repo/config/config";

function getApiCountryCode(phone) {
  if (!phone) return 0;
  const cleanPhone = String(phone).replace(/^\+/, '');
  if (cleanPhone.startsWith('91')) {
    return 91;
  }
  if (cleanPhone.startsWith('1')) {
    return 1;
  }
  return 0;
}

function isResponseSuccess(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  try {
    const json = JSON.parse(trimmed);
    if (json.type === 'success' || json.success === true || json.status === 'success' || json.responseCode === 'success') {
      return true;
    }
  } catch (e) {
    // Ignore JSON parsing errors for plain text responses
  }

  const lower = trimmed.toLowerCase();

  // Explicit failure keywords commonly returned by Indian SMS Gateways
  const errorKeywords = [
    'error', 'fail', 'invalid', 'missing', 'authkey', 'insufficient', 'blocked', 'parameters', 'restricted'
  ];
  const hasError = errorKeywords.some(keyword => lower.includes(keyword));
  if (hasError) return false;

  // Explicit success keywords or match alphanumeric message IDs
  if (
    lower.startsWith('submit') ||
    lower.includes('success') ||
    lower.includes('sent') ||
    lower.includes('ok') ||
    /^[a-f0-9]{24}$/i.test(trimmed) ||       // 24-char hex ID
    /^\d+$/.test(trimmed) ||                  // numeric ID
    /^[a-f0-9-]+$/i.test(trimmed)             // UUID/dash format ID
  ) {
    return true;
  }

  // Fallback: If it's a short alphanumeric string (less than 50 chars) without spaces or standard error signs, it's likely a transaction ID.
  if (trimmed.length < 50 && !trimmed.includes(' ') && /^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return true;
  }

  return false;
}


class SmsService {
  constructor() {
    this.apiKey = BESTSMS_AUTH_KEY;
    this.senderId = BESTSMS_SENDER || 'GLOWVT';
    this.dltTeId = BESTSMS_DLT_TE_ID;
  }

  /**
   * Send an OTP via SMS using the BestSMS OTP API.
   * Falls back to console logging if BESTSMS_AUTH_KEY is not configured (dev mode).
   *
   * @param {string} internationalNumber - Full E.164 number WITHOUT leading + (e.g. "919637989591")
   *                                       Built by the caller using buildE164() from phoneUtils.js
   * @param {string} otp - 6-digit OTP code (plaintext)
   * @returns {{ success: boolean, mock?: boolean, error?: string }}
   */
  async sendOtp(internationalNumber, otp) {
    // Safe partial log — shows country code + first 2 digits + masked remainder
    const safeLog = internationalNumber.length > 4
      ? `${internationalNumber.slice(0, 4)}${'X'.repeat(internationalNumber.length - 4)}`
      : internationalNumber;

    if (!this.apiKey) {
      console.warn(`[SMS OTP MOCK] Would send OTP to: ${safeLog} (Set BESTSMS_AUTH_KEY to enable real SMS delivery)`);
      return { success: true, mock: true };
    }

    try {
      // DLT Approved Template (Sender: TSOFTA | Template ID: 1777178680409257047)
      // Portal template: Dear Applicant, OTP for authentication using ERP is {#alp#}. OTP will expire in 10 minutes. Thank you. TSOFTA
      const message = `Dear Applicant, OTP for authentication using ERP is ${otp}. OTP will expire in 10 minutes. Thank you. TSOFTA`

      const params = new URLSearchParams({
        authkey: this.apiKey,
        mobiles: internationalNumber, // already fully formatted by caller
        sender: this.senderId,
        route: 4,
        country: getApiCountryCode(internationalNumber),
        DLT_TE_ID: this.dltTeId,
        message,
      });

      console.log(`[SMS OTP] Dispatching OTP to: ${safeLog}`);
      const url = `http://control.bestsms.co.in/api/sendhttp.php?${params.toString()}`;
      const response = await fetch(url, { method: 'GET' });
      const text = await response.text();
      console.log("url", url)

      console.log("SMS API BESTSMS RESPONSE", text)

      const isSuccess = isResponseSuccess(text);

      if (response.ok && isSuccess) {
        console.log(`[SMS OTP] Successfully dispatched to: ${safeLog}`);
        return { success: true, response: text };
      } else {
        console.error(`[SMS OTP] BestSMS API error for ${safeLog}:`, text);
        return { success: false, error: text || 'SMS gateway error' };
      }
    } catch (error) {
      console.error('[SMS OTP] sendOtp network error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a raw transactional SMS
   * @param {string} mobileNo - Recipient's 10-digit number
   * @param {string} message - Content
   */
  async sendSms(mobileNo, message) {
    if (!this.apiKey) {
      console.log(`[SMS MOCK] To: ${mobileNo}, Msg: ${message}`);
      return { success: true, mock: true };
    }

    try {
      console.log(`Sending SMS to ${mobileNo}...`);
      const params = new URLSearchParams({
        authkey: this.apiKey,
        mobiles: mobileNo,
        sender: this.senderId,
        route: 4,
        country: getApiCountryCode(mobileNo),
        DLT_TE_ID: this.dltTeId,
        message,
      });

      const url = `http://control.bestsms.co.in/api/sendhttp.php?${params.toString()}`;
      const response = await fetch(url, { method: 'GET' });
      const text = await response.text();
      console.log("SMS API BESTSMS RESPONSE", text);

      const isSuccess = isResponseSuccess(text);

      if (response.ok && isSuccess) {
        return { success: true, response: text };
      } else {
        console.error(`[SMS] BestSMS API error for ${mobileNo}:`, text);
        return { success: false, error: text || 'SMS gateway error' };
      }
    } catch (error) {
      console.error('SmsService Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send bulk SMS
   * @param {string[]} phones - Recipient mobile numbers
   * @param {string} message - Content
   */
  async sendBulkSms(phones, message) {
    if (!this.apiKey) {
      console.log(`[SMS MOCK] Bulk To: ${phones.join(', ')}, Msg: ${message}`);
      return { success: true, mock: true, sent: phones.length, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    const errors = [];

    const results = await Promise.all(
      phones.map(async (phone) => {
        try {
          const res = await this.sendSms(phone, message);
          if (res && res.success) {
            return { success: true };
          } else {
            return { success: false, error: res?.error || 'Failed to send' };
          }
        } catch (err) {
          return { success: false, error: err.message };
        }
      })
    );

    results.forEach((res) => {
      if (res.success) {
        sent++;
      } else {
        failed++;
        if (res.error) errors.push(res.error);
      }
    });

    return {
      success: failed === 0,
      sent,
      failed,
      error: errors.length > 0 ? errors.join('; ') : undefined
    };
  }

  /**
   * Send Appointment SMS
   */
  async sendAppointmentSms(mobileNo, appointment, status) {
    const copyMap = {
      'confirmed': `Your session at Glowvita is confirmed for ${appointment.startTime} on ${new Date(appointment.date).toLocaleDateString()}. Get ready to glow! ✨`,
      'cancelled': `Your appointment at Glowvita has been cancelled. We hope to see you again soon!`,
      'reminder': `Reminder: You have a glam session today at ${appointment.startTime}. See you soon! ✂️`
    };

    const msg = copyMap[status];
    if (msg) {
      return await this.sendSms(mobileNo, msg);
    }
  }
}

export default new SmsService();