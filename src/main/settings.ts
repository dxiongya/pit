// settings.ts — durable settings storage in the OS user-data dir.
// pit persists appearance + AI provider config here as plain JSON.

import { app } from 'electron'
import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'

function settingsPath(): string {
  return join(app.getPath('userData'), 'pit-settings.json')
}

export async function readSettings(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(settingsPath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function writeSettings(data: unknown): Promise<void> {
  const file = settingsPath()
  await mkdir(join(file, '..'), { recursive: true })
  await writeFile(file, JSON.stringify(data, null, 2), 'utf-8')
}
