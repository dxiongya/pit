// mcp.ts — Settings → MCP backend.
//
// Three jobs:
//   1. installMcp() — merge a `pit` entry into the user's Claude Desktop
//      `claude_desktop_config.json` (preserving other servers + backing up).
//   2. uninstallMcp() — remove that entry, keeping the file otherwise intact.
//   3. testMcp() — smoke-test the built MCP server over stdio so the user can
//      verify it works *before* restarting Claude Desktop.
//
// All filesystem writes are scoped to Claude's per-user config dir. We never
// touch anywhere else. A `.pit-bak` next to the config preserves the prior
// version so the user can roll back manually if they don't trust us.

import { spawn } from 'child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  copyFileSync
} from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'

/** Where Claude Desktop reads its MCP config from on each platform. */
export function claudeConfigPath(): string {
  if (process.platform === 'darwin') {
    return join(
      homedir(),
      'Library',
      'Application Support',
      'Claude',
      'claude_desktop_config.json'
    )
  }
  if (process.platform === 'win32') {
    const appData =
      process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
    return join(appData, 'Claude', 'claude_desktop_config.json')
  }
  // linux + others
  return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json')
}

interface McpConfig {
  mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>
  [k: string]: unknown
}

/** Robust JSON read — returns `null` if the file is missing OR malformed.
 *  Malformed config gets backed up by the caller before we overwrite. */
function readConfigSafe(path: string): McpConfig | null {
  if (!existsSync(path)) return null
  try {
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw) as McpConfig
  } catch {
    return null
  }
}

export interface McpInstallStatus {
  /** Is a `pit` entry currently registered in the Claude Desktop config? */
  installed: boolean
  /** Path that would be (or is) used as the command target. */
  registeredArg?: string
  /** Path to Claude Desktop config (existing or not). */
  configPath: string
  /** Does that file exist on disk? */
  configExists: boolean
  /** Other MCP server names already in the config (for the UI to show
   *  "won't disturb: foo, bar"). */
  otherServers: string[]
}

export function readMcpInstallStatus(): McpInstallStatus {
  const configPath = claudeConfigPath()
  const existing = readConfigSafe(configPath)
  if (!existing) {
    return {
      installed: false,
      configPath,
      configExists: existsSync(configPath),
      otherServers: []
    }
  }
  const servers = existing.mcpServers || {}
  const pit = servers.pit
  return {
    installed: !!pit,
    registeredArg: pit?.args?.[0],
    configPath,
    configExists: true,
    otherServers: Object.keys(servers).filter((n) => n !== 'pit')
  }
}

export interface McpInstallResult {
  ok: boolean
  configPath: string
  /** Where the previous config was saved before our write, if there was one. */
  backupPath?: string
  /** Server names left untouched in the config. */
  preserved: string[]
  error?: string
}

/**
 * Idempotently register the pit MCP server in Claude Desktop config.
 *
 * Behaviour:
 *   - File missing → create the directory + a fresh `{"mcpServers":{"pit":…}}`.
 *   - File exists + valid JSON → merge a `pit` entry, leave everything else.
 *   - File exists + malformed → back up to `<file>.pit-bak.<ts>`, then write
 *     a fresh config (don't risk silently mangling the user's other servers).
 *   - File exists + already has a `pit` entry pointing to the same path → no-op.
 *
 * Always returns a structured result; never throws.
 */
