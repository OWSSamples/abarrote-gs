'use client';

import { TextField, Select, BlockStack, InlineError, Text } from '@shopify/polaris';
import type { TextFieldProps, SelectProps } from '@shopify/polaris';
import type { ReactNode } from 'react';

// ── Types ──

interface BaseFieldProps {
  /** Field label */
  label: string;
  /** Error message (from Zod or manual) */
  error?: string;
  /** Help text below the field */
  helpText?: string;
  /** Required indicator */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

interface TextFieldFormProps extends BaseFieldProps {
  type: 'text' | 'number' | 'email' | 'tel' | 'url' | 'password';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  multiline?: number;
  maxLength?: number;
  autoComplete?: string;
  min?: number;
  max?: number;
  step?: number;
}

interface SelectFormProps extends BaseFieldProps {
  type: 'select';
  value: string;
  onChange: (value: string) => void;
  options: SelectProps['options'];
  placeholder?: string;
}

type FormFieldProps = TextFieldFormProps | SelectFormProps;

/**
 * FormField — Unified form field wrapper.
 *
 * Combines label + input + error + help text with consistent styling.
 * Supports text inputs and select dropdowns via `type` discriminator.
 *
 * @example
 * <FormField
 *   type="text"
 *   label="Nombre del producto"
 *   value={name}
 *   onChange={setName}
 *   error={errors.name}
 *   required
 * />
 *
 * <FormField
 *   type="select"
 *   label="Categoría"
 *   value={category}
 *   onChange={setCategory}
 *   options={categoryOptions}
 * />
 *
 * <FormField
 *   type="number"
 *   label="Precio"
 *   value={price}
 *   onChange={setPrice}
 *   prefix="$"
 *   min={0}
 *   step={0.01}
 * />
 */
export function FormField(props: FormFieldProps) {
  const { label, error, helpText, required, disabled, type } = props;

  if (type === 'select') {
    const { value, onChange, options, placeholder } = props;
    return (
      <Select
        label={required ? `${label} *` : label}
        options={options}
        value={value}
        onChange={onChange}
        error={error}
        helpText={helpText}
        disabled={disabled}
        placeholder={placeholder}
      />
    );
  }

  const {
    value,
    onChange,
    placeholder,
    prefix,
    suffix,
    multiline,
    maxLength,
    autoComplete = 'off',
    min,
    max,
    step,
  } = props;

  return (
    <TextField
      label={required ? `${label} *` : label}
      type={type === 'password' ? 'password' : type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'tel' ? 'tel' : type === 'url' ? 'url' : 'text'}
      value={value}
      onChange={onChange}
      error={error}
      helpText={helpText}
      disabled={disabled}
      placeholder={placeholder}
      prefix={prefix}
      suffix={suffix}
      multiline={multiline}
      maxLength={maxLength}
      autoComplete={autoComplete}
      min={min}
      max={max}
      step={step}
      requiredIndicator={required}
    />
  );
}
