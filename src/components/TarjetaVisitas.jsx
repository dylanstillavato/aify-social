import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, ChevronRight } from 'lucide-react'
import { getVisitasMensuales } from '../services/instagram'

// Tarjeta del Inicio, junto al saludo: visualizaciones por mes sumando todas
// las cuentas de Instagram y TikTok conectadas en Seguimiento (últimos 6
// meses). El histórico lo guarda el servidor: instagram_visitas_mes (0048),
// porque Meta solo da 30 días por consulta, y las fotos diarias de TikTok
// (tiktok_metricas_dia, 0050), porque TikTok solo da los totales de ahora.

const AZUL = '#1D5FE0'
const NUM = { fontVariantNumeric: 'tabular-nums' }
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const compacto = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 })
const entero = new Intl.NumberFormat('es-ES')

function mesDe(iso) {
  return Number(iso.slice(5, 7)) - 1
}

// Desglose por red para el tooltip de cada barra
function desglose(m) {
  const partes = [['Instagram', m.instagram], ['TikTok', m.tiktok]].filter(([, v]) => v != null)
  return partes.length > 1 ? partes.map(([red, v]) => `${red}: ${entero.format(v)}`).join(' · ') : undefined
}

function cuentasTexto(datos) {
  const ig = datos.cuentasInstagram ?? datos.cuentas
  const tt = datos.cuentasTikTok ?? 0
  if (!tt) return `${ig} ${ig === 1 ? 'cuenta' : 'cuentas'}`
  if (!ig) return `${tt} ${tt === 1 ? 'cuenta' : 'cuentas'} de TikTok`
  return `${ig} de Instagram y ${tt} de TikTok`
}

function Barras({ meses }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...meses.map(m => m.visualizaciones || 0))
  const ultimo = meses.length - 1
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 92, marginTop: 10 }} onMouseLeave={() => setHover(null)}>
      {meses.map((m, i) => {
        const valor = m.visualizaciones
        const alto = valor ? Math.max(4, Math.round((valor / max) * 70)) : 3
        const activo = i === (hover ?? ultimo)
        return (
          <div key={m.mes} onMouseEnter={() => setHover(i)} title={desglose(m)}
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'default' }}>
            <div style={{ ...NUM, fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)', visibility: hover === i ? 'visible' : 'hidden', whiteSpace: 'nowrap' }}>
              {valor == null ? 'sin dato' : compacto.format(valor)}
            </div>
            <div style={{
              width: '100%', maxWidth: 34, height: alto, borderRadius: 6,
              background: valor == null ? 'var(--bg-secondary)' : activo ? AZUL : 'rgba(29,95,224,0.22)',
              transition: 'background 0.15s',
            }} />
            <div style={{ fontSize: 10.5, fontWeight: i === ultimo ? 700 : 500, color: i === ultimo ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
              {MESES_CORTOS[mesDe(m.mes)]}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Aviso({ texto, boton, onClick }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{texto}</p>
      {boton && (
        <button onClick={onClick}
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 3, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: AZUL }}>
          {boton} <ChevronRight size={13} />
        </button>
      )}
    </div>
  )
}

export default function TarjetaVisitas() {
  const navigate = useNavigate()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vivo = true
    getVisitasMensuales()
      .then(d => { if (vivo) setDatos(d) })
      .catch(e => { if (vivo) setError(e.message) })
    return () => { vivo = false }
  }, [])

  const meses = datos?.meses || []
  const actual = meses[meses.length - 1]?.visualizaciones ?? null
  const anterior = meses[meses.length - 2]?.visualizaciones ?? null
  const cambio = actual != null && anterior ? Math.round(((actual - anterior) / anterior) * 100) : null

  let cuerpo
  if (error) {
    cuerpo = <Aviso texto={error} />
  } else if (!datos) {
    cuerpo = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'flex-end' }}>
        <div style={{ height: 28, width: '45%', borderRadius: 8, background: 'var(--bg-secondary)' }} />
        <div style={{ height: 80, width: '100%', borderRadius: 8, background: 'var(--bg-secondary)' }} />
      </div>
    )
  } else if (!datos.configurado) {
    cuerpo = <Aviso texto="La conexión con Instagram y TikTok todavía no está configurada en el servidor." />
  } else if (datos.cuentas === 0) {
    cuerpo = <Aviso texto="Conecta el Instagram o el TikTok de tus clientes desde su Seguimiento y aquí verás las visualizaciones de todos, mes a mes." boton="Ir a clientes" onClick={() => navigate('/clientes')} />
  } else {
    cuerpo = (
      <>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ ...NUM, fontSize: 30, fontWeight: 700, letterSpacing: '-0.8px', color: 'var(--text-primary)', lineHeight: 1 }}>
            {actual == null ? '—' : entero.format(actual)}
          </span>
          {cambio != null && (
            <span style={{ ...NUM, fontSize: 12.5, fontWeight: 700, color: cambio >= 0 ? '#1F9D55' : '#FF3B30' }}>
              {cambio >= 0 ? '+' : ''}{cambio} % vs {MESES_CORTOS[mesDe(meses[meses.length - 2].mes)]}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
          Este mes, hasta hoy · {cuentasTexto(datos)}
        </div>
        <div style={{ flex: 1 }} />
        <Barras meses={meses} />
      </>
    )
  }

  return (
    <section style={{
      height: '100%', boxSizing: 'border-box', background: 'var(--bg-card)', borderRadius: 24,
      border: '1px solid var(--border-subtle)', padding: '20px 22px 16px', display: 'flex', flexDirection: 'column', minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(29,95,224,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Eye size={15} color={AZUL} />
        </span>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.2px' }}>Visualizaciones por mes</h2>
      </div>
      {cuerpo}
    </section>
  )
}
