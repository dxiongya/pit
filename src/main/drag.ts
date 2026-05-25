// drag.ts — start an OS-level drag of one or more images from the renderer.
//
// We can't startDrag from the renderer directly (it's a webContents API), and
// we need real files on disk so other apps (Finder, Slack, Notion, Figma)
// accept the drop. So: renderer hands us data URLs over IPC, we write each
// one to a temp .png, and call webContents.startDrag with the file list.

import { nativeImage } from 'electron'
import type { WebContents } from 'electron'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

function safeName(name: string | undefined, i: number): string {
  const base = (name || 'image')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .slice(0, 60)
  return `pit-${Date.now()}-${i}-${base}.png`
}

function parseDataUrl(d: string): Buffer | null {
  const m = d.match(/^data:[^;]+;base64,([\s\S]+)$/)
  return m ? Buffer.from(m[1], 'base64') : null
}

export async function startImageDrag(
  webContents: WebContents,
  dataUrls: string[],
  name?: string
): Promise<void> {
  const valid = dataUrls.filter(Boolean)
  if (!valid.length) return
  const dir = tmpdir()
  const files: string[] = []
  for (let i = 0; i < valid.length; i++) {
    const buf = parseDataUrl(valid[i])
    if (!buf) continue
    const path = join(dir, safeName(name, i))
    await fs.writeFile(path, buf)
    files.push(path)
  }
  if (!files.length) return
  // Use the first image as the drag preview icon (resized down so the OS
  // doesn't drag a 1500px-tall thumbnail under the cursor).
  let icon = nativeImage.createFromDataURL(valid[0])
  if (!icon.isEmpty()) {
    const size = icon.getSize()
    const scale = Math.min(1, 64 / Math.max(size.width, size.height))
    if (scale < 1)
      icon = icon.resize({
        width: Math.round(size.width * scale),
        height: Math.round(size.height * scale)
      })
  }
  // Electron's Item type wants `file` (primary) plus optional `files` (extras).
  webContents.startDrag({ file: files[0], files, icon })
}