export function installMcp(serverArgPath: string): McpInstallResult {
  const configPath = claudeConfigPath()
  const dir = dirname(configPath)
  try {
    mkdirSync(dir, { recursive: true })
  } catch (e) {
    return {
      ok: false,
      configPath,
      preserved: [],
      error: `Could not create config directory: ${(e as Error).message}`
    }
  }

  const existing = readConfigSafe(configPath)
  let next: McpConfig
  let backupPath: string | undefined

  if (existsSync(configPath)) {
    // Always back up before any rewrite. Suffix with timestamp so multiple
    // toggles don't clobber the user's known-good copy.
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    backupPath = `${configPath}.pit-bak.${ts}`
    try {
      copyFileSync(configPath, backupPath)
    } catch {
      // Backup failure is non-fatal — proceed to write but tell the UI.
      backupPath = undefined
    }
  }

  if (existing) {
    next = { ...existing }
    if (!next.mcpServers || typeof next.mcpServers !== 'object') {
      next.mcpServers = {}
    }
    next.mcpServers = { ...next.mcpServers }
  } else {
    next = { mcpServers: {} }
  }

  next.mcpServers!.pit = {
    command: 'node',
    args: [serverArgPath]
  }

  try {
    writeFileSync(configPath, JSON.stringify(next, null, 2) + '\n', 'utf-8')
  } catch (e) {
    return {
      ok: false,
      configPath,
      preserved: [],
      error: `Could not write config: ${(e as Error).message}`
    }
  }

  return {
    ok: true,
    configPath,
    backupPath,
    preserved: Object.keys(next.mcpServers!).filter((n) => n !== 'pit')
  }
}

export interface McpUninstallResult {
  ok: boolean
  configPath: string
  /** True if a `pit` entry was actually found and removed. False = nothing
   *  to do, which we still treat as success. */
  removed: boolean
  error?: string
}

/** Remove only the `pit` entry. Other MCP servers stay put. */
export function uninstallMcp(): McpUninstallResult {
  const configPath = claudeConfigPath()
  if (!existsSync(configPath)) {
    return { ok: true, configPath, removed: false }
  }
  const existing = readConfigSafe(configPath)
  if (!existing || !existing.mcpServers || !existing.mcpServers.pit) {
    return { ok: true, configPath, removed: false }
  }
  // Back up before mutating.
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    copyFileSync(configPath, `${configPath}.pit-bak.${ts}`)
  } catch {
    // best-effort
  }
  const next = { ...existing, mcpServers: { ...existing.mcpServers } }
  delete next.mcpServers!.pit
  try {
    writeFileSync(configPath, JSON.stringify(next, null, 2) + '\n', 'utf-8')
  } catch (e) {
    return {
      ok: false,
      configPath,
      removed: false,
      error: (e as Error).message
    }
  }
  return { ok: true, configPath, removed: true }
}

// ── local smoke test ────────────────────────────────────────────────────

export interface McpTestResult {
  ok: boolean
  /** Sub-step diagnostics so the UI can render a pass/fail trail. */
  steps: { name: string; ok: boolean; detail?: string }[]
  /** Total round-trip time start → final response. */
  elapsedMs: number
  /** Brief one-line summary for the toast/inline message. */
  summary: string
}

/**
 * Spawn the built MCP server and run the actual JSON-RPC handshake an LLM
 * client would — initialize → tools/list → tools/call search_items.
 *
 * Why: the toggle and config rewrite happens in seconds, but the user has no
 * way to know whether the server actually starts and finds the database
 * without restarting Claude Desktop. This lets them verify in-app, before.
 */
