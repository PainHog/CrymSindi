// -----------------------------------------------------------------------------
// SCENE LAYER — feature flag + capability checks
// -----------------------------------------------------------------------------
// The animated Phaser actor layer is additive polish over the map. It defaults
// ON, but we never mount it when the player has asked for reduced motion, and a
// localStorage kill-switch ('nf/scene' = 'off') disables it entirely so a device
// that struggles (or a player who dislikes it) always has a way back to the
// static map. Pure reads, all guarded — safe in any environment.
// -----------------------------------------------------------------------------

const KEY = 'nf/scene';

/** True if the player explicitly turned the animated layer off. */
function killed(): boolean {
  try {
    return localStorage.getItem(KEY) === 'off';
  } catch {
    return false;
  }
}

/** True if the OS/browser requests reduced motion (accessibility). */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Whether the animated scene layer should mount right now. */
export function sceneEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (killed()) return false;
  if (prefersReducedMotion()) return false;
  return true;
}

/** Turn the animated layer on/off (persists). Off falls back to the static map. */
export function setSceneEnabled(on: boolean): void {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, 'off');
  } catch {
    /* storage blocked — the choice just won't persist */
  }
}
