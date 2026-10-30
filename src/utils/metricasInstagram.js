// Métricas derivadas de la respuesta de /api/instagram/metricas: tasas sobre
// alcance, media de los reels y rendimiento por formato. Funciones puras.

const num = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v))

export const ETIQUETA_FORMATO = { REEL: 'Reel', VIDEO: 'Vídeo', CAROUSEL_ALBUM: 'Carrusel', IMAGE: 'Foto' }

// Interacciones de una publicación: el total de Meta o, si no llega, la suma
export function interaccionesDe(p) {
  if (num(p.interacciones) != null) return num(p.interacciones)
  const partes = [p.meGusta, p.comentarios, p.guardados, p.compartidos].map(num)
  return partes.every(v => v == null) ? null : partes.reduce((s, v) => s + (v || 0), 0)
}

// Porcentaje con un decimal, o null si no se puede calcular
export function tasa(parte, total) {
  const a = num(parte)
  const b = num(total)
  if (a == null || !b) return null
  return Math.round((a / b) * 1000) / 10
}

export function porcentaje(v) {
  return v == null ? '—' : `${Number(v).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`
}

export function segundos(ms) {
  return ms == null ? '—' : `${(ms / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} s`
}

function media(lista, f) {
  const valores = lista.map(f).filter(v => v != null)
  return valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : null
}

const redondear = (v, dec = 0) => (v == null ? null : Math.round(v * 10 ** dec) / 10 ** dec)

// Media de los reels de la cuenta, para comparar un reel concreto
export function mediaReels(publicaciones = []) {
  const reels = publicaciones.filter(p => p.tipo === 'REEL')
  if (!reels.length) return null
  return {
    n: reels.length,
    visualizaciones: redondear(media(reels, p => num(p.visualizaciones))),
    alcance: redondear(media(reels, p => num(p.alcance))),
    vistoMedioMs: redondear(media(reels, p => num(p.vistoMedioMs))),
    saltos: redondear(media(reels, p => num(p.saltos)), 1),
    tasaInteraccion: redondear(media(reels, p => tasa(interaccionesDe(p), p.alcance)), 1),
  }
}

// Una fila por formato con 1+ publicaciones, ordenadas por alcance medio
export function rendimientoPorFormato(publicaciones = []) {
  const grupos = {}
  for (const p of publicaciones) {
    const t = ETIQUETA_FORMATO[p.tipo] || 'Otro'
    ;(grupos[t] = grupos[t] || []).push(p)
  }
  return Object.entries(grupos).map(([formato, lista]) => ({
    formato,
    n: lista.length,
    alcance: redondear(media(lista, p => num(p.alcance))),
    visualizaciones: redondear(media(lista, p => num(p.visualizaciones))),
    tasaInteraccion: redondear(media(lista, p => tasa(interaccionesDe(p), p.alcance)), 1),
    tasaGuardado: redondear(media(lista, p => tasa(p.guardados, p.alcance)), 1),
    tasaCompartido: redondear(media(lista, p => tasa(p.compartidos, p.alcance)), 1),
  })).sort((a, b) => (b.alcance || 0) - (a.alcance || 0))
}

// Cuántas veces la media de la cuenta (1.8 → "1,8×"), para destacar outliers
export function vecesLaMedia(valor, mediaCuenta) {
  const v = num(valor)
  if (v == null || !mediaCuenta) return null
  return Math.round((v / mediaCuenta) * 10) / 10
}
