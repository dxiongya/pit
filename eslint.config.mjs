import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/out',
      // Catalog is auto-generated from yaml; scripts/ holds CommonJS build tools.
      'src/renderer/src/lib/catalog/catalog.ts',
      'scripts/**',
      // Standalone sub-project with its own toolchain — not part of the app's
      // lint scope (Remotion has no Vite fast-refresh, so react-refresh rules
      // don't apply to its component+hook modules).
      'infra/remotion/**'
    ]
  },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      // Classic Hooks rules only. eslint-plugin-react-hooks v7's `recommended`
      // also bundles React-Compiler diagnostics (immutability /
      // set-state-in-effect / preserve-manual-memoization / …), but this app
      // does NOT build with the React Compiler (vite uses plain @vitejs/plugin-
      // react), so those diagnostics would flag working, never-compiled code.
      // Enable them only if/when the compiler is added to the build.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  eslintConfigPrettier
)
