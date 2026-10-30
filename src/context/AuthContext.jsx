import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { markOnboardingCompleto } from '../utils/onboarding'

const AuthContext = createContext(null)

const RECORDAR_KEY = 'aify_recordar_sesion'
const CUENTAS_KEY = 'aify_cuentas_guardadas'
const MAX_CUENTAS_GUARDADAS = 5

function syncOnboardingLocally(user) {
  if (user?.user_metadata?.onboarding_completado) {
    markOnboardingCompleto(user.id)
  }
}

function leerCuentasGuardadas() {
  try {
    const raw = localStorage.getItem(CUENTAS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function guardarCuenta(email, refreshToken) {
  try {
    const cuentas = leerCuentasGuardadas()
    const idx = cuentas.findIndex(c => c.email === email)
    if (idx >= 0) {
      cuentas[idx] = { ...cuentas[idx], email, refresh_token: refreshToken }
    } else {
      cuentas.push({ email, refresh_token: refreshToken })
    }
    while (cuentas.length > MAX_CUENTAS_GUARDADAS) cuentas.shift()
    localStorage.setItem(CUENTAS_KEY, JSON.stringify(cuentas))
  } catch { /* ignore */ }
}

// Supabase rota el refresh_token en cada uso (signIn, setSession, o el
// refresco automático en segundo plano del SDK) — el token antiguo queda
// invalidado. Si no volvemos a guardar el token nuevo cada vez que cambia la
// sesión, una cuenta guardada solo sirve una vez: el primer "cambiar de
// cuenta" funciona, pero deja el token guardado obsoleto y el siguiente
// intento falla en silencio. Solo actualiza cuentas YA guardadas — no añade
// cuentas nuevas aquí (eso solo lo hace signIn con recordar=true).
function actualizarTokenSiGuardada(email, refreshToken) {
  if (!email || !refreshToken) return
  try {
    const cuentas = leerCuentasGuardadas()
    const idx = cuentas.findIndex(c => c.email === email)
    if (idx < 0) return
    cuentas[idx] = { ...cuentas[idx], refresh_token: refreshToken }
    localStorage.setItem(CUENTAS_KEY, JSON.stringify(cuentas))
  } catch { /* ignore */ }
}

// setSession() de supabase-js exige `access_token` y `refresh_token` (ver
// tipos en @supabase/auth-js GoTrueClient: setSession(currentSession: {
// access_token: string; refresh_token: string })`. Como para "cambiar de
// cuenta" solo guardamos el refresh_token, construimos un access_token con
// forma de JWT válida (tres segmentos base64url) pero sin campo `exp`. El
// cliente decodifica ese token localmente (no lo verifica) y, al no
// encontrar `exp`, lo trata como expirado y usa el refresh_token para pedir
// una sesión real (ver _setSession en GoTrueClient.js).
function toBase64Url(obj) {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function construirAccessTokenDummy() {
  return `${toBase64Url({ alg: 'none', typ: 'JWT' })}.${toBase64Url({})}.${toBase64Url({})}`
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const u = session?.user ?? null
        syncOnboardingLocally(u)
        setUser(u)
      })
      .catch((err) => {
        console.error('[Auth] getSession falló:', err.message)
        setError('No se pudo comprobar la sesión. Comprueba tu conexión y recarga la página.')
      })
      .finally(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      syncOnboardingLocally(u)
      setUser(u)
      actualizarTokenSiGuardada(u?.email, session?.refresh_token)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password, { recordar = true } = {}) => {
    setError(null)
    try { localStorage.setItem(RECORDAR_KEY, recordar ? 'true' : 'false') } catch { /* ignore */ }
    if (!supabase) {
      setError('Supabase no configurado')
      return { ok: false, user: null }
    }
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setError(err.message); return { ok: false, user: null } }
      syncOnboardingLocally(data.user)
      if (recordar && data.session?.refresh_token) {
        guardarCuenta(data.user.email, data.session.refresh_token)
      }
      return { ok: true, user: data.user }
    } catch (err) {
      console.error('[Auth] signIn falló:', err.message)
      setError('No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.')
      return { ok: false, user: null }
    }
  }

  const cuentasGuardadas = () => leerCuentasGuardadas()

  const cambiarCuenta = async (refreshToken) => {
    setError(null)
    if (!supabase) {
      setError('Supabase no configurado')
      return { ok: false, error: 'Supabase no configurado' }
    }
    try {
      // Cambiamos a una cuenta guardada, así que es una sesión "recordada".
      try { localStorage.setItem(RECORDAR_KEY, 'true') } catch { /* ignore */ }
      const { error: err } = await supabase.auth.setSession({
        access_token: construirAccessTokenDummy(),
        refresh_token: refreshToken,
      })
      if (err) { setError(err.message); return { ok: false, error: err.message } }
      // onAuthStateChange ya actualiza `user` automáticamente.
      return { ok: true, error: null }
    } catch (err) {
      console.error('[Auth] cambiarCuenta falló:', err.message)
      setError('No se pudo cambiar de cuenta. Comprueba tu conexión e inténtalo de nuevo.')
      return { ok: false, error: err.message }
    }
  }

  const olvidarCuenta = (email) => {
    try {
      const cuentas = leerCuentasGuardadas().filter(c => c.email !== email)
      localStorage.setItem(CUENTAS_KEY, JSON.stringify(cuentas))
    } catch { /* ignore */ }
  }

  const signUp = async (email, password, nombre) => {
    setError(null)
    if (!supabase) {
      setError('Supabase no configurado')
      return { ok: false, hasSession: false }
    }
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre }, emailRedirectTo: window.location.origin },
      })
      if (err) { setError(err.message); return { ok: false, hasSession: false } }
      return { ok: true, hasSession: !!data.session, user: data.session?.user || data.user }
    } catch (err) {
      console.error('[Auth] signUp falló:', err.message)
      setError('No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.')
      return { ok: false, hasSession: false }
    }
  }

  const signOut = async () => {
    setError(null)
    const emailSaliente = user?.email
    try {
      if (supabase) await supabase.auth.signOut()
    } catch (err) {
      console.error('[Auth] signOut falló:', err.message)
      setError('No se pudo cerrar sesión. Comprueba tu conexión e inténtalo de nuevo.')
    } finally {
      try { sessionStorage.clear() } catch { /* ignore */ }
      // supabase.auth.signOut() sin `scope` explícito usa 'global', que
      // revoca el refresh_token en el servidor — así que la entrada de esta
      // cuenta en el selector de "cuentas guardadas" queda muerta (cualquier
      // intento de cambiar a ella con cambiarCuenta() fallaría con un error
      // de token inválido en vez de simplemente pedir la contraseña de
      // nuevo). La quitamos aquí. No tocamos el resto de cuentas guardadas
      // (siguen siendo válidas y es el propósito del selector).
      if (emailSaliente) olvidarCuenta(emailSaliente)
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signUp, signOut, cuentasGuardadas, cambiarCuenta, olvidarCuenta }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
