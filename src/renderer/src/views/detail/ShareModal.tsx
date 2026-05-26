// ShareModal.tsx — share an item or a whole collection to pit.ink.
// Talks to the share Worker via the main process (window.pit.share.create).

import { useEffect, useState } from 'react'
import type { Collection, Item } from '../../lib/types'
import { I } from '../../lib/icons'
import { copyToClipboard, useToast } from '../../components/Toast'
import { Button, Field, Input, Select, Switch } from '../../components/ui'
import {
  gradientFromId,
  listShares,
  pushShare,
  relativeAge,
  removeShare,
  type ShareRecord
} from '../../lib/shareHistory'

export type ShareTarget =
  | { kind: 'item'; item: Item }
  | { kind: 'collection'; collection: Collection; items: Item[] }

type Phase = 'idle' | 'creating' | 'done' | 'error'
type Ttl = 'never' | '1' | '7' | '30'

const TTL_ITEMS: { value: Ttl; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: '1', label: '24 hours' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' }
]

function describeTarget(target: ShareTarget): string {
  if (target.kind === 'item') {
    const it = target.item
    return it.title || it.text || it.url || 'Untitled item'
  }
  const n = target.items.length
  return `${target.collection.name} · ${n} ${n === 1 ? 'item' : 'items'}`
}

