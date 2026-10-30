import { useState, useMemo } from 'react'
import { Calculator, Users, FileText, Clock, Info, Euro } from 'lucide-react'
import {
  SKY_DEEP, SKY_MID, SKY_LIGHT, LIME, INK, INK_SOFT, INK_FAINT, SURFACE, SURFACE_ALT, GREEN, FONT,
  MarketingNavbar, MarketingFooter, SignupCard, MARKETING_CSS,
} from './marketing/shared'

// Pilar SEO / herramienta: "Cuánto tiempo ahorra una agencia usando IA para
// contenido" (carrusel 06 del calendario de contenido). Calculadora
// interactiva 100% client-side, sin backend ni gate de captura para usarla
// — es la pieza pensada para compartirse/enlazarse fuera de Aify, con un
// CTA opcional al final. Página estática prerenderizada, sin
// useAuth()/useNavigate().

function NumberField({ label, value, onChange, suffix, min = 0, step = 1, hint }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: INK, marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(11,11,15,0.15)', fontSize: 15, fontFamily: FONT, color: INK, outline: 'none' }}
        />
        {suffix && <span style={{ fontSize: 13.5, color: INK_SOFT, whiteSpace: 'nowrap' }}>{suffix}</span>}
      </div>
      {hint && <p style={{ fontSize: 12, color: INK_FAINT, marginTop: 5, lineHeight: 1.4 }}>{hint}</p>}
    </div>
  )
}

export default function Calculadora() {
  const [clientes, setClientes] = useState(8)
  const [piezasPorCliente, setPiezasPorCliente] = useState(12)
  const [horasPorPieza, setHorasPorPieza] = useState(1.5)
  const [ahorroPct, setAhorroPct] = useState(60)
  const [tarifaHora, setTarifaHora] = useState(25)

  const resultado = useMemo(() => {
    const horasHoy = clientes * piezasPorCliente * horasPorPieza
    const horasAhorradas = horasHoy * (ahorroPct / 100)
    const horasConAify = horasHoy - horasAhorradas
    const ahorroEuros = horasAhorradas * tarifaHora
    return { horasHoy, horasAhorradas, horasConAify, ahorroEuros }
  }, [clientes, piezasPorCliente, horasPorPieza, ahorroPct, tarifaHora])

  const fmt = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 })
  const fmtEur = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })

  return (
    <div style={{ fontFamily: FONT, background: SURFACE, width: '100%' }}>
      <style>{MARKETING_CSS}</style>
      <MarketingNavbar />

      <section style={{ position: 'relative', padding: '56px 24px 50px', overflow: 'hidden', background: `linear-gradient(180deg, ${SKY_DEEP} 0%, ${SKY_MID} 55%, ${SKY_LIGHT} 100%)` }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {[{ s: 380, t: -80, l: -100, o: 0.4 }, { s: 320, b: -100, r: -60, o: 0.35 }].map((c, i) => (
            <div key={i} style={{ position: 'absolute', width: c.s, height: c.s, borderRadius: '50%', background: 'white', opacity: c.o, filter: 'blur(70px)', top: c.t, left: c.l, right: c.r, bottom: c.b }} />
          ))}
        </div>
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '6px 14px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)', marginBottom: 22 }}>
            <Calculator size={13} color={LIME} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Calculadora gratuita, sin registro</span>
          </div>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 700, color: 'white', letterSpacing: '-1.4px', lineHeight: 1.15, marginBottom: 16 }}>
            ¿Cuánto tiempo ahorra tu agencia usando IA para contenido?
          </h1>
          <p style={{ fontSize: 16.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxWidth: 560, margin: '0 auto' }}>
            Mete tus números reales. Es una estimación, no una promesa — pero te da una idea de dónde estás perdiendo horas.
          </p>
        </div>
      </section>

      <section style={{ padding: '56px 24px 90px', background: SURFACE }}>
        <div className="marketing-2col" style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
          {/* Inputs */}
          <div style={{ padding: '30px 28px', borderRadius: 20, background: SURFACE_ALT, border: '1px solid rgba(11,11,15,0.06)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Users size={16} color={SKY_DEEP} />
              <span style={{ fontSize: 13, fontWeight: 700, color: INK, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Tu situación hoy</span>
            </div>
            <NumberField label="Número de clientes" value={clientes} onChange={setClientes} min={1} />
            <NumberField label="Piezas de contenido por cliente al mes" value={piezasPorCliente} onChange={setPiezasPorCliente} min={1} suffix="/mes" />
            <NumberField label="Horas que te lleva hoy crear una pieza" value={horasPorPieza} onChange={setHorasPorPieza} min={0.1} step={0.25} suffix="horas" />

            <div style={{ height: 1, background: 'rgba(11,11,15,0.08)', margin: '4px 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Info size={16} color={SKY_DEEP} />
              <span style={{ fontSize: 13, fontWeight: 700, color: INK, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Supuestos (editables)</span>
            </div>
            <NumberField
              label="Ahorro de tiempo estimado con Aify"
              value={ahorroPct}
              onChange={(v) => setAhorroPct(Math.min(95, v))}
              min={0}
              step={5}
              suffix="%"
              hint="Valor por defecto orientativo (60%), no un dato medido para tu caso — ajústalo si tienes tu propia referencia."
            />
            <NumberField
              label="Tu tarifa por hora"
              value={tarifaHora}
              onChange={setTarifaHora}
              min={1}
              step={1}
              suffix="€/hora"
              hint="Por defecto 25€/h como referencia orientativa — cámbialo por tu tarifa real."
            />
          </div>

          {/* Resultados */}
          <div style={{ padding: '30px 28px', borderRadius: 20, background: INK, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} color={LIME} />
              <span style={{ fontSize: 13, fontWeight: 700, color: LIME, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Resultado estimado</span>
            </div>

            <div style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Horas dedicadas hoy, al mes</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'white', letterSpacing: '-0.6px' }}>{fmt(resultado.horasHoy)} h</div>
            </div>

            <div style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(215,255,61,0.12)', border: `1px solid ${LIME}40` }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>Horas que podrías ahorrar al mes</div>
              <div style={{ fontSize: 34, fontWeight: 700, color: LIME, letterSpacing: '-1px' }}>{fmt(resultado.horasAhorradas)} h</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>quedarían {fmt(resultado.horasConAify)} h/mes con Aify</div>
            </div>

            <div style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Euro size={13} color="rgba(255,255,255,0.6)" />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Equivalente a tu tarifa</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'white', letterSpacing: '-0.6px' }}>{fmtEur(resultado.ahorroEuros)} €/mes</div>
            </div>

            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginTop: 4 }}>
              Estimación basada en los supuestos editables de la izquierda — no es una cifra garantizada, cámbiala para ajustarla a tu caso real.
            </p>
          </div>
        </div>
      </section>

      <section style={{ padding: '20px 24px 96px', background: SURFACE_ALT }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '6px 14px', background: `${LIME}22`, border: '1px solid #BEE62A', marginBottom: 16 }}>
            <FileText size={13} color="#7A9400" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#5A6B00' }}>Esto es una estimación, no una promesa</span>
          </div>
        </div>
        <SignupCard
          eyebrow="Empieza hoy"
          title="¿Quieres ahorrar esto de verdad?"
          subtitle="Empieza tu prueba gratis de 30 días y monta tu primer calendario con IA — sin invitación, sin esperas."
          ctaLabel="Empezar prueba gratis"
          dark={false}
        />
      </section>

      <MarketingFooter />
    </div>
  )
}
