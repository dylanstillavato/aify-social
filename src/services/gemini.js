import { getAuthHeaders } from './supabase'
import { apiUrl } from './apiBase'
import { errorConectaIa } from './claveIa'

function parseJSON(text) {
  const clean = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start !== -1 && end !== -1) return JSON.parse(clean.slice(start, end + 1))
    throw new Error('Gemini devolvió una respuesta en formato no válido')
  }
}

async function fetchGemini(prompt) {
  const response = await fetch(apiUrl('/api/gemini-analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ prompt }),
  })
  console.log('[Gemini análisis] status', response.status)
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    console.error('[Gemini análisis] error:', error)
    if (error.conectaIa) throw errorConectaIa(error)
    throw new Error(error.error || 'Error al analizar')
  }
  const { text } = await response.json()
  console.log('[Gemini análisis] texto recibido, longitud:', text?.length)
  return parseJSON(text)
}

export async function analizarVideoCliente(urlsVideos, infoCliente) {
  const prompt = `
Eres experto en marketing de contenidos y análisis de marcas.

Se te proporciona información sobre el negocio "${infoCliente.nombre}"
del sector ${infoCliente.sector} con tono ${infoCliente.tono || 'no especificado'}.

URLs de referencia de sus redes sociales:
${urlsVideos.map((url, i) => `${i + 1}. ${url}`).join('\n')}

Basándote en el sector, el tipo de negocio y las plataformas
donde está presente, genera un perfil de comunicación
realista y específico para esta marca.

Responde ÚNICAMENTE con este JSON:
{
  "tono_real": "descripción del tono recomendado para este tipo de negocio",
  "palabras_clave": ["palabra1", "palabra2", "palabra3"],
  "expresiones_propias": ["expresión1", "expresión2"],
  "que_evita": "qué debe evitar este tipo de negocio",
  "resumen_estilo": "resumen en 2 frases del estilo de comunicación ideal"
}
`

  console.log('[Gemini análisis] prompt longitud:', prompt.length)
  return fetchGemini(prompt)
}
