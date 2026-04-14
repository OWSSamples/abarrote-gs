'use client';

import { useState, useCallback, useMemo } from 'react';
import { Popover, ActionList, TextField, Icon, Box } from '@shopify/polaris';
import { SelectIcon } from '@shopify/polaris-icons';

interface Option {
  label: string;
  value: string;
  disabled?: boolean;
}

interface FormSelectProps {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helpText?: string;
  placeholder?: string;
}

export function FormSelect({
  label,
  options,
  value,
  onChange,
  error,
  helpText,
  placeholder = 'Seleccionar...',
}: FormSelectProps) {
  const [active, setActive] = useState(false);
  const toggleActive = useCallback(() => setActive((a) => !a), []);

  const selectedOption = useMemo(() => options.find((opt) => opt.value === value), [options, value]);

  const handleSelect = useCallback(
    (selectedValue: string) => {
      onChange(selectedValue);
      setActive(false);
    },
    [onChange],
  );

  const activator = (
    <div onClick={toggleActive} style={{ cursor: 'pointer' }}>
      <TextField
        label={label}
        value={selectedOption ? selectedOption.label : ''}
        placeholder={placeholder}
        onChange={() => {}}
        autoComplete="off"
        readOnly
        error={error}
        helpText={helpText}
        suffix={<Icon source={SelectIcon} tone="subdued" />}
      />
    </div>
  );

  return (
    <Popover active={active} activator={activator} onClose={toggleActive} fullWidth autofocusTarget="none">
      <Box minWidth="100%" maxWidth="100%">
        <ActionList
          actionRole="menuitem"
          items={options.map((opt) => ({
            content: opt.label,
            active: opt.value === value,
            disabled: opt.disabled,
            onAction: () => handleSelect(opt.value),
          }))}
        />
      </Box>
    </Popover>
  );
}
