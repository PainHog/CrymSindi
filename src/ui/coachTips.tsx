// -----------------------------------------------------------------------------
// COACH TIPS — shared logic
// -----------------------------------------------------------------------------
// Contextual, one-at-a-time coaching that fills the gaps the intro banner (the
// core send/collect loop) doesn't cover. Each tip fires the first time its
// concept becomes relevant and is then dismissed for good (persisted in
// localStorage, separate from the save). The DATA and the trigger/seen logic
// live here; each layout (classic panel, noir map) renders the active tip in
// its own markup via useCoachTip.
// -----------------------------------------------------------------------------

import { useEffect, useState, type ReactNode } from 'react';
import { CONFIG } from '../data/config';
import { canAscend, eventNow, featuredNow, isMemberDown, type GameState } from '../engine';
import { useGame } from '../store/GameContext';
import { useHeatSnapshot } from './hooks';
import type { IconName } from './icons';

const KEY = 'heist-crew-idle/seenTips';

export interface Tip {
  id: string;
  icon: IconName;
  title: string;
  body: ReactNode;
  /** True once the concept becomes relevant. `heat` is the bucketed current
   *  Heat; `now` is a ~12s-bucketed clock (fine for slow-moving conditions). */
  when: (game: GameState, heat: number, now: number) => boolean;
}

export const HEAT_TIP: Tip = {
  id: 'heat',
  icon: 'heat',
  title: 'Heat is climbing',
  body: (
    <>
      Heat is how much attention the law is paying you. It rises each time you launch a job and
      cools on its own over real time. A job is resolved against the Heat you{' '}
      <strong>launched</strong> it under — so let Heat cool before committing a big score, and don't
      send every crew out at once.
    </>
  ),
  when: (_g, heat) => heat >= 50,
};

export const INJURY_TIP: Tip = {
  id: 'injury',
  icon: 'heat',
  title: 'A crew member is hurt',
  body: (
    <>
      A blown job can sideline someone — worse the hotter the run. They sit out until they{' '}
      <strong>recover on their own</strong>, or you can pay to <strong>patch them up</strong> from
      the crew panel. Hurt members don't count toward a job, so keep Heat down to avoid the
      injuries in the first place.
    </>
  ),
  when: (g, _heat, now) => g.members.some((m) => isMemberDown(m, now)),
};

export const FEATURED_TIP: Tip = {
  id: 'featured',
  icon: 'vault',
  title: 'A job is running hot',
  body: (
    <>
      The gold <strong>HOT</strong> pin is a <strong>featured job</strong> — it pays a big bonus for
      a limited window before the rotation moves on. The bonus is locked in the moment you launch,
      so if you can field a crew, a featured score is the best cash on the board right now.
    </>
  ),
  when: (g, _heat, now) => g.lifetimeCash >= 2000 && featuredNow(now).length > 0,
};

export const EVENTS_TIP: Tip = {
  id: 'events',
  icon: 'vault',
  title: 'The city is reacting',
  body: (
    <>
      Conditions flare up across the map — a <strong>fence paying premium</strong>, a{' '}
      <strong>blackout</strong>, a <strong>crackdown</strong>. A gold marker is worth chasing; a
      magenta one is a reason to lie low or go Ghost. The effect is locked in when you launch, and it
      only lasts a while — watch the ticker up top.
    </>
  ),
  when: (_g, _heat, now) => eventNow(now) !== null,
};

export const PRESTIGE_TIP: Tip = {
  id: 'prestige',
  icon: 'vault',
  title: 'The long game: going legit',
  body: (
    <>
      Once you've built a real operation you can <strong>go legit</strong> — retire this run for
      permanent <strong>Notoriety</strong>. You give up the run's cash and crew, but Notoriety buys
      perks in a tree that makes <em>every</em> future run stronger. It's the core of the long game.
    </>
  ),
  when: (g) => g.prestigeCount > 0 || g.lifetimeCash >= CONFIG.prestigeThreshold * 0.75,
};

export const ASCEND_TIP: Tip = {
  id: 'ascend',
  icon: 'crown',
  title: 'A second horizon: become a legend',
  body: (
    <>
      You've built enough Notoriety to <strong>ascend</strong>. Burning your Notoriety and its perk
      tree earns permanent <strong>Legend</strong> — a deeper reset that buys the stronger legend
      perks, which stick with you through every future ascension. It's the long game past prestige.
    </>
  ),
  when: (g) => canAscend(g),
};

/** Classic layout: Heat + prestige (the two the intro banner skips). */
export const BASE_TIPS: Tip[] = [HEAT_TIP, PRESTIGE_TIP];

/** Map layout: also teaches the systems the map surfaces (injuries, featured
 *  jobs, living-map events). Order is priority — most urgent/relevant first. */
export const MAP_TIPS: Tip[] = [
  HEAT_TIP,
  INJURY_TIP,
  FEATURED_TIP,
  EVENTS_TIP,
  PRESTIGE_TIP,
  ASCEND_TIP,
];

/** Drives one-at-a-time coaching over a tip set: returns the active tip (sticky
 *  once fired, so it won't flicker if the condition later goes false) and a
 *  dismiss that persists "seen" so each tip shows only once. `tips` must be a
 *  stable (module-level) array. */
export function useCoachTip(tips: Tip[]): { tip: Tip | undefined; dismiss: () => void } {
  const { game } = useGame();
  // Bucketed Heat: re-renders when the rounded value crosses a bucket (~12s),
  // not on every 250ms tick.
  const { roundedHeat } = useHeatSnapshot(game);
  const [seen, setSeen] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return new Set(raw ? raw.split(',').filter(Boolean) : []);
    } catch {
      return new Set();
    }
  });
  // Ids whose condition has fired this session; grows monotonically so a tip
  // doesn't disappear when its (instantaneous) condition later goes false.
  const [triggered, setTriggered] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const now = Date.now();
    const newly = tips
      .filter((t) => !triggered.has(t.id) && t.when(game, roundedHeat, now))
      .map((t) => t.id);
    if (newly.length > 0) setTriggered((prev) => new Set([...prev, ...newly]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, roundedHeat]);

  const tip = tips.find((t) => triggered.has(t.id) && !seen.has(t.id));

  const dismiss = () => {
    if (!tip) return;
    const next = new Set(seen).add(tip.id);
    setSeen(next);
    try {
      localStorage.setItem(KEY, [...next].join(','));
    } catch {
      /* storage blocked — the tip just won't be remembered across reloads */
    }
  };

  return { tip, dismiss };
}
