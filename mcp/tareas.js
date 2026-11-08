import { ORIGEN_PRODUCCION } from '../src/utils/vencimiento.js'
import { COLUMNAS_POR_DEFECTO } from '../src/utils/columnasTablero.js'

// La tarjeta «Por grabar» de un guion aprobado a mano, para aprobar_guion.
// Hace lo mismo que crearTareaPorGrabar y quitarTareaPorGrabar de la web
// (src/services/tareasAutomaticas.js), que no se pueden importar aquí porque
// usan el Supabase del navegador. Quien llama ya ha comprobado que el post es
// de la organización. Devuelve qué ha pasado y lanza si falla la base de datos.

export function crearTareasPorGrabar({ supabaseAdmin, organizacionId, userId }) {
  const comprobar = ({ data, error }) => {
    if (error) throw new Error(error.message)
    return data
  }

  const leerColumnas = async () => comprobar(await supabaseAdmin.from('tablero_columnas').select('*')
    .eq('tablero', 'tareas').eq('organizacion_id', organizacionId).order('orden', { ascending: true })) || []

  // Como la web: la primera vez que se usa el tablero nacen sus columnas
  async function columnasDelTablero() {
    const columnas = await leerColumnas()
    if (columnas.length) return columnas
    const filas = COLUMNAS_POR_DEFECTO.tareas.map((c, i) => ({
      organizacion_id: organizacionId, user_id: userId, tablero: 'tareas',
      nombre: c.nombre, orden: i, color: c.color || null, es_final: !!c.esFinal,
    }))
    const creadas = comprobar(await supabaseAdmin.from('tablero_columnas').insert(filas).select())
    return [...creadas].sort((a, b) => a.orden - b.orden)
  }

  async function crear({ clienteId, post }) {
    // Una tarjeta por post: si ya la tiene (p. ej. de PlanProduccion), no se duplica
    const existentes = comprobar(await supabaseAdmin.from('tareas').select('id').eq('post_id', post.id).limit(1))
    if (existentes?.length) return { creada: false, motivo: 'El post ya tenía tarjeta en el tablero.' }
    const [primera] = await columnasDelTablero()
    const enPrimera = comprobar(await supabaseAdmin.from('tareas').select('id').eq('columna_id', primera.id)) || []
    const titulo = post.titulo || 'Pieza sin título'
    comprobar(await supabaseAdmin.from('tareas').insert({
      user_id: userId, cliente_id: clienteId, post_id: post.id, titulo, idea_titulo: post.titulo || null,
      red: post.red || null, formato: post.formato || null, completada: false, en_progreso: false,
      origen: ORIGEN_PRODUCCION, tipo: ORIGEN_PRODUCCION, paso: 'grabacion',
      columna_id: primera.id, orden: enPrimera.length,
    }))
    return { creada: true, columna: primera.nombre }
  }

  // La tarjeta se va solo si nadie la ha empezado (sigue en «Por grabar» y sin completar)
  async function quitar(post) {
    const tareas = comprobar(await supabaseAdmin.from('tareas').select('*').eq('post_id', post.id).eq('origen', ORIGEN_PRODUCCION)) || []
    const tarea = tareas.find(t => !t.archivada_en)
    if (!tarea || tarea.completada) return { quitada: false }
    const [primera] = await leerColumnas()
    if (!primera || String(tarea.columna_id) !== String(primera.id)) return { quitada: false, motivo: 'La tarjeta ya se había movido en el tablero: se deja como está.' }
    comprobar(await supabaseAdmin.from('tareas').delete().eq('id', tarea.id))
    return { quitada: true }
  }

  return { crear, quitar }
}
