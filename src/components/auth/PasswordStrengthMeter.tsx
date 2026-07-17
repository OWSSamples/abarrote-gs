'use client';

import { Box, BlockStack, Text, InlineStack } from '@shopify/polaris';
import { evaluatePassword, PASSWORD_RULES } from '@/lib/auth/password-policy';
import { CheckmarkCircle16Filled, DismissCircle16Filled } from '@fluentui/react-icons';

interface PasswordStrengthMeterProps {
  password: string;
  showRules?: boolean;
}

const STRENGTH_COLORS = {
  empty: '#e1e3e5',
  weak: '#d72c0d',
  fair: '#ffc453',
  strong: '#008060',
} as const;

const STRENGTH_LABELS = {
  empty: '',
  weak: 'Débil',
  fair: 'Aceptable',
  strong: 'Fuerte',
} as const;

export function PasswordStrengthMeter({ password, showRules = true }: PasswordStrengthMeterProps) {
  const evaluation = evaluatePassword(password);
  const { passed, total, strength } = evaluation;

  if (!password) return null;

  const percentage = (passed / total) * 100;

  return (
    <Box paddingBlockStart="200">
      <BlockStack gap="200">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={passed}
          aria-label={`Fuerza de contraseña: ${STRENGTH_LABELS[strength]}`}
          style={{
            width: '100%',
            height: '4px',
            backgroundColor: STRENGTH_COLORS.empty,
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${percentage}%`,
              height: '100%',
              backgroundColor: STRENGTH_COLORS[strength],
              transition: 'width 200ms ease, background-color 200ms ease',
            }}
          />
        </div>
        {strength !== 'empty' && (
          <Text as="span" variant="bodySm" tone={strength === 'strong' ? 'success' : strength === 'weak' ? 'critical' : 'subdued'}>
            {STRENGTH_LABELS[strength]}
          </Text>
        )}
        {showRules && (
          <BlockStack gap="100">
            {PASSWORD_RULES.map((rule) => {
              const passed = rule.test(password);
              return (
                <InlineStack key={rule.id} gap="200" blockAlign="center">
                  <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center' }}>
                    {passed ? (
                      <CheckmarkCircle16Filled style={{ color: 'var(--p-color-icon-success, #008060)' }} />
                    ) : (
                      <DismissCircle16Filled style={{ color: 'var(--p-color-icon-secondary, #8c9196)' }} />
                    )}
                  </div>
                  <Text as="span" variant="bodySm" tone={passed ? 'success' : 'subdued'}>
                    {rule.label}
                  </Text>
                </InlineStack>
              );
            })}
          </BlockStack>
        )}
      </BlockStack>
    </Box>
  );
}
