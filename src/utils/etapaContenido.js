// Etapa de una pieza de contenido (un post del calendario) en el recorrido
// idea -> guion -> (cambios pedidos) -> aprobado -> publicado.
// Función pura: la usan la página Contenido y el dashboard.

export const ETAPAS = ['idea', 'guion', 'cambios', 'aprobado', 'publicado']

export const ETAPA_INFO = {
  idea: { label: 'Idea', color: '#86868B' },
  guion: { label: 'Guion', color: '#1D5FE0' },
  cambios: { label: 'Cambios pedidos', color: '#FF3B30' },
  aprobado: { label: 'Aprobado', color: '#30D158' },
  publicado: { label: 'Publicado', color: '#8E5CF7' },
}

export function etapaContenido(post) {
  if (!post) return 'idea'
  if (post.estado === 'publicado') return 'publicado'
  if (post.aprobacionEstado === 'aprobado') return 'aprobado'
  if (post.aprobacionEstado === 'cambios') return 'cambios'
  if (post.guion || post.copy) return 'guion'
  return 'idea'
}

export default etapaContenido
