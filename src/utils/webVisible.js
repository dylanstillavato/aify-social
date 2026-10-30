// La web del cliente a veces se guarda tal cual se copió de un anuncio
// (https://negocio.com/?gclid=...&gad_source=...): cientos de caracteres sin
// espacios que no se pueden partir en líneas. Para mostrarla se quitan los
// parámetros de seguimiento de anuncios y el texto visible es solo dominio + ruta.

const PARAMS_SEGUIMIENTO = /^(utm_\w+|gclid|gbraid|wbraid|gad_\w+|fbclid|msclkid|mc_\w+|_ga|igshid)$/i

const esUsuario = web => web.trim().startsWith('@')

export function webLimpia(web) {
  if (!web) return ''
  if (esUsuario(web)) return web
  const conProtocolo = /^https?:\/\//i.test(web) ? web : `https://${web}`
  try {
    const url = new URL(conProtocolo)
    for (const clave of [...url.searchParams.keys()]) {
      if (PARAMS_SEGUIMIENTO.test(clave)) url.searchParams.delete(clave)
    }
    return url.toString()
  } catch {
    return conProtocolo // "@usuario" u otro texto que no es URL: se deja como estaba
  }
}

export function webTextoVisible(web) {
  if (!web) return ''
  if (esUsuario(web)) return web
  try {
    const url = new URL(webLimpia(web))
    const ruta = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')
    return url.hostname.replace(/^www\./, '') + ruta + url.search
  } catch {
    return web
  }
}
