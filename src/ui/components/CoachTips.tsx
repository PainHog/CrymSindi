import { useState, type ReactNode } from 'react';
import { CONFIG } from '../../data/config';
import { deriveHeat } from '../../engine';
import type { GameState } from '../../engine';
import { useGame, useNow } from '../../store/GameContext';
import { Icon, type IconName } from '../icons';

const KEY = 'heist-crew-idle/seenTips';

interface Tip {
  id: string;
  icon: IconName;
  title: string;
  body: ReactNode;
  /** Show this tip once the player reaches the moment the concept matters. */
  when: (game: GameState, now: number) => boolean;
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
    when: (g, now) => deriveHeat(g, now) >= 50,
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
    when: (g) => g.prestigeCount > 0 || g.lifetimeCash >= CONFIG.prestigeThreshold * 0.5,
  },
];

/** One-at-a-time contextual hints for Heat and prestige. Dismissal is persisted
 *  in localStorage (separate from the save) so each tip is shown only once. */
export function CoachTips() {
  const { game } = useGame();
  const now = useNow();
  const [seen, setSeen] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return new Set(raw ? raw.split(',').filter(Boolean) : []);
    } catch {
      return new Set();
    }
  });

  const tip = TIPS.find((t) => !seen.has(t.id) && t.when(game, now));
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
    <div className="coach-tip" role="note">
      <span className="coach-tip-icon">
        <Icon name={tip.icon} size={18} />
      </span>
      <div className="coach-tip-body">
        <strong className="coach-tip-title">{tip.title}</strong>
        <span className="coach-tip-text">{tip.body}</span>
      </div>
      <button className="btn small" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
