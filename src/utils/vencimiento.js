// Cuándo vence una tarea. Las tarjetas de "Producción" (PlanProduccion) guardan
// el día de grabación en fecha_limite, pero lo que no puede pasarse es la
// publicación: vencen por la fecha del post enlazado (fechaPublicacion, que
// adjunta useTareas). Sin publicación programada no vencen. El resto de
// tareas vencen por su fecha_limite, como siempre.

export const ORIGEN_PRODUCCION = 'produccion'

export function hoyISO() {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
}

export function fechaVencimiento(t) {
  if (!t) return null
  if (t.origen === ORIGEN_PRODUCCION) return t.fechaPublicacion || null
  return t.fechaLimite || null
}

export function estaVencida(t, hoy = hoyISO()) {
  const f = fechaVencimiento(t)
  return !t.completada && !!f && f < hoy
}

// Aviso de etapa de una tarjeta de producción según su columna del tablero
// (0 = por grabar, 1 = por editar): si ese día ya pasó, avisa en naranja sin
// marcarla vencida, porque lo que no puede pasarse es la publicación.
export function avisoEtapa(t, idxColumna, hoy = hoyISO()) {
  if (t?.origen !== ORIGEN_PRODUCCION || t.completada) return null
  if (idxColumna === 0 && t.fechaLimite && t.fechaLimite < hoy) return { label: 'Grabación atrasada', fecha: t.fechaLimite }
  if (idxColumna === 1 && t.fechaEdicion && t.fechaEdicion < hoy) return { label: 'Edición atrasada', fecha: t.fechaEdicion }
  return null
}
