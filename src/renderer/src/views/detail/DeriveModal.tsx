// DeriveModal — generates HTML derivatives of an analyzed item.
//
// Two generators, both backed by the `derive` AI role:
//   1. COLOR variations — 3 algorithmically-derived palettes (cool / earth /
//      mono shifts) get AI-named in one call, then each runs through codegen
//      in parallel. For multi-page items every page is derived in the same
//      round (so a 4-page site → 12 color derivatives per click).
//   2. CONTENT prompt — user types a free-form rewrite instruction; one
//      codegen call per page using the same prompt.
//
// Results stream into a grid grouped by kind. Click a card → preview modal
// with iframe live render + Copy HTML + Open externally.

import { useEffect, useMemo, useState } from 'react'
import type { Derivative, Item, PaletteRole } from '../../lib/types'
import { I } from '../../lib/icons'
import { Button, Input } from '../../components/ui'
import { copyToClipboard, useToast } from '../../components/Toast'
import { useStore } from '../../lib/store'
import { proposePalettes, runDerive } from '../../lib/ai/provider'

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

interface Page {
  name: string
  replicaPrompt: string
}

export function DeriveModal({
  item,
  onClose
}: {
  item: Item
  onClose: () => void
}): React.JSX.Element {
  const toast = useToast()
  const { settings, updateItem } = useStore()
  const [contentPrompt, setContentPrompt] = useState('')
  const [busy, setBusy] = useState<'color' | 'content' | null>(null)
  const [preview, setPreview] = useState<Derivative | null>(null)

  // Source replica(s) — Link items have per-page replica prompts; Image and
  // Video share a single unified replica on the DesignDoc.
  const pages = useMemo<Page[]>(() => {
    const doc = item.design
    if (!doc) return []
    const perPage = (doc.pages || [])
      .filter((p) => p.replicaPrompt && p.replicaPrompt.trim())
      .map((p) => ({ name: p.name, replicaPrompt: p.replicaPrompt as string }))
    if (perPage.length > 0) return perPage
    if (doc.replicaPrompt) return [{ name: 'design', replicaPrompt: doc.replicaPrompt }]
    return []
  }, [item.design])

  const derivatives = item.derivatives || []
  const designTokens = useMemo(
    () => ({
      theme: item.design?.theme,
      fonts: item.design?.fonts,
      layoutNote: item.design?.layoutNote
    }),
    [item.design]
  )

  const appendDerivatives = (added: Derivative[]): void => {
    updateItem(item.id, { derivatives: [...(item.derivatives || []), ...added] })
  }

  const generateColors = async (): Promise<void> => {
    if (busy || pages.length === 0) return
    if (!item.design?.palette || item.design.palette.length === 0) {
      toast.push('No palette extracted — cannot derive colors')
      return
    }
    setBusy('color')
    try {
      const variations = await proposePalettes(item.design.palette, 3, settings.ai)
      if (variations.length === 0) {
        toast.push('No palette variations generated')
        return
      }
      // Spin up codegen for every (page × variation) — in parallel.
      const jobs: Promise<Derivative>[] = []
      for (const v of variations) {
        for (const page of pages) {
          jobs.push(
            (async (): Promise<Derivative> => {
              const id = uid()
              const r = await runDerive(
                {
                  replicaPrompt: page.replicaPrompt,
                  designTokens,
                  palette: v.palette
                },
                settings.ai
              )
              return {
                id,
                kind: 'color',
                label: pages.length > 1 ? `${v.label} · ${page.name}` : v.label,
                parentPageName: pages.length > 1 ? page.name : undefined,
                html: r.html,
                screenshot: r.screenshot,
                palette: v.palette as PaletteRole[],
                createdAt: Date.now(),
                error: r.error
              }
            })()
          )
        }
      }
      const results = await Promise.all(jobs)
      appendDerivatives(results)
      const ok = results.filter((d) => !d.error).length
      toast.push(`Generated ${ok}/${results.length} color variations`)
    } catch (e) {
      toast.push(`Derive failed: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const generateContent = async (): Promise<void> => {
    const prompt = contentPrompt.trim()
    if (busy || pages.length === 0 || !prompt) return
    setBusy('content')
    try {
      const jobs = pages.map(async (page): Promise<Derivative> => {
        const id = uid()
        const r = await runDerive(
          {
            replicaPrompt: page.replicaPrompt,
            designTokens,
            palette: item.design?.palette,
            contentPrompt: prompt
          },
          settings.ai
        )
        const truncated = prompt.length > 38 ? prompt.slice(0, 38) + '…' : prompt
        return {
          id,
          kind: 'content',
          label:
            pages.length > 1 ? `${truncated} · ${page.name}` : truncated,
          parentPageName: pages.length > 1 ? page.name : undefined,
          html: r.html,
          screenshot: r.screenshot,
          contentPrompt: prompt,
          createdAt: Date.now(),
          error: r.error
        }
      })
      const results = await Promise.all(jobs)
      appendDerivatives(results)
      setContentPrompt('')
      const ok = results.filter((d) => !d.error).length
      toast.push(`Generated ${ok}/${results.length} content variations`)
    } catch (e) {
      toast.push(`Derive failed: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const removeDerivative = (id: string): void => {
    updateItem(item.id, {
      derivatives: (item.derivatives || []).filter((d) => d.id !== id)
    })
  }

  // Esc closes (but not when an iframe preview is open — that takes priority).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (preview) setPreview(null)
      else if (!busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, busy, preview])

  return (
    <div
      className="detail-overlay"
      onClick={!busy && !preview ? onClose : undefined}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        className="share-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(820px, 92vw)', maxWidth: 'unset', maxHeight: '88vh', overflow: 'auto' }}
      >
        <h3>Derive HTML variations</h3>
        <div className="sub">
          Generate code variants from this item's design system —{' '}
          {pages.length === 1
            ? '1 page'
            : `${pages.length} pages (each will be derived once per variant)`}
          .
        </div>

        {pages.length === 0 && (
          <div
            style={{
              marginTop: 14,
              padding: 16,
              background: 'var(--bg-soft)',
              borderRadius: 8,
              color: 'var(--ink-3)',
              fontSize: 12,
              textAlign: 'center'
            }}
          >
            This item doesn't have a replica prompt yet — analyze it first.
          </div>
        )}

        {pages.length > 0 && (
          <>
            <div className="derive-section">
              <div className="derive-section-h">
                <span className="hk">COLOR VARIATIONS</span>
                <span className="muted" style={{ fontSize: 11 }}>
                  3 palette shifts × {pages.length} {pages.length === 1 ? 'page' : 'pages'} ={' '}
                  {3 * pages.length} HTML
                </span>
              </div>
              <Button variant="primary" onClick={generateColors} disabled={busy != null}>
                <I.Sparkles size={13} />{' '}
                {busy === 'color' ? 'Generating…' : 'Generate 3 color variants'}
              </Button>
            </div>

            <div className="derive-section">
              <div className="derive-section-h">
                <span className="hk">CUSTOM CONTENT</span>
                <span className="muted" style={{ fontSize: 11 }}>
                  Keep the style, rewrite the content
                </span>
              </div>
              <Input
                placeholder='e.g. "Reframe as a pricing page" or "Hero about climate research"'
                value={contentPrompt}
                onChange={(e) => setContentPrompt(e.target.value)}
                disabled={busy != null}
              />
              <Button
                variant="primary"
                onClick={generateContent}
                disabled={busy != null || !contentPrompt.trim()}
                style={{ marginTop: 8 }}
              >
                <I.Wand size={13} /> {busy === 'content' ? 'Generating…' : 'Generate'}
              </Button>
            </div>

            {derivatives.length > 0 && (
              <div className="derive-section">
                <div className="derive-section-h">
                  <span className="hk">DERIVATIVES · {derivatives.length}</span>
                </div>
                <div className="derive-grid">
                  {[...derivatives]
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((d) => (
                      <div key={d.id} className="derive-card" onClick={() => setPreview(d)}>
                        {d.screenshot ? (
                          <img src={d.screenshot} alt={d.label} className="derive-card-thumb" />
                        ) : (
                          <div
                            className={`derive-card-thumb placeholder${d.error ? ' err' : ''}`}
                          >
                            {d.error ? '⚠' : '…'}
                          </div>
                        )}
                        <div className="derive-card-meta">
                          <div className="derive-card-label" title={d.label}>
                            {d.kind === 'color' ? '🎨' : '✏️'} {d.label}
                          </div>
                          {d.palette && d.palette.length > 0 && (
                            <div className="derive-card-palette">
                              {d.palette.slice(0, 6).map((p, i) => (
                                <span
                                  key={i}
                                  className="sw"
                                  style={{ background: p.hex }}
                                  title={p.hex}
                                />
                              ))}
                            </div>
                          )}
                          {d.error && (
                            <div className="muted" style={{ fontSize: 10, color: '#ff453a' }}>
                              {d.error.slice(0, 80)}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="derive-card-x"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeDerivative(d.id)
                          }}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button size="sm" onClick={onClose} disabled={busy != null}>
            Close
          </Button>
        </div>
      </div>

      {preview && <DerivativePreview derivative={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

function DerivativePreview({
  derivative,
  onClose
}: {
  derivative: Derivative
  onClose: () => void
}): React.JSX.Element {
  const toast = useToast()
  const copyHtml = async (): Promise<void> => {
    await copyToClipboard(derivative.html)
    toast.push('HTML copied')
  }
  const openExternally = async (): Promise<void> => {
    const blob = new Blob([derivative.html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    // Don't revoke immediately — let the new window load it.
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }
  return (
    <div
      className="detail-overlay derive-preview-bg"
      onClick={onClose}
      style={{ alignItems: 'center', justifyContent: 'center', zIndex: 20 }}
    >
      <div
        className="derive-preview"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="derive-preview-head">
          <div className="derive-preview-label">{derivative.label}</div>
          <div style={{ flex: 1 }} />
          <Button size="sm" onClick={() => void copyHtml()}>
            <I.Copy size={12} /> Copy HTML
          </Button>
          <Button size="sm" onClick={() => void openExternally()}>
            <I.Globe size={12} /> Open externally
          </Button>
          <button type="button" className="derive-preview-close" onClick={onClose} title="Close">
            ×
          </button>
        </div>
        <iframe
          className="derive-preview-frame"
          srcDoc={derivative.html}
          sandbox="allow-same-origin"
          title={derivative.label}
        />
      </div>
    </div>
  )
}
