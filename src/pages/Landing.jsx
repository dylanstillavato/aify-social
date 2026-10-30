import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import {
  Calendar, Edit3, Video, Download,
  Check, X, Play, User, Building2, ChevronDown,
  Menu as MenuIcon, ArrowRight, Camera, Briefcase, Music, Sparkles,
  FlaskConical, TrendingUp, Search,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Marca from '../components/Marca'
import { Reveal, Magnetic, BenefitRow, CalendarioMockup, GenericMockup, FloatingCard } from './marketing/piezasLanding'

// ── Design tokens ────────────────────────────────────────────────────────────
// Fixed palette, independent of the app's light/dark toggle — this is a public
// marketing page seen by signed-out visitors, so it shouldn't inherit a logged
// -in user's theme preference.

const SKY_DEEP = '#1D5FE0'
const SKY_MID = '#4C93FF'
const SKY_LIGHT = '#8FC2FF'
const LIME = '#D7FF3D'
const LIME_DARK = '#BEE62A'

const INK = '#0B0C10'
const INK_SOFT = '#5B5D66'
const INK_FAINT = '#9A9CA5'

const SURFACE = '#FFFFFF'
const SURFACE_ALT = '#F3F5EF'
const CARD = '#FFFFFF'

const GREEN = '#2FBE6B'
const RED = '#E5484D'

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'

// ── Data ──────────────────────────────────────────────────────────────────────

const TABS = [
  {
    id: 'calendario', label: 'Calendario IA', icon: Calendar,
    title: 'Calendarios completos en segundos',
    desc: 'Genera un mes entero de contenido adaptado a cada cliente, con copies listos para publicar y hashtags actualizados.',
    benefits: ['Adaptado al tono y sector de cada cliente', 'Detecta festivos y fechas especiales automáticamente', 'Frecuencia personalizada por red social', 'Listo para exportar y entregar'],
  },
  {
    id: 'copies', label: 'Copies por red', icon: Edit3,
    title: 'Copies que suenan humanos, no a IA',
    desc: 'Cada red tiene su propio lenguaje. Aify lo sabe y escribe diferente para Instagram, TikTok y WhatsApp.',
    benefits: ['3 variantes por generación para elegir', 'Adaptado al algoritmo de cada plataforma', 'Hashtags con rendimiento reciente', 'Tono de voz consistente con la marca'],
  },
  {
    id: 'guiones', label: 'Guiones virales', icon: Video,
    title: 'Guiones diseñados para el algoritmo',
    desc: 'Estructura de guion probada para Reels y TikTok, con gancho en los primeros 2 segundos, basado en tendencias del sector.',
    benefits: ['Gancho optimizado para los primeros 2 segundos', 'Texto en pantalla palabra por palabra', 'Audio sugerido en tendencia', 'Adaptado al sector y audiencia'],
  },
  {
    id: 'pdf', label: 'Exportación PDF', icon: Download,
    title: 'Entrega como una agencia premium',
    desc: 'PDFs con tu marca que puedes enviar directamente a tus clientes. Sin retocar, sin vergüenza.',
    benefits: ['Diseño profesional automático', 'Personalizado con nombre de tu agencia', 'Calendario, copies y guiones en PDF', 'Impresiona a tus clientes desde el día 1'],
  },
]

const FAQS = [
  { q: '¿Por qué está en fase beta?', a: 'Porque lo sigo construyendo activamente. Prefiero ser sincero: hay funciones a medio pulir y todavía va a cambiar bastante. Si lo pruebas ahora, tu opinión influye directamente en hacia dónde va.' },
  { q: '¿Necesito saber de IA o programación para usar Aify?', a: 'No. Aify está pensado para marketers, no para técnicos. Si sabes usar Instagram, sabes usar Aify.' },
  { q: '¿El contenido que genera suena a IA?', a: 'Depende de cómo configures el perfil de cada cliente — cuanto más detalle le des, más suena a esa marca y menos a IA genérica. Sigue siendo algo en lo que estamos mejorando.' },
  { q: '¿Puedo usar Aify para clientes de cualquier sector?', a: 'De momento está enfocado en marketing de contenidos para negocios locales (restauración, moda, fitness, belleza, retail, servicios...). Cuanto más detalle des del cliente, mejor sale el contenido.' },
  { q: '¿Qué pasa con mis datos si dejo de usarlo?', a: 'Puedes exportar todo lo que tengas guardado cuando quieras. Al estar en beta, mantén copia de lo importante — todavía no hay garantías de retención a largo plazo.' },
  { q: '¿Funciona para publicar directamente en redes sociales?', a: 'Todavía no. Por ahora Aify genera y exporta el contenido; la publicación automática es algo que quiero construir más adelante.' },
]

const WHATSAPP_URL = 'https://wa.me/qr/R3OO6V7RFO4XO1'

// ── GSAP helpers ─────────────────────────────────────────────────────────────

// ── Utility components ────────────────────────────────────────────────────────

function BetaBadge({ dark }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '6px 14px 6px 10px',
      background: dark ? 'rgba(255,255,255,0.14)' : `${LIME}22`,
      border: dark ? '1px solid rgba(255,255,255,0.22)' : `1px solid ${LIME_DARK}`,
    }}>
      <FlaskConical size={13} color={dark ? LIME : '#7A9400'} />
      <span style={{ fontSize: 13, fontWeight: 600, color: dark ? 'white' : '#5A6B00' }}>En fase beta — construyéndolo en abierto</span>
    </div>
  )
}

