'use client';

import { InlineStack, Icon, Text } from '@shopify/polaris';
import { MenuIcon, SearchIcon, GlobeIcon, NotificationIcon } from '@shopify/polaris-icons';
import Image from 'next/image';

interface CustomTopBarProps {
  userMenu: React.ReactNode;
  onNavigationToggle?: () => void;
}

export function CustomTopBar({ userMenu, onNavigationToggle }: CustomTopBarProps) {
  return (
    <div
      style={{
        height: '56px',
        backgroundColor: '#0b0b0b',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left side: Logo & Mobile Nav Toggle */}
      <InlineStack gap="400" blockAlign="center">
        {onNavigationToggle && (
          <button
            onClick={onNavigationToggle}
            className="mobile-nav-toggle"
            aria-label="Abrir menú"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '8px',
              cursor: 'pointer',
              color: '#e3e5e7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon source={MenuIcon} tone="inherit" />
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
          <Image
            src="/logo.svg"
            alt="Shopify"
            width={120}
            height={32}
            priority
            style={{ display: 'block', filter: 'brightness(0) invert(1)' }}
          />
        </div>
      </InlineStack>

      {/* Middle: Search Bar */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#202123',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          padding: '4px 12px',
          border: '1px solid #303030'
        }}>
          <div style={{ color: '#8a8a8a', display: 'flex', alignItems: 'center' }}>
            <Icon source={SearchIcon} tone="inherit" />
          </div>
          <input
            type="text"
            placeholder="Buscar"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              padding: '8px 12px',
              width: '100%',
              outline: 'none',
              fontSize: '14px',
            }}
          />
          <div style={{
            display: 'flex',
            gap: '4px',
            fontSize: '11px',
            fontWeight: '600',
            backgroundColor: '#303030',
            padding: '2px 6px',
            borderRadius: '4px',
            color: '#8a8a8a',
            border: '1px solid #404040'
          }}>
            <span>CTRL</span>
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Right side: Icons & User menu */}
      <InlineStack gap="100" blockAlign="center">
        <div style={{ color: '#e3e5e7', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center' }}>
          <Icon source={GlobeIcon} tone="inherit" />
        </div>
        <div style={{ color: '#e3e5e7', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', position: 'relative' }}>
          <Icon source={NotificationIcon} tone="inherit" />
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            backgroundColor: '#d82c0d',
            color: 'white',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            border: '2px solid #0b0b0b'
          }}>
            1
          </div>
        </div>
        <div style={{ marginLeft: '8px' }}>
          {userMenu}
        </div>
      </InlineStack>
    </div>
  );
}
