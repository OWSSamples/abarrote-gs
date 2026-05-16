'use client';

import { useParams } from 'next/navigation';
import { AuthLayout, LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm, MfaRecoveryForm } from '@/components/auth';
import { AuthCallbackHandler } from '@/components/auth/AuthCallbackHandler';
import { Toaster } from 'sileo';
import 'sileo/styles.css';

export default function AuthPage() {
  const params = useParams();
  const pathname = params.pathname as string[] | undefined;
  const route = pathname?.[0] || 'login';

  const renderAuthForm = () => {
    switch (route) {
      case 'login':
        return <LoginForm />;
      case 'register':
        return <RegisterForm />;
      case 'forgot-password':
        return <ForgotPasswordForm />;
      case 'reset-password':
        return <ResetPasswordForm />;
      case 'mfa-recovery':
        return <MfaRecoveryForm />;
      case 'callback':
        return <AuthCallbackHandler />;
      default:
        return <LoginForm />;
    }
  };

  return (
    <>
      <Toaster position="top-right" theme="light" />
      <AuthLayout>{renderAuthForm()}</AuthLayout>
    </>
  );
}
