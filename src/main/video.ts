// video.ts — keyframe extraction for video items.
//
// Pipeline:
//   1. probe duration via ffmpeg stderr parse (no separate ffprobe binary)
//   2. extract N evenly-spaced candidate PNGs at 1280px max width
//   3. compute 8x8 grayscale avg-hash (aHash) per candidate
//   4. greedy-dedup by Hamming distance — fold near-identical UI frames so the
//      vision call doesn't pay for repeated frames
//   5. floor of 3 frames so static videos still produce a meaningful sequence
//
// The original video file is never persisted — pit only stores the keyframes
// (as inline data URLs in design.pages, mirroring how link items work).

import { spawn } from 'child_process'
import { writeFileSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import ffmpegStatic from 'ffmpeg-static-electron'

const CANDIDATE_COUNT = 16
const HAMMING_DUP_THRESHOLD = 5 // out of 64 bits; tuned against UI-screencast samples
const MIN_FRAMES = 3
const FRAME_MAX_WIDTH = 1280

interface FfmpegStatic {
  path: string
}
const ffmpegMod = ffmpegStatic as unknown as FfmpegStatic

/**
 * Path to the ffmpeg binary. In production builds the binary lives under
 * app.asar.unpacked (see electron-builder.yml asarUnpack).
 */
function ffmpegPath(): string {
  return ffmpegMod.path.replace('app.asar/', 'app.asar.unpacked/')
}

export interface ExtractResult {
  frames: string[] // data: URLs (image/png)
  durationSec: number
  candidateCount: number
  uniqueCount: number
}

export interface CropRect {
  /** Display-CSS-px rectangle to crop each frame to before scaling. */
  x: number
  y: number
  w: number
  h: number
}

export async function extractKeyframes(
  videoSource: string | Buffer,
  target = 8,
  cropRect?: CropRect
): Promise<ExtractResult> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'pit-video-'))
  let inputPath: string
  let weOwnInput = false
  if (typeof videoSource === 'string') {
    inputPath = videoSource
  } else {
    inputPath = join(tmpDir, 'input.bin')
    writeFileSync(inputPath, videoSource)
    weOwnInput = true
  }

  try {
    const duration = await probeDuration(inputPath)
    if (!duration || duration < 0.1) {
      throw new Error(`video has no duration (got ${duration})`)
    }

    // Extract candidates at evenly-spaced timestamps within the video. Skip
    // the very-edge moments (0 and full duration) — they often catch the
    // black tail/first chroma frame of the encoder.
    // Build the -vf chain: optional crop first, then scale-down to ≤1280px.
    const vfParts: string[] = []
    if (cropRect && cropRect.w > 0 && cropRect.h > 0) {
      vfParts.push(
        `crop=${Math.round(cropRect.w)}:${Math.round(cropRect.h)}:${Math.round(cropRect.x)}:${Math.round(cropRect.y)}`
      )
    }
    vfParts.push(`scale='min(${FRAME_MAX_WIDTH},iw)':-2`)
    const vfChain = vfParts.join(',')

    const candidates: string[] = []
    for (let i = 0; i < CANDIDATE_COUNT; i++) {
      const ts = (duration * (i + 0.5)) / CANDIDATE_COUNT
      const outPath = join(tmpDir, `f-${i}.png`)
      // -ss AFTER -i = accurate seek (walks from start). For MediaRecorder
      // webm files this is the only reliable way; the fast pre-input seek
      // can land on the wrong frame when the container has no keyframe index.
      // The walk cost is negligible for the short recordings we target.
      await runFfmpeg([
        '-y',
        '-i',
        inputPath,
        '-ss',
        String(ts),
        '-frames:v',
        '1',
        '-vf',
        vfChain,
        outPath
      ])
      const bytes = readFileSync(outPath)
      candidates.push(`data:image/png;base64,${bytes.toString('base64')}`)
    }

    // Dedup by perceptual hash. Greedy: keep first occurrence, fold subsequent
    // frames whose hash is near-identical to any already-kept frame.
    const hashes = await Promise.all(candidates.map((_, i) => aHash(join(tmpDir, `f-${i}.png`))))
    const keptFrames: string[] = []
    const keptHashes: string[] = []
    for (let i = 0; i < candidates.length; i++) {
      const h = hashes[i]
      const isDup = keptHashes.some((kh) => hamming(h, kh) < HAMMING_DUP_THRESHOLD)
      if (!isDup) {
        keptFrames.push(candidates[i])
        keptHashes.push(h)
        if (keptFrames.length >= target) break
      }
    }

    // Floor — static videos that fold to <3 frames still get head/middle/tail.
    let frames = keptFrames
    if (frames.length < MIN_FRAMES) {
      const picks = new Set<number>()
      picks.add(0)
      picks.add(Math.floor(candidates.length / 2))
      picks.add(candidates.length - 1)
      frames = Array.from(picks)
        .sort((a, b) => a - b)
        .map((i) => candidates[i])
    }

    return {
      frames,
      durationSec: duration,
      candidateCount: CANDIDATE_COUNT,
      uniqueCount: keptFrames.length
    }
  } finally {
    // Only clean up our tmp dir, never the user's source file.
    if (weOwnInput) {
      try {
        rmSync(tmpDir, { recursive: true, force: true })
      } catch {
        // best effort
      }
    } else {
      try {
        rmSync(tmpDir, { recursive: true, force: true })
      } catch {
        // best effort
      }
    }
  }
}

async function probeDuration(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath(), ['-i', path, '-f', 'null', '-'], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stderr = ''
    p.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    p.on('close', () => {
      // Most mp4/mov files report Duration in the header before processing.
      const headerM = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/)
      if (headerM) {
        resolve(
          parseInt(headerM[1], 10) * 3600 +
            parseInt(headerM[2], 10) * 60 +
            parseFloat(headerM[3])
        )
        return
      }
      // MediaRecorder webm files often have "Duration: N/A" in the header
      // (streaming container, no duration written). With -f null - ffmpeg
      // walks the entire file and prints its final position as time=...
      // The LAST such match is the true duration.
      const timeMatches = [...stderr.matchAll(/time=(\d+):(\d+):([\d.]+)/g)]
      const last = timeMatches[timeMatches.length - 1]
      if (last) {
        resolve(
          parseInt(last[1], 10) * 3600 + parseInt(last[2], 10) * 60 + parseFloat(last[3])
        )
        return
      }
      reject(new Error(`probe failed: ${stderr.slice(-300)}`))
    })
    p.on('error', reject)
  })
}

/**
 * Compute average-hash (aHash) of an image:
 * downscale to 8×8 grayscale, bit = pixel > mean, return 64-bit binary string.
 *
 * We reuse ffmpeg for the resize so we don't need a separate image library;
 * the downscaled raw output is exactly 64 bytes.
 */
async function aHash(inputPng: string): Promise<string> {
  const outPath = inputPng + '.gray'
  await runFfmpeg([
    '-y',
    '-i',
    inputPng,
    '-vf',
    'scale=8:8,format=gray',
    '-f',
    'rawvideo',
    outPath
  ])
  const bytes = readFileSync(outPath)
  let sum = 0
  for (let i = 0; i < bytes.length; i++) sum += bytes[i]
  const avg = sum / bytes.length
  let bits = ''
  for (let i = 0; i < bytes.length; i++) bits += bytes[i] > avg ? '1' : '0'
  return bits
}

function hamming(a: string, b: string): number {
  let d = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) d++
  return d
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    p.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    p.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-400)}`))
    })
    p.on('error', reject)
  })
}
