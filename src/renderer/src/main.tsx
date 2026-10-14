import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'
import './styles/orb.css'
import './styles/app.css'
import './styles/overlay.css'

const route = window.location.hash.replace(/^#\/?/, '') || 'app'
document.body.dataset.route = route

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App route={route} />
    </StrictMode>
  )
}
