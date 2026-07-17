'use client';

import { useCallback, useMemo, useState } from 'react';
import { ActionList, BlockStack, Button, Popover, Text } from '@shopify/polaris';

export interface PolarisOptionDropdownOption {
  label: string;
  value: string;
  disabled?: boolean;
  helpText?: string;
}

interface PolarisOptionDropdownProps {
  label: string;
  labelHidden?: boolean;
  options: PolarisOptionDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  helpText?: string;
  placeholder?: string;
}

export function PolarisOptionDropdown({
  label,
  labelHidden = false,
  options,
  value,
  onChange,
  disabled = false,
  helpText,
  placeholder = 'Seleccionar',
}: PolarisOptionDropdownProps) {
  const [active, setActive] = useState(false);
  const selectedOption = useMemo(() => options.find((option) => option.value === value), [options, value]);

  const close = useCallback(() => setActive(false), []);
  const toggle = useCallback(() => setActive((current) => !current), []);

  const items = useMemo(
    () =>
      options.map((option) => ({
        content: option.label,
        helpText: option.helpText,
        active: option.value === value,
        disabled: option.disabled,
        onAction: () => {
          if (option.disabled) return;
          onChange(option.value);
          close();
        },
      })),
    [close, onChange, options, value],
  );

  const activator = (
    <Button
      accessibilityLabel={label}
      disclosure={active ? 'up' : 'down'}
      disabled={disabled}
      fullWidth
      onClick={toggle}
      textAlign="left"
    >
      {selectedOption?.label ?? placeholder}
    </Button>
  );

  return (
    <BlockStack gap="100">
      {!labelHidden && (
        <Text as="span" variant="bodyMd" fontWeight="medium">
          {label}
        </Text>
      )}
      <Popover active={active} activator={activator} onClose={close} preferredAlignment="left" fullWidth>
        <ActionList
          items={items.length > 0 ? items : [{ content: 'No hay opciones disponibles', disabled: true }]}
        />
      </Popover>
      {helpText && (
        <Text as="p" variant="bodySm" tone="subdued">
          {helpText}
        </Text>
      )}
    </BlockStack>
  );
}
