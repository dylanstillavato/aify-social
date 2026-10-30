import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, Copy, RefreshCw, TrendingUp, ChevronDown, AlertCircle, X,
  CalendarDays, PenLine, Download, UserPlus, Inbox, Clapperboard, Undo2,
} from 'lucide-react'
import { generarGuion } from '../services/ai'
import { normalizarHistoria, textoHistoria } from '../utils/historia'
import { addActividad } from '../hooks/useActividad'
import { exportarGuion } from '../services/exportPDF'
import { useClientesList } from '../hooks/useClientes'
import { useClienteActivo } from '../hooks/useClienteActivo'
import { useTrends } from '../hooks/useTrends'
import { useCalendarioMes, actualizarPost } from '../hooks/useCalendario'
import { useIdeasList, crearIdea } from '../hooks/useIdeas'
import PanelDesarrollar from '../components/PanelDesarrollar'
import { useGeneraciones, useGeneracionDePantalla } from '../hooks/useGeneraciones'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const taStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--border-color)', fontSize: 14, color: 'var(--text-primary)',
  background: 'var(--bg-card)', outline: 'none',
  fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6,
  boxSizing: 'border-box',
}

function relativeTime(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diffMs)) return ''
  const h = Math.floor(diffMs / 3600000)
  if (h < 1) return 'hace un momento'
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  return `hace ${d}d`
}

function Card({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        background: 'var(--bg-card)', borderRadius: 20, padding: '24px 26px',
        boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
        border: '1px solid var(--border-subtle)', marginBottom: 16,
      }}
    >
      {children}
    </motion.div>
  )
}

function StepLabel({ n, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: '#1D5FE0', color: 'white',
        fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{n}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
    </div>
  )
}

