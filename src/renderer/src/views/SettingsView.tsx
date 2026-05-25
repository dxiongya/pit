// SettingsView.tsx — feature 5: AI configuration.
// Create providers (from a vendor preset or custom), each with credentials and a
// model list where vision is marked per-model. Then bind each function
// (design / routing) to a provider + model. Plus feature toggles + appearance.

import { useState } from 'react'
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
import { useToast } from '../components/Toast'
import { Button, Field, IconButton, Input, Select, Switch } from '../components/ui'

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
            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={ai.features.routeThreshold}
              onChange={(e) =>
                patchAI({ features: { ...ai.features, routeThreshold: Number(e.target.value) } })
              }
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
            <input
              type="range"
              min={3}
              max={6}
              step={1}
              value={settings.cols}
              onChange={(e) => setSetting('cols', Number(e.target.value))}
            />
          </Field>
        </div>
      </div>
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
