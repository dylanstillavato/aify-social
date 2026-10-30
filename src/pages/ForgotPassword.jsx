import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Mail, ArrowLeft, Zap } from 'lucide-react'
import { supabase } from '../services/supabase'

function SuccessState({ email, onBack }) {
  const [countdown, setCountdown] = useState(0)
  const [resending, setResending] = useState(false)
  const [resendOk, setResendOk] = useState(false)
  const [resendError, setResendError] = useState(null)

  const handleResend = async () => {
    if (countdown > 0 || resending) return
    setResending(true)
    setResendError(null)
    try {
      if (supabase) {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (err) throw err
      }
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ textAlign: 'center', paddingTop: 12 }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(29,95,224,0.1)', border: '2px solid rgba(29,95,224,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}
      >
        <Mail size={32} color="var(--accent-blue)" />
      </motion.div>

      <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.3px' }}>
        Revisa tu email
      </p>

      <div style={{
        background: 'rgba(29,95,224,0.06)', border: '1px solid rgba(29,95,224,0.15)',
        borderRadius: 14, padding: '16px 20px', marginBottom: 24, textAlign: 'left',
      }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>
          Email enviado a:
        </p>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
          {email}
        </p>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.6 }}>
        Sigue el enlace del email para crear una nueva contraseña. Si no lo ves, revisa tu carpeta de spam.
      </p>

      <motion.button
        onClick={onBack}
        whileHover={{ backgroundColor: 'var(--accent-blue-hover)' }}
        whileTap={{ scale: 0.98 }}
        style={{
          width: '100%', height: 48, borderRadius: 12,
          background: 'var(--accent-blue)', color: 'white',
          fontSize: 15, fontWeight: 600, border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <ArrowLeft size={16} />
        Volver al inicio de sesión
      </motion.button>

      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {resendOk && countdown > 0 ? (
          <span>Email reenviado. Puedes volver a enviar en <strong style={{ color: 'var(--text-primary)' }}>{countdown}s</strong></span>
        ) : (
          <span>
            ¿No recibiste el email?{' '}
            <motion.button
              onClick={handleResend}
              disabled={countdown > 0 || resending}
              whileHover={countdown === 0 && !resending ? { opacity: 0.75 } : {}}
              style={{
                background: 'none', border: 'none', padding: 0,
                color: countdown > 0 ? 'var(--text-tertiary)' : 'var(--accent-blue)',
                fontSize: 13, fontWeight: 500, cursor: countdown > 0 ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {resending ? 'Enviando...' : countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar'}
            </motion.button>
          </span>
        )}
        {resendError && (
          <div style={{ color: '#FF3B30', marginTop: 8 }}>{resendError}</div>
        )}
      </div>
    </motion.div>
  )
}

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [focused, setFocused] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError(null)
    try {
      if (supabase) {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (err) throw err
      }
      setSent(true)
    } catch (err) {
      setError(err.message || 'Error al enviar el email')
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
          boxShadow: 'var(--shadow-lg)',
          boxSizing: 'border-box',
        }}
      >
        {/* Logo */}
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

        {sent ? (
          <SuccessState email={email} onBack={() => navigate('/login')} />
        ) : (
          <>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 8, marginBottom: 28 }}>
              Restablece tu contraseña
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              Introduce tu email y te enviaremos un enlace para crear una nueva contraseña.
            </p>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Email
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: 12, color: 'var(--text-secondary)', display: 'flex', pointerEvents: 'none' }}>
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    style={{
                      width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12,
                      border: `1.5px solid ${focused ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                      fontSize: 15, fontFamily: 'inherit', outline: 'none',
                      color: 'var(--text-primary)', background: 'var(--bg-card)',
                      transition: 'border 0.2s', boxSizing: 'border-box',
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                  />
                </div>
              </div>

              <motion.button
                type="submit"
                whileHover={email ? { backgroundColor: 'var(--accent-lime-hover)' } : {}}
                whileTap={email ? { scale: 0.98 } : {}}
                disabled={loading || !email}
                style={{
                  width: '100%', height: 48, borderRadius: 12,
                  background: email ? 'var(--accent-lime)' : 'var(--bg-hover)',
                  color: email ? '#0B0C10' : 'var(--text-tertiary)',
                  fontSize: 15, fontWeight: 600, border: 'none',
                  cursor: email && !loading ? 'pointer' : 'not-allowed',
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
                ) : 'Enviar enlace'}
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

            <div
              onClick={() => navigate('/login')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, marginTop: 22, cursor: 'pointer',
                color: 'var(--accent-blue)', fontSize: 13, fontWeight: 500,
              }}
            >
              <ArrowLeft size={14} />
              Volver al inicio de sesión
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
