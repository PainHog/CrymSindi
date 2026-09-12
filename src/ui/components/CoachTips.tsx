import { useEffect, useState, type ReactNode } from 'react';
import { CONFIG } from '../../data/config';
import type { GameState } from '../../engine';
import { useGame } from '../../store/GameContext';
import { useHeatSnapshot } from '../hooks';
import { Icon, type IconName } from '../icons';

const KEY = 'heist-crew-idle/seenTips';

interface Tip {
  id: string;
  icon: IconName;
  title: string;
  body: ReactNode;
  /** True once the concept becomes relevant. `heat` is the bucketed current Heat. */
  when: (game: GameState, heat: number) => boolean;
}

// Contextual, one-at-a-time coaching that fills the gaps the intro banner (the
// core send/collect loop) doesn't cover: Heat and the prestige/Notoriety loop.
// Each fires when its concept first becomes relevant and is dismissed for good.
// Priority order = array order (Heat tends to matter before prestige).
const TIPS: Tip[] = [
  {
    id: 'heat',
    icon: 'heat',
    title: 'Heat is climbing',
    body: (
      <>
        Heat is how much attention the law is paying you. It rises each time you launch a job and
        cools on its own over real time. A job is resolved against the Heat you{' '}
        <strong>launched</strong> it under — so let Heat cool before committing a big score, and
        don't send every crew out at once.
      </>
    ),
    when: (_g, heat) => heat >= 50,
  },
  {
    id: 'prestige',
    icon: 'vault',
    title: 'The long game: going legit',
    body: (
      <>
        Once you've built a real operation you can <strong>go legit</strong> — retire this run for
        permanent <strong>Notoriety</strong>. You give up the run's cash and crew, but Notoriety
        buys perks in a tree that makes <em>every</em> future run stronger. It's the core of the
        long game.
      </>
    ),
    when: (g) => g.prestigeCount > 0 || g.lifetimeCash >= CONFIG.prestigeThreshold * 0.75,
  },
];

/** One-at-a-time contextual hints for Heat and prestige. A tip stays shown once
 *  its condition has fired (sticky — it won't flicker if Heat later cools) until
 *  dismissed; dismissal is persisted in localStorage (separate from the save) so
 *  each tip is shown only once. */
export function CoachTips() {
  const { game } = useGame();
  // Bucketed Heat: this component re-renders when the rounded value crosses a
  // bucket (~every 12s), not on every 250ms tick.
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
    const newly = TIPS.filter((t) => !triggered.has(t.id) && t.when(game, roundedHeat)).map((t) => t.id);
    if (newly.length > 0) setTriggered((prev) => new Set([...prev, ...newly]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, roundedHeat]);

  const tip = TIPS.find((t) => triggered.has(t.id) && !seen.has(t.id));
  if (!tip) return null;

  const dismiss = () => {
    const next = new Set(seen).add(tip.id);
    setSeen(next);
    try {
      localStorage.setItem(KEY, [...next].join(','));
    } catch {
      /* storage blocked — the tip just won't be remembered across reloads */
    }
  };

  return (
    <div className="coach-tip" role="status" aria-live="polite">
      <span className="coach-tip-icon">
        <Icon name={tip.icon} size={18} />
      </span>
      <div className="coach-tip-body">
        <strong className="coach-tip-title">{tip.title}</strong>
        <span className="coach-tip-text">{tip.body}</span>
      </div>
      <button className="btn small" onClick={dismiss} aria-label={`Dismiss tip: ${tip.title}`}>
        Got it
      </button>
    </div>
  );
}
