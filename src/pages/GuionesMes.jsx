import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, ChevronDown, Sparkles, Send, Download, AlertCircle, X,
  Clapperboard, CheckCircle2, MessageSquareWarning, Clock, UserPlus, CalendarDays, Square, ListChecks, Edit3,
  Video, Images, ArrowLeftRight, Trash2, RotateCcw, Copy,
} from 'lucide-react'
import { useClientesList } from '../hooks/useClientes'
import { useClienteActivo } from '../hooks/useClienteActivo'
import { useCalendarioMes, actualizarPost, eliminarPost, aprobarPostManual, crearPost } from '../hooks/useCalendario'
import { actualizarIdea, eliminarIdeaConGuiones, useIdeasList } from '../hooks/useIdeas'
import { usePlanMes } from '../hooks/usePlanMes'
import IdeasGuardadasMes from '../components/IdeasGuardadasMes'
import GenerarGuionesModal from '../components/GenerarGuionesModal'
import { useGeneraciones, useGeneracionDePantalla } from '../hooks/useGeneraciones'
import { pasarAPorPublicar, crearTareaPorGrabar, quitarTareaPorGrabar } from '../services/tareasAutomaticas'
import { esCarrusel, formatoDe, otroFormato, etiquetaFormato, esSinTexto, etiquetaEstilo } from '../utils/formato'
import { generarGuion, generarPlanos, generarPiezaSinTexto, generarGuionesSimilares } from '../services/ai'
import { exportarGuionesMes } from '../services/exportPDF'
import { addActividad } from '../hooks/useActividad'
import TablaPlanos from '../components/TablaPlanos'
import HistoriaCincoLineas from '../components/HistoriaCincoLineas'
import VersionesGuion from '../components/VersionesGuion'
import EnviarAprobacionModal from '../components/EnviarAprobacionModal'
import HojaRodaje from '../components/HojaRodaje'
import EscribirGuionModal from '../components/EscribirGuionModal'
import PlanProduccion, { TITULO_GRABACION } from '../components/PlanProduccion'
import { useFechasMarcadas } from '../hooks/useInvestigacion'
import { REDES_CONTENIDO, redesDelCliente } from '../utils/redes'
import { useEsMovil } from '../hooks/useEsMovil'

// Guiones del mes: el lote de guiones de un cliente para un mes (vídeos y
// carruseles), con planos para grabar y editar (en los carruseles, slides con
// texto e imagen; se cambia de formato con el chip Vídeo/Carrusel), y un
// enlace para que el cliente los apruebe (ver 0019_aprobacion_guiones.sql).
// Es la pieza que el gestor enseña como "lo que justifica el precio". Con los
// guiones aprobados, PlanProduccion fija grabación y edición (Fase 6).
//
// Los guiones generados desde las ideas guardadas llegan sin programar
// (enCalendario false, 0030): solo se añaden al calendario, con su fecha de
// publicación, después del día de grabación.
//
// Dos modos: página propia (/guiones-del-mes, elige cliente con el cliente
// activo compartido) o incrustada en la ficha de cliente (paso Guiones de
// ClienteDetalle) pasando `clienteId` fijo: sin cabecera ni selector de
// cliente, y los atajos a ideas/calendario cambian de pestaña con `onIrAPaso`.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Lo que tiene guion o es vídeo/carrusel; antes todo lo que tenía guion contaba como vídeo
const esPieza = (p) => !!p.guion || esCarrusel(p) || /video|v[ií]deo|reel|tiktok|short/i.test(p.formato || '')
const temaDe = (p) => [p.titulo, p.concepto].filter(Boolean).join('. ')

