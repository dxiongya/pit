// DetailOverlay.tsx — modal wrapper choosing the right detail panel for an item.

import { useEffect, useState } from 'react'
import type { Item } from '../../lib/types'
import { I } from '../../lib/icons'
import { useStore } from '../../lib/store'
import { useToast } from '../../components/Toast'
import { LinkDetail } from './LinkDetail'
import { ImageDetail } from './ImageDetail'
import { VideoDetail } from './VideoDetail'
import { AnalyzingDetail } from './AnalyzingDetail'
import { MoveToButton } from './MoveTo'
import { DeriveModal } from './DeriveModal'

export function DetailOverlay({
  item,
  onClose,
  onShare
}: {
  item: Item
  onClose: () => void
  onShare: () => void
}): React.JSX.Element {
  const { removeItem } = useStore()
  const toast = useToast()
  const [deriveOpen, setDeriveOpen] = useState(false)

  // Esc closes the overlay (but not when DeriveModal is up — it has its own).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !deriveOpen) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, deriveOpen])

  const analyzing = item.status === 'analyzing'
  // Only show Derive once analysis has produced at least one replica prompt.
  const canDerive =
    !analyzing &&
    !!item.design &&
    (!!item.design.replicaPrompt ||
      (item.design.pages || []).some((p) => p.replicaPrompt && p.replicaPrompt.trim()))

  const handleDelete = (): void => {
    if (analyzing) {
      // No confirm for cancel — analyzing items are easily re-pasted, the
      // friction is unnecessary and the user explicitly clicked "stop".
      removeItem(item.id)
      toast.push('Cancelled — paste again to retry')
      onClose()
      return
    }
    const label = item.title || item.url || 'this item'
    if (!confirm(`Delete "${label}"? This can't be undone.`)) return
    removeItem(item.id)
    toast.push('Deleted')
    onClose()
  }

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="detail-actions">
          {!analyzing && <MoveToButton item={item} />}
          {canDerive && (
            <button
              className="detail-action"
              onClick={() => setDeriveOpen(true)}
              title="Generate HTML derivatives (color + content variations)"
            >
              <I.Wand size={14} />
            </button>
          )}
          <button
            className="detail-action danger"
            onClick={handleDelete}
            title={analyzing ? 'Cancel analysis and remove' : 'Delete this item'}
          >
            <I.Trash size={14} />
          </button>
          <button className="detail-close" onClick={onClose} title="Close">
            <I.Close size={14} />
          </button>
        </div>
        {item.status === 'analyzing' ? (
          <AnalyzingDetail item={item} />
        ) : item.kind === 'link' ? (
          <LinkDetail item={item} onShare={onShare} />
        ) : item.kind === 'video' ||
          // Image GROUPS (imported via GroupImportModal) get the multi-frame
          // strip viewer too — VideoDetail handles the page-switch UX cleanly
          // and adapts labels based on item.kind.
          (item.kind === 'image' && (item.design?.pages?.length ?? 0) > 1) ? (
          <VideoDetail item={item} onShare={onShare} />
        ) : (
          <ImageDetail item={item} onShare={onShare} />
        )}
      </div>
      {deriveOpen && <DeriveModal item={item} onClose={() => setDeriveOpen(false)} />}
    </div>
  )
}
