/* eslint-disable react-refresh/only-export-components */
// brands.tsx — preset AI vendors: kind, baseURL, and starter models. Modality
// for each starter model is resolved at use-time from the catalog (lib/catalog).
// Logos come from @lobehub/icons (official AI-vendor icon set).

import type { ComponentType } from 'react'
import type { ModelSpec, Provider, ProviderKind } from '../types'
import { KIND_META } from './provider'
import {
  Anthropic,
  ChatGLM,
  DeepSeek,
  Gemini,
  Groq,
  Minimax,
  Mistral,
  Moonshot,
  Ollama,
  OpenAI,
  OpenRouter,
  Perplexity,
  Qwen
} from '@lobehub/icons'

/** Map a brand id to its @lobehub/icons component (real logo + brand color). */
type AvatarIcon = { Avatar: ComponentType<{ size?: number; shape?: 'square' | 'circle' }> }
export const BRAND_ICON = {
  openai: OpenAI,
  anthropic: Anthropic,
  gemini: Gemini,
  deepseek: DeepSeek,
  zhipu: ChatGLM,
  qwen: Qwen,
  mistral: Mistral,
  openrouter: OpenRouter,
  perplexity: Perplexity,
  ollama: Ollama,
  moonshot: Moonshot,
  minimax: Minimax,
  groq: Groq
} as unknown as Record<string, AvatarIcon>

export interface Brand {
  id: string
  name: string
  kind: ProviderKind
  baseURL?: string
  color: string // fallback bg for the letter mark (custom providers)
  aliases?: string[] // extra keywords for auto-matching a provider to this brand
  models: ModelSpec[]
}

/** Preset vendors shown in the "Add provider" picker. */
export const BRANDS: Brand[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai',
    color: '#000000',
    models: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }, { id: 'o4-mini' }]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'anthropic',
    color: '#d97757',
    models: [{ id: 'claude-opus-4-7' }, { id: 'claude-sonnet-4-6' }, { id: 'claude-haiku-4-5' }]
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    kind: 'google',
    color: '#1a73e8',
    models: [{ id: 'gemini-2.0-flash' }, { id: 'gemini-2.0-pro' }]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'openai-compatible',
    baseURL: 'https://api.deepseek.com',
    color: '#4d6bfe',
    aliases: ['deepseek'],
    models: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }]
  },
  {
    id: 'zhipu',
    name: 'Zhipu GLM',
    kind: 'openai-compatible',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    color: '#3859ff',
    aliases: ['glm', 'bigmodel', 'chatglm', 'zhipu'],
    models: [{ id: 'glm-4.6' }, { id: 'glm-4v-plus' }]
  },
  {
    id: 'qwen',
    name: 'Qwen',
    kind: 'openai-compatible',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    color: '#615ced',
    aliases: ['qwen', 'dashscope', 'tongyi'],
    models: [{ id: 'qwen-max' }, { id: 'qwen-vl-max' }]
  },
  {
    id: 'mistral',
    name: 'Mistral',
    kind: 'openai-compatible',
    baseURL: 'https://api.mistral.ai/v1',
    color: '#fa520f',
    aliases: ['mistral', 'pixtral'],
    models: [{ id: 'mistral-large-latest' }, { id: 'pixtral-large-latest' }]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai-compatible',
    baseURL: 'https://openrouter.ai/api/v1',
    color: '#6566f1',
    aliases: ['openrouter'],
    models: []
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    kind: 'openai-compatible',
    baseURL: 'https://api.perplexity.ai',
    color: '#20b8cd',
    aliases: ['perplexity', 'sonar'],
    models: [{ id: 'sonar' }]
  },
  {
    id: 'ollama',
    name: 'Ollama',
    kind: 'openai-compatible',
    baseURL: 'http://localhost:11434/v1',
    color: '#111111',
    aliases: ['ollama', 'localhost:11434'],
    models: [{ id: 'llama3.2' }, { id: 'llama3.2-vision' }, { id: 'qwen2-vl' }]
  },
  {
    id: 'moonshot',
    name: 'Moonshot · Kimi',
    kind: 'openai-compatible',
    baseURL: 'https://api.moonshot.cn/v1',
    color: '#16162a',
    aliases: ['kimi', 'moonshot'],
    models: [{ id: 'moonshot-v1-8k' }, { id: 'moonshot-v1-32k' }, { id: 'kimi-latest' }]
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    kind: 'openai-compatible',
    baseURL: 'https://api.minimaxi.com/v1',
    color: '#ff4a4a',
    aliases: ['minimax', 'abab'],
    models: [{ id: 'MiniMax-Text-01' }, { id: 'MiniMax-VL-01' }]
  },
  {
    id: 'groq',
    name: 'Groq',
    kind: 'openai-compatible',
    baseURL: 'https://api.groq.com/openai/v1',
    color: '#f55036',
    aliases: ['groq'],
    models: [{ id: 'llama-3.3-70b-versatile' }]
  },
  {
    id: 'custom',
    name: 'Custom',
    kind: 'openai-compatible',
    color: '#6e6e73',
    models: []
  }
]

export function findBrand(id?: string): Brand | undefined {
  return id ? BRANDS.find((b) => b.id === id) : undefined
}

/** A square vendor mark — real @lobehub/icons logo when available, else first letter. */
export function ProviderMark({
  brand,
  kind,
  name,
  size = 32
}: {
  brand?: string
  kind: ProviderKind
  name?: string
  size?: number
}): React.JSX.Element {
  const Icon = brand ? BRAND_ICON[brand] : undefined
  if (Icon) return <Icon.Avatar size={size} shape="square" />
  const color = KIND_META[kind].color
  const letter = ((name || KIND_META[kind].short).trim()[0] || '?').toUpperCase()
  return (
    <div className="prov-mark" style={{ background: color, width: size, height: size }}>
      <span style={{ fontSize: size * 0.5 }}>{letter}</span>
    </div>
  )
}

/**
 * Best brand id for a provider: the explicit `brand` field, else a fuzzy match by
 * name / baseURL / aliases (so providers created before brands existed, or named
 * "DeepSeek" / "GLM" / "KIMI", still get the right logo).
 */
export function brandForProvider(p: {
  brand?: string
  name?: string
  baseURL?: string
}): string | undefined {
  if (p.brand) return p.brand
  const hay = `${p.name || ''} ${p.baseURL || ''}`.toLowerCase()
  if (!hay.trim()) return undefined
  const hit = BRANDS.find(
    (b) =>
      b.id !== 'custom' &&
      (hay.includes(b.id) ||
        hay.includes(b.name.toLowerCase()) ||
        (b.aliases || []).some((a) => hay.includes(a.toLowerCase())))
  )
  return hit?.id
}

/** Build a fresh Provider from a brand preset (called by the "Add" picker). */
export function providerFromBrand(brand: Brand, id: string): Provider {
  return {
    id,
    kind: brand.kind,
    brand: brand.id === 'custom' ? undefined : brand.id,
    name: brand.id === 'custom' ? '' : brand.name,
    apiKey: '',
    baseURL: brand.baseURL || '',
    models: brand.models.map((m) => ({ ...m }))
  }
}
