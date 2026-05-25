// RoutingRow.tsx — a single collection routing-confidence row.

export function RoutingRow({
  color,
  name,
  conf,
  dim
}: {
  color: string
  name: string
  conf: number
  dim?: boolean
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: 'var(--bg-softer)',
        borderRadius: 8,
        opacity: dim ? 0.55 : 1
      }}
    >
      <div style={{ width: 12, height: 12, borderRadius: 4, background: color }} />
      <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{name}</div>
      <div
        style={{
          width: 64,
          height: 4,
          background: 'var(--bg-soft)',
          borderRadius: 2,
          position: 'relative'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${conf}%`,
            background: color,
            borderRadius: 2
          }}
        />
      </div>
      <div
        className="mono"
        style={{ fontSize: 10.5, color: 'var(--ink-3)', minWidth: 28, textAlign: 'right' }}
      >
        {conf}%
      </div>
    </div>
  )
}
