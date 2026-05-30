#!/usr/bin/env node
// pit-mcp-server — exposes the local pit knowledge base over MCP so Claude
// (or any MCP-aware client) can search the user's collected design references
// and return them with `pit://item/<id>` deep links that re-open pit at the
// matching detail card.
//
// Read-only by design: we open the SQLite DB in read-only mode and only ever
// SELECT. pit's main process owns writes; running both at once is safe
// because pit uses WAL mode.
//
// Transport: stdio. Spawned by the MCP client (Claude Desktop config),
// communicates over stdin/stdout JSON-RPC. No HTTP, no auth — local-only.

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import Database from 'better-sqlite3'
import { createServer as createHttpServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { homedir } from 'os'
import { join } from 'path'

// ─── DB location ─────────────────────────────────────────────────────────

/** Resolve pit's userData path the same way Electron does. Hard-coded by
 *  platform — running this without Electron means we can't call
 *  `app.getPath('userData')`. */
function defaultPitDbPath(): string {
  const platform = process.platform
  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'pit', 'pit.db')
  }
  if (platform === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
    return join(appData, 'pit', 'pit.db')
  }
  // linux / other unix
  const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(xdg, 'pit', 'pit.db')
}

const DB_PATH = process.env.PIT_DB_PATH || defaultPitDbPath()

let db: Database.Database
try {
  db = new Database(DB_PATH, { readonly: true, fileMustExist: true })
} catch (e) {
  // Stderr is allowed — stdio MCP only treats stdout as the JSON-RPC channel.
  process.stderr.write(
    `[pit-mcp] Could not open pit.db at ${DB_PATH}\n` +
      `[pit-mcp] ${(e as Error).message}\n` +
      `[pit-mcp] Set PIT_DB_PATH env var to override, or launch pit at least once first.\n`
  )
  process.exit(1)
}

// ─── data access ─────────────────────────────────────────────────────────

interface ItemRow {
  data: string
}
interface CollectionRow {
  data: string
}

interface Item {
  id: string
  kind: string
  collection?: string
  title?: string
  prompt?: string
  tags?: string[]
  url?: string
  palette?: string[]
  text?: string
  author?: string
  body?: string
  meta?: string
  foundry?: string
  classification?: string
  derivedFromLabel?: string
  design?: {
    title?: string
    theme?: string
    description?: string
    tags?: string[]
    stylePrompt?: string
    palette?: { hex?: string; role?: string }[]
    fonts?: { name?: string; role?: string }[]
    components?: { name?: string }[]
    ia?: { label?: string }[]
  }
  createdAt?: number
  status?: string
  screenshot?: string
}

interface Collection {
  id: string
  name: string
  desc?: string
  builtin?: boolean
}

function loadItems(): Item[] {
  const rows = db.prepare('SELECT data FROM items').all() as ItemRow[]
  return rows.map((r) => JSON.parse(r.data) as Item)
}

function loadCollections(): Collection[] {
  const rows = db.prepare('SELECT data FROM collections').all() as CollectionRow[]
  return rows.map((r) => JSON.parse(r.data) as Collection)
}

function loadItem(id: string): Item | null {
  const row = db.prepare('SELECT data FROM items WHERE id = ?').get(id) as ItemRow | undefined
  if (!row) return null
  return JSON.parse(row.data) as Item
}

// ─── search ─────────────────────────────────────────────────────────────

interface WeightedField {
  text: string
  weight: number
  source: string
}

