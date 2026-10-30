import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Shield, ChevronRight, X, Check,
  Eye, EyeOff, Globe, LogOut, AlertCircle,
  ChevronDown, ChevronUp, Users, HardDrive, Trash2, RefreshCw, HelpCircle, Wallet, KeyRound, ExternalLink, Plug, Copy
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAppContext } from '../context/AppContext'
import { useOrganizacion } from '../hooks/useOrganizacion'
import { resetOnboarding } from '../utils/onboarding'
import { resetTutorial } from '../utils/tutorial'
import { obtenerClaveIa, guardarClaveIa, probarClaveIa, quitarClaveIa } from '../services/claveIa'
import { listarClavesApi, crearClaveApi, revocarClaveApi } from '../services/clavesApi'
import { listarAppsConectadas, desconectarApp } from '../services/oauthMcp'
import { apiUrlAbsoluta } from '../services/apiBase'
import { OPCIONES_MODO_COBRO } from '../utils/modoCobro'
import SeccionProceso from '../components/SeccionProceso'
import { useEsMovil } from '../hooks/useEsMovil'

// ── Constants ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#1D5FE0', '#30D158', '#FF3B30', '#FF9500', '#7CC0FF', '#1D1D1F']
const PAISES = ['España', 'México', 'Argentina', 'Colombia', 'Chile', 'Otro']

// ── Primitives ─────────────────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>{children}</div>
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, type = 'text', placeholder, readOnly, rightSlot }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        type={type} value={value}
        onChange={onChange} placeholder={placeholder}
        readOnly={readOnly}
        style={{
          width: '100%',
          padding: rightSlot ? '11px 44px 11px 14px' : '11px 14px',
          borderRadius: 12,
          border: `1.5px solid ${focused ? '#1D5FE0' : 'rgba(0,0,0,0.12)'}`,
          fontSize: 14, fontFamily: 'inherit', outline: 'none',
          color: readOnly ? '#86868B' : '#1D1D1F',
          background: readOnly ? 'rgba(0,0,0,0.03)' : 'white',
          transition: 'border 0.2s', boxSizing: 'border-box',
          cursor: readOnly ? 'not-allowed' : 'text',
        }}
        onFocus={() => !readOnly && setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {rightSlot && (
        <span style={{ position: 'absolute', right: 12, display: 'flex', alignItems: 'center' }}>
          {rightSlot}
        </span>
      )}
    </div>
  )
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '11px 36px 11px 14px', borderRadius: 12,
        border: '1.5px solid var(--border-color)',
        fontSize: 14, fontFamily: 'inherit', outline: 'none',
        color: 'var(--text-primary)', background: 'var(--bg-card)', cursor: 'pointer',
        appearance: 'none', boxSizing: 'border-box',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2386868B' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
      }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function SaveButton({ onClick, label = 'Guardar cambios', loading }) {
  return (
    <motion.button
      whileHover={{ backgroundColor: '#BEE62A' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        width: '100%', height: 48, borderRadius: 12,
        background: '#D7FF3D', color: '#0B0C10',
        fontSize: 15, fontWeight: 600, border: 'none',
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {loading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(11,12,16,0.25)', borderTopColor: '#0B0C10' }}
        />
      ) : label}
    </motion.button>
  )
}

// ── Panel lateral wrapper ──────────────────────────────────────────────────────

function PanelLateral({ open, onClose, titulo, children }) {
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 400 }}
          />
          <motion.div
            key="panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            style={{
              position: 'fixed', right: 0, top: 0, bottom: 0, width: 440,
              background: 'var(--bg-card)', zIndex: 401,
              boxShadow: '-8px 0 60px rgba(0,0,0,0.12)',
              display: 'flex', flexDirection: 'column',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '24px 28px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', flexShrink: 0,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>{titulo}</h2>
              <motion.button
                whileHover={{ backgroundColor: 'rgba(0,0,0,0.07)' }}
                whileTap={{ scale: 0.92 }}
                onClick={onClose}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--bg-hover)', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={16} color="#1D1D1F" />
              </motion.button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ visible, mensaje = 'Cambios guardados' }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.22 }}
          style={{
            position: 'fixed', top: 24, right: 24, zIndex: 500,
            background: 'var(--bg-card)', borderRadius: 14, padding: '12px 18px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', gap: 10,
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(52,199,89,0.12)', border: '1.5px solid rgba(52,199,89,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Check size={13} color="#34C759" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{mensaje}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Panel: Perfil ──────────────────────────────────────────────────────────────

function PanelPerfil({ perfil, onSave, onClose }) {
  const [form, setForm] = useState(perfil)
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: form.avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 700, color: 'white',
          margin: '0 auto 14px',
          boxShadow: `0 4px 24px ${form.avatarColor}50`,
        }}>
          {(form.nombre || 'U').charAt(0).toUpperCase()}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Color del avatar</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {AVATAR_COLORS.map(c => (
            <motion.button
              key={c} whileTap={{ scale: 0.85 }}
              onClick={() => upd('avatarColor', c)}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: c, border: 'none', cursor: 'pointer', flexShrink: 0,
                outline: form.avatarColor === c ? `3px solid ${c}` : '3px solid transparent',
                outlineOffset: 2, transition: 'outline 0.15s',
              }}
            />
          ))}
        </div>
      </div>

      <Field label="Nombre completo">
        <TextInput value={form.nombre} onChange={e => upd('nombre', e.target.value)} placeholder="Tu nombre" />
      </Field>
      <Field label="Email">
        <TextInput value={form.email} readOnly />
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 5 }}>El email no se puede cambiar desde aquí.</p>
      </Field>
      <Field label="Nombre de la agencia o negocio">
        <TextInput value={form.agencia} onChange={e => upd('agencia', e.target.value)} placeholder="Nombre de tu agencia" />
      </Field>
      <Field label="País">
        <SelectInput value={form.pais} onChange={v => upd('pais', v)} options={PAISES} />
      </Field>
      <Field label="Idioma preferido">
        <SelectInput value={form.idioma} onChange={v => upd('idioma', v)} options={['Español', 'English']} />
      </Field>

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SaveButton onClick={() => onSave(form)} />
        <button
          onClick={onClose}
          style={{
            width: '100%', height: 40, background: 'none', border: 'none',
            color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancelar
        </button>
      </div>
    </>
  )
}

