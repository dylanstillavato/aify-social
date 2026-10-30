// "Marca personal": un perfil que no es un negocio con clientes finales, sino
// la cuenta de una persona que la usa para conseguir clientes para su propio
// negocio (p. ej. el dueño de una agencia de contenido). Se guarda en
// clientes.marca_personal (0041_marca_personal.sql); null = negocio normal.
//
// Cambia el enfoque de toda la IA: el espectador es el cliente ideal de ese
// negocio (p. ej. el dueño de una peluquería), no el público de un local.

export const SECTOR_MARCA_PERSONAL = 'Marca personal'
export const COLOR_MARCA_PERSONAL = '#3B5BFF'

export const CAMPOS_MARCA_PERSONAL = ['negocio', 'oferta', 'clienteIdeal', 'llamadaAccion', 'historia']

export function esMarcaPersonal(cliente) {
  const mp = cliente?.marcaPersonal
  return !!mp && typeof mp === 'object'
}

// Objeto para la BD desde el formulario: solo los campos con texto.
export function marcaPersonalDesdeForm(form) {
  const obj = {}
  for (const campo of CAMPOS_MARCA_PERSONAL) {
    const v = typeof form?.[campo] === 'string' ? form[campo].trim() : ''
    if (v) obj[campo] = v
  }
  return obj
}

// Bloque que sustituye a "NEGOCIO" en construirPromptCliente (services/ai.js).
export function bloqueMarcaPersonal(cliente) {
  const mp = cliente.marcaPersonal || {}
  const negocio = mp.negocio || 'su negocio'
  const clienteIdeal = mp.clienteIdeal || cliente.publicoObjetivo || 'su cliente ideal'
  return `TIPO DE CUENTA: MARCA PERSONAL (no es un negocio con clientes finales)
- Persona: ${cliente.nombre}${cliente.ubicacion ? ` (${cliente.ubicacion})` : ''}
- Negocio que impulsa con su marca personal: ${negocio}
- Qué vende ese negocio: ${mp.oferta || cliente.descripcion || 'no especificado'}
- Cliente que quiere conseguir: ${clienteIdeal}
- Llamada a la acción: ${mp.llamadaAccion || `que le escriban por DM para hablar de ${negocio}`}
- Su historia y credenciales: ${mp.historia || 'no especificada'}
- De qué habla: ${cliente.descripcion || 'no disponible'}
- Diferencial: ${cliente.diferencial || 'no especificado'}

ESTRATEGIA DE MARCA PERSONAL (manda sobre el resto del perfil):
- OBJETIVO: conseguir clientes para ${negocio}. Cada idea, guion y copy debe acercar a ${clienteIdeal} a confiar en esta persona y contratar ${negocio}. Nada de contenido que solo entretiene sin construir confianza.
- El espectador ES ese cliente ideal. Los ganchos le hablan de un problema de SU negocio o de su vida como dueño ("si tienes un restaurante y tus vídeos no pasan de 300 visitas..."), no del público de un local.
- La persona sale a cámara y habla en primera persona en el cuerpo del vídeo (su experiencia, su equipo, sus clientes); el gancho sigue hablándole de tú al espectador.
- Reparte las ideas entre cinco tipos de pieza: autoridad (enseña algo concreto que el cliente ideal puede aplicar hoy), prueba (casos y resultados de clientes reales, antes y después, el proceso de un proyecto), detrás de cámaras (cómo trabaja, rodajes, el día a día del negocio), opinión (lo que hace mal el sector o lo que nadie dice) e historia (de dónde viene, por qué montó ${negocio}, errores y aprendizajes).
- Enseña de verdad, sin guardarse el truco: el cliente ideal no tiene tiempo de hacerlo él solo y acaba contratando a quien se lo ha enseñado.
- PROHIBIDO inventar clientes, cifras o resultados. Si un guion necesita un dato o un caso, deja un hueco entre corchetes para rellenar ([nombre del cliente], [resultado real]).
- Llamada a la acción suave y concreta, una por pieza, sin sonar a anuncio.`
}

// Versión corta para prompts que solo llevan una línea de marca (revisar gancho).
export function lineaEspectadorMarcaPersonal(cliente) {
  if (!esMarcaPersonal(cliente)) return ''
  const mp = cliente.marcaPersonal
  const clienteIdeal = mp.clienteIdeal || cliente.publicoObjetivo
  return `Es una MARCA PERSONAL para conseguir clientes para ${mp.negocio || 'su negocio'}: el espectador es su cliente ideal${clienteIdeal ? ` (${clienteIdeal})` : ''} y el gancho tiene que hablarle de un problema de su negocio.`
}