function fieldsForItem(it: Item): WeightedField[] {
  const f: WeightedField[] = []
  const push = (text: string | undefined | null, weight: number, source: string): void => {
    if (text && typeof text === 'string') f.push({ text, weight, source })
  }
  push(it.title, 10, 'title')
  push(it.url, 8, 'url')
  push((it.tags || []).join(' '), 7, 'tag')
  push(it.derivedFromLabel, 6, 'derive')
  push(it.prompt, 4, 'prompt')
  push(it.text, 4, 'text')
  push(it.author, 3, 'author')
  push(it.foundry, 3, 'foundry')
  push(it.classification, 3, 'class')
  push(it.body, 2, 'body')
  push(it.meta, 2, 'meta')
  if (it.palette?.length) push(it.palette.join(' '), 5, 'palette')
  const d = it.design
  if (d) {
    push(d.title, 8, 'title')
    push(d.theme, 6, 'theme')
    push(d.description, 4, 'description')
    push((d.tags || []).join(' '), 7, 'tag')
    if (d.palette) {
      push(
        d.palette.map((p) => `${p.hex || ''} ${p.role || ''}`).join(' '),
        5,
        'palette'
      )
    }
    if (d.fonts) push(d.fonts.map((x) => `${x.name || ''} ${x.role || ''}`).join(' '), 5, 'font')
    if (d.components) push(d.components.map((x) => x.name || '').join(' '), 5, 'component')
    if (d.ia) push(d.ia.map((x) => x.label || '').join(' '), 4, 'ia')
  }
  return f
}

function scoreItem(it: Item, tokens: string[]): { score: number; matchedField?: string; snippet?: string } {
  const fields = fieldsForItem(it)
  let total = 0
  let bestField: WeightedField | undefined
  for (const tok of tokens) {
    let best = 0
    let bestForToken: WeightedField | undefined
    for (const f of fields) {
      if (!f.text) continue
      if (f.text.toLowerCase().includes(tok)) {
        if (f.weight > best) {
          best = f.weight
          bestForToken = f
        }
      }
    }
    if (best === 0) return { score: 0 }
    total += best
    if (!bestField || (bestForToken && bestForToken.weight > bestField.weight)) {
      bestField = bestForToken
    }
  }
  let snippet: string | undefined
  if (bestField) {
    const idx = bestField.text.toLowerCase().indexOf(tokens[0])
    if (idx >= 0) {
      const start = Math.max(0, idx - 24)
      const end = Math.min(bestField.text.length, idx + tokens[0].length + 60)
      snippet =
        (start > 0 ? '…' : '') +
        bestField.text.slice(start, end) +
        (end < bestField.text.length ? '…' : '')
    }
  }
  return { score: total, matchedField: bestField?.source, snippet }
}

// ─── response shaping ────────────────────────────────────────────────────

/** Minimal hit shape returned by search_items — enough for the LLM to
 *  describe + cite, plus the deep link the user clicks. We don't return
 *  giant base64 screenshots; tools that need pixel-level info call get_item. */
function compactItem(
  it: Item,
  collections: Map<string, Collection>,
  extra?: { matchedField?: string; snippet?: string }
): Record<string, unknown> {
  const coll = it.collection ? collections.get(it.collection) : undefined
  return {
    id: it.id,
    title: it.title || it.url || 'Untitled',
    kind: it.kind,
    collection: coll ? { id: coll.id, name: coll.name } : undefined,
    url: it.url,
    tags: it.tags || it.design?.tags,
    palette:
      it.palette?.slice(0, 6) ||
      it.design?.palette?.slice(0, 6).map((p) => p.hex).filter(Boolean),
    theme: it.design?.theme,
    summary: it.design?.description?.slice(0, 280),
    matched: extra?.matchedField,
    snippet: extra?.snippet,
    openUrl: `pit://item/${it.id}`,
    createdAt: it.createdAt
  }
}

/** Full item — strips the heavy screenshot blob (a tool result of 4–6 MB
 *  base64 explodes Claude's context). The renderer already has the pixels
 *  locally once the user clicks openUrl. */
function fullItem(it: Item, collections: Map<string, Collection>): Record<string, unknown> {
  const coll = it.collection ? collections.get(it.collection) : undefined
  // Drop the (large) screenshot data URL from the MCP payload.
  const rest: Record<string, unknown> = { ...it }
  delete rest.screenshot
  return {
    ...rest,
    collection: coll ? { id: coll.id, name: coll.name } : undefined,
    hasScreenshot: !!it.screenshot,
    openUrl: `pit://item/${it.id}`
  }
}

