// Redes donde se publica contenido (vídeos y carruseles). WhatsApp y Google
// Maps se guardan en la ficha del cliente, pero no son redes de publicación,
// así que no salen en los selectores de red de tareas y guiones.
export const REDES_CONTENIDO = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', linkedin: 'LinkedIn',
}

// Redes de contenido activas del cliente; sin cliente o sin ninguna activa, todas
export function redesDelCliente(cliente) {
  const activas = Object.keys(REDES_CONTENIDO).filter(id =>
    cliente?.redesDetalladas?.[id]?.activa || cliente?.redes?.includes?.(id))
  return activas.length ? activas : Object.keys(REDES_CONTENIDO)
}
