import { useEffect, useState } from 'react'
import { SHARE_API } from './env'
import { PitLogo } from './Logo'

// Loose item shape — the desktop app's full Item interface, minus fields the
// landing page doesn't render. Kept as Record to avoid coupling the two apps
// (a tighter shared package can come later if the contract stabilises).
interface ShareItem {
  id: string
  kind: string
  title?: string
  prompt?: string
  tags?: string[]
  url?: string
  screenshotAsset?: string
  palette?: string[]
  text?: string
  body?: string
  author?: string
  design?: {
    theme?: string
    description?: string
    mood?: string[]
    style?: string[]
    palette?: { hex: string; role: string }[]
    stylePrompt?: string
    replicaPrompt?: string
    tags?: string[]
    pages?: { thumbAsset?: string; name?: string; bg?: string }[]
  }
  bg?: string
}

interface CollectionPayload {
  kind: 'collection'
  collection: { id: string; name: string; color?: string; desc?: string }
  items: ShareItem[]
}

interface ItemPayload {
  kind: 'item'
  item: ShareItem
}

type SharePayload = CollectionPayload | ItemPayload

type Phase = 'loading' | 'password' | 'ready' | 'error' | 'expired' | 'notfound'

export function ShareView({ code }: { code: string }): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('loading')
  const [payload, setPayload] = useState<SharePayload | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setPhase('loading')
      try {
        const r = await fetch(`${SHARE_API}/api/shares/${code}`)
        if (cancelled) return
        if (r.status === 404) return setPhase('notfound')
        if (r.status === 410) return setPhase('expired')
        if (r.status === 401) return setPhase('password')
        if (!r.ok) {
          setErr(`HTTP ${r.status}`)
          return setPhase('error')
        }
        const j = (await r.json()) as { payload: SharePayload }
        setPayload(j.payload)
        setPhase('ready')
      } catch (e) {
        if (cancelled) return
        setErr((e as Error).message)
        setPhase('error')
      }
    })()
    return (): void => {
      cancelled = true
    }
  }, [code])

  if (phase === 'loading') return <LoadingScreen />
  if (phase === 'notfound') {
    return <Message title="Share not found" sub="This URL doesn't match any share, or it's been deleted." />
  }
  if (phase === 'expired') {
    return <Message title="Share expired" sub="The link's TTL ran out. Ask the sender for a fresh one." />
  }
  if (phase === 'error') return <Message title="Couldn't load" sub={err} />
  if (phase === 'password') {
    return <PasswordGate code={code} onUnlocked={(p) => { setPayload(p); setPhase('ready') }} />
  }
  if (phase === 'ready' && payload) {
    return <ShareRenderer code={code} payload={payload} />
  }
  return <Message title="Unknown state" sub="" />
}

// ─── password gate ─────────────────────────────────────────────────────────

function PasswordGate({
  code,
  onUnlocked
}: {
  code: string
  onUnlocked: (payload: SharePayload) => void
}): React.JSX.Element {
  const [password, setPassword] = useState('')
  const [authing, setAuthing] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setAuthing(true)
    setErr('')
    try {
      const r = await fetch(`${SHARE_API}/api/shares/${code}/auth`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password })
      })
      if (r.status === 403) {
        setErr('Wrong password')
        return
      }
      if (r.status === 410) {
        setErr('This link has expired')
        return
      }
      if (!r.ok) {
        setErr(`HTTP ${r.status}`)
        return
      }
      const j = (await r.json()) as { payload: SharePayload }
      onUnlocked(j.payload)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setAuthing(false)
    }
  }

  return (
    <div className="centered">
      <PitLogo size={48} />
      <div className="page-heading">Password required</div>
      <div className="muted">Ask the sender for the password.</div>
      <form className="pw-form" onSubmit={submit}>
        <input
          type="password"
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button disabled={authing || !password} type="submit">
          {authing ? 'Checking…' : 'Unlock'}
        </button>
        {err && <div className="err">{err}</div>}
      </form>
    </div>
  )
}