// ─── MCP wiring ──────────────────────────────────────────────────────────

function makeServer(): Server {
const server = new Server(
  { name: 'pit-mcp-server', version: '0.1.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_items',
      description:
        'Search the user\'s collected design references in pit. Returns up to `limit` matches with title, kind, palette, theme, a short snippet, and an openUrl deep-link (pit://item/<id>) the user can click to open the item modal directly in pit. Search is fuzzy across title, tags, palette (hex or role name), theme, description, font names, components, prompt, url, and free text. All query tokens must match somewhere. Use this whenever the user asks "show me X" / "find a design with Y" / "have we seen anything like Z?".',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Free-text query. Tokens are AND-combined and substring-matched (case-insensitive). Example: "dark dashboard orange" — finds items whose fields mention all three. Hex colors like "#0a84ff" also match.'
          },
          limit: {
            type: 'number',
            description: 'Max number of hits to return. Defaults to 10, max 30.'
          },
          collection: {
            type: 'string',
            description:
              'Optional: restrict to one collection id (use list_collections to discover ids).'
          },
          kind: {
            type: 'string',
            description:
              'Optional: restrict to one item kind (image, link, video, palette, font, note).'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'list_collections',
      description:
        'Enumerate the user\'s pit collections. Returns id, name, optional description, builtin flag, and item count. Use this before search_items when the user names a specific area ("the dashboards collection"), or to surface what topics are available.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'get_item',
      description:
        'Fetch the full record for one item by id. Returns everything pit knows about it (design tokens, palette, prompts, fonts, components, IA, motion, tags, …) minus the raw screenshot bytes — plus the openUrl deep-link the user clicks to open the modal in pit. Use this after search_items when the LLM needs to describe an item in depth or cite specific tokens.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Item id from search_items results.' }
        },
        required: ['id']
      }
    }
  ]
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params

  if (name === 'search_items') {
    const query = String((args as Record<string, unknown>).query || '').trim()
    if (!query) {
      return {
        content: [
          { type: 'text', text: JSON.stringify({ error: 'empty_query' }) }
        ],
        isError: true
      }
    }
    const limit = Math.min(30, Math.max(1, Number((args as Record<string, unknown>).limit) || 10))
    const collFilter = (args as Record<string, unknown>).collection as string | undefined
    const kindFilter = (args as Record<string, unknown>).kind as string | undefined
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)

    const items = loadItems()
    const collections = new Map(loadCollections().map((c) => [c.id, c]))

    const hits: { it: Item; score: number; matchedField?: string; snippet?: string }[] = []
    for (const it of items) {
      if (collFilter && it.collection !== collFilter) continue
      if (kindFilter && it.kind !== kindFilter) continue
      const s = scoreItem(it, tokens)
      if (s.score > 0) hits.push({ it, score: s.score, matchedField: s.matchedField, snippet: s.snippet })
    }
    hits.sort((a, b) => b.score - a.score)
    const out = {
      query,
      total: hits.length,
      results: hits.slice(0, limit).map((h) =>
        compactItem(h.it, collections, { matchedField: h.matchedField, snippet: h.snippet })
      )
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(out, null, 2) }]
    }
  }

  if (name === 'list_collections') {
    const items = loadItems()
    const counts = new Map<string, number>()
    for (const it of items) {
      const k = it.collection || ''
      counts.set(k, (counts.get(k) || 0) + 1)
    }
    const collections = loadCollections().map((c) => ({
      id: c.id,
      name: c.name,
      desc: c.desc,
      builtin: !!c.builtin,
      itemCount: counts.get(c.id) || 0
    }))
    return {
      content: [{ type: 'text', text: JSON.stringify({ collections }, null, 2) }]
    }
  }

  if (name === 'get_item') {
    const id = String((args as Record<string, unknown>).id || '').trim()
    if (!id) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'missing_id' }) }],
        isError: true
      }
    }
    const it = loadItem(id)
    if (!it) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'not_found', id }) }],
        isError: true
      }
    }
    const collections = new Map(loadCollections().map((c) => [c.id, c]))
    return {
      content: [{ type: 'text', text: JSON.stringify(fullItem(it, collections), null, 2) }]
    }
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ error: 'unknown_tool', name }) }],
    isError: true
  }
})

  return server
}

