// scripts/catalog-build.cjs — one-shot yaml → ts compile.
// Run `pnpm catalog:build` after editing src/renderer/src/lib/catalog/catalog.yaml.
//
// Why static-ts not runtime js-yaml: ships zero runtime dep, plays nice with
// tsc/vite tree-shaking, and the catalog rarely changes — re-running this
// script is the conscious "schema update" moment.

const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const root = path.join(__dirname, '..')
const yamlPath = path.join(root, 'src/renderer/src/lib/catalog/catalog.yaml')
const tsPath = path.join(root, 'src/renderer/src/lib/catalog/catalog.ts')

const raw = fs.readFileSync(yamlPath, 'utf8')
const data = yaml.load(raw)
if (!Array.isArray(data)) {
  console.error('catalog.yaml: expected a top-level list of models')
  process.exit(1)
}

// Tiny shape check — catches typos in yaml edits before they hit TS.
const required = ['id', 'vendor', 'family', 'modality', 'capabilities', 'status']
for (const m of data) {
  for (const k of required) {
    if (!(k in m)) {
      console.error(`catalog.yaml: model is missing "${k}":\n${JSON.stringify(m, null, 2)}`)
      process.exit(1)
    }
  }
}

const header = `// AUTO-GENERATED from catalog.yaml — do not edit by hand.
// Run \`pnpm catalog:build\` to regenerate after editing the yaml.
//
// Source of truth: src/renderer/src/lib/catalog/catalog.yaml
// Models: ${data.length}

import type { CatalogModel } from './types'

export const CATALOG: readonly CatalogModel[] = ${JSON.stringify(data, null, 2)} as const
`

fs.writeFileSync(tsPath, header)
console.log(`✓ wrote ${path.relative(root, tsPath)} (${data.length} models)`)
