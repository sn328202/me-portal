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
 * The worker calls skipWaiting, so a new version activates immediately; this
 * side reloads once when it takes control, so the page is never left running
 * one build's JavaScript against another's assets.
 *
 * The guard matters: without it, `controllerchange` on the very first
 * registration (when there was no controller at all) would reload the page the
 * first time anyone ever opened the app.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // No previous controller means this is a first install, not an update.
    if (reloading || !navigator.serviceWorker.controller) return;
    reloading = true;
    window.location.reload();
  });
}
