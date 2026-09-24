// -----------------------------------------------------------------------------
// ICONS + AVATARS (original inline SVG - no external art)
// -----------------------------------------------------------------------------
// Small, stroke-based icons drawn on a 24x24 grid using currentColor so they
// inherit text color. Role/heist icons are looked up by id with a safe
// fallback, so new data content still renders something sensible.
// -----------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from 'react';

export type IconName =
  | 'mask'
  | 'hacker'
  | 'muscle'
  | 'driver'
  | 'lookout'
  | 'cash'
  | 'heat'
  | 'vault'
  | 'safehouse'
  | 'crew'
  | 'clock'
  | 'target'
  | 'smash_grab'
  | 'atm_skim'
  | 'warehouse_job'
  | 'bank_vault'
  | 'casino_heist'
  | 'jewelry'
  | 'cargo'
  | 'convoy'
  | 'datacenter'
  | 'centralbank'
  | 'crown'
  | 'trophy'
  | 'sound'
  | 'mute'
  | 'gear';

function Svg({
  size,
  className,
  children,
  strokeWidth = 1.7,
}: {
  size: number;
  className?: string;
  children: ReactNode;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function paths(name: IconName): ReactNode {
  switch (name) {
    case 'mask': // bandit domino mask - the brand motif
      return (
        <>
          <path d="M2.5 8.5c0-1 1-1.7 2.2-1.7h14.6c1.2 0 2.2.7 2.2 1.7 0 3.4-2.6 6-6 6-1.8 0-2.8-1.1-3.5-1.1S9.3 14.5 7.5 14.5c-3.4 0-5-2.6-5-6Z" />
          <circle cx="8.4" cy="9.8" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="15.6" cy="9.8" r="1.3" fill="currentColor" stroke="none" />
        </>
      );
    case 'hacker': // terminal
      return (
        <>
          <rect x="3" y="4.5" width="18" height="15" rx="2" />
          <path d="M7 10l3 2-3 2" />
          <path d="M12.5 14.2h4.2" />
        </>
      );
    case 'muscle': // dumbbell
      return (
        <>
          <path d="M4 9v6M6.5 7.8v8.4M17.5 7.8v8.4M20 9v6" />
          <path d="M6.5 12h11" />
        </>
      );
    case 'driver': // steering wheel
      return (
        <>
          <circle cx="12" cy="12" r="8.4" />
          <circle cx="12" cy="12" r="2.3" />
          <path d="M12 14.3v5.9M10.1 11.2 4.4 8.9M13.9 11.2l5.7-2.3" />
        </>
      );
    case 'lookout': // eye
      return (
        <>
          <path d="M2.2 12S6 5.5 12 5.5 21.8 12 21.8 12 18 18.5 12 18.5 2.2 12 2.2 12Z" />
          <circle cx="12" cy="12" r="2.7" />
        </>
      );
    case 'cash': // banknote
      return (
        <>
          <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
          <circle cx="12" cy="12" r="2.6" />
          <path d="M5.5 9v6M18.5 9v6" />
        </>
      );
    case 'heat': // flame
      return (
        <path d="M12 3c1.2 2.8-1.9 4.1-1.9 6.8a1.9 1.9 0 0 0 3.8.2c.9.8 2.1 2.3 2.1 4.4a4 4 0 1 1-8 0C8 11.5 12 10 12 3Z" />
      );
    case 'vault': // safe with dial
      return (
        <>
          <rect x="3.3" y="4.5" width="17.4" height="15" rx="2" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 8.4V6.7M12 15.6v1.7M8.4 12H6.7M15.6 12h1.7" />
          <path d="M14.9 14.9 16.4 16.4" />
        </>
      );
    case 'safehouse': // barred house
      return (
        <>
          <path d="M3.4 11.4 12 4.4l8.6 7" />
          <path d="M5.5 10v9.5h13V10" />
          <path d="M9.4 19.5V14h5.2v5.5" />
          <path d="M12 14v5.5" />
        </>
      );
    case 'crew': // people
      return (
        <>
          <circle cx="8" cy="8" r="3" />
          <circle cx="16.6" cy="9" r="2.4" />
          <path d="M2.8 19c0-2.9 2.4-5.2 5.2-5.2S13.2 16.1 13.2 19" />
          <path d="M14.6 19c0-2.4 1.4-4.4 3.8-4.4 1.7 0 3 1 3.6 2.2" />
        </>
      );
    case 'clock':
      return (
        <>
          <circle cx="12" cy="12" r="8.4" />
          <path d="M12 7.4V12l3 2" />
        </>
      );
    case 'target':
      return (
        <>
          <circle cx="12" cy="12" r="8.4" />
          <circle cx="12" cy="12" r="4.4" />
          <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
    case 'smash_grab': // shopfront with a crack
      return (
        <>
          <rect x="4" y="5" width="16" height="14" rx="1" />
          <path d="M4 9h16" />
          <path d="M12 9l-2.2 4 3 1-1 4" />
        </>
      );
    case 'atm_skim': // card with chip
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <rect x="5.8" y="9.8" width="3.6" height="3" rx="0.6" />
          <path d="M12.5 10.6h5.5M12.5 14h3.5" />
        </>
      );
    case 'warehouse_job': // crate
      return (
        <>
          <rect x="4.5" y="6.8" width="15" height="12.4" rx="0.8" />
          <path d="M4.5 11h15M9 6.8v12.4M15 6.8v12.4" />
        </>
      );
    case 'bank_vault': // vault door
      return (
        <>
          <rect x="3.3" y="4.5" width="17.4" height="15" rx="2" />
          <circle cx="12" cy="12" r="4.6" />
          <path d="M12 7.4v9.2M7.4 12h9.2M9.1 9.1l5.8 5.8M14.9 9.1l-5.8 5.8" />
        </>
      );
    case 'casino_heist': // poker chip
      return (
        <>
          <circle cx="12" cy="12" r="8.4" />
          <circle cx="12" cy="12" r="3.8" />
          <path d="M12 3.6v2.6M12 17.8v2.6M3.6 12h2.6M17.8 12h2.6M6 6l1.9 1.9M18 6l-1.9 1.9M6 18l1.9-1.9M18 18l-1.9-1.9" />
        </>
      );
    case 'jewelry': // cut gem
      return (
        <>
          <path d="M6 9 8.5 5h7L18 9l-6 10z" />
          <path d="M6 9h12M9.5 9 12 19M14.5 9 12 19M8.5 5l1 4M15.5 5l-1 4" />
        </>
      );
    case 'cargo': // shipping container
      return (
        <>
          <rect x="3" y="7.5" width="18" height="9" rx="1" />
          <path d="M7 7.5v9M11 7.5v9M15 7.5v9M19 7.5v9" />
        </>
      );
    case 'convoy': // armored truck
      return (
        <>
          <path d="M2.5 7h10.5v9H2.5z" />
          <path d="M13 10h4l3 3v3h-7z" />
          <circle cx="6.2" cy="17.5" r="1.5" />
          <circle cx="16.4" cy="17.5" r="1.5" />
        </>
      );
    case 'datacenter': // server racks
      return (
        <>
          <rect x="3.5" y="4.5" width="17" height="6" rx="1" />
          <rect x="3.5" y="13.5" width="17" height="6" rx="1" />
          <path d="M10 7.5h7M10 16.5h7" />
          <path d="M6.5 7.5h.01M6.5 16.5h.01" />
        </>
      );
    case 'centralbank': // bank facade
      return (
        <>
          <path d="M3 9 12 4l9 5" />
          <path d="M4.5 9v8M9 9v8M12 9v8M15 9v8M19.5 9v8" />
          <path d="M3 20h18" />
        </>
      );
    case 'crown':
      return (
        <>
          <path d="M4 8.5l3.6 3.2L12 5.5l4.4 6.2L20 8.5l-1.4 9.5H5.4L4 8.5Z" />
          <path d="M5.4 18h13.2" />
        </>
      );
    case 'trophy':
      return (
        <>
          <path d="M7 4.5h10v4a5 5 0 0 1-10 0v-4Z" />
          <path d="M7 6H4.5v1.5A3 3 0 0 0 7 10.4M17 6h2.5v1.5A3 3 0 0 1 17 10.4" />
          <path d="M9.5 13.5v3M14.5 13.5v3M8 19.5h8M9 16.5h6v3H9z" />
        </>
      );
    case 'sound': // speaker with sound waves
      return (
        <>
          <path d="M4 9.5h3.4L12 5.5v13L7.4 14.5H4z" />
          <path d="M15.4 9.4a3.6 3.6 0 0 1 0 5.2" />
          <path d="M17.8 7a7 7 0 0 1 0 10" />
        </>
      );
    case 'mute': // speaker, muted
      return (
        <>
          <path d="M4 9.5h3.4L12 5.5v13L7.4 14.5H4z" />
          <path d="M16 10l4 4M20 10l-4 4" />
        </>
      );
    case 'gear': // settings cog
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" />
        </>
      );
    default:
      return <circle cx="12" cy="12" r="8.4" />;
  }
}

export function Icon({
  name,
  size = 20,
  className,
  strokeWidth,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg size={size} className={className} strokeWidth={strokeWidth}>
      {paths(name)}
    </Svg>
  );
}

const ROLE_ICON: Record<string, IconName> = {
  hacker: 'hacker',
  muscle: 'muscle',
  driver: 'driver',
  lookout: 'lookout',
};

export function roleIconName(roleId: string): IconName {
  return ROLE_ICON[roleId] ?? 'crew';
}

export function RoleIcon({
  role,
  size = 16,
  className,
}: {
  role: string;
  size?: number;
  className?: string;
}) {
  return <Icon name={roleIconName(role)} size={size} className={className} />;
}

// Maps a heist id to its icon. Add an entry when you add a heist; unknown ids
// fall back to a generic target icon so new content still renders.
const HEIST_ICON: Record<string, IconName> = {
  smash_grab: 'smash_grab',
  atm_skim: 'atm_skim',
  warehouse_job: 'warehouse_job',
  bank_vault: 'bank_vault',
  casino_heist: 'casino_heist',
  jewelry_exchange: 'jewelry',
  cargo_port: 'cargo',
  armored_convoy: 'convoy',
  data_center: 'datacenter',
  central_bank: 'centralbank',
  // Newer jobs reuse thematically-close existing glyphs (no bespoke art yet).
  pickpocket_ring: 'smash_grab',
  jewel_courier: 'jewelry',
  penthouse_job: 'bank_vault',
  rail_yard: 'cargo',
  sovereign_reserve: 'centralbank',
};

export function HeistIcon({
  id,
  size = 22,
  className,
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  return <Icon name={HEIST_ICON[id] ?? 'target'} size={size} className={className} />;
}

/** A "dossier mugshot": role-tinted panel with a bust silhouette + role badge. */
export function Avatar({ role, name, size = 42 }: { role: string; name: string; size?: number }) {
  const style: CSSProperties = { width: size, height: size };
  return (
    <div className="avatar" data-role={role} style={style} title={name} aria-hidden="true">
      <svg viewBox="0 0 40 40" width={size} height={size} className="avatar-bust">
        <circle cx="20" cy="15" r="6.6" fill="currentColor" />
        <path d="M6.5 35c0-7 6-11 13.5-11s13.5 4 13.5 11Z" fill="currentColor" />
      </svg>
      <span className="avatar-badge">
        <RoleIcon role={role} size={Math.round(size * 0.32)} />
      </span>
    </div>
  );
}
