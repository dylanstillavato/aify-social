import { useState } from 'react'
import { Check, ArrowRight } from 'lucide-react'
import { supabase, hasSupabase } from '../../services/supabase'
import Marca from '../../components/Marca'

// ── Design tokens compartidos con Landing.jsx ───────────────────────────────
// Landing.jsx no exporta sus constantes, así que se duplican aquí a
// propósito (mismos valores exactos, verificados en Landing.jsx) en vez de
// inventar una paleta nueva — estas páginas deben sentirse parte del mismo
// sitio. Si algún día cambia la marca, actualizar en los dos sitios.

export const SKY_DEEP = '#1D5FE0'
export const SKY_MID = '#4C93FF'
export const SKY_LIGHT = '#8FC2FF'
export const LIME = '#D7FF3D'
export const LIME_DARK = '#BEE62A'

export const INK = '#0B0C10'
export const INK_SOFT = '#5B5D66'
export const INK_FAINT = '#9A9CA5'

export const SURFACE = '#FFFFFF'
export const SURFACE_ALT = '#F3F5EF'
export const CARD = '#FFFFFF'

export const GREEN = '#2FBE6B'
export const RED = '#E5484D'
export const ORANGE = '#FF9500'

export const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'

export const WHATSAPP_URL = 'https://wa.me/qr/R3OO6V7RFO4XO1'
export const CONTACT_EMAIL = 'hola@useaify.app'
export const SIGNUP_URL = '/login?tab=registro'

// ── Chrome (navbar/footer) sin hooks de router/auth ─────────────────────────
// A propósito NO usan useAuth()/useNavigate(): son páginas públicas de
// captación, no se personalizan por sesión, y evitar esos hooks es lo que
// permite prerenderizarlas sin envolverlas en AuthProvider/StaticRouter (ver
// entry-prerender.jsx). Enlaces con <a href> normal en vez de navigate().

export function MarketingNavbar() {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px) saturate(160%)', WebkitBackdropFilter: 'blur(14px) saturate(160%)', borderBottom: '1px solid rgba(11,11,15,0.07)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <Marca tamano={17} />
        </a>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/login" style={{ padding: '8px 14px', borderRadius: 20, fontSize: 13.5, fontWeight: 500, color: INK_SOFT, textDecoration: 'none', fontFamily: FONT }}>
            Iniciar sesión
          </a>
          <a href="/" style={{ padding: '8px 18px', borderRadius: 20, background: LIME, fontSize: 13.5, fontWeight: 700, color: INK, textDecoration: 'none', fontFamily: FONT }}>
            Ver Aify
          </a>
        </div>
      </div>
    </div>
  )
}

export function MarketingFooter() {
  return (
    <footer style={{ background: INK, padding: '48px 24px 36px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <Marca oscuro tamano={15} />
        </a>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>© 2026 Aify · En fase beta</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {[['Blog', '/blog'], ['Privacidad', '/privacidad'], ['Términos', '/terminos'], ['Cookies', '/cookies']].map(([label, href]) => (
            <a key={href} href={href} style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>{label}</a>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>{CONTACT_EMAIL}</a>
        </div>
      </div>
    </footer>
  )
}

// ── Captura de email (lead magnet) ──────────────────────────────────────────
// Aify es self-serve (sin invite-code) — este formulario NO sustituye al
// registro, es para piezas de contenido gratuito (ej. la checklist) donde
// tiene sentido pedir solo el email antes de dar el contenido, igual que
// hace cualquier lead magnet (ver supabase/migrations/0016_waitlist_emails.sql).
// Degrada con gracia si Supabase no está configurado (!hasSupabase(), pasa
// hoy en local sin env vars) — sigue mostrando el formulario en vez de
// crashear, y ofrece un contacto alternativo.
export function WaitlistForm({ origen, ctaLabel = 'Apuntarme', placeholder = 'tu@email.com' }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error | unavailable
  const [errorMsg, setErrorMsg] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    if (status === 'loading') return
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@') || trimmed.length < 5) {
      setStatus('error')
      setErrorMsg('Escribe un email válido.')
      return
    }
    if (!hasSupabase()) {
      console.error('[Waitlist] Supabase no configurado — no se pudo guardar el email de', origen)
      setStatus('unavailable')
      return
    }
    setStatus('loading')
    try {
      const { error } = await supabase.from('waitlist_emails').insert({ email: trimmed, origen })
      if (error) throw error
      setStatus('success')
    } catch (err) {
      console.error('[Waitlist] insert falló:', err.message)
      setStatus('error')
      setErrorMsg('No se pudo guardar tu email. Escríbenos directamente, abajo tienes el contacto.')
    }
  }

  if (status === 'success') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderRadius: 14, background: `${GREEN}15`, border: `1px solid ${GREEN}40` }}>
        <Check size={18} color={GREEN} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 15, color: INK, fontWeight: 600 }}>Apuntado/a. En breve tendrás noticias nuestras.</span>
      </div>
    )
  }

  return (
    <div>
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          style={{ flex: '1 1 240px', padding: '13px 16px', borderRadius: 12, border: '1.5px solid rgba(11,11,15,0.15)', background: '#ffffff', fontSize: 15, fontFamily: FONT, color: INK, outline: 'none' }}
        />
        <button type="submit" disabled={status === 'loading'} style={{ padding: '13px 24px', borderRadius: 12, background: LIME, border: 'none', fontSize: 14.5, fontWeight: 700, color: INK, cursor: status === 'loading' ? 'not-allowed' : 'pointer', fontFamily: FONT, opacity: status === 'loading' ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          {status === 'loading' ? 'Enviando…' : ctaLabel} <ArrowRight size={15} />
        </button>
      </form>
      {status === 'error' && (
        <p style={{ fontSize: 13, color: RED, marginTop: 10 }}>{errorMsg}</p>
      )}
      {status === 'unavailable' && (
        <p style={{ fontSize: 13, color: INK_SOFT, marginTop: 10, lineHeight: 1.5 }}>
          Ahora mismo no podemos guardar tu email automáticamente — escríbenos a{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: SKY_DEEP, fontWeight: 600 }}>{CONTACT_EMAIL}</a> o por{' '}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{ color: SKY_DEEP, fontWeight: 600 }}>WhatsApp</a>.
        </p>
      )}
      <p style={{ fontSize: 12.5, color: INK_FAINT, marginTop: 10 }}>
        Sin spam. Solo te escribimos por esto, y puedes pedir que borremos tu email cuando quieras.{' '}
        <a href="/privacidad" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacidad</a>
      </p>
    </div>
  )
}

