'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Toaster } from 'sileo';
import 'sileo/styles.css';

const LoginForm = dynamic(() => import('@/components/auth/LoginForm').then((mod) => mod.LoginForm));
const RegisterForm = dynamic(() => import('@/components/auth/RegisterForm').then((mod) => mod.RegisterForm));
const ForgotPasswordForm = dynamic(() =>
  import('@/components/auth/ForgotPasswordForm').then((mod) => mod.ForgotPasswordForm),
);
const ResetPasswordForm = dynamic(() =>
  import('@/components/auth/ResetPasswordForm').then((mod) => mod.ResetPasswordForm),
);
const MfaRecoveryForm = dynamic(() => import('@/components/auth/MfaRecoveryForm').then((mod) => mod.MfaRecoveryForm));
const AcceptInvitationForm = dynamic(() =>
  import('@/components/auth/AcceptInvitationForm').then((mod) => mod.AcceptInvitationForm),
);
const AuthCallbackHandler = dynamic(() =>
  import('@/components/auth/AuthCallbackHandler').then((mod) => mod.AuthCallbackHandler),
);

export default function AuthPage() {
  const params = useParams();
  const pathname = params.pathname as string[] | undefined;
  const route = pathname?.[0] || 'login';
  const usesLayeredCard = route !== 'callback';

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
      case 'accept-invitation':
        return <AcceptInvitationForm />;
      case 'callback':
        return <AuthCallbackHandler />;
      default:
        return <LoginForm />;
    }
  };

  return (
    <>
      <Toaster position="top-right" theme="light" />
      <AuthLayout layered={usesLayeredCard} wide={route === 'register'}>
        {renderAuthForm()}
      </AuthLayout>
    </>
  );
}
