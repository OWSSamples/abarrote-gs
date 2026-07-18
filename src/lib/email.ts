/**
 * Email Client (Multi-transport)
 *
 * Enterprise-grade email sending con dos backends:
 *
 *   1. SMTP (nodemailer) — usado cuando SMTP_HOST está definido en env.
 *      Compatible con Spacemail, Gmail, Outlook, Zoho o cualquier servidor
 *      IMAP/SMTP/POP3 estándar.
 *
 *   2. AWS SES v2 — fallback automático cuando no hay SMTP configurado.
 *      Reusa las credenciales AWS de S3.
 *
 * Architecture:
 *   sendEmail() → [SMTP transport | SES v2] → recipient inbox
 *
 * Selección automática:
 *   if (env.SMTP_HOST) → usa nodemailer (interno: Spacemail / propio del cliente)
 *   else              → usa AWS SES (legacy)
 *
 * Features:
 * - HTML + plain-text multipart emails
 * - Typed email payloads
 * - Centralized error handling
 * - Remitente autenticado por transporte y reply-to configurable por negocio
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import nodemailer, { type Transporter } from 'nodemailer';
import { getAwsCredentials } from '@/lib/aws-credentials';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import {
  getEmailDomain,
  hashIdentifierForLog,
  isValidEmailAddress,
  normalizeEmailAddress,
  redactEmailLikeValues,
} from '@/lib/security/redaction';

// ══════════════════════════════════════════════════════════════
// TRANSPORT SELECTION
// ══════════════════════════════════════════════════════════════

type EmailTransport = 'smtp' | 'ses';

/**
 * Returns the active email transport.
 *
 * SMTP is explicit: if SMTP_HOST exists, the app must use that transport and
 * report configuration issues instead of silently falling back to SES.
 */
function getActiveTransport(): EmailTransport {
  return env.SMTP_HOST ? 'smtp' : 'ses';
}

function getTransportConfigurationIssue(transport: EmailTransport, resolvedFrom: string): string | null {
  if (transport === 'smtp') {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !resolvedFrom) {
      return 'Configuración SMTP incompleta';
    }
    return null;
  }

  if (!resolvedFrom) {
    return 'Configuración SES incompleta';
  }

  return null;
}

async function getRecipientLogMetadata(email: string) {
  return {
    to_hash: await hashIdentifierForLog(email),
    to_domain: getEmailDomain(email),
  };
}

function toPublicEmailError(message: string): string {
  const safeMessage = redactEmailLikeValues(message);
  if (/configuration|configuraci[oó]n|missing|required|credentials?/i.test(safeMessage)) {
    return 'La configuración de correo está incompleta.';
  }
  if (/EAUTH|authentication|auth command failed|invalid login|535\b/i.test(safeMessage)) {
    return 'El servidor de correo rechazó las credenciales configuradas.';
  }
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ESOCKET|ETIMEDOUT|timeout/i.test(safeMessage)) {
    return 'No fue posible conectar con el servidor de correo configurado.';
  }
  if (/throttl|rate|limit|quota/i.test(safeMessage)) {
    return 'El proveedor limitó temporalmente el envío. Intenta más tarde.';
  }
  return 'No fue posible enviar el correo en este momento.';
}

function sanitizeHeaderText(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

// ── SMTP (nodemailer) singleton ──
let smtpTransporter: Transporter | null = null;

function getSMTPTransporter(): Transporter {
  if (!smtpTransporter) {
    const port = env.SMTP_PORT ? Number.parseInt(env.SMTP_PORT, 10) : 587;
    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      // Spacemail/IMAP estándar: 465 = SSL implícito; 587 = STARTTLS
      secure: env.SMTP_SECURE === 'true' || port === 465,
      requireTLS: port === 587,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      tls: {
        minVersion: 'TLSv1.2',
        servername: env.SMTP_HOST,
      },
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
    });
  }
  return smtpTransporter;
}

// ── AWS SES singleton ──
let sesClient: SESv2Client | null = null;

function getSESClient(): SESv2Client {
  if (!sesClient) {
    sesClient = new SESv2Client({
      region: env.AWS_SES_REGION || env.AWS_REGION || 'us-east-1',
      credentials: getAwsCredentials(),
    });
  }
  return sesClient;
}

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export interface EmailPayload {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** HTML body */
  html: string;
  /** Plain-text fallback (auto-generated from subject if not provided) */
  text?: string;
  /** Reply-to address (defaults to fromEmail) */
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** Which transport was used */
  transport?: EmailTransport;
}

// ══════════════════════════════════════════════════════════════
// SEND EMAIL
// ══════════════════════════════════════════════════════════════

/**
 * Sends an email via the active transport (SMTP if configured, else SES).
 *
 * SMTP siempre usa SMTP_FROM_EMAIL como remitente autenticado para preservar
 * alineación SPF/DKIM/DMARC. Un fromEmail del negocio se usa como Reply-To.
 * SES permite fromEmail explícito y usa SES_FROM_EMAIL como fallback.
 *
 * @param payload - Email data (to, subject, html, text)
 * @param fromEmail - Sender de SES o Reply-To del negocio cuando se usa SMTP
 * @param fromName - Display name for sender
 */
