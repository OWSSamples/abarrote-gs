'use server';

import { requireOwner } from '@/lib/auth/guard';
import { withLogging } from '@/lib/errors';
import { sendEmail } from '@/lib/email';
import { testEmailTemplate } from '@/lib/email-templates';
import { logger } from '@/lib/logger';

/**
 * Send a test email to verify AWS SES integration.
 */
async function _sendTestEmailAction(params: {
  to: string;
  fromEmail: string;
  fromName: string;
  storeName: string;
  logoUrl?: string;
}): Promise<{ success: boolean; message: string }> {
  await requireOwner();

  const template = testEmailTemplate(params.storeName, params.logoUrl);

  const result = await sendEmail(
    { to: params.to, subject: template.subject, html: template.html, text: template.text },
    params.fromEmail,
    params.fromName,
  );

  if (result.success) {
    logger.info('Test email sent', { action: 'email_test', to: params.to, messageId: result.messageId });
    return { success: true, message: `Correo de prueba enviado a ${params.to}` };
  }

  return { success: false, message: result.error || 'Error al enviar correo de prueba' };
}

export const sendTestEmailAction = withLogging('email.sendTestEmail', _sendTestEmailAction);
