// Dibuja una historia de Instagram (1080×1920) en un canvas con la marca del
// cliente: colores del kit, tipografía (Google Fonts) y logo. Funciones puras
// sobre canvas, sin React. Lo usa la herramienta Secuencias de historias.
//
// Zona segura: Instagram tapa arriba (barra de progreso y perfil) y abajo
// (responder / enviar). Todo el texto queda entre ZONA.arriba y ZONA.abajo.

import { esHexValido, normalizarHex, colorTextoLegible } from './colorMarca'

export const ANCHO = 1080
export const ALTO = 1920
const ZONA = { arriba: 250, abajo: 1560, lado: 90 }

// Parejas titular + cuerpo. `css` es el parámetro family= de Google Fonts.
export const FUENTES_HISTORIA = [
  { id: 'retro', label: 'Retro (Abril Fatface)', titulo: 'Abril Fatface', cuerpo: 'DM Sans', css: ['Abril+Fatface', 'DM+Sans:wght@400;600'] },
  { id: 'elegante', label: 'Elegante (Playfair)', titulo: 'Playfair Display', cuerpo: 'Inter', css: ['Playfair+Display:ital,wght@0,700;1,700', 'Inter:wght@400;600'] },
  { id: 'moderna', label: 'Moderna (Montserrat)', titulo: 'Montserrat', cuerpo: 'Montserrat', css: ['Montserrat:wght@400;600;800'] },
  { id: 'impacto', label: 'Impacto (Anton)', titulo: 'Anton', cuerpo: 'Inter', css: ['Anton', 'Inter:wght@400;600'] },
  { id: 'natural', label: 'Natural (Cormorant)', titulo: 'Cormorant Garamond', cuerpo: 'Josefin Sans', css: ['Cormorant+Garamond:ital,wght@0,700;1,700', 'Josefin+Sans:wght@400;600'] },
  { id: 'cercana', label: 'Cercana (Pacifico)', titulo: 'Pacifico', cuerpo: 'Nunito', css: ['Pacifico', 'Nunito:wght@400;700'] },
]

// Elige la pareja de fuentes a partir de la identidad visual del cliente.
export function fuenteDeCliente(iv = {}) {
  const t = `${iv.fuenteEspecifica || ''} ${iv.estiloTipografia || ''} ${(iv.estetica || []).join(' ')}`.toLowerCase()
  const directa = FUENTES_HISTORIA.find(f => t.includes(f.titulo.toLowerCase()))
  if (directa) return directa.id
  if (/vintage|retro|glamur|años|pin.?up/.test(t)) return 'retro'
  if (/impact|audaz|urban|deport|bold/.test(t)) return 'impacto'
  if (/manuscr|script|cercan|divertid|infantil/.test(t)) return 'cercana'
  if (/natural|boho|mediterr|org[aá]nic|rústic/.test(t)) return 'natural'
  if (/elegan|lujo|sofistic|serif|clásic/.test(t)) return 'elegante'
  return 'moderna'
}

