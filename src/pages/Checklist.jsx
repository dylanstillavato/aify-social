import { useState } from 'react'
import { ClipboardList, Lightbulb, Shuffle, UserCheck, ListChecks, Palette, Check } from 'lucide-react'
import {
  SKY_DEEP, SKY_MID, SKY_LIGHT, LIME, INK, INK_SOFT, SURFACE, SURFACE_ALT, GREEN, FONT,
  MarketingNavbar, MarketingFooter, WaitlistCard, SIGNUP_URL, MARKETING_CSS,
} from './marketing/shared'

// Pilar SEO: "5 errores que hacen colapsar el calendario de contenido de una
// agencia" (carrusel 03 del calendario de contenido). El copy de los 5
// errores NO reutiliza palabra por palabra el carrusel 03 del artefacto
// "Carruseles para AIFY" — no había acceso a ese artefacto al construir esta
// página — pero mantiene el mismo ángulo (los fallos operativos típicos de
// una agencia gestionando el calendario de varios clientes a la vez).
// Página estática prerenderizada, sin useAuth()/useNavigate().

const ERRORES = [
  {
    icon: Lightbulb,
    title: 'No tener un banco de ideas',
    desc: 'Cada mes se parte de cero: "¿qué publicamos esta semana?" en vez de tirar de un banco de ideas ya pensado por cliente. El resultado es contenido reactivo, de última hora, y perder horas pensando lo que ya deberías tener escrito.',
  },
  {
    icon: Shuffle,
    title: 'Mezclar el calendario de clientes distintos',
    desc: 'Una sola hoja, una sola carpeta o un solo tablero para todos los clientes. Es fácil publicar el copy equivocado en la cuenta equivocada, o perder de vista qué le toca a quién esta semana.',
  },
  {
    icon: UserCheck,
    title: 'No delegar la generación de primeras versiones',
    desc: 'Todo copy, guion o idea sale de una sola persona escribiendo desde cero. Sin una primera versión generada (por IA o por el equipo junior) que solo haya que revisar, el cuello de botella eres tú.',
  },
  {
    icon: ListChecks,
    title: 'Perder el hilo de qué se aprobó y qué no',
    desc: 'El feedback del cliente vive disperso entre WhatsApp, email y comentarios sueltos. Sin un estado claro por pieza (borrador, en revisión, aprobado), se publica algo que el cliente nunca vio o se repite trabajo ya aprobado.',
  },
  {
    icon: Palette,
    title: 'Publicar sin revisar marca y tono por cliente',
    desc: 'El copy de un cliente formal suena igual que el de uno desenfadado porque nadie revisó el tono antes de publicar. Sin un perfil de marca guardado por cliente, la consistencia depende de la memoria de quien escribe ese día.',
  },
]

function Hero() {
  return (
    <section style={{ position: 'relative', padding: '64px 24px 60px', overflow: 'hidden', background: `linear-gradient(180deg, ${SKY_DEEP} 0%, ${SKY_MID} 55%, ${SKY_LIGHT} 100%)` }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[{ s: 380, t: -80, r: -80, o: 0.4 }, { s: 320, b: -100, l: -60, o: 0.4 }].map((c, i) => (
          <div key={i} style={{ position: 'absolute', width: c.s, height: c.s, borderRadius: '50%', background: 'white', opacity: c.o, filter: 'blur(70px)', top: c.t, left: c.l, right: c.r, bottom: c.b }} />
        ))}
      </div>
      <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '6px 14px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)', marginBottom: 22 }}>
          <ClipboardList size={13} color={LIME} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Checklist para agencias y freelances</span>
        </div>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 700, color: 'white', letterSpacing: '-1.4px', lineHeight: 1.15, marginBottom: 18 }}>
          5 errores que hacen colapsar el calendario de contenido de una agencia
        </h1>
        <p style={{ fontSize: 16.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxWidth: 560, margin: '0 auto' }}>
          Si gestionas contenido para varios clientes a la vez, probablemente ya te ha pasado alguno de estos. Revísalos uno por uno.
        </p>
      </div>
    </section>
  )
}

function ChecklistInteractiva() {
  const [checked, setChecked] = useState(() => ERRORES.map(() => false))
  const total = checked.filter(Boolean).length
  const toggle = (i) => setChecked((c) => c.map((v, idx) => (idx === i ? !v : v)))

  return (
    <section style={{ padding: '70px 24px 20px', background: SURFACE }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: INK, letterSpacing: '-0.4px' }}>Marca los que te suenan</h2>
          <span style={{ fontSize: 14, fontWeight: 600, color: total === ERRORES.length ? GREEN : INK_SOFT }}>{total}/{ERRORES.length} marcados</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ERRORES.map((err, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 16, textAlign: 'left', width: '100%',
                padding: '20px 22px', borderRadius: 16, cursor: 'pointer', fontFamily: FONT,
                background: checked[i] ? `${GREEN}0D` : SURFACE_ALT,
                border: checked[i] ? `1.5px solid ${GREEN}50` : '1px solid rgba(11,11,15,0.06)',
                transition: 'background 0.2s, border 0.2s',
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: checked[i] ? GREEN : 'white', border: checked[i] ? 'none' : '1.5px solid rgba(11,11,15,0.18)',
              }}>
                {checked[i] && <Check size={15} color="white" strokeWidth={3} />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <err.icon size={16} color={SKY_DEEP} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>{i + 1}. {err.title}</span>
                </div>
                <p style={{ fontSize: 14.5, color: INK_SOFT, lineHeight: 1.6, margin: 0 }}>{err.desc}</p>
              </div>
            </button>
          ))}
        </div>
        {total > 0 && (
          <p style={{ textAlign: 'center', fontSize: 14.5, color: INK_SOFT, marginTop: 24 }}>
            {total === ERRORES.length
              ? 'Los cinco a la vez es la señal más clara de que el problema no es de esfuerzo, es de sistema.'
              : `Con ${total} de estos ya vale la pena revisar cómo está montado el calendario.`}
          </p>
        )}
      </div>
    </section>
  )
}

export default function Checklist() {
  return (
    <div style={{ fontFamily: FONT, background: SURFACE, width: '100%' }}>
      <style>{MARKETING_CSS}</style>
      <MarketingNavbar />
      <Hero />
      <ChecklistInteractiva />
      <section style={{ padding: '70px 24px 96px', background: SURFACE }}>
        <WaitlistCard
          origen="checklist"
          eyebrow="Checklist descargable"
          title="Llévate la checklist en PDF"
          subtitle="Deja tu email y te mandamos la versión descargable de esta checklist. Aify es self-serve — si quieres probarlo ya, no hace falta esperar: puedes empezar tu prueba gratis de 30 días cuando quieras."
          ctaLabel="Quiero la checklist"
        />
        <p style={{ textAlign: 'center', fontSize: 14, color: INK_SOFT, marginTop: 20 }}>
          O sáltate el email —{' '}
          <a href={SIGNUP_URL} style={{ color: SKY_DEEP, fontWeight: 600, textDecoration: 'none' }}>empieza tu prueba gratis</a>{' '}
          y pruébalo directamente.
        </p>
      </section>
      <MarketingFooter />
    </div>
  )
}
