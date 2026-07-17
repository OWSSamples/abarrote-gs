'use client';

import { Amplify } from 'aws-amplify';
import {
  signIn,
  signUp,
  confirmSignUp,
  resendSignUpCode,
  signOut,
  confirmSignIn,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  fetchAuthSession,
  fetchUserAttributes,
  signInWithRedirect,
  setUpTOTP,
  verifyTOTPSetup,
  updateMFAPreference,
  fetchMFAPreference,
} from 'aws-amplify/auth';

// ══════════════════════════════════════════════════════════════
// AMPLIFY CONFIGURATION
// ══════════════════════════════════════════════════════════════

const userPoolId = process.env.COGNITO_USER_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const userPoolClientId = process.env.COGNITO_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
const region = process.env.COGNITO_REGION || process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1';
const cognitoDomain = (
  process.env.COGNITO_DOMAIN ||
  process.env.NEXT_PUBLIC_COGNITO_DOMAIN ||
  ''
)
  .replace(/^https?:\/\//i, '')
  .replace(/\/+$/, '');
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const parseList = (value: string | undefined): string[] =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

if (!userPoolId || !userPoolClientId) {
  throw new Error(
    'AWS Cognito no está configurado. Define COGNITO_USER_POOL_ID y COGNITO_CLIENT_ID antes de iniciar la aplicación.',
  );
}

if (!userPoolId.startsWith(`${region}_`)) {
  throw new Error('COGNITO_REGION no coincide con la región incluida en COGNITO_USER_POOL_ID.');
}

const redirectSignIn = Array.from(
  new Set([
    `${appUrl}/auth/callback`,
    `${appUrl}/auth/callback/`,
    ...parseList(process.env.COGNITO_REDIRECT_SIGN_IN || process.env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN),
  ]),
);
const redirectSignOut = Array.from(
  new Set([`${appUrl}/auth/login`, ...parseList(process.env.COGNITO_REDIRECT_SIGN_OUT || process.env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT)]),
);
const oauthProviders = parseList(process.env.COGNITO_OAUTH_PROVIDERS || process.env.NEXT_PUBLIC_COGNITO_OAUTH_PROVIDERS).map((provider) => ({ custom: provider }));
const oauthScopes = parseList(process.env.COGNITO_OAUTH_SCOPES || process.env.NEXT_PUBLIC_COGNITO_OAUTH_SCOPES);

Amplify.configure(
  {
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        ...(cognitoDomain
          ? {
              loginWith: {
                oauth: {
                  domain: cognitoDomain,
                  scopes: oauthScopes.length ? oauthScopes : ['openid', 'email', 'phone'],
                  redirectSignIn,
                  redirectSignOut,
                  responseType: 'code' as const,
                  ...(oauthProviders.length ? { providers: oauthProviders } : {}),
                },
              },
            }
          : {}),
      },
    },
  },
  { ssr: true },
);

// ══════════════════════════════════════════════════════════════
// RE-EXPORTS
// ══════════════════════════════════════════════════════════════

export {
  signIn,
  signUp,
  confirmSignUp,
  resendSignUpCode,
  signOut,
  confirmSignIn,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  fetchAuthSession,
  fetchUserAttributes,
  signInWithRedirect,
  setUpTOTP,
  verifyTOTPSetup,
  updateMFAPreference,
  fetchMFAPreference,
  region,
  userPoolId,
  userPoolClientId,
};