// Una de las tres "carpetas" de ideas de un cliente (sin desarrollar / con guion / con copy).
// Reutiliza PanelDesarrollar para ver/editar cada idea al hacer click en una fila — así
// esta vista es solo listado + agrupación, el editor real vive en un único sitio compartido.
function FolderSection({ icon: Icon, label, color, items, emptyText, onOpen, renderExtra }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 16, padding: '18px 20px',
      border: '1px solid var(--border-subtle)', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: items.length ? 14 : 4 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={16} color={color} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
        <span style={{
          fontSize: 11, fontWeight: 700, color, background: `${color}14`,
          padding: '2px 9px', borderRadius: 20, marginLeft: 'auto', flexShrink: 0,
        }}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{emptyText}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(idea => (
            <div
              key={idea.id}
              onClick={() => onOpen(idea)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10, background: 'var(--bg-secondary)', cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {idea.titulo || 'Idea sin título'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {[idea.formato, relativeTime(idea.guionGuardadoEn || idea.fechaGuardada)].filter(Boolean).join(' · ')}
                </div>
              </div>
              {renderExtra && renderExtra(idea)}
              <ChevronDown size={13} color="#86868B" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function GuionesVirales() {
  const navigate = useNavigate()
  const { clientes, loading: clientesLoading } = useClientesList()
  const { clienteActivoId, setClienteActivoId } = useClienteActivo()

  // Cliente efectivo: el activo compartido, o el primero si no existe.
  const clienteSeleccionado = clientes.find(c => String(c.id) === String(clienteActivoId)) || clientes[0] || null
  const clientesListos = !clientesLoading
  const [modoIdea, setModoIdea] = useState('nueva')
  const [ideaSeleccionada, setIdeaSeleccionada] = useState(null)
  const [tema, setTema] = useState('')
  const [usarTendencias, setUsarTendencias] = useState(true)
  const [creandoIdea, setCreandoIdea] = useState(false)
  // Generar desde el calendario va a la cola de generaciones: sigue aunque se
  // cambie de página y sale en la barra
  const { terminados } = useGeneraciones()
  const { ejecutar, enCurso } = useGeneracionDePantalla()
  const [generandoCalAqui, setGenerandoCal] = useState(false)
  const [resultadoCal, setResultadoCal] = useState(null)
  // Al regenerar, el guion que había se guarda aquí (por post) para poder
  // volver a él; el historial completo queda en Guiones del mes
  const [ultimoCal, setUltimoCal] = useState(null) // { postId, guion }
  const [anteriorCal, setAnteriorCal] = useState(null) // { postId, guion }
  const [guionError, setGuionError] = useState(null)
  const [copiedSection, setCopiedSection] = useState(null)
  const [exportando, setExportando] = useState(false)
  const [exportandoIdeaId, setExportandoIdeaId] = useState(null)
  const [panelIdea, setPanelIdea] = useState(null)

  const { videosVirales, cargarVideos } = useTrends(clienteSeleccionado)
  const { ideas, loading: ideasLoading, refetch: refetchIdeas } = useIdeasList(clienteSeleccionado?.id)
  const generandoCal = generandoCalAqui || (ideaSeleccionada ? !!enCurso(`virales-calendario-${ideaSeleccionada.id}`) : false)

  // Si el cliente activo cambia (aquí, en otra página o en otra pestaña),
  // se descarta la idea/guion en curso para no mezclarlos entre clientes.
  const [clientePrevId, setClientePrevId] = useState(clienteSeleccionado?.id ?? null)
  if ((clienteSeleccionado?.id ?? null) !== clientePrevId) {
    setClientePrevId(clienteSeleccionado?.id ?? null)
    if (clientePrevId !== null) {
      setIdeaSeleccionada(null)
      setTema('')
      setResultadoCal(null)
    }
  }

  const now = new Date()
  const { posts: postsCalMesActual, refetch: refetchCal } = useCalendarioMes(clienteSeleccionado?.id, now.getFullYear(), now.getMonth())
  // Al terminar una generación en segundo plano (p. ej. el guion de una idea
  // con el panel cerrado) se relee lo guardado
  useEffect(() => {
    if (!terminados) return
    refetchIdeas()
    refetchCal()
  }, [terminados]) // eslint-disable-line react-hooks/exhaustive-deps
  const ideasCalendario = postsCalMesActual.filter(p => !p.guion)

  // Carpetas por estado — no hay carpeta "Con copy" (el copy sigue generándose
  // para ideas carrusel/imagen, pero ya no tiene una vista dedicada); una idea
  // sin guión se queda en "Sin desarrollar" tenga copy o no.
  const sinDesarrollar = ideas.filter(i => !i.guion)
  const conGuion = ideas.filter(i => !!i.guion)

  const handleCrearIdeaYAbrir = async () => {
    if (!clienteSeleccionado || !tema.trim()) return
    setCreandoIdea(true)
    setGuionError(null)
    try {
      const { data: nuevaIdea, error } = await crearIdea({
        titulo: tema.trim(),
        concepto: tema.trim(),
        formato: 'video',
        clienteId: clienteSeleccionado.id,
      })
      if (error) throw new Error(error.message || 'No se pudo crear la idea')
      addActividad({ tipo: 'idea', descripcion: `Nueva idea: "${tema.trim()}"`, clienteNombre: clienteSeleccionado.nombre, count: 1 })
      refetchIdeas()
      setTema('')
      setPanelIdea(nuevaIdea)
    } catch (e) {
      setGuionError(e.message || 'No se pudo crear la idea.')
    } finally {
      setCreandoIdea(false)
    }
  }

  const handleGenerarDesdeCalendario = async () => {
    if (!clienteSeleccionado || !tema.trim() || !ideaSeleccionada) return
    setGenerandoCal(true)
    setResultadoCal(null)
    setGuionError(null)
    try {
      cargarVideos()
      const post = ideaSeleccionada
      await ejecutar({
        tipo: 'guion', clave: `virales-calendario-${post.id}`,
        titulo: `Guion viral «${tema.trim()}» · ${clienteSeleccionado.nombre}`,
        clienteId: clienteSeleccionado.id,
        destino: { ruta: `/clientes/${clienteSeleccionado.id}?mes=${String(post.fecha || '').slice(0, 7)}`, state: { tabInicial: 'guiones' } },
      }, async () => {
        const result = await generarGuion(clienteSeleccionado, tema, usarTendencias, videosVirales)
        if (!result?.gancho) throw new Error('La IA no devolvio un guion valido. Intenta de nuevo.')
        const previo = ultimoCal?.postId === post.id ? ultimoCal.guion : post.guion
        setResultadoCal(result)
        await actualizarPost(clienteSeleccionado.id, post.id, { guion: result, desarrollado: true })
        setUltimoCal({ postId: post.id, guion: result })
        setAnteriorCal(previo ? { postId: post.id, guion: previo } : null)
        addActividad({ tipo: 'guion', descripcion: `Guion viral: "${tema}"`, clienteNombre: clienteSeleccionado.nombre, count: 1 })
      })
    } catch (e) {
      setGuionError(e.message || 'Error al generar el guion.')
    } finally {
      setGenerandoCal(false)
    }
  }

  // Intercambia el guion actual con el anterior: pulsar otra vez vuelve al nuevo
  const volverAlAnteriorCal = async () => {
    if (!anteriorCal || !clienteSeleccionado || anteriorCal.postId !== ideaSeleccionada?.id) return
    const actual = resultadoCal
    const { error } = await actualizarPost(clienteSeleccionado.id, anteriorCal.postId, { guion: anteriorCal.guion, desarrollado: true })
    if (error) { setGuionError(error.message || 'No se pudo volver al guion anterior.'); return }
    setResultadoCal(anteriorCal.guion)
    setUltimoCal({ postId: anteriorCal.postId, guion: anteriorCal.guion })
    setAnteriorCal(actual ? { postId: anteriorCal.postId, guion: actual } : null)
  }

  const copy = (key, text) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(key)
    setTimeout(() => setCopiedSection(null), 1500)
  }

  const buildFullTextCal = () => {
    if (!resultadoCal) return ''
    const g = resultadoCal
    const historia = normalizarHistoria(g.historia)
    return [
      historia ? `HISTORIA EN 5 LÍNEAS:\n${textoHistoria(historia)}\n` : '',
      `GANCHO (0-3s):\n${g.gancho || ''}`,
      `\nPROBLEMA (${g.problema?.segundos || '4-10'}s):\n${g.problema?.texto || ''}`,
      `\nPROMESA (${g.promesa?.segundos || '10-20'}s):\n${g.promesa?.texto || ''}`,
      `\nCONTENIDO (${g.contenido?.segundos || '20-50'}s):\n${(g.contenido?.frases || []).join('\n')}`,
      g.contenido?.loopAbierto ? `Loop abierto: ${g.contenido.loopAbierto}` : '',
      `\nCIERRE (${g.cierre?.segundos || '50-60'}s):\n${g.cierre?.remate || ''}`,
      `\nCTA: ${g.cierre?.cta || ''}`,
      `\nDURACION: ${g.duracion_total || '60s'}`,
      g.audio_sugerido ? `AUDIO: ${g.audio_sugerido}` : '',
      g.tip_viral ? `TIP VIRAL: ${g.tip_viral}` : '',
    ].filter(Boolean).join('\n')
  }

  const handleExportPDFCal = async () => {
    if (!resultadoCal || !clienteSeleccionado) return
    setExportando(true)
    try {
      await exportarGuion(clienteSeleccionado, resultadoCal, tema || 'Guion Viral')
    } catch (e) {
      console.error('Error exportando PDF:', e)
      setGuionError(e.message || 'No se pudo exportar el PDF. Intenta de nuevo.')
    } finally {
      setExportando(false)
    }
  }

  // Export rápido desde una fila de la carpeta "Con guion", sin pasar por PanelDesarrollar
  // (ese panel comparte con LluviaDeIdeas/ClienteDetalle y no tiene botón de exportar PDF).
  const handleExportPDFIdea = async (idea, e) => {
    e.stopPropagation()
    if (!idea.guion || !clienteSeleccionado) return
    setExportandoIdeaId(idea.id)
    try {
      await exportarGuion(clienteSeleccionado, idea.guion, idea.titulo || 'Guion Viral')
    } catch (err) {
      console.error('Error exportando PDF:', err)
    } finally {
      setExportandoIdeaId(null)
    }
  }

  const mesActual = MESES[new Date().getMonth()]
  const handleToggleTendencias = () => setUsarTendencias(v => !v)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      style={{ padding: '36px 40px', flex: 1, overflowY: 'auto' }}
    >
      <div style={{ maxWidth: 820 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.6px', marginBottom: 4 }}>
            Ideas y Guiones
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Organiza las ideas de cada cliente y conviértelas en guiones y copies
          </p>
        </div>

        {/* PASO 1 — Cliente */}
        <Card delay={0}>
          <StepLabel n="1" label="Selecciona el cliente" />
          {clientesListos && clientes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 12px' }}>
              <UserPlus size={26} color="var(--text-tertiary)" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                Todavía no tienes clientes
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                Crea un cliente para generar guiones virales.
              </p>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/nuevo-cliente')}
                style={{ padding: '8px 16px', borderRadius: 9, background: '#1D5FE0', border: 'none', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Crear cliente
              </motion.button>
            </div>
          ) : (
          <div style={{ position: 'relative', maxWidth: 320 }}>
            {!clientesListos ? (
              <select disabled style={{ width: '100%', padding: '11px 36px 11px 14px', borderRadius: 11, border: '1px solid rgba(0,0,0,0.12)', fontSize: 14, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', cursor: 'not-allowed', fontFamily: 'inherit', outline: 'none', appearance: 'none' }}>
                <option>Cargando clientes...</option>
              </select>
            ) : (
              <select
                value={clienteSeleccionado?.id || ''}
                onChange={e => {
                  const c = clientes.find(x => String(x.id) === e.target.value) || null
                  if (c) setClienteActivoId(String(c.id))
                  setIdeaSeleccionada(null)
                  setTema('')
                  setResultadoCal(null)
                }}
                style={{
                  width: '100%', padding: '11px 36px 11px 14px', borderRadius: 11,
                  border: '1px solid rgba(0,0,0,0.12)', fontSize: 14,
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'inherit',
                  outline: 'none', appearance: 'none',
                }}
              >
                <option value="" disabled>Selecciona un cliente</option>
                {clientes.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.nombre} — {c.sector}</option>
                ))}
              </select>
            )}
            <ChevronDown size={14} color="#86868B" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
          )}

          <AnimatePresence>
            {clienteSeleccionado && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  marginTop: 14, padding: '12px 16px', borderRadius: 12,
                  background: 'rgba(29,95,224,0.05)', border: '1px solid rgba(29,95,224,0.12)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: 'var(--gradient-brand, linear-gradient(135deg, #007BFF 0%, #4DA3FF 45%, #B0E0E6 100%))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, color: 'white', flexShrink: 0,
                  }}>
                    {clienteSeleccionado.nombre?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {clienteSeleccionado.nombre}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                      {[clienteSeleccionado.sector, clienteSeleccionado.ubicacion, clienteSeleccionado.tono && `Tono ${clienteSeleccionado.tono}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {clienteSeleccionado.usoEmojis === 'ninguno' && (
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,59,48,0.08)', color: '#FF3B30', fontWeight: 500, flexShrink: 0 }}>
                      Sin emojis
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* CARPETAS — ideas del cliente agrupadas por estado */}
        <AnimatePresence>
          {clienteSeleccionado && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{ marginBottom: 16 }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                Ideas de {clienteSeleccionado.nombre}
              </div>

              {ideasLoading ? (
                <div style={{ padding: '18px 20px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', fontSize: 13, color: 'var(--text-secondary)' }}>
                  Cargando ideas...
                </div>
              ) : (
                <>
                  <FolderSection
                    icon={Inbox}
                    label="Sin desarrollar"
                    color="#86868B"
                    items={sinDesarrollar}
                    emptyText="No hay ideas sin desarrollar. Crea una nueva abajo."
                    onOpen={setPanelIdea}
                  />
                  <FolderSection
                    icon={Clapperboard}
                    label="Con guion"
                    color="#007BFF"
                    items={conGuion}
                    emptyText="Todavía no hay ideas con guion generado."
                    onOpen={setPanelIdea}
                    renderExtra={(idea) => (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleExportPDFIdea(idea, e)}
                        disabled={exportandoIdeaId === idea.id}
                        title="Exportar PDF"
                        style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        {exportandoIdeaId === idea.id
                          ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(0,0,0,0.15)', borderTopColor: '#007BFF' }} />
                          : <Download size={12} color="#86868B" />}
                      </motion.button>
                    )}
                  />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* PASO 2 — Crear un guion nuevo desde un tema */}
        <AnimatePresence>
          {clienteSeleccionado && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Card>
                <StepLabel n="2" label="Crear un guion nuevo desde un tema" />

                <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                  {[
                    { key: 'nueva', icon: PenLine, label: 'Crear nueva idea' },
                    { key: 'calendario', icon: CalendarDays, label: 'Usar idea del calendario' },
                  ].map(({ key, icon: Icon, label }) => (
                    <motion.button
                      key={key}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setModoIdea(key); setIdeaSeleccionada(null); setTema(''); setResultadoCal(null); setGuionError(null) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
                        border: modoIdea === key ? '1.5px solid #1D5FE0' : '1px solid rgba(0,0,0,0.1)',
                        background: modoIdea === key ? 'rgba(29,95,224,0.07)' : 'var(--bg-secondary)',
                        fontSize: 13, fontWeight: modoIdea === key ? 600 : 400,
                        color: modoIdea === key ? '#1D5FE0' : '#86868B',
                        fontFamily: 'inherit',
                      }}
                    >
                      <Icon size={14} />
                      {label}
                    </motion.button>
                  ))}
                </div>

                {modoIdea === 'nueva' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 7 }}>
                      Sobre que trata el video
                    </label>
                    <textarea
                      value={tema}
                      onChange={e => setTema(e.target.value)}
                      placeholder="Describe el tema, producto o historia del video..."
                      rows={3}
                      style={{ ...taStyle, border: '1px solid rgba(0,0,0,0.12)' }}
                      onFocus={e => e.target.style.borderColor = '#1D5FE0'}
                      onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.12)'}
                    />
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                      Se crea una idea nueva para este cliente y se abre el panel para generar su guion.
                    </p>
                  </div>
                )}

                {modoIdea === 'calendario' && (
                  <div>
                    {ideasCalendario.length === 0 ? (
                      <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--bg-secondary)', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
                        No hay ideas sin desarrollar en el calendario de {mesActual} para este cliente
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ position: 'relative' }}>
                          <select
                            value={ideaSeleccionada?.id || ''}
                            onChange={e => {
                              const post = ideasCalendario.find(p => String(p.id) === e.target.value)
                              if (post) { setIdeaSeleccionada(post); setTema(post.titulo || '') }
                              else { setIdeaSeleccionada(null); setTema('') }
                            }}
                            style={{
                              width: '100%', padding: '11px 36px 11px 14px', borderRadius: 11,
                              border: '1px solid rgba(0,0,0,0.12)', fontSize: 14,
                              color: ideaSeleccionada ? '#1D1D1F' : '#86868B',
                              background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'inherit',
                              outline: 'none', appearance: 'none',
                            }}
                          >
                            <option value="">Selecciona una idea</option>
                            {ideasCalendario.map(post => (
                              <option key={post.id} value={String(post.id)}>
                                {post.titulo} — dia {post.dia} de {mesActual}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={14} color="#86868B" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        </div>
                        {ideaSeleccionada && (
                          <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>
                              Puedes editar el tema antes de generar
                            </label>
                            <input
                              value={tema}
                              onChange={e => setTema(e.target.value)}
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(29,95,224,0.3)', background: 'rgba(29,95,224,0.03)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                              onFocus={e => e.target.style.borderColor = '#1D5FE0'}
                              onBlur={e => e.target.style.borderColor = 'rgba(29,95,224,0.3)'}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PASO 3 — Generar */}
        <AnimatePresence>
          {clienteSeleccionado && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Card>
                {modoIdea === 'calendario' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <motion.div
                      onClick={handleToggleTendencias}
                      style={{
                        width: 44, height: 26, borderRadius: 13,
                        background: usarTendencias ? '#1D5FE0' : 'rgba(0,0,0,0.15)',
                        cursor: 'pointer', position: 'relative', flexShrink: 0,
                        transition: 'background 0.2s ease',
                      }}
                    >
                      <motion.div
                        animate={{ x: usarTendencias ? 20 : 2 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-card)', position: 'absolute', top: 3, left: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
                      />
                    </motion.div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TrendingUp size={14} color={usarTendencias ? '#1D5FE0' : '#86868B'} />
                        Usar tendencias actuales
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                        Incorpora audios y formatos trending de la semana
                      </div>
                    </div>
                  </div>
                )}
                <motion.button
                  whileHover={{ backgroundColor: '#BEE62A', boxShadow: '0 4px 20px rgba(215,255,61,0.35)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={modoIdea === 'nueva' ? handleCrearIdeaYAbrir : handleGenerarDesdeCalendario}
                  disabled={
                    modoIdea === 'nueva'
                      ? (creandoIdea || !tema.trim())
                      : (generandoCal || !tema.trim() || !ideaSeleccionada)
                  }
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 22px', borderRadius: 12,
                    background: (modoIdea === 'nueva' ? (creandoIdea || !tema.trim()) : (generandoCal || !tema.trim() || !ideaSeleccionada)) ? '#86868B' : '#D7FF3D',
                    color: (modoIdea === 'nueva' ? (creandoIdea || !tema.trim()) : (generandoCal || !tema.trim() || !ideaSeleccionada)) ? 'white' : '#0B0C10', border: 'none',
                    cursor: (modoIdea === 'nueva' ? (creandoIdea || !tema.trim()) : (generandoCal || !tema.trim() || !ideaSeleccionada)) ? 'not-allowed' : 'pointer',
                    fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
                    boxShadow: '0 2px 12px rgba(215,255,61,0.3)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Sparkles size={15} />
                  {modoIdea === 'nueva'
                    ? (creandoIdea ? 'Creando idea...' : 'Crear idea y generar guion')
                    : (generandoCal ? 'Generando guion...' : 'Generar Guion Viral')}
                </motion.button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {guionError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}
            >
              <AlertCircle size={15} color="#FF3B30" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#FF3B30', flex: 1 }}>{guionError}</span>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setGuionError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <X size={14} color="#FF3B30" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading — solo el flujo de calendario genera aquí mismo (el flujo de idea nueva
            genera dentro de PanelDesarrollar, que ya tiene su propio spinner) */}
        <AnimatePresence>
          {generandoCal && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '22px', marginBottom: 20, border: '1px solid rgba(29,95,224,0.15)', display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {['Analizando tendencias virales...', 'Adaptando tono al perfil del cliente...', 'Estructurando el guion completo...'].map((text, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.7 }} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.5, delay: i * 0.7, repeat: Infinity, repeatDelay: 2.1 }}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D5FE0', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{text}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* RESULTADO — solo flujo de calendario (queda guardado directamente en el post) */}
        <AnimatePresence>
          {resultadoCal && !generandoCal && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '20px 22px', border: '1px solid var(--border-subtle)', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Guion generado — {resultadoCal.duracion_total || '60s'}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => copy('full', buildFullTextCal())}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: copiedSection === 'full' ? '#30D158' : '#1D5FE0', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', transition: 'background 0.2s' }}
                  >
                    <Copy size={12} />
                    {copiedSection === 'full' ? 'Copiado' : 'Copiar guion completo'}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleExportPDFCal}
                    disabled={exportando}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.05)', color: 'var(--text-primary)', border: 'none', cursor: exportando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}
                  >
                    {exportando
                      ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(0,0,0,0.1)', borderTopColor: '#1D1D1F' }} />
                      : <Download size={12} />}
                    Exportar PDF
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleGenerarDesdeCalendario}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.05)', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}
                  >
                    <RefreshCw size={12} /> Regenerar
                  </motion.button>
                  {anteriorCal && anteriorCal.postId === ideaSeleccionada?.id && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={volverAlAnteriorCal}
                      title="Volver al guion que había antes de regenerar"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.05)', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}
                    >
                      <Undo2 size={12} /> Volver al anterior
                    </motion.button>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#1D5FE0', marginBottom: 4 }}>GANCHO</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{resultadoCal.gancho}</p>
              </div>
              {resultadoCal.cierre?.cta && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#30D158', marginBottom: 4 }}>CTA</div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{resultadoCal.cierre.cta}</p>
                </div>
              )}
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                Este guion ya quedó guardado en el post del calendario correspondiente.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Panel lateral compartido para ver/editar/generar guión y copy de una idea */}
      <AnimatePresence>
        {panelIdea && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setPanelIdea(null); refetchIdeas() }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199 }}
            />
            <PanelDesarrollar
              idea={panelIdea}
              cliente={clienteSeleccionado}
              onClose={() => { setPanelIdea(null); refetchIdeas() }}
            />
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
