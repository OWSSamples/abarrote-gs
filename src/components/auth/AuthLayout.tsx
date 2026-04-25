'use client';

import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      className="auth-background"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        background: '#f3f4f6',
      }}
    >
      {children}

      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '0',
          right: '0',
          textAlign: 'center',
          padding: '0 16px',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: '#fff',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'inline-block',
            padding: '6px 16px',
            borderRadius: '20px',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          &copy; {new Date().getFullYear()}, Opendex Web Services, Inc. o sus empresas afiliadas. Todos los derechos
          reservados.
        </p>
      </div>
    </div>
  );
}
