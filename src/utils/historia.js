// La historia en 5 líneas (situación, deseo, conflicto, cambio, resultado) es
// el esqueleto de un guion: la IA la escribe primero y monta el guion encima,
// y el gestor puede corregirla y reescribir el guion desde ella. Se guarda en
// guion.historia; los guiones de antes no la tienen.
// `paraCliente` es la etiqueta que ve el cliente en la aprobación.
export const CAMPOS_HISTORIA = [
  { key: 'situacion', label: 'Situación', paraCliente: 'De dónde partimos', pregunta: 'Dónde estamos, qué cree o vive el espectador al empezar' },
  { key: 'deseo', label: 'Deseo', paraCliente: 'Qué se quiere conseguir', pregunta: 'Qué quiere conseguir el protagonista (o el espectador)' },
  { key: 'conflicto', label: 'Conflicto', paraCliente: 'Qué lo complica', pregunta: 'Qué se lo pone difícil: el obstáculo, el miedo, la tensión' },
  { key: 'cambio', label: 'Cambio', paraCliente: 'Qué lo cambia todo', pregunta: 'Qué pasa que lo mueve todo: un giro, una acción, otra forma de verlo' },
  { key: 'resultado', label: 'Resultado', paraCliente: 'Cómo acaba', pregunta: 'Cómo acaba y en qué se diferencia de cómo empezó' },
]

export const HISTORIA_VACIA = Object.fromEntries(CAMPOS_HISTORIA.map(({ key }) => [key, '']))

// Devuelve la historia con las 5 líneas como texto, o null si falta alguna
export function normalizarHistoria(h) {
  if (!h || typeof h !== 'object') return null
  const limpia = Object.fromEntries(CAMPOS_HISTORIA.map(({ key }) => [key, String(h[key] || '').trim()]))
  return CAMPOS_HISTORIA.every(({ key }) => limpia[key]) ? limpia : null
}

// "SITUACIÓN: ...\nDESEO: ..." para prompts, copiar al portapapeles, etc.
export const textoHistoria = (h) => CAMPOS_HISTORIA.map(({ key, label }) => `${label.toUpperCase()}: ${h[key]}`).join('\n')
