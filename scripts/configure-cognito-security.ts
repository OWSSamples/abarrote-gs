/**
 * Enables optional TOTP MFA and Cognito threat protection in audit mode while
 * preserving the complete current User Pool configuration.
 *
 * Review only:
 *   bun scripts/configure-cognito-security.ts --profile opendex-admin
 *
 * Apply:
 *   bun scripts/configure-cognito-security.ts --profile opendex-admin --apply
 */

import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
  GetUserPoolMfaConfigCommand,
  SetUserPoolMfaConfigCommand,
  UpdateUserPoolCommand,
  type UpdateUserPoolCommandInput,
} from '@aws-sdk/client-cognito-identity-provider';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });

interface Options {
  apply: boolean;
  profile?: string;
}

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const profileIndex = args.indexOf('--profile');
  return {
    apply: args.includes('--apply'),
    profile: profileIndex >= 0 ? args[profileIndex + 1] : undefined,
  };
}

function configureAwsProfile(profile?: string): void {
  if (!profile) return;
  process.env.AWS_PROFILE = profile;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_SESSION_TOKEN;
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const options = parseOptions();
  configureAwsProfile(options.profile);

  const region = requireEnvironment('COGNITO_REGION');
  const userPoolId = requireEnvironment('COGNITO_USER_POOL_ID');
  const client = new CognitoIdentityProviderClient({ region });

  const [description, currentMfa] = await Promise.all([
    client.send(new DescribeUserPoolCommand({ UserPoolId: userPoolId })),
    client.send(new GetUserPoolMfaConfigCommand({ UserPoolId: userPoolId })),
  ]);
  const pool = description.UserPool;
  if (!pool) throw new Error('Cognito User Pool was not found');
  if (pool.UserPoolTier !== 'PLUS') {
    throw new Error('Cognito User Pool must use the PLUS tier for threat protection');
  }

  console.log(`Current MFA mode: ${currentMfa.MfaConfiguration ?? 'OFF'}`);
  console.log(`Current threat protection: ${pool.UserPoolAddOns?.AdvancedSecurityMode ?? 'OFF'}`);
  console.log('Desired MFA mode: OPTIONAL with TOTP');
  console.log('Desired threat protection: AUDIT');

  if (!options.apply) {
    console.log('Review only. No Cognito changes were made.');
    return;
  }

  await client.send(new SetUserPoolMfaConfigCommand({
    UserPoolId: userPoolId,
    SmsMfaConfiguration: currentMfa.SmsMfaConfiguration,
    EmailMfaConfiguration: currentMfa.EmailMfaConfiguration,
    WebAuthnConfiguration: currentMfa.WebAuthnConfiguration,
    SoftwareTokenMfaConfiguration: { Enabled: true },
    MfaConfiguration: 'OPTIONAL',
  }));

  const updateInput: UpdateUserPoolCommandInput = {
    UserPoolId: userPoolId,
    Policies: pool.Policies,
    DeletionProtection: pool.DeletionProtection,
    LambdaConfig: pool.LambdaConfig,
    AutoVerifiedAttributes: pool.AutoVerifiedAttributes,
    SmsVerificationMessage: pool.SmsVerificationMessage,
    EmailVerificationMessage: pool.EmailVerificationMessage,
    EmailVerificationSubject: pool.EmailVerificationSubject,
    VerificationMessageTemplate: pool.VerificationMessageTemplate,
    SmsAuthenticationMessage: pool.SmsAuthenticationMessage,
    UserAttributeUpdateSettings: pool.UserAttributeUpdateSettings,
    MfaConfiguration: 'OPTIONAL',
    DeviceConfiguration: pool.DeviceConfiguration,
    EmailConfiguration: pool.EmailConfiguration,
    SmsConfiguration: pool.SmsConfiguration,
    UserPoolTags: pool.UserPoolTags,
    AdminCreateUserConfig: pool.AdminCreateUserConfig,
    UserPoolAddOns: {
      ...pool.UserPoolAddOns,
      AdvancedSecurityMode: 'AUDIT',
    },
    AccountRecoverySetting: pool.AccountRecoverySetting,
    PoolName: pool.Name,
    UserPoolTier: pool.UserPoolTier,
    KeyConfiguration: pool.KeyConfiguration,
    IssuerConfiguration: pool.IssuerConfiguration,
  };
  await client.send(new UpdateUserPoolCommand(updateInput));

  const [updatedDescription, updatedMfa] = await Promise.all([
    client.send(new DescribeUserPoolCommand({ UserPoolId: userPoolId })),
    client.send(new GetUserPoolMfaConfigCommand({ UserPoolId: userPoolId })),
  ]);
  if (updatedMfa.MfaConfiguration !== 'OPTIONAL' || !updatedMfa.SoftwareTokenMfaConfiguration?.Enabled) {
    throw new Error('Cognito MFA verification failed');
  }
  if (updatedDescription.UserPool?.UserPoolAddOns?.AdvancedSecurityMode !== 'AUDIT') {
    throw new Error('Cognito threat protection verification failed');
  }

  console.log('Cognito MFA is OPTIONAL with TOTP enabled.');
  console.log('Cognito threat protection is running in AUDIT mode.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Cognito security configuration failed');
  process.exitCode = 1;
});
