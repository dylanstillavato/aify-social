import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles, AlertCircle, RefreshCw, Copy, Check, Save, X, Download, History, ChevronDown, Undo2, SearchCheck,
} from 'lucide-react'
import { generarCopies, generarGuion, regenerarParteGuion, revisarGancho, ERRORES_GANCHO } from '../services/ai'
import { exportarGuion } from '../services/exportPDF'
import { actualizarIdea } from '../hooks/useIdeas'
import { formatoDe } from '../utils/formato'
import { CAMPOS_HISTORIA, HISTORIA_VACIA, normalizarHistoria, textoHistoria } from '../utils/historia'
import { actualizarPost, getPostPorIdea } from '../hooks/useCalendario'
import { useGeneracionDePantalla } from '../hooks/useGeneraciones'

const esFormatoVideo = (idea) => ['video', 'video_corto', 'video_largo'].includes(idea?.formato)
const esFormatoTexto = (idea) => ['carrusel', 'texto_imagen', 'texto_corto', 'seo_local'].includes(idea?.formato)
const FORMAT_TO_RED = {
  video: 'instagram_reel', carrusel: 'instagram_post',
  video_corto: 'instagram_reel', video_largo: 'youtube', texto_imagen: 'instagram_post', texto_corto: 'whatsapp', seo_local: 'googlemaps',
}

// Real AI guión shape: { gancho, problema:{texto,segundos}, promesa:{texto,segundos},
// contenido:{frases:[],loopAbierto,segundos}, cierre:{remate,cta,segundos},
// duracion_total, tip_viral, texto_pantalla:[], audio_sugerido, planos:[], historia }
// historia (la historia en 5 líneas) se edita aquí; los guiones antiguos no la
// traen y salen con las 5 líneas vacías para que el gestor la escriba.
// texto_pantalla y planos no se editan aquí, pero se arrastran para que
// guardar una edición no los borre (los planos se editan en Guiones del mes).
const shapeAAEditable = (res) => ({
  formato: res.formato || null,
  historia: { ...HISTORIA_VACIA, ...(normalizarHistoria(res.historia) || {}) },
  gancho: res.gancho || '',
  problema: res.problema?.texto || '',
  promesa: res.promesa?.texto || '',
  frases: [...(res.contenido?.frases || [])],
  loopAbierto: res.contenido?.loopAbierto || '',
  remate: res.cierre?.remate || '',
  cta: res.cierre?.cta || '',
  duracionTotal: res.duracion_total || '',
  tipViral: res.tip_viral || '',
  audioSugerido: res.audio_sugerido || '',
  textoPantalla: res.texto_pantalla || [],
  planos: res.planos || null,
})
const editableAShapeA = (g) => ({
  ...(normalizarHistoria(g.historia) ? { historia: normalizarHistoria(g.historia) } : {}),
  gancho: g.gancho,
  problema: { texto: g.problema, segundos: '4-10' },
  promesa: { texto: g.promesa, segundos: '10-20' },
  contenido: { frases: g.frases, loopAbierto: g.loopAbierto, segundos: '20-50' },
  cierre: { remate: g.remate, cta: g.cta, segundos: '50-60' },
  duracion_total: g.duracionTotal,
  tip_viral: g.tipViral,
  audio_sugerido: g.audioSugerido,
  texto_pantalla: g.textoPantalla || [],
  ...(g.planos ? { planos: g.planos } : {}),
  ...(g.formato ? { formato: g.formato } : {}),
})

