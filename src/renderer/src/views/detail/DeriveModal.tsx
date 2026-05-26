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
  const { settings, updateItem, items, addDerivatives, updateDerivative } = useStore()
  const [contentPrompt, setContentPrompt] = useState('')
  const [busy, setBusy] = useState<'color' | 'content' | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [preview, setPreview] = useState<Derivative | null>(null)

  // Re-read the current item from the store every render so streamed updates
  // (placeholder → real card transitions as each derivative completes) reflect
  // immediately — props.item is stale.
  const live = items.find((i) => i.id === item.id) || item

  // Source replica(s) — Link items have per-page replica prompts; Image and
  // Video share a single unified replica on the DesignDoc.
  const pages = useMemo<Page[]>(() => {
    const doc = live.design
    if (!doc) return []
    const perPage = (doc.pages || [])
      .filter((p) => p.replicaPrompt && p.replicaPrompt.trim())
      .map((p) => ({ name: p.name, replicaPrompt: p.replicaPrompt as string }))
    if (perPage.length > 0) return perPage
    if (doc.replicaPrompt) return [{ name: 'design', replicaPrompt: doc.replicaPrompt }]
    return []
  }, [live.design])

  const derivatives = live.derivatives || []
  const designTokens = useMemo(
    () => ({
      theme: live.design?.theme,
      fonts: live.design?.fonts,
      layoutNote: live.design?.layoutNote
    }),
    [live.design]
  )

  // addDerivatives / updateDerivative live on the store and use functional
  // setState — race-free even with N parallel codegen jobs landing out of order.

  const generateColors = async (): Promise<void> => {
    if (busy || pages.length === 0) return
    if (!live.design?.palette || live.design.palette.length === 0) {
      toast.push('No palette extracted — cannot derive colors')
      return
    }
    setBusy('color')
    setProgress({ done: 0, total: 0 })
    try {
      const variations = await proposePalettes(live.design.palette, 3, settings.ai)
      if (variations.length === 0) {
        toast.push('No palette variations generated')
        return
      }

      // Build all placeholders first so the user sees N skeleton cards
      // appear immediately (no blank wait while AI runs).
      type Job = {
        id: string
        variation: (typeof variations)[number]
        page: Page
      }
      const jobs: Job[] = []
      for (const v of variations) {
        for (const page of pages) {
          jobs.push({ id: uid(), variation: v, page })
        }
      }
      const placeholders: Derivative[] = jobs.map((j) => ({
        id: j.id,
        kind: 'color',
        label: pages.length > 1 ? `${j.variation.label} · ${j.page.name}` : j.variation.label,
        parentPageName: pages.length > 1 ? j.page.name : undefined,
        html: '',
        palette: j.variation.palette as PaletteRole[],
        createdAt: Date.now(),
        pending: true
      }))
      addDerivatives(item.id, placeholders)
      setProgress({ done: 0, total: jobs.length })

      // Fire jobs in parallel; each settled job patches its own placeholder
      // so cards transition shimmer → real one at a time, in completion order.
      let doneCount = 0
      await Promise.all(
        jobs.map(async (j) => {
          const r = await runDerive(
            {
              replicaPrompt: j.page.replicaPrompt,
              designTokens,
              palette: j.variation.palette
            },
            settings.ai
          )
          updateDerivative(item.id, j.id, {
            html: r.html,
            screenshot: r.screenshot,
            error: r.error,
            pending: false
          })
          doneCount++
          setProgress({ done: doneCount, total: jobs.length })
        })
      )
      toast.push(`Generated ${doneCount}/${jobs.length} color variations`)
    } catch (e) {
      toast.push(`Derive failed: ${(e as Error).message}`)
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  const generateContent = async (): Promise<void> => {
    const prompt = contentPrompt.trim()
    if (busy || pages.length === 0 || !prompt) return
    setBusy('content')
    setProgress({ done: 0, total: pages.length })
    try {
      const truncated = prompt.length > 38 ? prompt.slice(0, 38) + '…' : prompt
      type Job = { id: string; page: Page }
      const jobs: Job[] = pages.map((page) => ({ id: uid(), page }))
      const placeholders: Derivative[] = jobs.map((j) => ({
        id: j.id,
        kind: 'content',
        label: pages.length > 1 ? `${truncated} · ${j.page.name}` : truncated,
        parentPageName: pages.length > 1 ? j.page.name : undefined,
        html: '',
        contentPrompt: prompt,
        createdAt: Date.now(),
        pending: true
      }))
      addDerivatives(item.id, placeholders)

      let doneCount = 0
      await Promise.all(
        jobs.map(async (j) => {
          const r = await runDerive(
            {
              replicaPrompt: j.page.replicaPrompt,
              designTokens,
              palette: live.design?.palette,
              contentPrompt: prompt
            },
            settings.ai
          )
          updateDerivative(item.id, j.id, {
            html: r.html,
            screenshot: r.screenshot,
            error: r.error,
            pending: false
          })
          doneCount++
          setProgress({ done: doneCount, total: jobs.length })
        })
      )
      setContentPrompt('')
      toast.push(`Generated ${doneCount}/${jobs.length} content variations`)
    } catch (e) {
      toast.push(`Derive failed: ${(e as Error).message}`)
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  const removeDerivative = (id: string): void => {
    updateItem(item.id, {
      derivatives: (live.derivatives || []).filter((d) => d.id !== id)
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
                {busy === 'color' && progress
                  ? `Generating ${progress.done}/${progress.total}…`
                  : busy === 'color'
                    ? 'Preparing…'
                    : 'Generate 3 color variants'}
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
                <I.Wand size={13} />{' '}
                {busy === 'content' && progress
                  ? `Generating ${progress.done}/${progress.total}…`
                  : busy === 'content'
                    ? 'Preparing…'
                    : 'Generate'}
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
                    .map((d) => {
                      const clickable = !d.pending && !d.error && d.html
                      return (
                        <div
                          key={d.id}
                          className={`derive-card${d.pending ? ' pending' : ''}${d.error ? ' has-err' : ''}`}
                          onClick={clickable ? () => setPreview(d) : undefined}
                          style={!clickable ? { cursor: 'default' } : undefined}
                        >
                          {d.screenshot ? (
                            <img
                              src={d.screenshot}
                              alt={d.label}
                              className="derive-card-thumb"
                            />
                          ) : d.pending ? (
                            <div className="derive-card-thumb skeleton">
                              <div className="derive-card-shimmer" />
                              <div className="derive-card-spinner">
                                <I.Sparkles size={18} />
                              </div>
                            </div>
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
                              {d.pending && (
                                <span className="derive-pending-dots" aria-hidden>
                                  <span /> <span /> <span />
                                </span>
                              )}
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
                      )
                    })}
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
