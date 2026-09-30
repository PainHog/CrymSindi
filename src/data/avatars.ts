// -----------------------------------------------------------------------------
// CREW AVATARS (portraits)
// -----------------------------------------------------------------------------
// A stable, clean line-art portrait for each crew member, generated OFFLINE from
// the member id with DiceBear (MIT core + the CC0 "lorelei" style — public
// domain, no attribution, no external requests, so the "100% client-side" claim
// holds and it works inside itch's iframe). Derived from the id like the
// backstory, so a given member always has the same face. Swapping `lorelei` for
// another CC0 style (notionists, openPeeps, thumbs, …) is a one-line change.
// -----------------------------------------------------------------------------

import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';

const cache = new Map<string, string>();

/** A stable, offline-generated portrait (data URI) for a crew member id. */
export function avatarFor(id: string): string {
  const cached = cache.get(id);
  if (cached) return cached;
  const uri = createAvatar(lorelei, {
    seed: id,
    size: 64,
    radius: 12,
    backgroundColor: ['1b2436', '241a2b', '17242b', '2a1f2e'],
    backgroundType: ['solid'],
  }).toDataUri();
  cache.set(id, uri);
  return uri;
}
