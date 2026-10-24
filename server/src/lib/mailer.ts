import nodemailer from 'nodemailer';
import { config, mailDeliveryConfigured, requestSiteUrl } from '../config.js';

/**
 * Email delivery boundary.
 *
 * This project does NOT bundle a hosted email account or API key. Recovery
 * tokens are generated securely and single-use, but they leave the server only
 * when a provider is explicitly configured. With no provider the recovery
 * endpoint returns an honest 503 instead of pretending an email was sent.
 *
 * Supported MAIL_PROVIDER values:
 *   none     – default; delivery unavailable (503)
 *   console  – development only; prints the link to the server log
 *   smtp     – nodemailer SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER,
 *              SMTP_PASSWORD, SMTP_SECURE, MAIL_FROM)
 *   resend   – Resend HTTP API (RESEND_API_KEY, MAIL_FROM)
 *
 * APP_URL / PUBLIC_ORIGIN is used to build the public link.
 */
export class MailNotConfiguredError extends Error {
  constructor() {
    super('Email delivery is not configured on this server.');
    this.name = 'MailNotConfiguredError';
  }
}

export function resetUrl(req: { headers: Record<string, string | string[] | undefined> }, token: string): string {
  const base = requestSiteUrl(req).replace(/\/$/, '');
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

function transport() {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

/** Delivers a password-reset link. Throws when no usable provider is configured. */
export async function sendPasswordResetMail(to: string, token: string, req?: { headers: Record<string, string | string[] | undefined> }): Promise<void> {
  if (!mailDeliveryConfigured()) throw new MailNotConfiguredError();
  const link = resetUrl(req ?? { headers: {} }, token);
  const subject = 'Reset your VidyaPariksha password';
  const text =
    `A password reset was requested for your VidyaPariksha account.\n\n` +
    `Open this link within ${Math.round(config.resetTokenTtlSeconds / 60)} minutes:\n${link}\n\n` +
    `If you did not request this, you can ignore this email. The link can be used only once.`;

  switch (config.mailProvider) {
    case 'console': {
      // Development aid only. Never enabled in production (mailDeliveryConfigured rejects it).
      console.info('[mail:console] password reset link', JSON.stringify({ to, link }));
      return;
    }
    case 'smtp': {
      await transport().sendMail({ from: config.mailFrom, to, subject, text });
      return;
    }
    case 'resend': {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: config.mailFrom, to: [to], subject, text }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Resend API returned HTTP ${res.status}.`);
      return;
    }
    default:
      throw new MailNotConfiguredError();
  }
}
