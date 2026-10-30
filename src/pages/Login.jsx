import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, User, Check, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../services/supabase'
import { isOnboardingCompleto, markOnboardingCompleto } from '../utils/onboarding'
import faviconIcon from '../assets/favicon-icon.png'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Password validation ───────────────────────────────────────────────────────

const validarPassword = (pass) => ({
  longitud: pass.length >= 8,
  mayuscula: /[A-Z]/.test(pass),
  minuscula: /[a-z]/.test(pass),
  numero: /[0-9]/.test(pass),
  especial: /[!@#$%^&*(),.?":{}|<>]/.test(pass),
})

const calcularSeguridad = (val) => {
  const n = Object.values(val).filter(Boolean).length
  if (n <= 1) return { label: 'Muy debil', color: '#FF3B30', pct: 20 }
  if (n === 2) return { label: 'Debil', color: '#FF9500', pct: 40 }
  if (n === 3) return { label: 'Regular', color: '#FFCC00', pct: 60 }
  if (n === 4) return { label: 'Buena', color: '#34C759', pct: 80 }
  return { label: 'Muy segura', color: '#30D158', pct: 100 }
}

const REQUISITOS = [
  { key: 'longitud', label: 'Minimo 8 caracteres' },
  { key: 'mayuscula', label: 'Una letra mayuscula' },
  { key: 'minuscula', label: 'Una letra minuscula' },
  { key: 'numero', label: 'Un numero' },
  { key: 'especial', label: 'Un caracter especial (!@#$%...)' },
]

// ── Shared input style ────────────────────────────────────────────────────────

const inputBase = {
  width: '100%',
  padding: '12px 14px 12px 40px',
  borderRadius: 12,
  fontSize: 15,
  fontFamily: 'inherit',
  outline: 'none',
  color: 'var(--text-primary)',
  background: 'var(--bg-card)',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({ label, icon, type = 'text', value, onChange, placeholder, rightSlot }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>{label}</div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: 12, color: 'var(--text-secondary)', display: 'flex', pointerEvents: 'none', zIndex: 1 }}>
          {icon}
        </span>
        <input
          type={type} value={value} onChange={onChange} placeholder={placeholder}
          style={{
            ...inputBase,
            paddingRight: rightSlot ? 44 : 14,
            border: `1.5px solid ${focused ? 'var(--accent-blue)' : 'var(--border-color)'}`,
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightSlot && (
          <span style={{ position: 'absolute', right: 12, display: 'flex', alignItems: 'center' }}>
            {rightSlot}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Password strength indicator ───────────────────────────────────────────────

function PasswordStrength({ validacion }) {
  const seg = calcularSeguridad(validacion)
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      style={{ marginTop: -6, marginBottom: 16 }}
    >
      {/* Strength bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${seg.pct}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{ height: '100%', borderRadius: 2, background: seg.color }}
          />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: seg.color, minWidth: 68, textAlign: 'right' }}>
          {seg.label}
        </span>
      </div>

      {/* Requirements list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {REQUISITOS.map(r => {
          const ok = validacion[r.key]
          return (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.div
                animate={{ background: ok ? 'rgba(48,209,88,0.12)' : 'var(--bg-secondary)' }}
                transition={{ duration: 0.2 }}
                style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <AnimatePresence mode="wait">
                  {ok ? (
                    <motion.span key="chk" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}>
                      <Check size={10} color="#30D158" strokeWidth={3} />
                    </motion.span>
                  ) : (
                    <motion.span key="x" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}>
                      <X size={10} color="var(--text-tertiary)" strokeWidth={2.5} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
              <span style={{ fontSize: 12, color: ok ? '#30D158' : 'var(--text-secondary)', fontWeight: ok ? 500 : 400, transition: 'color 0.2s' }}>
                {r.label}
              </span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Login() {
  const { signIn, signUp, cuentasGuardadas, cambiarCuenta, error: authError } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  // Destino al que volver tras iniciar sesión (/invitacion/…, /autorizar-mcp…):
  // solo rutas internas de la app
  const returnTo = typeof location.state?.returnTo === 'string' && /^\/(?!\/)/.test(location.state.returnTo) ? location.state.returnTo : null
  const [tab, setTab] = useState(() => (
    new URLSearchParams(window.location.search).get('tab') === 'registro' ? 'registro' : 'login'
  ))
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [success, setSuccess] = useState(false)
  const [localError, setLocalError] = useState(null)

  // Login fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [recordar, setRecordar] = useState(true)

  // Cuentas guardadas (cambio rápido de cuenta sin contraseña). Se leen una
  // sola vez al montar con un inicializador perezoso de useState en vez de
  // un useEffect, para no disparar un setState síncrono dentro de un efecto.
  const [cuentas] = useState(() => cuentasGuardadas())
  const [cambiandoCuenta, setCambiandoCuenta] = useState(false)

  // Register fields
  const [nombre, setNombre] = useState('')
  const [emailR, setEmailR] = useState('')
  const [passR, setPassR] = useState('')
  const [confirmR, setConfirmR] = useState('')

  // Derived validation state
  const passValidacion = validarPassword(passR)
  const todosRequisitos = Object.values(passValidacion).every(Boolean)
  const passwordsCoinciden = passR.length > 0 && passR === confirmR
  const canSubmit = nombre.trim().length > 0 && EMAIL_RE.test(emailR.trim()) && todosRequisitos && passwordsCoinciden && !loading

  const confirmBorder = confirmR.length > 0
    ? `1.5px solid ${passwordsCoinciden ? '#30D158' : '#FF3B30'}`
    : '1.5px solid var(--border-color)'

  const switchTab = (t) => { setTab(t); setLocalError(null); setSuccess(false) }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLocalError(null)
    if (!EMAIL_RE.test(email.trim())) { setLocalError('Introduce un email válido'); return }
    if (!password) { setLocalError('Introduce tu contraseña'); return }
    setLoading(true)
    const { ok, user } = await signIn(email, password, { recordar })
    if (ok) {
      await irTrasLoginExitoso(user)
    } else {
      setLocalError(authError || 'Email o contrasena incorrectos')
    }
    setLoading(false)
  }

  const irTrasLoginExitoso = async (user) => {
    if (returnTo) { navigate(returnTo); return }
    const onboardingDone =
      user?.user_metadata?.onboarding_completado ||
      isOnboardingCompleto(user?.id)
    if (onboardingDone) {
      markOnboardingCompleto(user?.id)
      navigate('/dashboard')
    } else {
      navigate('/onboarding')
    }
  }

  const handleCambiarCuenta = async (cuenta) => {
    setLocalError(null)
    setCambiandoCuenta(true)
    const { ok, error: err } = await cambiarCuenta(cuenta.refresh_token)
    if (ok) {
      // Recarga completa (no navigate()) para evitar que el Dashboard monte
      // con el `user` todavía desactualizado mientras onAuthStateChange
      // propaga la sesión nueva — mismo patrón que el switcher del Sidebar.
      window.location.href = '/dashboard'
    } else {
      setLocalError(err || 'No se pudo iniciar sesión con esa cuenta. Usa tu contraseña.')
    }
    setCambiandoCuenta(false)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setLocalError(null)

    const { ok, hasSession } = await signUp(emailR, passR, nombre)
    if (ok) {
      // hasSession=false significa que Supabase exige confirmar el email
      // antes de dar sesión.
      if (hasSession) navigate('/onboarding')
      else setSuccess(true)
    } else {
      setLocalError(authError || 'Error al crear la cuenta')
    }
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--gradient-bg)',
      padding: '16px', boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          background: 'var(--bg-card)', borderRadius: 22, padding: '44px 40px',
          width: 440, maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 8px 60px rgba(0,0,0,0.1), 0 2px 12px rgba(0,0,0,0.06)',
          boxSizing: 'border-box',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
          <img src={faviconIcon} alt="Aify" style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', lineHeight: 1 }}>Aify</span>
        </div>

        <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 8, marginBottom: 28 }}>
          {tab === 'login' ? 'Inteligencia artificial para agencias de marketing' : 'Crea tu cuenta · 30 días de prueba gratis'}
        </p>

        {/* Tabs */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 4, display: 'flex', marginBottom: 28 }}>
          {['login', 'registro'].map(t => {
            const active = tab === t
            return (
              <motion.button
                key={t} onClick={() => switchTab(t)} whileTap={{ scale: 0.98 }}
                style={{
                  flex: 1, padding: '9px', borderRadius: 9, fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', textAlign: 'center', border: 'none',
                  background: active ? 'var(--bg-card)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  fontFamily: 'inherit', transition: 'color 0.2s, background 0.2s',
                }}
              >
                {t === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}
              </motion.button>
            )
          })}
        </div>

        {tab === 'login' && cuentas.length > 0 && (
          <CuentasGuardadas cuentas={cuentas} onSelect={handleCambiarCuenta} disabled={cambiandoCuenta} />
        )}

        <AnimatePresence mode="wait">
          {/* ── Login form ── */}
          {tab === 'login' ? (
            <motion.form
              key="login"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              onSubmit={handleLogin}
            >
              <Field label="Email" icon={<Mail size={16} />} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" />
              <Field
                label="Contrasena"
                icon={<Lock size={16} />}
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                rightSlot={
                  <button type="button" onClick={() => setShowPass(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 0 }}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={recordar}
                    onChange={e => setRecordar(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Recordarme
                </label>
                <div onClick={() => navigate('/forgot-password')} style={{ fontSize: 12, color: 'var(--accent-blue)', cursor: 'pointer' }}>
                  ¿Olvidaste tu contrasena?
                </div>
              </div>
              <SubmitButton loading={loading} disabled={false} label="Entrar" />
              <AnimatePresence>
                {localError && <ErrorBox key="err" message={localError} />}
              </AnimatePresence>
            </motion.form>

          ) : (
            /* ── Register form ── */
            <motion.form
              key="registro"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              onSubmit={handleRegister}
            >
              {success ? (
                <SuccessState email={emailR} onBack={() => switchTab('login')} />
              ) : (
                <>
                  <Field label="Nombre" icon={<User size={16} />} type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre o agencia" />
                  <Field label="Email" icon={<Mail size={16} />} type="email" value={emailR} onChange={e => setEmailR(e.target.value)} placeholder="tu@email.com" />

                  {/* Password field */}
                  <div style={{ marginBottom: passR.length > 0 ? 6 : 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Contrasena</div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: 12, color: 'var(--text-secondary)', display: 'flex', pointerEvents: 'none', zIndex: 1 }}>
                        <Lock size={16} />
                      </span>
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={passR}
                        onChange={e => setPassR(e.target.value)}
                        placeholder="••••••••"
                        style={{ ...inputBase, paddingRight: 44, border: `1.5px solid ${passR.length > 0 && todosRequisitos ? '#30D158' : 'var(--border-color)'}` }}
                      />
                      <span style={{ position: 'absolute', right: 12, display: 'flex', alignItems: 'center' }}>
                        <button type="button" onClick={() => setShowPass(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 0 }}>
                          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </span>
                    </div>
                  </div>

                  {/* Strength indicator */}
                  <AnimatePresence>
                    {passR.length > 0 && (
                      <PasswordStrength key="strength" validacion={passValidacion} />
                    )}
                  </AnimatePresence>

                  {/* Confirm password field */}
                  <div style={{ marginBottom: confirmR.length > 0 && !passwordsCoinciden ? 4 : 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Confirmar contrasena</div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: 12, color: 'var(--text-secondary)', display: 'flex', pointerEvents: 'none', zIndex: 1 }}>
                        <Lock size={16} />
                      </span>
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmR}
                        onChange={e => setConfirmR(e.target.value)}
                        placeholder="••••••••"
                        style={{ ...inputBase, paddingRight: 44, border: confirmBorder }}
                      />
                      <span style={{ position: 'absolute', right: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {confirmR.length > 0 && passwordsCoinciden && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.15 }}>
                            <Check size={14} color="#30D158" />
                          </motion.span>
                        )}
                        <button type="button" onClick={() => setShowConfirm(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 0 }}>
                          {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </span>
                    </div>
                  </div>

                  {/* Mismatch message */}
                  <AnimatePresence>
                    {confirmR.length > 0 && !passwordsCoinciden && (
                      <motion.p
                        key="mismatch"
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        style={{ fontSize: 12, color: '#FF3B30', marginBottom: 16, marginTop: 0 }}
                      >
                        Las contrasenas no coinciden
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <SubmitButton loading={loading} disabled={!canSubmit} label="Crear cuenta" />

                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 12 }}>
                    Al registrarte aceptas los{' '}
                    <a href="/terminos" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>términos de uso</a>
                    {' '}y la{' '}
                    <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>política de privacidad</a>
                  </p>

                  <AnimatePresence>
                    {localError && <ErrorBox key="err" message={localError} />}
                  </AnimatePresence>
                </>
              )}
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// ── Submit button ─────────────────────────────────────────────────────────────

function SubmitButton({ loading, disabled, label }) {
  const inactive = disabled || loading
  return (
    <motion.button
      type="submit"
      whileHover={!inactive ? { backgroundColor: 'var(--accent-lime-hover)' } : {}}
      whileTap={!inactive ? { scale: 0.98 } : {}}
      disabled={inactive}
      style={{
        width: '100%', height: 48, borderRadius: 12,
        background: inactive ? 'var(--bg-secondary)' : 'var(--accent-lime)',
        color: inactive ? 'var(--text-tertiary)' : '#0B0C10',
        fontSize: 15, fontWeight: 600, border: 'none',
        cursor: inactive ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'inherit', transition: 'background 0.2s, color 0.2s',
      }}
    >
      {loading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }}
        />
      ) : label}
    </motion.button>
  )
}

// ── Error box ─────────────────────────────────────────────────────────────────

function ErrorBox({ message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      style={{
        background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)',
        borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#FF3B30',
        textAlign: 'center', marginTop: 12,
      }}
    >
      {message}
    </motion.div>
  )
}

// ── Cuentas guardadas (cambio rápido sin contraseña) ──────────────────────────

function CuentaGuardadaRow({ cuenta, onSelect, disabled }) {
  const [hover, setHover] = useState(false)
  const inicial = cuenta.email.charAt(0).toUpperCase()
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => !disabled && onSelect(cuenta)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 10px', borderRadius: 10,
        background: hover && !disabled ? 'var(--bg-hover)' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.15s ease',
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'linear-gradient(135deg, #FF2D55, #FF9500)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 600, color: 'white', flexShrink: 0,
      }}>
        {inicial}
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cuenta.email}
      </span>
    </div>
  )
}

