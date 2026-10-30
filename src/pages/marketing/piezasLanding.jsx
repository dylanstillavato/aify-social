// Piezas de la portada (src/pages/Landing.jsx) que también usa la landing de la
// familia Aify (/demo, src/pages/Familia.jsx): animaciones de entrada, tarjetas
// flotantes del hero, maquetas y el logo «@ Aify …». Solo componentes, para que
// el refresco rápido de Vite funcione; los colores están en ./shared.
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { Check } from 'lucide-react'
import faviconIcon from '../../assets/favicon-icon.png'
import { SKY_DEEP, SKY_MID, SKY_LIGHT, INK, INK_SOFT, INK_FAINT, CARD, GREEN, ORANGE } from './shared'

const NET_COLORS = {
  instagram: '#E1306C', tiktok: '#0B0B0F', googlemaps: '#EA4335',
  whatsapp: '#25D366', facebook: '#1877F2', youtube: '#FF0000',
}

export function Reveal({ children, as: As = 'div', y = 28, stagger = 0, delay = 0, style, className }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const targets = stagger ? gsap.utils.toArray(el.children) : el
    gsap.set(targets, { opacity: 0, y })
    // IntersectionObserver (not ScrollTrigger) on purpose: this app's global
    // layout makes `body`, not `window`, the real scroll container (see
    // html,body,#root{height:100%} in index.css), which fights ScrollTrigger's
    // scroll-position tracking. IntersectionObserver checks viewport visibility
    // directly, so it's unaffected by which ancestor actually owns the scroll.
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        gsap.to(targets, { opacity: 1, y: 0, duration: 0.9, delay, ease: 'power3.out', stagger })
        io.disconnect()
      }
    }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [y, stagger, delay])
  return <As ref={ref} style={style} className={className}>{children}</As>
}

export function Magnetic({ children, strength = 16, style }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' })
    const move = e => {
      const r = el.getBoundingClientRect()
      xTo((e.clientX - r.left - r.width / 2) / r.width * strength)
      yTo((e.clientY - r.top - r.height / 2) / r.height * strength)
    }
    const leave = () => { xTo(0); yTo(0) }
    el.addEventListener('mousemove', move)
    el.addEventListener('mouseleave', leave)
    return () => { el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave) }
  }, [strength])
  return <div ref={ref} style={{ display: 'inline-block', ...style }}>{children}</div>
}

export function BenefitRow({ text, icon: Icon = Check, color = GREEN }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <Icon size={11} color={color} strokeWidth={2.5} />
      </div>
      <span style={{ fontSize: 15, color: INK, lineHeight: 1.4 }}>{text}</span>
    </div>
  )
}

const SAMPLE_POSTS = { 1:'instagram', 3:'tiktok', 5:'instagram', 8:'instagram', 10:'googlemaps', 12:'tiktok', 15:'instagram', 17:'whatsapp', 19:'instagram', 22:'tiktok', 24:'instagram', 26:'googlemaps', 29:'instagram', 31:'tiktok' }
const DIAS = ['L','M','X','J','V','S','D']

