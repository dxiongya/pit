/* eslint-disable react-refresh/only-export-components */
// Toast.tsx — lightweight toast host + clipboard helper.

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { I } from '../lib/icons'

interface ToastValue {
  push: (msg: string) => void
}

const ToastCtx = createContext<ToastValue>({ push: () => {} })

export function ToastHost({ children }: { children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<{ id: string; msg: string }[]>([])

  const push = useCallback((msg: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1800)
  }, [])

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <I.Check size={13} className="toast-ico" />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast(): ToastValue {
  return useContext(ToastCtx)
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
  } catch {
    /* ignore */
  }
  document.body.removeChild(ta)
  return Promise.resolve()
}