export function ShareModal({
  target,
  onClose
}: {
  target: ShareTarget
  onClose: () => void
}): React.JSX.Element {
  const toast = useToast()
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [ttl, setTtl] = useState<Ttl>('never')
  const [phase, setPhase] = useState<Phase>('idle')
  const [err, setErr] = useState('')
  const [result, setResult] = useState<{ url: string; code: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<ShareRecord[]>(() => listShares())

  // Stable gradient cover seeded by the target's id — same collection / item
  // always shows the same colors so the avatar is recognizable.
  const seedId =
    target.kind === 'collection' ? target.collection.id : target.item.id
  const coverGradient = gradientFromId(seedId)

  // Esc closes when we're not mid-upload, so the user doesn't accidentally
  // bail in the middle of an R2 write.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && phase !== 'creating') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, phase])

  const title = describeTarget(target)
  const itemCount = target.kind === 'item' ? 1 : target.items.length

  const handleCreate = async (): Promise<void> => {
    setPhase('creating')
    setErr('')
    try {
      const input =
        target.kind === 'item'
          ? {
              kind: 'item' as const,
              item: target.item,
              password: usePassword && password ? password : undefined,
              expiresInDays: ttl === 'never' ? undefined : parseInt(ttl, 10)
            }
          : {
              kind: 'collection' as const,
              collection: target.collection,
              items: target.items,
              password: usePassword && password ? password : undefined,
              expiresInDays: ttl === 'never' ? undefined : parseInt(ttl, 10)
            }
      const res = await window.pit.share.create(input)
      setResult({ url: res.url, code: res.code })
      setPhase('done')
      // Persist locally so the modal's history list can show it next time.
      pushShare({
        code: res.code,
        url: res.url,
        createdAt: Date.now(),
        targetKind: target.kind,
        targetName:
          target.kind === 'collection' ? target.collection.name : target.item.title || 'item',
        itemCount: target.kind === 'collection' ? target.items.length : 1,
        hasPassword: res.hasPassword,
        expiresAt: res.expiresAt
      })
      setHistory(listShares())
      // Auto-copy on success — the moment people want this URL is right now.
      await copyToClipboard(res.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      setErr((e as Error).message || 'Failed to create share')
      setPhase('error')
    }
  }

  const copyHistoryUrl = async (url: string): Promise<void> => {
    await copyToClipboard(url)
    toast.push('Link copied')
  }
  const forgetHistory = (code: string): void => {
    removeShare(code)
    setHistory(listShares())
  }

  const handleCopy = async (): Promise<void> => {
    if (!result) return
    await copyToClipboard(result.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className="detail-overlay"
      onClick={phase !== 'creating' ? onClose : undefined}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Share {target.kind === 'item' ? 'this item' : 'this collection'}</h3>
        <div className="sub">
          Anyone with the link can view. {usePassword && phase === 'idle' && 'Password required.'}
        </div>

        <div className="share-preview">
          <div className="ph" style={{ background: coverGradient }}>
            <span className="share-preview-glyph">
              {(title || '?').trim().charAt(0).toUpperCase() || '·'}
            </span>
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{title}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'} · public link
            </div>
          </div>
        </div>

        {phase === 'idle' && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Password row — switch sits to the right of the row, inside the
                modal. Custom flex layout instead of Field.labelExtra (whose
                positioning was pushing the switch outside the modal). */}
            <div className="share-row">
              <div className="share-row-text">
                <div className="ui-label">Password protect</div>
                <div className="muted share-row-hint">
                  {usePassword
                    ? 'Recipients will need this password to open.'
                    : 'Anyone with the link can open it without a password.'}
                </div>
              </div>
              <Switch on={usePassword} onChange={() => setUsePassword(!usePassword)} />
            </div>
            {usePassword && (
              <Input
                type="password"
                placeholder="Set a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}

            <Field label="Expires">
              <Select value={ttl} onValueChange={(v) => setTtl(v)} items={TTL_ITEMS} />
            </Field>

            {history.length > 0 && (
              <div className="share-history">
                <div className="ui-label" style={{ marginBottom: 6 }}>
                  Recent shares
                  <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>
                    · {history.length} total
                  </span>
                </div>
                <div className="share-history-list">
                  {history.slice(0, 5).map((r) => (
                    <div key={r.code} className="share-history-row">
                      <div
                        className="share-history-cover"
                        style={{ background: gradientFromId(r.code) }}
                        aria-hidden
                      />
                      <div className="share-history-meta">
                        <div className="share-history-name" title={r.targetName}>
                          {r.targetName}
                          {r.hasPassword && (
                            <span className="share-history-lock" title="Password protected">
                              🔒
                            </span>
                          )}
                        </div>
                        <div className="muted share-history-sub">
                          {r.itemCount} {r.itemCount === 1 ? 'item' : 'items'} ·{' '}
                          {relativeAge(r.createdAt)}
                          {r.expiresAt && ` · expires ${relativeAge(r.expiresAt * 1000)}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="share-history-btn"
                        onClick={() => void copyHistoryUrl(r.url)}
                        title={r.url}
                      >
                        <I.Copy size={11} /> Copy
                      </button>
                      <button
                        type="button"
                        className="share-history-btn dim"
                        onClick={() => forgetHistory(r.code)}
                        title="Remove from local history (the link remains live on pit.ink until TTL)"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <Button size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={usePassword && !password}
              >
                <I.Link size={13} /> Create link
              </Button>
            </div>
          </div>
        )}

        {phase === 'creating' && (
          <div style={{ padding: 28, textAlign: 'center' }} className="muted">
            <I.Sparkles size={16} />
            <div style={{ marginTop: 8 }}>
              Uploading {itemCount} {itemCount === 1 ? 'item' : 'items'}…
            </div>
          </div>
        )}

        {phase === 'done' && result && (
          <div style={{ marginTop: 16 }}>
            <div className="share-link-row">
              <div className="link-pill">{result.url}</div>
              <Button variant={copied ? 'accent' : 'primary'} onClick={handleCopy}>
                {copied ? (
                  <>
                    <I.Check size={13} /> Copied
                  </>
                ) : (
                  <>
                    <I.Copy size={13} /> Copy
                  </>
                )}
              </Button>
            </div>
            {usePassword && password && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: 'var(--bg-soft)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--ink-2)'
                }}
              >
                <strong>Password:</strong> <code>{password}</code> — share it separately, not in the
                same channel as the link.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                padding: 12,
                background: 'var(--bg-soft)',
                borderRadius: 10,
                fontSize: 13,
                color: '#c0392b'
              }}
            >
              {err}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreate}>
                Retry
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