const cargadas = new Map()
export function cargarFuentes(id) {
  const f = FUENTES_HISTORIA.find(x => x.id === id) || FUENTES_HISTORIA[2]
  if (!cargadas.has(f.id)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?${f.css.map(c => `family=${c}`).join('&')}&display=swap`
    document.head.appendChild(link)
    const espera = new Promise(resolve => { link.onload = resolve; link.onerror = resolve })
      .then(() => Promise.all([
        document.fonts.load(`700 80px "${f.titulo}"`),
        document.fonts.load(`400 40px "${f.cuerpo}"`),
        document.fonts.load(`600 40px "${f.cuerpo}"`),
      ]))
      .catch(() => {})
    cargadas.set(f.id, espera)
  }
  return cargadas.get(f.id).then(() => f)
}

// Colores de la secuencia: los del kit, o neutros si el cliente no tiene.
export function paletaDeCliente(iv = {}) {
  const hex = (v, porDefecto) => (esHexValido(v || '') ? normalizarHex(v) : porDefecto)
  return {
    primario: hex(iv.colorPrimario, '#1D1D1F'),
    secundario: hex(iv.colorSecundario, '#F4EFE8'),
    acento: hex(iv.colorAcento, '#E1306C'),
    oscuro: '#111111',
    claro: '#F7F3EE',
  }
}

function lineas(ctx, texto, ancho) {
  const palabras = String(texto || '').split(/\s+/).filter(Boolean)
  const resultado = []
  let actual = ''
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p
    if (ctx.measureText(prueba).width > ancho && actual) {
      resultado.push(actual)
      actual = p
    } else actual = prueba
  }
  if (actual) resultado.push(actual)
  return resultado
}

// Ajusta el tamaño hasta que el texto quepa en maxLineas; devuelve lo necesario para pintarlo.
function medir(ctx, texto, { familia, peso = 700, estilo = '', tam, min = 40, ancho, maxLineas, interlineado = 1.12 }) {
  let size = tam
  let ls = []
  for (; size >= min; size -= 4) {
    ctx.font = `${estilo} ${peso} ${size}px "${familia}"`.trim()
    ls = lineas(ctx, texto, ancho)
    if (ls.length <= maxLineas) break
  }
  return { size, ls, alto: ls.length * size * interlineado, font: ctx.font, interlineado }
}

function pintar(ctx, m, x, y, { color, align = 'left' }) {
  ctx.font = m.font
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  m.ls.forEach((l, i) => ctx.fillText(l, x, y + i * m.size * m.interlineado))
}

function cubrir(ctx, img, x, y, w, h) {
  const escala = Math.max(w / img.width, h / img.height)
  const sw = w / escala
  const sh = h / escala
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

function degradado(ctx, y0, y1, alfa) {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${alfa})`)
  ctx.fillStyle = g
  ctx.fillRect(0, y0, ANCHO, y1 - y0)
}

function logoArriba(ctx, logo, alto = 110) {
  if (!logo) return
  const w = (logo.width / logo.height) * alto
  ctx.drawImage(logo, (ANCHO - w) / 2, ZONA.arriba, w, alto)
}

