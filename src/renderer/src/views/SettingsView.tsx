// SettingsView.tsx — feature 5: AI configuration.
// Create providers (from a vendor preset or custom), each with credentials and a
// model list where vision is marked per-model. Then bind each function
// (design / routing) to a provider + model. Plus feature toggles + appearance.

import { useEffect, useState } from 'react'
import type { AIRole, AISettings, Provider, ProviderKind } from '../lib/types'
import { I } from '../lib/icons'
import {
  KIND_META,
  PROVIDER_KINDS,
  ROLE_META,
  defaultModel,
  findProvider,
  getModelModality,
  isProviderConfigured,
  modalityForNewModel,
  newProviderId,
  providerRequest,
  supportsInput,
  testProvider
} from '../lib/ai/provider'
import { lookupModel } from '../lib/catalog/lookup'
import type { Modality } from '../lib/catalog/types'
import { BRANDS, ProviderMark, brandForProvider, providerFromBrand } from '../lib/ai/brands'
import { useStore } from '../lib/store'
import { useToast, copyToClipboard } from '../components/Toast'
import { Button, Field, IconButton, Input, Select, Slider, Switch } from '../components/ui'

const ROLE_IDS = Object.keys(ROLE_META) as AIRole[]
type ConnState = { state: 'idle' | 'testing' | 'ok' | 'bad'; msg: string }

