// ShareModal.tsx — share an item or a whole collection to pit.ink.
// Talks to the share Worker via the main process (window.pit.share.create).

import { useEffect, useState } from 'react'
import type { Collection, Item } from '../../lib/types'
import { I } from '../../lib/icons'
import { copyToClipboard } from '../../components/Toast'
import { Button, Field, Input, Select, Switch } from '../../components/ui'

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
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [ttl, setTtl] = useState<Ttl>('never')
  const [phase, setPhase] = useState<Phase>('idle')
  const [err, setErr] = useState('')
  const [result, setResult] = useState<{ url: string; code: string } | null>(null)
  const [copied, setCopied] = useState(false)

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
      // Auto-copy on success — the moment people want this URL is right now.
      await copyToClipboard(res.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      setErr((e as Error).message || 'Failed to create share')
      setPhase('error')
    }
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
          <div
            className="ph"
            style={{
              background:
                target.kind === 'collection'
                  ? target.collection.color || 'linear-gradient(160deg, #e89b6a, #6e2418)'
                  : 'linear-gradient(160deg, #4356a0, #1b1f3b)'
            }}
          />
          <div>
            <div style={{ fontWeight: 600 }}>{title}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'} · public link
            </div>
          </div>
        </div>

        {phase === 'idle' && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field
              label="Password protect"
              labelExtra={<Switch on={usePassword} onChange={() => setUsePassword(!usePassword)} />}
            >
              {usePassword ? (
                <Input
                  type="password"
                  placeholder="Set a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              ) : (
                <div className="muted" style={{ fontSize: 12 }}>
                  Anyone with the link can open it without a password.
                </div>
              )}
            </Field>

            <Field label="Expires">
              <Select value={ttl} onValueChange={(v) => setTtl(v)} items={TTL_ITEMS} />
            </Field>

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
