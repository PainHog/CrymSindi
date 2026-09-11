import { useEffect, useRef } from 'react';
import { useGame } from '../../store/GameContext';
import { formatCash } from '../format';

const FOCUSABLE = 'button, [href], input, [tabindex]:not([tabindex="-1"])';

function humanizeAway(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 24) return remM ? `${h}h ${remM}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH ? `${d}d ${remH}h` : `${d}d`;
}

/** "While you were away" summary shown once on return — for every player, not
 *  just Fixer owners. Only mounted when something actually happened. */
export function WelcomeBackModal() {
  const { away, actions } = useGame();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!away) return;
    returnFocusRef.current = document.activeElement;
    dialogRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        actions.dismissAway();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const list = Array.from(nodes);
      const first = list[0];
      const last = list[list.length - 1];
      // Wrap at the edges AND when focus sits on the dialog container itself
      // (focused on open), so the first keystroke can't tab out to the page.
      const within = list.includes(document.activeElement as HTMLElement);
      if (e.shiftKey && (document.activeElement === first || !within)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !within)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (returnFocusRef.current instanceof HTMLElement) returnFocusRef.current.focus();
    };
  }, [away, actions]);

  if (!away) return null;
  const { awayMs, readyCount, autoCollected, autoEarned } = away;

  return (
    <div className="modal-backdrop" role="presentation" onClick={actions.dismissAway}>
      <div
        className="welcome-card"
        role="dialog"
        aria-modal="true"
        aria-label="While you were away"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="welcome-title">While you were away</h3>
        <p className="welcome-sub">Gone for {humanizeAway(awayMs)}.</p>
        <ul className="welcome-list">
          {autoCollected > 0 && (
            <li>
              The Fixer ran <strong>{autoCollected}</strong> job{autoCollected > 1 ? 's' : ''} —{' '}
              <strong>+{formatCash(autoEarned)}</strong>
            </li>
          )}
          {readyCount > 0 && (
            <li>
              <strong>{readyCount}</strong> heist{readyCount > 1 ? 's' : ''}{' '}
              {readyCount > 1 ? 'are' : 'is'} ready to collect
            </li>
          )}
        </ul>
        <button className="btn primary welcome-close" onClick={actions.dismissAway}>
          Back to it
        </button>
      </div>
    </div>
  );
}
