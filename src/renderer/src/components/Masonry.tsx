// Masonry.tsx — CSS-grid masonry with per-item col/row spans + item cards.

import { useState } from 'react'
import type { Item } from '../lib/types'
import { I } from '../lib/icons'
import { useStore } from '../lib/store'
import { useToast } from './Toast'

/** Stitch N image data URLs into one tall PNG (slices stack vertically). */
async function composeImagesToBlob(dataUrls: string[]): Promise<Blob | null> {
  const ims = await Promise.all(
    dataUrls.map(async (u) => {
      const im = new Image()
      im.src = u
      await im.decode()
      return im
    })
  )
  if (!ims.length) return null
  const width = Math.max(...ims.map((i) => i.naturalWidth))
  const height = ims.reduce((a, i) => a + i.naturalHeight, 0)
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')
  if (!ctx) return null
  let y = 0
  for (const im of ims) {
    ctx.drawImage(im, 0, y)
    y += im.naturalHeight
  }
  return await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'))
}

/** Thin wrapper — multi-column CSS handles flow + sizing, no JS measuring. */
function MasonryItem({
  item,
  onClick
}: {
  item: Item
  onClick?: (i: Item) => void
}): React.JSX.Element {
  return (
    <div style={{ minWidth: 0 }}>
      <Card item={item} onClick={onClick} />
    </div>
  )
}

export function Masonry({
  items,
  onOpenItem
}: {
  items: Item[]
  onOpenItem?: (i: Item) => void
}): React.JSX.Element {
  return (
    <div className="masonry">
      {items.map((it) => (
        <MasonryItem key={it.id} item={it} onClick={onOpenItem} />
      ))}
    </div>
  )
}

function CardVisual({ item }: { item: Item }): React.JSX.Element {
  const aspect = item.aspect || 1

  if (item.kind === 'link') {
    // Sites get a viewport-shaped tile (16:10) showing the top of the page,
    // like a browser tab thumbnail. The full scrollable capture lives in the
    // detail view (where it's actually useful).
    return (
      <div className="card-visual" style={{ aspectRatio: 16 / 10 }}>
        {item.screenshot ? (
          <div
            className="img"
            style={{
              backgroundImage: `url(${item.screenshot})`,
              backgroundSize: 'cover',
              backgroundPosition: 'top center'
            }}
          />
        ) : (
          <div className="imgph" style={{ background: item.bg }} />
        )}
      </div>
    )
  }
  if (item.kind === 'image') {
    return (
      <div className="card-visual" style={{ aspectRatio: aspect }}>
        {item.screenshot ? (
          <div className="img" style={{ backgroundImage: `url(${item.screenshot})` }} />
        ) : (
          <div className="imgph" style={{ background: item.bg }} />
        )}
      </div>
    )
  }
  if (item.kind === 'video') {
    const frameCount = item.design?.pages?.length ?? 0
    return (
      <div className="card-visual" style={{ aspectRatio: aspect }}>
        {item.screenshot ? (
          <div className="img" style={{ backgroundImage: `url(${item.screenshot})` }} />
        ) : (
          <div className="imgph" style={{ background: item.bg }} />
        )}
        {frameCount > 0 && (
          <div className="video-badge">
            <span className="play-tri">▶</span> {frameCount} frames
          </div>
        )}
      </div>
    )
  }
  if (item.kind === 'palette') {
    return (
      <div className="card-visual" style={{ aspectRatio: aspect }}>
        {(item.palette || []).map((c, i) => (
          <div key={i} className="sw" style={{ background: c }} />
        ))}
      </div>
    )
  }
  if (item.kind === 'font') {
    const mono = item.title?.includes('Mono')
    return (
      <div
        className="card-visual card-font-visual"
        style={{
          aspectRatio: aspect,
          fontFamily: mono ? 'var(--f-mono)' : 'var(--f-accent)',
          fontStyle: mono ? 'normal' : 'italic'
        }}
      >
        {item.sample}
      </div>
    )
  }
  if (item.kind === 'quote') {
    return (
      <div className="card-visual" style={{ aspectRatio: aspect, background: item.bg }}>
        <p className="q-text">&ldquo;{item.text}&rdquo;</p>
      </div>
    )
  }
  if (item.kind === 'note') {
    return (
      <div className="card-visual" style={{ aspectRatio: aspect, background: item.bg }}>
        <div className="n-text">{item.body}</div>
      </div>
    )
  }
  return <div className="card-visual" style={{ aspectRatio: aspect }} />
}

