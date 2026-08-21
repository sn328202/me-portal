import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * Register the service worker so the portal opens from cache instead of the
 * network — the difference between tapping a home-screen icon and waiting on a
 * cold load. Production only: in dev it would cache the very files Vite is
 * hot-reloading.
 *
 * No skipWaiting on the worker's side, so an update takes over on the next
 * launch rather than swapping code under a page mid-render.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