export function testMcp(serverPath: string): Promise<McpTestResult> {
  return new Promise<McpTestResult>((resolve) => {
    const steps: McpTestResult['steps'] = []
    const finish = (ok: boolean, summary: string): void => {
      try {
        proc.kill()
      } catch {
        // already exited
      }
      resolve({ ok, steps, elapsedMs: Date.now() - t0, summary })
    }

    if (!existsSync(serverPath)) {
      resolve({
        ok: false,
        steps: [{ name: 'locate server', ok: false, detail: serverPath }],
        elapsedMs: 0,
        summary: 'Server not built — run npm install && npm run build first.'
      })
      return
    }
    try {
      const st = statSync(serverPath)
      if (!st.isFile()) {
        resolve({
          ok: false,
          steps: [{ name: 'locate server', ok: false, detail: 'not a file' }],
          elapsedMs: 0,
          summary: 'Server path is not a file.'
        })
        return
      }
    } catch {
      // covered by existsSync above; ignore
    }
    steps.push({ name: 'locate server', ok: true, detail: serverPath })

    const t0 = Date.now()
    const proc = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdoutBuf = ''
    let stderrBuf = ''
    const responses: Record<number, unknown> = {}
    proc.stdout.on('data', (d) => {
      stdoutBuf += d.toString()
      let nl: number
      while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
        const line = stdoutBuf.slice(0, nl)
        stdoutBuf = stdoutBuf.slice(nl + 1)
        if (!line.trim()) continue
        try {
          const j = JSON.parse(line) as { id?: number; result?: unknown; error?: unknown }
          if (typeof j.id === 'number') responses[j.id] = j
          // Once we have id=3 (the search hit), call it done.
          if (responses[1] && responses[2] && responses[3]) {
            evaluate()
          }
        } catch {
          // partial line; wait for more
        }
      }
    })
    proc.stderr.on('data', (d) => {
      stderrBuf += d.toString()
    })
    proc.on('error', (e) => {
      steps.push({ name: 'spawn node', ok: false, detail: e.message })
      finish(false, `node failed to start: ${e.message}`)
    })
    proc.on('exit', (code, signal) => {
      // Server exits cleanly when stdin closes; only treat as error if we
      // haven't already finished and the exit was abnormal.
      if (code !== 0 && code !== null && signal !== 'SIGTERM') {
        steps.push({
          name: 'server exit',
          ok: false,
          detail: `code=${code} stderr=${stderrBuf.slice(-200)}`
        })
        finish(false, `Server exited with code ${code}.`)
      }
    })

    const evaluate = (): void => {
      const init = responses[1] as { result?: { serverInfo?: { name?: string } } }
      const list = responses[2] as { result?: { tools?: { name: string }[] } }
      const search = responses[3] as { result?: { content?: { text?: string }[] } }

      if (!init?.result?.serverInfo?.name) {
        steps.push({ name: 'initialize', ok: false })
        finish(false, 'Server did not respond to initialize.')
        return
      }
      steps.push({
        name: 'initialize',
        ok: true,
        detail: init.result.serverInfo.name
      })

      const tools = list?.result?.tools?.map((t) => t.name) || []
      steps.push({
        name: 'tools/list',
        ok: tools.length >= 3,
        detail: tools.join(', ')
      })

      // Parse search_items JSON payload (text content)
      try {
        const txt = search?.result?.content?.[0]?.text || '{}'
        const parsed = JSON.parse(txt) as { total?: number; results?: { id: string }[] }
        const hits = parsed.results?.length || 0
        const total = parsed.total || 0
        steps.push({
          name: 'search_items("design")',
          ok: true,
          detail: `${hits}/${total} match${total === 1 ? '' : 'es'}`
        })
        finish(true, `OK · ${tools.length} tools, search returned ${hits}/${total}.`)
      } catch (e) {
        steps.push({
          name: 'search_items("design")',
          ok: false,
          detail: (e as Error).message
        })
        finish(false, 'search_items returned an unparseable payload.')
      }
    }

    // Fire the 3 JSON-RPC messages. They get answered in order because the
    // server processes one request before reading the next from stdin.
    const send = (id: number, method: string, params?: unknown): void => {
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    }
    send(1, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'pit-settings-test', version: '0' }
    })
    send(2, 'tools/list')
    send(3, 'tools/call', {
      name: 'search_items',
      arguments: { query: 'design', limit: 3 }
    })

    // Hard timeout in case the server is wedged (e.g. DB lock).
    setTimeout(() => {
      if (!responses[3]) {
        steps.push({
          name: 'timeout',
          ok: false,
          detail: stderrBuf.slice(-200) || 'no response in 5s'
        })
        finish(false, 'Timed out waiting for server response.')
      }
    }, 5000)
  })
}
