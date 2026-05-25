// pit brand mark — coral rounded square with a serif lowercase "p".
// Matches the pit Electron app's --accent (#e8624a).

export function PitLogo({ size = 32 }: { size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="pit"
      role="img"
    >
      <rect width="64" height="64" rx="14" ry="14" fill="#e8624a" />
      <text
        x="50%"
        y="56%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily='"PT Serif", Georgia, "Times New Roman", serif'
        fontStyle="italic"
        fontWeight={500}
        fontSize="42"
        fill="#ffffff"
      >
        p
      </text>
    </svg>
  )
}
