import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb, Sparkles, Megaphone, TrendingUp,
  BookOpen, Bookmark, BookmarkCheck, ArrowRight, Copy, X, Check,
  ChevronDown, ChevronUp, Clock, Zap, AlertCircle, ChevronRight,
  Heart, ShoppingBag, Camera, Star, MessageCircle, Calendar,
  Video, Images, Link2, SlidersHorizontal,
  ArrowLeftRight,
} from 'lucide-react'
import { useClientesList } from '../hooks/useClientes'
import { useClienteActivo } from '../hooks/useClienteActivo'
import { generarLluviaIdeas, reescribirIdea } from '../services/ai'
import { crearIdea, eliminarIdea, actualizarIdea, useIdeasList } from '../hooks/useIdeas'
import { formatoDe, otroFormato, esSinTexto } from '../utils/formato'
import { useCalendarioMes, getPostPorIdea } from '../hooks/useCalendario'
import EditorIdea from '../components/EditorIdea'
import GenerarGuionesModal from '../components/GenerarGuionesModal'
import IdeasGuardadasMes from '../components/IdeasGuardadasMes'
import { getMetricasInstagram } from '../services/instagram'
import { resumenInstagramParaIA } from '../utils/resumenInstagram'
import { getMetricasTikTok } from '../services/tiktok'
import { resumenTikTokParaIA } from '../utils/resumenTikTok'

// ─── Constants ────────────────────────────────────────────────────────────────

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const TIPOS_CONTENIDO = [
  { id: 'viral',          label: 'Contenido viral',   icon: TrendingUp },
  { id: 'fidelizacion',   label: 'Fidelización',      icon: Heart },
  { id: 'venta',          label: 'Venta directa',     icon: ShoppingBag },
  { id: 'educativo',      label: 'Educativo',         icon: Lightbulb },
  { id: 'bts',            label: 'Behind the scenes', icon: Camera },
  { id: 'branding',       label: 'Branding',          icon: Star },
  { id: 'engagement',     label: 'Engagement',        icon: MessageCircle },
  { id: 'fecha_especial', label: 'Fecha especial',    icon: Calendar },
]

const TIPO_CONTENIDO_CONFIG = {
  viral:          { color: '#FF3B30', icon: TrendingUp,    label: 'Viral' },
  fidelizacion:   { color: '#FF2D55', icon: Heart,         label: 'Fidelización' },
  venta:          { color: '#FF9500', icon: ShoppingBag,   label: 'Venta' },
  educativo:      { color: '#B8860B', icon: BookOpen,      label: 'Educativo' },
  bts:            { color: '#AF52DE', icon: Camera,        label: 'BTS' },
  branding:       { color: '#1D5FE0', icon: Star,          label: 'Branding' },
  engagement:     { color: '#30D158', icon: MessageCircle, label: 'Engagement' },
  fecha_especial: { color: '#FF9500', icon: Calendar,      label: 'Fecha especial' },
}

const FORMATOS = [
  { id: 'todos',    label: 'Todos los formatos' },
  { id: 'video',    label: 'Vídeo' },
  { id: 'carrusel', label: 'Carrusel' },
]

const FORMATO_COLORS = {
  video: '#FF2D55', carrusel: '#1D5FE0', todos: '#1D5FE0',
  // legacy values from ideas generated before the format list was simplified
  video_corto: '#FF2D55', video_largo: '#FF2D55', texto_imagen: '#1D5FE0', texto_corto: '#1D5FE0', seo_local: '#1D5FE0',
}
const FORMATO_ICONS = {
  video: Video, carrusel: Images,
  video_corto: Video, video_largo: Video, texto_imagen: Images, texto_corto: Images, seo_local: Images,
}

const FORMATO_LABELS = {
  video: 'Vídeo', carrusel: 'Carrusel',
  // legacy values from ideas generated before the format list was simplified
  video_corto: 'Vídeo', video_largo: 'Vídeo', texto_imagen: 'Carrusel', texto_corto: 'Carrusel', seo_local: 'Carrusel',
}

const DIFICULTAD = {
  facil: { label: 'Fácil', color: '#30D158' },
  media: { label: 'Media', color: '#FF9500' },
  alta:  { label: 'Alta',  color: '#FF3B30' },
}
const TIEMPO = { '15min': '15 min', '1hora': '1 hora', 'medio_dia': 'Medio día', 'dia_completo': 'Día completo' }
const ANUNCIO_OBJETIVOS = ['Informar', 'Generar expectativa', 'Conseguir reservas o ventas', 'Viral']

const LS_HISTORIAL = 'aify_lluvia_historial'

const lsGet = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
const lsSet = (key, val)       => { try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* ignore */ } }

const PROGRESO = [
  (n) => `Analizando el perfil de ${n}...`,
  ()  => 'Buscando ángulos creativos...',
  ()  => 'Adaptando al tono de la marca...',
  ()  => 'Casi listo...',
]

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '20px', border: '1px solid var(--border-subtle)', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)', animation: 'shimmer 1.5s infinite' }} />
      {[80, 120, 60, 40, 30].map((w, i) => (
        <div key={i} style={{ height: i === 1 ? 14 : 10, width: `${w}%`, background: 'rgba(0,0,0,0.06)', borderRadius: 6, marginBottom: 10 }} />
      ))}
    </div>
  )
}

// ─── IdeaCard ─────────────────────────────────────────────────────────────────

