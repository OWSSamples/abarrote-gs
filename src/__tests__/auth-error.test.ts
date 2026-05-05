import { describe, it, expect, vi } from 'vitest';

// Mock cognito-admin before importing guard
vi.mock('@/lib/cognito-admin', () => ({
  verifyIdToken: vi.fn(),
}));

vi.mock('@/db', () => ({ db: {} }));

const { AuthError } = await import('@/lib/auth/guard');

describe('AuthError', () => {
  it('creates with default status 401', () => {
    const err = new AuthError('No auth');
    expect(err.message).toBe('No auth');
    expect(err.status).toBe(401);
    expect(err.name).toBe('AuthError');
    expect(err).toBeInstanceOf(Error);
  });

  it('accepts custom status code', () => {
    const err = new AuthError('Forbidden', 403);
    expect(err.status).toBe(403);
  });
});
