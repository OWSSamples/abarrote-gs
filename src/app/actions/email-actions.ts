'use server';

import { requireOwner, requireAuth } from '@/lib/auth/guard';
import { withLogging } from '@/lib/errors';
import { sendEmail } from '@/lib/email';
import { testEmailTemplate, ticketEmailTemplate } from '@/lib/email-templates';
import type { TicketEmailData } from '@/lib/email-templates';
import { getStoreConfig } from '@/server/store-config-service';
import { logger } from '@/lib/logger';
import { getEmailDomain, hashIdentifierForLog, normalizeEmailAddress } from '@/lib/security/redaction';
import { z } from 'zod';

// ══════════════════════════════════════════════════════════════
// SCHEMAS
// ══════════════════════════════════════════════════════════════

const ticketEmailItemSchema = z.object({
  name: z.string().min(1).max(200),
  qty: z.number().int().positive(),
  price: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
});

const sendTestEmailSchema = z.object({
  to: z.string().email('Correo electrónico inválido'),
});

const sendTicketEmailSchema = z.object({
  to: z.string().email('Correo electrónico inválido'),
  folio: z.string().min(1).max(50),
  fecha: z.string().min(1),
  cajero: z.string().min(1).max(100),
  items: z.array(ticketEmailItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  iva: z.number().nonnegative(),
  total: z.number().positive(),
  paymentMethod: z.string().min(1),
});

// ══════════════════════════════════════════════════════════════
// SEND TEST EMAIL
// ══════════════════════════════════════════════════════════════

/**
 * Send a test email to verify AWS SES integration.
 */
async function _sendTestEmailAction(params: { to: string }): Promise<{ success: boolean; message: string }> {
  await requireOwner();

  const parsed = sendTestEmailSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, message: 'Datos inválidos para enviar correo de prueba' };
  }
  const data = parsed.data;
  const config = await getStoreConfig();
  if (!config.emailEnabled) {
    return { success: false, message: 'Habilita y guarda el correo electrónico antes de realizar la prueba.' };
  }

  const sender = normalizeEmailAddress(config.emailFrom || '');
  if (!z.string().email().safeParse(sender).success) {
    return { success: false, message: 'El correo remitente guardado no es válido.' };
  }

  const recipient = normalizeEmailAddress(data.to);
  const recipientLog = {
    to_hash: await hashIdentifierForLog(recipient),
    to_domain: getEmailDomain(recipient),
  };

  const template = testEmailTemplate(config.storeName, config.logoUrl || undefined);

  const result = await sendEmail(
    { to: recipient, subject: template.subject, html: template.html, text: template.text },
    sender,
    config.emailFromName || config.storeName,
  );

  if (result.success) {
    logger.info('Test email sent', { action: 'email_test', ...recipientLog, messageId: result.messageId });
    return { success: true, message: 'Correo de prueba enviado.' };
  }

  return { success: false, message: 'No fue posible enviar el correo de prueba. Revisa la configuración guardada.' };
}

export const sendTestEmailAction = withLogging('email.sendTestEmail', _sendTestEmailAction);

// ══════════════════════════════════════════════════════════════
// SEND TICKET EMAIL (DIGITAL RECEIPT)
// ══════════════════════════════════════════════════════════════

/**
 * Send a digital ticket (receipt) to the customer's email after a sale.
 * Any authenticated user (cashier) can invoke this.
 */
async function _sendTicketEmailAction(params: {
  to: string;
  folio: string;
  fecha: string;
  cajero: string;
  items: { name: string; qty: number; price: number; subtotal: number }[];
  subtotal: number;
  iva: number;
  total: number;
  paymentMethod: string;
}): Promise<{ success: boolean; message: string }> {
  await requireAuth();

  const parsed = sendTicketEmailSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, message: 'Datos inválidos para enviar ticket por correo' };
  }
  const data = parsed.data;
  const recipient = normalizeEmailAddress(data.to);
  const recipientLog = {
    to_hash: await hashIdentifierForLog(recipient),
    to_domain: getEmailDomain(recipient),
  };

  const config = await getStoreConfig();

  if (!config.emailEnabled) {
    return { success: false, message: 'El envío de correos no está habilitado' };
  }

  if (!config.emailTicketEnabled) {
    return { success: false, message: 'El envío de tickets por correo no está habilitado' };
  }

  if (!config.emailFrom) {
    return { success: false, message: 'No hay correo remitente configurado' };
  }

  const ticketData: TicketEmailData = {
    storeName: config.storeName,
    logoUrl: config.logoUrl || undefined,
    accentColor: config.emailAccentColor || undefined,
    folio: data.folio,
    fecha: data.fecha,
    cajero: data.cajero,
    items: data.items,
    subtotal: data.subtotal,
    iva: data.iva,
    total: data.total,
    paymentMethod: data.paymentMethod,
    ticketFooter: config.emailFooterText || config.ticketFooter || undefined,
  };

  const template = ticketEmailTemplate(ticketData);
  const subject = config.emailSubjectPrefix
    ? `${config.emailSubjectPrefix} ${template.subject}`
    : template.subject;

  const result = await sendEmail(
    { to: recipient, subject, html: template.html, text: template.text },
    config.emailFrom,
    config.emailFromName || config.storeName,
  );

  if (result.success) {
    logger.info('Ticket email sent', {
      action: 'email_ticket',
      ...recipientLog,
      folio: data.folio,
      messageId: result.messageId,
    });
    return { success: true, message: 'Ticket enviado por correo' };
  }

  logger.error('Failed to send ticket email', {
    action: 'email_ticket',
    ...recipientLog,
    folio: data.folio,
    error: result.error,
  });

  return { success: false, message: 'Error al enviar el ticket por correo' };
}

export const sendTicketEmailAction = withLogging('email.sendTicketEmail', _sendTicketEmailAction);
