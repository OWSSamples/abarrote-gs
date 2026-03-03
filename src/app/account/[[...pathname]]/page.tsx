'use client';

import { AccountView } from '@neondatabase/neon-js/auth/react/ui';

export default function AccountPage() {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f6f6f7',
    }}>
      <AccountView />
    </div>
  );
}
