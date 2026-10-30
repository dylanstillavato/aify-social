import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RefreshCw, ExternalLink, Unlink, Sparkles, Upload, Copy } from 'lucide-react'
import { Skeleton } from './Skeleton'
import {
  getEstadoInstagram, getMetricasInstagram, conectarInstagram, desconectarInstagram, MOTIVOS_ERROR_CONEXION,
} from '../services/instagram'
import { getPostsDelMes } from '../hooks/useCalendario'
import DmAutomaticos from './DmAutomaticos'
import ConexionTikTok from './ConexionTikTok'
import EstudioVideo from './EstudioVideo'
import VariantesTrialModal from './VariantesTrialModal'
import { EvolucionDiaria, RendimientoFormato, Audiencia } from './MetricasAmpliadas'
import { tasa, porcentaje, segundos, interaccionesDe, mediaReels } from '../utils/metricasInstagram'

// Paso "Seguimiento" del cliente (Fase 8): métricas reales de Instagram.
// Autocontenido — solo necesita { cliente }. Estados:
//   sin configurar en el servidor → aviso
//   plan sin métricas → aviso
//   sin conectar / permiso caducado → botón "Conectar Instagram"
//   conectado → KPIs de los últimos 30 días + publicaciones del mes
// No hay datos de ejemplo: todo lo que se ve viene de Instagram.

const labelStyle = {
  fontSize: 11, fontWeight: 600, color: '#86868B',
  textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0,
}

const cardStyle = {
  background: 'var(--bg-card)', borderRadius: 18, padding: 22,
  boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid var(--border-subtle)',
  marginBottom: 16,
}

const botonPrimario = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', borderRadius: 10, border: 'none',
  background: 'var(--text-primary)', color: 'var(--bg-card)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
}

const botonSecundario = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 12, fontWeight: 500, padding: '6px 12px', borderRadius: 10,
  border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
  color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit',
}

const textoSecundario = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }

const TIPOS = { REEL: 'Reel', VIDEO: 'Vídeo', IMAGE: 'Imagen', CAROUSEL_ALBUM: 'Carrusel' }

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

function esDeInstagram(post) {
  return post.red === 'instagram' || (post.comparteEn || []).includes('instagram')
}

// Publicaciones del mes en curso cruzadas por fecha con el calendario; si
// este mes no hay ninguna, las más recientes sin cruzar.
function filasPublicaciones(publicaciones, postsPlan, año, mes) {
  const prefijoMes = `${año}-${String(mes + 1).padStart(2, '0')}`
  const delMes = publicaciones.filter(p => fechaLocal(p.fecha).startsWith(prefijoMes))
  if (delMes.length === 0) {
    return { tipo: 'recientes', lista: publicaciones.slice(0, 12).map(p => ({ ...p, planificado: null })), sinPublicar: 0 }
  }
  const usados = new Set()
  const lista = delMes.map(p => {
    const dia = fechaLocal(p.fecha)
    const planificado = postsPlan.find(c => c.fecha === dia && !usados.has(c.id)) || null
    if (planificado) usados.add(planificado.id)
    return { ...p, planificado }
  })
  const hoy = fechaLocal(new Date().toISOString())
  const sinPublicar = postsPlan.filter(c => !usados.has(c.id) && c.fecha < hoy).length
  return { tipo: 'mes', lista, sinPublicar }
}

function Tarjeta({ titulo, accion, children }) {
  return (
    <div style={cardStyle}>
      {(titulo || accion) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          {titulo && <p style={labelStyle}>{titulo}</p>}
          {accion}
        </div>
      )}
      {children}
    </div>
  )
}

function Aviso({ tono = 'neutro', children }) {
  const colores = {
    neutro: { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' },
    ok: { bg: 'rgba(48,164,108,0.10)', color: '#1F7A4D' },
    error: { bg: 'rgba(255,59,48,0.08)', color: '#C4271D' },
  }[tono]
  return (
    <p style={{ ...textoSecundario, background: colores.bg, color: colores.color, padding: '10px 12px', borderRadius: 10, marginBottom: 14 }}>
      {children}
    </p>
  )
}

// texto sustituye al número formateado (porcentajes)
function Kpi({ label, valor, texto }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '12px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{texto ?? numero(valor)}</div>
    </div>
  )
}

