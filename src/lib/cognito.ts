'use client';

import { Amplify } from 'aws-amplify';
import {
  signIn,
  signUp,
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

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!;
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!;
const region = process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1';
const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '';

Amplify.configure(
  {
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          oauth: {
            domain: cognitoDomain,
            scopes: ['openid', 'email', 'phone', 'aws.cognito.signin.user.admin'],
            redirectSignIn: [
              'http://localhost:3000/auth/callback',
              'https://guzman.opendex.dev/auth/callback',
              'https://guzman.opendex.dev/auth/callback/',
            ],
            redirectSignOut: [
              'http://localhost:3000/auth/login',
              'https://guzman.opendex.dev/auth/login',
            ],
            responseType: 'code',
            providers: [{ custom: 'Microsoft' }],
          },
        },
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
