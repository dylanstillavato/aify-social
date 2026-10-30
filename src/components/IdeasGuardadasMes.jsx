import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bookmark, Check, Sparkles, Video, Images, Plus, ArrowRight, RotateCcw, ArrowLeftRight, Trash2, Edit3, Undo2, Wand2 } from 'lucide-react'
import { getPostsCliente } from '../hooks/useCalendario'
import { crearIdea, actualizarIdea, eliminarIdeaConGuiones } from '../hooks/useIdeas'
import { formatoDe, otroFormato, etiquetaFormato, esSinTexto, TIPOS_PIEZA } from '../utils/formato'
import { reescribirIdea, regenerarIdea } from '../services/ai'
import { useGeneraciones, useGeneracionDePantalla } from '../hooks/useGeneraciones'

// Ideas guardadas este mes (Lluvia de ideas): todo lo que el gestor ha
// guardado de un cliente desde el día 1 del mes en curso. De aquí elige las
// que le gustan y genera todos sus guiones de una vez (GenerarGuionesModal).
// Con `mes` (YYYY-MM-01, paso Guiones de la ficha, #84) muestra las ideas del
// plan de ese mes (ideas.mes; las antiguas sin mes, por la fecha en que se
// guardaron), agrupadas por tipo de pieza, y cada una se puede rehacer con
// «¿Qué cambiarías?» antes de guionizarla.
// Las que ya tienen guion (un post con origen_idea_id = la idea) se enseñan
// marcadas y no se pueden volver a elegir. También se escriben ideas a mano
// ("Escribir idea"). "Desarrollar" abre el editor de la idea (EditorIdea): se
// ajusta a mano o con la IA y de ahí su guion va a Guiones del mes; con guion
// ya hecho quedan "Editar" (mismo editor) y "Regenerar guion".
// El chip Vídeo/Carrusel cambia el formato de la idea; si ya tenía guion, abre
// "Regenerar guion" para reescribirlo en el formato nuevo.
// La papelera borra la idea y su guion de Guiones del mes (pide confirmar con
// un segundo clic). Borrar el guion desde Guiones del mes también borra la idea.

const campo = {
  boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border-color)',
  fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)',
}

// Formulario de idea manual: título, de qué va y formato
function NuevaIdea({ cliente, onCreada, onCancelar }) {
  const [titulo, setTitulo] = useState('')
  const [concepto, setConcepto] = useState('')
  const [formato, setFormato] = useState('video')
  const [guardando, setGuardando] = useState(false)
  const guardar = async () => {
    if (!titulo.trim() || guardando) return
    setGuardando(true)
    await crearIdea({ clienteId: cliente.id, titulo: titulo.trim(), concepto: concepto.trim(), formato, tipo: 'manual' })
    setGuardando(false)
    onCreada()
  }
  return (
    <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título de la idea"
          onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') onCancelar() }}
          style={{ ...campo, flex: '1 1 260px' }} />
        <select value={formato} onChange={e => setFormato(e.target.value)} style={{ ...campo, cursor: 'pointer' }}>
          <option value="video">Vídeo</option>
          <option value="carrusel">Carrusel</option>
        </select>
      </div>
      <textarea value={concepto} onChange={e => setConcepto(e.target.value)} rows={2} placeholder="De qué va (opcional): qué se enseña, cómo empieza, qué se cuenta..."
        style={{ ...campo, resize: 'vertical', lineHeight: 1.5 }} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Cancelar</button>
        <button onClick={guardar} disabled={!titulo.trim() || guardando}
          style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: titulo.trim() ? '#D7FF3D' : 'var(--bg-card)', color: titulo.trim() ? '#0B0C10' : 'var(--text-tertiary)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: titulo.trim() ? 'pointer' : 'not-allowed' }}>
          {guardando ? 'Guardando...' : 'Guardar idea'}
        </button>
      </div>
    </div>
  )
}