// CTA directa a crear cuenta (registro abierto, sin invite-code) — mismo
// cascarón visual que WaitlistCard pero con un botón-enlace en vez de un
// formulario de email. Úsala cuando el objetivo es "regístrate ya", no
// capturar un lead para contactar después (eso sigue siendo WaitlistCard).
export function SignupCard({ eyebrow, title, subtitle, ctaLabel = 'Crear cuenta gratis', dark = true }) {
  return (
    <div style={{
      borderRadius: 24, padding: '40px 36px', maxWidth: 640, margin: '0 auto', textAlign: 'center',
      background: dark ? INK : SURFACE_ALT,
      border: dark ? `1px solid ${INK}` : '1px solid rgba(11,11,15,0.06)',
    }}>
      {eyebrow && (
        <div style={{ fontSize: 12, fontWeight: 700, color: dark ? LIME : '#5A6B00', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>
          {eyebrow}
        </div>
      )}
      <h3 style={{ fontSize: 'clamp(22px, 3.4vw, 30px)', fontWeight: 700, color: dark ? 'white' : INK, letterSpacing: '-0.6px', lineHeight: 1.2, marginBottom: 12 }}>
        {title}
      </h3>
      {subtitle && (
        <p style={{ fontSize: 15.5, color: dark ? 'rgba(255,255,255,0.75)' : INK_SOFT, lineHeight: 1.6, marginBottom: 24 }}>
          {subtitle}
        </p>
      )}
      <a href={SIGNUP_URL} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 14, background: LIME, fontSize: 15.5, fontWeight: 700, color: INK, textDecoration: 'none', fontFamily: FONT }}>
        {ctaLabel} <ArrowRight size={16} />
      </a>
      <p style={{ fontSize: 12.5, color: dark ? 'rgba(255,255,255,0.45)' : INK_FAINT, marginTop: 14 }}>
        Sin invitación — gratis y de código abierto.
      </p>
    </div>
  )
}

// Cascarón visual reutilizado por las 3 páginas para el bloque de captura.
export function WaitlistCard({ origen, eyebrow, title, subtitle, ctaLabel, dark = true }) {
  return (
    <div style={{
      borderRadius: 24, padding: '40px 36px', maxWidth: 640, margin: '0 auto',
      background: dark ? INK : SURFACE_ALT,
      border: dark ? `1px solid ${INK}` : '1px solid rgba(11,11,15,0.06)',
    }}>
      {eyebrow && (
        <div style={{ fontSize: 12, fontWeight: 700, color: dark ? LIME : '#5A6B00', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>
          {eyebrow}
        </div>
      )}
      <h3 style={{ fontSize: 'clamp(22px, 3.4vw, 30px)', fontWeight: 700, color: dark ? 'white' : INK, letterSpacing: '-0.6px', lineHeight: 1.2, marginBottom: 12 }}>
        {title}
      </h3>
      {subtitle && (
        <p style={{ fontSize: 15.5, color: dark ? 'rgba(255,255,255,0.75)' : INK_SOFT, lineHeight: 1.6, marginBottom: 24 }}>
          {subtitle}
        </p>
      )}
      <WaitlistForm origen={origen} ctaLabel={ctaLabel} />
    </div>
  )
}

// CSS responsive compartido — mismo patrón de media queries que Landing.jsx.
export const MARKETING_CSS = `
  @media (max-width: 900px) {
    .marketing-2col { grid-template-columns: 1fr !important; }
  }
`
