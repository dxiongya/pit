// link-handlers/generic.ts — fallback handler that wraps the existing
// captureSite + analyzeSite pipeline. Behaves exactly like pit's pre-handler
// "drop a URL → screenshot the site → analyze" flow.

import type { LinkHandler, ExtractedLink, CapturedPage } from './types'
import { captureSite } from '../capture'

export const genericHandler: LinkHandler = {
  id: 'generic',
  label: 'Web page',
  match(): boolean {
    return true // last-resort fallback; registry order ensures specifics run first
  },
  async extract(url, ctx): Promise<ExtractedLink> {
    const captured: CapturedPage[] = []
    await captureSite(url, (p) => {
      captured.push(p)
      ctx.onProgress?.(`Captured ${captured.length} page${captured.length > 1 ? 's' : ''}`)
    })
    const home = captured[0]
    return {
      kind: 'site',
      title: home?.name || hostOf(url),
      canonicalUrl: url,
      images: [],
      videos: [],
      capturedPages: captured
    }
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
