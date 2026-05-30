// aiText.ts — defensive coercion for AI-generated text fields that JSX would
// otherwise throw on.
//
// Why: our system prompts ask for `responsive: string`, but vision models
// sometimes return `responsive: { breakpoints, touch, collapse }` because the
// schema hint listed those as sub-aspects ("responsive: breakpoints/touch/
// collapse"). Rendering `{obj}` directly in JSX throws "Objects are not valid
// as a React child" and unmounts the whole detail card. Catch it at the edge.
//
// We don't strip — we flatten — so the user still sees the model's
// observations (just laid out as `key: value` lines instead of a paragraph).
// That way no analysis is lost when the model goes off-schema.

/**
 * Coerce any value into a renderable string.
 *   - strings + numbers: unchanged (as string)
 *   - null / undefined / boolean / function: empty string
 *   - arrays: each element coerced, joined with " · "
 *   - objects: rendered as "key: value" lines, one per own enumerable property
 */
export function safeText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean' || typeof v === 'function') return ''
  if (Array.isArray(v)) {
    return v
      .map((x) => safeText(x))
      .filter((s) => s.length > 0)
      .join(' · ')
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => {
        const s = safeText(val)
        return s ? `${k}: ${s}` : ''
      })
      .filter(Boolean)
    return entries.join('\n')
  }
  return ''
}
