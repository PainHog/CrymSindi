import { describe, it, expect } from 'vitest';
import { BACKSTORIES, backstoryFor } from './backstories';

describe('crew backstories', () => {
  it('is stable for a given id', () => {
    expect(backstoryFor('m1')).toBe(backstoryFor('m1'));
    expect(backstoryFor('member-xyz')).toBe(backstoryFor('member-xyz'));
  });

  it('always returns a line from the pool', () => {
    for (const id of ['m1', 'm2', 'm3', 'zzz', '', 'a-very-long-member-id-42']) {
      expect(BACKSTORIES).toContain(backstoryFor(id));
    }
  });

  it('spreads across the pool (not everyone gets the same line)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) seen.add(backstoryFor(`m${i}`));
    expect(seen.size).toBeGreaterThan(5);
  });
});
