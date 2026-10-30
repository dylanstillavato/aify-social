// Utilidades puras para los colores del kit de marca de un cliente
// (cliente.identidadVisual.colorPrimario / colorSecundario / colorAcento).
// Sin dependencias de DOM ni de React: las usan la ficha del cliente, los PDF
// (services/exportPDF.js) y el portal del cliente.

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

// true si `valor` es un hex de 3 o 6 dígitos, con o sin "#".
export function esHexValido(valor) {
  return typeof valor === 'string' && HEX_RE.test(valor.trim())
}

// Devuelve el hex normalizado como "#rrggbb" en minúsculas, o null si no es válido.
export function normalizarHex(valor) {
  if (!esHexValido(valor)) return null
  let h = valor.trim().replace(/^#/, '').toLowerCase()
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  return `#${h}`
}

// "#rrggbb" -> [r, g, b] (0-255), o null si no es válido.
export function hexARgb(valor) {
  const hex = normalizarHex(valor)
  if (!hex) return null
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
}

// Luminancia relativa WCAG 2.x (0 = negro, 1 = blanco), o null si no es válido.
export function luminancia(valor) {
  const rgb = hexARgb(valor)
  if (!rgb) return null
  const [r, g, b] = rgb.map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Ratio de contraste WCAG entre dos colores (1-21), o null si alguno no es válido.
export function contraste(a, b) {
  const la = luminancia(a)
  const lb = luminancia(b)
  if (la == null || lb == null) return null
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export const TEXTO_OSCURO = '#0b0c10'
export const TEXTO_CLARO = '#ffffff'

// Color de texto legible (oscuro o blanco) encima de `fondo`: el que más
// contraste da. Si el fondo no es un hex válido, devuelve el texto oscuro.
export function colorTextoLegible(fondo, { oscuro = TEXTO_OSCURO, claro = TEXTO_CLARO } = {}) {
  const cOscuro = contraste(fondo, oscuro)
  const cClaro = contraste(fondo, claro)
  if (cOscuro == null || cClaro == null) return oscuro
  return cClaro > cOscuro ? claro : oscuro
}
