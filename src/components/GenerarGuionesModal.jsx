import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Check, AlertCircle, Square, Undo2 } from 'lucide-react'
import { crearPost, actualizarPost, getPostPorIdea } from '../hooks/useCalendario'
import { generarGuion, generarPiezaSinTexto } from '../services/ai'
import { addActividad } from '../hooks/useActividad'
import { formatoDe, esSinTexto, etiquetaEstilo } from '../utils/formato'
import { REDES_CONTENIDO, redesDelCliente } from '../utils/redes'
import { useGeneraciones } from '../hooks/useGeneraciones'

// De las ideas guardadas a los guiones del mes: el gestor elige de una vez las
// ideas guardadas que le gustan y se escriben todos sus guiones. Los guiones
// NO entran al calendario (en_calendario = false, ver 0030): quedan en Guiones
// del mes para revisarlos, mandarlos a aprobar y grabarlos. Se programan en
// el calendario después del día de grabación.
// Con `regenerar` (botón "Regenerar guion" de una idea que ya tiene guion) se
// reescribe el guion de su post en vez de crear otro: el post se queda en su
// mes y con su red, y el trigger de 0019 devuelve la aprobación a pendiente.
// El bucle corre en GeneracionesContext: el modal se puede cerrar y cambiar de
// página sin cortarlo, y la barra fija (BarraGeneracion) sigue el progreso.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const RED_LABELS = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube',
  linkedin: 'LinkedIn', whatsapp: 'WhatsApp', googlemaps: 'Google Maps',
}

const temaDe = (idea) => [idea.titulo, idea.concepto].filter(Boolean).join('. ')

