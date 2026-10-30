import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap } from 'gsap'
import {
  ArrowRight, Check, X, ChevronDown, Menu as MenuIcon, Sparkles, CodeXml,
  Calendar, Image as ImageIcon, PenTool, Bot, KeyRound, Plug, Heart,
} from 'lucide-react'
import {
  SKY_DEEP, SKY_MID, SKY_LIGHT, LIME, LIME_DARK, INK, INK_SOFT, INK_FAINT,
  SURFACE, SURFACE_ALT, CARD, GREEN, RED, FONT, CONTACT_EMAIL,
} from './marketing/shared'
import { Reveal, Magnetic, BenefitRow, CalendarioMockup, CopiesMockup, FloatingCard, MarcaAify } from './marketing/piezasLanding'

// ── Familia Aify (/demo) ─────────────────────────────────────────────────────
// La landing de la familia de apps, con el mismo estilo que la portada
// (Landing.jsx): cielo azul, tarjetas flotantes, pestañas con maquetas, FAQ y
// pie oscuro. Cuenta lo nuevo: @Social y @Pictures, gratis, de código
// abierto y con la IA de cada uno («Tu IA»).
//
// A propósito sin useAuth()/useNavigate() y con <a href> normales: así se
// prerenderiza sin AuthProvider ni StaticRouter (ver entry-prerender.jsx).

const URL_SOCIAL = '/login'
const URL_PICTURES = 'https://pictures.useaify.app'
const URL_EDITOR = 'https://pictures.useaify.app/app/'
const URL_GITHUB_PICTURES = 'https://github.com/dylanstillavato/aify-pictures'
const URL_GITHUB_SOCIAL = 'https://github.com/dylanstillavato/aify-social'

const APPS = [
  {
    id: 'social', icon: Calendar, label: '@Social', marca: 'Social',
    title: 'El CRM para gestores de redes',
    desc: 'Tus clientes, sus ideas, los guiones, el calendario y las métricas en un solo sitio, con la memoria de cada marca. Y publica en Instagram y TikTok sin salir.',
    benefits: ['Ficha de cada cliente con su tono y su sector', 'Calendario mensual y guiones de reels', 'Publicar y programar en Instagram y TikTok', 'Métricas de cada pieza a las 24 h'],
    cta: { texto: 'Entrar en @Social', href: URL_SOCIAL },
  },
  {
    id: 'pictures', icon: ImageIcon, label: '@Pictures', marca: 'Pictures',
    title: 'El editor de imágenes gratis',
    desc: 'Capas, máscaras, ajustes, texto y archivos PSD de verdad, en el navegador. Basado en PhotoCraft, de código abierto, y pensado para las piezas de redes.',
    benefits: ['Sin instalar nada: se abre en el navegador', 'Abre y guarda PSD con sus capas', 'Los atajos de siempre: ⌘J, ⌘Z, ⌘0…', 'Tus fotos no salen de tu ordenador'],
    cta: { texto: 'Abrir el editor', href: URL_EDITOR },
  },
  {
    id: 'studio', icon: PenTool, label: 'Studio',
    title: 'La pizarra para dar indicaciones',
    desc: 'Deja referencias, notas escritas a mano, flechas y notas de voz. Tu IA lee la pizarra y los apuntes y te devuelve la pieza, el guion o el copy.',
    benefits: ['Referencias de YouTube, Instagram y TikTok', 'Notas a mano, flechas y notas de voz', 'Apuntes al lado de cada proyecto', '«Pídeselo a la IA» sobre lo que dejas'],
    cta: { texto: 'Ver @Pictures', href: URL_PICTURES },
    proximamente: true,
  },
  {
    id: 'ia', icon: Bot, label: 'Tu IA',
    title: 'Tu IA, con tu plan',
    desc: 'Aify no te vende IA: conectas la tuya. Tu Claude o tu ChatGPT trabajan con tus clientes y tus pizarras, o pones tu clave y la usan los botones de la app.',
    benefits: ['Conecta tu Claude o tu ChatGPT con tu plan', 'O tu clave de Claude o de Gemini', 'Nunca te pedimos la contraseña', 'Lo que gastes lo paga tu cuenta, sin intermediarios'],
    cta: { texto: 'Empezar gratis', href: URL_SOCIAL },
  },
]

