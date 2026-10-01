# Map actor art

The map-actor textures in this folder (`nf_car*`, `nf_cruiser_*`, `nf_ped*`)
are derived from **Kenney** CC0 asset packs:

- **Racing Pack** — cars and characters — https://kenney.nl/assets/racing-pack

License: **Creative Commons Zero (CC0 1.0)** —
https://creativecommons.org/publicdomain/zero/1.0/
Free for personal, educational and commercial use. Crediting Kenney
(www.kenney.nl) is appreciated but not required.

Processing applied (offline): rotated to face east, desaturated/tinted toward
the game's neon-noir palette, trimmed, and scaled to the scene's actor sizes.
Police cruisers add a baked red/blue light bar. They load under the texture
keys in `../atlas.ts`; the runtime placeholders remain the fallback.