export async function sendEmail(
  payload: EmailPayload,
  fromEmail?: string,
  fromName?: string,
): Promise<EmailResult> {
  const transport = getActiveTransport();
  const normalizedRecipient = normalizeEmailAddress(payload.to);
  const requestedReplyTo = payload.replyTo || (transport === 'smtp' ? fromEmail : undefined);
  const normalizedReplyTo = requestedReplyTo
    ? normalizeEmailAddress(requestedReplyTo)
    : undefined;
  const recipientLog = await getRecipientLogMetadata(normalizedRecipient);

  // SMTP no permite que la configuración de un tenant suplante al buzón autenticado.
  const resolvedFrom =
    (transport === 'smtp' ? env.SMTP_FROM_EMAIL : fromEmail || env.SES_FROM_EMAIL) || '';
  const resolvedName = fromName || env.SMTP_FROM_NAME || undefined;
  const safeSubject = sanitizeHeaderText(payload.subject);
  const safeFromName = resolvedName ? sanitizeHeaderText(resolvedName) : undefined;
  const configIssue = getTransportConfigurationIssue(transport, resolvedFrom);

  if (configIssue) {
    logger.warn('Email send skipped: transport not configured', {
      action: 'email_configuration_error',
      transport,
      ...recipientLog,
      reason: configIssue,
    });
    return { success: false, error: configIssue, transport };
  }

  if (!isValidEmailAddress(resolvedFrom)) {
    logger.warn('Email send skipped: invalid fromEmail configured', {
      action: 'email_configuration_error',
      transport,
      ...recipientLog,
    });
    return { success: false, error: 'Correo remitente inválido', transport };
  }

  if (
    !isValidEmailAddress(normalizedRecipient) ||
    (normalizedReplyTo && !isValidEmailAddress(normalizedReplyTo)) ||
    !safeSubject ||
    !payload.html.trim()
  ) {
    logger.warn('Email send skipped: invalid payload', {
      action: 'email_validation_error',
      transport,
      ...recipientLog,
      hasSubject: Boolean(safeSubject),
      hasHtml: Boolean(payload.html.trim()),
      hasInvalidReplyTo: Boolean(normalizedReplyTo && !isValidEmailAddress(normalizedReplyTo)),
    });
    return {
      success: false,
      error: 'Datos inválidos para enviar correo',
      transport,
    };
  }

  const fromAddress = safeFromName ? `${safeFromName} <${resolvedFrom}>` : resolvedFrom;

  try {
    if (transport === 'smtp') {
      const tx = getSMTPTransporter();
      const info = await tx.sendMail({
        from: fromAddress,
        to: normalizedRecipient,
        subject: safeSubject,
        html: payload.html,
        text: payload.text || safeSubject,
        replyTo: normalizedReplyTo,
      });

      logger.info('Email sent successfully (SMTP)', {
        action: 'email_sent',
        transport: 'smtp',
        messageId: info.messageId,
        ...recipientLog,
      });

      return { success: true, messageId: info.messageId, transport: 'smtp' };
    }

    // ── SES fallback ──
    const client = getSESClient();
    const command = new SendEmailCommand({
      FromEmailAddress: fromAddress,
      ConfigurationSetName: env.SES_CONFIGURATION_SET,
      Destination: { ToAddresses: [normalizedRecipient] },
      ReplyToAddresses: normalizedReplyTo ? [normalizedReplyTo] : undefined,
      Content: {
        Simple: {
          Subject: { Data: safeSubject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: payload.html, Charset: 'UTF-8' },
            Text: { Data: payload.text || safeSubject, Charset: 'UTF-8' },
          },
        },
      },
    });

    const response = await client.send(command);

    logger.info('Email sent successfully (SES)', {
      action: 'email_sent',
      transport: 'ses',
      messageId: response.MessageId,
      ...recipientLog,
    });

    return { success: true, messageId: response.MessageId, transport: 'ses' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to send email', {
      action: 'email_send_error',
      transport,
      error: redactEmailLikeValues(message),
      ...recipientLog,
    });
    return { success: false, error: toPublicEmailError(message), transport };
  }
}

/**
 * Sends email to multiple recipients (one at a time to respect provider best practices).
 */
export async function sendEmailBatch(
  recipients: string[],
  subject: string,
  html: string,
  fromEmail?: string,
  fromName?: string,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const to of recipients) {
    const result = await sendEmail({ to, subject, html }, fromEmail, fromName);
    if (result.success) sent++;
    else failed++;
  }

  logger.info('Email batch completed', {
    action: 'email_batch',
    sent,
    failed,
    total: recipients.length,
  });
  return { sent, failed };
}

/**
 * Returns metadata about the active email transport.
 * Útil para health checks y UI de estado en Settings.
 */
export function getEmailTransportInfo(): {
  transport: 'smtp' | 'ses';
  configured: boolean;
  fromEmail: string | undefined;
  smtpHost?: string;
  smtpPort?: number;
} {
  const transport = getActiveTransport();
  if (transport === 'smtp') {
    return {
      transport: 'smtp',
      configured: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD),
      fromEmail: env.SMTP_FROM_EMAIL,
      smtpHost: env.SMTP_HOST,
      smtpPort: env.SMTP_PORT ? Number.parseInt(env.SMTP_PORT, 10) : 587,
    };
  }
  return {
    transport: 'ses',
    configured: Boolean(env.SES_FROM_EMAIL),
    fromEmail: env.SES_FROM_EMAIL,
  };
}
