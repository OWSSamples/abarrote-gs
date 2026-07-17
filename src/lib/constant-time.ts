import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

/** Compares secret-bearing strings without exposing a character-by-character timing signal. */
export function constantTimeStringEqual(expected: string, actual: string): boolean {
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  const actualDigest = createHash('sha256').update(actual, 'utf8').digest();

  return timingSafeEqual(expectedDigest, actualDigest);
}
