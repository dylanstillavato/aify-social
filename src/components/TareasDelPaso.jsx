import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckSquare, Clock, ArrowUpRight, CalendarDays } from 'lucide-react'
import { useTareasList } from '../hooks/useTareas'
import { useTablero, columnaDeTarea } from '../hooks/useTableros'
import { guardarFechasProduccion } from '../services/fechasProduccion'
import { ORIGEN_PRODUCCION, fechaVencimiento, estaVencida, avisoEtapa, hoyISO } from '../utils/vencimiento'

// Ficha de cliente: las tareas pendientes enlazadas a este paso del proceso
// (tareas.paso, 0033). Si no hay ninguna no pinta nada. Se gestionan en Tareas;
// las fechas de los vídeos de producción se pueden cambiar aquí mismo.

const fechaCorta = (iso) => {
  const d = new Date(`${iso}T00:00:00`)
  return !iso || Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const inputFecha = {
  padding: '5px 7px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12,
  fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-primary)',
}

function EditorFechas({ tarea, cliente, otras, onGuardado, onCerrar }) {
  const [grabacion, setGrabacion] = useState(tarea.fechaLimite || '')
  const [edicion, setEdicion] = useState(tarea.fechaEdicion || '')
  const [publicacion, setPublicacion] = useState(tarea.fechaPublicacion || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const guardar = async () => {
    setGuardando(true); setError(null)
    const { error: err } = await guardarFechasProduccion({
      tarea, cliente, otras, grabacion, edicion,
      // Sin guion enlazado (o sin saber su publicación) no se toca
      publicacion: tarea.postId && tarea.fechaPublicacion !== undefined ? publicacion : undefined,
    })
    setGuardando(false)
    if (err) { setError(err.message || 'No se pudieron guardar las fechas.'); return }
    await onGuardado()
    onCerrar()
  }

  const campos = [
    { label: 'Grabar', value: grabacion, set: setGrabacion },
    { label: 'Editar', value: edicion, set: setEdicion },
    { label: 'Publicar', value: publicacion, set: setPublicacion, sinPost: !tarea.postId },
  ]
  return (
    <div style={{ margin: '2px 0 8px 16px', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {campos.map(c => (
          <label key={c.label} title={c.sinPost ? 'Enlaza un guion a la tarea para poner la publicación' : undefined}
            style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {c.label}
            <input type="date" value={c.value} disabled={c.sinPost} onChange={e => c.set(e.target.value)}
              style={{ ...inputFecha, opacity: c.sinPost ? 0.5 : 1 }} />
          </label>
        ))}
        <button onClick={guardar} disabled={guardando}
          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: guardando ? 'var(--bg-card)' : '#D7FF3D', color: guardando ? 'var(--text-tertiary)' : '#0B0C10', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: guardando ? 'wait' : 'pointer' }}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={onCerrar}
          style={{ padding: '6px 4px', border: 'none', background: 'none', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
      {!publicacion && tarea.postId && (
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '6px 0 0' }}>Sin publicación: se programa sola en el próximo hueco al pasar a "Por publicar".</p>
      )}
      {grabacion && edicion && edicion < grabacion && (
        <p style={{ fontSize: 11.5, color: '#FF9500', margin: '6px 0 0' }}>La edición cae antes que la grabación.</p>
      )}
      {edicion && publicacion && publicacion < edicion && (
        <p style={{ fontSize: 11.5, color: '#FF9500', margin: '6px 0 0' }}>La publicación cae antes que la edición.</p>
      )}
      {error && <p style={{ fontSize: 11.5, color: '#FF3B30', margin: '6px 0 0' }}>{error}</p>}
    </div>
  )
}

export default function TareasDelPaso({ clienteId, cliente, paso }) {
  const navigate = useNavigate()
  const { tareas, archivadas, refetch } = useTareasList()
  const tablero = useTablero('tareas')
  const columnas = tablero.editable ? tablero.columnas : []
  const [editandoId, setEditandoId] = useState(null)
  const hoy = hoyISO()
  const lista = tareas
    .filter(t => String(t.clienteId) === String(clienteId) && t.paso === paso && !t.completada && !t.archivadaEn)
    .sort((a, b) => String(fechaVencimiento(a) || '9999').localeCompare(String(fechaVencimiento(b) || '9999')))
  if (!lista.length) return null

  return (
    <div style={{ maxWidth: 1100, marginBottom: 20, padding: '12px 16px', borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <CheckSquare size={14} color="#1D5FE0" />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Tareas de este paso · {lista.length}</span>
        <button onClick={() => navigate('/todo')}
          style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit', padding: 0 }}>
          Ir a Tareas <ArrowUpRight size={12} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {lista.map(t => {
          // Producción vence por la publicación del post, no por la grabación
          const esProduccion = t.origen === ORIGEN_PRODUCCION
          const fecha = fechaVencimiento(t)
          const vencida = estaVencida(t, hoy)
          const columna = columnaDeTarea(t, columnas)
          const aviso = columna ? avisoEtapa(t, columnas.indexOf(columna), hoy) : null
          const editando = editandoId === t.id
          return (
            <div key={t.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-primary)', padding: '4px 0' }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: '#1D5FE0', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.titulo}{t.postId && t.ideaTitulo && t.ideaTitulo !== t.titulo ? <span style={{ color: 'var(--text-secondary)' }}> · {t.ideaTitulo}</span> : null}
                </span>
                {columna && esProduccion && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{columna.nombre}</span>
                )}
                {aviso && (
                  <span title={`Era el ${fechaCorta(aviso.fecha)}`} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: 'rgba(255,149,0,0.12)', color: '#FF9500', fontWeight: 600, flexShrink: 0 }}>
                    {aviso.label}
                  </span>
                )}
                {fecha ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 500, color: vencida ? '#FF3B30' : 'var(--text-tertiary)', flexShrink: 0 }}>
                    <Clock size={11} /> {vencida ? 'Vencida · ' : esProduccion ? 'Publica ' : ''}{fechaCorta(fecha)}
                  </span>
                ) : esProduccion && (
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-tertiary)', flexShrink: 0 }}>Sin fecha de publicación</span>
                )}
                {esProduccion && cliente && (
                  <button onClick={() => setEditandoId(editando ? null : t.id)} title="Cambiar grabación, edición y publicación"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 7, border: '1px solid var(--border-color)', background: editando ? 'var(--bg-secondary)' : 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}>
                    <CalendarDays size={11} /> Fechas
                  </button>
                )}
              </div>
              {editando && (
                <EditorFechas tarea={t} cliente={cliente} onGuardado={refetch} onCerrar={() => setEditandoId(null)}
                  otras={[...tareas, ...archivadas].filter(x => x.id !== t.id && x.origen === ORIGEN_PRODUCCION && String(x.clienteId) === String(clienteId))} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