const esVideo = (p) => p.esVideo || p.tipo === 'REEL' || p.tipo === 'VIDEO'

function CargandoSeguimiento() {
  return (
    <div style={cardStyle}>
      <Skeleton width={160} height={12} style={{ marginBottom: 16 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={62} borderRadius={12} />)}
      </div>
      <Skeleton height={14} style={{ marginBottom: 8 }} />
      <Skeleton height={14} style={{ marginBottom: 8 }} />
      <Skeleton height={14} width="70%" />
    </div>
  )
}

// Lee (una vez) el resultado del OAuth que Instagram deja en la URL.
function mensajeRetornoOAuth(search) {
  const params = new URLSearchParams(search)
  const resultado = params.get('instagram')
  if (resultado === 'conectado') return { tono: 'ok', texto: 'Instagram conectado. Ya puedes ver sus métricas.' }
  if (resultado === 'error') return { tono: 'error', texto: MOTIVOS_ERROR_CONEXION[params.get('motivo')] || MOTIVOS_ERROR_CONEXION.error }
  return null
}

// conDms=false en la herramienta Métricas de Instagram, que no mezcla los DMs
// ni TikTok. En la ficha del cliente, TikTok va debajo de Instagram.
export default function SeguimientoCliente({ cliente, conDms = true }) {
  return (
    <>
      <SeguimientoInstagram cliente={cliente} conDms={conDms} />
      {conDms && cliente?.id && <ConexionTikTok clienteId={cliente.id} />}
    </>
  )
}