function IdeaCard({ idea, idx, ideasGuardadasIds, clienteId, onGuardar, onDesarrollar, onCopiar, onDescartar, onCambiarFormato, cambiandoFormato, copiado }) {
  const formatoColor = FORMATO_COLORS[idea.formato] || '#86868B'
  const FormatoIcon  = FORMATO_ICONS[idea.formato]
  const dif          = DIFICULTAD[idea.dificultad] || DIFICULTAD.media
  const isGuardada   = ideasGuardadasIds.includes(`${idea.id}_${clienteId}`)
  const tipoCfg      = TIPO_CONTENIDO_CONFIG[idea.tipoContenido] || TIPO_CONTENIDO_CONFIG[idea.tipo]
  const TipoIcon     = tipoCfg?.icon || Lightbulb

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.07, duration: 0.4 }}
      whileHover={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
      style={{ background: 'var(--bg-card)', borderRadius: 16, overflow: 'hidden', borderTop: `1px solid var(--border-color)`, borderRight: `1px solid var(--border-color)`, borderBottom: `1px solid var(--border-color)`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s', display: 'flex', flexDirection: 'column', borderLeft: `3px solid ${formatoColor}`, position: 'relative' }}
    >
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>{String(idx + 1).padStart(2, '0')}</span>
          {tipoCfg && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: `${tipoCfg.color}15`, color: tipoCfg.color, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <TipoIcon size={9} strokeWidth={2} /> {tipoCfg.label}
            </span>
          )}
          {idea.formato && idea.formato !== 'todos' && FormatoIcon && (
            <button onClick={() => onCambiarFormato(idea)} disabled={cambiandoFormato} title={`Pasar a ${formatoDe(idea) === 'video' ? 'carrusel' : 'vídeo'} (se reescribe la idea)`}
              style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: `${formatoColor}12`, color: formatoColor, display: 'inline-flex', alignItems: 'center', gap: 3, border: 'none', cursor: cambiandoFormato ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: cambiandoFormato ? 0.5 : 1 }}>
              <FormatoIcon size={9} strokeWidth={2} /> {cambiandoFormato ? 'Reescribiendo...' : FORMATO_LABELS[idea.formato] || idea.formato} <ArrowLeftRight size={8} strokeWidth={2} />
            </button>
          )}
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{idea.titulo}</p>
      </div>

      <div style={{ padding: '12px 16px', flex: 1 }}>
        {idea.formatoSugerido && (
          <span style={{ display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', marginBottom: 8 }}>
            {idea.formatoSugerido}
          </span>
        )}
        <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, margin: '0 0 8px' }}>{idea.concepto}</p>
        {idea.porQueFunc && (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>{idea.porQueFunc}</p>
        )}
      </div>

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: `${dif.color}14`, color: dif.color }}>{dif.label}</span>
          {idea.tiempoEstimado && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '3px 8px', borderRadius: 20, background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
              <Clock size={9} /> {TIEMPO[idea.tiempoEstimado] || idea.tiempoEstimado}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => onGuardar(idea)} title={isGuardada ? 'Quitar de guardadas' : 'Guardar'}
            style={{ width: 30, height: 30, borderRadius: 8, background: isGuardada ? 'rgba(29,95,224,0.1)' : 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isGuardada ? <BookmarkCheck size={13} color="#1D5FE0" /> : <Bookmark size={13} color="#86868B" />}
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => onCopiar(idea)} title="Copiar"
            style={{ width: 30, height: 30, borderRadius: 8, background: copiado === idea.id ? 'rgba(48,209,88,0.1)' : 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {copiado === idea.id ? <Check size={13} color="#30D158" /> : <Copy size={13} color="#86868B" />}
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => onDesarrollar(idea)}
            style={{ height: 30, padding: '0 10px', borderRadius: 8, background: '#1D5FE0', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'white' }}>Desarrollar</span>
            <ArrowRight size={11} color="white" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => onDescartar(idea.id)} title="Descartar"
            style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-hover)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={13} color="#86868B" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// Dos modos: página propia (/lluvia-de-ideas, elige cliente con el cliente
