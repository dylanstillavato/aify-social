import { apiUrl } from './apiBase'
import { getAuthHeaders } from './supabase'
import { errorConectaIa } from './claveIa'

// Investigar palabras clave está en una página pública — el mismo texto
// libre (sitio web, @instagram, o descripción del negocio) que escribe un
// visitante en la página de marketing o un usuario ya dentro de la app. La
// IA es la de la organización de quien busca, así que va con la sesión si la
// hay. Ver server.js POST /api/palabras-clave.
export async function investigarPalabrasClave(input) {
  const response = await fetch(apiUrl('/api/palabras-clave'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ input }),
  })
  const data = await response.json()
  if (data.conectaIa) throw errorConectaIa(data)
  if (!response.ok) throw new Error(data.error || 'No se pudo investigar palabras clave')
  return data
}

// Generar una idea de contenido a partir de una keyword requiere sesión —
// reutiliza el mismo Authorization: Bearer que el resto de generadores de ai.js.
export async function generarContenidoKeyword(keyword, negocio) {
  const response = await fetch(apiUrl('/api/palabras-clave/contenido'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ keyword, negocio }),
  })
  const data = await response.json()
  if (data.conectaIa) throw errorConectaIa(data)
  if (!response.ok) throw new Error(data.error || 'No se pudo generar el contenido')
  if (!data.success) throw new Error(data.error || 'No se pudo generar el contenido')
  return data.contenido
}
