// ai.ts — main-process AI calls.
//
// Today: real credential verification per provider (a cheap `/models` GET).
// Reserved next: analyzeSite / analyzeImage / route, which will send the
// design-analyst SKILL.md as system prompt + the output-schema.json contract.

export interface RoleRequest {
  kind: 'anthropic' | 'openai' | 'google' | 'openai-compatible'
  name?: string
  model: string
  apiKey: string
  baseURL?: string
}

async function getJson(url: string, headers: Record<string, string>): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    return await fetch(url, { headers, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

/** Verify a provider's credentials by listing models. */
export async function testProvider(req: RoleRequest): Promise<{ ok: boolean; message: string }> {
  try {
    if (req.kind === 'anthropic') {
      if (!req.apiKey) return { ok: false, message: 'No API key set' }
      const res = await getJson('https://api.anthropic.com/v1/models', {
        'x-api-key': req.apiKey,
        'anthropic-version': '2023-06-01'
      })
      return res.ok
        ? { ok: true, message: `Connected · ${req.model}` }
        : { ok: false, message: `HTTP ${res.status} ${res.statusText}` }
    }

    if (req.kind === 'google') {
      if (!req.apiKey) return { ok: false, message: 'No API key set' }
      const res = await getJson(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(req.apiKey)}`,
        {}
      )
      return res.ok
        ? { ok: true, message: `Connected · ${req.model}` }
        : { ok: false, message: `HTTP ${res.status} ${res.statusText}` }
    }

    // openai + openai-compatible
    const base = (req.kind === 'openai' ? 'https://api.openai.com/v1' : req.baseURL || '').replace(
      /\/+$/,
      ''
    )
    if (!base) return { ok: false, message: 'No base URL set' }
    const headers: Record<string, string> = {}
    if (req.apiKey) headers['Authorization'] = `Bearer ${req.apiKey}`
    const res = await getJson(`${base}/models`, headers)
    return res.ok
      ? { ok: true, message: `Connected · ${req.model}` }
      : { ok: false, message: `HTTP ${res.status} ${res.statusText}` }
  } catch (e) {
    const msg =
      e instanceof Error ? (e.name === 'AbortError' ? 'Timed out' : e.message) : 'Network error'
    return { ok: false, message: msg }
  }
}

/* ============================================================
   Chat completion — one entry point, four provider shapes.
   Returns the model's text (expected to be JSON when `json` is set).
   ============================================================ */

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300)
  } catch {
    return ''
  }
}

function parseDataUrl(d: string): { mediaType: string; data: string } {
  const m = d.match(/^data:([^;]+);base64,([\s\S]*)$/)
  return m ? { mediaType: m[1], data: m[2] } : { mediaType: 'image/png', data: '' }
}

/**
 * Should we retry the failed request, or is it permanently broken? We retry
 * network failures, 5xx, and 429 (rate limit). 4xx other than 429 is a bug or
 * a bad key — no point hammering the server.
 */
function isRetryable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  const m = msg.match(/^HTTP (\d{3})/)
  if (m) {
    const code = parseInt(m[1], 10)
    return code >= 500 || code === 429 || code === 408
  }
  // No HTTP prefix → network error / abort / timeout — retry.
  return true
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** One chat completion with up to 3 attempts (exponential backoff: 0.5s, 1s). */
export async function callModel(
  req: RoleRequest,
  system: string,
  user: string,
  json: boolean,
  images: string[] = []
): Promise<string> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await callModelOnce(req, system, user, json, images)
    } catch (e) {
      lastErr = e
      if (!isRetryable(e) || attempt === 2) throw e
      await sleep(500 * 2 ** attempt)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('callModel failed')
}

/** Single attempt — no retry. */
async function callModelOnce(
  req: RoleRequest,
  system: string,
  user: string,
  json: boolean,
  images: string[] = []
): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 60000)
  const imgs = images.map(parseDataUrl)
  try {
    if (req.kind === 'anthropic') {
      const content: unknown[] = []
      for (const im of imgs)
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: im.mediaType, data: im.data }
        })
      content.push({ type: 'text', text: user })
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': req.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: req.model,
          max_tokens: 2048,
          system,
          messages: [{ role: 'user', content }]
        }),
        signal: ctrl.signal
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${await safeText(res)}`)
      const data = (await res.json()) as { content?: { type: string; text?: string }[] }
      return data.content?.find((c) => c.type === 'text')?.text ?? ''
    }

    if (req.kind === 'google') {
      const parts: unknown[] = []
      for (const im of imgs) parts.push({ inline_data: { mime_type: im.mediaType, data: im.data } })
      parts.push({ text: user })
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent?key=${encodeURIComponent(req.apiKey)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0,
            ...(json ? { responseMimeType: 'application/json' } : {})
          }
        }),
        signal: ctrl.signal
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${await safeText(res)}`)
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    }

    // openai + openai-compatible
    const base = (req.kind === 'openai' ? 'https://api.openai.com/v1' : req.baseURL || '').replace(
      /\/+$/,
      ''
    )
    if (!base) throw new Error('No base URL set')
    const userContent = images.length
      ? [
          { type: 'text', text: user },
          ...images.map((u) => ({ type: 'image_url', image_url: { url: u } }))
        ]
      : user
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(req.apiKey ? { Authorization: `Bearer ${req.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: req.model,
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent }
        ],
        // only standard OpenAI reliably supports json_object response_format
        ...(json && req.kind === 'openai' ? { response_format: { type: 'json_object' } } : {})
      }),
      signal: ctrl.signal
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await safeText(res)}`)
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content ?? ''
  } finally {
    clearTimeout(t)
  }
}

/**
 * Streaming chat completion with retry. Up to 3 attempts, but ONLY retries
 * when the previous attempt produced zero chunks — re-streaming after partial
 * output would duplicate text in the caller's accumulator.
 */
async function callModelStream(
  req: RoleRequest,
  system: string,
  user: string,
  images: string[],
  onChunk: (chunk: string) => void
): Promise<string> {
  let lastErr: unknown
  let receivedAny = false
  const tracked = (c: string): void => {
    receivedAny = true
    onChunk(c)
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    receivedAny = false
    try {
      return await callModelStreamOnce(req, system, user, images, tracked)
    } catch (e) {
      lastErr = e
      if (receivedAny || !isRetryable(e) || attempt === 2) throw e
      await sleep(500 * 2 ** attempt)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('callModelStream failed')
}

/** Single streaming attempt — no retry. */
async function callModelStreamOnce(
  req: RoleRequest,
  system: string,
  user: string,
  images: string[],
  onChunk: (chunk: string) => void
): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 90000)
  const imgs = images.map(parseDataUrl)
  let full = ''
  const pump = async (res: Response, extract: (j: unknown) => string): Promise<void> => {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await safeText(res)}`)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response stream')
    const dec = new TextDecoder()
    let buf = ''
    // Idle timeout — if the server stops sending for 30s, abort and let the
    // outer retry kick in. Resets on every chunk we actually receive.
    let idle: ReturnType<typeof setTimeout> | null = null
    const resetIdle = (): void => {
      if (idle) clearTimeout(idle)
      idle = setTimeout(() => ctrl.abort(), 30000)
    }
    resetIdle()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        resetIdle()
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const l = line.trim()
          if (!l.startsWith('data:')) continue
          const p = l.slice(5).trim()
          if (!p || p === '[DONE]') continue
          let j: unknown
          try {
            j = JSON.parse(p)
          } catch {
            continue
          }
          const d = extract(j)
          if (d) {
            full += d
            onChunk(d)
          }
        }
      }
    } finally {
      if (idle) clearTimeout(idle)
    }
  }
  try {
    if (req.kind === 'anthropic') {
      const content: unknown[] = []
      for (const im of imgs)
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: im.mediaType, data: im.data }
        })
      content.push({ type: 'text', text: user })
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': req.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: req.model,
          max_tokens: 2048,
          system,
          stream: true,
          messages: [{ role: 'user', content }]
        }),
        signal: ctrl.signal
      })
      await pump(res, (j) => {
        const o = j as { type?: string; delta?: { text?: string } }
        return o.type === 'content_block_delta' ? (o.delta?.text ?? '') : ''
      })
      return full
    }

    if (req.kind === 'google') {
      const parts: unknown[] = []
      for (const im of imgs) parts.push({ inline_data: { mime_type: im.mediaType, data: im.data } })
      parts.push({ text: user })
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(req.apiKey)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts }]
        }),
        signal: ctrl.signal
      })
      await pump(res, (j) => {
        const o = j as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
        return o.candidates?.[0]?.content?.parts?.map((x) => x.text ?? '').join('') ?? ''
      })
      return full
    }

    // openai + openai-compatible
    const base = (req.kind === 'openai' ? 'https://api.openai.com/v1' : req.baseURL || '').replace(
      /\/+$/,
      ''
    )
    if (!base) throw new Error('No base URL set')
    const userContent = images.length
      ? [
          { type: 'text', text: user },
          ...images.map((u) => ({ type: 'image_url', image_url: { url: u } }))
        ]
      : user
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(req.apiKey ? { Authorization: `Bearer ${req.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: req.model,
        temperature: 0,
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent }
        ]
      }),
      signal: ctrl.signal
    })
    await pump(res, (j) => {
      const o = j as { choices?: { delta?: { content?: string } }[] }
      return o.choices?.[0]?.delta?.content ?? ''
    })
    return full
  } finally {
    clearTimeout(t)
  }
}

function extractJson<T>(s: string): T {
  const cleaned = s.replace(/```json\s*|\s*```/g, '')
  const match = cleaned.match(/\{[\s\S]*\}/)
  return JSON.parse(match ? match[0] : cleaned) as T
}

/* ============================================================
   Routing — feature 4 (skill Task C). Text-only classification.
   ============================================================ */

interface RouteItemInput {
  req: RoleRequest
  item: { title?: string; description?: string; tags?: string[] }
  collections: { id: string; name: string; prompt?: string; tags?: string[]; skip?: string[] }[]
  threshold: number
}
interface RoutingResult {
  suggestions: { collectionId: string; confidence: number; reason: string }[]
  best: string
}

const ROUTING_SYSTEM = `You are pit's routing classifier. Decide which collection a newly imported item belongs to by semantic match.

Input shape (already JSON):
{
  "item":        { "title", "description", "tags" },        // what was just imported
  "collections": [ { "id", "name", "prompt" } ],            // each collection's free-form description ("prompt")
  "threshold":   <0-100>                                     // min confidence to commit
}

How to score:
- Treat each collection's "prompt" as a natural-language definition of what belongs there. Read it carefully — including any "skip / not / exclude" clauses (those are hard exclusions; cap confidence at 20 if the item hits one).
- Score every collection 0–100 on how well the item's title + description + tags MATCH that prompt's intent.
- Consider the collection NAME as a strong semantic hint too — "App" almost always means mobile app, "Web" means browser/desktop, etc. Use common product taxonomy.

Picking "best" — PREFER COMMIT OVER INBOX:
- If the top collection scores ≥ threshold, pick it.
- If the top collection scores 30–threshold AND is at least 15 points ahead of the runner-up (and ahead of "nothing fits"), STILL pick it — the user created collections so items get sorted, not so they pile up in Inbox.
- Only return "best":"inbox" when nothing has any meaningful match (top score < 30, or two collections are within 5 points of each other AND both look like a stretch).

Respond with ONLY a JSON object, no prose, no markdown fences:
{"suggestions":[{"collectionId":"<id>","confidence":<0-100>,"reason":"<one short line>"}],"best":"<id or 'inbox'>"}`

export async function routeItem(input: RouteItemInput): Promise<RoutingResult> {
  const user = JSON.stringify({
    item: input.item,
    collections: input.collections,
    threshold: input.threshold
  })
  const text = await callModel(input.req, ROUTING_SYSTEM, user, true)
  return extractJson<RoutingResult>(text)
}

/** One-shot helper: turn a collection name (+ optional seed line) into a clean
 *  2-3 sentence description suitable for routing. Cheap text-only call. */
const DESCRIPTION_SYSTEM = `You are pit's helper. The user is creating a "collection" — a folder in pit where AI auto-files newly imported design references. Given a collection name (and an optional seed line), write a clear 2–3 sentence description of what kinds of items belong here.

This description is what the routing model later reads to decide whether each new item fits.

Rules:
- Concrete: name specific subjects, media, styles, or platforms ("iOS dashboards", not "mobile stuff").
- If the name implies things to exclude, say what to skip too ("Skip desktop web layouts").
- Plain English, no marketing fluff, no buzzwords.
- 2–3 sentences max, 40–80 words.
- Output ONLY the description text. No quotes, no "Here is:", no markdown.`

export async function suggestCollectionDescription(input: {
  req: RoleRequest
  name: string
  hint?: string
}): Promise<string> {
  const user = JSON.stringify({ name: input.name, hint: input.hint || '' })
  const text = await callModel(input.req, DESCRIPTION_SYSTEM, user, false)
  return text.trim().replace(/^["']|["']$/g, '')
}

/* ============================================================
   Image analysis — feature 2 (skill Task B). Vision → DesignDoc JSON.
   ============================================================ */

/** STYLE pass — extracts design tokens as JSON only. No prose prompts. */
const IMAGE_STYLE_SYSTEM = `You analyze ONE image and extract its design tokens as JSON. Output ONLY a fenced \`\`\`json block — do NOT write replicaPrompt or stylePrompt (those are produced by separate passes).

First gate: set "usable":false + a short "reason" if the image is unrelated/blurry/no design language. Otherwise "usable":true.
Detect "assetType": ui | web-page | poster | photo | illustration | palette | typography | logo | icon | texture | other.

Extract ONLY what's observable, never invent:
- palette: 4-6 colors by dominance, each {"hex":"#RRGGBB" UPPERCASE, "role":"dominant|accent|shadow|highlight|...", "pct":<number>}
- mood: affective tags; style: visual-style tags; materials: physical reads (ceramic, linen, matte…)
- composition: short framing/layout note
- fonts: [{role, name, sample, weight, size}] (only if type present)
- components: [{name, count, tokens:"r:8 · h:36 · px:16 · ink/paper · hover:invert"}] (UI only)
- theme + description (one paragraph each)
- tags (lowercase-hyphenated); title; confidence (0-100)

PLATFORM TAG — REQUIRED for any UI / app / website screenshot. tags MUST include exactly ONE of:
  - "mobile-ui"  for phone screenshots (iOS / Android / vertical 9:16-ish viewports, status bar, rounded phone frame, tab bar at bottom, back-arrow nav at top, etc)
  - "tablet-ui"  for iPad / tablet screenshots
  - "desktop-web" for browser-based websites or web apps (full address bar / window chrome / horizontal layout > 1200px wide)
  - "desktop-app" for native desktop software (Mac/Windows window chrome, not browser)
This tag is how routing decides whether the item belongs in an "App" vs "Web" collection — never omit it for UI assets.

Reminder: the 1-3 sentence prose MUST come first (it streams as live thinking). Then the JSON:
{"usable":true,"assetType":"photo","confidence":80,"title":"","description":"","theme":"","palette":[],"mood":[],"style":[],"materials":[],"composition":"","fonts":[],"components":[],"tags":[],"warnings":[]}`

/** REPLICA pass — writes the rebuild prompt for one image. Markdown only, no JSON. */
const IMAGE_REPLICA_SYSTEM = `You analyze ONE image and write a complete REPLICA PROMPT for recreating it precisely. Output ONLY the markdown body — no JSON, no preamble, no "Sure, here is…".

Format (≥ 350 words, use these bold section headers in this order):
  **Subject & Framing** · **Layout & Composition** · **Color** (exact hex) · **Typography** (every visible face + size + weight) · **Components / Elements** (every visible UI element, icon, badge, button — enumerated) · **Text / Copy** (every legible string verbatim, including numbers, times, emails, names) · **Imagery / Illustration** · **Materials & Lighting** (if photo) · **Reproduction Notes** (radii, gaps, padding values).

ENUMERATION DISCIPLINE — the #1 failure is paraphrasing where you should enumerate:
  ✗ BAD:  "Sidebar with several icons"   |  "Action toolbar with reply, archive…"  |  "Various status badges throughout"
  ✓ GOOD (Components section):
    - Left sidebar (icon-only, ~56px wide, top→bottom):
      1. Workspace switcher (asterisk/star logo)
      2. New mail (envelope + plus icon)
      3. Saved (heart-on-envelope icon)
      4. Inbox (envelope, ACTIVE — pill background fill)
      5. Folders (folder icon)
      6. Workflows (sitemap icon)
      7. Tasks (clipboard icon)
      8. Documents (file icon)
    - Top-right action cluster (3 square IconButtons, r:8): archive, trash, forward
  ✓ GOOD (Text / Copy — verbatim):
    - Header: "Inbox · 14.171 emails"
    - Pills (L→R): "Continue", "Inbox 14.171", "Sent items", "Drafts"
    - Sender: name "Rico Oktananda", email "rico.oktananda1@gmail.com", timestamp "05.16"

If an element is visible, it MUST appear. If you write "several" / "various" / "throughout" / "etc." — stop and enumerate.`

interface AnalyzeImageInput {
  req: RoleRequest
  dataUrl: string
}

const IMAGE_STYLE_USER = 'Describe this image briefly, then output the design-tokens JSON.'
const IMAGE_REPLICA_USER =
  'Write the complete replica prompt for recreating this image. Markdown only, no JSON.'

/**
 * Two-pass image analysis, but the two passes run IN PARALLEL — total wall
 * time ≈ max(style, replica) instead of sum. Both calls hit the same provider
 * with the same image, just different system prompts.
 *  1. STYLE — token JSON (palette/fonts/components/etc), streamed so the user
 *     sees thinking live.
 *  2. REPLICA — separate call, single focus = the rebuild prompt. Best-effort.
 *  3. stylePrompt is then code-assembled from the tokens (no vision creativity).
 */
export async function analyzeImage(
  input: AnalyzeImageInput,
  onChunk?: (chunk: string) => void
): Promise<Record<string, unknown>> {
  const tokensP = onChunk
    ? callModelStream(input.req, IMAGE_STYLE_SYSTEM, IMAGE_STYLE_USER, [input.dataUrl], onChunk)
    : callModel(input.req, IMAGE_STYLE_SYSTEM, IMAGE_STYLE_USER, false, [input.dataUrl])
  // best-effort — never sink the whole analysis if replica alone fails
  const replicaP = callModel(input.req, IMAGE_REPLICA_SYSTEM, IMAGE_REPLICA_USER, false, [
    input.dataUrl
  ]).catch(() => '')
  const [tokensText, replicaPrompt] = await Promise.all([tokensP, replicaP])
  const tokens = extractJson<Record<string, unknown>>(tokensText)
  return { ...tokens, replicaPrompt: replicaPrompt.trim(), stylePrompt: buildStylePrompt(tokens) }
}

/* ============================================================
   Site analysis — feature 1 (skill Task A). Multi-screenshot → DESIGN.md JSON.
   Focused on design + component style, not business content.
   ============================================================ */

/** STYLE pass — site-wide token extraction. JSON only, no prose prompts. */
const SITE_STYLE_SYSTEM = `You analyze SCREENSHOTS from one website (typically several pages) and extract its DESIGN SYSTEM. Focus on visual + component style, not business copy.

OUTPUT FORMAT — STRICT, two parts in this order:
  1) FIRST: stream 1-3 short sentences describing the site's overall design language. This is shown to the user as live "thinking" — it MUST come out before any \`{\` or \`\`\` character. No "Here is:" preface, just describe.
  2) THEN: a fenced \`\`\`json block with the tokens.

Do NOT write replicaPrompt or stylePrompt (those are produced by separate passes).

Fields (awesome-design-md DESIGN.md spec):
- theme + description (one paragraph each — design DNA across the whole site)
- palette: 5-8 colors [{"hex":"#RRGGBB","role":"ink|paper|primary|accent|...","pct":<n>}]
- fonts: [{role:"display|heading|body|caption|mono", name, sample, weight, size}]
- components: 5-12 [{name:"Primary button|Card|Pill|Input|Nav…", count, tokens:"r:8 · h:36 · px:16 · ink/paper · hover:invert"}] — capture shape/size/states as tokens
- ia: [{lvl, label, meta}] + layoutNote: "12-col · 1216 max · gutter 24 · asymmetric"
- motion: [{type, easing, dur, bar:0-100}]
- dos: 3-5 non-negotiables  ·  donts: 3-5 anti-patterns
- responsive: breakpoints/touch/collapse  ·  a11y: [{label, grade:A|B|C, detail}]
- tags (lowercase-hyphenated); title; assetType:"web-page"; confidence (0-100)

Reminder: the 1-3 sentence prose MUST come first (it streams as live thinking). Then the JSON:
{"usable":true,"assetType":"web-page","confidence":80,"title":"","description":"","theme":"","palette":[],"fonts":[],"components":[],"ia":[],"layoutNote":"","motion":[],"dos":[],"donts":[],"responsive":"","a11y":[],"tags":[],"warnings":[]}`

/** REPLICA pass — per-page rebuild prompt. Markdown only, no JSON. */
const SITE_REPLICA_SYSTEM = `You analyze the screenshots of ONE PAGE of a website and write a complete REPLICA PROMPT for rebuilding THIS exact page. Output ONLY the markdown body — no JSON, no preamble.

Format (≥ 400 words, use these bold section headers in this order):
  **Page Layout** (every visible block, top→bottom, with widths) · **Navigation** (every nav item / icon / dropdown — enumerated) · **Hero / Above-the-fold** (verbatim headlines, sub-copy, CTAs, imagery) · **Sections** (one block per visible section with verbatim copy + component specs) · **Color** (every hex used as CSS var) · **Typography** (every face + weight + size visible) · **Components** (every button / card / input / badge with shape, tokens, states) · **Imagery** (logos, photos, illustrations — described specifically) · **Reproduction Notes** (radii, gaps, max-width, breakpoints).

ENUMERATION DISCIPLINE — the #1 failure is paraphrasing where you should enumerate:
  ✗ BAD:  "Hero section with image and CTA"  |  "Several feature cards below"  |  "Footer with links and contact"  |  "Navigation includes the usual menu items"
  ✓ GOOD (Navigation):
    - Top nav (sticky, 64px tall, transparent on hero, white on scroll):
      1. Logo (left, handwritten script "hb")
      2. Menu pill (right, r:9999, 1.5px border, monospace label "MENU")
  ✓ GOOD (Sections — each visible section enumerated, verbatim):
    - Section 1 · Hero (60% image left / 40% text right):
        H1: "We help startups raise, rebrand and ship"
        sub: "A digital studio for growing companies"
        CTA pill: "Start a project"
    - Section 2 · Case study "Emhance" (image-right, asymmetric):
        Quote: "A growing startup raised investment, outgrew its name…"
        Tags: "branding · ui · motion"
    - (continue for every visible section — do not stop early)
  ✓ GOOD (Components):
    - Pill button: r:9999, h:36, px:18, 1.5px ink border, monospace 13px label, hover inverts ink/paper
    - Card surface: r:24, bg-paper, no shadow, 32px padding

Transcribe every legible string verbatim. If "several" / "various" / "throughout" / "etc." shows up — stop and enumerate. Only describe THIS page — do NOT mix in other pages of the same site.`

const SITE_STYLE_USER =
  'These are representative screenshots from across the site. Describe its design language briefly, then output the design-tokens JSON.'
const SITE_REPLICA_USER =
  'These are the screenshots of ONE page. Write the complete replica prompt for rebuilding it. Markdown only, no JSON.'

interface AnalyzeSitePage {
  name: string
  slices: string[]
}

interface AnalyzeSiteInput {
  req: RoleRequest
  pages: AnalyzeSitePage[]
}

/**
 * Three-pass site analysis:
 *  1. STYLE — one streamed call over representative slices from every page,
 *     extracts JSON tokens (palette / fonts / components / ia / motion / etc).
 *  2. REPLICA — one call PER page, focused on that single page's slices, writes
 *     a markdown rebuild prompt. Sequential to keep request rate sane.
 *  3. stylePrompt is then code-assembled from the tokens (no vision creativity,
 *     no risk of invented details).
 */
export async function analyzeSite(
  input: AnalyzeSiteInput,
  onChunk?: (chunk: string) => void
): Promise<Record<string, unknown>> {
  // Site-wide style + every per-page replica all fire in PARALLEL — total wall
  // time ≈ max() instead of sum(). A 4-page site goes from ~5×slow to ~1×slow.
  // Each per-page replica catches its own error so one bad page can't sink the rest.
  const sample = input.pages
    .flatMap((p) => (p.slices || []).slice(0, 2))
    .filter(Boolean)
    .slice(0, 8)
  const tokensP = onChunk
    ? callModelStream(input.req, SITE_STYLE_SYSTEM, SITE_STYLE_USER, sample, onChunk)
    : callModel(input.req, SITE_STYLE_SYSTEM, SITE_STYLE_USER, false, sample)

  const replicaP = Promise.all(
    input.pages.map(async (page) => {
      const shots = (page.slices || []).slice(0, 3).filter(Boolean)
      if (!shots.length) return [page.name, ''] as const
      try {
        const text = await callModel(
          input.req,
          SITE_REPLICA_SYSTEM,
          SITE_REPLICA_USER,
          false,
          shots
        )
        return [page.name, text.trim()] as const
      } catch {
        return [page.name, ''] as const
      }
    })
  )

  const [tokensText, replicaEntries] = await Promise.all([tokensP, replicaP])
  const tokens = extractJson<Record<string, unknown>>(tokensText)
  const perPageReplicas = Object.fromEntries(replicaEntries.filter(([, v]) => v))
  return { ...tokens, perPageReplicas, stylePrompt: buildStylePrompt(tokens) }
}

/* ============================================================
   Style prompt assembler — pure code, deterministic, no vision creativity.
   Reads the structured tokens that the STYLE pass extracted and formats them
   as a brand-guideline markdown document.
   ============================================================ */

interface PaletteToken {
  hex: string
  role?: string
  pct?: number
}
interface FontToken {
  role?: string
  name?: string
  sample?: string
  weight?: string
  size?: string
}
interface ComponentToken {
  name: string
  count?: number
  tokens?: string
}
interface IATokenNode {
  lvl: number
  label: string
  meta?: string
}
interface MotionToken {
  type: string
  easing?: string
  dur?: string
}

/* ============================================================
   Video analysis — Phase 2 of the video pipeline.
   Hybrid: one batched STYLE call across all keyframes (palette / theme / motion
   narrative) + parallel quick MOTION calls per frame (one sentence each).
   ============================================================ */

const VIDEO_STYLE_SYSTEM = `You analyze KEYFRAMES from one video (typically a UI animation, product demo, motion design piece, or product reel) and extract its DESIGN SYSTEM, motion narrative, AND a single unified replica prompt for the whole composition.

A video is a SINGLE design observed through 8 camera positions — not 8 separate designs. There is one replica prompt for the whole thing; per-frame info covers only what's UNIQUE to each frame moment.

OUTPUT FORMAT — STRICT, two parts in this order:
  1) FIRST: stream 1-3 short sentences describing the video's overall design language AND what visually changes through the sequence. Stream as plain prose BEFORE any \`{\` or \`\`\` character. No "Here is:" preface.
  2) THEN: a fenced \`\`\`json block with all fields below.

Fields:
- title, theme, description — informed by the WHOLE sequence
- palette: 5-8 stable hex colors [{"hex":"#RRGGBB","role":"ink|paper|primary|accent|…","pct":<n>}]
- fonts, components, ia, layoutNote — design system, stable across frames
- mood, style, materials, tags  ·  assetType: "video"  ·  confidence: 0-100
- sequence: 1-2 sentences narrating beginning → end (e.g. "A dashboard zoom-in pans from KPI overview to per-system metrics, then settles on a frequency chart")
- transitions: 1-2 sentences on how scenes connect ("smooth camera pan", "hard cuts", "single continuous zoom")
- motionVerbs: 4-8 short verb-phrases ("pan-right", "zoom-in", "value-tick-up", "bar-grow")
- frameDescriptions: array of EXACTLY N short captions (1 sentence each), one per input frame in order, describing what's UNIQUE to that frame in the sequence
- replicaPrompt: ONE unified markdown body (≥ 400 words) that fully rebuilds the design seen across all frames. Use these bold section headers in order:
    **Full Composition** (the whole layout assembled from what every frame reveals — every panel, header, sidebar with widths) · **Visible Regions / Scenes** (one entry per region the camera visits, with verbatim copy + numbers found there) · **Color** (every hex as CSS var) · **Typography** (every face + weight + size visible across frames) · **Components** (every button / card / chart / metric with shape, tokens, states) · **Imagery / Iconography** · **Reproduction Notes** (radii, gaps, max-width, viewport aspect)
  Transcribe every legible number / label / axis value VERBATIM. If you write "several" / "various" / "etc" — stop and enumerate.

Reminder: the 1-3 sentence prose streams first. Then the single JSON object:
{"usable":true,"assetType":"video","confidence":80,"title":"","description":"","theme":"","palette":[],"fonts":[],"components":[],"ia":[],"layoutNote":"","motion":[],"dos":[],"donts":[],"responsive":"","a11y":[],"tags":[],"warnings":[],"sequence":"","motionVerbs":[],"transitions":"","mood":[],"style":[],"materials":[],"frameDescriptions":[],"replicaPrompt":""}`

const VIDEO_STYLE_USER =
  'These are keyframes from one video, in chronological order. Stream a short prose summary first, then output the complete JSON — including frameDescriptions (one entry per frame, in order) and one unified replicaPrompt covering the whole composition.'

interface AnalyzeVideoInput {
  req: RoleRequest
  frames: string[]
  durationSec?: number
  title?: string
}

/**
 * Single-call video analysis. A video is one design observed through N camera
 * positions, NOT N separate designs — so we ask the model for one unified
 * replica prompt plus per-frame motion captions in a single JSON output.
 *
 * Why one call (down from 17 in the old design):
 *   • Avoids burning free-tier daily quota (Gemini Flash 250 RPD) on per-frame
 *     bursts when 1 batched call gives equivalent insight.
 *   • Lets the model SEE all frames simultaneously when writing the unified
 *     replica — it produces a more coherent rebuild than 8 fragmented per-
 *     frame replicas would.
 */
export async function analyzeVideo(
  input: AnalyzeVideoInput,
  onChunk?: (chunk: string) => void
): Promise<Record<string, unknown>> {
  const frames = input.frames.filter(Boolean).slice(0, 12)
  if (!frames.length) {
    throw new Error('analyzeVideo: no frames provided')
  }

  const styleText = onChunk
    ? await callModelStream(input.req, VIDEO_STYLE_SYSTEM, VIDEO_STYLE_USER, frames, onChunk)
    : await callModel(input.req, VIDEO_STYLE_SYSTEM, VIDEO_STYLE_USER, false, frames)

  const tokens = extractJson<Record<string, unknown>>(styleText)
  // motionDescriptions is the renderer-facing alias for the JSON's
  // frameDescriptions — keeps the store/UI naming stable.
  const motionDescriptions = Array.isArray(tokens.frameDescriptions)
    ? (tokens.frameDescriptions as unknown[]).map((d) => (typeof d === 'string' ? d : '')).slice(0, frames.length)
    : []
  return {
    ...tokens,
    motionDescriptions,
    stylePrompt: buildStylePrompt(tokens)
  }
}

function as<T>(x: unknown): T[] {
  return Array.isArray(x) ? (x as T[]) : []
}
function asStr(x: unknown): string {
  return typeof x === 'string' ? x : ''
}

function buildStylePrompt(d: Record<string, unknown>): string {
  const palette = as<PaletteToken>(d.palette)
  const fonts = as<FontToken>(d.fonts)
  const components = as<ComponentToken>(d.components)
  const ia = as<IATokenNode>(d.ia)
  const motion = as<MotionToken>(d.motion)
  const dos = as<string>(d.dos)
  const donts = as<string>(d.donts)
  const mood = as<string>(d.mood)
  const style = as<string>(d.style)
  const materials = as<string>(d.materials)
  const theme = asStr(d.theme)
  const description = asStr(d.description)
  const layoutNote = asStr(d.layoutNote)
  const responsive = asStr(d.responsive)
  const composition = asStr(d.composition)

  const out: string[] = ['# Design System', '']
  if (description) out.push(description.trim(), '')
  if (theme) out.push('## Theme', theme.trim(), '')
  const vibes = [...mood, ...style, ...materials].filter(Boolean)
  if (vibes.length) out.push('## Mood · Style · Materials', vibes.join(' · '), '')

  if (palette.length) {
    out.push('## Palette')
    for (const p of palette) {
      if (!p?.hex) continue
      const role = (p.role || 'tone').replace(/\s+/g, '-')
      const pct = p.pct != null ? `  // ${p.pct}%` : ''
      out.push(`- \`--${role}: ${p.hex.toUpperCase()}\`${pct}`)
    }
    out.push('')
  }

  if (fonts.length) {
    out.push('## Typography')
    for (const f of fonts) {
      const role = f?.role ? `**${f.role}**: ` : ''
      const name = f?.name || 'unnamed face'
      const meta = [f?.weight, f?.size].filter(Boolean).join(' · ')
      out.push(`- ${role}${name}${meta ? ` — ${meta}` : ''}`)
      if (f?.sample) out.push(`  Sample: "${f.sample}"`)
    }
    out.push('')
  }

  if (components.length) {
    out.push('## Component Patterns')
    for (const c of components) {
      if (!c?.name) continue
      const count = c.count != null ? ` (×${c.count})` : ''
      out.push(`- **${c.name}**${count} — ${c.tokens || ''}`.trim())
    }
    out.push('')
  }

  if (layoutNote || ia.length) {
    out.push('## Layout')
    if (layoutNote) out.push(layoutNote, '')
    if (ia.length) {
      out.push('Information architecture:')
      for (const n of ia) {
        if (!n?.label) continue
        out.push(`${'  '.repeat(Math.max(0, n.lvl))}- ${n.label}${n.meta ? ` — ${n.meta}` : ''}`)
      }
      out.push('')
    }
  }

  if (composition) out.push('## Composition', composition.trim(), '')

  if (motion.length) {
    out.push('## Motion')
    for (const m of motion) {
      if (!m?.type) continue
      const parts = [m.type, m.easing, m.dur].filter(Boolean)
      out.push(`- ${parts.join(' · ')}`)
    }
    out.push('')
  }

  if (responsive) out.push('## Responsive', responsive.trim(), '')

  if (dos.length || donts.length) {
    out.push("## Do / Don't")
    for (const x of dos) if (x) out.push(`- ✓ DO  ${x}`)
    for (const x of donts) if (x) out.push(`- ✗ DON'T  ${x}`)
  }

  return out.join('\n').trim()
}
