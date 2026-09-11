import { describe, it, expect } from 'vitest';
import { formatCash, formatNumber } from './format';

describe('formatNumber / formatCash', () => {
  it('shows exact values with separators below the abbreviation threshold', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(350)).toBe('350');
    expect(formatNumber(1240)).toBe('1,240');
    expect(formatNumber(99_999)).toBe('99,999');
    expect(formatCash(1240)).toBe('$1,240');
    expect(formatCash(45_000)).toBe('$45,000');
  });

  it('abbreviates large values with K/M/B/T suffixes', () => {
    expect(formatNumber(100_000)).toBe('100K');
    expect(formatNumber(600_000)).toBe('600K');
    expect(formatNumber(1_240_000)).toBe('1.24M');
    expect(formatNumber(2_760_000_000)).toBe('2.76B');
    expect(formatNumber(1_000_000_000_000)).toBe('1T');
    expect(formatCash(1_500_000)).toBe('$1.5M');
  });

  it('rolls a value that rounds up to the next unit', () => {
    // 999,999 -> 999.999K would round to "1000K"; must roll to ~1M.
    expect(formatNumber(999_999)).toBe('1M');
  });

  it('trims trailing zeros and handles negatives', () => {
    expect(formatNumber(2_000_000)).toBe('2M');
    expect(formatCash(-1_500_000)).toBe('-$1.5M');
    expect(formatCash(-500)).toBe('-$500');
  });
});