// ── Panel: Seguridad ──────────────────────────────────────────────────────────

function detectarNavegador() {
  const ua = navigator.userAgent
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('Chrome/') && !ua.includes('Chromium')) return 'Chrome'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari'
  return 'Este navegador'
}

function PanelSeguridad({ onSave }) {
  const navigate = useNavigate()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showA, setShowA] = useState(false)
  const [showN, setShowN] = useState(false)
  const [showC, setShowC] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [cerrandoSesiones, setCerrandoSesiones] = useState(false)

  const handleCerrarSesiones = async () => {
    setCerrandoSesiones(true)
    try {
      if (supabase) await supabase.auth.signOut({ scope: 'global' })
    } catch (err) {
      console.error('[Seguridad] Error al cerrar sesiones:', err.message)
    }
    navigate('/login')
  }

  const canSave = actual && nueva && confirmar

  const handleCambiar = async () => {
    setError(null)
    if (nueva !== confirmar) { setError('Las contraseñas no coinciden'); return }
    if (nueva.length < 6) { setError('Mínimo 6 caracteres'); return }
    setLoading(true)
    try {
      if (supabase) {
        const { error: err } = await supabase.auth.updateUser({ password: nueva })
        if (err) throw err
      }
      setActual(''); setNueva(''); setConfirmar('')
      onSave()
    } catch (err) {
      setError(err.message || 'Error al actualizar la contraseña')
    }
    setLoading(false)
  }

  const eyeBtn = (show, setShow) => (
    <button onClick={() => setShow(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
      {show ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  )

  return (
    <>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 18 }}>Cambiar contraseña</h3>
      <Field label="Contraseña actual">
        <TextInput value={actual} onChange={e => setActual(e.target.value)} type={showA ? 'text' : 'password'} placeholder="••••••••" rightSlot={eyeBtn(showA, setShowA)} />
      </Field>
      <Field label="Nueva contraseña">
        <TextInput value={nueva} onChange={e => setNueva(e.target.value)} type={showN ? 'text' : 'password'} placeholder="••••••••" rightSlot={eyeBtn(showN, setShowN)} />
      </Field>
      <Field label="Confirmar nueva contraseña">
        <TextInput value={confirmar} onChange={e => setConfirmar(e.target.value)} type={showC ? 'text' : 'password'} placeholder="••••••••" rightSlot={eyeBtn(showC, setShowC)} />
      </Field>

      {error && (
        <div style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#FF3B30', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <motion.button
        whileHover={canSave ? { backgroundColor: '#1850BE' } : {}}
        whileTap={canSave ? { scale: 0.98 } : {}}
        onClick={handleCambiar}
        disabled={!canSave || loading}
        style={{
          width: '100%', height: 46, borderRadius: 12,
          background: canSave ? '#1D5FE0' : 'rgba(0,0,0,0.07)',
          color: canSave ? 'white' : '#86868B',
          fontSize: 14, fontWeight: 600, border: 'none',
          cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {loading ? (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
        ) : 'Actualizar contraseña'}
      </motion.button>

      <div style={{ marginTop: 36 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>Sesiones activas</h3>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '14px 16px', border: '1px solid var(--border-color)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(29,95,224,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={17} color="#1D5FE0" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{detectarNavegador()} · Este dispositivo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#30D158' }} />
              <span style={{ fontSize: 11, color: '#30D158', fontWeight: 500 }}>Sesión actual</span>
            </div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#1D5FE0', background: 'rgba(29,95,224,0.1)', padding: '3px 8px', borderRadius: 20 }}>Actual</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleCerrarSesiones}
          disabled={cerrandoSesiones}
          style={{
            width: '100%', height: 40, borderRadius: 10,
            background: 'rgba(255,59,48,0.06)', color: '#FF3B30',
            border: '1px solid rgba(255,59,48,0.15)',
            fontSize: 13, fontWeight: 500, cursor: cerrandoSesiones ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            opacity: cerrandoSesiones ? 0.6 : 1,
          }}
        >
          <LogOut size={14} /> {cerrandoSesiones ? 'Cerrando sesiones...' : 'Cerrar todas las sesiones'}
        </motion.button>
      </div>
    </>
  )
}

// ── Sección Equipo (inline) ────────────────────────────────────────────────────

function SeccionEquipo({ org }) {
  const { loading, miembros, esOwner, crearInvitacion } = org

  const [invitando, setInvitando] = useState(false)
  const [errorInvitacion, setErrorInvitacion] = useState(null)
  const [linkInvitacion, setLinkInvitacion] = useState(null)
  const [copiado, setCopiado] = useState(false)

  const handleInvitar = async () => {
    setInvitando(true)
    setErrorInvitacion(null)
    try {
      const { token } = await crearInvitacion()
      setLinkInvitacion(`${window.location.origin}/invitacion/${token}`)
    } catch (err) {
      setErrorInvitacion(err.message || 'No se pudo crear la invitación')
    }
    setInvitando(false)
  }

  const handleCopiar = async () => {
    if (!linkInvitacion) return
    try {
      await navigator.clipboard.writeText(linkInvitacion)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      {!loading && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} color="#1D5FE0" /> Miembros del equipo
          </h3>
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-color)', overflow: 'hidden', marginBottom: esOwner ? 14 : 0 }}>
            {miembros.map((m, i) => (
              <div
                key={m.user_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: i < miembros.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: '#1D5FE0', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 600, flexShrink: 0,
                }}>
                  {(m.email || '?').charAt(0).toUpperCase()}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{m.email}</span>
                {m.rol === 'owner' && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#1D5FE0', background: 'rgba(29,95,224,0.1)', padding: '3px 8px', borderRadius: 20 }}>
                    Owner
                  </span>
                )}
              </div>
            ))}
          </div>

          {esOwner && (
            <div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleInvitar}
                disabled={invitando}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  width: '100%', height: 40, borderRadius: 10,
                  background: 'rgba(29,95,224,0.08)', color: '#1D5FE0',
                  border: 'none', fontSize: 13, fontWeight: 500,
                  cursor: invitando ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  opacity: invitando ? 0.6 : 1,
                }}
              >
                <Users size={14} /> {invitando ? 'Generando enlace...' : 'Invitar miembro'}
              </motion.button>

              {errorInvitacion && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#FF3B30' }}>{errorInvitacion}</div>
              )}

              {linkInvitacion && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <TextInput value={linkInvitacion} readOnly />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopiar}
                    style={{
                      padding: '11px 14px', borderRadius: 10, whiteSpace: 'nowrap',
                      background: copiado ? 'rgba(52,199,89,0.12)' : 'var(--bg-secondary)',
                      color: copiado ? '#30D158' : 'var(--text-primary)',
                      border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {copiado ? '¡Copiado!' : 'Copiar enlace'}
                  </motion.button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </motion.div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

// ── Tu IA ────────────────────────────────────────────────────────────────────
// En @Social la IA la pone cada usuario, de dos maneras y sin pedir nunca
// la contraseña de Claude ni de ChatGPT:
// - TarjetaConectaTuPlan: su Claude o su ChatGPT, con su plan, trabaja con los
//   datos de Aify por el MCP (docs/mcp.md): claude.ai, Claude Desktop y
//   ChatGPT con OAuth (solo la URL; AppsConectadas, /api/oauth-mcp) y Claude
//   Code con una clave aify_ (/api/claves-api).
// - TarjetaClaveApi: su clave de API de Claude o de Gemini, que usan los
//   botones de IA de la app (/api/ia/clave, 0043 + 0053). El servidor la
//   prueba, la cifra y solo devuelve sus últimos 4 caracteres.

const PROVEEDORES_TU_IA = [
  {
    id: 'anthropic', nombre: 'Claude', placeholder: 'Pega aquí tu clave de Claude (sk-ant-…)',
    ayuda: 'Cómo sacar tu clave de Claude',
    enlace: { url: 'https://console.anthropic.com/settings/keys', texto: 'la consola de Anthropic' },
    pasos: [
      'Pulsa «Create Key» (Crear clave), ponle un nombre y cópiala: solo se ve una vez.',
      'Tu cuenta de Anthropic necesita saldo (Billing): lo que gaste Aify se cobra ahí.',
      'Pégala aquí y pulsa «Guardar y probar».',
    ],
  },
  {
    id: 'gemini', nombre: 'Gemini', placeholder: 'Pega aquí tu clave de Gemini',
    ayuda: 'Cómo sacar tu clave gratis',
    enlace: { url: 'https://aistudio.google.com/app/apikey', texto: 'Google AI Studio' },
    pasos: [
      'Pulsa «Create API key» (Crear clave de API) y elige o crea un proyecto.',
      'Copia la clave entera, pégala aquí y pulsa «Guardar y probar».',
    ],
  },
]

const tarjetaTuIa = {
  background: 'var(--bg-card)', borderRadius: 20,
  boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid var(--border-subtle)',
  padding: '16px 22px 18px', marginTop: 12,
}

function SeccionTuIa({ org, onGuardado }) {
  const ref = useRef(null)

  // Desde el aviso «Conecta tu IA» se llega con #tu-ia
  useEffect(() => {
    if (window.location.hash === '#tu-ia') ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <motion.div
      ref={ref}
      id="tu-ia"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      style={{ maxWidth: 680, marginTop: 28, scrollMarginTop: 16 }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px', margin: 0 }}>Tu IA</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>
        @Social es gratis: la IA la pones tú. Conecta tu Claude o tu ChatGPT con tu plan, o añade tu clave de API para los botones de IA. Aify nunca te pide la contraseña de Claude ni de ChatGPT.
      </p>
      <TarjetaConectaTuPlan onGuardado={onGuardado} />
      <TarjetaClaveApi org={org} onGuardado={onGuardado} />
    </motion.div>
  )
}

function FilaClaveIa({ proveedor, org, onGuardado }) {
  const [estado, setEstado] = useState(null) // { tiene, ultimos4, verificada_en, sinMigracion } o { error }
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [trabajando, setTrabajando] = useState(null) // 'guardar' | 'probar' | 'quitar'
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)

  useEffect(() => {
    let vivo = true
    obtenerClaveIa(proveedor.id)
      .then(data => { if (vivo) setEstado(data) })
      .catch(err => { if (vivo) setEstado({ error: err.message }) })
    return () => { vivo = false }
  }, [proveedor.id])

  const puedeEditar = !org.loading && org.esOwner && estado && !estado.error && !estado.sinMigracion

  const accion = async (tipo, fn) => {
    setTrabajando(tipo)
    setError(null)
    setAviso(null)
    try {
      setEstado(await fn())
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setTrabajando(null)
    }
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (!puedeEditar || trabajando || !clave.trim()) return
    if (await accion('guardar', () => guardarClaveIa(proveedor.id, clave.trim()))) {
      setClave('')
      onGuardado?.()
    }
  }

  const probar = async () => {
    if (!estado?.tiene || trabajando) return
    if (await accion('probar', () => probarClaveIa(proveedor.id))) setAviso(`Tu clave de ${proveedor.nombre} funciona.`)
  }

  const quitar = async () => {
    if (!puedeEditar || trabajando) return
    if (await accion('quitar', () => quitarClaveIa(proveedor.id))) onGuardado?.()
  }

  let nota = 'Se guarda cifrada y nunca se vuelve a mostrar entera.'
  if (estado?.sinMigracion) nota = 'Falta actualizar la base de datos para guardar tu clave de IA (migración 0043).'
  else if (estado?.error) nota = estado.error
  else if (!org.loading && !org.esOwner) nota = 'Solo el propietario de la organización puede cambiar las claves.'

  const boton = { padding: '9px 16px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{proveedor.nombre}</div>

      {!estado ? (
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '8px 0 0' }}>Comprobando…</p>
      ) : estado.tiene ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8, padding: '10px 14px', borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <Check size={15} color="#30A46C" strokeWidth={2.5} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Conectada · ****{estado.ultimos4}</div>
            {estado.verificada_en && (
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1 }}>
                Probada el {new Date(estado.verificada_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>
          <button type="button" onClick={probar} disabled={!!trabajando}
            style={{ ...boton, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: trabajando ? 'wait' : 'pointer' }}>
            {trabajando === 'probar' ? 'Probando…' : 'Probar'}
          </button>
          <button type="button" onClick={quitar} disabled={!puedeEditar || !!trabajando}
            style={{ ...boton, background: 'rgba(255,59,48,0.08)', color: '#FF3B30', cursor: !puedeEditar ? 'not-allowed' : trabajando ? 'wait' : 'pointer', opacity: !puedeEditar ? 0.6 : 1 }}>
            {trabajando === 'quitar' ? 'Quitando…' : 'Quitar'}
          </button>
        </div>
      ) : (
        <form onSubmit={guardar} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <input
              type={verClave ? 'text' : 'password'}
              value={clave}
              onChange={e => setClave(e.target.value)}
              placeholder={proveedor.placeholder}
              autoComplete="off"
              spellCheck={false}
              disabled={!puedeEditar || !!trabajando}
              aria-label={`Clave de la API de ${proveedor.nombre}`}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 38px 9px 12px', borderRadius: 10, border: '1px solid var(--border-color)', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            />
            <button type="button" onClick={() => setVerClave(v => !v)} aria-label={verClave ? 'Ocultar clave' : 'Ver clave'}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}>
              {verClave ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button type="submit" disabled={!puedeEditar || !!trabajando || !clave.trim()}
            style={{ ...boton, background: '#1D5FE0', color: 'white', cursor: !puedeEditar || !clave.trim() ? 'not-allowed' : trabajando ? 'wait' : 'pointer', opacity: !puedeEditar || !clave.trim() ? 0.5 : 1 }}>
            {trabajando === 'guardar' ? 'Probando…' : 'Guardar y probar'}
          </button>
        </form>
      )}

      <p style={{ fontSize: 12, margin: '8px 0 0', color: error ? '#FF3B30' : aviso ? '#30A46C' : 'var(--text-tertiary)', lineHeight: 1.45 }}>
        {error || aviso || nota}
      </p>

      <button type="button" onClick={() => setAyudaAbierta(a => !a)} aria-expanded={ayudaAbierta}
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#1D5FE0', fontFamily: 'inherit' }}>
        <HelpCircle size={13} /> {proveedor.ayuda}
        {ayudaAbierta ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {ayudaAbierta && (
        <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li>
            Entra en{' '}
            <a href={proveedor.enlace.url} target="_blank" rel="noreferrer" style={{ color: '#1D5FE0', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {proveedor.enlace.texto} <ExternalLink size={11} />
            </a>{' '}
            con tu cuenta.
          </li>
          {proveedor.pasos.map(p => <li key={p}>{p}</li>)}
        </ol>
      )}
    </div>
  )
}

function TarjetaClaveApi({ org, onGuardado }) {
  return (
    <div style={tarjetaTuIa}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(48,209,88,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <KeyRound size={17} color="#30A46C" strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Tu clave de API</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Claude o Gemini. La usan los botones de IA de Aify y lo que gasten lo paga tu cuenta. Con las dos, si una falla se usa la otra.</div>
        </div>
      </div>
      {PROVEEDORES_TU_IA.map(p => <FilaClaveIa key={p.id} proveedor={p} org={org} onGuardado={onGuardado} />)}
    </div>
  )
}

// Apps conectadas con OAuth (claude.ai, Claude Desktop, ChatGPT): cada una
// actúa en nombre de quien pulsó «Permitir» (/api/oauth-mcp/apps).
function AppsConectadas() {
  const esMovil = useEsMovil()
  const [estado, setEstado] = useState(null) // { apps, sinMigracion } o { error }
  const [quitando, setQuitando] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vivo = true
    listarAppsConectadas()
      .then(data => { if (vivo) setEstado(data) })
      .catch(err => { if (vivo) setEstado({ error: err.message }) })
    return () => { vivo = false }
  }, [])

  const desconectar = async (id) => {
    if (quitando) return
    setQuitando(id)
    setError(null)
    try {
      await desconectarApp(id)
      setEstado(s => ({ ...s, apps: s.apps.filter(a => a.id !== id) }))
    } catch (err) {
      setError(err.message)
    } finally {
      setQuitando(null)
    }
  }

  if (!estado || estado.error || estado.sinMigracion || !estado.apps?.length) {
    if (!estado?.sinMigracion) return null
    return <p style={{ fontSize: 12, margin: '10px 0 0', color: 'var(--text-tertiary)' }}>Falta aplicar la migración 0055 para conectar con OAuth.</p>
  }

  const fecha = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Apps conectadas</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {estado.apps.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <Plug size={15} color="#86868B" strokeWidth={2} />
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{a.nombre}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1 }}>
                {a.ultimo_uso_en ? `Último uso el ${fecha(a.ultimo_uso_en)}` : 'Sin usar todavía'} · Conectada el {fecha(a.conectada_en)}
              </div>
            </div>
            <button type="button" onClick={() => desconectar(a.id)} disabled={!!quitando}
              style={{ padding: '9px 16px', minHeight: esMovil ? 44 : undefined, borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap', background: 'rgba(255,59,48,0.08)', color: '#FF3B30', cursor: quitando ? 'wait' : 'pointer' }}>
              {quitando === a.id ? 'Desconectando…' : 'Desconectar'}
            </button>
          </div>
        ))}
      </div>
      {error && <p style={{ fontSize: 12, margin: '8px 0 0', color: '#FF3B30' }}>{error}</p>}
    </div>
  )
}

// Conecta tu Claude o tu ChatGPT: claves aify_ para el MCP de Aify (server.js,
// /api/claves-api). Con ellas, la IA del usuario usa Aify con su propio plan.
function TarjetaConectaTuPlan({ onGuardado }) {
  const esMovil = useEsMovil()
  const [estado, setEstado] = useState(null) // { claves, sinMigracion } o { error }
  const [nombre, setNombre] = useState('')
  const [nueva, setNueva] = useState(null) // { nombre, clave } recién creada: se enseña una sola vez
  const [copiada, setCopiada] = useState(false)
  const [comandoCopiado, setComandoCopiado] = useState(false)
  const [urlCopiada, setUrlCopiada] = useState(false)
  const [trabajando, setTrabajando] = useState(null) // 'crear' | id de la clave que se revoca
  const [error, setError] = useState(null)

  useEffect(() => {
    let vivo = true
    listarClavesApi()
      .then(data => { if (vivo) setEstado(data) })
      .catch(err => { if (vivo) setEstado({ error: err.message }) })
    return () => { vivo = false }
  }, [])

  const puedeEditar = estado && !estado.error && !estado.sinMigracion

  const crear = async (e) => {
    e.preventDefault()
    if (!puedeEditar || trabajando || !nombre.trim()) return
    setTrabajando('crear')
    setError(null)
    try {
      const { clave, claveEnClaro } = await crearClaveApi(nombre.trim())
      setEstado(s => ({ ...s, claves: [clave, ...(s.claves || [])] }))
      setNueva({ nombre: clave.nombre, clave: claveEnClaro })
      setCopiada(false)
      setComandoCopiado(false)
      setNombre('')
    } catch (err) {
      setError(err.message)
    } finally {
      setTrabajando(null)
    }
  }

  const revocar = async (id) => {
    if (!puedeEditar || trabajando) return
    setTrabajando(id)
    setError(null)
    try {
      await revocarClaveApi(id)
      setEstado(s => ({ ...s, claves: s.claves.filter(c => c.id !== id) }))
      onGuardado?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setTrabajando(null)
    }
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(nueva.clave)
      setCopiada(true)
    } catch { /* sin permiso de portapapeles: se puede seleccionar a mano */ }
  }

  const urlMcp = apiUrlAbsoluta('/mcp')
  const comandoClaude = `claude mcp add --transport http aify ${urlMcp} --header "Authorization: Bearer ${nueva ? nueva.clave : '<tu clave>'}"`
  const copiarUrl = async () => {
    try {
      await navigator.clipboard.writeText(urlMcp)
      setUrlCopiada(true)
    } catch { /* sin permiso de portapapeles: se puede seleccionar a mano */ }
  }
  const copiarComando = async () => {
    try {
      await navigator.clipboard.writeText(comandoClaude)
      setComandoCopiado(true)
    } catch { /* sin permiso de portapapeles: se puede seleccionar a mano */ }
  }

  let nota = 'Cada clave da acceso a los datos de tu organización. Revócala si dejas de usarla.'
  if (estado?.sinMigracion) nota = 'Falta aplicar la migración 0046 para crear claves de API.'
  else if (estado?.error) nota = estado.error

  const boton = { padding: '9px 16px', minHeight: esMovil ? 44 : undefined, borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }
  const fecha = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={tarjetaTuIa}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(29,95,224,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Plug size={17} color="#1D5FE0" strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Conecta tu Claude o tu ChatGPT (con tu plan)</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Tu IA trabaja con tus clientes, ideas, guiones, calendario y pizarras de Aify, con tu plan de Claude o de ChatGPT.</div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Conectar con claude.ai, Claude Desktop o ChatGPT</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>No hace falta clave: solo esta dirección.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <code style={{ flex: '1 1 260px', minWidth: 0, padding: '9px 12px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-primary)', overflowWrap: 'anywhere', userSelect: 'all' }}>
            {urlMcp}
          </code>
          <button type="button" onClick={copiarUrl}
            style={{ ...boton, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
            {urlCopiada ? <Check size={14} /> : <Copy size={14} />} {urlCopiada ? 'Copiada' : 'Copiar'}
          </button>
        </div>
        <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li>claude.ai o Claude Desktop: Ajustes, Conectores, «Añadir conector personalizado». Ponle de nombre Aify y pega la dirección.</li>
          <li>ChatGPT: Ajustes, Aplicaciones y conectores, «Crear» (si no lo ves, activa el modo desarrollador en Configuración avanzada; depende de tu plan). Pega la dirección y elige OAuth.</li>
          <li>Se abre Aify: inicia sesión con tu cuenta y pulsa «Permitir». Ya está.</li>
        </ol>
        <AppsConectadas />
      </div>

      {nueva && (
        <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.25)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Clave «{nueva.nombre}» creada</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <code style={{ flex: '1 1 220px', minWidth: 0, padding: '9px 12px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', fontSize: 12.5, color: 'var(--text-primary)', overflowWrap: 'anywhere', userSelect: 'all' }}>
              {nueva.clave}
            </code>
            <button type="button" onClick={copiar}
              style={{ ...boton, display: 'flex', alignItems: 'center', gap: 6, background: '#1D5FE0', color: 'white', cursor: 'pointer' }}>
              {copiada ? <Check size={14} /> : <Copy size={14} />} {copiada ? 'Copiada' : 'Copiar'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#B25E00' }}>
            <AlertCircle size={13} /> No se volverá a mostrar. Cópiala ahora y guárdala en un sitio seguro.
          </div>
          <button type="button" onClick={() => setNueva(null)}
            style={{ marginTop: 6, padding: 0, minHeight: esMovil ? 44 : undefined, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#1D5FE0', fontFamily: 'inherit' }}>
            Ya la he guardado
          </button>
        </div>
      )}

      {!estado ? (
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '14px 0 0' }}>Comprobando…</p>
      ) : estado.claves?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {estado.claves.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <KeyRound size={15} color="#86868B" strokeWidth={2} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{c.nombre} · aify_…{c.ultimos4}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1 }}>
                  {c.ultimo_uso_en ? `Último uso el ${fecha(c.ultimo_uso_en)}` : 'Sin usar todavía'} · Creada el {fecha(c.creada_en)}
                </div>
              </div>
              <button type="button" onClick={() => revocar(c.id)} disabled={!!trabajando}
                style={{ ...boton, background: 'rgba(255,59,48,0.08)', color: '#FF3B30', cursor: trabajando ? 'wait' : 'pointer' }}>
                {trabajando === c.id ? 'Revocando…' : 'Revocar'}
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={crear} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Nombre de la clave (p. ej., Claude Code del Mac)"
          maxLength={80}
          disabled={!puedeEditar || !!trabajando}
          aria-label="Nombre de la clave de API"
          style={{ flex: '1 1 240px', minWidth: 0, boxSizing: 'border-box', padding: '9px 12px', minHeight: esMovil ? 44 : undefined, borderRadius: 10, border: '1px solid var(--border-color)', fontSize: esMovil ? 16 : 13, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        />
        <button type="submit" disabled={!puedeEditar || !!trabajando || !nombre.trim()}
          style={{ ...boton, background: '#1D5FE0', color: 'white', cursor: !puedeEditar || !nombre.trim() ? 'not-allowed' : trabajando ? 'wait' : 'pointer', opacity: !puedeEditar || !nombre.trim() ? 0.5 : 1 }}>
          {trabajando === 'crear' ? 'Creando…' : 'Crear clave'}
        </button>
      </form>

      <p style={{ fontSize: 12, margin: '10px 0 0', color: error ? '#FF3B30' : 'var(--text-tertiary)', lineHeight: 1.45 }}>
        {error || nota}
      </p>

      <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Conectar con Claude Code (con clave)</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Pega este comando en la terminal{nueva ? ' (ya lleva tu clave nueva)' : ', cambiando <tu clave> por la clave que crees'}:</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <code style={{ flex: '1 1 260px', minWidth: 0, padding: '9px 12px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-primary)', overflowWrap: 'anywhere', userSelect: 'all' }}>
            {comandoClaude}
          </code>
          <button type="button" onClick={copiarComando}
            style={{ ...boton, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
            {comandoCopiado ? <Check size={14} /> : <Copy size={14} />} {comandoCopiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

    </div>
  )
}

// ── Cobro (0026_modo_cobro.sql) ──────────────────────────────────────────────
// Modo de cobro por defecto de la organización. Cada cliente puede cambiarlo
// en su ficha (pestaña Facturación).

function SeccionCobro({ org, onGuardado }) {
  const [guardando, setGuardando] = useState(null) // id de la opción que se guarda
  const [error, setError] = useState(null)
  const bloqueado = org.loading || !org.organizacion || !org.esOwner || !org.modoCobroDisponible

  const elegir = async (modo) => {
    if (bloqueado || guardando || modo === org.modoCobro) return
    setGuardando(modo)
    setError(null)
    const { error: err } = await org.actualizarModoCobro(modo)
    setGuardando(null)
    if (err) { setError(err); return }
    onGuardado?.()
  }

  let nota = 'Cada cliente puede tener su propio modo en su ficha, pestaña Facturación.'
  if (!org.loading && org.organizacion && !org.modoCobroDisponible) nota = 'Falta actualizar la base de datos para elegir el modo de cobro (migración 0026).'
  else if (!org.loading && org.organizacion && !org.esOwner) nota = 'Solo el propietario de la organización puede cambiarlo.'

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      style={{ maxWidth: 680, marginTop: 16 }}
    >
      <div style={{
        background: 'var(--bg-card)', borderRadius: 20,
        boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid var(--border-subtle)',
        padding: '16px 22px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(29,95,224,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wallet size={17} color="#1D5FE0" strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Cobro</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Cuándo sale la factura mensual de tus clientes</div>
          </div>
        </div>

        <div role="radiogroup" aria-label="Modo de cobro" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 4, marginTop: 14,
          background: 'var(--bg-secondary)', borderRadius: 12, padding: 4, border: '1px solid var(--border-subtle)',
          opacity: bloqueado && !org.loading ? 0.6 : 1,
        }}>
          {OPCIONES_MODO_COBRO.map(o => {
            const activa = org.modoCobroDisponible && org.modoCobro === o.id
            return (
              <button
                key={o.id} role="radio" aria-checked={activa}
                onClick={() => elegir(o.id)}
                disabled={bloqueado || !!guardando}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                  padding: '9px 14px', borderRadius: 9, border: 'none', textAlign: 'left',
                  cursor: bloqueado ? 'not-allowed' : guardando ? 'wait' : 'pointer', fontFamily: 'inherit',
                  background: activa ? 'var(--bg-card)' : 'transparent',
                  boxShadow: activa ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: activa ? '#1D5FE0' : 'var(--text-primary)' }}>
                  {activa && <Check size={13} strokeWidth={2.5} />}
                  {guardando === o.id ? 'Guardando…' : o.label}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{o.desc}</span>
              </button>
            )
          })}
        </div>

        <p style={{ fontSize: 12, margin: '10px 0 0', color: error ? '#FF3B30' : 'var(--text-tertiary)', lineHeight: 1.45 }}>
          {error || nota}
        </p>
      </div>
    </motion.div>
  )
}

export default function Configuracion() {
  const { user } = useAuth()
  const esMovil = useEsMovil()
  const navigate = useNavigate()
  const { limpiarCache } = useAppContext()
  const org = useOrganizacion()

  const handleReconfigurar = () => {
    if (window.confirm('¿Quieres volver a configurar tu experiencia en Aify? Esto no afecta a tus clientes ni contenido.')) {
      resetOnboarding(user?.id)
      navigate('/onboarding')
    }
  }
  const [panel, setPanel] = useState(null)
  const [equipoOpen, setEquipoOpen] = useState(false)
  const [toast, setToast] = useState(false)
  const [toastMsg, setToastMsg] = useState('Cambios guardados')

  const [perfil, setPerfil] = useState(() => {
    // aify_perfil es una única clave global en este navegador — con el
    // selector de cuentas, puede quedar cacheada de OTRA cuenta ya usada
    // aquí. Solo se usa si su email coincide con la sesión realmente activa.
    try {
      const s = localStorage.getItem('aify_perfil')
      const parsed = s ? JSON.parse(s) : null
      if (parsed && parsed.email && parsed.email === user?.email) return parsed
    } catch { /* ignore */ }
    return {
      nombre: user?.user_metadata?.nombre || '',
      email: user?.email || '',
      agencia: '',
      pais: 'España',
      idioma: 'Español',
      avatarColor: '#1D5FE0',
    }
  })

  const showToast = () => {
    setToastMsg('Cambios guardados')
    setToast(true)
    setTimeout(() => setToast(false), 3000)
  }

  const handleSavePerfil = (form) => {
    setPerfil(form)
    localStorage.setItem('aify_perfil', JSON.stringify(form))
    setPanel(null)
    showToast()
  }

  const secciones = [
    { id: 'perfil', icon: User, color: '#1D5FE0', label: 'Perfil', desc: `${perfil.nombre || user?.email?.split('@')[0] || 'Sin nombre'} · ${user?.email || ''}` },
    { id: 'equipo', icon: Users, color: '#30D158', label: 'Equipo', desc: org.loading ? 'Cargando equipo...' : `${org.miembros.length} miembro${org.miembros.length === 1 ? '' : 's'}` },
    { id: 'seguridad', icon: Shield, color: '#FF2D55', label: 'Seguridad', desc: 'Contraseña y autenticación' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      className={esMovil ? 'pagina-movil' : undefined}
      style={{ padding: esMovil ? '20px 16px' : '36px 40px', flex: 1, overflowY: 'auto' }}
    >
      <Toast visible={toast} mensaje={toastMsg} />

      <div style={{ maxWidth: 680 }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: esMovil ? 26 : 32, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.8px' }}>Configuración</h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 4 }}>Gestiona tu cuenta y preferencias de Aify</p>
        </div>

        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}
          style={{
            background: 'var(--bg-card)', borderRadius: 20, padding: '22px 24px',
            boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid var(--border-subtle)',
            marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16,
          }}
        >
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: perfil.avatarColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: 'white', flexShrink: 0,
            boxShadow: `0 4px 16px ${perfil.avatarColor}40`,
          }}>
            {(perfil.nombre || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              {perfil.nombre || user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Sin nombre'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{user?.email}</div>
          </div>
          <motion.button
            whileHover={{ backgroundColor: 'rgba(0,0,0,0.08)' }} whileTap={{ scale: 0.97 }}
            onClick={() => setPanel('perfil')}
            style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--bg-secondary)', border: 'none', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Editar
          </motion.button>
        </motion.div>

        {/* Settings list */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.12 }}
          style={{ background: 'var(--bg-card)', borderRadius: 20, boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}
        >
          {secciones.map((s, i) => (
            <div key={s.id}>
              <motion.div
                whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                whileTap={{ scale: 0.998 }}
                onClick={() => s.id === 'equipo' ? setEquipoOpen(p => !p) : setPanel(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 22px', cursor: 'pointer',
                  borderBottom: (i < secciones.length - 1 && !(s.id === 'equipo' && equipoOpen))
                    ? '1px solid rgba(0,0,0,0.05)' : 'none',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <s.icon size={17} color={s.color} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{s.desc}</div>
                </div>
                {s.id === 'equipo'
                  ? (equipoOpen ? <ChevronUp size={15} color="#86868B" /> : <ChevronDown size={15} color="#86868B" />)
                  : <ChevronRight size={15} color="#86868B" />
                }
              </motion.div>

              <AnimatePresence>
                {s.id === 'equipo' && equipoOpen && (
                  <motion.div
                    key="equipo"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                    style={{ overflow: 'hidden', borderBottom: i < secciones.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}
                  >
                    <div style={{ padding: '4px 22px 24px' }}>
                      <SeccionEquipo org={org} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </motion.div>
      </div>

      <SeccionCobro org={org} onGuardado={showToast} />
      <SeccionTuIa org={org} onGuardado={showToast} />
      <SeccionProceso esOwner={org.esOwner} onGuardado={showToast} />

      {/* Storage section */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.12 }}
        style={{ maxWidth: 680, marginTop: 16 }}
      >
        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 22px' }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(134,134,139,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <HardDrive size={17} color="#86868B" strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Almacenamiento local</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Calendarios, copies y guiones guardados en este navegador</div>
            </div>
            <motion.button
              whileHover={{ backgroundColor: 'rgba(255,59,48,0.08)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { limpiarCache(); showToast() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 10,
                background: 'rgba(255,59,48,0.06)', color: '#FF3B30',
                border: '1px solid rgba(255,59,48,0.15)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Trash2 size={13} /> Limpiar caché
            </motion.button>
          </div>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px' }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(134,134,139,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <RefreshCw size={15} color="#86868B" strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Reconfigurar Aify</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Vuelve a pasar por el proceso de configuración inicial</div>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleReconfigurar}
              style={{
                padding: '7px 14px', borderRadius: 10,
                background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                border: 'none', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Reconfigurar
            </motion.button>
          </div>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px' }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(29,95,224,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <HelpCircle size={17} color="#1D5FE0" strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Ver tutorial de nuevo</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Repasa el flujo principal de Aify desde el principio</div>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { resetTutorial(user?.id); window.location.reload() }}
              style={{
                padding: '7px 14px', borderRadius: 10,
                background: 'rgba(29,95,224,0.08)', color: '#1D5FE0',
                border: 'none', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Ver tutorial
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Panels */}
      <PanelLateral open={panel === 'perfil'} onClose={() => setPanel(null)} titulo="Editar perfil">
        <PanelPerfil perfil={perfil} onSave={handleSavePerfil} onClose={() => setPanel(null)} />
      </PanelLateral>

      <PanelLateral open={panel === 'seguridad'} onClose={() => setPanel(null)} titulo="Seguridad">
        <PanelSeguridad onSave={() => { setPanel(null); showToast() }} />
      </PanelLateral>
    </motion.div>
  )
}