// ─── transport selection ─────────────────────────────────────────────────
// Default: stdio (spawned per-client by Claude Desktop config — back-compat).
// PIT_MCP_HTTP=1: a long-lived local Streamable-HTTP service that any MCP
// client connects to via http://pit.localhost:<port>/mcp. Stateless — a fresh
// Server+transport per request (tools are read-only) — and bound to loopback
// only, so it's never reachable off this machine.
const HTTP = process.env.PIT_MCP_HTTP === '1'
const PORT = Number(process.env.PIT_MCP_PORT) || 7727

if (!HTTP) {
  const transport = new StdioServerTransport()
  await makeServer().connect(transport)
  process.stdin.on('close', () => process.exit(0))
} else {
  const cors: Record<string, string> = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, GET, OPTIONS, DELETE',
    'access-control-allow-headers': 'content-type, mcp-session-id, mcp-protocol-version',
    'access-control-expose-headers': 'mcp-session-id'
  }
  // Stateful: one persistent Server+transport per MCP session (keyed by the
  // Mcp-Session-Id the SDK mints on `initialize`). The SDK enforces initialize
  // before other requests on a connection, so the session must outlive the
  // single HTTP request — hence the map.
  const transports: Record<string, StreamableHTTPServerTransport> = {}
  const allowedHosts = [
    `pit.localhost:${PORT}`,
    `localhost:${PORT}`,
    `127.0.0.1:${PORT}`,
    'pit.localhost',
    'localhost',
    '127.0.0.1'
  ]
  const httpServer = createHttpServer(async (req, res) => {
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    const path = (req.url || '').split('?')[0]
    if (path !== '/mcp') {
      res.writeHead(404)
      res.end('not found')
      return
    }
    const sid = req.headers['mcp-session-id'] as string | undefined
    try {
      if (req.method === 'POST') {
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined
        let transport = sid ? transports[sid] : undefined
        if (!transport) {
          const isInit =
            body && !Array.isArray(body) && (body as { method?: string }).method === 'initialize'
          if (!isInit) {
            res.writeHead(400, { 'content-type': 'application/json' })
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'No session — send an initialize request first.' },
                id: null
              })
            )
            return
          }
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            enableJsonResponse: true,
            enableDnsRebindingProtection: true,
            allowedHosts,
            onsessioninitialized: (id) => {
              if (transport) transports[id] = transport
            }
          })
          transport.onclose = (): void => {
            if (transport?.sessionId) delete transports[transport.sessionId]
          }
          await makeServer().connect(transport)
        }
        await transport.handleRequest(req, res, body)
      } else if (req.method === 'GET' || req.method === 'DELETE') {
        const transport = sid ? transports[sid] : undefined
        if (!transport) {
          res.writeHead(400)
          res.end('unknown or missing session')
          return
        }
        await transport.handleRequest(req, res)
      } else {
        res.writeHead(405, { allow: 'POST, GET, DELETE, OPTIONS' })
        res.end()
      }
    } catch (e) {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: (e as Error).message },
          id: null
        })
      )
    }
  })
  // Loopback bind — the pit.localhost host resolves here, but the socket is
  // never exposed off-machine.
  httpServer.listen(PORT, '127.0.0.1', () => {
    process.stderr.write(
      `[pit-mcp] Streamable HTTP service on http://pit.localhost:${PORT}/mcp (loopback only)\n`
    )
  })
}
