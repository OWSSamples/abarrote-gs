import { sleep } from 'workflow';

export interface UserSignupWorkflowInput {
  userId: string;
  tenantId: string;
  storeId: string;
}

export interface UserSignupWorkflowResult {
  userId: string;
  tenantId: string;
  storeId: string;
  status: 'onboarded';
}

export async function handleUserSignupWorkflow(
  input: UserSignupWorkflowInput,
): Promise<UserSignupWorkflowResult> {
  'use workflow';

  await sendSignupEmailStep(input, 'welcome');
  await sleep('1d');
  await sendSignupEmailStep(input, 'onboarding');

  return {
    userId: input.userId,
    tenantId: input.tenantId,
    storeId: input.storeId,
    status: 'onboarded',
  };
}

async function sendSignupEmailStep(
  input: UserSignupWorkflowInput,
  messageType: 'welcome' | 'onboarding',
): Promise<void> {
  'use step';

  const [
    { db },
    { stores, tenantMemberships, userIdentities },
    { and, eq },
    { sendEmail },
    { signupOnboardingEmailTemplate, signupWelcomeEmailTemplate },
    { getAppUrl },
  ] = await Promise.all([
    import('@/db'),
    import('@/db/schema'),
    import('drizzle-orm'),
    import('@/lib/email'),
    import('@/lib/email-templates'),
    import('@/lib/env'),
  ]);
  const [recipient] = await db
    .select({
      email: userIdentities.email,
      displayName: userIdentities.displayName,
      storeName: stores.name,
    })
    .from(tenantMemberships)
    .innerJoin(userIdentities, eq(userIdentities.cognitoSub, tenantMemberships.cognitoSub))
    .innerJoin(stores, eq(stores.tenantId, tenantMemberships.tenantId))
    .where(
      and(
        eq(tenantMemberships.cognitoSub, input.userId),
        eq(tenantMemberships.tenantId, input.tenantId),
        eq(tenantMemberships.status, 'active'),
        eq(stores.id, input.storeId),
        eq(stores.status, 'active'),
        eq(userIdentities.status, 'active'),
      ),
    )
    .limit(1);
  if (!recipient) {
    throw new Error('No se encontró un destinatario activo para el onboarding.');
  }

  const template = messageType === 'welcome'
    ? signupWelcomeEmailTemplate
    : signupOnboardingEmailTemplate;
  const message = template({
    storeName: recipient.storeName,
    displayName: recipient.displayName,
    appUrl: getAppUrl(),
  });
  const result = await sendEmail({ to: recipient.email, ...message });
  if (!result.success) {
    throw new Error(`No fue posible entregar el correo de ${messageType}.`);
  }
}