function Card({ item, onClick }: { item: Item; onClick?: (i: Item) => void }): React.JSX.Element {
  const { collections } = useStore()
  const toast = useToast()
  const [copied, setCopied] = useState<'style' | 'replica' | null>(null)

  // Resolve which prompt to copy. For sites the per-page replica lives on
  // design.pages[0]; image kinds use design.replicaPrompt. Style is single.
  const stylePrompt = item.design?.stylePrompt || item.design?.agentPrompt || item.prompt || ''
  const replicaPrompt = item.design?.pages?.[0]?.replicaPrompt || item.design?.replicaPrompt || ''

  const copy = (kind: 'style' | 'replica', e: React.MouseEvent): void => {
    e.stopPropagation()
    const text = kind === 'style' ? stylePrompt : replicaPrompt
    if (!text) {
      toast.push(`No ${kind} prompt yet`)
      return
    }
    void navigator.clipboard.writeText(text).catch(() => {})
    toast.push(`${kind === 'style' ? 'Style' : 'Replica'} prompt copied`)
    setCopied(kind)
    setTimeout(() => setCopied(null), 1100)
  }

  // Every image we'd want to copy / drag for this card.
  //   - image kind: the single screenshot
  //   - link kind:  every captured slice across every page (full long pages)
  const dragImages = ((): string[] => {
    if (item.kind === 'link') {
      const pages = item.design?.pages || []
      const slices = pages.flatMap((p) => p.slices || []).filter(Boolean)
      if (slices.length) return slices
      return item.screenshot ? [item.screenshot] : []
    }
    return item.screenshot ? [item.screenshot] : []
  })()
  const canCopyImage = dragImages.length > 0
  const dragName = (item.title || 'pit-image').toLowerCase().replace(/\s+/g, '-')

  const copyImage = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!canCopyImage) return
    try {
      // System clipboards only hold one image at a time, so for multi-slice
      // links we stitch all slices into one tall PNG and copy that.
      const blob = await composeImagesToBlob(dragImages)
      if (!blob) throw new Error('no blob')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast.push(
        dragImages.length > 1
          ? `Image copied (${dragImages.length} slices stitched)`
          : 'Image copied'
      )
    } catch {
      toast.push('Copy image failed')
    }
  }

  const onDragStart = (e: React.DragEvent): void => {
    if (!canCopyImage) return
    // Stop the browser's default drag-ghost (we get a real OS file drag from main)
    // and route the actual drag through Electron so other apps receive real files.
    e.preventDefault()
    e.stopPropagation()
    const bridge = (
      window as unknown as { pit?: { dragImages?: (u: string[], n?: string) => void } }
    ).pit
    bridge?.dragImages?.(dragImages, dragName)
  }

  let title = item.title
  if (item.kind === 'quote') title = item.author || 'Quote'
  if (item.kind === 'note') title = item.meta || 'Note'

  const collection = collections.find((c) => c.id === item.collection)

  const analyzing = item.status === 'analyzing'
  const failed = item.status === 'failed'

  return (
    <div
      className={`card card-${item.kind}${analyzing ? ' card-analyzing' : ''}${failed ? ' card-failed' : ''}`}
      onClick={() => onClick?.(item)}
      // OS-level drag-out: drop this card into Finder / Slack / Notion / Figma
      // and you get the real PNG file(s). For sites this hands over every slice
      // of every page as separate files.
      draggable={canCopyImage}
      onDragStart={onDragStart}
    >
      {/* Wrap visual + overlays in a positioning container so the scan label /
          copy buttons (inset:0) stay confined to the image area and don't cover
          the title/meta footer below. */}
      <div style={{ position: 'relative' }}>
        <CardVisual item={item} />

        {analyzing && (
          <div className="scan-overlay">
            <div className="scan-grid" />
            <div className="scan-line" />
            <div className="scan-particles">
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={i} style={{ '--i': i } as React.CSSProperties} />
              ))}
            </div>
            <div className="scan-label">
              <span className="scan-dot" />
              {item.progress || 'Analyzing…'}
            </div>
          </div>
        )}
        {failed && (
          <div className="scan-overlay failed">
            <div className="scan-label">{item.error || 'Analysis failed'}</div>
          </div>
        )}

        {!analyzing && !failed && (
          <div className="card-overlay">
            {canCopyImage && (
              <button
                className="copy-btn icon"
                onClick={copyImage}
                title={
                  dragImages.length > 1
                    ? `Copy image (${dragImages.length} slices stitched). Drag to put real files into other apps.`
                    : 'Copy image. Drag to drop into other apps.'
                }
              >
                <I.Image size={13} />
              </button>
            )}
            <button
              className={`copy-btn${copied === 'style' ? ' copied' : ''}`}
              onClick={(e) => copy('style', e)}
              title="Copy style prompt — reusable design system"
              disabled={!stylePrompt}
            >
              {copied === 'style' ? <I.Check size={12} /> : <I.Sparkles size={12} />}
              {copied === 'style' ? 'Copied' : 'Style'}
            </button>
            <button
              className={`copy-btn${copied === 'replica' ? ' copied' : ''}`}
              onClick={(e) => copy('replica', e)}
              title="Copy replica prompt — rebuild this exact page/image"
              disabled={!replicaPrompt}
            >
              {copied === 'replica' ? <I.Check size={12} /> : <I.Copy size={12} />}
              {copied === 'replica' ? 'Copied' : 'Replica'}
            </button>
          </div>
        )}
      </div>

      <div className="card-body">
        <div className="c-title">{title}</div>
        {item.prompt && <div className="c-prompt">{item.prompt}</div>}
        <div className="c-meta">
          {item.kind === 'link' && (
            <span className="c-favicon" style={{ background: item.favicon || collection?.color }} />
          )}
          {collection && <span className="c-tag">{collection.name}</span>}
          {(item.tags || []).slice(0, 2).map((t) => (
            <span key={t}>· {t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
