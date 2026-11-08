// Cancelar lo programado en Instagram o en TikTok: la misma función para los
// DELETE /api/.../publicar de server.js y para cancelar_publicacion del MCP.
// Solo se cancela lo programado o con error; lo que se está publicando o ya
// ha salido no. Devuelve { publicacion } o { estado, error } con el código HTTP.

export function crearCancelarPublicacion({ supabaseAdmin, paraCliente }) {
  const TABLAS = { instagram: 'instagram_publicaciones', tiktok: 'tiktok_publicaciones' }

  return async function cancelarPublicacion({ red, clienteId, postId }) {
    const { data, error } = await supabaseAdmin.from(TABLAS[red])
      .update({ estado: 'cancelado', actualizado_en: new Date().toISOString() })
      .eq('post_id', postId).eq('cliente_id', clienteId).in('estado', ['programado', 'error'])
      .select('*').maybeSingle()
    if (error) return { estado: 500, error: 'No se pudo cancelar' }
    if (!data) return { estado: 409, error: 'Solo se puede cancelar una publicación programada o con error' }
    return { publicacion: paraCliente[red](data) }
  }
}