// ── Mini mockup visuals ───────────────────────────────────────────────────────

// ── Sections ──────────────────────────────────────────────────────────────────

function Navbar({ onLogin, onRegister, onApp, isLoggedIn }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const links = ['Producto', 'Nuestra historia', 'Gratis', 'Para agencias']
  return (
    <div style={{ position: 'fixed', top: 14, left: 0, right: 0, zIndex: 900, display: 'flex', justifyContent: 'center', padding: '0 16px', pointerEvents: 'none' }}>
      <div style={{
        width: '100%', maxWidth: scrolled ? 980 : 1160, transition: 'max-width 0.4s cubic-bezier(.25,.46,.45,.94), background 0.3s',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 10px 10px 18px', borderRadius: 20, pointerEvents: 'auto',
        background: scrolled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.14)',
        backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        border: scrolled ? '1px solid rgba(11,11,15,0.06)' : '1px solid rgba(255,255,255,0.3)',
        boxShadow: scrolled ? '0 8px 30px rgba(11,11,15,0.1)' : 'none',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Marca app="Social" oscuro={!scrolled} tamano={24} />
        </div>
        {/* Desktop nav */}
        <div className="landing-desktop-nav" style={{ display: 'flex', gap: 28 }}>
          {links.map(l => (
            <span key={l} style={{ fontSize: 13.5, color: scrolled ? INK_SOFT : 'rgba(255,255,255,0.85)', cursor: 'pointer', fontWeight: 400, transition: 'color 0.15s' }}
              onMouseEnter={e => e.target.style.color = scrolled ? INK : '#fff'}
              onMouseLeave={e => e.target.style.color = scrolled ? INK_SOFT : 'rgba(255,255,255,0.85)'}
            >{l}</span>
          ))}
          <a href="/demo" className="landing-otras-apps" style={{ fontSize: 13.5, color: scrolled ? INK_FAINT : 'rgba(255,255,255,0.65)', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
            Otras apps de Aify
          </a>
        </div>
        {/* CTA buttons */}
        <div className="landing-desktop-nav" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isLoggedIn ? (
            <motion.button whileHover={{ backgroundColor: LIME_DARK }} whileTap={{ scale: 0.97 }} onClick={onApp}
              style={{ padding: '8px 16px', borderRadius: 20, background: LIME, border: 'none', fontSize: 13.5, fontWeight: 700, color: INK, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6 }}>
              Ir a Aify <ArrowRight size={14} />
            </motion.button>
          ) : (
            <>
              <button onClick={onLogin} style={{ padding: '8px 14px', borderRadius: 20, border: 'none', background: 'transparent', fontSize: 13.5, fontWeight: 500, color: scrolled ? INK_SOFT : 'rgba(255,255,255,0.9)', cursor: 'pointer', fontFamily: FONT }}>
                Iniciar sesión
              </button>
              <motion.button whileHover={{ backgroundColor: LIME_DARK }} whileTap={{ scale: 0.97 }} onClick={onRegister}
                style={{ padding: '8px 18px', borderRadius: 20, background: LIME, border: 'none', fontSize: 13.5, fontWeight: 700, color: INK, cursor: 'pointer', fontFamily: FONT }}>
                Unirme a la beta
              </motion.button>
            </>
          )}
        </div>
        {/* Hamburger */}
        <button className="landing-mobile-nav" onClick={() => setMobileOpen(o => !o)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: scrolled ? INK : 'white', display: 'none', padding: 4 }}>
          <MenuIcon size={22} />
        </button>
      </div>
      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ position: 'absolute', top: 64, left: 16, right: 16, borderRadius: 18, padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14, pointerEvents: 'auto', background: 'white', boxShadow: '0 16px 48px rgba(11,11,15,0.16)' }}>
            {links.map(l => <span key={l} style={{ fontSize: 16, color: INK, cursor: 'pointer' }}>{l}</span>)}
            <a href="/demo" style={{ fontSize: 15, color: INK_SOFT, textDecoration: 'none' }}>Otras apps de Aify</a>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(11,11,15,0.08)' }}>
              {isLoggedIn ? (
                <button onClick={onApp} style={{ padding: '12px', borderRadius: 14, background: LIME, border: 'none', fontSize: 15, fontWeight: 700, color: INK, cursor: 'pointer', fontFamily: FONT }}>
                  Ir a Aify
                </button>
              ) : (
                <>
                  <button onClick={onLogin} style={{ padding: '12px', borderRadius: 14, border: '1.5px solid rgba(11,11,15,0.15)', background: 'none', fontSize: 15, fontWeight: 500, color: INK, cursor: 'pointer', fontFamily: FONT }}>
                    Iniciar sesión
                  </button>
                  <button onClick={onRegister} style={{ padding: '12px', borderRadius: 14, background: LIME, border: 'none', fontSize: 15, fontWeight: 700, color: INK, cursor: 'pointer', fontFamily: FONT }}>
                    Unirme a la beta
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Hero({ onRegister, onDemo }) {
  const rootRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.fromTo('[data-hero-badge]', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6 })
        .fromTo('[data-hero-line]', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 }, '-=0.35')
        .fromTo('[data-hero-p]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.35')
        .fromTo('[data-hero-cta]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
        .fromTo('[data-hero-float]', { opacity: 0, y: 30, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.08 }, '-=0.3')
    }, rootRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={rootRef} style={{ position: 'relative', paddingTop: 150, paddingBottom: 70, overflow: 'hidden', background: `linear-gradient(180deg, ${SKY_DEEP} 0%, ${SKY_MID} 55%, ${SKY_LIGHT} 100%)` }}>
      {/* Soft cloud blobs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[
          { s: 420, t: 60, l: -80, o: 0.5 }, { s: 320, t: 20, r: -60, o: 0.4 },
          { s: 500, b: -120, l: '10%', o: 0.55 }, { s: 380, b: -80, r: '5%', o: 0.45 },
        ].map((c, i) => (
          <div key={i} style={{ position: 'absolute', width: c.s, height: c.s, borderRadius: '50%', background: 'white', opacity: c.o, filter: 'blur(70px)', top: c.t, left: c.l, right: c.r, bottom: c.b }} />
        ))}
      </div>

      <div className="landing-container" style={{ position: 'relative', maxWidth: 900, margin: '0 auto', padding: '0 32px', textAlign: 'center' }}>
        <div data-hero-badge style={{ marginBottom: 22 }}>
          <BetaBadge dark />
        </div>
        <h1 style={{ fontSize: 'clamp(38px, 6vw, 60px)', fontWeight: 700, color: 'white', letterSpacing: '-2px', lineHeight: 1.1, marginBottom: 20 }}>
          <span data-hero-line style={{ display: 'block' }}>Centraliza el contenido</span>
          <span data-hero-line style={{ display: 'block' }}>de tus clientes con IA</span>
        </h1>
        <p data-hero-p style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: 34, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
          Ideas, calendario, copies y guiones en un solo sitio, con memoria de cada cliente. Empezamos por marketing — la idea es llegar a mucho más.
        </p>
        <div data-hero-cta style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Magnetic>
            <motion.button whileTap={{ scale: 0.97 }} onClick={onRegister}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 26px', borderRadius: 24, background: LIME, border: 'none', fontSize: 15.5, fontWeight: 700, color: INK, cursor: 'pointer', fontFamily: FONT, boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}>
              Unirme a la beta <ArrowRight size={16} />
            </motion.button>
          </Magnetic>
          <motion.button whileHover={{ backgroundColor: 'rgba(255,255,255,0.16)' }} whileTap={{ scale: 0.97 }} onClick={onDemo}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 22px', borderRadius: 24, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)', fontSize: 15.5, fontWeight: 500, color: 'white', cursor: 'pointer', fontFamily: FONT }}>
            <Play size={14} /> Ver demo
          </motion.button>
        </div>
        <a data-hero-cta href="/palabras-clave" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 90, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
          <Search size={14} /> Prueba gratis: descubre qué busca tu cliente en Google <ArrowRight size={13} />
        </a>
      </div>

      {/* Scattered floating cards */}
      <div className="landing-hero-floats" style={{ position: 'relative', maxWidth: 980, margin: '0 auto', height: 190, padding: '0 24px' }}>
        <FloatingCard rotate={-8} delay={0.2} style={{ left: '2%', top: 10, width: 118 }}>
          <div style={{ background: CARD, borderRadius: 14, padding: 10, boxShadow: '0 16px 40px rgba(11,11,15,0.22)' }}>
            <CalendarioMockup compact />
          </div>
        </FloatingCard>
        <FloatingCard rotate={5} delay={0.35} style={{ left: '24%', top: -30, width: 130 }}>
          <div style={{ background: INK, borderRadius: 14, padding: '16px 18px', boxShadow: '0 16px 40px rgba(11,11,15,0.3)' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>12h</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>ahorradas / semana</div>
          </div>
        </FloatingCard>
        <FloatingCard rotate={-3} delay={0.1} style={{ left: '46%', top: 20, width: 116 }}>
          <div style={{ background: LIME, borderRadius: 14, padding: '14px 16px', boxShadow: '0 16px 40px rgba(11,11,15,0.22)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Sparkles size={18} color={INK} />
            <div style={{ fontSize: 11.5, fontWeight: 700, color: INK, lineHeight: 1.25 }}>Generado con IA en segundos</div>
          </div>
        </FloatingCard>
        <FloatingCard rotate={7} delay={0.45} style={{ left: '67%', top: -20, width: 138 }}>
          <div style={{ background: CARD, borderRadius: 14, padding: '12px 14px', boxShadow: '0 16px 40px rgba(11,11,15,0.22)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: `${GREEN}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={10} color={GREEN} strokeWidth={3} />
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: INK }}>Copy generado</span>
            </div>
            <div style={{ fontSize: 9.5, color: INK_SOFT, lineHeight: 1.35 }}>"El secreto de nuestra receta..."</div>
          </div>
        </FloatingCard>
        <FloatingCard rotate={-6} delay={0.25} style={{ left: '86%', top: 25, width: 100 }}>
          <div style={{ background: CARD, borderRadius: 14, padding: 12, boxShadow: '0 16px 40px rgba(11,11,15,0.22)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <TrendingUp size={16} color={SKY_DEEP} />
            <div style={{ fontSize: 10, fontWeight: 700, color: INK }}>Tendencia detectada</div>
          </div>
        </FloatingCard>
      </div>
    </section>
  )
}

function TrustLogos() {
  const tools = ['Metricool', 'Instagram', 'TikTok', 'Google Business', 'WhatsApp', 'YouTube', 'Canva', 'Meta Ads', 'Notion']
  const doubled = [...tools, ...tools]
  const trackRef = useRef(null)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return undefined
    const tween = gsap.to(el, { xPercent: -50, duration: 26, ease: 'none', repeat: -1 })
    return () => tween.kill()
  }, [])

  return (
    <section style={{ padding: '44px 0', background: SURFACE }}>
      <p style={{ textAlign: 'center', fontSize: 13, color: INK_SOFT, fontWeight: 500, marginBottom: 22, letterSpacing: '0.2px', textTransform: 'uppercase' }}>
        Se conecta con las herramientas que ya usas
      </p>
      <div style={{ overflow: 'hidden', position: 'relative' }}>
        <div ref={trackRef} style={{ display: 'flex', gap: 48, whiteSpace: 'nowrap', width: 'max-content' }}>
          {doubled.map((t, i) => (
            <span key={i} style={{ fontSize: 17, fontWeight: 600, color: '#C7C7CC', letterSpacing: '-0.3px', userSelect: 'none' }}>{t}</span>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 80, background: `linear-gradient(90deg, ${SURFACE}, transparent)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, background: `linear-gradient(-90deg, ${SURFACE}, transparent)`, pointerEvents: 'none' }} />
      </div>
    </section>
  )
}

// ── Origin story ─────────────────────────────────────────────────────────────

function Historia() {
  return (
    <section id="historia" style={{ padding: '96px 32px', background: SURFACE_ALT }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="landing-historia-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 56, alignItems: 'start' }}>
          <Reveal>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5A6B00', textTransform: 'uppercase', letterSpacing: '0.6px' }}>· Por qué Aify</span>
            <h2 style={{ fontSize: 'clamp(30px, 4.5vw, 44px)', fontWeight: 700, color: INK, letterSpacing: '-1px', lineHeight: 1.15, margin: '14px 0 22px' }}>
              De "aifícate" a Aify
            </h2>
            <p style={{ fontSize: 17, color: INK_SOFT, lineHeight: 1.7, marginBottom: 18 }}>
              El nombre viene de una palabra que me digo mucho a mí mismo: <strong style={{ color: INK }}>aifícate</strong> — meterle inteligencia artificial a lo que haces para hacerlo mejor y más rápido.
            </p>
            <p style={{ fontSize: 17, color: INK_SOFT, lineHeight: 1.7, marginBottom: 18 }}>
              Llevo las redes sociales de una empresa, y en algún momento me di cuenta de que estaba usando IA para casi todo: pensar ideas, escribir copies, montar guiones, planear el calendario del mes. Cada cosa en una herramienta distinta, sin memoria de un mes para otro.
            </p>
            <p style={{ fontSize: 17, color: INK_SOFT, lineHeight: 1.7, marginBottom: 18 }}>
              Aify empezó como la manera de centralizar todo eso en un solo sitio — primero para mi propio trabajo, y después pensando en ayudar a más agencias y freelances que están en la misma situación.
            </p>
            <p style={{ fontSize: 17, color: INK_SOFT, lineHeight: 1.7 }}>
              Por ahora estoy empezando por marketing, que es lo que mejor conozco. Pero la idea a largo plazo es más grande: llevar la IA a muchos más tipos de negocio, no solo a agencias de contenido.
            </p>
          </Reveal>

          <Reveal y={24} delay={0.1}>
            <div style={{ background: INK, borderRadius: 24, padding: '32px 28px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: LIME, opacity: 0.15, filter: 'blur(50px)' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: LIME, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: INK, flexShrink: 0 }}>
                    D
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Dylan</div>
                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }}>Fundador de Aify</div>
                  </div>
                </div>
                <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.65, marginBottom: 20 }}>
                  "Aify está en fase beta y lo sigo construyendo activamente. Hay cosas a medio pulir y va a cambiar bastante — si lo pruebas ahora, tu feedback pesa muchísimo en hacia dónde va."
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: LIME }}>
                  <FlaskConical size={13} /> Beta abierta, sin cifras infladas
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function ProblemSolution() {
  const antes = ['Horas pensando qué publicar cada semana', 'Copies genéricos que no convierten', 'Perder el contexto de cada cliente', 'Entregar PDFs mal formateados', 'Trabajar con varias herramientas distintas', 'Sin tiempo para conseguir nuevos clientes']
  const despues = ['Calendario mensual completo en segundos', 'Copies adaptados a cada red y cliente', 'Memoria permanente de cada cliente', 'PDFs con un clic', 'Todo en una sola plataforma', 'Más tiempo para lo importante']
  return (
    <section style={{ padding: '96px 32px', background: SURFACE }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: INK, letterSpacing: '-1px', lineHeight: 1.15 }}>
            El marketing de contenidos cansa.<br />Por eso construyo esto.
          </h2>
        </Reveal>
        <div className="landing-problem-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Reveal y={20} style={{ padding: '32px 28px', borderRadius: 20, background: SURFACE_ALT, border: '1px solid rgba(11,11,15,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 20 }}>Sin Aify</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {antes.map((t, i) => <BenefitRow key={i} text={t} icon={X} color={RED} />)}
            </div>
          </Reveal>
          <Reveal y={20} delay={0.1} style={{ padding: '32px 28px', borderRadius: 20, background: INK, border: `1px solid ${INK}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: LIME, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 20 }}>Con Aify</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {despues.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(215,255,61,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Check size={11} color={LIME} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4 }}>{t}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Features() {
  const [active, setActive] = useState(0)
  const tab = TABS[active]
  return (
    <section style={{ padding: '96px 32px', background: SURFACE_ALT }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: INK, letterSpacing: '-1px', marginBottom: 14 }}>
            Lo que hace Aify hoy
          </h2>
          <p style={{ fontSize: 18, color: INK_SOFT, maxWidth: 560, margin: '0 auto' }}>
            El punto de partida para centralizar el contenido de todos tus clientes
          </p>
        </Reveal>
        <div style={{ display: 'inline-flex', gap: 4, overflowX: 'auto', marginBottom: 40, padding: 5, borderRadius: 14, background: 'white', border: '1px solid rgba(11,11,15,0.06)', maxWidth: '100%' }}>
          {TABS.map((t, i) => (
            <motion.button key={t.id} whileTap={{ scale: 0.97 }} onClick={() => setActive(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none', background: i === active ? INK : 'transparent', color: i === active ? LIME : INK_SOFT, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT, transition: 'background 0.2s, color 0.2s' }}>
              <t.icon size={14} /> {t.label}
            </motion.button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28 }}>
            <div className="landing-features-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 28, fontWeight: 700, color: INK, letterSpacing: '-0.6px', marginBottom: 14 }}>{tab.title}</h3>
                <p style={{ fontSize: 16, color: INK_SOFT, lineHeight: 1.65, marginBottom: 24 }}>{tab.desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {tab.benefits.map((b, i) => <BenefitRow key={i} text={b} />)}
                </div>
              </div>
              <div style={{ borderRadius: 20, padding: 20, background: 'white', border: '1px solid rgba(11,11,15,0.06)' }}>
                <GenericMockup tab={tab.id} />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

function ForWho({ onRegister }) {
  const cards = [
    {
      icon: User, title: 'Para freelances',
      desc: 'Gestiona varios clientes tú solo sin perder la cabeza. Genera en minutos lo que antes te llevaba horas.',
      items: ['Onboarding de cliente en minutos', 'Memoria permanente de cada cliente', 'PDFs para entregar sin esfuerzo', 'Gratis y de código abierto'],
      cta: 'Probar como freelance',
    },
    {
      icon: Building2, title: 'Para agencias',
      desc: 'Dale a tu equipo una herramienta que centraliza el trabajo y ayuda a mantener la calidad.',
      items: ['Pensado para varios usuarios', 'Clientes ilimitados', 'Consistencia entre miembros del equipo', 'Cada vez más funciones en camino'],
      cta: 'Probar con tu agencia',
    },
  ]
  return (
    <section style={{ padding: '96px 32px', background: SURFACE }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: INK, letterSpacing: '-1px', marginBottom: 14 }}>
            Pensado para quien trabaja en marketing
          </h2>
          <p style={{ fontSize: 18, color: INK_SOFT }}>Tanto si eres freelance como si gestionas una agencia</p>
        </Reveal>
        <div className="landing-problem-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {cards.map((c, i) => (
            <Reveal key={i} y={24} delay={i * 0.1} style={{ padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 20, background: SURFACE_ALT, borderRadius: 20, border: '1px solid rgba(11,11,15,0.06)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `${SKY_MID}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <c.icon size={22} color={SKY_DEEP} strokeWidth={1.8} />
              </div>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 700, color: INK, letterSpacing: '-0.4px', marginBottom: 10 }}>{c.title}</h3>
                <p style={{ fontSize: 15, color: INK_SOFT, lineHeight: 1.6 }}>{c.desc}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.items.map((item, j) => <BenefitRow key={j} text={item} />)}
              </div>
              <motion.button whileHover={{ backgroundColor: LIME_DARK }} whileTap={{ scale: 0.97 }} onClick={onRegister}
                style={{ marginTop: 4, padding: '12px 24px', borderRadius: 12, background: LIME, border: 'none', fontSize: 14, fontWeight: 700, color: INK, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {c.cta} <ArrowRight size={15} />
              </motion.button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Gratis({ onRegister }) {
  const puntos = [
    'Sin planes de pago ni tarjeta: todo abierto para todos',
    'Publicar en Instagram y TikTok, DMs y métricas incluidos',
    'La IA la pones tú, con tu propia cuenta',
  ]
  return (
    <section id="gratis" style={{ padding: '96px 32px', background: SURFACE_ALT }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <Reveal>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: INK, letterSpacing: '-1px', marginBottom: 14 }}>
            Gratis y de código abierto
          </h2>
          <p style={{ fontSize: 17, color: INK_SOFT, marginBottom: 28, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            @Social no cobra nada. Sigo construyéndolo en abierto durante la beta, y cualquiera puede usarlo entero.
          </p>
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 10, textAlign: 'left', marginBottom: 32 }}>
            {puntos.map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${GREEN}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Check size={11} color={GREEN} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: 15, color: INK, lineHeight: 1.4 }}>{p}</span>
              </div>
            ))}
          </div>
          <div>
            <motion.button whileHover={{ backgroundColor: LIME_DARK }} whileTap={{ scale: 0.97 }} onClick={onRegister}
              style={{ padding: '13px 28px', borderRadius: 12, border: 'none', background: LIME, color: INK, fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }}>
              Crear cuenta gratis
            </motion.button>
          </div>
        </Reveal>
        <p style={{ textAlign: 'center', fontSize: 14, color: INK_SOFT, marginTop: 28 }}>
          ¿Tienes dudas o algo específico para tu agencia?{' '}
          <span onClick={() => window.open(WHATSAPP_URL, '_blank', 'noopener,noreferrer')} style={{ color: SKY_DEEP, cursor: 'pointer', fontWeight: 600 }}>Escríbenos por WhatsApp</span>
        </p>
      </div>
    </section>
  )
}

function FAQ() {
  const [open, setOpen] = useState(null)
  return (
    <section style={{ padding: '96px 32px', background: SURFACE }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: INK, letterSpacing: '-1px' }}>
            Preguntas frecuentes
          </h2>
        </Reveal>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.map((f, i) => (
            <Reveal key={i} y={12} delay={i * 0.04}>
              <div style={{ borderRadius: 14, overflow: 'hidden', transition: 'border 0.2s, background 0.2s', background: SURFACE_ALT, border: open === i ? `1px solid ${SKY_MID}60` : '1px solid rgba(11,11,15,0.06)' }}>
                <button onClick={() => setOpen(open === i ? null : i)} style={{ width: '100%', padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontFamily: FONT }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: INK, textAlign: 'left' }}>{f.q}</span>
                  <motion.div animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ flexShrink: 0 }}>
                    <ChevronDown size={16} color={INK_SOFT} />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {open === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
                      <p style={{ padding: '0 22px 18px', fontSize: 15, color: INK_SOFT, lineHeight: 1.65, margin: 0 }}>{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTAFinal({ onRegister }) {
  return (
    <section style={{ padding: '90px 32px', position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY_MID})` }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[{ s: 380, t: -140, l: -100, o: 0.3 }, { s: 300, b: -100, r: -60, o: 0.25 }].map((c, i) => (
          <div key={i} style={{ position: 'absolute', width: c.s, height: c.s, borderRadius: '50%', background: 'white', opacity: c.o, filter: 'blur(80px)', top: c.t, left: c.l, right: c.r, bottom: c.b }} />
        ))}
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        <Reveal>
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}><BetaBadge dark /></div>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 50px)', fontWeight: 700, color: 'white', letterSpacing: '-1.2px', lineHeight: 1.15, marginBottom: 16 }}>
            Sé de los primeros en probar Aify
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.85)', marginBottom: 32, lineHeight: 1.5 }}>
            Estamos en fase beta. Es gratis, y tu opinión me ayuda a decidir qué construir después.
          </p>
          <Magnetic>
            <motion.button whileTap={{ scale: 0.97 }} onClick={onRegister}
              style={{ padding: '15px 34px', borderRadius: 24, background: LIME, border: 'none', fontSize: 16, fontWeight: 700, color: INK, cursor: 'pointer', fontFamily: FONT, boxShadow: '0 8px 28px rgba(0,0,0,0.2)' }}>
              Crear cuenta gratis
            </motion.button>
          </Magnetic>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 14 }}>
            Gratis y de código abierto · Sin tarjeta
          </p>
        </Reveal>
      </div>
    </section>
  )
}

function Footer({ onLogin }) {
  const cols = [
    { title: 'Producto', links: ['Funcionalidades', 'Gratis', 'Nuestra historia'] },
    { title: 'Legal', links: ['Privacidad', 'Términos', 'Cookies'] },
  ]
  const HREFS = { Privacidad: '/privacidad', Términos: '/terminos', Cookies: '/cookies' }
  return (
    <footer style={{ background: INK, padding: '64px 32px 40px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="landing-footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 40, marginBottom: 48 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Marca app="Social" oscuro tamano={18} />
            </div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 20, maxWidth: 280 }}>
              IA para centralizar el contenido de marketing de tus clientes. Proyecto en fase beta.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {[Camera, Briefcase, Music].map((Icon, i) => (
                <div key={i} style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon size={16} color="rgba(255,255,255,0.5)" />
                </div>
              ))}
            </div>
          </div>
          {cols.map(col => (
            <div key={col.title}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 14 }}>{col.title}</div>
              {col.links.map(l => {
                const Tag = HREFS[l] ? 'a' : 'div'
                return (
                  <Tag key={l} href={HREFS[l]} style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', marginBottom: 8, cursor: 'pointer', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.target.style.color = 'rgba(255,255,255,0.85)'}
                    onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.5)'}>
                    {l}
                  </Tag>
                )
              })}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>© 2026 Aify · En fase beta</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }} onClick={onLogin}>hola@useaify.app</span>
        </div>
      </div>
    </footer>
  )
}

// ── Demo modal ────────────────────────────────────────────────────────────────

function DemoModal({ onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
        onClick={e => e.stopPropagation()}
        style={{ borderRadius: 20, width: '100%', maxWidth: 720, aspectRatio: '16/9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', gap: 16, background: INK }}>
        <motion.div whileHover={{ scale: 1.08 }} style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Play size={28} color="white" fill="white" />
        </motion.div>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>Demo de Aify — Próximamente</p>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
          <X size={16} />
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── CSS injection ─────────────────────────────────────────────────────────────

const CSS = `
  @media (max-width: 900px) {
    .landing-problem-grid { grid-template-columns: 1fr !important; }
    .landing-features-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
    .landing-footer-grid { grid-template-columns: 1fr 1fr !important; }
    .landing-historia-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
    .landing-hero-floats { display: none !important; }
  }
  @media (max-width: 1000px) {
    .landing-otras-apps { display: none !important; }
  }
  @media (max-width: 640px) {
    .landing-footer-grid { grid-template-columns: 1fr !important; }
    .landing-desktop-nav { display: none !important; }
    .landing-mobile-nav { display: flex !important; }
  }
`

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showDemo, setShowDemo] = useState(false)

  const onRegister = () => navigate('/login')
  const onLogin = () => navigate('/login')
  const onApp = () => navigate('/dashboard')

  return (
    <div style={{ fontFamily: FONT, background: SURFACE, width: '100%', alignSelf: 'flex-start' }}>
      <style>{CSS}</style>
      <Navbar onLogin={onLogin} onRegister={onRegister} onApp={onApp} isLoggedIn={!!user} />
      <Hero onRegister={onRegister} onDemo={() => setShowDemo(true)} />
      <TrustLogos />
      <Historia />
      <ProblemSolution />
      <Features />
      <ForWho onRegister={onRegister} />
      <Gratis onRegister={onRegister} />
      <FAQ />
      <CTAFinal onRegister={onRegister} />
      <Footer onLogin={onLogin} />
      <AnimatePresence>
        {showDemo && <DemoModal onClose={() => setShowDemo(false)} />}
      </AnimatePresence>
    </div>
  )
}
