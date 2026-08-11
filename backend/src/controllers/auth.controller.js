const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { ApiError } = require('../middleware/error');

function normalizePhone(raw) {
  const phone = String(raw || '').replace(/[^\d+]/g, '').trim();
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return '';
  return phone.startsWith('+') ? `+${digits}` : digits;
}

async function ensureUserPhoneColumn() {
  await db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS phone VARCHAR(40)
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
      ON users (phone)
      WHERE phone IS NOT NULL AND phone <> ''
  `);
  await db.query(`
    ALTER TABLE users
      ALTER COLUMN email DROP NOT NULL
  `).catch(() => {});
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email || null, phone: user.phone || null, role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone || null,
    email: user.email || null,
    created_at: user.created_at,
  };
}

exports.register = async (req, res, next) => {
  try {
    await ensureUserPhoneColumn();
    const { name, phone: rawPhone, password } = req.body || {};
    const phone = normalizePhone(rawPhone);
    if (!name || !String(name).trim()) {
      throw new ApiError(400, 'Full name is required');
    }
    if (!phone) {
      throw new ApiError(400, 'A valid phone number is required');
    }
    if (!password || String(password).length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters');
    }

    const existing = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      throw new ApiError(409, 'An account with this phone number already exists');
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (name, phone, email, password_hash)
       VALUES ($1, $2, NULL, $3)
       RETURNING id, name, phone, email, created_at`,
      [String(name).trim(), phone, hash]
    );

    const user = publicUser(rows[0]);
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    if (err.code === '23505') {
      return next(new ApiError(409, 'An account with this phone number already exists'));
    }
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    await ensureUserPhoneColumn();
    const { phone: rawPhone, password, email } = req.body || {};
    const phone = normalizePhone(rawPhone || email);
    if (!phone || !password) {
      throw new ApiError(400, 'phone and password are required');
    }

    const { rows } = await db.query(
      `SELECT id, name, phone, email, password_hash
       FROM users
       WHERE phone = $1
          OR email = $1
          OR regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $2`,
      [phone, phone.replace(/\D/g, '')]
    );
    const user = rows[0];
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) throw new ApiError(401, 'Invalid phone number or password');

    const safe = publicUser(user);
    res.json({ token: signToken(safe), user: safe });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    await ensureUserPhoneColumn();
    const { rows } = await db.query(
      'SELECT id, name, phone, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (rows.length === 0) throw new ApiError(404, 'User not found');
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
};
