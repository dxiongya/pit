// net-guard.ts — SSRF / exfiltration guards for renderer-supplied URLs.
//
// Every URL that reaches the capture pipeline or a link handler originates in
// the renderer (paste/drop/IPC) and is therefore untrusted. Without a guard,
// `captureSite`/`downloadToDataUrl` would happily load `http://127.0.0.1:<port>`,
// `http://169.254.169.254/` (cloud metadata), or any internal host in a real
// Chromium window. These helpers reject loopback / private / link-local targets
// and non-http(s) schemes before any request goes out.
//
// Caveat: `net.request`/BrowserWindow follow redirects on their own, so a public
// host that 30x-redirects to a private address is NOT re-validated here. The
// guard closes the renderer-controlled-URL entry point; redirect-chain pinning
// would be a deeper change.

import { isIP } from 'node:net'
import { promises as dns } from 'node:dns'

/** True for IPv4/IPv6 literals that must never be fetched (loopback, private,
 *  link-local, unique-local, multicast/reserved, unspecified). */
export function isBlockedIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const p = ip.split('.').map(Number)
    const [a, b] = p
    if (a === 10 || a === 127 || a === 0) return true // private, loopback, "this host"
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12 private
    if (a === 192 && b === 168) return true // 192.168/16 private
    if (a === 169 && b === 254) return true // 169.254/16 link-local (incl. metadata)
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64/10 CGNAT
    if (a >= 224) return true // multicast / reserved
    return false
  }
  if (isIP(ip) === 6) {
    const x = ip.toLowerCase().replace(/^\[|\]$/g, '')
    if (x === '::1' || x === '::') return true // loopback / unspecified
    if (x.startsWith('fe80')) return true // link-local
    if (x.startsWith('fc') || x.startsWith('fd')) return true // unique-local
    if (x.startsWith('::ffff:')) return isBlockedIp(x.slice('::ffff:'.length)) // v4-mapped
    return false
  }
  return false
}

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '')
  return h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')
}

/**
 * Validate that `raw` is a safe public http(s) URL to fetch from the main
 * process. Resolves DNS for hostnames and rejects any that map to a blocked
 * address. Returns the (unchanged) URL string on success; throws otherwise.
 */
export async function assertPublicHttpUrl(raw: string): Promise<string> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new Error(`Blocked: not a valid URL (${raw.slice(0, 80)})`)
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`Blocked URL scheme: ${u.protocol}`)
  }
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (isBlockedHostname(host)) throw new Error(`Blocked host: ${host}`)
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new Error(`Blocked private/loopback address: ${host}`)
    return raw
  }
  let addrs: { address: string }[]
  try {
    addrs = await dns.lookup(host, { all: true })
  } catch {
    throw new Error(`DNS lookup failed for ${host}`)
  }
  for (const a of addrs) {
    if (isBlockedIp(a.address)) {
      throw new Error(`Blocked: ${host} resolves to private/loopback address ${a.address}`)
    }
  }
  return raw
}
