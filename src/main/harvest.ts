// harvest.ts — source-level design extraction for the site-capture pipeline.
//
// Runs inside the same hidden capture window as PREP_SCRIPT/DISCOVER_SCRIPT (via
// capture.ts's CDP evalInPage) and reads REAL design data straight off the live
// DOM/CSS — computed colors, fonts, declared CSS-variable tokens, framework /
// CSS-method detection, and key assets. This becomes ground truth for the AI
// analysis (palette/typography/tokens use these exact values; screenshots are
// only used for layout/mood). Validated against real sites with
// scripts/dev-harvest-probe.cjs (Linear: accurate computed palette/type;
// shadcn/ui: full named --token map + Tailwind detection).
//
// HARVEST_SCRIPT MUST stay a single self-contained IIFE returning a
// JSON-serialisable object (no closures over module scope) — it is sent verbatim
// to Runtime.evaluate. Returns the SourceFacts shape (src/shared/ipc.ts).

export const HARVEST_SCRIPT = `(() => {
  const MAX_NODES = 4000
  const toHex = (c) => {
    const m = c && c.match(/rgba?\\(([^)]+)\\)/)
    if (!m) return null
    const p = m[1].split(',').map((s) => parseFloat(s.trim()))
    const r = p[0], g = p[1], b = p[2], a = p[3] === undefined ? 1 : p[3]
    if (a < 0.1) return null
    const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
    return '#' + h(r) + h(g) + h(b)
  }
  const quantize = (hex) => {
    const n = parseInt(hex.slice(1), 16)
    const q = (v) => Math.round(v / 12) * 12
    const h = (x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')
    return '#' + h(q((n >> 16) & 255)) + h(q((n >> 8) & 255)) + h(q(n & 255))
  }
  const colorW = new Map()
  const colorExact = new Map()
  const familySet = new Map()
  const addColor = (hex, area) => {
    if (!hex) return
    const k = quantize(hex)
    colorW.set(k, (colorW.get(k) || 0) + area)
    const ex = colorExact.get(k) || {}
    ex[hex] = (ex[hex] || 0) + area
    colorExact.set(k, ex)
  }
  const els = Array.from(document.querySelectorAll('body *')).slice(0, MAX_NODES)
  for (const el of els) {
    let r
    try { r = el.getBoundingClientRect() } catch (e) { continue }
    if (!r || r.width <= 0 || r.height <= 0) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) continue
    const area = Math.min(r.width * r.height, 1920 * 1080)
    addColor(toHex(cs.backgroundColor), area)
    if (parseFloat(cs.borderTopWidth) > 0) addColor(toHex(cs.borderTopColor), area * 0.05)
    const hasText = el.childNodes && Array.from(el.childNodes).some((nn) => nn.nodeType === 3 && nn.textContent.trim())
    if (hasText) {
      addColor(toHex(cs.color), area * 0.3)
      const fam = (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim()
      if (fam) {
        const f = familySet.get(fam) || { sizes: new Set(), weights: new Set(), count: 0, area: 0 }
        f.sizes.add(Math.round(parseFloat(cs.fontSize)))
        f.weights.add(cs.fontWeight)
        f.count++
        f.area += area
        familySet.set(fam, f)
      }
    }
  }
  const palette = [...colorW.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, w]) => {
    const ex = colorExact.get(k) || {}
    const exact = Object.entries(ex).sort((a, b) => b[1] - a[1])[0]
    return { hex: exact ? exact[0] : k, weight: Math.round(w) }
  })
  const fonts = [...familySet.entries()].sort((a, b) => b[1].area - a[1].area).slice(0, 6).map(([fam, f]) => ({
    family: fam, sizes: [...f.sizes].sort((a, b) => a - b), weights: [...f.weights].sort(), usage: f.count
  }))
  const bcs = getComputedStyle(document.body)
  const bodyFont = (bcs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim()

  const tokens = {}
  try {
    for (const sheet of document.styleSheets) {
      let rules
      try { rules = sheet.cssRules } catch (e) { continue }
      if (!rules) continue
      for (const rule of rules) {
        if (rule.selectorText && /(^|,)\\s*(:root|html)\\b/.test(rule.selectorText) && rule.style) {
          for (const prop of rule.style) {
            if (prop.startsWith('--')) tokens[prop] = rule.style.getPropertyValue(prop).trim()
          }
        }
      }
    }
  } catch (e) {}

  const tech = { framework: [], cssMethod: [], iconLib: [] }
  const w = window
  if (w.__NEXT_DATA__ || document.getElementById('__next')) tech.framework.push('Next.js')
  if (w.__NUXT__) tech.framework.push('Nuxt')
  const fiber = Array.from(document.querySelectorAll('div, main, section')).slice(0, 40)
    .some((el) => Object.keys(el).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')))
  if (w.React || w.__REACT_DEVTOOLS_GLOBAL_HOOK__ || document.querySelector('[data-reactroot]') || fiber) tech.framework.push('React')
  if (w.__VUE__ || document.querySelector('[data-v-app],[data-server-rendered]')) tech.framework.push('Vue')
  if (document.querySelector('[class*="svelte-"]')) tech.framework.push('Svelte')
  if (document.querySelector('[ng-version]')) tech.framework.push('Angular')
  const classList = Array.from(document.querySelectorAll('[class]')).slice(0, 400)
    .flatMap((el) => String(el.className).split(/\\s+/))
  const tw = classList.filter((c) => /^(flex|grid|hidden|block|inline|text-|bg-|p[xytrbl]?-|m[xytrbl]?-|w-|h-|rounded|gap-|items-|justify-|font-|border|shadow|space-)/.test(c)).length
  if (tw > 40) tech.cssMethod.push('Tailwind')
  if (document.querySelector('style[data-styled]') || classList.some((c) => /^sc-[a-zA-Z0-9]{5,}/.test(c))) tech.cssMethod.push('styled-components')
  if (classList.some((c) => /^css-[a-z0-9]{6,}$/.test(c))) tech.cssMethod.push('emotion/CSS-in-JS')
  if (Object.keys(tokens).length > 5) tech.cssMethod.push('CSS custom properties')

  const abs = (u) => { try { return new URL(u, location.href).href } catch (e) { return u } }
  const iconHref = (sel) => { const e = document.querySelector(sel); return e ? abs(e.getAttribute('href') || '') : null }

  // Dig out the REAL logo mark: inline SVG markup (the common case for modern
  // sites — self-contained + renderable) or an <img> URL, picked from the
  // strongest brand scopes first so we don't grab a hamburger/utility icon.
  const pickLogo = () => {
    const out = { svg: null, img: null, source: null }
    const scopes = [
      'a[href="/"]', 'a[href="' + location.origin + '/"]', 'a[href="' + location.origin + '"]',
      '[class*="logo" i]', '[id*="logo" i]', '[aria-label*="logo" i]', '[aria-label*="home" i]',
      '[class*="brand" i]', 'header', '[role="banner"]', 'nav'
    ]
    const okSize = (el) => { try { const r = el.getBoundingClientRect(); return r.width >= 16 && r.height >= 12 } catch (e) { return true } }
    for (const sel of scopes) {
      let nodes
      try { nodes = document.querySelectorAll(sel) } catch (e) { continue }
      for (const n of nodes) {
        const svg = n.tagName === 'SVG' ? n : n.querySelector('svg')
        if (svg && okSize(svg)) {
          let m = svg.outerHTML
          // Inline SVG omits xmlns (HTML parser supplies it); add it back so the
          // markup is a valid STANDALONE svg that renders as an image/data-URL.
          if (m && !/xmlns=/.test(m)) m = m.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
          if (m && m.length < 16000) return { svg: m, img: null, source: sel }
        }
        const img = n.tagName === 'IMG' ? n : n.querySelector('img')
        if (img) {
          const ss = (img.getAttribute('srcset') || '').split(',').map((x) => x.trim().split(' ')[0]).filter(Boolean)
          const src = img.getAttribute('src') || ss[ss.length - 1]
          const lo = (src || '').toLowerCase()
          if (src && !lo.includes('sprite') && !lo.includes('icon-') && !lo.includes('/icons/'))
            return { svg: null, img: abs(src), source: sel }
        }
      }
    }
    return out
  }
  const logo = {
    ...pickLogo(),
    appleTouchIcon: iconHref('link[rel~="apple-touch-icon"]'),
    svgFavicon: iconHref('link[rel~="icon"][type="image/svg+xml"]'),
    maskIcon: iconHref('link[rel~="mask-icon"]')
  }

  const favicon = document.querySelector('link[rel~="icon"]')
  const ogImage = document.querySelector('meta[property="og:image"]')
  const themeColor = document.querySelector('meta[name="theme-color"]')
  const loadedFonts = []
  try { document.fonts.forEach((ff) => { if (ff.status === 'loaded') loadedFonts.push(ff.family) }) } catch (e) {}
  const assets = {
    logo,
    favicon: favicon ? abs(favicon.getAttribute('href') || '') : null,
    ogImage: ogImage ? abs(ogImage.getAttribute('content') || '') : null,
    themeColor: themeColor ? themeColor.getAttribute('content') : null,
    loadedFonts: [...new Set(loadedFonts)].slice(0, 10),
    imgCount: document.images.length,
    inlineSvgCount: document.querySelectorAll('svg').length
  }

  const colorTokens = Object.entries(tokens).filter(([, v]) => /#|rgb|hsl|oklch/.test(v)).length
  return {
    palette, fonts, bodyFont,
    tokenCount: Object.keys(tokens).length, colorTokenCount: colorTokens, tokens,
    tech, assets, sampledNodes: els.length
  }
})()`
