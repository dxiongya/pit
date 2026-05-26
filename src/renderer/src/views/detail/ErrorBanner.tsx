// ErrorBanner — shared "Analysis failed" banner shown in detail views when
// an item.error is set. Slim red-tinted strip with a warning glyph, a short
// human-friendly hint, and an optional Retry action.

import type { ReactNode } from 'react'

interface ErrorBannerProps {
  /** Raw error string (full text shown in title tooltip + readable). */
  error: string
  /** Optional cleaned-up summary (e.g. parseHumanError output). */
  hint?: string
  /** Optional retry callback — renders the Retry button when provided. */
  onRetry?: () => void
  /** Optional label for the retry button (default "Retry"). */
  retryLabel?: ReactNode
}

export function ErrorBanner({
  error,
  hint,
  onRetry,
  retryLabel
}: ErrorBannerProps): React.JSX.Element {
  return (
    <div className="detail-err-banner" title={error}>
      <div className="detail-err-icon" aria-hidden>
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path
            d="M7 1.5 L13 12.5 H1 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M7 5.5 V8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="7" cy="10.5" r="0.7" fill="currentColor" />
        </svg>
      </div>
      <div className="detail-err-body">
        <div className="detail-err-title">Analysis failed</div>
        <div className="detail-err-msg">{hint || error}</div>
      </div>
      {onRetry && (
        <button
          type="button"
          className="detail-err-retry"
          onClick={onRetry}
          title="Re-run analysis"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
            <path
              d="M11.5 4.5 V2 M11.5 4.5 H9 M11.5 4.5 A4.5 4.5 0 1 0 12.2 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {retryLabel || 'Retry'}
        </button>
      )}
    </div>
  )
}
