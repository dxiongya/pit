import { useEffect, useState } from 'react'
import { ShareView } from './ShareView'
import { PitLogo } from './Logo'

type Route = { kind: 'home' } | { kind: 'share'; code: string } | { kind: '404' }

function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { kind: 'home' }
  const m = pathname.match(/^\/p\/([a-z0-9]{4,16})\/?$/)
  if (m) return { kind: 'share', code: m[1] }
  return { kind: '404' }
}

export function App(): React.JSX.Element {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname))

  useEffect(() => {
    const onPop = (): void => setRoute(parseRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (route.kind === 'share') return <ShareView code={route.code} />
  if (route.kind === '404') return <NotFound />
  return <Landing />
}

function Landing(): React.JSX.Element {
  return (
    <div className="centered">
      <div className="brand-stack">
        <PitLogo size={80} />
        <div className="brand-wordmark">pit</div>
      </div>
      <div className="brand-tag">A place to keep design materials.</div>
      <div className="brand-sub">
        Anyone with a share link can open it here. Got the desktop app?{' '}
        <a href="https://github.com/anthropics">Download pit</a>.
      </div>
    </div>
  )
}

function NotFound(): React.JSX.Element {
  return (
    <div className="centered">
      <PitLogo size={48} />
      <div className="page-heading">Not found</div>
      <div className="muted">This URL doesn't match any share.</div>
      <a className="link-btn" href="/">
        Back to pit.ink
      </a>
    </div>
  )
}
