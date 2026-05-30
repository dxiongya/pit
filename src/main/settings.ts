// settings.ts — durable settings storage in the OS user-data dir.
// pit persists appearance + AI provider config here as plain JSON.

import { app } from 'electron'
import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'

function settingsPath(): string {
  return join(app.getPath('userData'), 'pit-settings.json')
}

export async function readSettings(): Promise<Record<string, unknown> | null> {
  let raw: string
  try {
    raw = await readFile(settingsPath(), 'utf-8')
  } catch {
    return null // no file yet — first run; callers fall back to defaults
  }
  try {
    return JSON.parse(raw)
  } catch (e) {
    // Corrupt settings: don't silently reset to defaults (that throws away the
    // user's provider config). Preserve the bad file for recovery and log loudly.
    console.error('[settings] pit-settings.json is corrupt — ignoring:', e)
    try {
      await writeFile(settingsPath() + '.corrupt', raw, 'utf-8')
    } catch {
      /* best-effort backup */
    }
    return null
  }
}

export async function writeSettings(data: unknown): Promise<void> {
  const file = settingsPath()
  await mkdir(join(file, '..'), { recursive: true })
  await writeFile(file, JSON.stringify(data, null, 2), 'utf-8')
}