const formatFechaHora = (iso) => {
  try {
    return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

// Sección colapsable de versiones anteriores, compartida por el tab de guión
// y el de copy. `historial` viene de ideas.guion_historial/copy_historial
// (poblado por el trigger de Postgres guardar_historial_guion_copy — se
// llena solo, sin que este componente tenga que acordarse de "guardar el
// valor viejo" en cada punto donde genera o edita contenido). Restaurar una
// versión antigua simplemente la vuelve a guardar como actual, lo que hace
// que el trigger capture la versión que se acaba de reemplazar — deshacer/
// rehacer natural sin lógica extra aquí.
function HistorialVersiones({ historial, campo, onRestaurar, restaurando }) {
  const [abierto, setAbierto] = useState(historial.length <= 2)
  if (!historial.length) return null
  const ordenado = [...historial].reverse() // más reciente primero
  return (
    <div style={{ marginTop: 10, borderRadius: 10, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      <button onClick={() => setAbierto(v => !v)}
        style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <History size={12} /> Versiones anteriores ({historial.length})
        </span>
        <ChevronDown size={13} color="#86868B" style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {abierto && (
        <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ordenado.map((entrada, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatFechaHora(entrada.guardado_en)}</span>
              <button onClick={() => onRestaurar(entrada[campo])} disabled={restaurando}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border-color)', cursor: restaurando ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 500, color: '#1D5FE0', fontFamily: 'inherit' }}>
                <Undo2 size={11} /> Restaurar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Botón pequeño de "regenerar solo esta parte", usado junto a cada label de
// sección del guión (gancho, problema, cta, cada frase...). `activo` pinta el
// spinner de esta parte en concreto; `disabled` frena todos los botones a la
// vez mientras cualquier regeneración parcial (o la del guión completo) está
// en curso, para no pisar guionEditado con dos respuestas de IA en paralelo.
function BotonRegenerarParte({ activo, disabled, onClick }) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} onClick={onClick} disabled={disabled}
      title="Regenerar esta parte con IA"
      style={{ width: 20, height: 20, borderRadius: 6, background: 'transparent', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#86868B', flexShrink: 0, opacity: disabled && !activo ? 0.4 : 1 }}>
      {activo
        ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px solid rgba(0,0,0,0.15)', borderTopColor: '#86868B' }} />
        : <RefreshCw size={11} />}
    </motion.button>
  )
}

// Shared by LluviaDeIdeas.jsx and ClienteDetalle.jsx's TabIdeas — generating a
// guión/copy here always persists immediately to the idea itself (actualizarIdea),
// not just when the idea happens to already be linked to a calendar post. Relying
// only on the linked-post save (or the separate "Guardar cambios" button, for
// guiones) meant a freshly generated result for an idea with no calendar post yet
// lived only in local component state — closing the panel silently lost it.
export default function PanelDesarrollar({ idea, cliente, onClose }) {
  const esVideo = esFormatoVideo(idea)
  const esTexto = esFormatoTexto(idea)
  const tabs = []
  if (!esTexto) tabs.push({ id: 'guion', label: 'Generar Guion' })
  if (!esVideo) tabs.push({ id: 'copy', label: 'Generar Copy' })
  const tabInicial = esTexto ? 'copy' : 'guion'
  const [tab, setTab] = useState(tabInicial)
  // Generar el guion va a la cola de generaciones: sigue aunque se cierre el
  // panel o se cambie de página, y al volver el botón sigue «Generando...»
  const location = useLocation()
  const { ejecutar, enCurso } = useGeneracionDePantalla()
  const [generandoAqui, setGenerando] = useState(false)
  const generando = generandoAqui || !!enCurso(`desarrollar-${idea.id}`)
  // Lazy-initialized from the idea's already-saved guión/copy (if any) so
  // reopening a "Con guión"/"Con copy" idea shows the saved content instead of
  // dropping the user back at the "Generar" landing state every time. Safe as
  // a lazy initializer (not an effect) because this component is always freshly
  // mounted per-idea — every caller conditionally renders it (`{idea && <PanelDesarrollar idea .../>}`),
  // so a different idea means a real unmount/remount, not a prop update on the same instance.
  const [resultCopy, setResultCopy] = useState(() => idea.copy || null)
  const [resultGuion, setResultGuion] = useState(() => idea.guion || null)
  const [guionEditado, setGuionEditado] = useState(() => idea.guion ? shapeAAEditable(idea.guion) : null)
  const [error, setError] = useState(null)
  const [copiedVariante, setCopiedVariante] = useState(null)
  const [copiadoGuion, setCopiadoGuion] = useState(false)
  const [guardadoGuion, setGuardadoGuion] = useState(false)
  const [exportandoGuion, setExportandoGuion] = useState(false)
  // Historial de versiones (columnas guion_historial/copy_historial, llenadas
  // por el trigger de Postgres). Se refresca leyendo la fila devuelta por
  // cada actualizarIdea() — no hace falta refetch aparte.
  const [guionHistorial, setGuionHistorial] = useState(() => idea.guionHistorial || [])
  const [copyHistorial, setCopyHistorial] = useState(() => idea.copyHistorial || [])
  const [restaurando, setRestaurando] = useState(false)
  // Clave de la parte que se está regenerando ahora mismo ('gancho', 'cta',
  // `frase-${idx}`...), o null si ninguna. Sirve tanto para pintar el spinner
  // del botón correcto como para bloquear el resto mientras dura la llamada.
  const [regenerandoParte, setRegenerandoParte] = useState(null)
  // Cómo estaba el guion antes de la última parte regenerada (aún sin guardar):
  // "Deshacer" lo devuelve tal cual
  const [antesDeParte, setAntesDeParte] = useState(null)
  // Resultado de "Revisar gancho" ({ gancho, errores, principal, version }).
  // Guarda el texto revisado para esconder el resultado si el gancho cambia.
  const [revisionGancho, setRevisionGancho] = useState(null)
  const [revisandoGancho, setRevisandoGancho] = useState(false)

  const clienteParaGenerar = cliente || { nombre: 'Cliente genérico', sector: 'General', tono: 'cercano_divertido', redes: {}, audiencia: {} }

  const handleGenCopy = async () => {
    if (generando) return
    setGenerando(true); setError(null)
    try {
      const redMapeada = FORMAT_TO_RED[idea.formato] || 'instagram_reel'
      const res = await generarCopies(clienteParaGenerar, redMapeada, idea.concepto)
      setResultCopy(res)
      if (res?.[0]?.copy) {
        const { data: ideaActualizada } = await actualizarIdea(idea.id, { copy: res })
        if (ideaActualizada?.copyHistorial) setCopyHistorial(ideaActualizada.copyHistorial)
        if (cliente?.id) {
          const post = await getPostPorIdea(cliente.id, idea.id)
          if (post) actualizarPost(cliente.id, post.id, { copy: res[0].copy, desarrollado: true })
        }
      }
    } catch (e) { setError(e.message || 'Error al generar copies') }
    finally { setGenerando(false) }
  }

  // Con `historia`, el guion se reescribe desde esa historia en 5 líneas
  const handleGenGuion = async (historia = null) => {
    if (generando) return
    setGenerando(true); setError(null)
    try {
      await ejecutar({
        tipo: 'guion', clave: `desarrollar-${idea.id}`,
        titulo: `Guion «${idea.titulo || idea.concepto || 'Idea'}»${cliente?.nombre ? ` · ${cliente.nombre}` : ''}`,
        clienteId: cliente?.id || null,
        destino: { ruta: `${location.pathname}${location.search}` },
      }, async () => {
        const res = await generarGuion(clienteParaGenerar, idea.concepto, true, {}, formatoDe(idea), { historia })
        setResultGuion(res)
        if (res) {
          setGuionEditado(shapeAAEditable(res))
          const { data: ideaActualizada } = await actualizarIdea(idea.id, { guion: res })
          if (ideaActualizada?.guionHistorial) setGuionHistorial(ideaActualizada.guionHistorial)
          if (cliente?.id) {
            const post = await getPostPorIdea(cliente.id, idea.id)
            if (post) await actualizarPost(cliente.id, post.id, { guion: res, desarrollado: true })
          }
        }
      })
    } catch (e) { setError(e.message || 'Error al generar guion') }
    finally { setGenerando(false) }
  }

  const handleRegenerarGuion = () => { setAntesDeParte(null); setResultGuion(null); setGuionEditado(null); handleGenGuion() }
  const historiaCompleta = normalizarHistoria(guionEditado?.historia)
  const handleReescribirDesdeHistoria = () => {
    if (!historiaCompleta) return
    setAntesDeParte(null); setResultGuion(null); setGuionEditado(null); handleGenGuion(historiaCompleta)
  }
  const updateHistoria = (key, value) => setGuionEditado(p => ({ ...p, historia: { ...p.historia, [key]: value } }))

  const handleRegenerarParte = async (parte, indiceFrase = null) => {
    if (regenerandoParte || generando || !guionEditado) return
    const key = indiceFrase != null ? `frase-${indiceFrase}` : parte
    setRegenerandoParte(key); setError(null)
    try {
      const nuevoValor = await regenerarParteGuion(clienteParaGenerar, idea.concepto, guionEditado, parte, { indiceFrase })
      if (nuevoValor == null) return
      setAntesDeParte(guionEditado)
      if (indiceFrase != null) updateFrase(indiceFrase, nuevoValor)
      else setGuionEditado(p => ({ ...p, [parte]: nuevoValor }))
    } catch (e) {
      setError(e.message || 'Error al regenerar esta parte')
    } finally {
      setRegenerandoParte(null)
    }
  }

  const handleRevisarGancho = async () => {
    if (revisandoGancho || regenerandoParte || generando || !guionEditado?.gancho?.trim()) return
    setRevisandoGancho(true); setError(null)
    try {
      const gancho = guionEditado.gancho
      const res = await revisarGancho(clienteParaGenerar, idea.concepto, gancho, guionEditado)
      setRevisionGancho({ gancho, ...res })
    } catch (e) {
      setError(e.message || 'Error al revisar el gancho')
    } finally {
      setRevisandoGancho(false)
    }
  }
  const handleUsarVersionGancho = () => {
    if (!revisionGancho?.version) return
    setAntesDeParte(guionEditado)
    setGuionEditado(p => ({ ...p, gancho: revisionGancho.version }))
    setRevisionGancho(null)
  }
  const revisionVigente = revisionGancho && revisionGancho.gancho === guionEditado?.gancho ? revisionGancho : null

  const handleCopiarGuion = () => {
    if (!guionEditado) return
    const lineas = [
      historiaCompleta ? `HISTORIA EN 5 LÍNEAS:\n${textoHistoria(historiaCompleta)}` : '', '',
      `GANCHO: ${guionEditado.gancho}`, '',
      `PROBLEMA: ${guionEditado.problema}`, '',
      `PROMESA: ${guionEditado.promesa}`, '',
      'DESARROLLO:', ...guionEditado.frases.map(f => `  - ${f}`), '',
      guionEditado.loopAbierto ? `LOOP ABIERTO: ${guionEditado.loopAbierto}` : '', '',
      `REMATE: ${guionEditado.remate}`, '',
      `CTA: ${guionEditado.cta}`, '',
      `AUDIO: ${guionEditado.audioSugerido}`, '',
      `TIP VIRAL: ${guionEditado.tipViral}`,
    ].filter(Boolean)
    navigator.clipboard.writeText(lineas.join('\n')).catch(() => {})
    setCopiadoGuion(true); setTimeout(() => setCopiadoGuion(false), 2000)
  }

  const handleGuardarGuion = async () => {
    if (!guionEditado) return
    const { data: ideaActualizada } = await actualizarIdea(idea.id, { guion: editableAShapeA(guionEditado) })
    if (ideaActualizada?.guionHistorial) setGuionHistorial(ideaActualizada.guionHistorial)
    setGuardadoGuion(true); setTimeout(() => setGuardadoGuion(false), 2000)
  }

  // Restaurar una versión antigua = volver a guardarla como actual. El
  // trigger de Postgres captura en el historial la versión que se acaba de
  // reemplazar, así que esto se comporta como un deshacer/rehacer natural.
  const handleRestaurarGuion = async (guionAntiguo) => {
    if (!guionAntiguo || restaurando) return
    setRestaurando(true)
    try {
      setResultGuion(guionAntiguo)
      setGuionEditado(shapeAAEditable(guionAntiguo))
      const { data: ideaActualizada } = await actualizarIdea(idea.id, { guion: guionAntiguo })
      if (ideaActualizada?.guionHistorial) setGuionHistorial(ideaActualizada.guionHistorial)
      if (cliente?.id) {
        const post = await getPostPorIdea(cliente.id, idea.id)
        if (post) actualizarPost(cliente.id, post.id, { guion: guionAntiguo })
      }
    } finally {
      setRestaurando(false)
    }
  }

  const handleRestaurarCopy = async (copyAntiguo) => {
    if (!copyAntiguo || restaurando) return
    setRestaurando(true)
    try {
      setResultCopy(copyAntiguo)
      const { data: ideaActualizada } = await actualizarIdea(idea.id, { copy: copyAntiguo })
      if (ideaActualizada?.copyHistorial) setCopyHistorial(ideaActualizada.copyHistorial)
      if (cliente?.id && copyAntiguo?.[0]?.copy) {
        const post = await getPostPorIdea(cliente.id, idea.id)
        if (post) actualizarPost(cliente.id, post.id, { copy: copyAntiguo[0].copy })
      }
    } finally {
      setRestaurando(false)
    }
  }

  const handleExportarGuion = async () => {
    if (!guionEditado || !cliente || exportandoGuion) return
    setExportandoGuion(true)
    try {
      await exportarGuion(cliente, editableAShapeA(guionEditado), idea.titulo)
    } catch (e) {
      setError(e.message || 'No se pudo exportar el PDF')
    } finally {
      setExportandoGuion(false)
    }
  }

  const updateFrase = (idx, value) => setGuionEditado(prev => ({ ...prev, frases: prev.frases.map((f, i) => i === idx ? value : f) }))
  const copiar = (text, id) => { navigator.clipboard.writeText(text).catch(() => {}); setCopiedVariante(id); setTimeout(() => setCopiedVariante(null), 2000) }
  const fs = (bg = '#F5F5F7') => ({ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid transparent', background: bg, fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' })
  const onFocus = e => { e.target.style.borderColor = '#1D5FE0' }
  const onBlur  = e => { e.target.style.borderColor = 'transparent' }

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      style={{ position: 'fixed', top: 0, right: 0, width: 440, height: '100vh', background: 'var(--bg-card)', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {tabs.length === 1 ? (tab === 'guion' ? 'Generar Guion para esta idea' : 'Generar Copy para esta idea') : 'Desarrollar idea'}
          </p>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} color="#86868B" />
          </motion.button>
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{idea.titulo}</p>
      </div>

      {tabs.length > 1 && (
        <div style={{ display: 'flex', padding: '12px 24px 0', gap: 4, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? '#1D5FE0' : '#86868B', background: tab === t.id ? 'rgba(29,95,224,0.08)' : 'transparent', transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px', background: 'rgba(255,59,48,0.06)', borderRadius: 10, border: '1px solid rgba(255,59,48,0.18)', marginBottom: 16 }}>
            <AlertCircle size={14} color="#FF3B30" />
            <span style={{ fontSize: 13, color: '#FF3B30' }}>{error}</span>
          </div>
        )}

        {tab === 'guion' && (
          <>
            {!resultGuion && !generando && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>Genera un guion viral completo para Reel o TikTok basado en esta idea.</p>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleGenGuion()}
                  style={{ padding: '11px 24px', borderRadius: 12, background: '#1D5FE0', color: 'white', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={14} /> Generar guion viral
                </motion.button>
              </div>
            )}
            {generando && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(29,95,224,0.2)', borderTopColor: '#1D5FE0' }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Generando guion...</span>
              </div>
            )}
            {resultGuion && guionEditado && (
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>{idea.titulo}</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 18px' }}>{guionEditado.duracionTotal}</p>
                <div style={{ marginBottom: 18, padding: '12px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#1D5FE0', margin: '0 0 2px' }}>LA HISTORIA EN 5 LÍNEAS</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.4 }}>
                    El esqueleto del guion. Corrígelo y reescribe el guion desde aquí: todo lo que no conecte con una línea, fuera.
                  </p>
                  {CAMPOS_HISTORIA.map(({ key, label, pregunta }) => (
                    <div key={key} style={{ marginBottom: 8 }}>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 3 }}>{label.toUpperCase()}</label>
                      <input value={guionEditado.historia[key]} placeholder={pregunta} onChange={e => updateHistoria(key, e.target.value)}
                        style={{ ...fs(), padding: '6px 8px', fontSize: 12 }} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                  ))}
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleReescribirDesdeHistoria} disabled={!historiaCompleta || generando || !!regenerandoParte}
                    title={historiaCompleta ? 'Escribe el guion de nuevo a partir de estas 5 líneas' : 'Rellena las 5 líneas'}
                    style={{ marginTop: 2, width: '100%', padding: '8px', borderRadius: 10, background: 'rgba(29,95,224,0.08)', border: 'none', cursor: historiaCompleta ? 'pointer' : 'not-allowed', opacity: historiaCompleta ? 1 : 0.5, fontSize: 12, fontWeight: 600, color: '#1D5FE0', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Sparkles size={12} /> Reescribir el guion desde la historia
                  </motion.button>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 5px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#1D5FE0', margin: 0 }}>GANCHO</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <motion.button whileTap={{ scale: 0.95 }} onClick={handleRevisarGancho}
                        disabled={revisandoGancho || !!regenerandoParte || generando || !guionEditado.gancho.trim()}
                        title="Revisar el gancho con los cuatro errores (retraso, confusión, irrelevancia, falta de interés)"
                        style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(29,95,224,0.08)', border: 'none', cursor: revisandoGancho ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, color: '#1D5FE0', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, opacity: !guionEditado.gancho.trim() ? 0.5 : 1 }}>
                        {revisandoGancho
                          ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(29,95,224,0.2)', borderTopColor: '#1D5FE0' }} />
                          : <SearchCheck size={11} />}
                        Revisar gancho
                      </motion.button>
                      <BotonRegenerarParte activo={regenerandoParte === 'gancho'} disabled={!!regenerandoParte || generando || revisandoGancho} onClick={() => handleRegenerarParte('gancho')} />
                    </div>
                  </div>
                  <textarea rows={2} value={guionEditado.gancho} onChange={e => setGuionEditado(p => ({ ...p, gancho: e.target.value }))} style={{ ...fs(), resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                  {revisionVigente && (
                    <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {ERRORES_GANCHO.map(def => {
                        const r = revisionVigente.errores.find(e => e.clave === def.clave)
                        const esPrincipal = revisionVigente.principal === def.clave
                        return (
                          <div key={def.clave} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            {r?.ok
                              ? <Check size={12} style={{ color: '#30D158', flexShrink: 0, marginTop: 2 }} />
                              : <X size={12} style={{ color: '#FF453A', flexShrink: 0, marginTop: 2 }} />}
                            <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 600, color: esPrincipal ? '#FF453A' : 'var(--text-primary)' }}>{def.label}{esPrincipal ? ' (el primero a arreglar)' : ''}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{r?.motivo ? ` · ${r.motivo}` : ` · ${def.pregunta}`}</span>
                            </div>
                          </div>
                        )
                      })}
                      {revisionVigente.version ? (
                        <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 4px' }}>VERSIÓN CORREGIDA</p>
                          <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 8px', lineHeight: 1.4 }}>{revisionVigente.version}</p>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <motion.button whileTap={{ scale: 0.97 }} onClick={handleUsarVersionGancho}
                              style={{ padding: '6px 10px', borderRadius: 8, background: '#1D5FE0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: 'inherit' }}>
                              Usar esta versión
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setRevisionGancho(null)}
                              style={{ padding: '6px 10px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#86868B', fontFamily: 'inherit' }}>
                              Cerrar
                            </motion.button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: '#30D158', fontWeight: 600, margin: '2px 0 0' }}>Pasa los cuatro. Gancho listo.</p>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 5px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>PROBLEMA</p>
                    <BotonRegenerarParte activo={regenerandoParte === 'problema'} disabled={!!regenerandoParte || generando} onClick={() => handleRegenerarParte('problema')} />
                  </div>
                  <textarea rows={2} value={guionEditado.problema} onChange={e => setGuionEditado(p => ({ ...p, problema: e.target.value }))} style={{ ...fs(), resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 5px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>PROMESA</p>
                    <BotonRegenerarParte activo={regenerandoParte === 'promesa'} disabled={!!regenerandoParte || generando} onClick={() => handleRegenerarParte('promesa')} />
                  </div>
                  <textarea rows={2} value={guionEditado.promesa} onChange={e => setGuionEditado(p => ({ ...p, promesa: e.target.value }))} style={{ ...fs(), resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px' }}>DESARROLLO</p>
                  {guionEditado.frases.map((frase, idx) => (
                    <div key={idx} style={{ marginBottom: 8, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>Frase {idx + 1}</label>
                        <BotonRegenerarParte activo={regenerandoParte === `frase-${idx}`} disabled={!!regenerandoParte || generando} onClick={() => handleRegenerarParte('frase', idx)} />
                      </div>
                      <input value={frase} onChange={e => updateFrase(idx, e.target.value)} style={{ ...fs('white'), padding: '6px 8px', fontSize: 12 }} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                  ))}
                </div>
                {guionEditado.loopAbierto && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 5px' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>LOOP ABIERTO</p>
                      <BotonRegenerarParte activo={regenerandoParte === 'loopAbierto'} disabled={!!regenerandoParte || generando} onClick={() => handleRegenerarParte('loopAbierto')} />
                    </div>
                    <textarea rows={2} value={guionEditado.loopAbierto} onChange={e => setGuionEditado(p => ({ ...p, loopAbierto: e.target.value }))} style={{ ...fs(), resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                )}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 5px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>REMATE</p>
                    <BotonRegenerarParte activo={regenerandoParte === 'remate'} disabled={!!regenerandoParte || generando} onClick={() => handleRegenerarParte('remate')} />
                  </div>
                  <textarea rows={2} value={guionEditado.remate} onChange={e => setGuionEditado(p => ({ ...p, remate: e.target.value }))} style={{ ...fs(), resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 5px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>AUDIO SUGERIDO</p>
                    <BotonRegenerarParte activo={regenerandoParte === 'audioSugerido'} disabled={!!regenerandoParte || generando} onClick={() => handleRegenerarParte('audioSugerido')} />
                  </div>
                  <input value={guionEditado.audioSugerido} onChange={e => setGuionEditado(p => ({ ...p, audioSugerido: e.target.value }))} style={fs()} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 5px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#30D158', margin: 0 }}>CTA FINAL</p>
                    <BotonRegenerarParte activo={regenerandoParte === 'cta'} disabled={!!regenerandoParte || generando} onClick={() => handleRegenerarParte('cta')} />
                  </div>
                  <textarea rows={2} value={guionEditado.cta} onChange={e => setGuionEditado(p => ({ ...p, cta: e.target.value }))} style={{ ...fs(), resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 5px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#FF9500', margin: 0 }}>TIP VIRAL</p>
                    <BotonRegenerarParte activo={regenerandoParte === 'tipViral'} disabled={!!regenerandoParte || generando} onClick={() => handleRegenerarParte('tipViral')} />
                  </div>
                  <textarea rows={2} value={guionEditado.tipViral} onChange={e => setGuionEditado(p => ({ ...p, tipViral: e.target.value }))} style={{ ...fs(), resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
                </div>
                {antesDeParte && (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setGuionEditado(antesDeParte); setAntesDeParte(null) }}
                    disabled={!!regenerandoParte}
                    style={{ alignSelf: 'flex-start', padding: '7px 12px', borderRadius: 10, background: 'rgba(29,95,224,0.08)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1D5FE0', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Undo2 size={12} /> Deshacer la última parte regenerada
                  </motion.button>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleRegenerarGuion} style={{ flex: 1, padding: '9px', borderRadius: 10, background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <RefreshCw size={12} /> Regenerar guion
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleCopiarGuion} style={{ flex: 1, padding: '9px', borderRadius: 10, background: copiadoGuion ? 'rgba(48,209,88,0.1)' : 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: copiadoGuion ? '#30D158' : '#86868B', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {copiadoGuion ? <Check size={12} /> : <Copy size={12} />} Copiar guion
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleGuardarGuion} style={{ flex: 1, padding: '9px', borderRadius: 10, background: guardadoGuion ? 'rgba(48,209,88,0.1)' : 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: guardadoGuion ? '#30D158' : '#86868B', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {guardadoGuion ? <Check size={12} /> : <Save size={12} />} Guardar cambios
                  </motion.button>
                  {cliente && (
                    <motion.button whileTap={{ scale: 0.97 }} onClick={handleExportarGuion} disabled={exportandoGuion}
                      title="Exportar PDF"
                      style={{ flex: 1, padding: '9px', borderRadius: 10, background: 'rgba(0,0,0,0.05)', border: 'none', cursor: exportandoGuion ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, color: '#86868B', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {exportandoGuion
                        ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(0,0,0,0.15)', borderTopColor: '#1D1D1F' }} />
                        : <Download size={12} />} Exportar PDF
                    </motion.button>
                  )}
                </div>
                <HistorialVersiones historial={guionHistorial} campo="guion" onRestaurar={handleRestaurarGuion} restaurando={restaurando} />
              </div>
            )}
          </>
        )}

        {tab === 'copy' && (
          <>
            {!resultCopy && !generando && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>Genera 3 variantes de copy basadas en el concepto de esta idea.</p>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleGenCopy}
                  style={{ padding: '11px 24px', borderRadius: 12, background: '#1D5FE0', color: 'white', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={14} /> Generar copy para esta idea
                </motion.button>
              </div>
            )}
            {generando && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(29,95,224,0.2)', borderTopColor: '#1D5FE0' }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Generando copies...</span>
              </div>
            )}
            {resultCopy && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {resultCopy.map(v => (
                  <div key={v.id} style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 12, padding: '14px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1D5FE0' }}>{v.variante}</span>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => copiar(v.copy, v.id)} style={{ width: 26, height: 26, borderRadius: 7, background: copiedVariante === v.id ? 'rgba(48,209,88,0.1)' : 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {copiedVariante === v.id ? <Check size={12} color="#30D158" /> : <Copy size={12} color="#86868B" />}
                      </motion.button>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{v.copy}</p>
                    {v.hashtags && <p style={{ fontSize: 11, color: '#1D5FE0', margin: '0 0 6px' }}>{v.hashtags}</p>}
                    {v.nota && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>{v.nota}</p>}
                  </div>
                ))}
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setResultCopy(null)} style={{ padding: '9px', borderRadius: 10, background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                  Regenerar
                </motion.button>
                <HistorialVersiones historial={copyHistorial} campo="copy" onRestaurar={handleRestaurarCopy} restaurando={restaurando} />
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