const FAQS = [
  { q: '¿Es gratis de verdad?', a: 'Sí. @Social y @Pictures son gratis y de código abierto. Lo único que puede costarte dinero es tu propia IA (tu plan de Claude o de ChatGPT, o tu clave de API), y eso lo pagas directamente a ellos.' },
  { q: '¿Qué es «Tu IA»?', a: 'La IA la pones tú. Puedes conectar tu Claude o tu ChatGPT con tu plan, con el conector de Aify, y entonces tu IA ve tus clientes, tus ideas y tus pizarras. O puedes poner tu clave de API para que la usen los botones de la app.' },
  { q: '¿Necesito pagar Claude o ChatGPT?', a: 'Para usar Aify, no. Para las funciones de IA sí necesitas tu propia IA: con el plan que ya tengas en Claude o en ChatGPT basta, o con una clave de API.' },
  { q: '¿Me vais a pedir la contraseña de Claude o de ChatGPT?', a: 'Nunca. La conexión se hace desde tu propio Claude o ChatGPT, añadiendo el conector de Aify, o con una clave de API que puedes borrar cuando quieras.' },
  { q: '¿Qué significa que sea de código abierto?', a: 'Que el código se puede ver, mejorar y compartir. @Pictures parte de PhotoCraft, un editor abierto que admiramos, y decimos de dónde sale. Las mejoras las hacemos con quien lo usa.' },
  { q: '¿Puedo ayudar a mejorarlo?', a: 'Sí: cuéntanos qué te falta, abre una propuesta en GitHub o mándanos tu cambio. Lo que funcione para todos entra en la siguiente versión.' },
]

// ── Secciones ─────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // En esta app el scroll lo lleva body, no window (ver Reveal en
  // marketing/piezasLanding.jsx): se escucha en captura y se miran los dos.
  useEffect(() => {
    const h = () => setScrolled(Math.max(window.scrollY, document.body.scrollTop, document.documentElement.scrollTop) > 20)
    window.addEventListener('scroll', h, true)
    return () => window.removeEventListener('scroll', h, true)
  }, [])

  const links = [['Las apps', '#apps'], ['Tu IA', '#tu-ia'], ['Código abierto', '#codigo-abierto'], ['Preguntas', '#preguntas']]
  const colorLink = scrolled ? INK_SOFT : 'rgba(255,255,255,0.85)'
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
        <a href="/demo" style={{ textDecoration: 'none' }}><MarcaAify claro={!scrolled} tamano={24} /></a>
        <div className="familia-desktop-nav" style={{ display: 'flex', gap: 28 }}>
          {links.map(([texto, href]) => (
            <a key={href} href={href} style={{ fontSize: 13.5, color: colorLink, textDecoration: 'none', transition: 'color 0.15s' }}>{texto}</a>
          ))}
        </div>
        <div className="familia-desktop-nav" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href={URL_SOCIAL} style={{ padding: '8px 14px', fontSize: 13.5, fontWeight: 500, color: scrolled ? INK_SOFT : 'rgba(255,255,255,0.9)', textDecoration: 'none' }}>
            Iniciar sesión
          </a>
          <motion.a href={URL_SOCIAL} whileHover={{ backgroundColor: LIME_DARK }} whileTap={{ scale: 0.97 }}
            style={{ padding: '8px 18px', borderRadius: 20, background: LIME, fontSize: 13.5, fontWeight: 700, color: INK, textDecoration: 'none' }}>
            Empezar gratis
          </motion.a>
        </div>
        <button className="familia-mobile-nav" onClick={() => setMobileOpen(o => !o)} aria-label="Menú"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: scrolled ? INK : 'white', display: 'none', padding: 10 }}>
          <MenuIcon size={22} />
        </button>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ position: 'absolute', top: 64, left: 16, right: 16, borderRadius: 18, padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 4, pointerEvents: 'auto', background: 'white', boxShadow: '0 16px 48px rgba(11,11,15,0.16)' }}>
            {links.map(([texto, href]) => (
              <a key={href} href={href} onClick={() => setMobileOpen(false)} style={{ fontSize: 16, color: INK, textDecoration: 'none', padding: '10px 0' }}>{texto}</a>
            ))}
            <a href={URL_SOCIAL} style={{ marginTop: 8, padding: 12, borderRadius: 14, background: LIME, fontSize: 15, fontWeight: 700, color: INK, textDecoration: 'none', textAlign: 'center' }}>
              Empezar gratis
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Las tejas de las apps (inicial de la app con su punto, en SVG) que flotan en el hero.
function TejaApp({ src, alt }) {
  return (
    <img src={src} alt={alt} style={{ display: 'block', width: 64, height: 64, borderRadius: 18, boxShadow: '0 16px 40px rgba(11,11,15,0.25)' }} />
  )
}

