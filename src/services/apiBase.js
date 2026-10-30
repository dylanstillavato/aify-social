// In dev, VITE_API_URL is unset — requests stay relative and vite.config.js's
// proxy forwards them to the local Express server. In production, set
// VITE_API_URL to the deployed backend origin (frontend and backend live on
// different hosts once the frontend is on Vercel and the backend elsewhere).
const API_BASE = import.meta.env.VITE_API_URL || ''

export function apiUrl(path) {
  return `${API_BASE}${path}`
}

// A diferencia de apiUrl(), esta SIEMPRE devuelve una URL absoluta (con
// protocolo y host) — hace falta para enlaces que va a abrir/pegar un
// dispositivo externo (p.ej. el feed .ics de suscripción de calendario),
// donde una ruta relativa no significa nada.
export function apiUrlAbsoluta(path) {
  const base = API_BASE || window.location.origin
  return `${base}${path}`
}
