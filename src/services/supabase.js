import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const RECORDAR_KEY = 'aify_recordar_sesion'

// "Recordarme" en el login: la sesión se guarda en localStorage (sobrevive a
// cerrar el navegador) o en sessionStorage (se pierde al cerrarlo) según esta
// bandera. El cliente de Supabase es un singleton que no se puede recrear en
// caliente, así que este adaptador delega en uno u otro storage en cada
// llamada en vez de fijar el storage una sola vez al crear el cliente.
//
// GoTrueClient llama a este adaptador de forma síncrona ya en el
// constructor (para mirar si hay sesión guardada) — createClient() se
// ejecuta también durante el prerender en build time (vitePrerenderPlugin
// ejecuta el bundle real en Node), donde `localStorage`/`window` no
// existen. Sin esta guarda, cualquier build con las env vars de Supabase
// configuradas (como en Vercel; en local no hay .env así que nunca se
// disparaba) revienta con "ReferenceError: localStorage is not defined".
const hasWindowStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
const recordarSesionStorage = {
  getItem: (k) => {
    if (!hasWindowStorage) return null
    const recordar = window.localStorage.getItem(RECORDAR_KEY) !== 'false'
    return (recordar ? window.localStorage : window.sessionStorage).getItem(k)
  },
  setItem: (k, v) => {
    if (!hasWindowStorage) return
    const recordar = window.localStorage.getItem(RECORDAR_KEY) !== 'false'
    ;(recordar ? window.localStorage : window.sessionStorage).setItem(k, v)
  },
  removeItem: (k) => {
    if (!hasWindowStorage) return
    window.localStorage.removeItem(k)
    window.sessionStorage.removeItem(k)
  },
}

export const supabase = url && key && !url.includes('tu_project_url')
  ? createClient(url, key, { auth: { storage: recordarSesionStorage } })
  : null

export const hasSupabase = () => !!supabase

// Auth header for calls to our own /api/* proxy, which requires a logged-in
// Supabase user on every billed AI endpoint.
export async function getAuthHeaders() {
  if (!supabase) return {}
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}
