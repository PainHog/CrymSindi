// -----------------------------------------------------------------------------
// SAVE MIGRATIONS
// -----------------------------------------------------------------------------
// A version bump used to discard every existing save (loadGame rejected any save
// whose `version` didn't match). This walks an older save forward to the current
// schema instead, so a player's progress survives an update.
//
// How to bump the schema safely:
//   1. Raise `config.version` to N.
//   2. Add MIGRATIONS[N - 1] here — a function that takes a save at version N-1
//      and returns it at version N (bump `version`, fill/rename fields).
// For a purely additive change (a new OPTIONAL field), the migration only needs
// to bump the version — `clampState` runs afterward and fills the default. Add a
// migration anyway so the version walk has a path; without one, an old save is
// still discarded (fail-safe, not silent corruption).
// -----------------------------------------------------------------------------

/** Upgrades a save object by exactly one schema version. */
export type SaveMigration = (save: Record<string, unknown>) => Record<string, unknown>;

/** Migrations keyed by the version they upgrade FROM (from N to N+1). */
export const MIGRATIONS: Record<number, SaveMigration> = {
  // Example, for when config.version becomes 4:
  //   3: (s) => ({ ...s, version: 4 }),
};

/**
 * Walk a parsed save forward to `target`.
 * - `version === target` → returned unchanged.
 * - `version < target` → each step's migration is applied in turn; a missing
 *   step (no path forward) returns null (the save is discarded, not corrupted).
 * - `version > target` (a save written by a NEWER build) → null; never downgrade.
 * - anything without a numeric `version` → null.
 * `migrations` is injectable for testing.
 */
export function migrateSave(
  parsed: unknown,
  target: number,
  migrations: Record<number, SaveMigration> = MIGRATIONS,
): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== 'object') return null;
  let s = parsed as Record<string, unknown>;
  if (typeof s.version !== 'number') return null;
  if (s.version > target) return null;

  let guard = 0;
  while ((s.version as number) < target) {
    const from = s.version as number;
    const step = migrations[from];
    if (!step) return null; // no path from this version — discard, don't guess
    s = step(s);
    const next = s?.version;
    if (typeof next !== 'number' || next <= from) return null; // must advance
    if (++guard > 1000) return null; // runaway guard
  }
  return s;
}
