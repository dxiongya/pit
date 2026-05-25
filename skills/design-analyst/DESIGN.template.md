<!--
  DESIGN.template.md — the canonical, human-readable output spec.
  This is what a pit DesignDoc JSON renders into. It follows the
  awesome-design-md / Google Stitch DESIGN.md format (9 sections + a11y).
  {{double-brace}} tokens map 1:1 to JSON fields; [] are example placeholders.
-->

# {{title}} — DESIGN.md

> {{theme}}
>
> {{description}}
>
> Source: {{url}} · captured {{pages.length}} pages

---

## 1. Visual Theme & Atmosphere

{{theme}}

**Mood:** {{mood | tags}} · **Density:** [compact | comfortable | spacious] ·
**Philosophy:** [one line]

---

## 2. Color Palette & Roles

`palette[]` — semantic roles, not swatches. Primary/CTA is used sparingly.

| Role | Hex | Coverage |
|---|---|---|
| ink | `#1C1611` | 38% |
| paper | `#F5EFE6` | 32% |
| accent | `#5E8B6E` | 12% |
| accent-2 | `#C4884A` | 9% |
| muted | `#8A7E6F` | 6% |
| tint | `#E2D4BA` | 3% |

> Roles draw from: `ink, paper, primary, accent, accent-2, muted, danger,
> success, tint, surface`. `pct` sums to ≈ 100.

---

## 3. Typography Rules

`fonts[]` — full hierarchy. Name the face if certain, else classify.

| Role | Family | Weight | Size / Line-height |
|---|---|---|---|
| Display | [Tiempos Headline] | Light (300) | 64px / 0.95 |
| Heading | [Inter Display] | Semibold | 28px / 1.15 |
| Body | [Inter] | Regular | 16px / 1.5 |
| Caption | [JetBrains Mono] | Regular | 12px / 1.4 |

> Note OpenType signals when visible — `tnum` (tabular figures, common in
> fintech), `ss01` (stylistic sets), negative tracking on display.

---

## 4. Component Stylings

`components[]` — recurring elements, token-encoded with their states.

| Component | Count | Tokens |
|---|---|---|
| Primary button | 14 | `r:8 · h:36 · px:16 · ink/paper · hover:brightness` |
| Anchor card | 12 | `r:14 · 1px hair · sh-1 · hover:lift` |
| Inline code | 38 | `mono · soft bg · r:4` |
| Section heading | 9 | `serif · 32px · 0.95 lh` |

> Token keys: `r:` radius, `h:` height, `px:`/`py:` padding, `sh-N` elevation,
> `1px hair` border, color pairing (`ink/paper`), interactive states.

---

## 5. Layout Principles

**Grid:** {{layoutNote}}  *(e.g. `12-col · 1216 max · gutter 24 · asymmetric (cols 2–8 body)`)*

**Information architecture** (`ia[]`):

```
method                         index
├─ hero                        1 h1, 1 lead
├─ principles                  6 sections
│  ├─ build                    → /method/build
│  └─ ship                     → /method/ship
└─ footer                      4 link clusters
```

**Whitespace:** [generous margins; whitespace as signal of importance].

---

## 6. Depth & Elevation

`motion[]` — elevation ramp and motion behavior.

| Type | Easing | Duration | Intensity |
|---|---|---|---|
| Page transition | `cubic-bezier(.2,.8,.2,1)` | 320ms | ▓▓▓░░░░░░░ |
| Hover lift | `ease` | 160ms | ▓▓░░░░░░░░ |

> If shadows carry depth, describe the ramp (`sh-1`→`sh-3`). Some brands replace
> literal shadows with gradient mesh / surface tint — note which.

---

## 7. Do's and Don'ts

**Do**
- [Lead with serif display; let it set the tone.]
- [Keep body measure narrow for an essay feel.]

**Don't**
- [Don't introduce a second saturated accent.]
- [Don't animate on every hover; reserve motion for transitions.]

> These are the brand's non-negotiable constraints — the highest-value output.

---

## 8. Responsive Behavior

{{responsive}}

> Breakpoints, touch-target minimums (≥ 44px), and how the grid/typography
> collapse on mobile.

---

## 9. Agent Prompt Guide

**Quick reference:** {{palette as `role #HEX`}} · {{fonts as `role: Family`}}

**Ready-to-paste prompt:**

> {{agentPrompt}}

---

## Accessibility (scan)

`a11y[]` — grade `A` (passes) · `B` (minor gap) · `C` (fails/missing).

| Check | Grade | Detail |
|---|---|---|
| Contrast (AA body) | A | 4.9 : 1 — passes WCAG AA |
| Heading hierarchy | A | No skipped levels |
| Focus visible | A | Custom ring, 3px offset |
| Alt text coverage | B | 82% — some images missing alt |
| Reduced motion | C | No prefers-reduced-motion handling |

---

**Tags:** {{tags as `#tag`}}  *(lowercase, hyphenated — drive collection routing)*
