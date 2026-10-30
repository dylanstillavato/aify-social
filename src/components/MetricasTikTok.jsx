import { useEffect, useState } from 'react'
import { RefreshCw, ExternalLink } from 'lucide-react'
import { Tarjeta, Aviso } from './instagramUi'
import { botonPrimario, botonSecundario, textoSecundario } from './instagramEstilos'
import { Skeleton } from './Skeleton'
import { getMetricasTikTok, esDeTikTok } from '../services/tiktok'
import { getPostsDelMes } from '../hooks/useCalendario'
import { tasa, porcentaje } from '../utils/metricasInstagram'

// Métricas de TikTok en el Seguimiento del cliente, debajo de la conexión.
// Mismo aspecto que las de Instagram (SeguimientoCliente), con lo que da la API
// de TikTok: contadores de la cuenta y, por vídeo público, visualizaciones, me
// gusta, comentarios y compartidos. Sin alcance, sin retención y sin «Estudiar»
// (TikTok no da el archivo del vídeo para que la IA lo vea).

function numero(valor) {
  return valor == null ? '—' : Number(valor).toLocaleString('es-ES')
}

function fechaLocal(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fechaCorta(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function Kpi({ label, valor, texto }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '12px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{texto ?? numero(valor)}</div>
    </div>
  )
}

const interaccionesDe = (v) => {
  const partes = [v.meGusta, v.comentarios, v.compartidos]
  return partes.every(p => p == null) ? null : partes.reduce((s, p) => s + (Number(p) || 0), 0)
}

// Vídeos del mes en curso cruzados por fecha con el calendario (posts de
// TikTok); si este mes no hay ninguno, los más recientes sin cruzar. Como
// filasPublicaciones de SeguimientoCliente.
function filasVideos(videos, postsPlan, año, mes) {
  const prefijoMes = `${año}-${String(mes + 1).padStart(2, '0')}`
  const conFecha = videos.filter(v => v.fecha)
  const delMes = conFecha.filter(v => fechaLocal(v.fecha).startsWith(prefijoMes))
  if (delMes.length === 0) {
    return { tipo: 'recientes', lista: conFecha.slice(0, 12).map(v => ({ ...v, planificado: null })), sinPublicar: 0 }
  }
  const usados = new Set()
  const lista = delMes.map(v => {
    const dia = fechaLocal(v.fecha)
    const planificado = postsPlan.find(c => c.fecha === dia && !usados.has(c.id)) || null
    if (planificado) usados.add(planificado.id)
    return { ...v, planificado }
  })
  const hoy = fechaLocal(new Date().toISOString())
  const sinPublicar = postsPlan.filter(c => !usados.has(c.id) && c.fecha < hoy).length
  return { tipo: 'mes', lista, sinPublicar }
}

export default function MetricasTikTok({ clienteId, usuario, onReconectar }) {
  const [recarga, setRecarga] = useState(0)
  const clave = `${clienteId}|${recarga}`
  const [metricas, setMetricas] = useState(null) // { clave, data?, error? }
  const [plan, setPlan] = useState(null) // { clave, posts }
  const [refrescando, setRefrescando] = useState(false)
  const [errorAccion, setErrorAccion] = useState(null)

  useEffect(() => {
    if (!clienteId) return
    let activo = true
    getMetricasTikTok(clienteId)
      .then(data => { if (activo) setMetricas({ clave, data }) })
      .catch(error => { if (activo) setMetricas({ clave, error }) })
    return () => { activo = false }
  }, [clienteId, clave])

  // Posts de TikTok del calendario de este mes, para cruzarlos por fecha.
  const hoy = new Date()
  const año = hoy.getFullYear()
  const mes = hoy.getMonth()
  const clavePlan = `${clienteId}|${año}-${mes}`
  useEffect(() => {
    if (!clienteId) return
    let activo = true
    getPostsDelMes(clienteId, año, mes)
      .then(({ data }) => { if (activo) setPlan({ clave: clavePlan, posts: (data || []).filter(esDeTikTok) }) })
      .catch(() => { if (activo) setPlan({ clave: clavePlan, posts: [] }) })
    return () => { activo = false }
  }, [clienteId, año, mes, clavePlan])

  const refrescar = async () => {
    setRefrescando(true)
    setErrorAccion(null)
    try {
      const data = await getMetricasTikTok(clienteId, { refrescar: true })
      setMetricas({ clave, data })
    } catch (err) {
      if (err.codigo === 'reconectar') setRecarga(r => r + 1)
      else setErrorAccion(err.message)
    } finally {
      setRefrescando(false)
    }
  }

  const actual = metricas?.clave === clave ? metricas : null
  const postsPlan = plan?.clave === clavePlan ? plan.posts : []
  const titulo = usuario ? `Métricas de TikTok · @${usuario}` : 'Métricas de TikTok'
  const accion = (
    <button type="button" style={{ ...botonSecundario, opacity: refrescando ? 0.6 : 1 }} onClick={refrescar} disabled={refrescando || !actual?.data}>
      <RefreshCw size={13} /> {refrescando ? 'Actualizando…' : 'Actualizar'}
    </button>
  )

  if (!actual) {
    return (
      <Tarjeta titulo={titulo}>
        <p style={{ ...textoSecundario, marginBottom: 14 }}>Leyendo las métricas de TikTok…</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={62} borderRadius={12} />)}
        </div>
      </Tarjeta>
    )
  }

  if (actual.error) {
    const reconectar = actual.error.codigo === 'reconectar'
    return (
      <Tarjeta titulo={titulo}>
        <Aviso tono="error">{actual.error.message}</Aviso>
        {reconectar && onReconectar
          ? <button type="button" style={botonPrimario} onClick={onReconectar}>Volver a conectar TikTok</button>
          : <button type="button" style={botonSecundario} onClick={() => setRecarga(r => r + 1)}><RefreshCw size={13} /> Reintentar</button>}
      </Tarjeta>
    )
  }

  const { perfil, cuenta, videos = [], actualizadoEn, aviso } = actual.data
  const tasaCuenta = tasa(interaccionesDe(cuenta || {}), cuenta?.visualizaciones)
  const kpis = [
    { label: 'Seguidores', valor: perfil?.seguidores },
    { label: 'Siguiendo', valor: perfil?.siguiendo },
    { label: 'Me gusta (total de la cuenta)', valor: perfil?.meGusta },
    { label: 'Vídeos', valor: perfil?.videos },
    { label: `Visualizaciones (${cuenta?.videosListados ?? 0} vídeos)`, valor: cuenta?.visualizaciones },
    { label: 'Me gusta', valor: cuenta?.meGusta },
    { label: 'Comentarios', valor: cuenta?.comentarios },
    { label: 'Compartidos', valor: cuenta?.compartidos },
    { label: 'Tasa de interacción', texto: porcentaje(tasaCuenta), opcional: tasaCuenta },
  ].filter(k => !('opcional' in k) || k.opcional != null)
  const filas = filasVideos(videos, postsPlan, año, mes)
  const nombreMes = hoy.toLocaleDateString('es-ES', { month: 'long' })

  return (
    <>
      <Tarjeta titulo={titulo} accion={accion}>
        {errorAccion && <Aviso tono="error">{errorAccion}</Aviso>}
        {aviso && <Aviso>{aviso}</Aviso>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
          {kpis.map(k => <Kpi key={k.label} label={k.label} valor={k.valor} texto={k.texto} />)}
        </div>
        <p style={{ ...textoSecundario, fontSize: 11, marginTop: 12 }}>
          Visualizaciones, me gusta, comentarios y compartidos son la suma de los últimos vídeos públicos de la cuenta. TikTok no da alcance ni retención.
          {actualizadoEn && ` Datos de TikTok actualizados el ${new Date(actualizadoEn).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`}
        </p>
      </Tarjeta>

      <Tarjeta titulo={filas.tipo === 'mes' ? `Vídeos de TikTok de ${nombreMes}` : 'Vídeos de TikTok recientes'}>
        {filas.tipo === 'recientes' && filas.lista.length > 0 && (
          <p style={{ ...textoSecundario, marginBottom: 12 }}>Este mes todavía no hay vídeos en TikTok. Estos son los más recientes.</p>
        )}
        {filas.lista.length === 0 ? (
          <p style={textoSecundario}>Esta cuenta todavía no tiene vídeos públicos.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', fontSize: 11, textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Vídeo</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Visualizaciones</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Me gusta</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Comentarios</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Compartidos</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }} title="Me gusta, comentarios y compartidos sobre visualizaciones">Interacción</th>
                </tr>
              </thead>
              <tbody>
                {filas.lista.map(v => (
                  <tr key={v.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 8px', textAlign: 'left', maxWidth: 280 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {v.miniatura
                          ? <img src={v.miniatura} alt="" width={36} height={36} style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-secondary)', flexShrink: 0 }} />}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {v.planificado?.titulo || v.texto || 'Vídeo'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span>{fechaCorta(v.fecha)}{v.duracionSeg != null ? ` · ${v.duracionSeg} s` : ''}</span>
                            {v.planificado && <span>· del calendario</span>}
                            {v.enlace && (
                              <a href={v.enlace} target="_blank" rel="noreferrer" style={{ color: 'inherit', display: 'inline-flex' }} aria-label="Ver en TikTok">
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {[
                      numero(v.visualizaciones), numero(v.meGusta), numero(v.comentarios), numero(v.compartidos),
                      porcentaje(tasa(interaccionesDe(v), v.visualizaciones)),
                    ].map((valor, i) => (
                      <td key={i} style={{ padding: '10px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{valor}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filas.sinPublicar > 0 && (
          <p style={{ ...textoSecundario, fontSize: 12, marginTop: 12 }}>
            {filas.sinPublicar === 1
              ? 'Hay 1 publicación de TikTok del calendario de este mes, con fecha pasada, que no aparece en TikTok.'
              : `Hay ${filas.sinPublicar} publicaciones de TikTok del calendario de este mes, con fecha pasada, que no aparecen en TikTok.`}
          </p>
        )}
      </Tarjeta>
    </>
  )
}