// activo compartido) o incrustada en la ficha de cliente (paso Ideas de
// ClienteDetalle) pasando `clienteId` fijo: sin cabecera, sin selector de
// cliente y sin popup de guardadas (la ficha ya lista las ideas del cliente);
// guardar y generar guiones usan siempre ese cliente. `onIdeaGuardada` avisa al
// padre para que refresque lo que muestre debajo.
export default function LluviaDeIdeas({ clienteId: clienteIdFijo = null, cliente: clienteFijo = null, onIdeaGuardada, onIrAGuiones } = {}) {
  const embebido = clienteIdFijo != null
  const { clientes, loading: clientesLoading } = useClientesList()
  const { clienteActivoId, setClienteActivoId } = useClienteActivo()
  const navigate = useNavigate()
  const location = useLocation()

  // "Sin cliente (genérico)" es una elección local de esta página: no se
  // propaga al cliente activo compartido.
  const [sinCliente, setSinCliente] = useState(false)
  const [formato, setFormato] = useState('todos')
  const [numIdeas, setNumIdeas] = useState(12)
  // Ideas guardadas elegidas para generar sus guiones (GenerarGuionesModal);
  // versionGuardadas avisa a IdeasGuardadasMes de que relea qué tienen guion
  const [generarGuiones, setGenerarGuiones] = useState(null) // { ideas, limpiar, regenerar }
  const [versionGuardadas, setVersionGuardadas] = useState(0)
  // Opciones avanzadas plegadas
  const [masOpciones, setMasOpciones] = useState(false)
  const [tema, setTema] = useState('')
  const [tiposContenido, setTiposContenido] = useState([])
  const [creatividad, setCreatividad] = useState(5)
  const [usarTendencias, setUsarTendencias] = useState(true)

  const handleToggleTendencias = () => setUsarTendencias(v => !v)

  // Idea / anuncio / referencia
  const [tieneIdea, setTieneIdea] = useState(false)
  const [tieneAnuncio, setTieneAnuncio] = useState(false)
  const [tieneReferencia, setTieneReferencia] = useState(false)
  const [ideaTexto, setIdeaTexto] = useState('')
  const [anuncioTexto, setAnuncioTexto] = useState('')
  const [anuncioFecha, setAnuncioFecha] = useState('')
  const [anuncioObjetivo, setAnuncioObjetivo] = useState('')
  const [referenciaUrl, setReferenciaUrl] = useState('')
  const [referenciaNota, setReferenciaNota] = useState('')

  // Calendar ideas
  const now = new Date()
  const [calMesVer, setCalMesVer] = useState(now.getMonth())
  const [calAnioVer, setCalAnioVer] = useState(now.getFullYear())
  const [mostrarIdeasCal, setMostrarIdeasCal] = useState(true)

  const [ideas, setIdeas] = useState([])
  const [generando, setGenerando] = useState(false)
  const [progresoIdx, setProgresoIdx] = useState(0)
  const [error, setError] = useState(null)
  const [ideaDesarrollando, setIdeaDesarrollando] = useState(null)
  const [copiado, setCopiado] = useState(null)

  // Cliente efectivo: el activo compartido, o el primero si no existe.
  const clienteData = embebido
    ? (clienteFijo || clientes.find(c => String(c.id) === String(clienteIdFijo)) || null)
    : sinCliente
      ? null
      : (clientes.find(c => String(c.id) === String(clienteActivoId)) || clientes[0] || null)
  const clienteId = clienteData?.id ?? null

  // Métricas reales de Instagram del cliente (si lo tiene conectado): la IA
  // las usa para proponer más de lo que le funciona. Sin conexión, sin plan o
  // si falla, simplemente no se usan.
  const [instagramIA, setInstagramIA] = useState({ clienteId: null, texto: null, usuario: null })
  useEffect(() => {
    if (!clienteId) return undefined
    let vivo = true
    getMetricasInstagram(clienteId)
      .then(m => { if (vivo) setInstagramIA({ clienteId, texto: resumenInstagramParaIA(m), usuario: m?.perfil?.usuario || null }) })
      .catch(() => { if (vivo) setInstagramIA({ clienteId, texto: null, usuario: null }) })
    return () => { vivo = false }
  }, [clienteId])
  const instagramActual = instagramIA.clienteId === clienteId && instagramIA.texto ? instagramIA : null

  // Lo mismo con TikTok, si el cliente lo tiene conectado
  const [tiktokIA, setTiktokIA] = useState({ clienteId: null, texto: null, usuario: null })
  useEffect(() => {
    if (!clienteId) return undefined
    let vivo = true
    getMetricasTikTok(clienteId)
      .then(m => { if (vivo) setTiktokIA({ clienteId, texto: resumenTikTokParaIA(m), usuario: m?.perfil?.usuario || null }) })
      .catch(() => { if (vivo) setTiktokIA({ clienteId, texto: null, usuario: null }) })
    return () => { vivo = false }
  }, [clienteId])
  const tiktokActual = tiktokIA.clienteId === clienteId && tiktokIA.texto ? tiktokIA : null

  const { posts: postsCalMes } = useCalendarioMes(clienteId, calAnioVer, calMesVer)
  const ideasCal = postsCalMes.filter(p => !p.desarrollado)

  const { ideas: guardadas, refetch: refetchGuardadas } = useIdeasList()
  const [mostrarGuardadas, setMostrarGuardadas] = useState(false)
  const [historial, setHistorial] = useState(() => lsGet(LS_HISTORIAL, []))
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const clientesListos = !clientesLoading


  // Auto-abrir el panel de desarrollo si llegamos desde el Dashboard con una idea concreta
  useEffect(() => {
    const targetId = location.state?.desarrollarIdeaId
    if (embebido || !targetId || guardadas.length === 0) return
    const idea = guardadas.find(g => String(g.id) === String(targetId))
    if (idea) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIdeaDesarrollando(idea)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, guardadas]) // eslint-disable-line

  useEffect(() => {
    if (!generando) { setProgresoIdx(0); return }
    const id = setInterval(() => setProgresoIdx(i => (i + 1) % PROGRESO.length), 2000)
    return () => clearInterval(id)
  }, [generando])

  const nombre = clienteData?.nombre || 'el cliente'
  // The AI reuses ids 1-8 across every generation batch, so "already saved" can only
  // be tracked per-session (local ids don't correlate to the real DB ids once saved).
  const [savedMap, setSavedMap] = useState({}) // `${localIdeaId}_${clienteId}` -> dbIdeaId
  const ideasGuardadasIds = Object.keys(savedMap)
  // Con idea propia o vídeo de referencia se adapta eso tal cual: 1 a 3 versiones
  const modoLiteral = (tieneIdea || tieneReferencia) && !tieneAnuncio
  const opcionesNum = modoLiteral ? [1, 2, 3] : [4, 8, 12, 20, 30]
  const nIdeas = opcionesNum.includes(numIdeas) ? numIdeas : opcionesNum[0]
  const canGenerate = (!tieneIdea && !tieneAnuncio && !tieneReferencia)
    || (tieneIdea && !!ideaTexto.trim())
    || (tieneAnuncio && !!anuncioTexto.trim())
    || (tieneReferencia && !!referenciaUrl.trim())

  const mesOpciones = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    return { mes: d.getMonth(), anio: d.getFullYear(), label: `${MESES_ES[d.getMonth()]} ${d.getFullYear()}` }
  })

  const toggleTipoContenido = (id) => setTiposContenido(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const selectCliente = (v) => {
    if (v === '') { setSinCliente(true); return }
    setSinCliente(false)
    setClienteActivoId(v)
  }

  const handleGenerar = async () => {
    if (!canGenerate || generando) return
    setGenerando(true); setError(null); setIdeas([]); setSavedMap({})
    try {
      // Más de 15 ideas no caben en una respuesta de la IA: se piden en tandas
      // de hasta 15, y cada tanda sabe qué títulos no debe repetir
      let recibidas = []
      for (let faltan = nIdeas; faltan > 0 && recibidas.length < nIdeas;) {
        const pedir = Math.min(15, faltan)
        const data = await generarLluviaIdeas(clienteData, tema, {
          tiposContenido, formato, nivelCreatividad: creatividad, numIdeas: pedir,
          usarTendencias,
          tieneIdea, ideaTexto, tieneAnuncio, anuncioTexto, anuncioFecha, anuncioObjetivo,
          tieneReferencia, referenciaUrl, referenciaNota,
          evitarTitulos: recibidas.map(i => i.titulo),
          instagram: instagramActual?.texto || null,
          tiktok: tiktokActual?.texto || null,
        })
        const tanda = (data?.ideas || []).slice(0, pedir)
        if (!tanda.length) break
        recibidas = [...recibidas, ...tanda]
        faltan -= pedir
      }
      // la IA a veces devuelve más de las pedidas: se respeta lo que eligió el
      // usuario. La IA repite los ids 1..N en cada tanda: se renumeran.
      const lote = Date.now()
      const nuevas = recibidas.slice(0, nIdeas).map((idea, i) => ({
        ...idea, id: `${lote}_${i + 1}`, ...(formato !== 'todos' ? { formato } : {}),
      }))
      setIdeas(nuevas)
      const temaDisplay = tema || (tieneIdea ? ideaTexto : tieneAnuncio ? anuncioTexto : referenciaUrl) || ''
      const entrada = { tema: temaDisplay, cliente: clienteData?.nombre || 'Sin cliente', numIdeas: nuevas.length, fecha: new Date().toISOString(), ideas: nuevas }
      const nuevo = [entrada, ...historial].slice(0, 5)
      setHistorial(nuevo); lsSet(LS_HISTORIAL, nuevo)
    } catch (e) { setError(e.message || 'Error al generar ideas') }
    finally { setGenerando(false) }
  }

  // Guardar solo guarda: las ideas ya no van al calendario. Las guardadas del
  // mes salen abajo (IdeasGuardadasMes) para generar sus guiones de una vez.
  // Vídeo ⇄ carrusel en una idea recién generada; si ya está guardada, también en la guardada
  // (y reescribe su texto para ese formato: nada de "carrusel de 5 fotos" en un vídeo)
  const [cambiandoFormato, setCambiandoFormato] = useState(null)
  const handleCambiarFormato = async (idea) => {
    if (cambiandoFormato) return
    const formato = otroFormato(formatoDe(idea))
    setCambiandoFormato(idea.id)
    const nueva = await reescribirIdea(clienteData, idea, { formato, sinTexto: esSinTexto(idea) }).catch(() => null)
    const cambios = { formato, ...(nueva || {}) }
    setIdeas(prev => prev.map(x => x.id === idea.id ? { ...x, ...cambios } : x))
    const dbId = savedMap[`${idea.id}_${clienteId}`]
    if (dbId) { await actualizarIdea(dbId, cambios); refetchGuardadas() }
    setCambiandoFormato(null)
  }

  // Editor de "Desarrollar": guarda la idea editada (recién generada o ya
  // guardada) y devuelve la guardada; luego, si se pide, escribe su guion en
  // Guiones del mes (o lo reescribe si ya tenía uno), igual que las guardadas
  const guardarDesdeEditor = async (idea, campos) => {
    // Ya guardada (viene de la base de datos)
    if (idea.fechaGuardada) {
      const { data } = await actualizarIdea(idea.id, campos)
      refetchGuardadas(); onIdeaGuardada?.()
      return data ? { ...idea, ...data } : null
    }
    const clave = `${idea.id}_${clienteId}`
    setIdeas(prev => prev.map(x => x.id === idea.id ? { ...x, ...campos } : x))
    const dbId = savedMap[clave]
    if (dbId) {
      const { data } = await actualizarIdea(dbId, campos)
      refetchGuardadas(); onIdeaGuardada?.()
      return data ? { ...data, id: dbId } : null
    }
    const { data: nuevaIdea } = await crearIdea({ ...idea, ...campos, clienteId })
    if (nuevaIdea) setSavedMap(prev => ({ ...prev, [clave]: nuevaIdea.id }))
    refetchGuardadas(); onIdeaGuardada?.()
    return nuevaIdea
  }
  const escribirGuionDeIdea = async (guardada) => {
    const existente = clienteData ? await getPostPorIdea(clienteData.id, guardada.id) : null
    setGenerarGuiones({ ideas: [guardada], limpiar: () => {}, regenerar: !!existente?.guion })
  }

  const handleGuardar = async (idea) => {
    const clave = `${idea.id}_${clienteId}`
    const dbId = savedMap[clave]
    if (dbId) {
      await eliminarIdea(dbId)
      setSavedMap(prev => { const n = { ...prev }; delete n[clave]; return n })
    } else {
      const { data: nuevaIdea } = await crearIdea({ ...idea, clienteId })
      if (nuevaIdea) setSavedMap(prev => ({ ...prev, [clave]: nuevaIdea.id }))
    }
    refetchGuardadas()
    onIdeaGuardada?.()
  }

  const irAGuiones = (año, mes) => {
    if (onIrAGuiones) { onIrAGuiones(año, mes); return }
    if (clienteId) setClienteActivoId(String(clienteId))
    navigate(`/guiones-del-mes?mes=${año}-${String(mes + 1).padStart(2, '0')}`)
  }

  const handleCopiar = (idea) => {
    navigator.clipboard.writeText(idea.titulo + '\n\n' + idea.concepto).catch(() => {})
    setCopiado(idea.id); setTimeout(() => setCopiado(null), 2000)
  }

  const cargarSesion = (entrada) => { setTema(entrada.tema); setIdeas(entrada.ideas || []); setMostrarHistorial(false) }

  // ── Render ──

  const redesActivasStr = clienteData
    ? Object.entries(clienteData.redesDetalladas || {}).filter(([, r]) => r?.activa).map(([n]) => n).join(', ')
    : ''

  return (
    <div style={embebido ? undefined : { flex: 1, background: 'var(--gradient-bg)', minHeight: '100vh' }}>
      <style>{`@keyframes shimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(100%) } }`}</style>

      <AnimatePresence>
        {ideaDesarrollando && (
          <EditorIdea key={ideaDesarrollando.id} idea={ideaDesarrollando} cliente={clienteData}
            onClose={() => setIdeaDesarrollando(null)}
            onGuardar={(campos) => guardarDesdeEditor(ideaDesarrollando, campos)}
            onEscribirGuion={escribirGuionDeIdea} />
        )}
      </AnimatePresence>


      <div style={embebido ? { maxWidth: 1100 } : { maxWidth: 1100, margin: '0 auto', padding: '40px 40px 80px' }}>
        {/* Header */}
        {!embebido && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #FF9500, #FF2D55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lightbulb size={18} color="white" strokeWidth={2} />
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.6px', margin: 0 }}>Lluvia de Ideas</h1>
            </div>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: 0 }}>Transforma cualquier idea en un universo de contenido</p>
          </div>
          <button onClick={() => setMostrarGuardadas(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 20, background: 'var(--bg-card)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'inherit', flexShrink: 0 }}>
            <Bookmark size={14} /> Ver guardadas {guardadas.length > 0 ? `(${guardadas.length})` : ''}
          </button>
        </motion.div>}

        {/* Input card */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}
          style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid var(--border-subtle)', marginBottom: 20 }}>

          {/* ── Cliente ── */}
          {!embebido && <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Cliente</label>
            {!clientesListos ? (
              <select disabled style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.12)', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'rgba(0,0,0,0.03)', cursor: 'not-allowed', color: 'var(--text-secondary)' }}>
                <option>Cargando clientes...</option>
              </select>
            ) : (
              <select value={clienteId ?? ''} onChange={e => selectCliente(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.12)', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <option value="" disabled>Selecciona un cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.sector ? ` · ${c.sector}` : ''}</option>)}
                <option value="">Sin cliente (genérico)</option>
              </select>
            )}
            <AnimatePresence>
              {clienteData && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(29,95,224,0.04)', borderRadius: 10, border: '1px solid rgba(29,95,224,0.12)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #007BFF, #4DA3FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {clienteData.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{clienteData.nombre}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{clienteData.sector}{redesActivasStr ? ` · ${redesActivasStr}` : ''}</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => selectCliente('')}
                    style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <X size={11} color="#86868B" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>}

          {/* ── Ideas del calendario ── */}
          <AnimatePresence>
            {clienteData && ideasCal.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ background: 'rgba(61,155,255,0.04)', borderRadius: 12, border: '1px solid rgba(61,155,255,0.15)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', cursor: 'pointer' }} onClick={() => setMostrarIdeasCal(v => !v)}>
                    <Calendar size={13} color="#3D9BFF" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#3D9BFF', flex: 1 }}>Ideas del calendario sin desarrollar ({ideasCal.length})</span>
                    <select value={`${calAnioVer}-${calMesVer}`}
                      onChange={e => { e.stopPropagation(); const [y, m] = e.target.value.split('-'); setCalAnioVer(Number(y)); setCalMesVer(Number(m)) }}
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 11, border: '1px solid rgba(61,155,255,0.2)', borderRadius: 6, padding: '3px 6px', background: 'var(--bg-card)', color: '#3D9BFF', fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}>
                      {mesOpciones.map(o => <option key={`${o.anio}-${o.mes}`} value={`${o.anio}-${o.mes}`}>{o.label}</option>)}
                    </select>
                    {mostrarIdeasCal ? <ChevronUp size={13} color="#86868B" /> : <ChevronDown size={13} color="#86868B" />}
                  </div>
                  <AnimatePresence>
                    {mostrarIdeasCal && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {ideasCal.slice(0, 5).map((post, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                              <div style={{ width: 2, height: 28, borderRadius: 1, background: '#3D9BFF', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.titulo}</p>
                                <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0 }}>Día {post.dia} · {post.red}</p>
                              </div>
                              <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(61,155,255,0.1)', color: '#3D9BFF', flexShrink: 0 }}>Del calendario</span>
                              <motion.button whileTap={{ scale: 0.9 }} onClick={() => irAGuiones(post.año, post.mes - 1)}
                                title="Su guion se escribe en Guiones del mes"
                                style={{ padding: '5px 10px', borderRadius: 7, background: '#3D9BFF', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'white', fontFamily: 'inherit', flexShrink: 0 }}>
                                Ir a guiones
                              </motion.button>
                            </div>
                          ))}
                          {ideasCal.length > 5 && <p style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>+{ideasCal.length - 5} más en el calendario</p>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Tipo de contenido ── */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>¿Qué tipo de contenido?</label>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 10px' }}>La temática o propósito del contenido</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {TIPOS_CONTENIDO.map(t => {
                const sel = tiposContenido.includes(t.id)
                const Icon = t.icon
                return (
                  <motion.button key={t.id} whileTap={{ scale: 0.94 }} onClick={() => toggleTipoContenido(t.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: `1.5px solid ${sel ? '#1D5FE0' : 'var(--border-color)'}`, background: sel ? '#1D5FE0' : 'var(--bg-card)', color: sel ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                    <Icon size={12} style={{ flexShrink: 0 }} /> {t.label}
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* ── Cuántas + Creatividad ── */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 130 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{modoLiteral ? '¿Cuántas versiones?' : '¿Cuántas ideas?'}</label>
              <select value={nIdeas} onChange={e => setNumIdeas(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.12)', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                {opcionesNum.map(n => <option key={n} value={n}>{modoLiteral ? `${n} ${n === 1 ? 'versión' : 'versiones'}` : `${n} ideas`}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Creatividad</label>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1D5FE0' }}>{creatividad}/10</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Conservador</span>
                <input type="range" min={1} max={10} value={creatividad} onChange={e => setCreatividad(Number(e.target.value))} style={{ flex: 1, accentColor: '#1D5FE0' }} />
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Experimental</span>
              </div>
            </div>
          </div>

          {/* ── Más opciones: idea propia, anuncio, vídeo de referencia, formato y tendencias ── */}
          <button onClick={() => setMasOpciones(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: masOpciones ? 14 : 18, fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
            <SlidersHorizontal size={13} /> Más opciones
            {(tieneIdea || tieneAnuncio || tieneReferencia || formato !== 'todos') && !masOpciones && (
              <span style={{ fontSize: 11, color: '#1D5FE0' }}>· activas</span>
            )}
            {masOpciones ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {masOpciones && (
            <div style={{ padding: '16px 16px 4px', borderRadius: 14, background: 'var(--bg-secondary)', marginBottom: 18 }}>
            {/* ── Tengo una idea / anuncio / me gusta este video ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
                <motion.div whileTap={{ scale: 0.98 }} onClick={() => setTieneIdea(v => !v)}
                  style={{ padding: '14px 16px', borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${tieneIdea ? '#1D5FE0' : 'var(--border-color)'}`, background: tieneIdea ? 'rgba(29,95,224,0.05)' : 'var(--bg-card)', transition: 'all 0.2s', position: 'relative' }}>
                  {tieneIdea && <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: '#1D5FE0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="white" strokeWidth={3} /></div>}
                  <Lightbulb size={20} color={tieneIdea ? '#1D5FE0' : '#86868B'} strokeWidth={1.8} style={{ marginBottom: 6 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: tieneIdea ? '#1D5FE0' : 'var(--text-primary)', margin: '0 0 3px' }}>Tengo una idea</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>Ya sé de qué quiero hablar, ayúdame a desarrollarla</p>
                </motion.div>
                <motion.div whileTap={{ scale: 0.98 }} onClick={() => setTieneAnuncio(v => !v)}
                  style={{ padding: '14px 16px', borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${tieneAnuncio ? '#FF9500' : 'var(--border-color)'}`, background: tieneAnuncio ? 'rgba(255,149,0,0.05)' : 'var(--bg-card)', transition: 'all 0.2s', position: 'relative' }}>
                  {tieneAnuncio && <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: '#FF9500', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="white" strokeWidth={3} /></div>}
                  <Megaphone size={20} color={tieneAnuncio ? '#FF9500' : '#86868B'} strokeWidth={1.8} style={{ marginBottom: 6 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: tieneAnuncio ? '#FF9500' : 'var(--text-primary)', margin: '0 0 3px' }}>Tengo algo que anunciar</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>Tengo una novedad, oferta o lanzamiento que comunicar</p>
                </motion.div>
                <motion.div whileTap={{ scale: 0.98 }} onClick={() => setTieneReferencia(v => !v)}
                  style={{ padding: '14px 16px', borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${tieneReferencia ? '#FF2D55' : 'var(--border-color)'}`, background: tieneReferencia ? 'rgba(255,45,85,0.05)' : 'var(--bg-card)', transition: 'all 0.2s', position: 'relative' }}>
                  {tieneReferencia && <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: '#FF2D55', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="white" strokeWidth={3} /></div>}
                  <Heart size={20} color={tieneReferencia ? '#FF2D55' : '#86868B'} strokeWidth={1.8} style={{ marginBottom: 6 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: tieneReferencia ? '#FF2D55' : 'var(--text-primary)', margin: '0 0 3px' }}>Me gusta este video</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>Pega el enlace de un vídeo que te inspire y te doy ideas parecidas</p>
                </motion.div>
              </div>
              {!tieneIdea && !tieneAnuncio && !tieneReferencia && <p style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>O deja las tres sin marcar para que la IA proponga ideas en general</p>}
              <AnimatePresence>
                {tieneIdea && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#1D5FE0', display: 'block', marginBottom: 6 }}>¿Cuál es tu idea?</label>
                    <textarea value={ideaTexto} onChange={e => setIdeaTexto(e.target.value)} rows={3}
                      placeholder={"Describe tu idea brevemente...\nEj: Quiero hacer un vídeo mostrando cómo preparamos nuestro plato estrella"}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(29,95,224,0.3)', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box', background: 'rgba(29,95,224,0.02)' }}
                      onFocus={e => e.target.style.borderColor = '#1D5FE0'} onBlur={e => e.target.style.borderColor = 'rgba(29,95,224,0.3)'} />
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {tieneAnuncio && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#FF9500', display: 'block', marginBottom: 6 }}>¿Qué quieres anunciar?</label>
                    <textarea value={anuncioTexto} onChange={e => setAnuncioTexto(e.target.value)} rows={3}
                      placeholder={"Describe el anuncio...\nEj: Abrimos los domingos por la tarde a partir del 1 de junio"}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(255,149,0,0.3)', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box', background: 'rgba(255,149,0,0.02)', marginBottom: 10 }}
                      onFocus={e => e.target.style.borderColor = '#FF9500'} onBlur={e => e.target.style.borderColor = 'rgba(255,149,0,0.3)'} />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>¿Cuándo es? <span style={{ fontWeight: 400 }}>(opcional)</span></label>
                        <input type="date" value={anuncioFecha} onChange={e => setAnuncioFecha(e.target.value)}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.12)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }} />
                      </div>
                      <div style={{ flex: 2, minWidth: 200 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Objetivo principal</label>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {ANUNCIO_OBJETIVOS.map(o => (
                            <motion.button key={o} whileTap={{ scale: 0.94 }} onClick={() => setAnuncioObjetivo(v => v === o ? '' : o)}
                              style={{ padding: '5px 10px', borderRadius: 16, fontSize: 11, fontWeight: 500, border: `1.5px solid ${anuncioObjetivo === o ? '#FF9500' : 'var(--border-color)'}`, background: anuncioObjetivo === o ? '#FF9500' : 'var(--bg-card)', color: anuncioObjetivo === o ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                              {o}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {tieneReferencia && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#FF2D55', display: 'block', marginBottom: 6 }}>Enlace del vídeo</label>
                    <div style={{ position: 'relative', marginBottom: 10 }}>
                      <Link2 size={14} color="#FF2D55" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                      <input type="url" value={referenciaUrl} onChange={e => setReferenciaUrl(e.target.value)}
                        placeholder="https://www.tiktok.com/@usuario/video/..."
                        style={{ width: '100%', padding: '10px 14px 10px 34px', borderRadius: 10, border: '1.5px solid rgba(255,45,85,0.3)', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: 'rgba(255,45,85,0.02)' }}
                        onFocus={e => e.target.style.borderColor = '#FF2D55'} onBlur={e => e.target.style.borderColor = 'rgba(255,45,85,0.3)'} />
                    </div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#FF2D55', display: 'block', marginBottom: 6 }}>¿Qué te gusta de este vídeo? <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(opcional)</span></label>
                    <textarea value={referenciaNota} onChange={e => setReferenciaNota(e.target.value)} rows={2}
                      placeholder={"Ej: El ritmo rápido, el gancho del principio, el formato antes/después..."}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(255,45,85,0.3)', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box', background: 'rgba(255,45,85,0.02)' }}
                      onFocus={e => e.target.style.borderColor = '#FF2D55'} onBlur={e => e.target.style.borderColor = 'rgba(255,45,85,0.3)'} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ minWidth: 160 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>¿En qué formato?</label>
                <select value={formato} onChange={e => setFormato(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.12)', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  {FORMATOS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Tendencias</span>
                <motion.div onClick={handleToggleTendencias}
                  style={{
                    width: 40, height: 24, borderRadius: 12, cursor: 'pointer',
                    background: usarTendencias ? '#1D5FE0' : 'rgba(0,0,0,0.15)',
                    position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                  }}>
                  <motion.div animate={{ x: usarTendencias ? 18 : 2 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-card)', position: 'absolute', top: 3, left: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                </motion.div>
              </div>
              </div>
            </div>
          )}

          {(modoLiteral || instagramActual || tiktokActual) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {modoLiteral && (
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  Se respeta tu {tieneReferencia && !tieneIdea ? 'vídeo de referencia' : 'idea'} tal cual: solo se adapta al estilo e imagen de {nombre}. Pide más versiones si quieres otros ganchos.
                </p>
              )}
              {instagramActual && (
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#30D158', flexShrink: 0 }} />
                  Usando lo que le funciona en Instagram{instagramActual.usuario ? ` (@${instagramActual.usuario})` : ''}
                </p>
              )}
              {tiktokActual && (
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#30D158', flexShrink: 0 }} />
                  Usando lo que le funciona en TikTok{tiktokActual.usuario ? ` (@${tiktokActual.usuario})` : ''}
                </p>
              )}
            </div>
          )}

          <motion.button whileHover={{ backgroundColor: '#BEE62A' }} whileTap={{ scale: 0.98 }}
            onClick={handleGenerar} disabled={!canGenerate || generando}
            style={{ width: '100%', padding: '14px', borderRadius: 14, background: !canGenerate || generando ? '#86868B' : '#D7FF3D', color: !canGenerate || generando ? 'white' : '#0B0C10', border: 'none', cursor: !canGenerate || generando ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: canGenerate && !generando ? '0 2px 20px rgba(215,255,61,0.4)' : 'none', transition: 'background 0.2s' }}>
            <Sparkles size={16} /> {modoLiteral ? (clienteData ? `Adaptar a ${clienteData.nombre}` : 'Adaptar') : clienteData ? `Generar ideas para ${clienteData.nombre}` : 'Generar ideas'}
          </motion.button>
        </motion.div>

        {/* Historial */}
        {historial.length > 0 && !generando && ideas.length === 0 && (
          <div style={{ marginBottom: 24 }}>
            <button onClick={() => setMostrarHistorial(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit', padding: 0, marginBottom: mostrarHistorial ? 12 : 0 }}>
              <Clock size={14} /> Sesiones anteriores ({historial.length}) {mostrarHistorial ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <AnimatePresence>
              {mostrarHistorial && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {historial.map((h, i) => (
                      <motion.div key={i} whileHover={{ backgroundColor: '#F0F7FF' }} onClick={() => cargarSesion(h)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.15s' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.tema}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{h.cliente} · {h.numIdeas} ideas · {new Date(h.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                        </div>
                        <ChevronRight size={14} color="#86868B" />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'rgba(255,59,48,0.06)', borderRadius: 14, border: '1px solid rgba(255,59,48,0.18)', marginBottom: 24 }}>
            <AlertCircle size={16} color="#FF3B30" />
            <span style={{ fontSize: 14, color: '#FF3B30', flex: 1 }}>{error}</span>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleGenerar} style={{ fontSize: 12, color: '#FF3B30', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Reintentar</motion.button>
          </div>
        )}

        {/* Loading */}
        {generando && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{modoLiteral ? `Adaptando tu ${tieneReferencia && !tieneIdea ? 'vídeo' : 'idea'} a ${nombre}...` : `Generando ${nIdeas} ideas creativas...`}</p>
              <AnimatePresence mode="wait">
                <motion.p key={progresoIdx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  {PROGRESO[progresoIdx](nombre)}
                </motion.p>
              </AnimatePresence>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {Array.from({ length: nIdeas }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        )}

        {/* Ideas grid */}
        {!generando && ideas.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>{ideas.length} ideas generadas{clienteData ? ` para ${clienteData.nombre}` : ''}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleGenerar}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 20, background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                  <Zap size={12} /> Regenerar
                </motion.button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {ideas.map((idea, i) => (
                <IdeaCard key={idea.id} idea={idea} idx={i} ideasGuardadasIds={ideasGuardadasIds} clienteId={clienteId}
                  onGuardar={handleGuardar} onDesarrollar={setIdeaDesarrollando}
                  onCopiar={handleCopiar} onDescartar={id => setIdeas(prev => prev.filter(x => x.id !== id))} copiado={copiado}
                  onCambiarFormato={handleCambiarFormato} cambiandoFormato={cambiandoFormato === idea.id}
                  />
              ))}
            </div>
          </div>
        )}


        {/* Ideas guardadas — popup */}
        <AnimatePresence>
          {mostrarGuardadas && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setMostrarGuardadas(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199 }} />
              {/* Plain (non-animated) fixed wrapper does the viewport centering via flexbox —
                  Framer Motion owns the `transform` CSS property on the inner motion.div for its
                  own scale/y animation, so a manual translate(-50%,-50%) there gets clobbered. */}
              <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, pointerEvents: 'none' }}>
                <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    pointerEvents: 'auto',
                    width: 480, maxWidth: '100%', maxHeight: '100%',
                    background: 'var(--bg-card)', borderRadius: 20, boxShadow: '0 16px 56px rgba(0,0,0,0.24)',
                    border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Ideas guardadas</p>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMostrarGuardadas(false)}
                      style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={14} color="var(--text-secondary)" />
                    </motion.button>
                  </div>
                  <div style={{ padding: '16px 20px 20px', overflowY: 'auto', flex: 1 }}>
                    {guardadas.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                          <Bookmark size={22} color="var(--text-secondary)" />
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Aún no has guardado ninguna idea</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {guardadas.map((g) => (
                          <div key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>{g.titulo}</p>
                              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{clientes.find(c => String(c.id) === String(g.clienteId))?.nombre || 'Sin cliente'} · {new Date(g.fechaGuardada).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setIdeaDesarrollando(g); setMostrarGuardadas(false) }}
                              style={{ padding: '5px 10px', borderRadius: 8, background: '#1D5FE0', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                              Desarrollar
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.9 }} onClick={async () => { await eliminarIdea(g.id); refetchGuardadas() }}
                              style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,59,48,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <X size={12} color="#FF3B30" />
                            </motion.button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!generando && ideas.length === 0 && !error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            style={{ textAlign: 'center', padding: '64px 40px' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Lightbulb size={32} color="rgba(0,0,0,0.18)" strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Cuéntame una idea y la convertiré en {nIdeas} conceptos de contenido</p>
            {!embebido && <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Funciona mejor cuando seleccionas un cliente</p>}
          </motion.div>
        )}

        {/* Ideas guardadas del mes → elegir y generar sus guiones (sin calendario) */}
        {!generando && clienteData && (
          <IdeasGuardadasMes cliente={clienteData} guardadas={guardadas} version={versionGuardadas}
            onDesarrollar={setIdeaDesarrollando}
            onGenerar={(elegidas, limpiar, regenerar) => setGenerarGuiones({ ideas: elegidas, limpiar, regenerar })}
            onIdeaCreada={() => { refetchGuardadas(); onIdeaGuardada?.() }} />
        )}
        {generarGuiones && (
          <GenerarGuionesModal
            open
            cliente={clienteData}
            ideas={generarGuiones.ideas}
            regenerar={!!generarGuiones.regenerar}
            mesOpciones={mesOpciones}
            onClose={(generado) => {
              if (generado) { generarGuiones.limpiar(); setVersionGuardadas(v => v + 1); onIdeaGuardada?.() }
              setGenerarGuiones(null)
            }}
            onHecho={({ año, mes }) => { generarGuiones.limpiar(); setGenerarGuiones(null); irAGuiones(año, mes) }}
          />
        )}
      </div>
    </div>
  )
}
