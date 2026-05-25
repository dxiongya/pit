import './styles/app.css'
import './styles/recorder.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { RecorderControl } from './recorder/RecorderControl'
import { RecorderBorder } from './recorder/RecorderBorder'
import { RegionPicker } from './recorder/RegionPicker'

// Hash routing — accessory recorder windows load the same renderer build
// with a different #/ fragment so we can ship one bundle and fan out at boot.
const hash = window.location.hash
let element: React.JSX.Element
if (hash === '#/recorder-control') {
  document.body.classList.add('recorder-mode')
  element = <RecorderControl />
} else if (hash === '#/recorder-border') {
  document.body.classList.add('recorder-mode')
  element = <RecorderBorder />
} else if (hash === '#/recorder-region') {
  document.body.classList.add('recorder-mode')
  element = <RegionPicker />
} else {
  element = <App />
}

createRoot(document.getElementById('root')!).render(<StrictMode>{element}</StrictMode>)