const ESTADO = {
  sinGuion: { label: 'Sin guion', color: '#86868B', icon: Clapperboard },
  pendiente: { label: 'Pendiente de aprobar', color: '#FF9500', icon: Clock },
  aprobado: { label: 'Aprobado', color: '#30D158', icon: CheckCircle2 },
  cambios: { label: 'Cambios pedidos', color: '#FF3B30', icon: MessageSquareWarning },
}
const estadoDe = (p) => !p.guion ? 'sinGuion' : (p.aprobacionEstado || 'pendiente')
const sinProgramar = (p) => p.enCalendario === false
const RED_LABELS = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube',
  linkedin: 'LinkedIn', whatsapp: 'WhatsApp', googlemaps: 'Google Maps',
}
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Stat({ n, label, color }) {
  return (
    <div style={{ flex: '1 1 110px', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-secondary)' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text-primary)', letterSpacing: '-0.4px' }}>{n}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Boton({ icon: Icon, children, onClick, disabled, primary, title }) {
  return (
    <motion.button whileTap={{ scale: disabled ? 1 : 0.97 }} onClick={onClick} disabled={disabled} title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 11,
        border: primary ? 'none' : '1px solid var(--border-color)',
        background: disabled ? 'var(--bg-secondary)' : primary ? '#D7FF3D' : 'var(--bg-card)',
        color: disabled ? 'var(--text-tertiary)' : primary ? '#0B0C10' : 'var(--text-primary)',
        fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
      <Icon size={14} /> {children}
    </motion.button>
  )
}

// `resaltado`: recién escrito desde «Guionizar» (se marca unos segundos)
function FilaGuion({ post, cliente, abierto, onToggle, onGuardado, bloqueado, programar, resaltado = false }) {
  // Borrador solo mientras se edita; si no, se enseñan los planos guardados
  // (así un guion regenerado se ve al momento sin sincronizar estado)
  const [borrador, setBorrador] = useState(null)
  const planos = borrador ?? post.guion?.planos ?? null
  // Las acciones con IA van a la cola de generaciones (siguen al cambiar de
  // página); al volver, el botón sigue «Generando...» hasta que acaben
  const { ejecutar, enCurso } = useGeneracionDePantalla()
  const [trabajandoAqui, setTrabajando] = useState(null)
  const trabajando = trabajandoAqui || enCurso(`guion-${post.id}`)?.accion || null
  const [error, setError] = useState(null)
  const [confirmarFormato, setConfirmarFormato] = useState(false)
  const restaurarRef = useRef(null)
  const restaurar = (guion) => { if (trabajando || !guion) return; restaurarRef.current = guion; accion('restaurar') }
  const est = ESTADO[estadoDe(post)]
  const Icon = est.icon
  const sucio = borrador !== null && JSON.stringify(borrador) !== JSON.stringify(post.guion?.planos || null)
  const formato = formatoDe(post)
  const carrusel = formato === 'carrusel'
  // Vídeo de solo planos / carrusel de solo fotos: sin guion ni texto
  const sinTexto = esSinTexto(post)
  const [confirmarEstilo, setConfirmarEstilo] = useState(false)
  const escribir = (fmt, sinTxt) => (sinTxt
    ? generarPiezaSinTexto(cliente, temaDe(post), fmt)
    : generarGuion(cliente, temaDe(post), false, [], fmt))
  // Carrusel con un guion escrito como vídeo (planos de cámara): pasaba al
  // desarrollar desde Ideas, que no pasaba el formato a generarGuion
  const guionDeVideo = carrusel && post.guion && post.guion.formato !== 'carrusel' && post.guion.planos?.[0]?.plano !== 'Portada'

  const guardarGuion = async (guion) => {
    const { error: err } = await actualizarPost(cliente.id, post.id, { guion, desarrollado: true })
    if (err) throw new Error(err.message || 'No se pudo guardar')
    setBorrador(null)
    onGuardado()
  }

  // Tipo de trabajo (para la media de duración de la barra) y título de cada acción con IA
  const CON_IA = {
    formato: { tipo: 'guion', titulo: 'Cambiar de formato' },
    estilo: { tipo: 'guion', titulo: 'Guion' },
    generar: { tipo: 'guion', titulo: 'Guion' },
    planos: { tipo: 'planos', titulo: 'Planos' },
    similares: { tipo: 'guiones-similares', titulo: 'Guiones similares a' },
  }

  const accion = async (tipo) => {
    setTrabajando(tipo); setError(null)
    try {
      const conIa = CON_IA[tipo] && !(tipo === 'formato' && !post.guion) ? CON_IA[tipo] : null
      if (conIa) {
        await ejecutar({
          tipo: conIa.tipo, accion: tipo, clave: `guion-${post.id}`,
          titulo: `${conIa.titulo} «${post.titulo || 'Sin título'}» · ${cliente.nombre}`,
          clienteId: cliente.id,
          destino: { ruta: `/clientes/${cliente.id}?mes=${String(post.fecha || '').slice(0, 7)}`, state: { tabInicial: 'guiones' } },
        }, () => hacer(tipo))
      } else {
        await hacer(tipo)
      }
    } catch (e) {
      setError(e.message || 'Algo ha fallado. Intenta de nuevo.')
    } finally {
      setTrabajando(null)
    }
  }

  const hacer = async (tipo) => {
    if (tipo === 'formato') {
      // Vídeo ⇄ carrusel: con guion se reescribe en el formato nuevo; sin guion solo cambia el formato
      const nuevo = otroFormato(formato)
      if (post.guion) {
        const guion = await escribir(nuevo, sinTexto)
        if (!guion?.gancho) throw new Error('La IA no devolvió un guion válido. Intenta de nuevo.')
        const { error: err } = await actualizarPost(cliente.id, post.id, { guion, formato: nuevo, desarrollado: true })
        if (err) throw new Error(err.message || 'No se pudo guardar')
        setBorrador(null)
      } else {
        const { error: err } = await actualizarPost(cliente.id, post.id, { formato: nuevo })
        if (err) throw new Error(err.message || 'No se pudo guardar')
      }
      if (post.origenIdeaId) await actualizarIdea(post.origenIdeaId, { formato: nuevo })
      setConfirmarFormato(false)
      onGuardado()
    } else if (tipo === 'estilo') {
      // Con guion ⇄ sin texto (solo planos / solo fotos), mismo formato
      const guion = await escribir(formato, !sinTexto)
      if (!guion?.gancho) throw new Error('La IA no devolvió un guion válido. Intenta de nuevo.')
      await guardarGuion(guion)
      setConfirmarEstilo(false)
    } else if (tipo === 'generar') {
      const guion = await escribir(formato, sinTexto)
      if (!guion?.gancho) throw new Error('La IA no devolvió un guion válido. Intenta de nuevo.')
      await guardarGuion(guion)
      addActividad({ tipo: 'guion', descripcion: `Guion viral: "${post.titulo}"`, clienteNombre: cliente.nombre, count: 1 })
    } else if (tipo === 'planos') {
      const nuevos = await generarPlanos(cliente, temaDe(post), post.guion)
      await guardarGuion({ ...post.guion, planos: nuevos })
    } else if (tipo === 'guardar') {
      await guardarGuion({ ...post.guion, planos })
    } else if (tipo === 'similares') {
      // Mismo tipo de pieza con otro tema: entran como guiones sin fecha del
      // mismo mes, igual que los de "Escribir guion". El modelo no se toca.
      const guiones = await generarGuionesSimilares(cliente, post, 3)
      const año = Number(post.fecha.slice(0, 4))
      const mes = Number(post.fecha.slice(5, 7))
      for (const g of guiones) {
        const { error: err } = await crearPost({
          clienteId: cliente.id, fecha: `${año}-${String(mes).padStart(2, '0')}-01`, dia: 1, mes, año,
          red: post.red, formato: post.formato || formato, titulo: g.titulo, concepto: g.gancho,
          guion: {
            gancho: g.gancho, planos: g.planos,
            ...(g.historia ? { historia: g.historia } : {}),
            ...(carrusel ? { formato: 'carrusel' } : {}),
            ...(sinTexto ? { sinTexto: true } : {}),
          },
          desarrollado: true, estado: 'borrador', enCalendario: false,
        })
        if (err) throw new Error(err.message || 'No se pudo guardar')
      }
      onGuardado()
      addActividad({ tipo: 'guion', descripcion: `Guiones similares a "${post.titulo}"`, clienteNombre: cliente.nombre, count: guiones.length })
      return { texto: `${guiones.length} ${guiones.length === 1 ? 'guion' : 'guiones'}` }
    } else if (tipo === 'restaurar') {
      // Una versión de otro formato (de antes de pasar a vídeo/carrusel) devuelve también el formato
      const anterior = restaurarRef.current
      const formatoAnterior = formatoDe({ guion: anterior })
      const cambiaFormato = formatoAnterior !== formato
      const { error: err } = await actualizarPost(cliente.id, post.id, { guion: anterior, desarrollado: true, ...(cambiaFormato ? { formato: formatoAnterior } : {}) })
      if (err) throw new Error(err.message || 'No se pudo restaurar')
      if (cambiaFormato && post.origenIdeaId) await actualizarIdea(post.origenIdeaId, { formato: formatoAnterior })
      setBorrador(null)
      onGuardado()
    }
  }

  // Aprobar a mano: el cliente dio el ok fuera del enlace (WhatsApp, en persona)
  const aprobarAMano = async (e) => {
    e.stopPropagation()
    if (trabajando) return
    const aprobar = post.aprobacionEstado !== 'aprobado'
    setTrabajando('aprobar'); setError(null)
    const { error: err } = await aprobarPostManual(cliente.id, post.id, aprobar)
    setTrabajando(null)
    if (err) { setError(err.message || 'No se pudo cambiar la aprobación.'); return }
    // Solo los aprobados están en el tablero de tareas
    await (aprobar
      ? crearTareaPorGrabar({ cliente, post, titulo: post.titulo, red: post.red, formato: post.formato })
      : quitarTareaPorGrabar(post)
    ).catch(e => console.warn('[GuionesMes] no se pudo actualizar la tarea:', e.message))
    onGuardado()
  }

  // Borrar (segundo clic confirma): se va el guion y, si salió de una idea
  // guardada, también la idea, para que las dos listas cuadren
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const borrar = async (e) => {
    e.stopPropagation()
    if (trabajando) return
    if (!confirmarBorrar) { setConfirmarBorrar(true); return }
    setTrabajando('borrar'); setError(null)
    const { error: err } = post.origenIdeaId
      ? await eliminarIdeaConGuiones(cliente.id, post.origenIdeaId)
      : await eliminarPost(cliente.id, post.id)
    setTrabajando(null)
    setConfirmarBorrar(false)
    if (err) { setError(err.message || 'No se pudo borrar.'); return }
    onGuardado()
  }

  const fecha = sinProgramar(post)
    ? 'Sin fecha'
    : new Date(`${post.fecha}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })

  // Añadir al calendario: solo guiones sin programar y después del día de grabación
  const redes = redesDelCliente(cliente)
  const [fechaPub, setFechaPub] = useState(() => isoLocal(new Date(Date.now() + 86400000)))
  const [redPub, setRedPub] = useState(post.red || redes[0] || 'instagram')
  const añadirAlCalendario = async () => {
    if (!fechaPub || !programar?.disponible) return
    setTrabajando('calendario'); setError(null)
    try {
      const { error: err } = await actualizarPost(cliente.id, post.id, { fecha: fechaPub, red: redPub, enCalendario: true })
      if (err) throw new Error(err.message || 'No se pudo añadir al calendario')
      // Su tarjeta de producción pasa a «Por publicar» (#85)
      await pasarAPorPublicar({ ...post, fecha: fechaPub }).catch(e => console.warn('[GuionesMes] no se pudo mover la tarea:', e.message))
      onGuardado()
    } catch (e) {
      setError(e.message || 'No se pudo añadir al calendario.')
    } finally {
      setTrabajando(null)
    }
  }

  return (
    <div style={{ background: resaltado ? 'rgba(215,255,61,0.18)' : 'var(--bg-card)', borderRadius: 14, border: resaltado ? '1.5px solid #B8E000' : '1px solid var(--border-subtle)', overflow: 'hidden', transition: 'background 0.6s, border-color 0.6s' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}>
        <div style={{ width: 44, fontSize: 12, fontWeight: 600, color: sinProgramar(post) ? 'var(--text-tertiary)' : 'var(--text-secondary)', flexShrink: 0, textTransform: sinProgramar(post) ? 'none' : 'capitalize', lineHeight: 1.2 }}>{fecha}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.titulo || (carrusel ? 'Carrusel sin título' : 'Vídeo sin título')}
          </div>
          {post.guion && !post.guion.planos?.length && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Sin planos</div>
          )}
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, color: carrusel ? '#1D5FE0' : '#FF2D55', background: carrusel ? 'rgba(29,95,224,0.08)' : 'rgba(255,45,85,0.08)', flexShrink: 0 }}>
          {carrusel ? <Images size={11} /> : <Video size={11} />} {etiquetaFormato(formato)}{sinTexto ? ` · ${etiquetaEstilo(formato, true).toLowerCase()}` : ''}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, color: est.color, background: `${est.color}14`, flexShrink: 0 }}>
          <Icon size={11} /> {est.label}
        </span>
        {post.guion && (
          <button onClick={aprobarAMano} disabled={!!trabajando}
            title={post.aprobacionEstado === 'aprobado'
              ? 'Quitar la aprobación: vuelve a pendiente de aprobar'
              : 'Aprobar a mano (el cliente lo aprobó por WhatsApp o en persona)'}
            style={{ display: 'flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', borderRadius: 8, border: post.aprobacionEstado === 'aprobado' ? '1px solid var(--border-color)' : 'none', background: post.aprobacionEstado === 'aprobado' ? 'transparent' : '#30D158', color: post.aprobacionEstado === 'aprobado' ? 'var(--text-secondary)' : 'white', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: trabajando ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: trabajando === 'aprobar' ? 0.5 : 1 }}>
            {post.aprobacionEstado === 'aprobado'
              ? <><RotateCcw size={12} /> Deshacer</>
              : <><CheckCircle2 size={12} /> {trabajando === 'aprobar' ? 'Aprobando...' : 'Aprobar'}</>}
          </button>
        )}
        <button onClick={borrar} onBlur={() => setConfirmarBorrar(false)} disabled={trabajando === 'borrar'}
          title={post.origenIdeaId ? 'Borrar guion y su idea' : 'Borrar guion'}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 26, minWidth: 26, padding: confirmarBorrar ? '0 10px' : 0, borderRadius: 8, border: 'none', background: confirmarBorrar ? '#FF3B30' : 'rgba(255,59,48,0.08)', color: confirmarBorrar ? 'white' : '#FF3B30', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0, opacity: trabajando === 'borrar' ? 0.5 : 1 }}>
          <Trash2 size={12} />{confirmarBorrar && (trabajando === 'borrar' ? 'Borrando...' : '¿Borrar?')}
        </button>
        <ChevronDown size={14} color="#86868B" style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </div>

      <AnimatePresence>
        {abierto && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
              {post.aprobacionComentario && (
                <div style={{ margin: '12px 0', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FF3B30', marginBottom: 3 }}>
                    {post.aprobacionEstado === 'cambios' ? 'EL CLIENTE PIDE' : 'ÚLTIMO COMENTARIO DEL CLIENTE'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{post.aprobacionComentario}</div>
                </div>
              )}

              {!post.guion ? (
                <div style={{ padding: '14px 0 2px' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
                    {post.concepto || (carrusel ? 'Este carrusel todavía no tiene guion.' : 'Este vídeo todavía no tiene guion.')}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Boton icon={Sparkles} primary onClick={() => accion('generar')} disabled={!!trabajando || bloqueado}>
                      {trabajando === 'generar' ? 'Generando guion...' : carrusel ? 'Generar guion del carrusel' : 'Generar guion con planos'}
                    </Boton>
                    <Boton icon={Sparkles} onClick={() => accion('estilo')} disabled={!!trabajando || bloqueado}
                      title="Sin guion ni texto: solo la lista de planos o fotos">
                      {trabajando === 'estilo' ? 'Generando...' : carrusel ? 'Solo fotos' : 'Solo planos'}
                    </Boton>
                    <Boton icon={ArrowLeftRight} onClick={() => accion('formato')} disabled={!!trabajando || bloqueado}>
                      {trabajando === 'formato' ? 'Cambiando...' : `Pasar a ${etiquetaFormato(otroFormato(formato)).toLowerCase()}`}
                    </Boton>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ margin: '12px 0' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1D5FE0', marginBottom: 3 }}>{sinTexto ? (carrusel ? 'PRIMERA FOTO' : 'PRIMERA IMAGEN') : carrusel ? 'PORTADA' : 'GANCHO'}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{post.guion.gancho}</div>
                  </div>

                  <HistoriaCincoLineas historia={post.guion.historia} />

                  {guionDeVideo && (
                    <div style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.25)' }}>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 10px', lineHeight: 1.5 }}>
                        Este guion está escrito como vídeo (con planos de cámara), no como carrusel. Reescríbelo en slides{post.aprobacionEstado ? '; vuelve a pendiente de aprobar' : ''}.
                      </p>
                      <Boton icon={Sparkles} primary onClick={() => accion('generar')} disabled={!!trabajando || bloqueado}>
                        {trabajando === 'generar' ? 'Reescribiendo...' : 'Reescribir como carrusel'}
                      </Boton>
                    </div>
                  )}

                  {planos?.length ? (
                    <>
                      <TablaPlanos planos={planos} onChange={setBorrador} carrusel={carrusel} sinTexto={sinTexto} />
                      {sinTexto && post.guion.audio_sugerido && (
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 0' }}>Música: {post.guion.audio_sugerido}</p>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Boton icon={CheckCircle2} primary onClick={() => accion('guardar')} disabled={!sucio || !!trabajando}>
                          {trabajando === 'guardar' ? 'Guardando...' : carrusel ? 'Guardar slides' : 'Guardar planos'}
                        </Boton>
                        <Boton icon={Sparkles} onClick={() => accion('generar')} disabled={!!trabajando || bloqueado}>
                          {trabajando === 'generar' ? 'Regenerando...' : sinTexto ? 'Regenerar planos' : 'Regenerar guion'}
                        </Boton>
                        <Boton icon={ArrowLeftRight} onClick={() => setConfirmarFormato(true)} disabled={!!trabajando || bloqueado}>
                          Pasar a {etiquetaFormato(otroFormato(formato)).toLowerCase()}
                        </Boton>
                        <Boton icon={ArrowLeftRight} onClick={() => setConfirmarEstilo(true)} disabled={!!trabajando || bloqueado}
                          title={sinTexto ? 'Escribir un guion completo' : 'Quitar el guion: solo planos o fotos'}>
                          Pasar a {etiquetaEstilo(formato, !sinTexto).toLowerCase()}
                        </Boton>
                        {post.guion?.gancho && (
                          <Boton icon={Copy} onClick={() => accion('similares')} disabled={!!trabajando || bloqueado}
                            title="3 guiones nuevos del mismo tipo, con otro tema">
                            {trabajando === 'similares' ? 'Generando...' : 'Generar similares'}
                          </Boton>
                        )}
                        {post.aprobacionEstado && sucio && (
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Al guardar, vuelve a pendiente de aprobar.</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {!carrusel && (
                        <Boton icon={Sparkles} primary onClick={() => accion('planos')} disabled={!!trabajando || bloqueado}>
                          {trabajando === 'planos' ? 'Sacando planos...' : 'Sacar planos de este guion'}
                        </Boton>
                      )}
                      <Boton icon={Sparkles} primary={carrusel} onClick={() => accion('generar')} disabled={!!trabajando || bloqueado}>
                        {trabajando === 'generar' ? 'Regenerando...' : 'Regenerar guion'}
                      </Boton>
                      <Boton icon={ArrowLeftRight} onClick={() => setConfirmarFormato(true)} disabled={!!trabajando || bloqueado}>
                        Pasar a {etiquetaFormato(otroFormato(formato)).toLowerCase()}
                      </Boton>
                      {post.guion?.gancho && (
                        <Boton icon={Copy} onClick={() => accion('similares')} disabled={!!trabajando || bloqueado}
                          title="3 guiones nuevos del mismo tipo, con otro tema">
                          {trabajando === 'similares' ? 'Generando...' : 'Generar similares'}
                        </Boton>
                      )}
                    </div>
                  )}
                  {confirmarEstilo && (
                    <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(29,95,224,0.06)', border: '1px solid rgba(29,95,224,0.15)' }}>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 10px', lineHeight: 1.5 }}>
                        {sinTexto ? 'Se escribe un guion completo' : `Se quita el guion y quedan ${carrusel ? 'solo las fotos' : 'solo los planos'}`}; sustituye a este (queda en versiones){post.aprobacionEstado ? ' y vuelve a pendiente de aprobar' : ''}.
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Boton icon={ArrowLeftRight} primary onClick={() => accion('estilo')} disabled={!!trabajando || bloqueado}>
                          {trabajando === 'estilo' ? 'Reescribiendo...' : `Pasar a ${etiquetaEstilo(formato, !sinTexto).toLowerCase()}`}
                        </Boton>
                        <Boton icon={X} onClick={() => setConfirmarEstilo(false)} disabled={!!trabajando}>Cancelar</Boton>
                      </div>
                    </div>
                  )}
                  {confirmarFormato && (
                    <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(29,95,224,0.06)', border: '1px solid rgba(29,95,224,0.15)' }}>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 10px', lineHeight: 1.5 }}>
                        Se escribe un guion nuevo de {etiquetaFormato(otroFormato(formato)).toLowerCase()} y sustituye a este{post.aprobacionEstado ? '; vuelve a pendiente de aprobar' : ''}.
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Boton icon={ArrowLeftRight} primary onClick={() => accion('formato')} disabled={!!trabajando || bloqueado}>
                          {trabajando === 'formato' ? 'Reescribiendo...' : `Pasar a ${etiquetaFormato(otroFormato(formato)).toLowerCase()}`}
                        </Boton>
                        <Boton icon={X} onClick={() => setConfirmarFormato(false)} disabled={!!trabajando}>Cancelar</Boton>
                      </div>
                    </div>
                  )}
                </>
              )}
              <VersionesGuion historial={post.guionHistorial} onRestaurar={restaurar} restaurando={trabajando === 'restaurar'} />
              {sinProgramar(post) && post.guion && (
                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'var(--bg-secondary)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.4px', marginBottom: 8 }}>AÑADIR AL CALENDARIO</div>
                  {programar?.disponible ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input type="date" value={fechaPub} onChange={e => setFechaPub(e.target.value)} disabled={!!trabajando}
                        style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-color)', fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                      <select value={redPub} onChange={e => setRedPub(e.target.value)} disabled={!!trabajando}
                        style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-color)', fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        {(redes.length ? redes : Object.keys(REDES_CONTENIDO)).map(r => <option key={r} value={r}>{RED_LABELS[r] || r}</option>)}
                      </select>
                      <Boton icon={CalendarDays} primary onClick={añadirAlCalendario} disabled={!fechaPub || !!trabajando}>
                        {trabajando === 'calendario' ? 'Añadiendo...' : 'Añadir al calendario'}
                      </Boton>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{programar?.motivo}</p>
                  )}
                </div>
              )}
              {error && <p style={{ fontSize: 13, color: '#FF3B30', margin: '10px 0 0' }}>{error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function GuionesMes({ clienteId: clienteIdFijo = null, cliente: clienteFijo = null, onIrAPaso } = {}) {
  const embebido = clienteIdFijo != null
  const navigate = useNavigate()
  const esMovil = useEsMovil()
  // Padding de la página suelta (dentro de la ficha del cliente no lleva)
  const paddingPagina = esMovil ? '20px 16px' : '36px 40px'
  const { clientes, loading: clientesLoading } = useClientesList()
  const hoy = new Date()
  const { clienteActivoId: clienteId, setClienteActivoId: setClienteId } = useClienteActivo()
  // ?mes=YYYY-MM (enlaces desde Inicio) abre ese mes; si no, el actual
  const [searchParams, setSearchParams] = useSearchParams()
  const mesMatch = /^(\d{4})-(\d{2})$/.exec(searchParams.get('mes') || '')
  const mesParam = mesMatch && Number(mesMatch[2]) >= 1 && Number(mesMatch[2]) <= 12 ? mesMatch : null
  const [año, setAño] = useState(() => mesParam ? Number(mesParam[1]) : hoy.getFullYear())
  const [mes, setMes] = useState(() => mesParam ? Number(mesParam[2]) - 1 : hoy.getMonth())
  // ?guion=<id> (enlace desde una tarea) abre ese guion
  const [abierto, setAbierto] = useState(() => searchParams.get('guion') || null)
  const [error, setError] = useState(null)
  const [enviarOpen, setEnviarOpen] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [rodajeOpen, setRodajeOpen] = useState(false)
  const [escribirOpen, setEscribirOpen] = useState(false)
  // Tras guionizar: ids de los guiones nuevos (resaltados unos segundos) y
  // bajar hasta la lista cuando esté cargada
  const [resaltados, setResaltados] = useState([])
  const bajarAListaRef = useRef(false)
  const listaRef = useRef(null)

  const cliente = embebido
    ? (clienteFijo || clientes.find(c => String(c.id) === String(clienteIdFijo)) || null)
    : (clientes.find(c => String(c.id) === clienteId) || clientes[0] || null)

  const { posts, loading, refetch } = useCalendarioMes(cliente?.id, año, mes, { incluirSinProgramar: true })
  // Ideas del plan de este mes (Preparar el mes): se revisan y se guionizan aquí
  const mesIso = `${año}-${String(mes + 1).padStart(2, '0')}-01`
  const { ideas: ideasCliente, refetch: refetchIdeas } = useIdeasList(cliente?.id)
  const { plan } = usePlanMes(cliente, mesIso)
  const [guionizar, setGuionizar] = useState(null) // { ideas, limpiar, regenerar }
  const [versionIdeas, setVersionIdeas] = useState(0)
  // Al terminar una generación en segundo plano (guiones, ideas del mes) se
  // relee lo guardado, por si se lanzó desde aquí y se cerró el modal
  const { terminados, lanzar, parar, quitar, trabajos } = useGeneraciones()
  // El lote de guiones o planos de este cliente y mes, si está en marcha
  // (también si se lanzó, se salió de la página y se ha vuelto)
  const trabajoLote = trabajos.find(t => t.clave === `lote-${cliente?.id}-${año}-${mes}` && t.estado === 'corriendo') || null
  const lote = trabajoLote ? { tipo: trabajoLote.accion, hechos: trabajoLote.hechos, total: trabajoLote.total } : null // { tipo, hechos, total }
  const montadoRef = useRef(true)
  useEffect(() => { montadoRef.current = true; return () => { montadoRef.current = false } }, [])
  useEffect(() => {
    if (!terminados) return
    refetch()
    refetchIdeas()
  }, [terminados]) // eslint-disable-line react-hooks/exhaustive-deps
  const mesOpciones = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(año, mes + i, 1)
    return { mes: d.getMonth(), anio: d.getFullYear(), label: `${MESES[d.getMonth()]} ${d.getFullYear()}` }
  })
  // Primero los programados por fecha; los sin programar después, por orden de creación
  const piezas = posts.filter(esPieza).sort((a, b) =>
    (sinProgramar(a) - sinProgramar(b))
    || (sinProgramar(a)
      ? String(a.creadoEn || '').localeCompare(String(b.creadoEn || ''))
      : (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || ''))))

  // Día de grabación: del mes anterior o de este (se suele grabar justo antes
  // del mes de publicación). Hasta que pase, los guiones no van al calendario.
  const mesAnterior = new Date(año, mes - 1, 1)
  const { fechas: fechasMarcadas } = useFechasMarcadas(cliente?.id, mesAnterior.getFullYear(), mesAnterior.getMonth() + 1, { meses: 2 })
  const grabaciones = fechasMarcadas.filter(f => f.titulo === TITULO_GRABACION).map(f => f.fecha).sort()
  const hoyStr = isoLocal(hoy)
  const programar = grabaciones.some(f => f <= hoyStr)
    ? { disponible: true }
    : { disponible: false, motivo: grabaciones.length
        ? 'Disponible después del día de grabación.'
        : 'Fija el día de grabación primero: los guiones se añaden al calendario después de grabar.' }
  const videos = piezas.filter(p => !esCarrusel(p))
  const carruseles = piezas.filter(esCarrusel)
  const sinGuion = piezas.filter(p => !p.guion)
  // "Sacar planos" es solo para vídeos: un carrusel sin slides se regenera
  const sinPlanos = videos.filter(p => p.guion && !p.guion.planos?.length)
  const conGuion = piezas.filter(p => p.guion)
  const aprobados = piezas.filter(p => p.aprobacionEstado === 'aprobado').length
  const cambios = piezas.filter(p => p.aprobacionEstado === 'cambios').length
  const hayPlanos = piezas.some(p => p.guion?.planos?.length)

  useEffect(() => {
    if (!bajarAListaRef.current || loading) return
    bajarAListaRef.current = false
    listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [resaltados, loading])
  useEffect(() => {
    if (!resaltados.length) return undefined
    const t = setTimeout(() => setResaltados([]), 4000)
    return () => clearTimeout(t)
  }, [resaltados])

  const moverMes = (delta) => {
    const d = new Date(año, mes + delta, 1)
    setAño(d.getFullYear()); setMes(d.getMonth()); setAbierto(null)
    // El ?mes del enlace ya no aplica: al recargar se abre el mes actual
    if (searchParams.has('mes')) setSearchParams({}, { replace: true })
  }

  // Genera en serie (no en paralelo) para no disparar el límite de peticiones
  // ni gastar cuota de golpe si algo falla a mitad: se para en el primer error.
  // Va a la cola de generaciones: sigue aunque se cambie de página y sale en la barra.
  const procesarLote = async (tipo) => {
    const cola = tipo === 'guiones' ? sinGuion : sinPlanos
    if (!cola.length || !cliente || lote) return
    setError(null)
    const mesClave = `${año}-${String(mes + 1).padStart(2, '0')}`
    const { id, promesa } = lanzar({
      tipo: tipo === 'guiones' ? 'guiones' : 'planos-lote', accion: tipo, clave: `lote-${cliente.id}-${año}-${mes}`,
      titulo: `${tipo === 'guiones' ? 'Guiones' : 'Planos'} de ${MESES[mes]} · ${cliente.nombre}`,
      clienteId: cliente.id,
      destino: { ruta: `/clientes/${cliente.id}?mes=${mesClave}`, state: { tabInicial: 'guiones' } },
      total: cola.length,
    }, async (avanzar, debeParar) => {
      let hechos = 0
      for (let i = 0; i < cola.length; i++) {
        if (debeParar()) break
        const p = cola[i]
        const guion = tipo === 'guiones'
          ? await (esSinTexto(p) ? generarPiezaSinTexto(cliente, temaDe(p), formatoDe(p)) : generarGuion(cliente, temaDe(p), false, [], formatoDe(p)))
          : { ...p.guion, planos: await generarPlanos(cliente, temaDe(p), p.guion) }
        if (!guion?.gancho) throw new Error(`La IA no devolvió un guion válido para "${p.titulo}".`)
        const { error: err } = await actualizarPost(cliente.id, p.id, { guion, desarrollado: true })
        if (err) throw new Error(err.message || 'No se pudo guardar el guion')
        hechos = i + 1
        avanzar(hechos)
      }
      if (tipo === 'guiones') {
        addActividad({ tipo: 'guion', descripcion: `Guiones de ${MESES[mes]}`, clienteNombre: cliente.nombre, count: cola.length })
      }
      return { texto: tipo === 'guiones' ? `${hechos} ${hechos === 1 ? 'guion' : 'guiones'}` : `planos de ${hechos} ${hechos === 1 ? 'vídeo' : 'vídeos'}` }
    })
    // Si se sigue en la página al terminar, el resultado sale aquí (y la barra sobra)
    const r = await promesa
    if (!montadoRef.current) return
    quitar(id)
    if (r?.error) setError(r.error || 'Algo ha fallado generando el lote.')
    refetch()
  }

  const cerrarRodaje = useCallback(() => setRodajeOpen(false), [])

  const exportar = async () => {
    setExportando(true)
    try { await exportarGuionesMes(cliente, piezas, mes, año) }
    catch (e) { setError(e.message || 'No se pudo exportar el PDF.') }
    finally { setExportando(false) }
  }

  const irAIdeas = () => (embebido && onIrAPaso ? onIrAPaso('ideas') : navigate('/lluvia-de-ideas'))
  const irACalendario = () => (embebido && onIrAPaso
    ? onIrAPaso('calendario')
    : navigate(cliente ? `/clientes/${cliente.id}` : '/calendario'))

  if (!embebido && !clientesLoading && clientes.length === 0) {
    return (
      <div style={{ padding: paddingPagina, flex: 1 }}>
        <div style={{ maxWidth: 520, textAlign: 'center', margin: '60px auto' }}>
          <UserPlus size={28} color="var(--text-tertiary)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>Todavía no tienes clientes</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>Crea un cliente para preparar sus guiones del mes.</p>
          <Boton icon={UserPlus} primary onClick={() => navigate('/nuevo-cliente')}>Crear cliente</Boton>
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} className={!embebido && esMovil ? 'pagina-movil' : undefined} style={embebido ? undefined : { padding: paddingPagina, flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 820 }}>
        {!embebido && <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.6px', marginBottom: 4 }}>
            Guiones del mes
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Los guiones de vídeos y carruseles de cada cliente, listos para que el cliente los apruebe
          </p>
        </div>}

        {/* Cliente + mes */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          {!embebido && <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
            <select
              value={cliente?.id || ''}
              onChange={e => {
                setClienteId(e.target.value); setAbierto(null)
              }}
              style={{
                width: '100%', padding: '11px 36px 11px 14px', borderRadius: 11, border: '1px solid var(--border-color)',
                fontSize: 14, color: 'var(--text-primary)', background: 'var(--bg-card)', cursor: 'pointer',
                fontFamily: 'inherit', outline: 'none', appearance: 'none',
              }}
            >
              {clientesLoading && <option>Cargando clientes...</option>}
              {clientes.map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
            </select>
            <ChevronDown size={14} color="#86868B" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 11, padding: '0 4px' }}>
            <button onClick={() => moverMes(-1)} disabled={!!lote} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 130, textAlign: 'center', textTransform: 'capitalize' }}>{MESES[mes]} {año}</span>
            <button onClick={() => moverMes(1)} disabled={!!lote} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}><ChevronRight size={16} /></button>
          </div>
        </div>

        {/* Ideas del plan de este mes → revisar, rehacer y guionizar */}
        {cliente && (
          <div style={{ marginTop: -12, marginBottom: 16 }}>
            <IdeasGuardadasMes cliente={cliente} guardadas={ideasCliente} version={versionIdeas + terminados} mes={mesIso} plan={plan}
              onGenerar={(elegidas, limpiar, regenerar) => setGuionizar({ ideas: elegidas, limpiar, regenerar })}
              onIdeaCreada={refetchIdeas} />
          </div>
        )}

        {/* Resumen + acciones */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '20px 22px', border: '1px solid var(--border-subtle)', boxShadow: '0 2px 20px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <Stat n={videos.length} label="vídeos este mes" />
            <Stat n={carruseles.length} label="carruseles" />
            <Stat n={conGuion.length} label="con guion" color="#1D5FE0" />
            <Stat n={aprobados} label="aprobados" color="#30D158" />
            <Stat n={cambios} label="con cambios" color={cambios ? '#FF3B30' : undefined} />
          </div>

          {lote ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {lote.tipo === 'guiones' ? 'Generando guiones' : 'Sacando planos'} · {lote.hechos} de {lote.total}
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                  <motion.div animate={{ width: `${(lote.hechos / lote.total) * 100}%` }} style={{ height: '100%', background: '#1D5FE0', borderRadius: 3 }} />
                </div>
              </div>
              <Boton icon={Square} onClick={() => trabajoLote && parar(trabajoLote.id)}>Parar</Boton>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {sinGuion.length > 0 && (
                <Boton icon={Sparkles} primary onClick={() => procesarLote('guiones')}>
                  Generar {sinGuion.length === 1 ? 'el guion que falta' : `los ${sinGuion.length} guiones que faltan`}
                </Boton>
              )}
              {sinPlanos.length > 0 && (
                <Boton icon={Clapperboard} onClick={() => procesarLote('planos')}>
                  Sacar planos de {sinPlanos.length === 1 ? '1 guion' : `${sinPlanos.length} guiones`}
                </Boton>
              )}
              <Boton icon={Edit3} onClick={() => setEscribirOpen(true)} disabled={!cliente}>Escribir guion</Boton>
              <Boton icon={Send} onClick={() => setEnviarOpen(true)} disabled={!conGuion.length}>Enviar para aprobar</Boton>
              <Boton icon={Download} onClick={exportar} disabled={!conGuion.length || exportando}>
                {exportando ? 'Exportando...' : 'Exportar PDF'}
              </Boton>
              <Boton icon={ListChecks} onClick={() => setRodajeOpen(true)} disabled={!hayPlanos}
                title={hayPlanos ? 'Los planos de los vídeos agrupados para grabarlos en un día, y las fotos de los carruseles aparte' : 'Ningún guion de este mes tiene planos todavía'}>
                Hoja de rodaje
              </Boton>
            </div>
          )}
        </div>

        {/* Con guiones aprobados: días de grabación/edición y tarjetas en el tablero */}
        {!loading && <PlanProduccion key={`${cliente?.id}_${año}-${mes}`} cliente={cliente} videos={videos} año={año} mes={mes} />}

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              <AlertCircle size={15} color="#FF3B30" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#FF3B30', flex: 1 }}>{error}</span>
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><X size={14} color="#FF3B30" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista */}
        <p ref={listaRef} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 4px', scrollMarginTop: esMovil ? 72 : 16 }}>
          Guiones de {MESES[mes]}
        </p>
        {loading ? (
          <div style={{ padding: '18px 20px', borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', fontSize: 13, color: 'var(--text-secondary)' }}>
            Cargando guiones del mes...
          </div>
        ) : piezas.length === 0 ? (
          <div style={{ padding: '28px 20px', borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <CalendarDays size={24} color="var(--text-tertiary)" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
              Todavía no hay guiones de {MESES[mes]}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
              {embebido ? 'Prepara el mes en el paso Ideas y guioniza aquí sus ideas: los guiones aparecerán abajo.' : 'Guarda ideas en la Lluvia de ideas, elige las que te gusten y genera sus guiones: aparecerán aquí.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Boton icon={Sparkles} primary onClick={irAIdeas}>{embebido ? 'Preparar el mes' : 'Lluvia de ideas'}</Boton>
              <Boton icon={Edit3} onClick={() => setEscribirOpen(true)}>Escribir guion</Boton>
              <Boton icon={CalendarDays} onClick={irACalendario}>Ir al calendario</Boton>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {piezas.map(p => (
              <FilaGuion key={p.id} post={p} cliente={cliente}
                abierto={abierto === p.id}
                onToggle={() => setAbierto(a => a === p.id ? null : p.id)}
                onGuardado={refetch}
                bloqueado={!!lote}
                programar={programar}
                resaltado={resaltados.includes(p.id)} />
            ))}
          </div>
        )}
      </div>

      {guionizar && (
        <GenerarGuionesModal open cliente={cliente} ideas={guionizar.ideas} regenerar={!!guionizar.regenerar}
          mesOpciones={mesOpciones} mesInicial={mesOpciones[0]} aquiAbajo
          onClose={(generado) => {
            if (generado) { guionizar.limpiar(); setVersionIdeas(v => v + 1); refetch() }
            setGuionizar(null)
          }}
          onHecho={(destino, ids = []) => {
            guionizar.limpiar(); setGuionizar(null); setVersionIdeas(v => v + 1)
            if (destino && (destino.año !== año || destino.mes !== mes)) { setAño(destino.año); setMes(destino.mes) } else refetch()
            setResaltados(ids)
            bajarAListaRef.current = true
          }} />
      )}

      <EscribirGuionModal open={escribirOpen} onClose={() => setEscribirOpen(false)}
        cliente={cliente} año={año} mes={mes} onGuardado={refetch} />

      <EnviarAprobacionModal open={enviarOpen} onClose={() => setEnviarOpen(false)}
        cliente={cliente} año={año} mes={mes} totalGuiones={conGuion.length} />

      {/* key: al cambiar de cliente o mes se remonta y relee su progreso guardado */}
      <HojaRodaje key={`${cliente?.id}_${año}-${mes}`} open={rodajeOpen && hayPlanos} onClose={cerrarRodaje}
        cliente={cliente} piezas={piezas} año={año} mes={mes} />
    </motion.div>
  )
}