function CuentasGuardadas({ cuentas, onSelect, disabled }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        background: 'var(--bg-secondary)', borderRadius: 14,
        padding: 8, marginBottom: 20,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-secondary)', padding: '4px 10px 6px' }}>
        Cuentas guardadas
      </div>
      {cuentas.map(c => (
        <CuentaGuardadaRow key={c.email} cuenta={c} onSelect={onSelect} disabled={disabled} />
      ))}
    </motion.div>
  )
}

// ── Success state (email confirmation pending) ────────────────────────────────

function SuccessState({ email, onBack }) {
  const [countdown, setCountdown] = useState(0)
  const [resending, setResending] = useState(false)
  const [resendOk, setResendOk] = useState(false)
  const [resendError, setResendError] = useState(null)

  const handleResend = async () => {
    if (countdown > 0 || resending || !supabase) return
    setResending(true)
    setResendOk(false)
    setResendError(null)
    try {
      const { error: err } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin } })
      if (err) throw err
      setResendOk(true)
      setCountdown(60)
    } catch (err) {
      setResendError(err.message || 'No se pudo reenviar el email. Intenta de nuevo.')
    }
    setResending(false)
  }

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const resendLabel = resending ? 'Enviando...'
    : countdown > 0 ? `Reenviar en ${countdown}s`
    : resendOk ? 'Email reenviado'
    : 'Reenviar email'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      style={{ textAlign: 'center', padding: '8px 0' }}
    >
      {/* Mail icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        style={{
          width: 68, height: 68, borderRadius: '50%',
          background: 'rgba(29,95,224,0.1)', border: '2px solid rgba(29,95,224,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
        }}
      >
        <Mail size={28} color="var(--accent-blue)" />
      </motion.div>

      <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.3px' }}>
        Revisa tu email
      </p>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.6 }}>
        Te hemos enviado un email de confirmacion a
      </p>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        {email}
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
        Haz click en el enlace del email para activar tu cuenta y comenzar el proceso de configuracion.
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 24 }}>
        ¿No lo ves? Revisa la carpeta de spam.
      </p>

      {/* Resend button */}
      <motion.button
        onClick={handleResend}
        disabled={countdown > 0 || resending}
        whileHover={countdown === 0 && !resending ? { backgroundColor: 'rgba(29,95,224,0.06)' } : {}}
        whileTap={countdown === 0 && !resending ? { scale: 0.97 } : {}}
        style={{
          width: '100%', height: 40, borderRadius: 10, marginBottom: 10,
          background: 'transparent', border: '1.5px solid var(--border-color)',
          color: countdown > 0 ? 'var(--text-tertiary)' : 'var(--accent-blue)',
          fontSize: 13, fontWeight: 500,
          cursor: countdown > 0 ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'all 0.2s',
        }}
      >
        {resendLabel}
      </motion.button>

      {resendError && (
        <div style={{ fontSize: 12, color: '#FF3B30', marginBottom: 10 }}>{resendError}</div>
      )}

      <motion.button
        onClick={onBack}
        whileHover={{ backgroundColor: 'var(--bg-hover)' }}
        whileTap={{ scale: 0.98 }}
        style={{
          width: '100%', height: 44, borderRadius: 12,
          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
          fontSize: 14, fontWeight: 500, border: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Volver al inicio de sesion
      </motion.button>
    </motion.div>
  )
}
