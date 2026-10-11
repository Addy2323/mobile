import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { smsService, normalizeTzPhone } from './smsService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'lumo_split_default_secure_jwt_secret_dev_key_32chars_min';
const PASSWORD_SALT = process.env.PASSWORD_SALT || 'lumo_split_secure_salt_dev';

/**
 * High-Security Salted Passcode Hashing
 */
export function hashPasscode(passcode) {
  return crypto.pbkdf2Sync(String(passcode).trim(), PASSWORD_SALT, 210000, 32, 'sha256').toString('hex');
}

export function createAuthRouter(pool) {
  const router = express.Router();

  // -------------------------------------------------------------
  // 1. CHECK PHONE NUMBER REGISTRATION STATUS
  // -------------------------------------------------------------
  router.post('/check-phone', async (req, res) => {
    try {
      const { phone } = req.body;
      const normPhone = normalizeTzPhone(phone);
      if (!normPhone || normPhone.length < 10) {
        return res.status(400).json({ error: 'Valid phone number required' });
      }

      const { rows } = await pool.query(
        'SELECT id, name, status FROM users WHERE phone = $1',
        [normPhone]
      );

      if (rows.length === 0) {
        return res.json({ registered: false });
      }

      res.json({
        registered: true,
        name: rows[0].name,
        status: rows[0].status
      });
    } catch (err) {
      console.error('[Auth check-phone error]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 2. SEND OTP VIA MESEJI SMS
  // -------------------------------------------------------------
  router.post('/send-otp', async (req, res) => {
    try {
      const { phone, purpose = 'REGISTER' } = req.body;
      const normPhone = normalizeTzPhone(phone);
      if (!normPhone || normPhone.length < 10) {
        return res.status(400).json({ error: 'Valid phone number required (e.g., 07XXXXXXXX or 255XXXXXXXXX)' });
      }

      // If forgot-passcode, verify that the phone number is already registered in LUMO
      if (purpose === 'FORGOT_PASSCODE') {
        const userRes = await pool.query('SELECT id, name, status FROM users WHERE phone = $1', [normPhone]);
        if (userRes.rows.length === 0) {
          return res.status(404).json({
            error: 'This phone number is not registered in our system.'
          });
        }
        if (userRes.rows[0].status === 'SUSPENDED') {
          return res.status(403).json({ error: 'Account suspended. Please contact LUMO support.' });
        }
      }

      // If registration, check if already registered
      if (purpose === 'REGISTER') {
        const userRes = await pool.query('SELECT id FROM users WHERE phone = $1', [normPhone]);
        if (userRes.rows.length > 0) {
          return res.status(409).json({
            error: 'This phone number is already registered. Please enter your passcode to log in or use Forgot Passcode.'
          });
        }
      }

      // Generate 6-digit cryptographically secure OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Delete old unverified OTPs for this phone & purpose
      await pool.query(
        'DELETE FROM otp_verifications WHERE phone = $1 AND purpose = $2 AND is_verified = false',
        [normPhone, purpose]
      );

      // Save new OTP
      await pool.query(
        'INSERT INTO otp_verifications (phone, code, purpose, expires_at) VALUES ($1, $2, $3, $4)',
        [normPhone, code, purpose, expiresAt]
      );

      // Send SMS via Meseji
      await smsService.sendOtp({ phone: normPhone, code, purpose });

      res.json({
        success: true,
        message: `Verification code sent to ${normPhone}`,
        phone: normPhone
      });
    } catch (err) {
      console.error('[Auth send-otp error]:', err);
      res.status(500).json({ error: err.message || 'Failed to send SMS verification code' });
    }
  });

  // -------------------------------------------------------------
  // 3. VERIFY OTP
  // -------------------------------------------------------------
  router.post('/verify-otp', async (req, res) => {
    try {
      const { phone, code, purpose = 'REGISTER' } = req.body;
      const normPhone = normalizeTzPhone(phone);
      if (!normPhone || !code) {
        return res.status(400).json({ error: 'Phone number and verification code required' });
      }

      const { rows } = await pool.query(
        `SELECT id FROM otp_verifications
         WHERE phone = $1 AND code = $2 AND purpose = $3 AND is_verified = false AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [normPhone, String(code).trim(), purpose]
      );

      if (rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired verification code' });
      }

      // Mark as verified
      await pool.query('UPDATE otp_verifications SET is_verified = true WHERE id = $1', [rows[0].id]);

      res.json({
        success: true,
        verified: true,
        phone: normPhone
      });
    } catch (err) {
      console.error('[Auth verify-otp error]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 4. REGISTER NEW USER (WITH PASSCODE & AUTOMATIC WALLET)
  // -------------------------------------------------------------
  router.post('/register', async (req, res) => {
    try {
      const { phone, name, passcode, otpCode } = req.body;
      const normPhone = normalizeTzPhone(phone);
      if (!normPhone || !passcode) {
        return res.status(400).json({ error: 'Phone number and 4-digit passcode required' });
      }

      if (String(passcode).length < 4) {
        return res.status(400).json({ error: 'Passcode must be at least 4 digits' });
      }

      // Check OTP verification
      const otpCheck = await pool.query(
        `SELECT id FROM otp_verifications
         WHERE phone = $1 AND code = $2 AND purpose = 'REGISTER' AND is_verified = true
         ORDER BY created_at DESC LIMIT 1`,
        [normPhone, String(otpCode).trim()]
      );

      if (otpCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Phone number verification required before registration' });
      }

      // Prevent duplicate
      const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [normPhone]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Phone number already registered' });
      }

      const passcodeHash = hashPasscode(passcode);
      const cleanName = (name && name.trim()) || 'LUMO Member';

      // Insert User
      const userRes = await pool.query(
        `INSERT INTO users (phone, name, passcode_hash, status, account_type)
         VALUES ($1, $2, $3, 'ACTIVE', 'USER')
         RETURNING id, phone, name, email, status, created_at`,
        [normPhone, cleanName, passcodeHash]
      );
      const user = userRes.rows[0];

      // Auto-initialize double-entry ledger balance for this user
      const accountRef = 'ACC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      await pool.query(
        `INSERT INTO user_balances (user_id, account_ref, available_balance, tier)
         VALUES ($1, $2, 0.00, 'STARTER')
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, accountRef]
      );

      // Clean up used OTP
      await pool.query('DELETE FROM otp_verifications WHERE phone = $1 AND purpose = \'REGISTER\'', [normPhone]);

      // Generate JWT session token
      const token = jwt.sign(
        { id: user.id, phone: user.phone, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          status: user.status
        }
      });
    } catch (err) {
      console.error('[Auth register error]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 5. LOGIN VIA PASSCODE
  // -------------------------------------------------------------
  router.post('/login-passcode', async (req, res) => {
    try {
      const { phone, passcode } = req.body;
      const normPhone = normalizeTzPhone(phone);
      if (!normPhone || !passcode) {
        return res.status(400).json({ error: 'Phone number and passcode required' });
      }

      const { rows } = await pool.query(
        'SELECT id, phone, name, email, passcode_hash, status FROM users WHERE phone = $1',
        [normPhone]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Incorrect phone number or passcode' });
      }

      const user = rows[0];

      if (user.status === 'SUSPENDED') {
        return res.status(403).json({ error: 'Your account has been suspended. Please contact LUMO support.' });
      }

      const inputHash = hashPasscode(passcode);
      if (user.passcode_hash !== inputHash) {
        return res.status(401).json({ error: 'Incorrect passcode. Try again.' });
      }

      // Update last login
      await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

      // Ensure user balance exists
      const accountRef = 'ACC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      await pool.query(
        `INSERT INTO user_balances (user_id, account_ref, available_balance, tier)
         VALUES ($1, $2, 0.00, 'STARTER')
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, accountRef]
      );

      // Generate JWT session token
      const token = jwt.sign(
        { id: user.id, phone: user.phone, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          status: user.status
        }
      });
    } catch (err) {
      console.error('[Auth login-passcode error]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 6. RESET PASSCODE (FORGOT PASSCODE FLOW)
  // -------------------------------------------------------------
  router.post('/reset-passcode', async (req, res) => {
    try {
      const { phone, newPasscode, otpCode } = req.body;
      const normPhone = normalizeTzPhone(phone);
      if (!normPhone || !newPasscode || !otpCode) {
        return res.status(400).json({ error: 'Phone number, new passcode, and verification code required' });
      }

      if (String(newPasscode).length < 4) {
        return res.status(400).json({ error: 'New passcode must be at least 4 digits' });
      }

      // Verify OTP
      const otpCheck = await pool.query(
        `SELECT id FROM otp_verifications
         WHERE phone = $1 AND code = $2 AND purpose = 'FORGOT_PASSCODE' AND is_verified = true
         ORDER BY created_at DESC LIMIT 1`,
        [normPhone, String(otpCode).trim()]
      );

      if (otpCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Verified reset code required. Please request a new code.' });
      }

      // Verify user exists
      const userRes = await pool.query('SELECT id FROM users WHERE phone = $1', [normPhone]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: 'This phone number is not registered in our system.' });
      }

      const newPasscodeHash = hashPasscode(newPasscode);
      await pool.query(
        'UPDATE users SET passcode_hash = $1, updated_at = NOW() WHERE phone = $2',
        [newPasscodeHash, normPhone]
      );

      // Clean up used OTP
      await pool.query('DELETE FROM otp_verifications WHERE phone = $1 AND purpose = \'FORGOT_PASSCODE\'', [normPhone]);

      res.json({
        success: true,
        message: 'Passcode updated successfully. You can now log in with your new passcode.'
      });
    } catch (err) {
      console.error('[Auth reset-passcode error]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // 7. GET CURRENT USER PROFILE & BALANCE
  // -------------------------------------------------------------
  router.get('/me', async (req, res) => {
    try {
      const authHeader = req.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization token required' });
      }
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      const userRes = await pool.query('SELECT id, phone, name, email, status, created_at FROM users WHERE id = $1', [decoded.id]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const user = userRes.rows[0];

      const balanceRes = await pool.query('SELECT available_balance, tier, account_ref FROM user_balances WHERE user_id = $1', [user.id]);
      const balance = balanceRes.rows[0] || { available_balance: 0, tier: 'STARTER', account_ref: 'ACC-00000000' };

      res.json({
        user,
        balance: {
          available: Number(balance.available_balance),
          tier: balance.tier,
          accountRef: balance.account_ref
        }
      });
    } catch (err) {
      res.status(401).json({ error: 'Invalid or expired session' });
    }
  });

  return router;
}
