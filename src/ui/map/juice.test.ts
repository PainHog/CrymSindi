import { describe, it, expect } from 'vitest';
import { floaterFromEvent } from './juice';

describe('floaterFromEvent', () => {
  it('floats a clean take as "good"', () => {
    expect(floaterFromEvent({ kind: 'collect', payout: 1200, success: true, flawless: false })).toEqual({
      payout: 1200,
      tone: 'good',
      flawless: false,
    });
  });

  it('carries the flawless flag through', () => {
    const f = floaterFromEvent({ kind: 'collect', payout: 500, success: true, flawless: true });
    expect(f?.flawless).toBe(true);
  });

  it('floats a failed-but-paid job as "bad"', () => {
    const f = floaterFromEvent({ kind: 'collect', payout: 80, success: false, flawless: false });
    expect(f?.tone).toBe('bad');
  });

  it('does not float a zero-take collect', () => {
    expect(floaterFromEvent({ kind: 'collect', payout: 0, success: false, flawless: false })).toBeNull();
  });

  it('does not float non-collect events', () => {
    expect(floaterFromEvent({ kind: 'launch' })).toBeNull();
    expect(floaterFromEvent({ kind: 'purchase' })).toBeNull();
    expect(floaterFromEvent({ kind: 'prestige' })).toBeNull();
    expect(floaterFromEvent({ kind: 'error' })).toBeNull();
    expect(floaterFromEvent(null)).toBeNull();
  });
});
