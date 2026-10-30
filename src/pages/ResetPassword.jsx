import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Lock, Zap, CheckCircle2 } from 'lucide-react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'

const inputStyle = (focused) => ({
  width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12,
  border: `1.5px solid ${focused ? 'var(--accent-blue)' : 'var(--border-color)'}`,
  fontSize: 15, fontFamily: 'inherit', outline: 'none',
  color: 'var(--text-primary)', background: 'var(--bg-card)',
  transition: 'border 0.2s', boxSizing: 'border-box',
})

export default function ResetPassword() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [focused, setFocused] = useState(null)

  // Supabase's recovery link signs the user in automatically (detectSessionInUrl).
  // If there's no session by the time this renders, the link was invalid/expired.
  const validLink = !!user

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }

    setLoading(true)
    try {
      if (!supabase) throw new Error('Supabase no configurado')
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setDone(true)
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la contraseña')
    }
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg-secondary)', padding: 16,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          background: 'var(--bg-card)', borderRadius: 22, padding: '44px 40px',
          width: 440, maxWidth: 'calc(100vw - 32px)',
          boxShadow: 'var(--shadow-lg)', boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg,#007BFF,#4DA3FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={16} color="white" />
          </div>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
            Aify
          </span>
        </div>

        {!validLink ? (
          <div style={{ textAlign: 'center', paddingTop: 12 }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
              Enlace no válido o caducado
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              Este enlace de restablecimiento ya no es válido. Solicita uno nuevo para continuar.
            </p>
            <motion.button
              onClick={() => navigate('/forgot-password')}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%', height: 48, borderRadius: 12,
                background: 'var(--accent-blue)', color: 'white',
                fontSize: 15, fontWeight: 600, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Solicitar nuevo enlace
            </motion.button>
          </div>
        ) : done ? (
          <div style={{ textAlign: 'center', paddingTop: 12 }}>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(48,209,88,0.1)', border: '2px solid rgba(48,209,88,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <CheckCircle2 size={32} color="#30D158" />
            </motion.div>
            <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Contraseña actualizada
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>
              Ya puedes continuar usando tu cuenta.
            </p>
            <motion.button
              onClick={() => navigate('/dashboard')}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%', height: 48, borderRadius: 12,
                background: 'var(--accent-blue)', color: 'white',
                fontSize: 15, fontWeight: 600, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Ir al panel
            </motion.button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 8, marginBottom: 28 }}>
              Crea una nueva contraseña
            </p>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Nueva contraseña
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: 12, color: 'var(--text-secondary)', display: 'flex', pointerEvents: 'none' }}>
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    style={inputStyle(focused === 'p')}
                    onFocus={() => setFocused('p')}
                    onBlur={() => setFocused(null)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Confirmar contraseña
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: 12, color: 'var(--text-secondary)', display: 'flex', pointerEvents: 'none' }}>
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repite la contraseña"
                    style={inputStyle(focused === 'c')}
                    onFocus={() => setFocused('c')}
                    onBlur={() => setFocused(null)}
                  />
                </div>
              </div>

              <motion.button
                type="submit"
                whileTap={{ scale: 0.98 }}
                disabled={loading || !password || !confirm}
                style={{
                  width: '100%', height: 48, borderRadius: 12,
                  background: password && confirm ? 'var(--accent-lime)' : 'var(--bg-hover)',
                  color: password && confirm ? '#0B0C10' : 'var(--text-tertiary)',
                  fontSize: 15, fontWeight: 600, border: 'none',
                  cursor: password && confirm && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'inherit', transition: 'background 0.2s',
                }}
              >
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(11,12,16,0.25)', borderTopColor: '#0B0C10' }}
                  />
                ) : 'Guardar contraseña'}
              </motion.button>

              {error && (
                <div style={{
                  background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)',
                  borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#FF3B30',
                  textAlign: 'center', marginTop: 12,
                }}>
                  {error}
                </div>
              )}
            </form>
          </>
        )}
      </motion.div>
    </div>
  )
}
