// Traduce errores técnicos (fetch/red, Supabase) a un mensaje que un usuario
// no técnico pueda entender. Un "TypeError: Failed to fetch" crudo en pantalla
// no le dice a nadie qué hacer; esto le da algo accionable.
export function mensajeErrorAmigable(error, fallback = 'No se pudo guardar. Inténtalo de nuevo.') {
  const msg = error?.message || String(error || '')
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(msg)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.'
  }
  return msg || fallback
}