export default function IdeasGuardadasMes({ cliente, guardadas, version, onGenerar, onDesarrollar, onIdeaCreada, mes = null, plan = null }) {
  const [escribiendo, setEscribiendo] = useState(false)
  const [seleccion, setSeleccion] = useState([])
  const [conGuion, setConGuion] = useState(() => new Set())

  const hoy = new Date()
  const inicioMes = mes ? new Date(`${mes}T00:00:00`) : new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const finMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 1)
  const delMes = guardadas
    .filter(g => cliente && String(g.clienteId) === String(cliente.id))
    .filter(g => {
      if (mes && g.mes) return String(g.mes).slice(0, 10) === mes
      if (!g.fechaGuardada) return false
      const f = new Date(g.fechaGuardada)
      return f >= inicioMes && (!mes || f < finMes)
    })
  // Por tipo de pieza solo cuando hay alguna con tipo (las del plan del mes)
  const conTipo = delMes.some(g => g.tipoPieza)
  const grupos = conTipo
    ? [...TIPOS_PIEZA.map(t => ({ id: t.id, etiqueta: t.etiqueta, ideas: delMes.filter(g => g.tipoPieza === t.id) })),
      { id: 'otras', etiqueta: 'Otras ideas', ideas: delMes.filter(g => !TIPOS_PIEZA.some(t => t.id === g.tipoPieza)) }].filter(x => x.ideas.length)
    : [{ id: 'todas', etiqueta: null, ideas: delMes }]

  // `version` cambia cuando el padre guarda o genera algo: se relee qué ideas tienen ya guion
  useEffect(() => {
    if (!cliente?.id) return
    let activo = true
    getPostsCliente(cliente.id, { incluirSinProgramar: true }).then(({ data }) => {
      if (!activo) return
      setConGuion(new Set((data || []).filter(p => p.origenIdeaId && p.guion).map(p => String(p.origenIdeaId))))
    })
    return () => { activo = false }
  }, [cliente?.id, version])

  const elegibles = delMes.filter(g => !conGuion.has(String(g.id)))
  // Solo cuentan las elegidas que siguen siendo elegibles (borradas o ya guionizadas salen solas)
  const elegidas = elegibles.filter(g => seleccion.includes(g.id))
  const todas = elegibles.length > 0 && elegidas.length === elegibles.length
  const toggle = (id) => setSeleccion(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  // Reescribir y rehacer ideas van a la cola de generaciones: siguen aunque se
  // cambie de página y salen en la barra; «Ver» vuelve a esta pantalla
  const location = useLocation()
  const { trabajos } = useGeneraciones()
  const { ejecutar } = useGeneracionDePantalla()
  const ideaEnCurso = (tipo) => trabajos.find(t => t.tipo === tipo && t.clienteId === cliente?.id && t.estado === 'corriendo')?.ideaId ?? null
  const trabajoIdea = (tipo, g, titulo) => ({
    tipo, ideaId: g.id, clave: `${tipo}-${g.id}`,
    titulo: `${titulo} «${g.titulo}» · ${cliente.nombre}`,
    clienteId: cliente.id,
    destino: { ruta: `${location.pathname}${location.search}`, ...(location.state ? { state: location.state } : {}) },
  })

  const [cambiandoAqui, setCambiando] = useState(null)
  const cambiando = cambiandoAqui ?? ideaEnCurso('idea-formato')
  const cambiarFormato = async (g, hecho) => {
    if (cambiando) return
    const formato = otroFormato(formatoDe(g))
    setCambiando(g.id)
    let cambios = null
    try {
      await ejecutar(trabajoIdea('idea-formato', g, `Pasar a ${etiquetaFormato(formato).toLowerCase()}`), async () => {
        // El texto de la idea se reescribe para el formato nuevo
        const nueva = await reescribirIdea(cliente, g, { formato, sinTexto: esSinTexto(g) }).catch(() => null)
        cambios = { formato, ...(nueva || {}) }
        await actualizarIdea(g.id, cambios)
      })
    } catch { /* reescribirIdea ya cae a solo cambiar el formato */ }
    setCambiando(null)
    onIdeaCreada?.()
    if (hecho && cambios) onGenerar([{ ...g, ...cambios }], () => {}, true)
  }
  const [confirmando, setConfirmando] = useState(null)
  // «¿Qué cambiarías?»: borrador por idea (se guarda en ideas.feedback al salir
  // del campo) y la versión anterior de cada idea rehecha, para deshacer
  const [borradores, setBorradores] = useState({})
  const [rehaciendoAqui, setRehaciendo] = useState(null)
  const rehaciendo = rehaciendoAqui ?? ideaEnCurso('idea-rehacer')
  const [anteriores, setAnteriores] = useState({})
  const [errorRehacer, setErrorRehacer] = useState(null)
  const feedbackDe = (g) => borradores[g.id] ?? g.feedback ?? ''
  const guardarFeedback = (g) => {
    const texto = feedbackDe(g).trim()
    if (texto !== (g.feedback || '').trim()) actualizarIdea(g.id, { feedback: texto })
  }
  const rehacer = async (g, conFeedback) => {
    if (rehaciendo) return
    setRehaciendo(g.id)
    setErrorRehacer(null)
    try {
      const feedback = conFeedback ? feedbackDe(g).trim() : ''
      await ejecutar(trabajoIdea('idea-rehacer', g, conFeedback ? 'Rehacer idea' : 'Regenerar idea'), async () => {
        const nueva = await regenerarIdea({ idea: g, cliente, plan, feedback })
        setAnteriores(a => ({ ...a, [g.id]: { titulo: g.titulo, concepto: g.concepto, porQueFunc: g.porQueFunc, formatoSugerido: g.formatoSugerido } }))
        await actualizarIdea(g.id, { ...nueva, feedback })
        return { texto: 'idea nueva' }
      })
      setBorradores(b => { const n = { ...b }; delete n[g.id]; return n })
      onIdeaCreada?.()
    } catch (e) {
      setErrorRehacer({ id: g.id, mensaje: e.message || 'No se pudo rehacer la idea.' })
    }
    setRehaciendo(null)
  }
  const deshacer = async (g) => {
    const antes = anteriores[g.id]
    if (!antes) return
    await actualizarIdea(g.id, antes)
    setAnteriores(a => { const n = { ...a }; delete n[g.id]; return n })
    onIdeaCreada?.()
  }
  const [borrando, setBorrando] = useState(null)
  const borrar = async (g) => {
    if (borrando) return
    if (confirmando !== g.id) { setConfirmando(g.id); return }
    setBorrando(g.id)
    await eliminarIdeaConGuiones(cliente.id, g.id)
    setBorrando(null)
    setConfirmando(null)
    setSeleccion(s => s.filter(x => x !== g.id))
    onIdeaCreada?.()
  }

  if (!cliente) return null
  // En el paso Guiones, sin ideas de ese mes no se enseña nada
  if (mes && !delMes.length) return null
  const nombreMes = inicioMes.toLocaleDateString('es-ES', { month: 'long' })

  return (
    <div style={{ marginTop: 28, background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 16px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: delMes.length ? '1px solid var(--border-subtle)' : 'none', flexWrap: 'wrap' }}>
        <Bookmark size={15} color="#1D5FE0" />
        <div style={{ flex: 1, minWidth: 180 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{mes ? `Ideas de ${nombreMes}` : 'Ideas guardadas este mes'} · {delMes.length}</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{mes ? 'Revísalas, rehaz las que no te convenzan y guioniza una a una o todas a la vez.' : 'Elige las que te gustan y genera todos sus guiones de una vez.'}</p>
        </div>
        <button onClick={() => setEscribiendo(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 20, background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'inherit' }}>
          <Plus size={12} /> Escribir idea
        </button>
        {elegibles.length > 0 && (
          <button onClick={() => setSeleccion(todas ? [] : elegibles.map(g => g.id))}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 20, background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
            <Check size={12} /> {todas ? 'Quitar todas' : 'Elegir todas'}
          </button>
        )}
        <motion.button whileTap={{ scale: elegidas.length ? 0.97 : 1 }} disabled={!elegidas.length}
          onClick={() => onGenerar(elegidas, () => setSeleccion([]), false)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 11, border: 'none', background: elegidas.length ? '#D7FF3D' : 'var(--bg-secondary)', color: elegidas.length ? '#0B0C10' : 'var(--text-tertiary)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: elegidas.length ? 'pointer' : 'not-allowed' }}>
          <Sparkles size={14} /> {mes ? 'Guionizar' : 'Generar guiones'}{elegidas.length ? ` (${elegidas.length})` : ''}
        </motion.button>
      </div>

      {escribiendo && (
        <NuevaIdea cliente={cliente} onCancelar={() => setEscribiendo(false)}
          onCreada={() => { setEscribiendo(false); onIdeaCreada?.() }} />
      )}

      {delMes.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, padding: '0 18px 16px 43px' }}>
          Guarda las ideas que te gusten o escribe las tuyas y aparecerán aquí para generarles el guion.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {grupos.map(grupo => (
            <div key={grupo.id}>
              {grupo.etiqueta && (
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, padding: '12px 18px 8px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                  {grupo.etiqueta} · {grupo.ideas.length}
                </p>
              )}
          {grupo.ideas.map(g => {
            const hecho = conGuion.has(String(g.id))
            const sel = seleccion.includes(g.id) && !hecho
            const formato = formatoDe(g)
            const Icon = formato === 'video' ? Video : Images
            return (
              <div key={g.id} style={{ borderTop: '1px solid var(--border-subtle)', background: sel ? 'rgba(29,95,224,0.05)' : 'transparent' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', cursor: hecho ? 'default' : 'pointer', opacity: hecho ? 0.6 : 1 }}>
                <input type="checkbox" checked={sel} disabled={hecho} onChange={() => toggle(g.id)}
                  style={{ accentColor: '#1D5FE0', width: 16, height: 16, flexShrink: 0, cursor: hecho ? 'default' : 'pointer' }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.titulo}</span>
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); cambiarFormato(g, hecho) }} disabled={cambiando === g.id}
                  title={`Pasar a ${etiquetaFormato(otroFormato(formato)).toLowerCase()}${hecho ? ' (se regenera el guion)' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px', borderRadius: 20, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: formato === 'video' ? '#FF2D55' : '#1D5FE0', fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0, opacity: cambiando === g.id ? 0.5 : 1 }}>
                  <Icon size={11} /> {etiquetaFormato(formato)} <ArrowLeftRight size={9} />
                </button>
                {g.tipo === 'manual' && <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', flexShrink: 0 }}>Manual</span>}
                {hecho && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(48,209,88,0.12)', color: '#30A14E', flexShrink: 0 }}>Con guion</span>}
                {hecho && onDesarrollar && (
                  <button onClick={e => { e.preventDefault(); e.stopPropagation(); onDesarrollar(g) }} title="Editar la idea"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, height: 26, padding: '0 9px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                    <Edit3 size={11} /> Editar
                  </button>
                )}
                {hecho ? (
                  <button onClick={e => { e.preventDefault(); e.stopPropagation(); onGenerar([g], () => {}, true) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                    <RotateCcw size={11} /> Regenerar guion
                  </button>
                ) : (
                  <button onClick={e => { e.preventDefault(); e.stopPropagation(); if (onDesarrollar) onDesarrollar(g); else onGenerar([g], () => setSeleccion(s => s.filter(x => x !== g.id)), false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', borderRadius: 8, border: 'none', background: '#1D5FE0', color: 'white', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                    {mes ? 'Guionizar' : 'Desarrollar'} <ArrowRight size={11} />
                  </button>
                )}
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); borrar(g) }} onBlur={() => setConfirmando(c => c === g.id ? null : c)}
                  disabled={borrando === g.id}
                  title={hecho ? 'Borrar idea y su guion' : 'Borrar idea'}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 26, minWidth: 26, padding: confirmando === g.id ? '0 10px' : 0, borderRadius: 8, border: 'none', background: confirmando === g.id ? '#FF3B30' : 'rgba(255,59,48,0.08)', color: confirmando === g.id ? 'white' : '#FF3B30', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0, opacity: borrando === g.id ? 0.5 : 1 }}>
                  <Trash2 size={12} />{confirmando === g.id && (borrando === g.id ? 'Borrando...' : '¿Borrar?')}
                </button>
              </label>
              {mes && !hecho && (
                <div style={{ padding: '0 18px 12px 46px' }}>
                  {g.concepto && <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.45 }}>{g.concepto}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <input value={feedbackDe(g)} placeholder="¿Qué cambiarías?" disabled={rehaciendo === g.id}
                      onChange={e => setBorradores(b => ({ ...b, [g.id]: e.target.value }))}
                      onBlur={() => guardarFeedback(g)}
                      onKeyDown={e => { if (e.key === 'Enter' && feedbackDe(g).trim()) rehacer(g, true) }}
                      style={{ flex: 1, minWidth: 180, height: 28, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
                    {feedbackDe(g).trim() ? (
                      <button onClick={() => rehacer(g, true)} disabled={!!rehaciendo}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 10px', borderRadius: 8, border: 'none', background: '#1D5FE0', color: 'white', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: rehaciendo ? 'default' : 'pointer', opacity: rehaciendo && rehaciendo !== g.id ? 0.5 : 1 }}>
                        <Wand2 size={11} /> {rehaciendo === g.id ? 'Rehaciendo...' : 'Rehacer con esto'}
                      </button>
                    ) : (
                      <button onClick={() => rehacer(g, false)} disabled={!!rehaciendo}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: rehaciendo ? 'default' : 'pointer', opacity: rehaciendo && rehaciendo !== g.id ? 0.5 : 1 }}>
                        <RotateCcw size={11} /> {rehaciendo === g.id ? 'Regenerando...' : 'Regenerar'}
                      </button>
                    )}
                    {anteriores[g.id] && rehaciendo !== g.id && (
                      <button onClick={() => deshacer(g)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 10px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                        <Undo2 size={11} /> Deshacer
                      </button>
                    )}
                  </div>
                  {errorRehacer?.id === g.id && <p style={{ fontSize: 11.5, color: '#FF3B30', margin: '6px 0 0' }}>{errorRehacer.mensaje}</p>}
                </div>
              )}
              </div>
            )
          })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
