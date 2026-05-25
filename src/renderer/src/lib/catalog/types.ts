// types.ts — catalog data model. Mirrors xapi/ai-specs but trimmed to what pit
// actually reads (we don't currently care about pricing, regions, etc).

export type Modality = 'text' | 'image' | 'audio' | 'video'

export type ModelStatus = 'stable' | 'preview' | 'deprecated'

export interface ModelModality {
  input: Modality[]
  output: Modality[]
}

export interface ModelCapabilities {
  context_length: number
  max_output_tokens?: number
  supports_streaming: boolean
  supports_tools: boolean
  supports_thinking: boolean
  // Reserved for family-specific extensions; we don't read these but keep them
  // tolerant so the yaml→ts copy doesn't lose data.
  [key: string]: unknown
}

export interface CatalogModel {
  id: string
  vendor: string
  family: string
  modality: ModelModality
  capabilities: ModelCapabilities
  status: ModelStatus
  /** Historical names + gateway prefixes for fuzzy match. */
  aliases?: string[]
}