// `mesInicial` ({ anio, mes } de mesOpciones): el mes ya elegido, p. ej. en el
// paso Guiones de la ficha, que guioniza las ideas del plan de ese mes.
// `aquiAbajo`: la lista de guiones está en la misma pantalla (Guiones del mes);
// el resultado lo dice y su botón «Ver los guiones» llama a
// onHecho(destino, ids) para bajar hasta ellos y resaltarlos.
export default function GenerarGuionesModal({ open, onClose, cliente, ideas, mesOpciones, mesInicial = null, onHecho, regenerar = false, aquiAbajo = false }) {
  const redes = redesDelCliente(cliente)
  const hoy = new Date()
  // Si al mes en curso le queda menos de una semana, se propone el siguiente
  const quedanDias = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate() - hoy.getDate()
  const [mesSel, setMesSel] = useState(() => {
    const o = mesInicial || mesOpciones[quedanDias < 7 && mesOpciones.length > 1 ? 1 : 0]
    return `${o.anio}-${o.mes}`
  })
  const [red, setRed] = useState(redes[0] || 'instagram')
  const { lanzar, parar, quitar, trabajos } = useGeneraciones()
  const [resultado, setResultado] = useState(null) // { guiones, pendientes, error }
  const [trabajoId, setTrabajoId] = useState(null) // generación en marcha (en el contexto)
  const trabajo = trabajos.find(t => t.id === trabajoId)
  const progreso = trabajo && !resultado ? { hechos: trabajo.hechos, total: trabajo.total } : null
  // Si el modal sigue abierto al terminar, el resultado se ve aquí y no en la barra
  const abiertoRef = useRef(true)
  useEffect(() => { abiertoRef.current = true; return () => { abiertoRef.current = false } }, [])
  // Con guion o sin texto (solo planos / solo fotos), idea a idea
  const [sinTexto, setSinTexto] = useState(() => Object.fromEntries(ideas.map(i => [i.id, esSinTexto(i)])))

  const [año, mes] = mesSel.split('-').map(Number)
  const ocupado = !!progreso

  // onClose(generado): el padre refresca las guardadas si se escribió alguno o
  // si la generación sigue en segundo plano (al terminar, la pantalla relee)
  const cerrar = () => { const hecho = ocupado || !!resultado?.guiones; setResultado(null); onClose(hecho) }

  const confirmar = () => {
    if (!cliente || ocupado || !ideas.length) return
    setResultado(null)
    const mesClave = `${año}-${String(mes + 1).padStart(2, '0')}`
    const { id, promesa } = lanzar({
      tipo: 'guiones',
      titulo: `${regenerar ? 'Guion' : 'Guiones'} de ${MESES[mes]} · ${cliente.nombre}`,
      clienteId: cliente.id,
      destino: { ruta: `/clientes/${cliente.id}?mes=${mesClave}`, state: { tabInicial: 'guiones' } },
      total: ideas.length,
    }, (avanzar, debeParar) => escribirGuiones(avanzar, debeParar))
    setTrabajoId(id)
    promesa.then((r) => {
      if (!abiertoRef.current) return
      quitar(id)
      setResultado(r?.guiones === undefined ? { guiones: 0, pendientes: ideas.length, error: r?.error, fallidas: [], destino: { año, mes }, ids: [] } : r)
    })
  }

  const escribirGuiones = async (avanzar, debeParar) => {
    // Ancla del mes: los guiones sin programar llevan el día 1 (no es fecha de publicación)
    const fecha = `${año}-${String(mes + 1).padStart(2, '0')}-01`
    let guiones = 0
    let error = null
    let destino = { año, mes }
    let anterior = null // al regenerar: el guion que había, para poder volver a él
    const fallidas = []
    const ids = [] // posts con guion nuevo, para resaltarlos en la lista

    // En serie, para no disparar el límite de peticiones. Si una idea falla se
    // apunta y se sigue con la siguiente: las que fallan se quedan en guardadas.
    // Primero el guion y luego el post, para no dejar posts vacíos si la IA falla.
    for (let i = 0; i < ideas.length; i++) {
      if (debeParar()) break
      const idea = ideas[i]
      try {
        const formato = formatoDe(idea)
        const guion = sinTexto[idea.id]
          ? await generarPiezaSinTexto(cliente, temaDe(idea), formato)
          : await generarGuion(cliente, temaDe(idea), false, [], formato)
        if (!guion?.gancho) throw new Error(`La IA no devolvió un guion válido para "${idea.titulo}".`)
        const existente = regenerar ? await getPostPorIdea(cliente.id, idea.id) : null
        if (existente) {
          const { data: post, error: errPost } = await actualizarPost(cliente.id, existente.id, { guion, formato, titulo: idea.titulo, concepto: idea.concepto, desarrollado: true })
          if (errPost || !post) throw new Error(`No se pudo guardar el guion de "${idea.titulo}".`)
          if (existente.guion) anterior = { postId: existente.id, guion: existente.guion, formato: existente.formato }
          const [ea, em] = String(existente.fecha || '').split('-').map(Number)
          if (ea && em) destino = { año: ea, mes: em - 1 }
          ids.push(existente.id)
          guiones++
          avanzar(i + 1)
          continue
        }
        const { data: post, error: errPost } = await crearPost({
          clienteId: cliente.id, fecha, dia: 1, mes: mes + 1, año,
          red, formato, titulo: idea.titulo, concepto: idea.concepto,
          objetivo: idea.tipoContenido || idea.tipo || '', guion, desarrollado: true,
          estado: 'borrador', enCalendario: false, origenIdeaId: idea.id,
        })
        if (errPost || !post) throw new Error(`No se pudo guardar el guion de "${idea.titulo}".`)
        // Sin tarjeta todavía: entra en «Por grabar» cuando se aprueba
        ids.push(post.id)
        guiones++
        avanzar(i + 1)
      } catch (e) {
        error = e.message || 'Algo ha fallado escribiendo los guiones.'
        fallidas.push(idea.titulo)
        // sin cuota, sin permiso, sin IA conectada o sin servidor no tiene sentido seguir con el resto
        if (e.conectaIa || /l[ií]mite|429|401|403|clave|tu ia|conexión con el servidor/i.test(error)) break
      }
    }
    if (guiones) addActividad({ tipo: 'guion', descripcion: `Guiones de ${MESES[mes]}`, clienteNombre: cliente.nombre, count: guiones })

    const mesDestino = `${destino.año}-${String(destino.mes + 1).padStart(2, '0')}`
    return {
      guiones, pendientes: ideas.length - guiones, error, fallidas, destino, anterior, ids,
      // Para la barra: resumen y adónde lleva «Ver»
      texto: `${guiones} ${guiones === 1 ? 'guion' : 'guiones'}`,
      ver: { ruta: `/clientes/${cliente.id}?mes=${mesDestino}`, state: { tabInicial: 'guiones' } },
    }
  }

  // Deshace la regeneración: el guion anterior vuelve a ser el actual (el nuevo
  // queda en Versiones anteriores, en Guiones del mes)
  const volverAlAnterior = async () => {
    const a = resultado?.anterior
    if (!a || !cliente || resultado.restaurando) return
    setResultado(r => ({ ...r, restaurando: true }))
    const { error } = await actualizarPost(cliente.id, a.postId, { guion: a.guion, ...(a.formato ? { formato: a.formato } : {}) })
    setResultado(r => ({ ...r, restaurando: false, restaurado: !error, error: error ? (error.message || 'No se pudo volver al guion anterior.') : r.error }))
  }

  const chip = (activo) => ({
    padding: '6px 10px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: ocupado ? 'default' : 'pointer',
    border: `1.5px solid ${activo ? '#1D5FE0' : 'var(--border-color)'}`, background: activo ? '#1D5FE0' : 'var(--bg-card)',
    color: activo ? 'white' : 'var(--text-primary)',
  })
  const label = { fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 7 }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={cerrar}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199 }} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, pointerEvents: 'none' }}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
              onClick={e => e.stopPropagation()}
              style={{ pointerEvents: 'auto', width: 560, maxWidth: '100%', maxHeight: '100%', background: 'var(--bg-card)', borderRadius: 20, boxShadow: '0 16px 56px rgba(0,0,0,0.24)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {resultado ? 'Hecho' : regenerar ? 'Regenerar guion' : `Generar ${ideas.length === 1 ? 'el guion' : `${ideas.length} guiones`}`}
                  </p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{cliente?.nombre}</p>
                </div>
                <button onClick={cerrar} aria-label="Cerrar"
                  style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} color="var(--text-secondary)" />
                </button>
              </div>

              {resultado ? (
                <div style={{ padding: '24px 22px' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {resultado.error ? <AlertCircle size={22} color="#FF9500" style={{ flexShrink: 0 }} /> : <Check size={22} color="#30D158" style={{ flexShrink: 0 }} />}
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                        {regenerar
                          ? (resultado.restaurado ? 'Has vuelto al guion anterior' : resultado.guiones ? `Guion reescrito en ${MESES[resultado.destino.mes]}` : 'No se ha podido reescribir')
                          : `${resultado.guiones} ${resultado.guiones === 1 ? 'guion escrito' : 'guiones escritos'} para ${MESES[mes]}`}
                      </p>
                      {resultado.error && <p style={{ fontSize: 13, color: '#FF3B30', margin: '0 0 4px' }}>{resultado.error}</p>}
                      {resultado.pendientes > 0 && (
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                          {resultado.pendientes === 1 ? 'Falta 1 idea' : `Faltan ${resultado.pendientes} ideas`}: siguen en tus guardadas para volver a intentarlo.
                        </p>
                      )}
                      {resultado.fallidas?.length > 0 && (
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                          No se pudieron escribir: {resultado.fallidas.join(' · ')}
                        </p>
                      )}
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
                        {resultado.guiones > 0 && `${resultado.guiones === 1 ? 'Está' : 'Están'} ${aquiAbajo ? 'aquí abajo, en Guiones de' : 'en Guiones del mes de'} ${MESES[resultado.destino.mes]}. `}
                        Cuando {resultado.guiones === 1 ? 'lo revises, envíaselo' : 'los revises, envíaselos'} al cliente para que {resultado.guiones === 1 ? 'lo apruebe. Se añade' : 'los apruebe. Se añaden'} al calendario después del día de grabación.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                    {regenerar && resultado.anterior && !resultado.restaurado && (
                      <button onClick={volverAlAnterior} disabled={resultado.restaurando}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 'auto', padding: '10px 14px', borderRadius: 11, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: '#1D5FE0', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: resultado.restaurando ? 'wait' : 'pointer' }}>
                        <Undo2 size={14} /> {resultado.restaurando ? 'Volviendo...' : 'Volver al anterior'}
                      </button>
                    )}
                    <button onClick={cerrar} style={{ padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                      Seguir con ideas
                    </button>
                    {resultado.guiones > 0 && (
                      <button onClick={() => { const { destino: d, ids: nuevos } = resultado; setResultado(null); onHecho?.(d, nuevos) }}
                        style={{ padding: '10px 16px', borderRadius: 11, border: 'none', background: '#D7FF3D', color: '#0B0C10', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                        {aquiAbajo ? (resultado.guiones === 1 ? 'Ver el guion' : 'Ver los guiones') : 'Ir a Guiones del mes'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {!regenerar && <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <div>
                        <span style={label}>Guiones de</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {mesOpciones.map(o => (
                            <button key={`${o.anio}-${o.mes}`} disabled={ocupado} onClick={() => setMesSel(`${o.anio}-${o.mes}`)} style={chip(mesSel === `${o.anio}-${o.mes}`)}>
                              {o.label.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span style={label}>Red</span>
                        <select value={red} disabled={ocupado} onChange={e => setRed(e.target.value)}
                          style={{ padding: '7px 10px', borderRadius: 9, border: '1.5px solid var(--border-color)', fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                          {(redes.length ? redes : Object.keys(REDES_CONTENIDO)).map(r => <option key={r} value={r}>{RED_LABELS[r] || r}</option>)}
                        </select>
                      </div>
                    </div>}

                    <div>
                      <span style={label}>{regenerar ? 'Idea' : 'Ideas elegidas'}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {ideas.map(idea => (
                          <div key={idea.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idea.titulo}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: formatoDe(idea) === 'video' ? '#1D5FE0' : 'var(--text-tertiary)', flexShrink: 0 }}>
                              {formatoDe(idea) === 'video' ? 'Vídeo' : 'Carrusel'}
                            </span>
                            <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 7, padding: 2, flexShrink: 0 }}>
                              {[false, true].map(v => {
                                const activo = !!sinTexto[idea.id] === v
                                return (
                                  <button key={String(v)} type="button" disabled={ocupado} onClick={() => setSinTexto(m => ({ ...m, [idea.id]: v }))}
                                    title={v ? 'Sin guion ni texto: solo la lista de planos o fotos' : 'Con guion completo'}
                                    style={{ padding: '2px 7px', borderRadius: 5, border: 'none', fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit', cursor: ocupado ? 'default' : 'pointer', background: activo ? 'var(--bg-secondary)' : 'transparent', color: activo ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                    {etiquetaEstilo(formatoDe(idea), v)}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', margin: '6px 0 0' }}>
                        {regenerar
                          ? 'Se escribe un guion nuevo y sustituye al actual, en el mismo mes de Guiones del mes. Si el cliente ya lo había revisado, vuelve a pendiente de aprobar.'
                          : `No se añaden al calendario: quedan en Guiones del mes de ${MESES[mes]} sin fecha. Uno detrás de otro; tarda unos segundos por guion.`}
                      </p>
                    </div>
                  </div>

                  <div style={{ padding: '14px 22px 18px', borderTop: '1px solid var(--border-subtle)' }}>
                    {progreso ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                            {regenerar ? 'Reescribiendo el guion...' : `Escribiendo guiones · ${progreso.hechos} de ${progreso.total}`}
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                            <motion.div animate={{ width: `${(progreso.hechos / progreso.total) * 100}%` }} style={{ height: '100%', background: '#1D5FE0', borderRadius: 3 }} />
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
                            Puedes cerrar esta ventana y seguir trabajando: sigue en segundo plano.
                          </div>
                        </div>
                        <button onClick={() => parar(trabajoId)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                          <Square size={12} /> Parar
                        </button>
                      </div>
                    ) : (
                      <button onClick={confirmar}
                        style={{ width: '100%', padding: '13px', borderRadius: 13, border: 'none', background: '#D7FF3D', color: '#0B0C10', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Sparkles size={15} /> {regenerar ? 'Regenerar guion' : `Generar ${ideas.length === 1 ? 'el guion' : `${ideas.length} guiones`}`}
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
