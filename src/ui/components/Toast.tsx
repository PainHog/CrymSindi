import { useEffect, useState } from 'react';
import { useGame } from '../../store/GameContext';

/** Transient message shown on actions (success/error/collect results). */
export function Toast() {
  const { message, messageId } = useGame();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), 3500);
    return () => window.clearTimeout(id);
  }, [messageId, message]);

  if (!message || !visible) return null;
  return (
    <div className="toast" key={messageId} role="status">
      {message}
    </div>
  );
}
