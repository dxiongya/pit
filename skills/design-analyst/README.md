# design-analyst skill

The analysis spec + AI guidance that powers pit's link import, image collection,
and auto-routing. Modeled on [awesome-design-md](https://github.com/VoltAgent/awesome-design-md).

## Files

| File | Role |
|---|---|
| `SKILL.md` | The skill itself — role, the 3 tasks (analyze-site / analyze-image / route), methodology, and the output contract. Use as the **system prompt**. |
| `DESIGN.template.md` | The human-readable DESIGN.md spec the JSON renders into (9 sections + a11y). The "明确的输出规范". |
| `output-schema.json` | JSON Schema (draft 2020-12) the model output must satisfy. Two shapes: `DesignDoc` (analysis) and `RoutingResult` (routing). |

## How pit will use it (next step)

The renderer never changes — only `lib/ai/provider.ts` and the main process do:

1. **Capture** (main): screenshot each page of a URL → array of image data URLs.
2. **Analyze** (main): send `SKILL.md` as the system prompt + the screenshots +
   `output-schema.json` (as a `response_format` / tool schema) to the active
   provider. Get back a `DesignDoc` JSON.
3. **Map**: the JSON *is* the renderer's `DesignDoc` — pit merges in the runtime
   `pages[].status` / `pages[].screenshot` it captured, then renders the
   LinkDetail tabs and the exportable `DESIGN.md` from `DESIGN.template.md`.
4. **Route**: send the item summary + the user's collections (each with its
   `prompt` / `tags` / `skip`) and get a `RoutingResult`; auto-route when
   `best`'s confidence ≥ the user's threshold, else drop into Inbox.

`DesignDoc` here is intentionally identical to `src/renderer/src/lib/types.ts`
(minus the runtime-only page fields), so analysis output drops straight into the UI.

## Provider notes

- **Anthropic / OpenAI**: pass `SKILL.md` as the system message and the schema via
  structured-output / tool calling to force valid JSON.
- **OpenAI-compatible** (Ollama, vLLM): if the model lacks vision, fall back to
  text-only analysis from DOM/visible text; if it lacks JSON mode, validate
  against `output-schema.json` and re-ask on failure.
