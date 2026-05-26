// link-handlers/registry.ts — dispatch a URL to the first handler that
// claims it. Handlers are tried in registration order; the generic fallback
// is always last so source-specific ones win.

import type { LinkHandler, ExtractedLink, HandlerContext } from './types'
import { xhsHandler } from './xhs'
import { twitterHandler } from './twitter'
import { genericHandler } from './generic'

// Order matters — specific first, generic last.
const HANDLERS: LinkHandler[] = [xhsHandler, twitterHandler, genericHandler]

export function resolveHandler(url: string): LinkHandler {
  let u: URL
  try {
    u = new URL(url.startsWith('http') ? url : `https://${url}`)
  } catch {
    return genericHandler
  }
  for (const h of HANDLERS) {
    try {
      if (h.match(u)) return h
    } catch {
      // bad matcher — skip, don't crash the registry
    }
  }
  return genericHandler
}

export async function extractLink(url: string, ctx: HandlerContext): Promise<ExtractedLink> {
  const h = resolveHandler(url)
  ctx.onProgress?.(`Using ${h.label} handler…`)
  return h.extract(url, ctx)
}
