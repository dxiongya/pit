// dev-xhs-probe.cjs — diagnose why a Xiaohongshu link extraction comes back empty.
// Loads the (short) URL in a hidden mobile-UA window (browser follows the 302),
// then reports: final URL, login-wall?, title, #images (xhs selectors), text.
//   npx electron scripts/dev-xhs-probe.cjs 'http://xhslink.com/o/4heW7v43oKC'

const { app, BrowserWindow } = require('electron')
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
const url = process.argv[2] || 'http://xhslink.com/o/4heW7v43oKC'

const EXTRACT = `(() => {
  const wallText = (document.body.innerText || '').slice(0, 500)
  const isLoginWall = /登录|Login|请先登录|扫码/.test(wallText) && !document.querySelector('img[src*="ci.xiaohongshu.com"]')
  const imgs = document.querySelectorAll('.note-detail img, .swiper-slide img, .img-container img, .image-container img, .note-content img')
  const anyImg = document.querySelectorAll('img').length
  const titleEl = document.querySelector('.note-detail .title, .note-content .title, .note-text .title, h1, .title')
  return {
    finalUrl: location.href,
    isLoginWall,
    bodyTextHead: wallText.replace(/\\s+/g, ' ').slice(0, 220),
    xhsImgSelectorCount: imgs.length,
    totalImgCount: anyImg,
    title: titleEl ? titleEl.textContent.trim().slice(0, 80) : null,
    hasVideo: !!document.querySelector('video'),
    hasMeta: !!document.querySelector('meta[property="og:image"]')
  }
})()`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 414,
    height: 896,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, offscreen: false }
  })
  win.webContents.setUserAgent(MOBILE_UA)
  try {
    await win.loadURL(url)
    await new Promise((r) => setTimeout(r, 2500))
    const r = await win.webContents.executeJavaScript(EXTRACT, true)
    process.stdout.write(JSON.stringify(r, null, 2) + '\n')
  } catch (e) {
    process.stdout.write('LOAD ERROR: ' + (e && e.message) + '\n')
    // even on error, dump where we ended up
    try { process.stdout.write('at: ' + win.webContents.getURL() + '\n') } catch {}
  } finally {
    app.quit()
  }
})
