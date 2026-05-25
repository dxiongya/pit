// Quick smoke test for src/main/video.ts — runs outside Electron so we can
// iterate on extraction without rebuilding the whole app.

import { extractKeyframes } from '../src/main/video.ts'
import { writeFileSync } from 'fs'

const videoPath = process.argv[2] || '/tmp/test-video.mp4'

const t0 = Date.now()
const r = await extractKeyframes(videoPath, 8)
const ms = Date.now() - t0

console.log(`extracted in ${ms}ms`)
console.log(`  duration: ${r.durationSec.toFixed(2)}s`)
console.log(`  candidates: ${r.candidateCount}`)
console.log(`  kept: ${r.frames.length} (unique after dedup: ${r.uniqueCount})`)

r.frames.forEach((f, i) => {
  const sizeKB = Math.round((f.length * 0.75) / 1024)
  console.log(`    frame ${i}: ${sizeKB}KB`)
  // Save for inspection
  const base64 = f.split(',')[1]
  writeFileSync(`/tmp/pit-test-frame-${i}.png`, Buffer.from(base64, 'base64'))
})
console.log(`saved to /tmp/pit-test-frame-*.png`)