function SeguimientoInstagram({ cliente, conDms }) {
  const clienteId = cliente?.id
  const location = useLocation()
  const navigate = useNavigate()

  const [retorno] = useState(() => mensajeRetornoOAuth(location.search))
  const [recarga, setRecarga] = useState(0)
  // Cada resultado guarda la clave con la que se pidió: si no coincide con la
  // actual, está cargando (así no hace falta un setState síncrono en el efecto).
  const claveEstado = `${clienteId}|${recarga}`
  const [estado, setEstado] = useState(null) // { clave, data?, error? }
  const [metricas, setMetricas] = useState(null) // { clave, data?, error? }
  const [plan, setPlan] = useState(null) // { clave, posts }
  const [refrescando, setRefrescando] = useState(false)
  const [conectando, setConectando] = useState(false)
  const [errorAccion, setErrorAccion] = useState(null)
  const [estudio, setEstudio] = useState(null) // { publicacion } | { archivo }
  const [variantes, setVariantes] = useState(null) // publicación de la que sacar variantes Trial

  // Limpia ?instagram=... de la URL tras leerlo, para que no reaparezca.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('instagram')) return
    const params = new URLSearchParams(location.search)
    params.delete('instagram')
    params.delete('motivo')
    const query = params.toString()
    navigate(`${location.pathname}${query ? `?${query}` : ''}`, { replace: true })
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    if (!clienteId) return
    let activo = true
    getEstadoInstagram(clienteId)
      .then(data => { if (activo) setEstado({ clave: claveEstado, data }) })
      .catch(error => { if (activo) setEstado({ clave: claveEstado, error }) })
    return () => { activo = false }
  }, [clienteId, claveEstado])

  const estadoActual = estado?.clave === claveEstado ? estado : null
  const conectado = Boolean(estadoActual?.data?.conectado && estadoActual.data.configurado)

  useEffect(() => {
    if (!clienteId || !conectado) return
    let activo = true
    getMetricasInstagram(clienteId)
      .then(data => { if (activo) setMetricas({ clave: claveEstado, data }) })
      .catch(error => { if (activo) setMetricas({ clave: claveEstado, error }) })
    return () => { activo = false }
  }, [clienteId, conectado, claveEstado])

  // Posts del calendario de este mes, para cruzarlos por fecha con Instagram.
  const hoy = new Date()
  const año = hoy.getFullYear()
  const mes = hoy.getMonth()
  const clavePlan = `${clienteId}|${año}-${mes}`
  useEffect(() => {
    if (!clienteId || !conectado) return
    let activo = true
    getPostsDelMes(clienteId, año, mes)
      .then(({ data }) => { if (activo) setPlan({ clave: clavePlan, posts: (data || []).filter(esDeInstagram) }) })
      .catch(() => { if (activo) setPlan({ clave: clavePlan, posts: [] }) })
    return () => { activo = false }
  }, [clienteId, conectado, año, mes, clavePlan])

  const metricasActuales = metricas?.clave === claveEstado ? metricas : null
  const postsPlan = plan?.clave === clavePlan ? plan.posts : []
  const filas = filasPublicaciones(metricasActuales?.data?.publicaciones || [], postsPlan, año, mes)

  const conectar = async () => {
    setConectando(true)
    setErrorAccion(null)
    try {
      await conectarInstagram(clienteId)
    } catch (err) {
      setErrorAccion(err.message)
      setConectando(false)
    }
  }

  const refrescar = async () => {
    setRefrescando(true)
    setErrorAccion(null)
    try {
      const data = await getMetricasInstagram(clienteId, { refrescar: true })
      setMetricas({ clave: claveEstado, data })
    } catch (err) {
      if (err.codigo === 'reconectar') setRecarga(r => r + 1)
      else setErrorAccion(err.message)
    } finally {
      setRefrescando(false)
    }
  }

  const desconectar = async () => {
    if (!window.confirm('¿Desconectar Instagram de este cliente? Se borrarán el permiso y las métricas guardadas.')) return
    setErrorAccion(null)
    try {
      await desconectarInstagram(clienteId)
      setRecarga(r => r + 1)
    } catch (err) {
      setErrorAccion(err.message)
    }
  }

  if (!clienteId) return null

  const avisoRetorno = retorno && <Aviso tono={retorno.tono}>{retorno.texto}</Aviso>
  const avisoAccion = errorAccion && <Aviso tono="error">{errorAccion}</Aviso>

  // ── Cargando / error al consultar el estado ──
  if (!estadoActual) return <>{avisoRetorno}<CargandoSeguimiento /></>
  if (estadoActual.error) {
    return (
      <Tarjeta titulo="Instagram">
        {avisoRetorno}
        <Aviso tono="error">{estadoActual.error.message}</Aviso>
        <button type="button" style={botonSecundario} onClick={() => setRecarga(r => r + 1)}>
          <RefreshCw size={13} /> Reintentar
        </button>
      </Tarjeta>
    )
  }

  const { configurado, conexion } = estadoActual.data

  if (!configurado) {
    return (
      <Tarjeta titulo="Instagram">
        {avisoRetorno}
        <p style={textoSecundario}>La conexión con Instagram todavía no está configurada.</p>
      </Tarjeta>
    )
  }

  // ── Sin conectar (o permiso caducado) ──
  if (!conectado) {
    const caducada = conexion?.estado === 'caducada'
    return (
      <Tarjeta titulo="Instagram">
        {avisoRetorno}
        {avisoAccion}
        <p style={{ ...textoSecundario, marginBottom: 14 }}>
          {caducada
            ? `El permiso de @${conexion.ig_username || 'la cuenta'} caducó o se revocó. Vuelve a conectarla para seguir viendo sus métricas.`
            : 'Conecta la cuenta profesional de Instagram del cliente para ver su alcance, visualizaciones e interacciones reales.'}
        </p>
        <button type="button" style={{ ...botonPrimario, opacity: conectando ? 0.7 : 1, cursor: conectando ? 'wait' : 'pointer' }} onClick={conectar} disabled={conectando}>
          {conectando ? 'Abriendo Instagram…' : caducada ? 'Volver a conectar Instagram' : 'Conectar Instagram'}
        </button>
      </Tarjeta>
    )
  }

  // ── Conectado ──
  const usuario = conexion?.ig_username
  const accionesCabecera = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" style={{ ...botonSecundario, opacity: refrescando ? 0.6 : 1 }} onClick={refrescar} disabled={refrescando || !metricasActuales}>
        <RefreshCw size={13} /> {refrescando ? 'Actualizando…' : 'Actualizar'}
      </button>
      <button type="button" style={botonSecundario} onClick={desconectar}>
        <Unlink size={13} /> Desconectar
      </button>
    </div>
  )

  if (!metricasActuales) {
    return (
      <>
        {avisoRetorno}
        <Tarjeta titulo={usuario ? `Instagram · @${usuario}` : 'Instagram'} accion={accionesCabecera}>
          <p style={{ ...textoSecundario, marginBottom: 14 }}>Leyendo las métricas de Instagram…</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={62} borderRadius={12} />)}
          </div>
        </Tarjeta>
      </>
    )
  }

  if (metricasActuales.error) {
    const reconectar = metricasActuales.error.codigo === 'reconectar'
    return (
      <Tarjeta titulo={usuario ? `Instagram · @${usuario}` : 'Instagram'} accion={accionesCabecera}>
        {avisoRetorno}
        <Aviso tono="error">{metricasActuales.error.message}</Aviso>
        {reconectar
          ? <button type="button" style={botonPrimario} onClick={conectar} disabled={conectando}>Volver a conectar Instagram</button>
          : <button type="button" style={botonSecundario} onClick={() => setRecarga(r => r + 1)}><RefreshCw size={13} /> Reintentar</button>}
      </Tarjeta>
    )
  }

  const { perfil, cuenta, series, audiencia, publicaciones = [], actualizadoEn, aviso } = metricasActuales.data
  const tasaCuenta = tasa(cuenta?.interacciones, cuenta?.alcance)
  const kpis = [
    { label: 'Seguidores', valor: perfil?.seguidores },
    { label: 'Alcance', valor: cuenta?.alcance },
    { label: 'Visualizaciones', valor: cuenta?.visualizaciones },
    { label: 'Interacciones', valor: cuenta?.interacciones },
    { label: 'Cuentas que interactuaron', valor: cuenta?.cuentasInteraccion },
    { label: 'Me gusta', valor: cuenta?.meGusta },
    { label: 'Comentarios', valor: cuenta?.comentarios },
    { label: 'Guardados', valor: cuenta?.guardados },
    { label: 'Compartidos', valor: cuenta?.compartidos },
    // Nuevas: solo se enseñan si Meta las da para esta cuenta
    { label: 'Tasa de interacción', texto: porcentaje(tasaCuenta), opcional: tasaCuenta },
    { label: 'Nuevos seguidores', valor: cuenta?.nuevosSeguidores, opcional: cuenta?.nuevosSeguidores },
    { label: 'Dejaron de seguir', valor: cuenta?.dejaronDeSeguir, opcional: cuenta?.dejaronDeSeguir },
    { label: 'Clics en enlaces del perfil', valor: cuenta?.toquesEnlaces, opcional: cuenta?.toquesEnlaces },
    { label: 'Respuestas a historias', valor: cuenta?.respuestas, opcional: cuenta?.respuestas },
    { label: 'Reposts', valor: cuenta?.reposts, opcional: cuenta?.reposts },
  ].filter(k => !('opcional' in k) || k.opcional != null)
  const media = mediaReels(publicaciones)
  const hayRetencion = filas.lista.some(p => p.vistoMedioMs != null || p.saltos != null)
  const nombreMes = hoy.toLocaleDateString('es-ES', { month: 'long' })

  return (
    <>
      {avisoRetorno}
      <Tarjeta titulo={`Instagram${perfil?.usuario || usuario ? ` · @${perfil?.usuario || usuario}` : ''} · últimos 30 días`} accion={accionesCabecera}>
        {avisoAccion}
        {aviso && <Aviso>{aviso}</Aviso>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
          {kpis.map(k => <Kpi key={k.label} label={k.label} valor={k.valor} texto={k.texto} />)}
        </div>
        {actualizadoEn && (
          <p style={{ ...textoSecundario, fontSize: 11, marginTop: 12 }}>
            Datos de Instagram actualizados el {new Date(actualizadoEn).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.
          </p>
        )}
      </Tarjeta>

      <EvolucionDiaria series={series} />

      <Tarjeta titulo={filas.tipo === 'mes' ? `Publicaciones de ${nombreMes}` : 'Publicaciones recientes'}>
        {filas.tipo === 'recientes' && filas.lista.length > 0 && (
          <p style={{ ...textoSecundario, marginBottom: 12 }}>Este mes todavía no hay publicaciones en Instagram. Estas son las más recientes.</p>
        )}
        {filas.lista.length === 0 ? (
          <p style={textoSecundario}>Esta cuenta todavía no tiene publicaciones.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: hayRetencion ? 1040 : 860 }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', fontSize: 11, textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Publicación</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Alcance</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Visualizaciones</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Me gusta</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Comentarios</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Guardados</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Compartidos</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }} title="Interacciones sobre alcance">Interacción</th>
                  {hayRetencion && <th style={{ padding: '6px 8px', fontWeight: 600 }} title="Tiempo medio que la gente ve el reel">Visto de media</th>}
                  {hayRetencion && <th style={{ padding: '6px 8px', fontWeight: 600 }} title="Porcentaje de gente que pasó el reel en los primeros segundos">Lo saltaron</th>}
                  <th style={{ padding: '6px 8px', fontWeight: 600 }} aria-label="Estudio con IA" />
                </tr>
              </thead>
              <tbody>
                {filas.lista.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 8px', textAlign: 'left', maxWidth: 280 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {p.miniatura
                          ? <img src={p.miniatura} alt="" width={36} height={36} style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-secondary)', flexShrink: 0 }} />}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.planificado?.titulo || p.texto || TIPOS[p.tipo] || 'Publicación'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span>{fechaCorta(p.fecha)} · {TIPOS[p.tipo] || p.tipo}</span>
                            {p.planificado && <span>· del calendario</span>}
                            {p.enlace && (
                              <a href={p.enlace} target="_blank" rel="noreferrer" style={{ color: 'inherit', display: 'inline-flex' }} aria-label="Ver en Instagram">
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {[
                      numero(p.alcance), numero(p.visualizaciones), numero(p.meGusta), numero(p.comentarios), numero(p.guardados), numero(p.compartidos),
                      porcentaje(tasa(interaccionesDe(p), p.alcance)),
                      ...(hayRetencion ? [segundos(p.vistoMedioMs), porcentaje(p.saltos)] : []),
                    ].map((v, i) => (
                      <td key={i} style={{ padding: '10px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{v}</td>
                    ))}
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      {esVideo(p) && (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button type="button" style={{ ...botonSecundario, whiteSpace: 'nowrap' }} onClick={() => setEstudio({ publicacion: p })}>
                            <Sparkles size={13} /> Estudiar
                          </button>
                          <button type="button" style={{ ...botonSecundario, whiteSpace: 'nowrap' }} onClick={() => setVariantes(p)}
                            title="5 versiones de este reel para volver a subirlo como Trial Reel">
                            <Copy size={13} /> Variantes Trial
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filas.sinPublicar > 0 && (
          <p style={{ ...textoSecundario, fontSize: 12, marginTop: 12 }}>
            {filas.sinPublicar === 1
              ? 'Hay 1 publicación del calendario de este mes, con fecha pasada, que no aparece en Instagram.'
              : `Hay ${filas.sinPublicar} publicaciones del calendario de este mes, con fecha pasada, que no aparecen en Instagram.`}
          </p>
        )}
      </Tarjeta>

      <RendimientoFormato publicaciones={publicaciones} />
      <Audiencia audiencia={audiencia} />

      <Tarjeta titulo="Estudiar un vídeo antes de publicarlo">
        <p style={{ ...textoSecundario, marginBottom: 14 }}>
          Sube el vídeo y la IA revisa el gancho, el ritmo y el texto en pantalla, y te dice qué cambiar antes de publicarlo.
        </p>
        <label style={{ ...botonPrimario, display: 'inline-flex' }}>
          <Upload size={14} /> Subir vídeo
          <input type="file" accept="video/*" style={{ display: 'none' }}
            onChange={e => { const archivo = e.target.files?.[0]; e.target.value = ''; if (archivo) setEstudio({ archivo }) }} />
        </label>
      </Tarjeta>

      {estudio && (
        <EstudioVideo
          key={estudio.publicacion?.id || estudio.archivo?.name}
          cliente={cliente}
          publicacion={estudio.publicacion || null}
          archivo={estudio.archivo || null}
          mediaReels={media}
          onClose={() => setEstudio(null)}
        />
      )}

      {variantes && (
        <VariantesTrialModal key={variantes.id} cliente={cliente} publicacion={variantes} onClose={() => setVariantes(null)} />
      )}

      {conDms && <DmAutomaticos clienteId={clienteId} />}
    </>
  )
}
