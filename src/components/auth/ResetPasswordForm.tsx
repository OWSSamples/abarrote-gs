'use client';

import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

/** Keeps the legacy route compatible with Cognito's code-based recovery flow. */
export function ResetPasswordForm() {
  return <ForgotPasswordForm />;
}
