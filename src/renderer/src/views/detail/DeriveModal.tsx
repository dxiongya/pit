// DeriveModal — kicks off HTML derivative generation jobs from an analyzed
// item. Each generated variant becomes a SIBLING Item (kind='image' with
// html stored on it) inserted into the same collection as the parent, so
// derivatives show up in the masonry alongside the source instead of nested
// inside it. The modal stays as a thin progress dialog: kick the jobs, list
// their per-row status, then close — cards stream into the masonry behind.

import { useEffect, useMemo, useState } from 'react'
import type { DeriveJob, Item, PaletteRole } from '../../lib/types'
import { I } from '../../lib/icons'
import { Button, Input } from '../../components/ui'
import { useToast } from '../../components/Toast'
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
  const { settings, addItem, updateItem } = useStore()
  const [contentPrompt, setContentPrompt] = useState('')
  const [busy, setBusy] = useState<'color' | 'content' | null>(null)
  const [jobs, setJobs] = useState<DeriveJob[]>([])

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

  const designTokens = useMemo(
    () => ({
      theme: item.design?.theme,
      fonts: item.design?.fonts,
      layoutNote: item.design?.layoutNote
    }),
    [item.design]
  )

  const setJobStatus = (id: string, patch: Partial<DeriveJob>): void => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  }

  /**
   * Create an analyzing-state Item in the parent's collection, then run the
   * codegen job; when it lands, patch the Item with the HTML + screenshot +
   * status:ready (or status:failed on error). This keeps the regular masonry
   * + image-detail machinery in charge of rendering.
   */
  const runJob = async (
    kind: 'color' | 'content',
    label: string,
    parentPageName: string | undefined,
    opts: Parameters<typeof runDerive>[0]
  ): Promise<DeriveJob> => {
    const jobId = uid()
    const itemId = uid()
    const palette = opts.palette as PaletteRole[] | undefined
    addItem({
      id: itemId,
      kind: 'image',
      collection: item.collection,
      title: label,
      status: 'analyzing',
      progress: kind === 'color' ? 'Generating colour variant…' : 'Generating content variant…',
      createdAt: Date.now(),
      palette: palette ? palette.map((p) => p.hex) : undefined,
      derivedFromItemId: item.id,
      derivedFromLabel: label,
      tags: kind === 'color' ? ['derived', 'color-variant'] : ['derived', 'content-variant']
    })
    const job: DeriveJob = {
      id: jobId,
      kind,
      label,
      itemId,
      status: 'pending'
    }
    setJobs((prev) => [...prev, job])
    try {
      const r = await runDerive(opts, settings.ai)
      if (r.error) {
        updateItem(itemId, {
          status: 'failed',
          error: r.error,
          progress: undefined
        })
        setJobStatus(jobId, { status: 'error', error: r.error })
        return { ...job, status: 'error', error: r.error }
      }
      updateItem(itemId, {
        status: 'ready',
        progress: undefined,
        screenshot: r.screenshot,
        html: r.html,
        // Item-level palette comes from the colour-variant palette so cards
        // show its swatches in the card chip / detail. Content variants
        // inherit the parent's palette already (passed in opts).
        ...(palette ? { palette: palette.map((p) => p.hex) } : undefined),
        title: parentPageName && pages.length > 1 ? `${label}` : label
      })
      setJobStatus(jobId, { status: 'done' })
      return { ...job, status: 'done' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      updateItem(itemId, { status: 'failed', error: msg, progress: undefined })
      setJobStatus(jobId, { status: 'error', error: msg })
      return { ...job, status: 'error', error: msg }
    }
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
      // (variation × page) — all in parallel, each creates its own sibling Item.
      await Promise.all(
        variations.flatMap((v) =>
          pages.map((page) =>
            runJob(
              'color',
              pages.length > 1 ? `${v.label} · ${page.name}` : v.label,
              page.name,
              {
                replicaPrompt: page.replicaPrompt,
                designTokens,
                palette: v.palette
              }
            )
          )
        )
      )
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
      const truncated = prompt.length > 38 ? prompt.slice(0, 38) + '…' : prompt
      await Promise.all(
        pages.map((page) =>
          runJob(
            'content',
            pages.length > 1 ? `${truncated} · ${page.name}` : truncated,
            page.name,
            {
              replicaPrompt: page.replicaPrompt,
              designTokens,
              palette: item.design?.palette,
              contentPrompt: prompt
            }
          )
        )
      )
      setContentPrompt('')
    } catch (e) {
      toast.push(`Derive failed: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  // Esc closes when not mid-batch.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  const doneCount = jobs.filter((j) => j.status === 'done').length
  const errCount = jobs.filter((j) => j.status === 'error').length
  const pendingCount = jobs.filter((j) => j.status === 'pending').length

  return (
    <div
      className="detail-overlay"
      onClick={!busy ? onClose : undefined}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        className="share-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(560px, 92vw)', maxWidth: 'unset', maxHeight: '88vh', overflow: 'auto' }}
      >
        <h3>Derive HTML variations</h3>
        <div className="sub">
          Each variant becomes a new image card in this collection.{' '}
          {pages.length === 1
            ? '1 page'
            : `${pages.length} pages × N variants`}
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
                  3 palette shifts × {pages.length} = {3 * pages.length} new cards
                </span>
              </div>
              <Button variant="primary" onClick={generateColors} disabled={busy != null}>
                <I.Sparkles size={13} />{' '}
                {busy === 'color'
                  ? pendingCount > 0
                    ? `Generating · ${doneCount + errCount}/${jobs.length}…`
                    : 'Preparing palettes…'
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
                placeholder='e.g. "Reframe as a pricing page"'
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
                {busy === 'content'
                  ? `Generating · ${doneCount + errCount}/${jobs.length}…`
                  : 'Generate'}
              </Button>
            </div>

            {jobs.length > 0 && (
              <div className="derive-section">
                <div className="derive-section-h">
                  <span className="hk">PROGRESS</span>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {doneCount} done · {pendingCount} running
                    {errCount > 0 ? ` · ${errCount} failed` : ''}
                  </span>
                </div>
                <div className="derive-job-list">
                  {jobs.map((j) => (
                    <div key={j.id} className={`derive-job-row ${j.status}`}>
                      <span className="derive-job-icon" aria-hidden>
                        {j.status === 'done' ? '✓' : j.status === 'error' ? '⚠' : '⟳'}
                      </span>
                      <span className="derive-job-label" title={j.label}>
                        {j.kind === 'color' ? '🎨' : '✏️'} {j.label}
                      </span>
                      {j.error && (
                        <span className="muted" style={{ fontSize: 10, color: '#ff453a' }}>
                          {j.error.slice(0, 60)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                  Cards are also appearing in the collection — close this modal
                  to see them in the masonry.
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button size="sm" onClick={onClose} disabled={busy != null}>
            {jobs.length > 0 ? 'Done' : 'Close'}
          </Button>
        </div>
      </div>
    </div>
  )
}
