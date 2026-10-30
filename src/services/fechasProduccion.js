import { actualizarTarea } from '../hooks/useTareas'
import { getPostsCliente, actualizarPost } from '../hooks/useCalendario'
import { getFechasMarcadas, crearFechasMarcadas, eliminarFechaMarcada } from '../hooks/useInvestigacion'
import { TITULO_GRABACION, TITULO_EDICION } from '../components/PlanProduccion'
import { subtituloProduccion, iso } from '../utils/planificacion'

// Fechas de una tarjeta de "Producción": grabación = fecha_limite, edición =
// fecha_edicion (0034) y publicación = la fecha del post enlazado. Lo usan el
// panel "Editar tarea" (ToDo) y "Tareas de este paso" de la ficha del cliente.

// Subtítulo "Grabar … · Editar … · Publicar …". publicacion undefined = no se
// sabe (post sin cargar): se conserva lo que ya ponía la tarjeta.
export function subtituloConFechas(tarea, { grabacion, edicion, publicacion }) {
  const nuevo = subtituloProduccion({ grabacion, edicion, publicacion })
  return publicacion === undefined && tarea.subtitulo
    ? [...nuevo.split(' · ').slice(0, 2), tarea.subtitulo.split(' · ')[2] || 'Publicar sin fecha'].join(' · ')
    : nuevo
}

// Publicación del post enlazado: vacía = vuelve a "sin programar" (ancla en
// el día 1 de su mes, como los guiones recién generados)
export async function cambiarPublicacion(clienteId, post, fecha, grabacion) {
  const cambios = fecha
    ? { fecha, enCalendario: true }
    : { fecha: `${String(post.fecha || grabacion || iso(new Date())).slice(0, 7)}-01`, enCalendario: false }
  const { error } = await actualizarPost(clienteId, post.id, cambios)
  if (error) console.warn('[fechasProduccion] no se pudo cambiar la publicación:', error.message)
  return { error }
}

// Cambiar el día de grabación o de edición mueve también la fecha marcada del
// calendario del cliente ("Día de grabación" / "Edición", que es la que
// desbloquea "Añadir al calendario"). La fecha vieja solo se quita si ningún
// otro vídeo del cliente se graba/edita ese día.
async function moverFechaMarcada({ cliente, titulo, de, a, otraLaUsa, notas }) {
  if (!cliente || de === a) return
  const { data, error } = await getFechasMarcadas(cliente.id)
  if (error) { console.warn('[fechasProduccion] no se pudieron leer las fechas del cliente:', error.message); return }
  if (a && !data.some(f => f.titulo === titulo && f.fecha === a)) {
    await crearFechasMarcadas({ clienteId: cliente.id, organizacionId: cliente.organizacionId }, [{ fecha: a, titulo, notas }])
  }
  if (de && !otraLaUsa) {
    const vieja = data.find(f => f.titulo === titulo && f.fecha === de)
    if (vieja) await eliminarFechaMarcada(vieja.id)
  }
}

// `otras` = las demás tarjetas de producción del cliente (activas y archivadas)
export async function moverFechasMarcadas({ cliente, tarea, grabacion, edicion, otras, notas }) {
  await moverFechaMarcada({ cliente, titulo: TITULO_GRABACION, de: tarea.fechaLimite, a: grabacion, otraLaUsa: otras.some(x => x.fechaLimite === tarea.fechaLimite), notas })
  await moverFechaMarcada({ cliente, titulo: TITULO_EDICION, de: tarea.fechaEdicion, a: edicion, otraLaUsa: otras.some(x => x.fechaEdicion === tarea.fechaEdicion), notas })
}

// Todo junto, para cambiar solo las fechas. publicacion: undefined = no tocar,
// '' = sin fecha, 'YYYY-MM-DD' = programar ese día.
export async function guardarFechasProduccion({ tarea, cliente, otras = [], grabacion, edicion, publicacion }) {
  let publicacionFinal
  if (publicacion !== undefined && tarea.postId) {
    const { data: posts } = await getPostsCliente(cliente.id, { incluirSinProgramar: true })
    const post = (posts || []).find(p => String(p.id) === String(tarea.postId))
    if (post) {
      const actual = post.enCalendario === false ? '' : post.fecha || ''
      if (actual !== publicacion) {
        const { error } = await cambiarPublicacion(cliente.id, post, publicacion, grabacion)
        if (error) return { error }
      }
      publicacionFinal = publicacion || null
    }
  }
  const datos = {
    fechaLimite: grabacion || null,
    subtitulo: subtituloConFechas(tarea, { grabacion, edicion, publicacion: publicacionFinal }),
  }
  // Sin la migración 0034 no se puede mandar fecha_edicion: solo si hay o había una
  if (edicion || tarea.fechaEdicion) datos.fechaEdicion = edicion || null
  const { error } = await actualizarTarea(tarea.id, datos)
  if (error) return { error }
  await moverFechasMarcadas({ cliente, tarea, grabacion, edicion, otras, notas: tarea.titulo })
  return { error: null }
}
