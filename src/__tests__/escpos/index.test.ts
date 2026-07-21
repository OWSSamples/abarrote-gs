import { describe, it, expect } from 'vitest';
import { resolveDrawerPin } from '@/lib/escpos';

describe('escpos/index resolveDrawerPin', () => {
  it('defaults to pin 2 when unset', () => {
    expect(resolveDrawerPin()).toBe(2);
    expect(resolveDrawerPin(null)).toBe(2);
    expect(resolveDrawerPin('')).toBe(2);
  });

  it('returns pin 5 for the explicit "5" values', () => {
    expect(resolveDrawerPin('5')).toBe(5);
    expect(resolveDrawerPin('pin5')).toBe(5);
    expect(resolveDrawerPin('pin 5')).toBe(5);
  });

  it('returns pin 5 when the value contains a pin5 hint', () => {
    expect(resolveDrawerPin('Bematech pin5')).toBe(5);
    expect(resolveDrawerPin('drawer pin 5 solenoid')).toBe(5);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(resolveDrawerPin('  PIN 5  ')).toBe(5);
    expect(resolveDrawerPin('PIN5')).toBe(5);
  });

  it('returns pin 2 for any other port name', () => {
    expect(resolveDrawerPin('COM1')).toBe(2);
    expect(resolveDrawerPin('/dev/ttyUSB0')).toBe(2);
    expect(resolveDrawerPin('pin2')).toBe(2);
    // A bare "5" digit inside another number must not trigger pin 5.
    expect(resolveDrawerPin('COM15')).toBe(2);
  });
});
