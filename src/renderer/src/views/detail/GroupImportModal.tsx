// GroupImportModal — dedicated entry for importing a SET of related images
// as ONE design-study Item (single batched AI analysis across all of them).
//
// Opposite of paste/drag, which intentionally creates separate items per
// image. Used when the user knows the images belong together — variants of
// the same component, screens of one app flow, a mood board.

import { useEffect, useRef, useState } from 'react'
import { I } from '../../lib/icons'
import { Button, Input } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { useStore } from '../../lib/store'

const MAX_GROUP = 12

interface DraftImage {
  id: string
  dataUrl: string
  name: string
}

export function GroupImportModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const toast = useToast()
  const { importImageGroup } = useStore()
  const [drafts, setDrafts] = useState<DraftImage[]>([])
  const [title, setTitle] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const ingest = (files: File[]): void => {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) {
      toast.push('No image files')
      return
    }
    const room = MAX_GROUP - drafts.length
    if (room <= 0) {
      toast.push(`Cap is ${MAX_GROUP} images per group`)
      return
    }
    const taken = images.slice(0, room)
    if (taken.length < images.length) {
      toast.push(`Cap is ${MAX_GROUP} — dropped ${images.length - taken.length}`)
    }
    taken.forEach((f) => {
      const reader = new FileReader()
      reader.onload = (): void => {
        const dataUrl = reader.result as string
        setDrafts((prev) => [
          ...prev,
          { id: Math.random().toString(36).slice(2), dataUrl, name: f.name }
        ])
      }
      reader.readAsDataURL(f)
    })
  }

  // Esc cancels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Paste-while-modal-open also funnels into drafts so users can fill the
  // group with multiple paste-rounds without flooding inbox.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent): void => {
      const items = Array.from(e.clipboardData?.items || []).filter((i) =>
        i.type.startsWith('image/')
      )
      if (items.length === 0) return
      e.preventDefault()
      const files = items.map((i) => i.getAsFile()).filter((f): f is File => f != null)
      ingest(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [drafts.length])

  const onDragOver = (e: React.DragEvent): void => {
    if (Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault()
      setDragOver(true)
    }
  }
  const onDragLeave = (): void => setDragOver(false)
  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
    ingest(Array.from(e.dataTransfer.files || []))
  }

  const removeDraft = (id: string): void => {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  const confirm = (): void => {
    if (drafts.length === 0) return
    importImageGroup(
      drafts.map((d) => d.dataUrl),
      title.trim() || undefined
    )
    toast.push(`Analyzing ${drafts.length}-image group…`)
    onClose()
  }

  return (
    <div
      className="detail-overlay"
      onClick={onClose}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        className="share-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(640px, 92vw)', maxWidth: 'unset' }}
      >
        <h3>Import as a group</h3>
        <div className="sub">
          Combine related images (variants of a design, screens of an app, a moodboard)
          into ONE item. Pit runs a single batched analysis that finds the shared design
          language across the set.
        </div>

        <div
          className={`group-drop${dragOver ? ' drag-over' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {drafts.length === 0 ? (
            <>
              <I.Upload size={22} />
              <div className="group-drop-h">Drop image files here</div>
              <div className="muted" style={{ fontSize: 12 }}>
                or paste from clipboard ·{' '}
                <button
                  type="button"
                  className="group-drop-link"
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse files
                </button>
              </div>
            </>
          ) : (
            <div className="group-thumbs">
              {drafts.map((d, i) => (
                <div key={d.id} className="group-thumb">
                  <img src={d.dataUrl} alt={d.name} />
                  <span className="group-thumb-i">{i + 1}</span>
                  <button
                    type="button"
                    className="group-thumb-x"
                    onClick={() => removeDraft(d.id)}
                    title={`Remove ${d.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              {drafts.length < MAX_GROUP && (
                <button
                  type="button"
                  className="group-thumb add"
                  onClick={() => fileInputRef.current?.click()}
                  title="Add more images"
                >
                  +
                </button>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) ingest(Array.from(e.target.files))
              e.target.value = '' // allow same file re-pick
            }}
          />
        </div>

        {drafts.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="hk">TITLE (OPTIONAL)</label>
            <Input
              placeholder={`Design study · ${drafts.length} images`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={confirm}
            disabled={drafts.length === 0}
          >
            <I.Layers size={13} /> Import {drafts.length || ''} as group
          </Button>
        </div>
      </div>
    </div>
  )
}
