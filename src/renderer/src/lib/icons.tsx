/* eslint-disable react-refresh/only-export-components */
// icons.tsx — minimal hand-tuned line icons. 16px default, 1.5px strokes.
// The `I` map is a constant lookup, not a refresh boundary.

import type { JSX, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const Icon = ({
  children,
  size = 16,
  ...p
}: IconProps & { children: React.ReactNode }): JSX.Element => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    {children}
  </svg>
)

export const I = {
  Search: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5l3 3" />
    </Icon>
  ),
  Plus: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 3v10M3 8h10" />
    </Icon>
  ),
  Link: (p: IconProps) => (
    <Icon {...p}>
      <path d="M7 9.5l2 -2" />
      <path d="M6.5 5l1 -1a3 3 0 0 1 4.5 4.5l-1 1" />
      <path d="M9.5 11l-1 1a3 3 0 0 1 -4.5 -4.5l1 -1" />
    </Icon>
  ),
  Upload: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 11v2h10v-2" />
      <path d="M8 9V2.5" />
      <path d="M5 5.5L8 2.5l3 3" />
    </Icon>
  ),
  Share: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="3.5" cy="8" r="1.5" />
      <circle cx="12.5" cy="3.5" r="1.5" />
      <circle cx="12.5" cy="12.5" r="1.5" />
      <path d="M5 7.2l6 -3M5 8.8l6 3" />
    </Icon>
  ),
  Sparkles: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3" />
      <path d="M4.2 4.2l1.4 1.4M10.4 10.4l1.4 1.4M4.2 11.8l1.4 -1.4M10.4 5.6l1.4 -1.4" />
    </Icon>
  ),
  Bell: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 11h8l-1 -1.5v-3a3 3 0 1 0 -6 0v3z" />
      <path d="M6.5 13a1.5 1.5 0 0 0 3 0" />
    </Icon>
  ),
  Grid: (p: IconProps) => (
    <Icon {...p}>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </Icon>
  ),
  Filter: (p: IconProps) => (
    <Icon {...p}>
      <path d="M2.5 4h11" />
      <path d="M4 8h8" />
      <path d="M6 12h4" />
    </Icon>
  ),
  Close: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Icon>
  ),
  More: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="3.5" cy="8" r="1" fill="currentColor" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1" fill="currentColor" />
    </Icon>
  ),
  Check: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 8l3.5 3.5L13 4.5" />
    </Icon>
  ),
  Back: (p: IconProps) => (
    <Icon {...p}>
      <path d="M10 3L5 8l5 5" />
    </Icon>
  ),
  Pin: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 2.5l1.5 3.5L13 7l-2.5 2.5L11 13l-3 -2l-3 2l0.5 -3.5L3 7l3.5 -1L8 2.5z" />
    </Icon>
  ),
  Copy: (p: IconProps) => (
    <Icon {...p}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M2.5 10.5v-7a1 1 0 0 1 1 -1h7" />
    </Icon>
  ),
  Eye: (p: IconProps) => (
    <Icon {...p}>
      <path d="M1.5 8s2 -4.5 6.5 -4.5S14.5 8 14.5 8s-2 4.5 -6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </Icon>
  ),
  Tag: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8.5 2.5h4v4l-6 6 -4 -4z" />
      <circle cx="10.5" cy="5.5" r="0.7" fill="currentColor" />
    </Icon>
  ),
  Wand: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 13l8 -8" />
      <path d="M11 2l1 2l2 1l-2 1l-1 2l-1 -2l-2 -1l2 -1z" />
    </Icon>
  ),
  Down: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 6l4 4l4 -4" />
    </Icon>
  ),
  Image: (p: IconProps) => (
    <Icon {...p}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="6" cy="7" r="1.2" />
      <path d="M2.5 11l3 -3l3 3l2 -2l3 3" />
    </Icon>
  ),
  Globe: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11M8 2.5c2 2.5 2 8.5 0 11M8 2.5c-2 2.5 -2 8.5 0 11" />
    </Icon>
  ),
  Type: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3 4h10M8 4v9M5.5 13h5" />
    </Icon>
  ),
  Palette: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 2.5a5.5 5.5 0 1 0 0 11c1 0 1 -1 0 -1.5s-1 -2 0.5 -2h1.5a3.5 3.5 0 0 0 0 -7z" />
    </Icon>
  ),
  Cube: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 2l5 3v6l-5 3l-5 -3v-6z" />
      <path d="M3 5l5 3l5 -3M8 8v6" />
    </Icon>
  ),
  Bolt: (p: IconProps) => (
    <Icon {...p}>
      <path d="M9 2L4 9h3l-1 5l5 -7h-3z" />
    </Icon>
  ),
  Heart: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 13s-5 -3 -5 -7a2.5 2.5 0 0 1 5 -1a2.5 2.5 0 0 1 5 1c0 4 -5 7 -5 7z" />
    </Icon>
  ),
  Star: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 2l1.8 3.8L14 6.4l-3 3l0.8 4.2L8 11.7L4.2 13.6L5 9.4l-3 -3l4.2 -0.6z" />
    </Icon>
  ),
  Layers: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 2.5l5.5 3l-5.5 3l-5.5 -3z" />
      <path d="M2.5 8l5.5 3l5.5 -3M2.5 10.5l5.5 3l5.5 -3" />
    </Icon>
  ),
  Folder: (p: IconProps) => (
    <Icon {...p}>
      <path d="M2 4.5a1 1 0 0 1 1 -1h3l1.5 1.5h5.5a1 1 0 0 1 1 1V12a1 1 0 0 1 -1 1H3a1 1 0 0 1 -1 -1z" />
    </Icon>
  ),
  Notes: (p: IconProps) => (
    <Icon {...p}>
      <rect x="3" y="2.5" width="10" height="11" rx="1.5" />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
    </Icon>
  ),
  Quote: (p: IconProps) => (
    <Icon {...p}>
      <path d="M4 9c0 -2 1 -3.5 3 -4M9 9c0 -2 1 -3.5 3 -4" />
      <path d="M4 9v2.5h2.5V9zM9 9v2.5h2.5V9z" />
    </Icon>
  ),
  Sun: (p: IconProps) => (
    <Icon {...p}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4 -1.4M11.3 4.7l1.4 -1.4" />
    </Icon>
  ),
  Moon: (p: IconProps) => (
    <Icon {...p}>
      <path d="M13 9.5a5 5 0 1 1 -6.5 -6.5a4 4 0 0 0 6.5 6.5z" />
    </Icon>
  ),
  Settings: (p: IconProps) => (
    <Icon {...p}>
      <g transform="translate(8 8) scale(0.6) translate(-12 -12)">
        <circle cx="12" cy="12" r="3" vectorEffect="non-scaling-stroke" />
        <path
          vectorEffect="non-scaling-stroke"
          d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        />
      </g>
    </Icon>
  ),
  Edit: (p: IconProps) => (
    <Icon {...p}>
      <path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5 -3z" />
      <path d="M9.5 4l2.5 2.5" />
    </Icon>
  ),
  Trash: (p: IconProps) => (
    <Icon {...p}>
      <path d="M3.5 4.5h9" />
      <path d="M5.5 4.5V3.5a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v1" />
      <path d="M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1 -.9l.6 -8" />
    </Icon>
  ),
  Warn: (p: IconProps) => (
    <Icon {...p}>
      <path d="M8 2L1 13.5h14z" />
      <path d="M8 6.5v3.4" />
      <circle cx="8" cy="11.7" r="0.5" fill="currentColor" />
    </Icon>
  )
}

export type IconName = keyof typeof I