function Hero() {
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
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[
          { s: 420, t: 60, l: -80, o: 0.5 }, { s: 320, t: 20, r: -60, o: 0.4 },
          { s: 500, b: -120, l: '10%', o: 0.55 }, { s: 380, b: -80, r: '5%', o: 0.45 },
        ].map((c, i) => (
          <div key={i} style={{ position: 'absolute', width: c.s, height: c.s, borderRadius: '50%', background: 'white', opacity: c.o, filter: 'blur(70px)', top: c.t, left: c.l, right: c.r, bottom: c.b }} />
        ))}
      </div>

      <div style={{ position: 'relative', maxWidth: 900, margin: '0 auto', padding: '0 32px', textAlign: 'center' }}>
        <div data-hero-badge style={{ marginBottom: 22 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '6px 14px 6px 10px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)' }}>
            <Heart size={13} color={LIME} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Gratis y de código abierto</span>
          </span>
        </div>
        <h1 style={{ fontSize: 'clamp(38px, 6vw, 60px)', fontWeight: 700, color: 'white', letterSpacing: '-2px', lineHeight: 1.1, marginBottom: 20 }}>
          <span data-hero-line style={{ display: 'block' }}>Las apps de Aify,</span>
          <span data-hero-line style={{ display: 'block' }}>gratis y con tu propia IA</span>
        </h1>
        <p data-hero-p style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: 34, maxWidth: 580, marginLeft: 'auto', marginRight: 'auto' }}>
          @Social para llevar las redes de tus clientes. @Pictures para crear las piezas. Conecta tu Claude o tu ChatGPT y trabaja con todo, sin pagarnos nada.
        </p>
        <div data-hero-cta style={{ display: 'flex', gap: 12, marginBottom: 90, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Magnetic>
            <motion.a href={URL_SOCIAL} whileTap={{ scale: 0.97 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 26px', borderRadius: 24, background: LIME, fontSize: 15.5, fontWeight: 700, color: INK, textDecoration: 'none', boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}>
              Empezar gratis <ArrowRight size={16} />
            </motion.a>
          </Magnetic>
          <motion.a href="#apps" whileHover={{ backgroundColor: 'rgba(255,255,255,0.16)' }} whileTap={{ scale: 0.97 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 22px', borderRadius: 24, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)', fontSize: 15.5, fontWeight: 500, color: 'white', textDecoration: 'none' }}>
            Ver las apps
          </motion.a>
        </div>
      </div>

      <div className="familia-hero-floats" style={{ position: 'relative', maxWidth: 980, margin: '0 auto', height: 190, padding: '0 24px' }}>
        <FloatingCard rotate={-8} delay={0.2} style={{ left: '2%', top: 10, width: 118 }}>
          <div style={{ background: CARD, borderRadius: 14, padding: 10, boxShadow: '0 16px 40px rgba(11,11,15,0.22)' }}>
            <CalendarioMockup compact />
          </div>
        </FloatingCard>
        <FloatingCard rotate={5} delay={0.35} style={{ left: '22%', top: -24 }}>
          <TejaApp src="/marca/aify-social.svg" alt="@Social" />
        </FloatingCard>
        <FloatingCard rotate={-3} delay={0.1} style={{ left: '38%', top: 20, width: 150 }}>
          <div style={{ background: INK, borderRadius: 14, padding: '16px 18px', boxShadow: '0 16px 40px rgba(11,11,15,0.3)' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>0 €</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>para siempre, sin planes</div>
          </div>
        </FloatingCard>
        <FloatingCard rotate={6} delay={0.45} style={{ left: '60%', top: -26 }}>
          <TejaApp src="/marca/aify-pictures.svg" alt="@Pictures" />
        </FloatingCard>
        <FloatingCard rotate={-5} delay={0.25} style={{ left: '76%', top: 18, width: 148 }}>
          <div style={{ background: LIME, borderRadius: 14, padding: '14px 16px', boxShadow: '0 16px 40px rgba(11,11,15,0.22)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Sparkles size={18} color={INK} />
            <div style={{ fontSize: 11.5, fontWeight: 700, color: INK, lineHeight: 1.25 }}>Tu Claude o tu ChatGPT, con tu plan</div>
          </div>
        </FloatingCard>
      </div>
    </section>
  )
}

function FuncionaCon() {
  const herramientas = ['Claude', 'ChatGPT', 'Gemini', 'Instagram', 'TikTok', 'Google Business', 'Archivos PSD', 'WhatsApp', 'YouTube']
  const doble = [...herramientas, ...herramientas]
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
        Funciona con lo que ya usas
      </p>
      <div style={{ overflow: 'hidden', position: 'relative' }}>
        <div ref={trackRef} style={{ display: 'flex', gap: 48, whiteSpace: 'nowrap', width: 'max-content' }}>
          {doble.map((t, i) => (
            <span key={i} style={{ fontSize: 17, fontWeight: 600, color: '#C7C7CC', letterSpacing: '-0.3px', userSelect: 'none' }}>{t}</span>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 80, background: `linear-gradient(90deg, ${SURFACE}, transparent)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, background: `linear-gradient(-90deg, ${SURFACE}, transparent)`, pointerEvents: 'none' }} />
      </div>
    </section>
  )
}

function QueCambia() {
  const antes = ['Un plan de pago al mes para usar la app', 'IA limitada, la que pagábamos nosotros', 'Código cerrado: lo que hay es lo que hay', 'Una sola app para todo', 'El editor de imágenes, de pago y aparte']
  const ahora = ['Gratis, sin planes ni tarjeta', 'Tu IA: tu Claude o tu ChatGPT, con tu plan', 'Código abierto: lo mejoramos contigo', 'Varias apps que hablan entre sí', '@Pictures, el editor gratis en el navegador']
  return (
    <section style={{ padding: '96px 32px', background: SURFACE_ALT }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#5A6B00', textTransform: 'uppercase', letterSpacing: '0.6px' }}>· Lo nuevo</span>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: INK, letterSpacing: '-1px', lineHeight: 1.15, marginTop: 14 }}>
            Aify ya no es una app.<br />Es una familia, y es tuya.
          </h2>
        </Reveal>
        <div className="familia-dos" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Reveal y={20} style={{ padding: '32px 28px', borderRadius: 20, background: SURFACE, border: '1px solid rgba(11,11,15,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 20 }}>Antes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {antes.map((t, i) => <BenefitRow key={i} text={t} icon={X} color={RED} />)}
            </div>
          </Reveal>
          <Reveal y={20} delay={0.1} style={{ padding: '32px 28px', borderRadius: 20, background: INK, border: `1px solid ${INK}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: LIME, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 20 }}>Ahora</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {ahora.map((t, i) => (
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

// Maquetas de cada pestaña de «Las apps».
function EditorMockup() {
  return (
    <div style={{ background: '#1E1E21', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 20px rgba(11,11,15,0.12)' }}>
      <div style={{ display: 'flex', gap: 10, padding: '7px 10px', borderBottom: '1px solid #2C2C30', fontSize: 9, color: '#9A9CA5' }}>
        {['Archivo', 'Edición', 'Imagen', 'Capa', 'Filtro'].map(m => <span key={m}>{m}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 86px', height: 190 }}>
        <div style={{ borderRight: '1px solid #2C2C30', display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 5px' }}>
          {Array.from({ length: 8 }, (_, i) => <div key={i} style={{ height: 10, borderRadius: 3, background: i === 0 ? SKY_DEEP : '#3A3A3F' }} />)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#141416' }}>
          <div style={{ width: 96, height: 120, borderRadius: 6, background: `linear-gradient(160deg, ${SKY_MID}, ${SKY_DEEP})`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 12, right: 12, top: 14, height: 9, borderRadius: 5, background: 'white' }} />
            <div style={{ position: 'absolute', left: 12, width: 48, top: 29, height: 9, borderRadius: 5, background: 'rgba(255,255,255,0.7)' }} />
            <div style={{ position: 'absolute', left: 30, top: 58, width: 36, height: 36, borderRadius: '50%', background: LIME }} />
          </div>
        </div>
        <div style={{ borderLeft: '1px solid #2C2C30', padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 8, color: '#9A9CA5', fontWeight: 700 }}>CAPAS</span>
          {['Titular', 'Sol', 'Fondo'].map((c, i) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: 4, borderRadius: 4, background: i === 0 ? '#2C2C30' : 'transparent' }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: i === 1 ? LIME : i === 0 ? 'white' : SKY_DEEP }} />
              <span style={{ fontSize: 8, color: '#E4E4E7' }}>{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PizarraMockup() {
  return (
    <div style={{ background: CARD, borderRadius: 14, padding: 16, boxShadow: '0 2px 20px rgba(11,11,15,0.06)' }}>
      <svg width="100%" viewBox="0 0 300 160" aria-hidden="true" style={{ display: 'block' }}>
        <defs><marker id="punta-familia" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill={INK} /></marker></defs>
        <rect x="0" y="6" width="78" height="56" rx="8" fill={SURFACE_ALT} />
        <rect x="12" y="20" width="50" height="7" rx="3.5" fill="#D4D6CF" />
        <rect x="12" y="34" width="34" height="7" rx="3.5" fill="#D4D6CF" />
        <rect x="0" y="92" width="78" height="56" rx="8" fill={SURFACE_ALT} />
        <circle cx="39" cy="120" r="13" fill={LIME} />
        <path d="M80 34 C 140 40, 170 60, 206 70" fill="none" stroke={INK} strokeWidth="1.6" markerEnd="url(#punta-familia)" />
        <path d="M80 118 C 140 116, 170 100, 206 92" fill="none" stroke={INK} strokeWidth="1.6" markerEnd="url(#punta-familia)" />
        <text x="100" y="30" style={{ font: '16px Caveat, cursive' }} fill={INK}>más grande</text>
        <text x="100" y="142" style={{ font: '16px Caveat, cursive' }} fill={RED}>sin fondo</text>
        <rect x="212" y="40" width="80" height="84" rx="10" fill={SKY_DEEP} />
        <rect x="222" y="52" width="58" height="7" rx="3.5" fill="white" />
        <circle cx="252" cy="96" r="14" fill={LIME} />
      </svg>
    </div>
  )
}

function TuIAMockup() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[
        { icon: Plug, titulo: 'Conecta tu Claude o tu ChatGPT', estado: 'Conectada', color: GREEN },
        { icon: KeyRound, titulo: 'Tu clave de API', estado: '•••• 4f2a', color: SKY_DEEP },
      ].map(c => (
        <div key={c.titulo} style={{ background: CARD, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 8px rgba(11,11,15,0.06)' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `${c.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <c.icon size={16} color={c.color} />
          </div>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: INK }}>{c.titulo}</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: c.color }}>{c.estado}</span>
        </div>
      ))}
      <CopiesMockup />
    </div>
  )
}

function MockupApp({ id }) {
  if (id === 'social') return <CalendarioMockup />
  if (id === 'pictures') return <EditorMockup />
  if (id === 'studio') return <PizarraMockup />
  return <TuIAMockup />
}

function LasApps() {
  const [active, setActive] = useState(0)
  const app = APPS[active]
  return (
    <section id="apps" style={{ padding: '96px 32px', background: SURFACE }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: INK, letterSpacing: '-1px', marginBottom: 14 }}>
            Las apps de Aify
          </h2>
          <p style={{ fontSize: 18, color: INK_SOFT, maxWidth: 560, margin: '0 auto' }}>
            Cada una hace una cosa bien, y todas comparten tus clientes y tu IA
          </p>
        </Reveal>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', gap: 4, overflowX: 'auto', padding: 5, borderRadius: 14, background: SURFACE_ALT, border: '1px solid rgba(11,11,15,0.06)', maxWidth: '100%' }}>
            {APPS.map((t, i) => (
              <motion.button key={t.id} whileTap={{ scale: 0.97 }} onClick={() => setActive(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', minHeight: 44, borderRadius: 10, border: 'none', background: i === active ? INK : 'transparent', color: i === active ? LIME : INK_SOFT, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT, transition: 'background 0.2s, color 0.2s' }}>
                <t.icon size={14} /> {t.label}
              </motion.button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28 }}>
            <div className="familia-dos" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
              <div>
                {app.marca && <div style={{ marginBottom: 14 }}><MarcaAify app={app.marca} tamano={20} /></div>}
                <h3 style={{ fontSize: 28, fontWeight: 700, color: INK, letterSpacing: '-0.6px', marginBottom: 14 }}>
                  {app.title}
                  {app.proximamente && <span style={{ marginLeft: 10, verticalAlign: 'middle', fontSize: 11, fontWeight: 700, color: '#5A6B00', background: `${LIME}55`, padding: '4px 10px', borderRadius: 20 }}>Muy pronto</span>}
                </h3>
                <p style={{ fontSize: 16, color: INK_SOFT, lineHeight: 1.65, marginBottom: 24 }}>{app.desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  {app.benefits.map((b, i) => <BenefitRow key={i} text={b} />)}
                </div>
                <motion.a href={app.cta.href} whileHover={{ backgroundColor: LIME_DARK }} whileTap={{ scale: 0.97 }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', minHeight: 44, boxSizing: 'border-box', borderRadius: 12, background: LIME, fontSize: 14, fontWeight: 700, color: INK, textDecoration: 'none' }}>
                  {app.cta.texto} <ArrowRight size={15} />
                </motion.a>
              </div>
              <div style={{ borderRadius: 20, padding: 20, background: SURFACE_ALT, border: '1px solid rgba(11,11,15,0.06)' }}>
                <MockupApp id={app.id} />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

function TuIA() {
  return (
    <section id="tu-ia" style={{ padding: '96px 32px', background: SURFACE_ALT }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="familia-dos" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 56, alignItems: 'start' }}>
          <Reveal>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5A6B00', textTransform: 'uppercase', letterSpacing: '0.6px' }}>· Tu IA</span>
            <h2 style={{ fontSize: 'clamp(30px, 4.5vw, 44px)', fontWeight: 700, color: INK, letterSpacing: '-1px', lineHeight: 1.15, margin: '14px 0 22px' }}>
              No te vendemos IA. Conectas la tuya.
            </h2>
            <p style={{ fontSize: 17, color: INK_SOFT, lineHeight: 1.7, marginBottom: 18 }}>
              Ya pagas Claude o ChatGPT. No tiene sentido pagar otra IA más dentro de cada app. En Aify, la IA la pones tú, de una de estas dos maneras:
            </p>
            <p style={{ fontSize: 17, color: INK_SOFT, lineHeight: 1.7, marginBottom: 18 }}>
              <strong style={{ color: INK }}>Conecta tu Claude o tu ChatGPT, con tu plan.</strong> Añades el conector de Aify y tu IA ve tus clientes, tus ideas, tu calendario y tus pizarras. Le pides las cosas desde tu Claude, y lo que hace aparece en Aify.
            </p>
            <p style={{ fontSize: 17, color: INK_SOFT, lineHeight: 1.7 }}>
              <strong style={{ color: INK }}>O pon tu clave de API.</strong> De Claude o de Gemini. La usan los botones de IA de la app, y lo que gastes lo paga tu cuenta, sin intermediarios.
            </p>
          </Reveal>
          <Reveal y={24} delay={0.1}>
            <div style={{ background: INK, borderRadius: 24, padding: '32px 28px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: LIME, opacity: 0.15, filter: 'blur(50px)' }} />
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {[
                  { icon: Plug, titulo: 'Tu Claude o tu ChatGPT', texto: 'Con tu plan de siempre. Se conecta en dos minutos desde sus ajustes.' },
                  { icon: KeyRound, titulo: 'Tu clave de API', texto: 'De Claude o de Gemini. Puedes quitarla cuando quieras.' },
                  { icon: Check, titulo: 'Nunca tu contraseña', texto: 'No te pedimos la contraseña de Claude ni de ChatGPT. Nunca.' },
                ].map(o => (
                  <div key={o.titulo} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(215,255,61,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <o.icon size={18} color={LIME} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 4 }}>{o.titulo}</div>
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{o.texto}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function CodigoAbierto() {
  const repos = [
    { app: 'Pictures', desc: 'Parte de PhotoCraft, el editor abierto del ArtCraft Team. Lo traducimos, lo adaptamos a redes y le añadimos Studio y Tu IA.', licencia: 'MIT o Apache-2.0', href: URL_GITHUB_PICTURES, cta: 'Ver el código' },
    { app: 'Social', desc: 'El CRM entero: clientes, ideas, guiones, calendario, publicación y métricas. Lo publicamos para que cualquiera lo pueda revisar y mejorar.', licencia: 'AGPL-3.0', href: URL_GITHUB_SOCIAL, cta: 'Ver el código' },
  ]
  return (
    <section id="codigo-abierto" style={{ padding: '96px 32px', background: SURFACE }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: INK, letterSpacing: '-1px', marginBottom: 14 }}>
            De código abierto, de verdad
          </h2>
          <p style={{ fontSize: 18, color: INK_SOFT, maxWidth: 620, margin: '0 auto' }}>
            Partimos de proyectos abiertos que admiramos, decimos de dónde salen y los mejoramos con quien los usa
          </p>
        </Reveal>
        <div className="familia-dos" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {repos.map((r, i) => (
            <Reveal key={r.app} y={24} delay={i * 0.1} style={{ padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 18, background: SURFACE_ALT, borderRadius: 20, border: '1px solid rgba(11,11,15,0.06)' }}>
              <MarcaAify app={r.app} tamano={22} />
              <p style={{ fontSize: 15, color: INK_SOFT, lineHeight: 1.6, margin: 0 }}>{r.desc}</p>
              <span style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, color: INK, background: 'white', border: '1px solid rgba(11,11,15,0.08)', padding: '5px 12px', borderRadius: 20 }}>Licencia {r.licencia}</span>
              {r.href ? (
                <motion.a href={r.href} whileHover={{ backgroundColor: LIME_DARK }} whileTap={{ scale: 0.97 }}
                  style={{ marginTop: 4, padding: '12px 24px', minHeight: 44, boxSizing: 'border-box', borderRadius: 12, background: LIME, fontSize: 14, fontWeight: 700, color: INK, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <CodeXml size={15} /> {r.cta}
                </motion.a>
              ) : (
                <span style={{ marginTop: 4, padding: '12px 24px', borderRadius: 12, border: '1.5px dashed rgba(11,11,15,0.18)', fontSize: 14, fontWeight: 600, color: INK_FAINT, textAlign: 'center' }}>{r.cta}</span>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Preguntas() {
  const [open, setOpen] = useState(null)
  return (
    <section id="preguntas" style={{ padding: '96px 32px', background: SURFACE_ALT }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: INK, letterSpacing: '-1px' }}>
            Preguntas frecuentes
          </h2>
        </Reveal>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.map((f, i) => (
            <Reveal key={i} y={12} delay={i * 0.04}>
              <div style={{ borderRadius: 14, overflow: 'hidden', transition: 'border 0.2s', background: SURFACE, border: open === i ? `1px solid ${SKY_MID}60` : '1px solid rgba(11,11,15,0.06)' }}>
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

function LlamadaFinal() {
  return (
    <section style={{ padding: '90px 32px', position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY_MID})` }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[{ s: 380, t: -140, l: -100, o: 0.3 }, { s: 300, b: -100, r: -60, o: 0.25 }].map((c, i) => (
          <div key={i} style={{ position: 'absolute', width: c.s, height: c.s, borderRadius: '50%', background: 'white', opacity: c.o, filter: 'blur(80px)', top: c.t, left: c.l, right: c.r, bottom: c.b }} />
        ))}
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        <Reveal>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 50px)', fontWeight: 700, color: 'white', letterSpacing: '-1.2px', lineHeight: 1.15, marginBottom: 16 }}>
            Empieza gratis. Trae tu IA.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.85)', marginBottom: 32, lineHeight: 1.5 }}>
            Crea tu cuenta en @Social o abre el editor de @Pictures. Sin tarjeta y sin planes.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Magnetic>
              <motion.a href={URL_SOCIAL} whileTap={{ scale: 0.97 }}
                style={{ display: 'inline-block', padding: '15px 34px', borderRadius: 24, background: LIME, fontSize: 16, fontWeight: 700, color: INK, textDecoration: 'none', boxShadow: '0 8px 28px rgba(0,0,0,0.2)' }}>
                Entrar en @Social
              </motion.a>
            </Magnetic>
            <motion.a href={URL_EDITOR} whileHover={{ backgroundColor: 'rgba(255,255,255,0.16)' }} whileTap={{ scale: 0.97 }}
              style={{ display: 'inline-block', padding: '15px 28px', borderRadius: 24, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)', fontSize: 16, fontWeight: 500, color: 'white', textDecoration: 'none' }}>
              Abrir @Pictures
            </motion.a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Pie() {
  const cols = [
    { title: 'Apps', links: [['@Social', '/'], ['@Pictures', URL_PICTURES]] },
    { title: 'Código', links: [['@Social en GitHub', URL_GITHUB_SOCIAL], ['@Pictures en GitHub', URL_GITHUB_PICTURES], ['PhotoCraft', 'https://github.com/storytold/photocraft']] },
    { title: 'Legal', links: [['Privacidad', '/privacidad'], ['Términos', '/terminos'], ['Cookies', '/cookies']] },
  ]
  return (
    <footer style={{ background: INK, padding: '64px 32px 40px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="familia-pie" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }}>
          <div>
            <div style={{ marginBottom: 12 }}><MarcaAify claro tamano={18} /></div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, maxWidth: 280, margin: 0 }}>
              Apps gratis y de código abierto para quien crea contenido. Con tu propia IA.
            </p>
          </div>
          {cols.map(col => (
            <div key={col.title}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 14 }}>{col.title}</div>
              {col.links.map(([texto, href]) => (
                <a key={texto} href={href} style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', marginBottom: 8 }}>{texto}</a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>© 2026 Aify · Gratis y de código abierto</span>
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>{CONTACT_EMAIL}</a>
        </div>
      </div>
    </footer>
  )
}

const CSS = `
  @media (max-width: 900px) {
    .familia-dos { grid-template-columns: 1fr !important; gap: 28px !important; }
    .familia-pie { grid-template-columns: 1fr 1fr !important; }
    .familia-hero-floats { display: none !important; }
  }
  @media (max-width: 640px) {
    .familia-pie { grid-template-columns: 1fr !important; }
    .familia-desktop-nav { display: none !important; }
    .familia-mobile-nav { display: flex !important; }
  }
`

export default function Familia() {
  return (
    <div style={{ fontFamily: FONT, background: SURFACE, width: '100%', alignSelf: 'flex-start' }}>
      <style>{CSS}</style>
      <Navbar />
      <Hero />
      <FuncionaCon />
      <QueCambia />
      <LasApps />
      <TuIA />
      <CodigoAbierto />
      <Preguntas />
      <LlamadaFinal />
      <Pie />
    </div>
  )
}
