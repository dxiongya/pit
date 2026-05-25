// lookup.ts — id → CatalogModel resolution + modality queries.
//
// Normalization rules match catalog.yaml's canonical-id contract:
//   - lowercase
//   - `.` → `-`  (gemini-3.5-flash → gemini-3-5-flash)
//   - strip vendor prefix `openai/`, `google/`, etc.
//   - `:` modifier suffix is stripped before matching (gpt-4o:thinking → gpt-4o)

import { CATALOG } from './catalog'
import type { CatalogModel, Modality } from './types'

function normalizeId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^[\w-]+\//, '') // strip "vendor/" prefix
    .replace(/:.+$/, '') // strip ":modifier"
    .replace(/\./g, '-')
    .trim()
}

const INDEX = new Map<string, CatalogModel>()
for (const m of CATALOG) {
  INDEX.set(normalizeId(m.id), m)
  for (const alias of m.aliases || []) INDEX.set(normalizeId(alias), m)
}

/** Resolve a user-typed id (with dots, vendor prefix, casing, etc) to a catalog entry. */
export function lookupModel(id: string | undefined | null): CatalogModel | undefined {
  if (!id) return undefined
  return INDEX.get(normalizeId(id))
}

/** Modalities the model accepts as input (text/image/audio/video). */
export function getInputModalities(id: string | undefined | null): Modality[] {
  return lookupModel(id)?.modality.input || []
}

/** Modalities the model can produce as output. */
export function getOutputModalities(id: string | undefined | null): Modality[] {
  return lookupModel(id)?.modality.output || []
}

/** Does the model accept the given modality on input? */
export function supportsInput(id: string | undefined | null, modality: Modality): boolean {
  return getInputModalities(id).includes(modality)
}

/** Does the model produce the given modality on output? */
export function producesOutput(id: string | undefined | null, modality: Modality): boolean {
  return getOutputModalities(id).includes(modality)
}

/**
 * All catalog models matching a filter — used by the Settings UI to suggest
 * "models that fit this role" (e.g. all video-input chat models for the video role).
 */
export function listModels(filter?: {
  vendor?: string
  family?: string
  input?: Modality
  output?: Modality
  status?: CatalogModel['status']
}): CatalogModel[] {
  return CATALOG.filter((m) => {
    if (filter?.vendor && m.vendor !== filter.vendor) return false
    if (filter?.family && m.family !== filter.family) return false
    if (filter?.status && m.status !== filter.status) return false
    if (filter?.input && !m.modality.input.includes(filter.input)) return false
    if (filter?.output && !m.modality.output.includes(filter.output)) return false
    return true
  })
}
