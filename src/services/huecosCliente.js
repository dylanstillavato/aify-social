import { getCliente } from '../hooks/useClientes'
import { getPostsCliente, actualizarPost } from '../hooks/useCalendario'
import { asignarHuecos, ritmoDe } from '../utils/huecos'
import { iso, sumarDias } from '../utils/planificacion'

// Un vídeo ya editado que sigue sin fecha de publicación se programa solo en
// el siguiente hueco libre de su formato (utils/huecos.js), desde mañana.
// Si ya tenía fecha, o no queda hueco en los próximos meses, no hace nada.
// Devuelve { fecha } con el día elegido, o { fecha: null }.
export async function programarEnSiguienteHueco(clienteId, postId) {
  const [{ data: cliente }, { data: posts }] = await Promise.all([
    getCliente(clienteId),
    getPostsCliente(clienteId, { incluirSinProgramar: true }),
  ])
  const post = (posts || []).find(p => String(p.id) === String(postId))
  if (!post || post.enCalendario !== false) return { fecha: null }
  const [asignado] = asignarHuecos(ritmoDe(cliente), [post], posts, sumarDias(iso(new Date()), 1))
  if (!asignado) return { fecha: null }
  const { error } = await actualizarPost(clienteId, postId, { fecha: asignado.fecha, enCalendario: true })
  if (error) console.warn('[huecosCliente] no se pudo programar el vídeo:', error.message)
  return { fecha: error ? null : asignado.fecha }
}
