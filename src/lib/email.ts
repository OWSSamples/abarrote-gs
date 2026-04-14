/**
 * AWS SES Email Client
 *
 * Enterprise-grade email sending using AWS SES v2.
 * Reuses the same AWS credentials as S3 (or separate IAM user).
 *
 * Architecture:
 *   sendEmail() → SES v2 API → verified domain → recipient inbox
 *
 * Features:
 * - HTML + plain-text multipart emails
 * - Typed email payloads
 * - Centralized error handling with circuit breaker
 * - Configurable from/reply-to from store config
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

// ══════════════════════════════════════════════════════════════
// CLIENT SINGLETON
// ══════════════════════════════════════════════════════════════

let sesClient: SESv2Client | null = null;

function getSESClient(): SESv2Client {
  if (!sesClient) {
    sesClient = new SESv2Client({
      region: env.AWS_REGION || 'us-east-2',
      ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
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
}

// ══════════════════════════════════════════════════════════════
// SEND EMAIL
// ══════════════════════════════════════════════════════════════

/**
 * Sends an email via AWS SES v2.
 *
 * @param payload - Email data (to, subject, html, text)
 * @param fromEmail - Sender address (must be SES-verified)
 * @param fromName - Display name for sender
 */
export async function sendEmail(
  payload: EmailPayload,
  fromEmail: string,
  fromName?: string,
): Promise<EmailResult> {
  if (!fromEmail) {
    logger.warn('Email send skipped: no fromEmail configured');
    return { success: false, error: 'Correo remitente no configurado' };
  }

  if (!payload.to || !payload.subject || !payload.html) {
    logger.warn('Email send skipped: missing required fields');
    return { success: false, error: 'Faltan campos requeridos (to, subject, html)' };
  }

  const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  try {
    const client = getSESClient();

    const command = new SendEmailCommand({
      FromEmailAddress: fromAddress,
      Destination: {
        ToAddresses: [payload.to],
      },
      ReplyToAddresses: payload.replyTo ? [payload.replyTo] : undefined,
      Content: {
        Simple: {
          Subject: {
            Data: payload.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: payload.html,
              Charset: 'UTF-8',
            },
            Text: {
              Data: payload.text || payload.subject,
              Charset: 'UTF-8',
            },
          },
        },
      },
    });

    const response = await client.send(command);

    logger.info('Email sent successfully', {
      action: 'email_sent',
      messageId: response.MessageId,
      to: payload.to,
    });

    return { success: true, messageId: response.MessageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to send email', {
      action: 'email_send_error',
      error: message,
      to: payload.to,
    });
    return { success: false, error: message };
  }
}

/**
 * Sends email to multiple recipients (one at a time to respect SES best practices).
 */
export async function sendEmailBatch(
  recipients: string[],
  subject: string,
  html: string,
  fromEmail: string,
  fromName?: string,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const to of recipients) {
    const result = await sendEmail({ to, subject, html }, fromEmail, fromName);
    if (result.success) sent++;
    else failed++;
  }

  logger.info('Email batch completed', { action: 'email_batch', sent, failed, total: recipients.length });
  return { sent, failed };
}
