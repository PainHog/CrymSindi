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

  it('abbreviates large values across every unit', () => {
    expect(formatNumber(100_000)).toBe('100K');
    expect(formatNumber(600_000)).toBe('600K');
    expect(formatNumber(1_240_000)).toBe('1.24M');
    expect(formatNumber(2_760_000_000)).toBe('2.76B');
    expect(formatNumber(1e12)).toBe('1T');
    expect(formatNumber(3.4e15)).toBe('3.4Qa');
    expect(formatNumber(5e18)).toBe('5Qi');
    expect(formatNumber(7e33)).toBe('7Dc');
    expect(formatCash(1_500_000)).toBe('$1.5M');
  });

  it('rolls a value that rounds up to the next unit', () => {
    expect(formatNumber(999_999)).toBe('1M'); // 999.999K would round to "1000K"
    expect(formatNumber(999_999_999)).toBe('1B');
  });

  it('trims trailing zeros and handles negatives', () => {
    expect(formatNumber(2_000_000)).toBe('2M');
    expect(formatCash(-1_500_000)).toBe('-$1.5M');
    expect(formatCash(-500)).toBe('-$500');
  });

  it("never overstates a balance (floor) or understates a cost (ceil)", () => {
    // Round-to-nearest would show both of these as 600K and mislead affordability.
    expect(formatCash(599_900, 'floor')).toBe('$599K'); // you don't have 600K
    expect(formatCash(600_001, 'ceil')).toBe('$601K'); // this costs more than 600K
    // Default nearest still rounds.
    expect(formatCash(599_900)).toBe('$600K');
    // Below the threshold, mode rounds the exact value.
    expect(formatNumber(1240.7, 'floor')).toBe('1,240');
    expect(formatNumber(1240.1, 'ceil')).toBe('1,241');
  });

  it('an exact unit boundary is not nudged by float error (ceil/floor)', () => {
    // 1.11 * 100 === 111.00000000000001 — ceil must not jump to 1.12M.
    expect(formatCash(1_110_000, 'ceil')).toBe('$1.11M');
    expect(formatCash(1_090_000, 'ceil')).toBe('$1.09M');
    expect(formatCash(1_120_000, 'ceil')).toBe('$1.12M');
    expect(formatCash(1_130_000, 'floor')).toBe('$1.13M');
    expect(formatCash(2_030_000, 'floor')).toBe('$2.03M');
    // Exact whole units stay exact under both directions.
    expect(formatCash(600_000, 'ceil')).toBe('$600K');
    expect(formatCash(600_000, 'floor')).toBe('$600K');
    expect(formatCash(1_000_000, 'ceil')).toBe('$1M');
  });

  it('floors/ceils a negative in the direction that never overstates it', () => {
    // floor(-599,900) is -600,000 (more negative), never less-negative.
    expect(formatCash(-599_900, 'floor')).toBe('-$600K');
    expect(formatCash(-599_900, 'ceil')).toBe('-$599K');
  });

  it('has no "1000Dc" sliver just below the scientific threshold', () => {
    expect(formatNumber(9.999e35)).toBe('1.00e+36');
    expect(formatNumber(9.999e35, 'ceil')).toBe('1.00e+36');
  });

  it('degrades safely on non-finite and beyond-table values', () => {
    expect(formatNumber(NaN)).toBe('0');
    expect(formatNumber(Infinity)).toBe('0');
    expect(formatCash(NaN)).toBe('$0');
    expect(formatCash(Infinity)).toBe('$0');
    // Past the last unit (Dc = 1e33) it falls back to scientific rather than "1000Dc".
    expect(formatNumber(1e36)).toBe('1.00e+36');
    expect(formatCash(1e40)).toBe('$1.00e+40');
  });
});