// ─── main renderer ─────────────────────────────────────────────────────────

function ShareRenderer({
  code,
  payload
}: {
  code: string
  payload: SharePayload
}): React.JSX.Element {
  const deepLink = `pit://share/${code}`

  if (payload.kind === 'item') {
    return (
      <div className="page">
        <Topbar deepLink={deepLink} />
        <div className="single-item">
          <ItemCard code={code} item={payload.item} expanded />
        </div>
      </div>
    )
  }

  const { collection, items } = payload
  return (
    <div className="page">
      <Topbar deepLink={deepLink} />
      <div className="canvas">
        <div className="hero">
          <div className="hero-left">
            <div
              className="hero-cover"
              style={{ background: collection.color || 'linear-gradient(160deg, #4356a0, #1b1f3b)' }}
            />
            <div>
              <h1>{collection.name}</h1>
              <div className="sub">
                <span>
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
                {collection.desc && (
                  <>
                    <span className="dot" />
                    <span>{collection.desc}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="masonry">
          {items.map((it) => (
            <ItemCard key={it.id} code={code} item={it} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Topbar({ deepLink }: { deepLink: string }): React.JSX.Element {
  return (
    <div className="topbar">
      <a className="brand" href="/">
        <PitLogo size={26} />
        <span>pit</span>
      </a>
      <a className="cta" href={deepLink}>
        Open in pit ↗
      </a>
    </div>
  )
}

function ItemCard({
  code,
  item,
  expanded = false
}: {
  code: string
  item: ShareItem
  expanded?: boolean
}): React.JSX.Element {
  const thumb = item.screenshotAsset
    ? `${SHARE_API}/api/blob/${code}/${item.screenshotAsset}`
    : null
  const paletteHex = item.design?.palette?.map((p) => p.hex) || item.palette || []

  return (
    <article className={`card${expanded ? ' expanded' : ''}`}>
      {thumb ? (
        <img className="card-thumb" src={thumb} alt={item.title || item.kind} loading="lazy" />
      ) : item.bg ? (
        <div className="card-thumb placeholder" style={{ background: item.bg }} />
      ) : (
        <div className="card-thumb placeholder" />
      )}

      <div className="card-body">
        {item.title && <div className="card-title">{item.title}</div>}
        {item.url && (
          <a className="card-url" href={item.url} target="_blank" rel="noreferrer">
            {hostFromUrl(item.url)}
          </a>
        )}
        {item.text && <blockquote className="card-quote">“{item.text}”</blockquote>}
        {item.author && <div className="card-author">— {item.author}</div>}

        {item.design?.theme && <div className="card-theme">{item.design.theme}</div>}

        {paletteHex.length > 0 && (
          <div className="palette">
            {paletteHex.slice(0, 8).map((hex, i) => (
              <span key={i} className="swatch" style={{ background: hex }} title={hex} />
            ))}
          </div>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="tags">
            {item.tags.slice(0, expanded ? 12 : 4).map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        )}

        {expanded && item.design?.stylePrompt && (
          <details className="prompt-box">
            <summary>Style prompt</summary>
            <pre>{item.design.stylePrompt}</pre>
          </details>
        )}
        {expanded && item.design?.replicaPrompt && (
          <details className="prompt-box">
            <summary>Replica prompt</summary>
            <pre>{item.design.replicaPrompt}</pre>
          </details>
        )}
      </div>
    </article>
  )
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

// ─── chrome ────────────────────────────────────────────────────────────────

function LoadingScreen(): React.JSX.Element {
  return (
    <div className="centered">
      <div className="spinner" />
      <div className="muted">Loading…</div>
    </div>
  )
}

function Message({ title, sub }: { title: string; sub: string }): React.JSX.Element {
  return (
    <div className="centered">
      <div className="page-heading">{title}</div>
      <div className="muted">{sub}</div>
      <a className="link-btn" href="/">
        Back to pit.ink
      </a>
    </div>
  )
}
