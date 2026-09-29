// -----------------------------------------------------------------------------
// SCENE LAYER — feature flag + capability checks
// -----------------------------------------------------------------------------
// The animated Phaser actor layer is additive polish over the map. Its state is
// tri-valued and stored in localStorage under 'nf/scene':
//   * unset  → AUTO: on, unless the OS/browser requests reduced motion
//   * 'on'   → the player explicitly turned it on (overrides reduced motion —
//              an explicit opt-in to animation is a deliberate choice)
//   * 'off'  → the player explicitly turned it off (always off; the static map)
// All reads are guarded so this is safe in any environment.
// -----------------------------------------------------------------------------

const KEY = 'nf/scene';

function pref(): 'on' | 'off' | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    return null;
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

/** Whether the animated scene layer should be mounted right now. */
export function sceneEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const p = pref();
  if (p === 'off') return false;
  if (p === 'on') return true; // explicit opt-in overrides reduced motion
  return !prefersReducedMotion(); // AUTO: on unless the system asks otherwise
}

/** Record the player's explicit choice (persists) and let the live layer react. */
export function setSceneEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* storage blocked — the choice just won't persist */
  }
  try {
    window.dispatchEvent(new Event('nf-scene-toggle'));
  } catch {
    /* no window (SSR/tests) — nothing listening anyway */
  }
}
