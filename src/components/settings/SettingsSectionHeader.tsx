'use client';

import { Icon, Text } from '@shopify/polaris';
import type { IconSource } from '@shopify/polaris';
import './SettingsSectionHeader.css';

interface SettingsSectionHeaderProps {
  icon: IconSource;
  label: string;
}

/** Compact, non-interactive section heading shared by all settings views. */
export function SettingsSectionHeader({ icon, label }: SettingsSectionHeaderProps) {
  return (
    <div className="settings-section-header">
      <Icon source={icon} tone="base" accessibilityLabel="" />
      <Text as="h1" variant="headingLg">{label}</Text>
    </div>
  );
}
