import { supabase } from '../services/supabase'

// "Empezar de cero" con un cliente: borra todo el trabajo hecho con él y deja
// intacta su ficha.
//
// Se borra: ideas guardadas, calendario y guiones (calendario_posts), tareas,
// investigaciones mensuales (con las imágenes del moodboard) y fechas marcadas.
//
// Se conserva: la ficha y el kit de marca (clientes), facturas y presupuestos
// (son registros con valor legal), la conexión de Instagram, el portal del
// cliente y sus formularios de onboarding.
//
// Todo pasa por las políticas RLS de borrado de siempre (dueño o miembro de la
// organización del cliente). Devuelve { error } con el primer fallo.

export const SE_BORRA = ['Ideas guardadas', 'Calendario y guiones', 'Tareas', 'Investigación y moodboard', 'Fechas marcadas']
export const SE_CONSERVA = ['Ficha y kit de marca', 'Facturas y presupuestos', 'Instagram conectado', 'Portal del cliente']

const mismo = (a, b) => String(a) === String(b)

function limpiarLocal(clienteId) {
  try {
    localStorage.removeItem(`aify_calendario_posts_${clienteId}`)
    const ideas = JSON.parse(localStorage.getItem('aify_ideas_guardadas') || 'null')
    if (Array.isArray(ideas)) localStorage.setItem('aify_ideas_guardadas', JSON.stringify(ideas.filter(i => !mismo(i.clienteId, clienteId))))
    const todo = JSON.parse(localStorage.getItem('aify_todo') || 'null')
    if (todo?.tareas) localStorage.setItem('aify_todo', JSON.stringify({ tareas: todo.tareas.filter(t => !mismo(t.clienteId, clienteId)) }))
    const inv = JSON.parse(localStorage.getItem('aify_investigaciones') || 'null')
    if (inv) localStorage.setItem('aify_investigaciones', JSON.stringify(Object.fromEntries(Object.entries(inv).filter(([k]) => !k.startsWith(`${clienteId}:`)))))
    const fechas = JSON.parse(localStorage.getItem('aify_fechas_marcadas') || 'null')
    if (Array.isArray(fechas)) localStorage.setItem('aify_fechas_marcadas', JSON.stringify(fechas.filter(f => !mismo(f.cliente_id, clienteId))))
  } catch { /* almacenamiento bloqueado: nada que limpiar */ }
}

function avisarCambios() {
  for (const e of ['aify:ideas', 'aify:calendario', 'aify:todo', 'aify:fechas_marcadas']) window.dispatchEvent(new CustomEvent(e))
}

export async function reiniciarCliente(clienteId) {
  if (!clienteId) return { error: new Error('Falta el cliente') }
  if (!supabase) { limpiarLocal(clienteId); avisarCambios(); return { error: null } }

  // Imágenes del moodboard antes de borrar las investigaciones que las listan
  const { data: invs, error: errInv } = await supabase.from('investigaciones').select('datos').eq('cliente_id', clienteId)
  if (errInv) return { error: errInv }
  const rutas = (invs || []).flatMap(i => (Array.isArray(i.datos?.moodboard) ? i.datos.moodboard : []))
    .map(m => m?.path).filter(Boolean)
  if (rutas.length) {
    const { error } = await supabase.storage.from('moodboards').remove(rutas)
    if (error) console.warn('[reiniciarCliente] no se pudieron borrar imágenes del moodboard:', error.message)
  }

  // Tareas antes que los posts (las de un post se irían en cascada, pero las
  // manuales del cliente no)
  for (const tabla of ['tareas', 'calendario_posts', 'ideas', 'investigaciones', 'fechas_marcadas']) {
    const { error } = await supabase.from(tabla).delete().eq('cliente_id', clienteId)
    if (error) { avisarCambios(); return { error: new Error(`No se pudo borrar ${tabla}: ${error.message}`) } }
  }
  avisarCambios()
  return { error: null }
}
