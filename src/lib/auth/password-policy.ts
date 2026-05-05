/**
 * Password strength validation matching Cognito's default password policy:
 *   - Min 8 chars
 *   - At least 1 lowercase
 *   - At least 1 uppercase
 *   - At least 1 number
 *   - At least 1 special char
 *
 * Used by:
 *   - LoginForm.tsx (NEW_PASSWORD_REQUIRED challenge)
 *   - ResetPasswordForm.tsx
 *   - ChangePasswordForm.tsx (if/when added)
 */

export interface PasswordRule {
  id: string;
  label: string;
  test: (pwd: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: 'Mínimo 8 caracteres', test: (p) => p.length >= 8 },
  { id: 'lowercase', label: 'Una letra minúscula', test: (p) => /[a-z]/.test(p) },
  { id: 'uppercase', label: 'Una letra mayúscula', test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'Un número', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'Un símbolo (!@#$...)', test: (p) => /[^A-Za-z0-9]/.test(p) },
] as const;

export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'strong';

export interface PasswordEvaluation {
  passed: number;
  total: number;
  strength: PasswordStrength;
  isValid: boolean;
  failedRules: readonly PasswordRule[];
}

export function evaluatePassword(password: string): PasswordEvaluation {
  if (!password) {
    return { passed: 0, total: PASSWORD_RULES.length, strength: 'empty', isValid: false, failedRules: PASSWORD_RULES };
  }
  const passedRules = PASSWORD_RULES.filter((r) => r.test(password));
  const failedRules = PASSWORD_RULES.filter((r) => !r.test(password));
  const passed = passedRules.length;
  const total = PASSWORD_RULES.length;
  const isValid = passed === total;
  const strength: PasswordStrength = passed <= 2 ? 'weak' : passed <= 4 ? 'fair' : 'strong';
  return { passed, total, strength, isValid, failedRules };
}
