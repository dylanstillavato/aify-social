import { useState } from 'react'
import { Tarjeta } from './instagramUi'
import { textoSecundario, labelStyle } from './instagramEstilos'
import { rendimientoPorFormato, porcentaje } from '../utils/metricasInstagram'

// Bloques extra de Métricas de Instagram: evolución diaria, rendimiento por
// formato y audiencia. Cada bloque se oculta si Meta no da esos datos
// (cuentas con menos de 100 seguidores o caché anterior a esta versión).

const COLOR_BARRA = '#1D5FE0' // sky-deep (DESIGN.md)
const numero = (v) => (v == null ? '—' : Number(v).toLocaleString('es-ES'))
const diaCorto = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

// Barras diarias de una sola serie, con tooltip al pasar el ratón o tocar
function BarrasDiarias({ titulo, serie }) {
  const [activo, setActivo] = useState(null)
  const max = Math.max(...serie.map(d => d.valor), 0)
  const total = serie.reduce((s, d) => s + d.valor, 0)
  const pico = serie.reduce((a, d) => (d.valor > (a?.valor ?? -1) ? d : a), null)
  const punto = activo != null ? serie[activo] : null

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <p style={labelStyle}>{titulo}</p>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {punto ? <><strong style={{ color: 'var(--text-primary)' }}>{numero(punto.valor)}</strong> el {diaCorto(punto.dia)}</>
            : <>Total <strong style={{ color: 'var(--text-primary)' }}>{numero(total)}</strong>{pico && max > 0 ? ` · pico ${numero(pico.valor)} el ${diaCorto(pico.dia)}` : ''}</>}
        </span>
      </div>
      <div role="img" aria-label={`${titulo}: total ${numero(total)} en ${serie.length} días`}
        style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110, borderBottom: '1px solid var(--border-subtle)' }}
        onMouseLeave={() => setActivo(null)}>
        {serie.map((d, i) => (
          <div key={d.dia} onMouseEnter={() => setActivo(i)} onClick={() => setActivo(i)}
            title={`${diaCorto(d.dia)}: ${numero(d.valor)}`}
            style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'default' }}>
            <div style={{
              width: '100%', borderRadius: '4px 4px 0 0', background: COLOR_BARRA,
              height: max > 0 ? `${Math.max(d.valor > 0 ? 2 : 0, (d.valor / max) * 100)}%` : 0,
              opacity: activo == null || activo === i ? 1 : 0.45,
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 4 }}>
        <span>{diaCorto(serie[0].dia)}</span>
        <span>{diaCorto(serie[serie.length - 1].dia)}</span>
      </div>
    </div>
  )
}

export function EvolucionDiaria({ series }) {
  const alcance = series?.alcance?.length > 1 ? series.alcance : null
  const seguidores = series?.nuevosSeguidores?.length > 1 ? series.nuevosSeguidores : null
  if (!alcance && !seguidores) return null
  return (
    <Tarjeta titulo="Día a día · últimos 30 días">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
        {alcance && <BarrasDiarias titulo="Alcance" serie={alcance} />}
        {seguidores && <BarrasDiarias titulo="Nuevos seguidores" serie={seguidores} />}
      </div>
    </Tarjeta>
  )
}

export function RendimientoFormato({ publicaciones }) {
  const filas = rendimientoPorFormato(publicaciones)
  if (filas.length === 0) return null
  const th = { padding: '6px 8px', fontWeight: 600, textAlign: 'right' }
  const td = { padding: '10px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }
  return (
    <Tarjeta titulo="Qué formato funciona mejor">
      <p style={{ ...textoSecundario, marginBottom: 12 }}>
        Media por publicación. Las tasas son sobre el alcance: qué parte de la gente que lo vio interactuó, lo guardó o lo compartió.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
          <thead>
            <tr style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
              <th style={{ ...th, textAlign: 'left' }}>Formato</th>
              <th style={th}>Publicaciones</th>
              <th style={th}>Alcance medio</th>
              <th style={th}>Visualizaciones</th>
              <th style={th}>Interacción</th>
              <th style={th}>Guardado</th>
              <th style={th}>Compartido</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.formato} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{f.formato}</td>
                <td style={td}>{f.n}</td>
                <td style={td}>{numero(f.alcance)}</td>
                <td style={td}>{numero(f.visualizaciones)}</td>
                <td style={td}>{porcentaje(f.tasaInteraccion)}</td>
                <td style={td}>{porcentaje(f.tasaGuardado)}</td>
                <td style={td}>{porcentaje(f.tasaCompartido)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  )
}

function BarrasHorizontales({ titulo, items }) {
  const total = items.reduce((s, i) => s + i.valor, 0)
  const max = Math.max(...items.map(i => i.valor), 0)
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ ...labelStyle, marginBottom: 10 }}>{titulo}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(i => (
          <div key={i.clave} title={`${i.clave}: ${numero(i.valor)}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.clave}</span>
              <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {total ? porcentaje(Math.round((i.valor / total) * 1000) / 10) : '—'}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: 'var(--bg-secondary)' }}>
              <div style={{ height: '100%', borderRadius: 4, background: COLOR_BARRA, width: max ? `${(i.valor / max) * 100}%` : 0 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const GENEROS = { F: 'Mujeres', M: 'Hombres', U: 'Sin indicar' }

export function Audiencia({ audiencia }) {
  const ciudades = audiencia?.ciudades?.length ? audiencia.ciudades.map(c => ({ ...c, clave: c.clave.split(',')[0] })) : null
  const edades = audiencia?.edades?.length ? audiencia.edades : null
  const generos = audiencia?.generos?.length ? audiencia.generos.map(g => ({ ...g, clave: GENEROS[g.clave] || g.clave })) : null
  if (!ciudades && !edades && !generos) return null
  return (
    <Tarjeta titulo="Quién le sigue">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
        {ciudades && <BarrasHorizontales titulo="Ciudades" items={ciudades} />}
        {edades && <BarrasHorizontales titulo="Edad" items={edades} />}
        {generos && <BarrasHorizontales titulo="Género" items={generos} />}
      </div>
      <p style={{ ...textoSecundario, fontSize: 11, marginTop: 14 }}>Seguidores de este mes según Instagram. El porcentaje de ciudades es sobre las que se muestran.</p>
    </Tarjeta>
  )
}
