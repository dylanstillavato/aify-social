// "Voz del cliente": frases reales de los clientes del negocio, guardadas en
// clientes.voz_cliente (0031_voz_cliente.sql). No es lo que el dueño cree que
// piensan sus clientes (eso ya está en el onboarding: porQueElegirnos,
// queBuscan), sino lo que dicen ellos con sus palabras: en una reseña, en caja,
// por DM. Es la materia prima de los mejores ángulos y ganchos.

export const TIPOS_VOZ = [
  { id: 'motivo', label: 'Por qué le eligieron', corto: 'Por qué le eligen', ejemplo: 'Me fui de mi peluquería de siempre porque nunca me escuchaban' },
  { id: 'problema', label: 'Cómo cuentan su problema', corto: 'Su problema', ejemplo: 'Tengo el pelo tan fino que ningún corte me dura dos días' },
  { id: 'deseo', label: 'Qué querían conseguir', corto: 'Lo que buscan', ejemplo: 'Quería un rubio que no pareciera de bote' },
  { id: 'duda', label: 'Dudas y miedos antes de comprar', corto: 'Sus dudas', ejemplo: 'Me daba miedo que me cortaran más de la cuenta' },
  { id: 'elogio', label: 'Elogios y frases que repiten', corto: 'Lo que dicen después', ejemplo: 'Salí sintiéndome otra persona' },
]

const TIPOS_POR_ID = Object.fromEntries(TIPOS_VOZ.map(t => [t.id, t]))

export const MAX_FRASES_EN_PROMPT = 40
const MAX_CARACTERES_FRASE = 300

export function etiquetaTipoVoz(tipo) {
  return TIPOS_POR_ID[tipo]?.label || 'Otras frases'
}

export function nuevaFraseVoz({ tipo, texto, fuente }) {
  return {
    id: crypto.randomUUID(),
    tipo: TIPOS_POR_ID[tipo] ? tipo : 'elogio',
    texto: texto.trim().replace(/^["“«]+|["”»]+$/g, ''),
    fuente: fuente?.trim() || null,
    fecha: new Date().toISOString().slice(0, 10),
  }
}

export function frasesVozValidas(cliente) {
  const lista = Array.isArray(cliente?.vozCliente) ? cliente.vozCliente : []
  return lista.filter(f => f && typeof f.texto === 'string' && f.texto.trim())
}

// Bloque para los prompts de ideas, guiones y copies. Vacío si no hay frases,
// para no añadir ruido a clientes que aún no tienen ninguna. Si hay muchas,
// van las más recientes (cada nueva se añade al final de la lista).
export function lineasVozCliente(cliente) {
  const frases = frasesVozValidas(cliente).slice(-MAX_FRASES_EN_PROMPT)
  if (!frases.length) return ''
  const porTipo = new Map()
  for (const f of frases) {
    const etiqueta = etiquetaTipoVoz(f.tipo)
    if (!porTipo.has(etiqueta)) porTipo.set(etiqueta, [])
    porTipo.get(etiqueta).push(`"${f.texto.trim().slice(0, MAX_CARACTERES_FRASE)}"`)
  }
  const bloques = [...porTipo].map(([etiqueta, citas]) => `- ${etiqueta}: ${citas.join(' · ')}`)
  return `VOZ DE SUS CLIENTES (frases reales, literales, de clientes del negocio):
${bloques.join('\n')}
Son las palabras con las que sus clientes describen el problema, el deseo y el motivo de compra. Úsalas como ángulos de las ideas y en los ganchos, con su mismo vocabulario. No inventes testimonios nuevos ni pongas nombre a quien lo dijo.`
}
