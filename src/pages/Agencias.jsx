import { Users, Calendar, Sparkles, Check, X, Clock, TrendingUp, Building2 } from 'lucide-react'
import {
  SKY_DEEP, SKY_MID, SKY_LIGHT, LIME, INK, INK_SOFT, SURFACE, SURFACE_ALT, GREEN, RED, FONT,
  MarketingNavbar, MarketingFooter, SignupCard, SIGNUP_URL, MARKETING_CSS,
} from './marketing/shared'

// Pilar SEO: "Cómo una agencia atiende 10 clientes sin contratar más gente"
// (carrusel 02 del calendario de contenido). Página estática prerenderizada
// — ver src/entry-prerender.jsx. Sin useAuth()/useNavigate() a propósito
// (página pública de captación, no depende de sesión).

const SIN_AIFY = [
  'Cada cliente nuevo significa más horas tuyas, no más margen',
  'Contratar tarda meses y sale caro antes de que compense',
  'El calendario de cada cliente vive en su propia hoja o carpeta',
  'Escribir desde cero cada copy, cada guion, cada mes',
]

const CON_AIFY = [
  'El mismo equipo puede llevar 2-3x más clientes',
  'Escalas ingresos antes de escalar nómina',
  'Un calendario multi-cliente, con marca y tono propios de cada uno',
  'La IA genera la primera versión, tú la revisas y afinas',
]

const PASOS = [
  { icon: Building2, title: 'Un perfil por cliente', desc: 'Marca, tono, sector y objetivos de cada cliente quedan guardados — Aify no vuelve a preguntar lo mismo cada mes.' },
  { icon: Calendar, title: 'Calendario multi-cliente', desc: 'Ves y gestionas el calendario de todos tus clientes desde un solo sitio, sin saltar entre hojas de cálculo o carpetas de Drive.' },
  { icon: Sparkles, title: 'Generación en lote con IA', desc: 'Ideas, copies y guiones para varios clientes a la vez, ya adaptados al tono de cada uno — tú revisas y ajustas, no partes de cero.' },
  { icon: Clock, title: 'Horas que se convierten en capacidad', desc: 'Las horas que ya no gastas escribiendo desde cero son las horas que usas para atender al siguiente cliente.' },
]

function Hero() {
  return (
    <section style={{ position: 'relative', padding: '64px 24px 70px', overflow: 'hidden', background: `linear-gradient(180deg, ${SKY_DEEP} 0%, ${SKY_MID} 55%, ${SKY_LIGHT} 100%)` }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[{ s: 420, t: -60, l: -100, o: 0.4 }, { s: 360, b: -120, r: -60, o: 0.4 }].map((c, i) => (
          <div key={i} style={{ position: 'absolute', width: c.s, height: c.s, borderRadius: '50%', background: 'white', opacity: c.o, filter: 'blur(70px)', top: c.t, left: c.l, right: c.r, bottom: c.b }} />
        ))}
      </div>
      <div style={{ position: 'relative', maxWidth: 780, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '6px 14px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)', marginBottom: 22 }}>
          <Users size={13} color={LIME} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Para agencias y equipos de contenido</span>
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 5.2vw, 52px)', fontWeight: 700, color: 'white', letterSpacing: '-1.5px', lineHeight: 1.12, marginBottom: 20 }}>
          Cómo una agencia atiende 10 clientes sin contratar a nadie más
        </h1>
        <p style={{ fontSize: 17.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: 8, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
          Con el mismo equipo, la misma agencia puede llevar 3x más clientes cuando el calendario y la generación de contenido dejan de depender de escribir todo desde cero.
        </p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 34 }}>
          Sin invitación, sin lista de espera — regístrate y empieza ya.
        </p>
        <a href={SIGNUP_URL} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 26px', borderRadius: 24, background: LIME, fontSize: 15.5, fontWeight: 700, color: INK, textDecoration: 'none', fontFamily: FONT, boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}>
          Empezar prueba gratis
        </a>
      </div>
    </section>
  )
}