// h: { plantilla, fondo, titular, texto }, foto: ImageBitmap | null,
// marca: { paleta, fuentes: { titulo, cuerpo }, logo: HTMLImageElement | null }
export function dibujarHistoria(canvas, h, foto, marca) {
  canvas.width = ANCHO
  canvas.height = ALTO
  const ctx = canvas.getContext('2d')
  const { paleta, fuentes, logo } = marca
  const fondo = paleta[h.fondo] || paleta.primario
  const tinta = colorTextoLegible(fondo)
  const acento = paleta.acento === fondo ? paleta.secundario : paleta.acento
  const anchoTexto = ANCHO - ZONA.lado * 2
  const plantilla = foto ? h.plantilla : (['portada', 'foto_texto', 'cita'].includes(h.plantilla) ? 'texto' : h.plantilla)

  ctx.fillStyle = fondo
  ctx.fillRect(0, 0, ANCHO, ALTO)

  if (plantilla === 'portada') {
    cubrir(ctx, foto, 0, 0, ANCHO, ALTO)
    degradado(ctx, ALTO * 0.3, ALTO, 0.88)
    const tit = medir(ctx, h.titular, { familia: fuentes.titulo, tam: 132, ancho: anchoTexto, maxLineas: 4 })
    const txt = h.texto ? medir(ctx, h.texto, { familia: fuentes.cuerpo, peso: 400, tam: 46, min: 32, ancho: anchoTexto, maxLineas: 4, interlineado: 1.3 }) : null
    const total = tit.alto + (txt ? txt.alto + 36 : 0)
    let y = ZONA.abajo - total
    ctx.fillStyle = acento
    ctx.fillRect(ZONA.lado, y - 40, 120, 12)
    pintar(ctx, tit, ZONA.lado, y, { color: '#FFFFFF' })
    y += tit.alto + 36
    if (txt) pintar(ctx, txt, ZONA.lado, y, { color: 'rgba(255,255,255,0.92)' })
    logoArriba(ctx, logo, 90)
  } else if (plantilla === 'foto_texto') {
    const corte = 1100
    cubrir(ctx, foto, 0, 0, ANCHO, corte)
    ctx.fillStyle = fondo
    ctx.fillRect(0, corte, ANCHO, ALTO - corte)
    ctx.fillStyle = acento
    ctx.fillRect(0, corte - 10, ANCHO, 20)
    const tit = medir(ctx, h.titular, { familia: fuentes.titulo, tam: 100, ancho: anchoTexto, maxLineas: 3 })
    let y = corte + 70
    pintar(ctx, tit, ZONA.lado, y, { color: tinta })
    y += tit.alto + 30
    if (h.texto) {
      const txt = medir(ctx, h.texto, { familia: fuentes.cuerpo, peso: 400, tam: 46, min: 30, ancho: anchoTexto, maxLineas: Math.max(1, Math.floor((ZONA.abajo - y) / 60)), interlineado: 1.3 })
      pintar(ctx, txt, ZONA.lado, y, { color: tinta })
    }
  } else if (plantilla === 'cita') {
    cubrir(ctx, foto, 0, 0, ANCHO, ALTO)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, ANCHO, ALTO)
    const tit = medir(ctx, `“${h.titular}”`, { familia: fuentes.titulo, estilo: 'italic', tam: 104, ancho: anchoTexto, maxLineas: 6, interlineado: 1.18 })
    const txt = h.texto ? medir(ctx, h.texto, { familia: fuentes.cuerpo, peso: 600, tam: 40, min: 30, ancho: anchoTexto, maxLineas: 3, interlineado: 1.3 }) : null
    const total = tit.alto + (txt ? txt.alto + 50 : 0)
    let y = Math.max(ZONA.arriba, (ALTO - total) / 2)
    pintar(ctx, tit, ANCHO / 2, y, { color: '#FFFFFF', align: 'center' })
    y += tit.alto + 50
    if (txt) pintar(ctx, txt, ANCHO / 2, y, { color: 'rgba(255,255,255,0.88)', align: 'center' })
  } else {
    // texto / cta: fondo de color con el texto centrado
    const esCta = plantilla === 'cta'
    logoArriba(ctx, logo, esCta ? 150 : 100)
    const tit = medir(ctx, h.titular, { familia: fuentes.titulo, tam: esCta ? 124 : 116, ancho: anchoTexto, maxLineas: 5 })
    const txt = h.texto ? medir(ctx, h.texto, { familia: fuentes.cuerpo, peso: 400, tam: 50, min: 32, ancho: anchoTexto, maxLineas: 5, interlineado: 1.3 }) : null
    const total = tit.alto + (txt ? txt.alto + 50 : 0) + (esCta ? 190 : 0)
    let y = Math.max(ZONA.arriba + 180, (ALTO - total) / 2)
    pintar(ctx, tit, ANCHO / 2, y, { color: tinta, align: 'center' })
    y += tit.alto + 50
    if (txt) {
      pintar(ctx, txt, ANCHO / 2, y, { color: tinta, align: 'center' })
      y += txt.alto + 50
    }
    const conSticker = h.sticker?.tipo && h.sticker.tipo !== 'ninguno'
    if (esCta && conSticker) {
      // Hueco para el sticker sugerido (enlace, pregunta…), que se añade en Instagram.
      ctx.strokeStyle = acento
      ctx.lineWidth = 6
      ctx.setLineDash([18, 14])
      const w = 640
      ctx.beginPath()
      ctx.roundRect((ANCHO - w) / 2, y + 20, w, 130, 65)
      ctx.stroke()
      ctx.setLineDash([])
    } else {
      ctx.fillStyle = acento
      ctx.fillRect((ANCHO - 120) / 2, y + 10, 120, 12)
    }
  }
  return canvas
}

export function canvasAJpeg(canvas, calidad = 0.92) {
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo exportar la historia'))), 'image/jpeg', calidad))
}

// Reduce una foto para mandarla a la IA (≈640 px de lado largo, JPEG base64).
export async function fotoParaIA(bitmap, lado = 640) {
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bitmap.width * escala)
  c.height = Math.round(bitmap.height * escala)
  c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height)
  const dataUrl = c.toDataURL('image/jpeg', 0.72)
  return { mediaType: 'image/jpeg', data: dataUrl.split(',')[1] }
}
