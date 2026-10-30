import { supabase } from './supabase'
import { BUCKET_PUBLICACIONES } from './instagram'

// Secuencias de historias guardadas (0038_historias_secuencias.sql). Las fotos
// originales y las historias ya dibujadas viven en el bucket "publicaciones"
// (0036), en <organización>/<cliente>/historias/<secuencia>/..., para poder
// reabrirlas y programarlas en Instagram con el mismo flujo de publicar.

let orgIdCache = null
async function miOrganizacionId() {
  if (orgIdCache) return orgIdCache
  const { data, error } = await supabase.rpc('mi_organizacion_id')
  if (error || !data) throw new Error('No se encontró tu organización')
  orgIdCache = data
  return data
}

function mapear(row) {
  return {
    id: row.id,
    titulo: row.titulo,
    objetivo: row.objetivo || '',
    historias: row.historias || [],
    estilo: row.estilo || {},
    creadoEn: row.created_at,
  }
}

export async function listarSecuencias(clienteId, limite = 10) {
  if (!supabase) return []
  const { data, error } = await supabase.from('historias_secuencias')
    .select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(limite)
  if (error) throw new Error('No se pudieron leer las secuencias. ¿Está aplicada la migración 0038?')
  return (data || []).map(mapear)
}

export async function borrarSecuencia(id) {
  const { error } = await supabase.from('historias_secuencias').delete().eq('id', id)
  if (error) throw new Error('No se pudo borrar la secuencia')
}

export async function prefijoSecuencia(clienteId, secuenciaId) {
  return `${await miOrganizacionId()}/${clienteId}/historias/${secuenciaId}/`
}

export async function subirArchivo(ruta, blob) {
  const { error } = await supabase.storage.from(BUCKET_PUBLICACIONES).upload(ruta, blob, {
    contentType: 'image/jpeg', upsert: true,
  })
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`)
  return ruta
}

export async function descargarArchivo(ruta) {
  const { data, error } = await supabase.storage.from(BUCKET_PUBLICACIONES).download(ruta)
  if (error || !data) throw new Error('No se pudo descargar una imagen guardada')
  return data
}

// Inserta o actualiza. `id` lo decide el navegador (crypto.randomUUID) para
// poder subir las imágenes a su carpeta antes de guardar la fila.
export async function guardarSecuencia({ id, clienteId, organizacionId, titulo, objetivo, historias, estilo }) {
  const { data: { user } } = await supabase.auth.getUser()
  const fila = {
    id,
    cliente_id: clienteId,
    organizacion_id: organizacionId || null,
    user_id: user.id,
    titulo,
    objetivo: objetivo || null,
    historias,
    estilo,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('historias_secuencias').upsert(fila, { onConflict: 'id' }).select('*').single()
  if (error) throw new Error('No se pudo guardar la secuencia. ¿Está aplicada la migración 0038?')
  return mapear(data)
}
