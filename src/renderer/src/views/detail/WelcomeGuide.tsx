// WelcomeGuide.tsx — first-run onboarding. A short, skippable tour of what pit
// is and how to use it. Auto-opens once (App tracks the `pit:onboarded` flag in
// localStorage) and is re-openable any time from the TopBar "?" button.

import { useEffect, useState } from 'react'
import { I } from '../../lib/icons'
import { Button } from '../../components/ui'

type Glyph = (p: { size?: number }) => React.JSX.Element

type Step = {
  glyph: Glyph
  accent: string
  title: string
  body: React.ReactNode
  /** Optional inline call-to-action (e.g. jump to Settings to add an AI key). */
  cta?: { label: string; onClick: () => void }
}

export function WelcomeGuide({
  onClose,
  onOpenSettings
}: {
  onClose: () => void
  onOpenSettings: () => void
}): React.JSX.Element {
  const [step, setStep] = useState(0)

  const steps: Step[] = [
    {
      glyph: I.Sparkles,
      accent: '#e8624a',
      title: 'Welcome to pit',
      body: (
        <>
          Your <strong>design-reference brain</strong>. Capture anything you find — sites,
          screenshots, tweets, 小红书 notes, videos — and pit turns it into structured design
          knowledge you can search, remix, and share.
        </>
      )
    },
    {
      glyph: I.Link,
      accent: '#4356a0',
      title: 'Capture anything — just paste',
      body: (
        <>
          Press <span className="wg-kbd">⌘V</span> anywhere, or drag files in. pit understands full
          web pages, X &amp; 小红书 posts, image sets, and screen recordings — even a whole share
          blob copied from an app. No clipping, no tagging by hand.
        </>
      )
    },
    {
      glyph: I.Wand,
      accent: '#8b4a7c',
      title: 'AI reads the design',
      body: (
        <>
          Every item becomes a <strong>DESIGN.md</strong> — palette &amp; roles, typography,
          components, layout, motion — grounded in the page&apos;s real source, not a guess from a
          screenshot. Add an AI key to switch this on.
        </>
      ),
      cta: { label: 'Set up AI', onClick: onOpenSettings }
    },
    {
      glyph: I.Folder,
      accent: '#2f8e8a',
      title: 'Collections that file themselves',
      body: (
        <>
          Give a collection a plain-language <strong>prompt</strong> — &ldquo;dark, dense analytics
          dashboards&rdquo; — and new items auto-route to where they belong. The builder previews
          what would land there before you save.
        </>
      )
    },
    {
      glyph: I.Share,
      accent: '#e6a73a',
      title: 'Share a curated set',
      body: (
        <>
          Send one item or a <strong>hand-picked subset</strong> of a collection as a single public
          link — live preview, optional password, expiry. Keep uploads small; share only what
          matters.
        </>
      )
    }
  ]

  const last = step === steps.length - 1
  const s = steps[step]
  const Glyph = s.glyph

  // Esc closes; ← / → walk the tour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && !last) setStep((v) => v + 1)
      else if (e.key === 'ArrowLeft' && step > 0) setStep((v) => v - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, last, step])

  return (
    <div
      className="detail-overlay"
      onClick={onClose}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <div className="welcome-guide" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="wg-close" onClick={onClose} title="Close">
          <I.Close size={15} />
        </button>

        <div
          className="wg-glyph"
          style={{
            background: `color-mix(in srgb, ${s.accent} 16%, transparent)`,
            color: s.accent
          }}
        >
          <Glyph size={26} />
        </div>

        <div className="wg-step-no">
          Step {step + 1} of {steps.length}
        </div>
        <h2 className="wg-title">{s.title}</h2>
        <p className="wg-body">{s.body}</p>

        {s.cta && (
          <button type="button" className="wg-cta ui-link" onClick={s.cta.onClick}>
            {s.cta.label} <I.ArrowRight size={13} />
          </button>
        )}

        <div className="wg-dots" role="tablist" aria-label="Tour progress">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`wg-dot${i === step ? ' on' : ''}`}
              aria-label={`Go to step ${i + 1}`}
              aria-selected={i === step}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        <div className="wg-foot">
          <Button size="sm" onClick={onClose}>
            {last ? 'Close' : 'Skip'}
          </Button>
          <div className="wg-foot-right">
            {step > 0 && (
              <Button size="sm" onClick={() => setStep((v) => v - 1)}>
                <I.Back size={13} /> Back
              </Button>
            )}
            {last ? (
              <Button variant="primary" onClick={onClose}>
                <I.Check size={13} /> Get started
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setStep((v) => v + 1)}>
                Next <I.ArrowRight size={13} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
