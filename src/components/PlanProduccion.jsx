import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clapperboard, ChevronRight, AlertCircle } from 'lucide-react'
import { useTareasList, crearTarea } from '../hooks/useTareas'
import { getColumnas } from '../hooks/useTableros'
import { useFechasMarcadas, crearFechasMarcadas } from '../hooks/useInvestigacion'
import { fechasProduccionPorDefecto, fechaCorta, subtituloProduccion } from '../utils/planificacion'
import { ORIGEN_PRODUCCION } from '../utils/vencimiento'

// De la idea al calendario (Fase 6), último tramo: con los guiones aprobados
// por el cliente, el gestor fija el día de grabación y el de edición. Quedan
// como fechas marcadas en el calendario del cliente y cada vídeo entra como
// tarjeta en la primera columna del tablero de tareas ("Por grabar"); a partir
// de ahí se mueve a mano (Por editar, Por publicar, Hecho).

export const TITULO_GRABACION = 'Día de grabación'
export const TITULO_EDICION = 'Edición'
export const ORIGEN = ORIGEN_PRODUCCION


export default function PlanProduccion({ cliente, videos, año, mes }) {
  const navigate = useNavigate()
  const { tareas, archivadas, refetch } = useTareasList()
  const { fechas } = useFechasMarcadas(cliente?.id, año, mes + 1)
  const aprobados = videos.filter(p => p.aprobacionEstado === 'aprobado')
  // Las archivadas cuentan: un vídeo ya grabado y archivado no se vuelve a planificar
  const conTarjeta = new Set([...tareas, ...archivadas].filter(t => t.origen === ORIGEN).map(t => String(t.postId)))
  const pendientes = aprobados.filter(p => !conTarjeta.has(String(p.id)))
  const planificados = aprobados.length - pendientes.length

  const grabacionFijada = fechas.find(f => f.titulo === TITULO_GRABACION)?.fecha
  const edicionFijada = fechas.find(f => f.titulo === TITULO_EDICION)?.fecha
  // Los guiones sin programar llevan el día 1 como ancla, no como publicación
  const porDefecto = fechasProduccionPorDefecto(pendientes.filter(p => p.enCalendario !== false).map(p => p.fecha))
  const [grabacion, setGrabacion] = useState(null)
  const [edicion, setEdicion] = useState(null)
  const fGrab = grabacion || grabacionFijada || porDefecto.grabacion
  const fEdic = edicion || edicionFijada || porDefecto.edicion
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState(null)

  if (!cliente || aprobados.length === 0) return null

  const planificar = async () => {
    setTrabajando(true); setError(null)
    try {
      // Fechas en el calendario del cliente (sin duplicar si ya estaban)
      const nuevas = [
        { fecha: fGrab, titulo: TITULO_GRABACION },
        { fecha: fEdic, titulo: TITULO_EDICION },
      ].filter(n => !fechas.some(f => f.titulo === n.titulo && f.fecha === n.fecha))
        .map(n => ({ ...n, notas: pendientes.map(p => p.titulo).filter(Boolean).join(' · ') || null }))
      const { error: errFechas } = await crearFechasMarcadas({ clienteId: cliente.id, organizacionId: cliente.organizacionId }, nuevas)
      if (errFechas) console.warn('[PlanProduccion] no se pudieron guardar las fechas:', errFechas.message)

      // Una tarjeta por vídeo en la primera columna del tablero
      const { columnas } = await getColumnas('tareas')
      const primera = columnas[0] || null
      const yaEnPrimera = tareas.filter(t => primera && String(t.columnaId) === String(primera.id)).length
      for (let i = 0; i < pendientes.length; i++) {
        const p = pendientes[i]
        const { error: errTarea } = await crearTarea({
          clienteId: cliente.id,
          postId: p.id,
          titulo: p.titulo || 'Vídeo sin título',
          subtitulo: subtituloProduccion({ grabacion: fGrab, edicion: fEdic, publicacion: p.enCalendario === false ? null : p.fecha }),
          ideaTitulo: p.titulo,
          red: p.red,
          formato: p.formato,
          fechaLimite: fGrab,
          fechaEdicion: fEdic,
          origen: ORIGEN,
          tipo: ORIGEN,
          paso: 'grabacion',
          columnaId: primera?.id,
          orden: yaEnPrimera + i,
        })
        if (errTarea) throw new Error(errTarea.message || 'No se pudieron crear las tareas')
      }
      await refetch()
    } catch (e) {
      setError(e.message || 'Algo ha fallado planificando la producción.')
    } finally {
      setTrabajando(false)
    }
  }

  const campo = {
    padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-color)', fontSize: 13,
    fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-primary)',
  }

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '18px 22px', border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Clapperboard size={16} color="#1D5FE0" />
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Producción</h3>
      </div>

      {pendientes.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, flex: 1 }}>
            {planificados} {planificados === 1 ? 'vídeo aprobado está' : 'vídeos aprobados están'} en el tablero
            {grabacionFijada && <> · grabación el <strong style={{ color: 'var(--text-primary)' }}>{fechaCorta(grabacionFijada)}</strong></>}
            {edicionFijada && <> · edición el <strong style={{ color: 'var(--text-primary)' }}>{fechaCorta(edicionFijada)}</strong></>}
          </p>
          <button onClick={() => navigate('/todo')}
            style={{ display: 'flex', alignItems: 'center', gap: 3, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1D5FE0', fontFamily: 'inherit' }}>
            Abrir tablero <ChevronRight size={14} />
          </button>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
            {pendientes.length === 1 ? 'Hay 1 vídeo aprobado' : `Hay ${pendientes.length} vídeos aprobados`} sin planificar.
            Elige los días y se añaden al calendario del cliente y a la columna "Por grabar" del tablero.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
              Día de grabación
              <input type="date" value={fGrab} onChange={e => e.target.value && setGrabacion(e.target.value)} style={campo} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
              Día de edición
              <input type="date" value={fEdic} onChange={e => e.target.value && setEdicion(e.target.value)} style={campo} />
            </label>
            <button onClick={planificar} disabled={trabajando}
              style={{ padding: '10px 16px', borderRadius: 11, border: 'none', background: trabajando ? 'var(--bg-secondary)' : '#D7FF3D', color: trabajando ? 'var(--text-tertiary)' : '#0B0C10', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: trabajando ? 'wait' : 'pointer' }}>
              {trabajando ? 'Planificando...' : `Planificar ${pendientes.length === 1 ? 'el vídeo' : `los ${pendientes.length} vídeos`}`}
            </button>
          </div>
          {fEdic < fGrab && (
            <p style={{ fontSize: 12, color: '#FF9500', margin: '8px 0 0' }}>La edición cae antes que la grabación.</p>
          )}
          {planificados > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '8px 0 0' }}>
              {planificados === 1 ? 'Otro vídeo ya está' : `Otros ${planificados} ya están`} en el tablero.
            </p>
          )}
        </>
      )}
      {error && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#FF3B30', margin: '10px 0 0' }}>
          <AlertCircle size={14} /> {error}
        </p>
      )}
    </div>
  )
}
