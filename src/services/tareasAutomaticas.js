import { crearTarea, getTareas, eliminarTarea } from '../hooks/useTareas'
import { getColumnas, moverTarea } from '../hooks/useTableros'
import { ORIGEN_PRODUCCION } from '../utils/vencimiento'

// Tareas que se crean y se mueven solas con el flujo de contenido (#85):
// - al aprobar el guion a mano, su tarjeta de producción nace en «Por grabar»
//   (primera columna del tablero). Los guiones sin aprobar no entran: los que
//   aprueba el cliente por el enlace se pasan al tablero desde Producción;
// - al programarla en el calendario, pasa a «Por publicar» (tercera columna);
// - al publicarla en Instagram pasa a «Hecho» (eso lo hace server.js).
// Entre medias el equipo la mueve a mano, como siempre. Si el tablero no
// tiene la columna que toca, no se mueve nada y se avisa en consola.

const IDX_POR_PUBLICAR = 2

// Una tarjeta por post: si ya la tiene (p. ej. de PlanProduccion), no se duplica
export async function crearTareaPorGrabar({ cliente, post, titulo, red, formato }) {
  const { data: tareas } = await getTareas()
  if ((tareas || []).some(t => String(t.postId) === String(post.id))) return
  const { columnas } = await getColumnas('tareas')
  if (!columnas[0]) return console.warn('[tareasAutomaticas] el tablero no tiene columnas: no se crea la tarea de', titulo)
  const enPrimera = (tareas || []).filter(t => String(t.columnaId) === String(columnas[0].id)).length
  const { error } = await crearTarea({
    clienteId: cliente.id, postId: post.id, titulo: titulo || 'Pieza sin título', ideaTitulo: titulo,
    red, formato, origen: ORIGEN_PRODUCCION, tipo: ORIGEN_PRODUCCION, paso: 'grabacion',
    columnaId: columnas[0].id, orden: enPrimera,
  })
  if (error) console.warn('[tareasAutomaticas] no se pudo crear la tarea:', error.message || error)
}

// Al quitar la aprobación: la tarjeta se va si nadie la ha empezado (sigue en
// «Por grabar» y sin completar). Si ya se movió, se deja como está.
export async function quitarTareaPorGrabar(post) {
  const { data: tareas } = await getTareas()
  const tarea = (tareas || []).find(t => String(t.postId) === String(post.id) && t.origen === ORIGEN_PRODUCCION && !t.archivadaEn)
  if (!tarea || tarea.completada) return
  const { columnas } = await getColumnas('tareas')
  if (!columnas[0] || String(tarea.columnaId) !== String(columnas[0].id)) return
  const { error } = await eliminarTarea(tarea.id)
  if (error) console.warn('[tareasAutomaticas] no se pudo quitar la tarea:', error.message || error)
}

// Solo hacia delante: si la tarjeta ya está en «Por publicar» o más allá, no
// se toca. Ya tiene fecha, así que moverTarea no la manda al siguiente hueco.
export async function pasarAPorPublicar(post) {
  const { data: tareas } = await getTareas()
  const tarea = (tareas || []).find(t => String(t.postId) === String(post.id) && t.origen === ORIGEN_PRODUCCION && !t.archivadaEn)
  if (!tarea || tarea.completada) return
  const { columnas } = await getColumnas('tareas')
  const destino = columnas[IDX_POR_PUBLICAR]
  if (!destino || destino.esFinal) return console.warn('[tareasAutomaticas] el tablero no tiene columna «Por publicar»: la tarea no se mueve')
  const actual = columnas.findIndex(c => String(c.id) === String(tarea.columnaId))
  if (actual >= IDX_POR_PUBLICAR) return
  const enDestino = (tareas || []).filter(t => String(t.columnaId) === String(destino.id) && !t.archivadaEn).map(t => t.id)
  await moverTarea({ tarea: { ...tarea, fechaPublicacion: post.fecha }, columna: destino, idsOrdenados: [...enDestino, tarea.id], tareas })
}
