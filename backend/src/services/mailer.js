const path = require('path');
const nodemailer = require('nodemailer');

// Always load backend/.env (services → src → backend), regardless of process cwd
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

let transporter = null;

function readSmtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const fromName =
    String(process.env.MAIL_FROM_NAME || process.env.APP_NAME || 'GlamBaddies').trim();
  const fromAddress =
    String(process.env.MAIL_FROM_ADDRESS || '').trim() ||
    user ||
    'noreply@glambaddies.com';
  const from =
    String(process.env.SMTP_FROM || '').trim() ||
    `${fromName} <${fromAddress}>`;
  return { host, user, pass, port, from, fromName, fromAddress };
}

function smtpConfigured() {
  const { host, user, pass } = readSmtpConfig();
  return Boolean(host && user && pass);
}

function getTransporter() {
  const cfg = readSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    console.warn('[mail] SMTP missing env', {
      host: Boolean(cfg.host),
      user: Boolean(cfg.user),
      pass: Boolean(cfg.pass),
      cwd: process.cwd(),
    });
    return null;
  }

  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });
  return transporter;
}

/**
 * Send an email. Never throws — logs and returns { ok, error }.
 */
async function sendMail({ to, subject, html, text, replyTo }) {
  const cleanTo = String(to || '').trim().toLowerCase();
  if (!cleanTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTo)) {
    console.warn('[mail] invalid recipient:', to);
    return { ok: false, error: 'Missing or invalid recipient' };
  }
  if (cleanTo.endsWith('@checkout.glambaddies.com')) {
    console.warn('[mail] synthetic checkout email skipped:', cleanTo);
    return { ok: false, error: 'Synthetic checkout email skipped' };
  }

  const mailer = getTransporter();
  if (!mailer) {
    console.warn('[mail] SMTP not configured — skipped:', subject);
    return { ok: false, error: 'SMTP not configured' };
  }

  const { from } = readSmtpConfig();
  const support =
    String(process.env.SUPPORT_EMAIL || '').trim() || 'support@glambaddies.com';

  try {
    const info = await mailer.sendMail({
      from,
      to: cleanTo,
      replyTo: replyTo || support,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });
    console.log('[mail] sent:', subject, '→', cleanTo, info.messageId || '');
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    transporter = null;
    console.error('[mail] send failed:', error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  sendMail,
  smtpConfigured,
  readSmtpConfig,
};
