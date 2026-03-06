'use client';

import { InlineStack } from '@shopify/polaris';
import Image from 'next/image';

interface CustomTopBarProps {
  userMenu: React.ReactNode;
}

export function CustomTopBar({ userMenu }: CustomTopBarProps) {
  return (
    <div
      style={{
        height: '56px',
        backgroundColor: '#1a1a1a',
        borderBottom: '1px solid #303030',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left side: Logo */}
      <InlineStack gap="400" blockAlign="center">
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <Image
            src="/logo.svg"
            alt="Opendex Kiosko"
            width={140}
            height={36}
            priority
            style={{ display: 'block' }}
          />
        </div>
      </InlineStack>

      {/* Right side: User menu */}
      <div>{userMenu}</div>
    </div>
  );
}