export function CalendarioMockup({ compact }) {
  const offset = 3
  const total = 31
  const cells = Array.from({ length: offset + total }, (_, i) => i < offset ? null : i - offset + 1)
  return (
    <div style={{ background: CARD, borderRadius: 14, padding: compact ? 10 : 14, boxShadow: '0 2px 20px rgba(11,11,15,0.06)' }}>
      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>Mayo 2026</span>
          <span style={{ fontSize: 10, color: SKY_DEEP, fontWeight: 500 }}>La Buena Mesa</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
        {DIAS.map(d => <div key={d} style={{ fontSize: 8, color: INK_SOFT, textAlign: 'center', fontWeight: 600 }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.slice(0, compact ? 21 : 35).map((dia, i) => (
          <div key={i} style={{ height: compact ? 14 : 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, background: dia && SAMPLE_POSTS[dia] ? `${NET_COLORS[SAMPLE_POSTS[dia]]}15` : 'transparent' }}>
            {dia && <span style={{ fontSize: 8, color: dia && SAMPLE_POSTS[dia] ? NET_COLORS[SAMPLE_POSTS[dia]] : INK_FAINT, fontWeight: SAMPLE_POSTS[dia] ? 700 : 400 }}>{dia}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CopiesMockup() {
  const copies = [
    { red: 'instagram', label: 'Variante A · Emocional', text: 'El secreto de nuestra burger de la casa que nadie te había contado...' },
    { red: 'tiktok', label: 'Variante B · Urgencia', text: 'POV: Solo quedan 3 unidades de nuestro nuevo shake de temporada...' },
    { red: 'instagram', label: 'Variante C · Humor', text: 'Señales de que eres de los nuestros: pides la carta y ya sabes lo que vas a tomar.' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {copies.map((c, i) => (
        <div key={i} style={{ background: CARD, borderRadius: 12, padding: '10px 12px', borderLeft: `3px solid ${NET_COLORS[c.red]}`, boxShadow: '0 1px 8px rgba(11,11,15,0.06)' }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: NET_COLORS[c.red], marginBottom: 4 }}>{c.label}</div>
          <div style={{ fontSize: 11, color: INK, lineHeight: 1.4 }}>{c.text}</div>
        </div>
      ))}
    </div>
  )
}

export function GuionMockup() {
  const scenes = [
    { t: '0-2s', label: 'Gancho', text: '"Lo que nunca te muestran en los restaurantes..."', color: SKY_DEEP },
    { t: '2-8s', label: 'Desarrollo', text: 'Plano detalle: manos preparando la masa artesanal', color: SKY_LIGHT },
    { t: '8-18s', label: 'Revelación', text: 'Texto: "El pan que comes hoy se hizo esta mañana"', color: ORANGE },
    { t: '18-22s', label: 'CTA', text: 'Reserva en el link de bio', color: GREEN },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {scenes.map((s, i) => (
        <div key={i} style={{ background: CARD, borderRadius: 10, padding: '8px 12px', display: 'flex', gap: 10, boxShadow: '0 1px 8px rgba(11,11,15,0.06)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: s.color }}>{s.t}</span>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: s.color }}>{s.label}</div>
            <div style={{ fontSize: 10, color: INK, lineHeight: 1.3 }}>{s.text}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function GenericMockup({ tab }) {
  if (tab === 'calendario') return <CalendarioMockup />
  if (tab === 'copies') return <CopiesMockup />
  if (tab === 'guiones') return <GuionMockup />
  return (
    <div style={{ background: CARD, borderRadius: 14, padding: 20, boxShadow: '0 2px 20px rgba(11,11,15,0.06)' }}>
      <div style={{ height: 8, borderRadius: 4, background: `${SKY_MID}25`, marginBottom: 10, width: '60%' }} />
      {[100, 85, 92].map((w, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(11,11,15,0.06)', marginBottom: 4 }}>
            <div style={{ height: '100%', width: `${w}%`, background: SKY_MID, borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 9, color: INK_SOFT }}>Optimización #{i + 1}</div>
        </div>
      ))}
    </div>
  )
}

// A small floating card used scattered across the hero sky.
export function FloatingCard({ style, children, rotate = 0, delay = 0 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return undefined
    gsap.to(ref.current, { y: -10, duration: 3 + Math.random(), ease: 'sine.inOut', repeat: -1, yoyo: true, delay })
    return undefined
  }, [delay])
  return (
    <div data-hero-float ref={ref} style={{ position: 'absolute', transform: `rotate(${rotate}deg)`, ...style }}>
      {children}
    </div>
  )
}

// El logo: la @ de la foto de perfil, «Aify» en Super Jello y el nombre de la
// app en gris (como en la cabecera de la portada). Sobre fondo oscuro, invertido.
export function MarcaAify({ app, claro = false, tamano = 17 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <img src={faviconIcon} alt="" style={{ width: tamano + 9, height: tamano + 9, borderRadius: 7, filter: claro ? 'invert(1) brightness(1.6)' : 'none', transition: 'filter 0.3s' }} />
      <span style={{ fontFamily: 'var(--font-display)', fontSize: tamano, color: claro ? 'rgba(255,255,255,0.92)' : INK, lineHeight: 1, whiteSpace: 'nowrap', transition: 'color 0.3s' }}>
        Aify{app && <> <span style={{ color: claro ? 'rgba(255,255,255,0.7)' : INK_SOFT, transition: 'color 0.3s' }}>{app}</span></>}
      </span>
    </span>
  )
}