function Problema() {
  return (
    <section style={{ padding: '84px 24px', background: SURFACE }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4.2vw, 40px)', fontWeight: 700, color: INK, letterSpacing: '-1px', lineHeight: 1.15, marginBottom: 14 }}>
            El problema no es la demanda. Es que contratar no escala rápido.
          </h2>
          <p style={{ fontSize: 16.5, color: INK_SOFT, maxWidth: 620, margin: '0 auto', lineHeight: 1.6 }}>
            Cada cliente nuevo suma horas de calendario, copies y guiones. La respuesta clásica es contratar — pero contratar cuesta tiempo, dinero, y no compensa hasta que ese hire lleva meses produciendo.
          </p>
        </div>
        <div className="marketing-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ padding: '30px 28px', borderRadius: 20, background: SURFACE_ALT, border: '1px solid rgba(11,11,15,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 18 }}>Sin Aify</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {SIN_AIFY.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${RED}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <X size={11} color={RED} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 15, color: INK, lineHeight: 1.45 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '30px 28px', borderRadius: 20, background: INK }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: LIME, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 18 }}>Con Aify</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {CON_AIFY.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(215,255,61,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Check size={11} color={LIME} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 1.45 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Solucion() {
  return (
    <section style={{ padding: '84px 24px', background: SURFACE_ALT }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4.2vw, 40px)', fontWeight: 700, color: INK, letterSpacing: '-1px', marginBottom: 14 }}>
            Cómo lo resuelve Aify
          </h2>
          <p style={{ fontSize: 16.5, color: INK_SOFT, maxWidth: 560, margin: '0 auto' }}>
            Calendario multi-cliente + generación con IA — la combinación que hace que el equipo no crezca al mismo ritmo que la cartera de clientes.
          </p>
        </div>
        <div className="marketing-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
          {PASOS.map((p, i) => (
            <div key={i} style={{ padding: '28px 26px', borderRadius: 18, background: SURFACE, border: '1px solid rgba(11,11,15,0.06)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${SKY_MID}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <p.icon size={20} color={SKY_DEEP} strokeWidth={1.8} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: INK, letterSpacing: '-0.3px', marginBottom: 8 }}>{p.title}</h3>
              <p style={{ fontSize: 14.5, color: INK_SOFT, lineHeight: 1.6 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ProofStat() {
  return (
    <section style={{ padding: '64px 24px', background: SURFACE }}>
      <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ flex: '1 1 200px', padding: '28px 20px', borderRadius: 18, background: SURFACE_ALT }}>
          <TrendingUp size={22} color={SKY_DEEP} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 30, fontWeight: 700, color: INK, letterSpacing: '-1px' }}>3x</div>
          <div style={{ fontSize: 13.5, color: INK_SOFT }}>más clientes con el mismo equipo</div>
        </div>
        <div style={{ flex: '1 1 200px', padding: '28px 20px', borderRadius: 18, background: SURFACE_ALT }}>
          <Clock size={22} color={SKY_DEEP} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 30, fontWeight: 700, color: INK, letterSpacing: '-1px' }}>12h</div>
          <div style={{ fontSize: 13.5, color: INK_SOFT }}>ahorradas por semana, por persona*</div>
        </div>
        <div style={{ flex: '1 1 200px', padding: '28px 20px', borderRadius: 18, background: SURFACE_ALT }}>
          <Calendar size={22} color={SKY_DEEP} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 30, fontWeight: 700, color: INK, letterSpacing: '-1px' }}>1</div>
          <div style={{ fontSize: 13.5, color: INK_SOFT }}>calendario para todos los clientes</div>
        </div>
      </div>
      <p style={{ textAlign: 'center', fontSize: 12.5, color: '#9A9CA5', marginTop: 18 }}>
        *Estimación a partir del uso reportado por agencias en fase beta — no es una garantía de resultado, varía según el volumen de clientes y el punto de partida.
      </p>
    </section>
  )
}

export default function Agencias() {
  return (
    <div style={{ fontFamily: FONT, background: SURFACE, width: '100%' }}>
      <style>{MARKETING_CSS}</style>
      <MarketingNavbar />
      <Hero />
      <Problema />
      <Solucion />
      <ProofStat />
      <section style={{ padding: '84px 24px 96px', background: SURFACE }}>
        <SignupCard
          eyebrow="Empieza hoy"
          title="Prueba Aify con tu agencia, sin invitación"
          subtitle="Crea tu cuenta y monta el calendario de tu primer cliente en minutos — no hace falta esperar a que te invitemos."
          ctaLabel="Empezar prueba gratis"
        />
      </section>
      <MarketingFooter />
    </div>
  )
}
