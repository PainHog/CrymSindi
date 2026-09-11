import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGame } from '../../store/GameContext';

/**
 * Wraps the app and gives it a brief shake on a flawless score — the peak
 * moment of the loop. `children` is passed as a stable prop from App, so this
 * re-rendering on events does not re-render the whole tree. The shake keyframes
 * are disabled under prefers-reduced-motion in CSS.
 */
export function ScreenShake({ children }: { children: ReactNode }) {
  const { event, eventId } = useGame();
  const [shaking, setShaking] = useState(false);
  const lastId = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (eventId === lastId.current || !event) return;
    lastId.current = eventId;
    if (event.kind === 'collect' && event.success && event.flawless) {
      setShaking(false);
      // rAF so removing then re-adding the class restarts the animation.
      requestAnimationFrame(() => setShaking(true));
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setShaking(false), 450);
    }
  }, [event, eventId]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return <div className={`shake-root ${shaking ? 'shake' : ''}`}>{children}</div>;
}
