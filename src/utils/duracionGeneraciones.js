// Cuánto tarda de media cada tipo de generación de un solo paso (barra
// indeterminada de BarraGeneracion), para enseñar «~25 s» desde la segunda
// vez. Se guardan las últimas 10 duraciones por tipo en este navegador.

const LS_KEY = 'aify_duracion_generaciones'
const MAX_MUESTRAS = 10

function leer() {
  try {
    const datos = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    return datos && typeof datos === 'object' ? datos : {}
  } catch { return {} }
}

export function registrarDuracion(tipo, ms) {
  if (!tipo || !(ms > 0)) return
  try {
    const datos = leer()
    datos[tipo] = [...(Array.isArray(datos[tipo]) ? datos[tipo] : []), Math.round(ms)].slice(-MAX_MUESTRAS)
    localStorage.setItem(LS_KEY, JSON.stringify(datos))
  } catch { /* sin localStorage: sin estimación */ }
}

// Media en ms, o null si ese tipo aún no se ha hecho nunca
export function duracionMedia(tipo) {
  const muestras = leer()[tipo]
  if (!Array.isArray(muestras) || !muestras.length) return null
  return muestras.reduce((t, n) => t + n, 0) / muestras.length
}