export function SettingsView(): React.JSX.Element {
  const { settings, updateSettings, setSetting } = useStore()
  const toast = useToast()
  const ai = settings.ai

  const [editing, setEditing] = useState<Provider | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [conn, setConn] = useState<Record<string, ConnState>>({})

  const patchAI = (patch: Partial<AISettings>): void => updateSettings({ ai: { ...ai, ...patch } })

  const startAdd = (): void => {
    setEditing({
      id: newProviderId(),
      kind: 'openai-compatible',
      name: '',
      apiKey: '',
      baseURL: '',
      models: []
    })
    setIsNew(true)
  }
  const startEdit = (p: Provider): void => {
    setEditing({ ...p, models: p.models.map((m) => ({ ...m })) })
    setIsNew(false)
  }
  const cancelEdit = (): void => {
    setEditing(null)
    setIsNew(false)
  }
  const saveEdit = (): void => {
    if (!editing) return
    const list = isNew
      ? [...ai.providers, editing]
      : ai.providers.map((p) => (p.id === editing.id ? editing : p))
    patchAI({ providers: list })
    setEditing(null)
    setIsNew(false)
    toast.push(isNew ? 'Provider added' : 'Provider updated')
  }
  const removeProvider = (id: string): void => {
    const list = ai.providers.filter((p) => p.id !== id)
    const roles = { ...ai.roles }
    for (const r of ROLE_IDS) {
      if (roles[r].providerId === id) {
        const first = list[0]
        roles[r] = first
          ? { providerId: first.id, model: defaultModel(first) }
          : { providerId: '', model: '' }
      }
    }
    patchAI({ providers: list, roles })
  }

  const testProviderModel = async (p: Provider, model: string): Promise<void> => {
    const key = `${p.id}:${model || 'def'}`
    setConn((c) => ({ ...c, [key]: { state: 'testing', msg: 'Testing…' } }))
    const r = await testProvider(providerRequest(p, model || defaultModel(p)))
    setConn((c) => ({ ...c, [key]: { state: r.ok ? 'ok' : 'bad', msg: r.message } }))
    toast.push(r.ok ? `${p.name || KIND_META[p.kind].short} OK` : `${p.name || 'Provider'} failed`)
  }

  return (
    <div className="canvas">
      <div className="hero" style={{ padding: '8px 4px 18px' }}>
        <div>
          <h1>Settings</h1>
          <div className="sub">
            <span>Create providers, then assign them to design analysis and routing.</span>
          </div>
        </div>
      </div>

      <div className="settings-wrap">
        {/* Providers */}
        <div className="settings-card">
          {editing ? (
            <ProviderForm
              draft={editing}
              isNew={isNew}
              conn={conn}
              onChange={setEditing}
              onCancel={cancelEdit}
              onSave={saveEdit}
              onTestModel={testProviderModel}
            />
          ) : (
            <>
              <div className="providers-head">
                <h3>AI Providers</h3>
                <button className="add-link" onClick={startAdd}>
                  <I.Plus size={13} /> Add
                </button>
              </div>
              <div className="pb-sub">
                Your credential store. Keys are stored locally on this machine.
              </div>

              {ai.providers.length === 0 && (
                <div className="empty-note">No providers yet — click “Add”.</div>
              )}

              {ai.providers.map((p) => {
                const meta = KIND_META[p.kind]
                const c = conn[`${p.id}:def`]
                const extra = p.models.length - 1
                return (
                  <div key={p.id} className="provider-card">
                    <ProviderMark brand={brandForProvider(p)} kind={p.kind} name={p.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="prov-title">
                        <span className="prov-name">{p.name || meta.short}</span>
                        <span className="kind-badge">{meta.short}</span>
                      </div>
                      <div className="prov-sub mono">
                        {defaultModel(p) || 'no model'}
                        {extra > 0 && ` · +${extra} more`}
                        {!isProviderConfigured(p) && ' · no key'}
                      </div>
                    </div>
                    {c && (
                      <span className={`conn-status ${c.state === 'testing' ? 'idle' : c.state}`}>
                        <span className="dot" />
                        {c.msg}
                      </span>
                    )}
                    <IconButton
                      title="Test default model"
                      onClick={() => testProviderModel(p, defaultModel(p))}
                    >
                      <I.Bolt size={14} />
                    </IconButton>
                    <IconButton title="Edit" onClick={() => startEdit(p)}>
                      <I.Edit size={14} />
                    </IconButton>
                    <IconButton danger title="Delete" onClick={() => removeProvider(p.id)}>
                      <I.Trash size={14} />
                    </IconButton>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Feature routing */}
        <div className="settings-card">
          <h3>Feature routing</h3>
          <div className="pb-sub">
            Bind each function to a provider + model. They can use different providers.
          </div>
          {ROLE_IDS.map((role) => {
            const rmeta = ROLE_META[role]
            const binding = ai.roles[role]
            const bound = findProvider(ai, binding.providerId)
            const needsInput = rmeta.needsInput
            const modalityWarn =
              needsInput && bound && !supportsInput(bound, binding.model, needsInput)
            const options = ai.providers.flatMap((p) =>
              p.models.map((m) => ({
                value: `${p.id}::${m.id}`,
                label: `${p.name || KIND_META[p.kind].short} · ${m.id}`
              }))
            )
            const cur = `${binding.providerId}::${binding.model}`
            const items = options.find((o) => o.value === cur)
              ? options
              : [{ value: cur, label: 'Unassigned' }, ...options]
            return (
              <div key={role} className="role-row">
                <div className="role-info">
                  <div className="tr-name">{rmeta.name}</div>
                  <div className="tr-desc">{rmeta.desc}</div>
                  {modalityWarn && (
                    <div className="role-warn">
                      ⚠ <strong>{binding.model}</strong> doesn’t accept{' '}
                      <strong>{needsInput}</strong> input — this role won’t work with it.
                      <div style={{ marginTop: 4, opacity: 0.85 }}>
                        {lookupModel(binding.model)
                          ? `The model catalog says it only takes ${getModelModality(bound!, binding.model).input.join(' / ')}. Pick a model in the dropdown that supports ${needsInput} input.`
                          : `If this custom model actually supports ${needsInput} input, open ${bound?.name || 'the provider'} below and enable the ${needsInput} badge on it in the Models list.`}
                      </div>
                    </div>
                  )}
                </div>
                <div className="role-selects">
                  {options.length === 0 ? (
                    <span className="muted" style={{ fontSize: 12 }}>
                      Add a provider with a model first.
                    </span>
                  ) : (
                    <Select
                      value={cur}
                      items={items}
                      onValueChange={(v) => {
                        const [providerId, ...rest] = v.split('::')
                        patchAI({
                          roles: { ...ai.roles, [role]: { providerId, model: rest.join('::') } }
                        })
                      }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* feature toggles */}
        <div className="settings-card">
          <h3>Capture &amp; routing</h3>
          <div className="pb-sub">What the AI does automatically when you add material.</div>
          <div className="feature-toggles">
            <ToggleRow
              name="Capture page screenshots"
              desc="Render and screenshot each discovered page when importing a link."
              on={ai.features.captureScreenshots}
              onToggle={() =>
                patchAI({
                  features: { ...ai.features, captureScreenshots: !ai.features.captureScreenshots }
                })
              }
            />
            <ToggleRow
              name="Extract DESIGN.md"
              desc="Analyze theme, palette, type, components, layout, motion, and a11y."
              on={ai.features.extractDesignDoc}
              onToggle={() =>
                patchAI({
                  features: { ...ai.features, extractDesignDoc: !ai.features.extractDesignDoc }
                })
              }
            />
            <ToggleRow
              name="Auto-route to collections"
              desc="Drop new items into the best-matching collection automatically."
              on={ai.features.autoRoute}
              onToggle={() =>
                patchAI({ features: { ...ai.features, autoRoute: !ai.features.autoRoute } })
              }
            />
          </div>
          <Field
            label={`Auto-route threshold · ${ai.features.routeThreshold}%`}
            hint="Items below this confidence land in Inbox for manual review."
          >
            <Slider
              min={50}
              max={100}
              step={5}
              value={ai.features.routeThreshold}
              onValueChange={(v) => patchAI({ features: { ...ai.features, routeThreshold: v } })}
            />
          </Field>
        </div>

        {/* sharing */}
        <div className="settings-card">
          <h3>Sharing</h3>
          <div className="pb-sub">
            By default, pit publishes shares through the free{' '}
            <a className="ui-link" href="https://pit.ink" target="_blank" rel="noreferrer">
              pit.ink
            </a>{' '}
            service: <strong>50 MB max per share, links expire after 1 hour</strong>. For
            longer-lived shares or larger uploads, deploy your own Cloudflare Worker (D1 + R2)
            and paste its URL below. One click, free tier covers normal use.
          </div>

          <Field
            label="Worker URL"
            hint={
              <>
                Looks like <code>https://pit-share.YOUR-NAME.workers.dev</code> after deploy.
                Leave empty to use the free service.{' '}
                <a
                  className="ui-link"
                  href="https://deploy.workers.cloudflare.com/?url=https://github.com/dxiongya/pit-share-worker"
                  target="_blank"
                  rel="noreferrer"
                >
                  Deploy your own →
                </a>
              </>
            }
          >
            <Input
              type="text"
              mono
              placeholder="https://pit-share.your-name.workers.dev"
              value={settings.share?.workerUrl ?? ''}
              onChange={(e) =>
                updateSettings({
                  share: { ...settings.share, workerUrl: e.target.value }
                })
              }
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          <Field
            label="Worker secret"
            hint={
              <>
                Optional — only needed if your Worker enforces{' '}
                <code>SHARE_AUTH_SECRET</code>. Sent as <code>Authorization: Bearer ...</code>.
              </>
            }
          >
            <Input
              type="password"
              mono
              placeholder="(only if your Worker requires auth)"
              value={settings.share?.workerSecret ?? ''}
              onChange={(e) =>
                updateSettings({
                  share: { ...settings.share, workerSecret: e.target.value }
                })
              }
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          <ShareStatusRow url={settings.share?.workerUrl} secret={settings.share?.workerSecret} />
        </div>

        {/* MCP */}
        <div className="settings-card">
          <h3>MCP server</h3>
          <div className="pb-sub">
            Expose your pit knowledge base to Claude (or any{' '}
            <a
              className="ui-link"
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noreferrer"
            >
              MCP-aware
            </a>{' '}
            client) as tools. Search your design references in chat, get back
            <code> pit://item/&lt;id&gt;</code> links that re-open the modal here. Read-only;
            no network.
          </div>
          <McpSetupRow />
        </div>

        {/* integrations */}
        <div className="settings-card">
          <h3>Integrations</h3>
          <div className="pb-sub">
            API keys for source-specific link handlers (Twitter / X, …). Each handler refuses
            to run unless its slice is configured.
          </div>

          <Field
            label="xAPI key"
            hint={
              <>
                Used for Twitter / X link import. Get a key at{' '}
                <a className="ui-link" href="https://xapi.to" target="_blank" rel="noreferrer">
                  xapi.to
                </a>
                . Stored locally only.
              </>
            }
          >
            <Input
              type="password"
              mono
              placeholder="sk-…"
              value={settings.integrations?.xapi?.apiKey ?? ''}
              onChange={(e) =>
                updateSettings({
                  integrations: {
                    ...settings.integrations,
                    xapi: { apiKey: e.target.value }
                  }
                })
              }
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>

        {/* appearance */}
        <div className="settings-card">
          <h3>Appearance</h3>
          <div className="pb-sub">Theme, accent, and layout density.</div>

          <Field label="Theme">
            <Select<'light' | 'dark'>
              value={settings.theme}
              items={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' }
              ]}
              onValueChange={(v) => setSetting('theme', v)}
            />
          </Field>

          <Field label="Accent">
            <div style={{ display: 'flex', gap: 6 }}>
              {['#e8624a', '#0a84ff', '#ff9f0a', '#34c759', '#bf5af2', '#5e5ce6'].map((c) => (
                <button
                  key={c}
                  onClick={() => setSetting('accent', c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: c,
                    border:
                      c === settings.accent ? '2px solid var(--ink)' : '1px solid var(--hair)',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          </Field>

          <Field label="Corner radius">
            <Select<'sharp' | 'round' | 'full'>
              value={settings.radius}
              items={[
                { value: 'sharp', label: 'Sharp' },
                { value: 'round', label: 'Round' },
                { value: 'full', label: 'Soft' }
              ]}
              onValueChange={(v) => setSetting('radius', v)}
            />
          </Field>

          <Field label="Density">
            <Select<'compact' | 'comfortable' | 'spacious'>
              value={settings.density}
              items={[
                { value: 'compact', label: 'Compact' },
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'spacious', label: 'Airy' }
              ]}
              onValueChange={(v) => setSetting('density', v)}
            />
          </Field>

          <Field label={`Columns · ${settings.cols}`}>
            <Slider
              min={3}
              max={6}
              step={1}
              value={settings.cols}
              onValueChange={(v) => setSetting('cols', v)}
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Sharing — self-hosted Worker status row
   ============================================================ */
type ShareStatus =
  | { kind: 'idle' }
  | { kind: 'free' }
  | { kind: 'testing' }
  | { kind: 'ok'; latencyMs: number }
  | { kind: 'bad'; message: string }

function ShareStatusRow({
  url,
  secret
}: {
  url?: string
  secret?: string
}): React.JSX.Element {
  const trimmed = url?.trim()
  const [status, setStatus] = useState<ShareStatus>({ kind: trimmed ? 'idle' : 'free' })
  useEffect(() => {
    setStatus({ kind: trimmed ? 'idle' : 'free' })
  }, [trimmed])

  const test = async (): Promise<void> => {
    if (!trimmed) return
    setStatus({ kind: 'testing' })
    const base = trimmed.replace(/\/+$/, '').replace(/\/api$/, '')
    const t0 = Date.now()
    try {
      const r = await fetch(`${base}/api/health`, {
        headers: secret?.trim() ? { authorization: `Bearer ${secret.trim()}` } : {}
      })
      if (!r.ok) {
        setStatus({ kind: 'bad', message: `HTTP ${r.status}` })
        return
      }
      const j = (await r.json().catch(() => null)) as { ok?: boolean } | null
      if (!j?.ok) {
        setStatus({ kind: 'bad', message: 'Unexpected response — is this a pit-share Worker?' })
        return
      }
      setStatus({ kind: 'ok', latencyMs: Date.now() - t0 })
    } catch (e) {
      setStatus({ kind: 'bad', message: (e as Error).message })
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 12,
        padding: '10px 12px',
        borderRadius: 8,
        background: 'var(--bg-soft)',
        border: '1px solid var(--hair)'
      }}
    >
      <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)' }}>
        {status.kind === 'free' && (
          <>
            <strong style={{ color: 'var(--ink-2)' }}>Using free pit.ink</strong> · 50 MB ·
            expires after 1 hour
          </>
        )}
        {status.kind === 'idle' && (
          <>
            <strong style={{ color: 'var(--ink-2)' }}>Worker set</strong> · click Test to
            verify
          </>
        )}
        {status.kind === 'testing' && 'Pinging /api/health…'}
        {status.kind === 'ok' && (
          <>
            <strong style={{ color: '#34c759' }}>✓ Connected</strong> · {status.latencyMs}ms ·
            no limits applied
          </>
        )}
        {status.kind === 'bad' && (
          <>
            <strong style={{ color: '#ff453a' }}>✗ Failed</strong> · {status.message}
          </>
        )}
      </span>
      {trimmed && (
        <Button size="sm" onClick={test} disabled={status.kind === 'testing'}>
          {status.kind === 'testing' ? 'Testing…' : 'Test'}
        </Button>
      )}
    </div>
  )
}

/* ============================================================
   MCP — toggle, tutorial, in-app smoke test
   ============================================================ */
type McpInfo = Awaited<ReturnType<typeof window.pit.mcp.getInfo>>
type McpTest = Awaited<ReturnType<typeof window.pit.mcp.test>>

function McpSetupRow(): React.JSX.Element {
  const toast = useToast()
  const [info, setInfo] = useState<McpInfo | null>(null)
  const [busy, setBusy] = useState<'install' | 'uninstall' | 'test' | null>(null)
  const [test, setTest] = useState<McpTest | null>(null)
  // Path the toggle would register: the built server.js, even if the build
  // hasn't happened yet (so the snippet we show is the one that *will* work
  // after the user runs npm run build).
  const argPath = (() => {
    if (!info) return ''
    if (info.serverBuilt) return info.serverPath
    return `${info.serverPath.replace(/\/$/, '')}/dist/server.js`
  })()

  // The MCP-client config snippet — paste into Claude Desktop / Cursor / Claude
  // Code / any MCP client to use pit directly (the in-app toggle only writes
  // Claude Desktop's config for you).
  const mcpConfig = JSON.stringify(
    { mcpServers: { pit: { command: 'node', args: [argPath] } } },
    null,
    2
  )

  const reload = async (): Promise<void> => {
    try {
      setInfo(await window.pit.mcp.getInfo())
    } catch {
      // ignore
    }
  }
  useEffect(() => {
    void reload()
  }, [])

  if (!info) return <div className="muted" style={{ fontSize: 12 }}>Loading…</div>

  const sizeKb = (info.dbSizeBytes / 1024).toFixed(1)

  const enable = async (): Promise<void> => {
    if (!info.serverBuilt) {
      toast.push('Build the MCP server first (see step 1 below).')
      return
    }
    setBusy('install')
    try {
      const r = await window.pit.mcp.install(argPath)
      if (r.ok) {
        toast.push(
          r.preserved.length
            ? `Enabled — merged alongside ${r.preserved.length} other server(s).`
            : 'MCP enabled in Claude Desktop config.'
        )
        await reload()
      } else {
        toast.push(`Could not write config: ${r.error || 'unknown error'}`)
      }
    } finally {
      setBusy(null)
    }
  }
  const disable = async (): Promise<void> => {
    setBusy('uninstall')
    try {
      const r = await window.pit.mcp.uninstall()
      if (r.ok) {
        toast.push(
          r.removed ? 'MCP disabled — pit entry removed.' : 'Already disabled.'
        )
        await reload()
      } else {
        toast.push(`Could not update config: ${r.error || 'unknown error'}`)
      }
    } finally {
      setBusy(null)
    }
  }
  const runTest = async (): Promise<void> => {
    setBusy('test')
    setTest(null)
    try {
      const r = await window.pit.mcp.test(argPath)
      setTest(r)
      toast.push(r.summary)
    } finally {
      setBusy(null)
    }
  }
  const copyBuildCmd = async (): Promise<void> => {
    const dir = info.serverPath.replace(/\/dist\/server\.js$/, '')
    await copyToClipboard(`cd "${dir}" && npm install && npm run build`)
    toast.push('Build command copied')
  }

  const copyMcpConfig = async (): Promise<void> => {
    await copyToClipboard(mcpConfig)
    toast.push('MCP config copied')
  }

  // — Step state for the tutorial. Each step toggles to "done" as the
  //   underlying state becomes true; user can therefore see at a glance
  //   how far they are.
  const steps: { num: number; done: boolean; title: string; body: React.ReactNode }[] = [
    {
      num: 1,
      done: info.serverBuilt,
      title: 'Build the MCP server',
      body: info.serverBuilt ? (
        <span className="muted">Built. {sizeKb} KB DB ready at the path below.</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>
            Run once in a terminal — needs Node + npm on PATH. Takes ~10s.
          </span>
          <code
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: 'var(--bg-card)',
              border: '1px solid var(--hair)',
              fontSize: 11,
              fontFamily: 'var(--f-mono)',
              display: 'block',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}
          >
            cd &quot;{info.serverPath}&quot; &amp;&amp; npm install &amp;&amp; npm run build
          </code>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={copyBuildCmd}>
              <I.Copy size={11} /> Copy command
            </Button>
            <Button size="sm" onClick={reload}>
              I&apos;ve built it
            </Button>
          </div>
        </div>
      )
    },
    {
      num: 2,
      done: info.installed,
      title: 'Toggle MCP on',
      body: info.installed ? (
        <span className="muted">
          Registered in Claude Desktop config
          {info.otherServers.length > 0 && (
            <> (alongside: {info.otherServers.join(', ')})</>
          )}
          .
        </span>
      ) : info.serverBuilt ? (
        <span className="muted">
          Flip the switch up top — pit writes itself into Claude Desktop config,
          leaving any existing MCP servers untouched. A timestamped backup is
          kept next to the file.
        </span>
      ) : (
        <span className="muted">Finish step 1 first.</span>
      )
    },
    {
      num: 3,
      done: !!test?.ok,
      title: 'Verify locally',
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="muted">
            Spawns the server, runs initialize → tools/list → search_items, and
            prints the trail. No Claude Desktop restart needed for this.
          </span>
          <div>
            <Button size="sm" onClick={runTest} disabled={!info.serverBuilt || busy === 'test'}>
              {busy === 'test' ? 'Testing…' : 'Run local test'}
            </Button>
          </div>
          {test && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 7,
                background: 'var(--bg-card)',
                border: `1px solid ${test.ok ? 'color-mix(in srgb, #34c759 40%, var(--hair))' : 'color-mix(in srgb, #ff453a 40%, var(--hair))'}`,
                fontSize: 11.5,
                color: 'var(--ink-2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div>
                <strong style={{ color: test.ok ? '#34c759' : '#ff453a' }}>
                  {test.ok ? '✓ Passed' : '✗ Failed'}
                </strong>{' '}
                · {test.elapsedMs}ms
              </div>
              {test.steps.map((s, i) => (
                <div key={i} className="mono" style={{ fontSize: 10.5 }}>
                  {s.ok ? '✓' : '✗'} {s.name}
                  {s.detail && <span className="muted"> — {s.detail}</span>}
                </div>
              ))}
              <div className="muted" style={{ marginTop: 2 }}>
                {test.summary}
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      num: 4,
      done: false, // we can't introspect the client's running state
      title: 'Use it — copy the config into any MCP client',
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="muted">
            The toggle above writes this into Claude Desktop for you. To use pit
            anywhere else (Cursor, Windsurf, Claude Code…), paste this snippet
            into that client&apos;s MCP config, then restart it:
          </span>
          <code
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              background: 'var(--bg-card)',
              border: '1px solid var(--hair)',
              fontSize: 11,
              fontFamily: 'var(--f-mono)',
              display: 'block',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: 1.5
            }}
          >
            {mcpConfig}
          </code>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={copyMcpConfig}>
              <I.Copy size={11} /> Copy config
            </Button>
          </div>
          <span className="muted" style={{ fontSize: 11 }}>
            Then ask:{' '}
            <em>&ldquo;Look in my pit and find a couple of dark dashboard references.&rdquo;</em>{' '}
            — the client calls <code>search_items</code>; click any returned{' '}
            <code>pit://item/&hellip;</code> link to jump straight to that item here.
          </span>
        </div>
      )
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
      {/* Top row: status + toggle */}
      <div className="share-row">
        <div className="share-row-text">
          <div className="ui-label">
            {info.installed ? 'Enabled' : 'Disabled'}
          </div>
          <div className="muted share-row-hint">
            {info.installed ? (
              <>
                Pit MCP is registered in{' '}
                <span className="mono" style={{ fontSize: 10.5 }}>
                  {info.configPath}
                </span>
                . Claude Desktop will pick it up after a restart.
              </>
            ) : info.configExists ? (
              <>
                {info.otherServers.length > 0
                  ? `Claude config has ${info.otherServers.length} other MCP server(s); enabling adds pit alongside them.`
                  : 'Claude config exists but has no MCP servers yet — enabling adds pit.'}
              </>
            ) : (
              <>
                No Claude Desktop config detected. Enabling creates it at{' '}
                <span className="mono" style={{ fontSize: 10.5 }}>
                  {info.configPath}
                </span>
                .
              </>
            )}
          </div>
        </div>
        <Switch
          on={info.installed}
          onChange={() => (info.installed ? void disable() : void enable())}
        />
      </div>

      {/* DB / server status pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 11px',
          borderRadius: 8,
          background: 'var(--bg-soft)',
          border: '1px solid var(--hair)',
          fontSize: 11.5,
          color: 'var(--ink-3)'
        }}
      >
        <span style={{ flex: 1 }}>
          {info.serverBuilt ? (
            <>
              <strong style={{ color: '#34c759' }}>✓ Built</strong>
            </>
          ) : (
            <>
              <strong style={{ color: '#ff9f0a' }}>! Not built</strong>
            </>
          )}
          {info.dbExists ? (
            <>
              {' '}
              · DB {sizeKb} KB
            </>
          ) : (
            <>
              {' '}
              · DB not found yet (open pit at least once)
            </>
          )}
        </span>
      </div>

      {/* Tutorial steps */}
      <div className="mcp-steps">
        {steps.map((s) => (
          <div key={s.num} className={`mcp-step${s.done ? ' done' : ''}`}>
            <div className="mcp-step-num">
              {s.done ? <I.Check size={12} /> : s.num}
            </div>
            <div className="mcp-step-body">
              <div className="mcp-step-title">{s.title}</div>
              <div className="mcp-step-detail">{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Paths reference (collapsible-feeling, just placed at the bottom) */}
      <details style={{ fontSize: 11.5 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--ink-3)' }}>
          Paths &amp; manual config (advanced)
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <Field label="MCP server" hint="Absolute path on this machine.">
            <Input mono readOnly value={argPath} onClick={(e) => (e.target as HTMLInputElement).select()} />
          </Field>
          <Field label="pit database" hint="Read-only access; pit owns writes.">
            <Input mono readOnly value={info.dbPath} onClick={(e) => (e.target as HTMLInputElement).select()} />
          </Field>
          <Field label="Claude Desktop config" hint={info.configExists ? 'Exists.' : 'Will be created on enable.'}>
            <Input mono readOnly value={info.configPath} onClick={(e) => (e.target as HTMLInputElement).select()} />
          </Field>
        </div>
      </details>
    </div>
  )
}

/* ============================================================
   Provider create / edit form
   ============================================================ */
function ProviderForm({
  draft,
  isNew,
  conn,
  onChange,
  onCancel,
  onSave,
  onTestModel
}: {
  draft: Provider
  isNew: boolean
  conn: Record<string, ConnState>
  onChange: (p: Provider) => void
  onCancel: () => void
  onSave: () => void
  onTestModel: (p: Provider, model: string) => void
}): React.JSX.Element {
  const [showKey, setShowKey] = useState(false)
  const [modelInput, setModelInput] = useState('')
  const meta = KIND_META[draft.kind]

  const addModel = (): void => {
    const id = modelInput.trim()
    if (!id || draft.models.some((m) => m.id === id)) return
    // Catalog hits don't need an override; unknown ids get a text-only modality
    // the user can widen via the badges. Either way no manual vision toggle.
    onChange({
      ...draft,
      models: [...draft.models, { id, modality: modalityForNewModel(id) }]
    })
    setModelInput('')
  }
  const removeModel = (id: string): void =>
    onChange({ ...draft, models: draft.models.filter((m) => m.id !== id) })
  const setDefault = (id: string): void =>
    onChange({
      ...draft,
      models: [
        ...draft.models.filter((m) => m.id === id),
        ...draft.models.filter((m) => m.id !== id)
      ]
    })
  // Toggle a single input modality on a custom (non-catalog) model's override.
  const toggleModality = (id: string, mod: Modality): void =>
    onChange({
      ...draft,
      models: draft.models.map((m) => {
        if (m.id !== id) return m
        const cur = m.modality || { input: ['text'], output: ['text'] }
        const has = cur.input.includes(mod)
        const input = has ? cur.input.filter((x) => x !== mod) : [...cur.input, mod]
        return { ...m, modality: { ...cur, input: input.length ? input : ['text'] } }
      })
    })

  return (
    <>
      <div className="providers-head">
        <h3>{isNew ? 'New provider' : 'Edit provider'}</h3>
      </div>

      {isNew && (
        <Field label="Start from">
          <div className="brand-picker">
            {BRANDS.map((b) => {
              const selected = b.id === 'custom' ? !draft.brand : draft.brand === b.id
              return (
                <button
                  key={b.id}
                  className={`brand-tile${selected ? ' selected' : ''}`}
                  onClick={() => onChange({ ...providerFromBrand(b, draft.id) })}
                >
                  <ProviderMark
                    brand={b.id === 'custom' ? undefined : b.id}
                    kind={b.kind}
                    name={b.name}
                    size={20}
                  />
                  <span>{b.name}</span>
                </button>
              )
            })}
          </div>
        </Field>
      )}

      <Field label="Provider type">
        <div className="kind-chips">
          {PROVIDER_KINDS.map((k) => (
            <button
              key={k}
              className={`kind-chip${draft.kind === k ? ' selected' : ''}`}
              onClick={() => onChange({ ...draft, kind: k as ProviderKind })}
            >
              {KIND_META[k].name}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Name">
        <Input
          placeholder={meta.short}
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </Field>

      <Field label="API key">
        <Input
          mono
          type={showKey ? 'text' : 'password'}
          placeholder={draft.kind === 'openai-compatible' ? 'optional for local gateways' : 'sk-…'}
          value={draft.apiKey}
          onChange={(e) => onChange({ ...draft, apiKey: e.target.value })}
          trailing={
            <IconButton title={showKey ? 'Hide' : 'Show'} onClick={() => setShowKey((s) => !s)}>
              <I.Eye size={14} />
            </IconButton>
          }
        />
      </Field>

      {meta.needsBaseURL && (
        <Field label="Base URL">
          <Input
            mono
            placeholder="https://open.bigmodel.cn/api/paas/v4"
            value={draft.baseURL || ''}
            onChange={(e) => onChange({ ...draft, baseURL: e.target.value })}
          />
        </Field>
      )}

      <Field
        label="Models"
        labelExtra="First entry is the default · ◉ = from catalog · ○ = override"
      >
        <div className="models-editor">
          {draft.models.map((m, i) => {
            const c = conn[`${draft.id}:${m.id}`]
            const inCatalog = !!lookupModel(m.id)
            const inputs = getModelModality(draft, m.id).input
            const MODS: Modality[] = ['image', 'video', 'audio']
            return (
              <div key={m.id} className="model-row">
                {i === 0 ? (
                  <span className="model-default">DEFAULT</span>
                ) : (
                  <button className="set-default" onClick={() => setDefault(m.id)}>
                    set default
                  </button>
                )}
                <span className="model-name mono">{m.id}</span>
                <div
                  className="modality-badges"
                  title={inCatalog ? 'From model catalog' : 'Custom override — click to toggle'}
                >
                  {MODS.map((mod) => {
                    const on = inputs.includes(mod)
                    const label = mod === 'image' ? 'img' : mod === 'video' ? 'vid' : 'aud'
                    return (
                      <button
                        key={mod}
                        className={`mod-badge${on ? ' on' : ''}${inCatalog ? ' locked' : ''}`}
                        onClick={() => !inCatalog && toggleModality(m.id, mod)}
                        disabled={inCatalog}
                        title={
                          inCatalog
                            ? `${mod} input — from catalog`
                            : on
                              ? `${mod} input — click to disable`
                              : `${mod} input — click to enable`
                        }
                      >
                        {inCatalog ? (on ? '◉' : '·') : on ? '○' : '·'} {label}
                      </button>
                    )
                  })}
                </div>
                {c && (
                  <span
                    className={`conn-dot ${c.state === 'testing' ? 'idle' : c.state}`}
                    title={c.msg}
                  />
                )}
                <IconButton title="Test this model" onClick={() => onTestModel(draft, m.id)}>
                  <I.Bolt size={13} />
                </IconButton>
                <IconButton title="Remove" onClick={() => removeModel(m.id)}>
                  <I.Close size={13} />
                </IconButton>
              </div>
            )
          })}
          <div className="model-add">
            <Input
              mono
              placeholder="Add a model (e.g. gpt-4o)"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addModel()
                }
              }}
            />
            <Button size="sm" onClick={addModel} disabled={!modelInput.trim()}>
              Add
            </Button>
          </div>
        </div>
      </Field>

      <div className="form-footer">
        <span className="muted" style={{ fontSize: 11 }}>
          Use the ⚡ on each model to test it.
        </span>
        <div style={{ flex: 1 }} />
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={onSave} disabled={!draft.models.length}>
          <I.Check size={13} /> {isNew ? 'Create' : 'Update'}
        </Button>
      </div>
    </>
  )
}

function ToggleRow({
  name,
  desc,
  on,
  onToggle
}: {
  name: string
  desc: string
  on: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <div className="toggle-row">
      <div className="tr-info">
        <div className="tr-name">{name}</div>
        <div className="tr-desc">{desc}</div>
      </div>
      <Switch on={on} onChange={onToggle} />
    </div>
  )
}
