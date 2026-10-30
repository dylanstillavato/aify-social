import jsPDF from 'jspdf'
import superJelloUrl from '../assets/fonts/SuperJello.ttf'
import { hexARgb } from '../utils/colorMarca'
import { encajarEnCaja } from '../utils/fotoCliente'
import { esCarrusel } from '../utils/formato'
import { CAMPOS_HISTORIA, normalizarHistoria } from '../utils/historia'

// ── Layout constants ──────────────────────────────────────────────────────────

const A4 = { w: 210, h: 297 }
const M = 20 // margins
const CW = A4.w - 2 * M // 170 mm content width

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ── Color palettes ─────────────────────────────────────────────────────────────
// Marca Aify: degradado azul (#007BFF → #4DA3FF → #B0E0E6) + acento lima
// (#D7FF3D), igual que el resto de la app (index.css --gradient-brand /
// --accent-lime). "black" se queda como alias de "ink" (mismo valor,
// #0B0C10) para no romper ninguna llamada existente a C.black.

const C = {
  ink:        [11, 12, 16],     // #0B0C10 — texto principal (mismo tono que --text-primary en botones lima)
  black:      [11, 12, 16],     // alias de ink, compatibilidad con el resto del archivo
  gray:       [134, 134, 139],
  lightGray:  [195, 195, 200],
  veryLight:  [245, 245, 247],
  line:       [230, 230, 235],
  blue:       [0, 123, 255],    // #007BFF — brand-blue-1
  blueLight:  [227, 241, 255],
  blueMid:    [77, 163, 255],   // #4DA3FF — punto medio del degradado
  skyLight:   [176, 224, 230],  // #B0E0E6 — final del degradado
  skyLightBg: [237, 247, 248],
  lime:       [215, 255, 61],   // #D7FF3D — --accent-lime, color de acción de la app
  limeInk:    [11, 12, 16],     // texto oscuro sobre fondo lima (mismo contraste que los botones lima de la app)
  green:      [48, 209, 88],
  greenLight: [234, 251, 240],
  orange:     [255, 149, 0],
  orangeLight:[255, 244, 229],
  yellow:     [255, 214, 10],
  yellowLight:[255, 250, 230],
  red:        [255, 59, 48],
  white:      [255, 255, 255],
}

// ── Fuente de marca (Super Jello) ───────────────────────────────────────────
// jsPDF no trae fuentes personalizadas — hay que registrar el .ttf real como
// VFS + addFont() en cada instancia de jsPDF. Se cachea el base64 tras la
// primera exportación para no volver a descargar/convertir el archivo en
// cada PDF generado dentro de la misma sesión de la app.
let _superJelloBase64Promise = null

async function fetchSuperJelloBase64() {
  if (!_superJelloBase64Promise) {
    _superJelloBase64Promise = fetch(superJelloUrl)
      .then(res => res.arrayBuffer())
      .then(buf => {
        let binary = ''
        const bytes = new Uint8Array(buf)
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        return btoa(binary)
      })
      .catch(err => {
        console.warn('[exportPDF] No se pudo cargar Super Jello, se usa helvetica de reserva:', err.message)
        _superJelloBase64Promise = null // permite reintentar en la próxima exportación
        return null
      })
  }
  return _superJelloBase64Promise
}

// Aplica la fuente de marca al wordmark "Aify" — newDoc() ya la registró en
// el documento si la carga tuvo éxito; si no (offline, bloqueo de red...),
// jsPDF no tiene una fuente "SuperJello" registrada y cae a helvetica en
// negrita sin romper el PDF.
function setFontAify(doc, style = 'bold') {
  try {
    doc.setFont('SuperJello', 'normal')
  } catch {
    doc.setFont('helvetica', style)
  }
}

const NET_COLORS = {
  instagram:  [225, 48, 108],
  tiktok:     [20, 20, 20],
  facebook:   [24, 119, 242],
  youtube:    [255, 0, 0],
  whatsapp:   [37, 211, 102],
  googlemaps: [234, 67, 53],
}
const NET_LABELS = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook',
  youtube: 'YouTube', whatsapp: 'WhatsApp', googlemaps: 'Google Maps',
}

// ── Utility ────────────────────────────────────────────────────────────────────

function netColor(red) {
  return NET_COLORS[(red || '').toLowerCase()] || C.gray
}
function netLabel(red) {
  return NET_LABELS[(red || '').toLowerCase()] || (red || '')
}
function formatDate() {
  return new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}
// Approx line height (mm) for a given font size (pt)
function lh(size) { return size * 0.38 }

// ── Page manager ──────────────────────────────────────────────────────────────

function makePages(doc, clienteNombre) {
  let _y = M
  let _page = 1
  const maxY = A4.h - M - 10

  const pm = {
    get y() { return _y },
    set y(v) { _y = v },
    get maxY() { return maxY },
    get page() { return _page },

    ensureFits(needed) {
      if (_y + needed > maxY) {
        this.newPage()
        return true
      }
      return false
    },

    newPage() {
      doc.addPage()
      _page++
      _y = M + 16
      this._drawHeader()
      this._drawFooter()
    },

    _drawHeader() {
      setFontAify(doc)
      doc.setFontSize(8)
      doc.setTextColor(...C.blue)
      doc.text('Aify', M, 12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...C.lightGray)
      doc.text(clienteNombre || '', A4.w - M, 12, { align: 'right' })
      doc.setDrawColor(...C.line)
      doc.setLineWidth(0.2)
      doc.line(M, 14, A4.w - M, 14)
    },

    _drawFooter(numero = String(_page)) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...C.lightGray)
      doc.text(numero, A4.w / 2, A4.h - 8, { align: 'center' })
      doc.text(`Confidencial · ${clienteNombre || 'Aify'}`, A4.w - M, A4.h - 8, { align: 'right' })
    },

    // Reescribe el pie con "n / total" cuando ya se sabe cuántas páginas hay.
    // Cada página ya dibujó su pie al crearse: se tapa con un rectángulo
    // blanco antes de volver a escribirlo, o los números salen superpuestos.
    finalizeFooters() {
      const total = doc.getNumberOfPages()
      for (let i = 2; i <= total; i++) {
        doc.setPage(i)
        fillRect(doc, 0, A4.h - 12, A4.w, 12, C.white)
        this._drawFooter(`${i} / ${total}`)
      }
    },
  }
  return pm
}

// ── Drawing primitives ────────────────────────────────────────────────────────

function fillRect(doc, x, y, w, h, color) {
  doc.setFillColor(...color)
  doc.rect(x, y, w, h, 'F')
}

function strokeRect(doc, x, y, w, h, color, lineW = 0.3) {
  doc.setDrawColor(...color)
  doc.setLineWidth(lineW)
  doc.rect(x, y, w, h, 'D')
}

function hLine(doc, y, color = C.line, lw = 0.2) {
  doc.setDrawColor(...color)
  doc.setLineWidth(lw)
  doc.line(M, y, A4.w - M, y)
}

// Badge: filled bg + text — returns width used
function badge(doc, x, y, label, bgColor, textColor = C.white, fontSize = 8) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(fontSize)
  doc.setTextColor(...textColor)
  const tw = doc.getTextWidth(label)
  const pad = 3
  const bw = tw + pad * 2
  const bh = lh(fontSize) + 3
  fillRect(doc, x, y - lh(fontSize), bw, bh, bgColor)
  doc.text(label, x + pad, y)
  return bw + 2 // gap
}

// Colored info box (gancho, audio, cta, tip sections)
function infoBox(doc, pm, label, text, bgColor, barColor, fontSize = 10) {
  const textW = CW - 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(fontSize)
  const lines = doc.splitTextToSize(String(text || ''), textW)
  const contentH = lh(10) * 1.15 + lines.length * lh(fontSize) * 1.3 + 12
  pm.ensureFits(contentH + 4)

  const boxY = pm.y
  fillRect(doc, M, boxY, CW, contentH, bgColor)
  fillRect(doc, M, boxY, 3, contentH, barColor)
  strokeRect(doc, M, boxY, CW, contentH, [...barColor, 60], 0.25)

  pm.y = boxY + 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...barColor)
  doc.text(label.toUpperCase(), M + 7, pm.y)
  pm.y += lh(10) * 1.1

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(fontSize)
  doc.setTextColor(...C.black)
  lines.forEach(line => {
    doc.text(line, M + 7, pm.y)
    pm.y += lh(fontSize) * 1.3
  })
  pm.y = boxY + contentH + 6
}

// ── Cover page ────────────────────────────────────────────────────────────────

// Kit de marca del cliente para la portada (cliente.identidadVisual): acento
// = colorPrimario si es un hex válido; logo = data-URL PNG/JPEG. Todo es
// opcional: sin kit, la portada queda exactamente como siempre (azul + lima).
const LOGO_PORTADA_MAX = { w: 40, h: 20 } // mm

function kitMarcaPortada(cliente) {
  const iv = cliente?.identidadVisual || {}
  const primario = hexARgb(iv.colorPrimario)
  // El wordmark "Aify" es nuestra marca y se queda siempre en azul; el color
  // del cliente va en la línea de acento, junto a su logo.
  const logo = typeof iv.logo === 'string' && /^data:image\/(png|jpe?g);base64,/i.test(iv.logo) ? iv.logo : null
  return {
    texto: C.blue,
    linea: primario || C.lime,
    logo,
  }
}

// Dibuja el logo alineado a la derecha, con su parte superior en `top`.
// Devuelve la y inferior del logo, o null si no hay logo o no se pudo dibujar.
function drawLogoCliente(doc, logo, top) {
  if (!logo) return null
  try {
    const formato = /^data:image\/png/i.test(logo) ? 'PNG' : 'JPEG'
    const props = doc.getImageProperties(logo)
    const { ancho, alto } = encajarEnCaja(props.width, props.height, LOGO_PORTADA_MAX.w, LOGO_PORTADA_MAX.h)
    if (!ancho || !alto) return null
    doc.addImage(logo, formato, A4.w - M - ancho, top, ancho, alto)
    return top + alto
  } catch (err) {
    console.warn('[exportPDF] No se pudo dibujar el logo del cliente:', err.message)
    return null
  }
}

function drawCover(doc, cliente, subtitulo, { marca = false } = {}) {
  cliente = cliente || {}
  let y = M + 10
  const kit = marca ? kitMarcaPortada(cliente) : { texto: C.blue, linea: C.lime, logo: null }

  // Logo wordmark
  setFontAify(doc)
  doc.setFontSize(20)
  doc.setTextColor(...kit.texto)
  doc.text('Aify', M, y)

  // Logo del cliente (arriba a la derecha); si es alto, baja la línea de acento
  const logoBottom = drawLogoCliente(doc, kit.logo, M - 2)
  y = Math.max(y + 6, logoBottom != null ? logoBottom + 4 : 0)

  hLine(doc, y, kit.linea, 0.8)
  y += 20

  // Client name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(34)
  doc.setTextColor(...C.ink)
  const nameLines = doc.splitTextToSize(cliente.nombre || 'Cliente', CW)
  nameLines.forEach(line => { doc.text(line, M, y); y += lh(34) * 1.15 })
  y += 4

  // Subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(15)
  doc.setTextColor(...C.gray)
  doc.text(subtitulo, M, y)
  y += lh(15) + 12

  // Sector + location
  const info = [cliente.sector, cliente.ubicacion].filter(Boolean).join(' · ')
  if (info) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.gray)
    doc.text(info, M, y)
    y += lh(11) + 12
  }

  // Network badges
  const redes = cliente.redes || []
  if (redes.length > 0) {
    let bx = M
    redes.forEach(red => {
      const label = netLabel(red)
      const nc = netColor(red)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      const tw = doc.getTextWidth(label)
      const bw = tw + 8; const bh = 6
      // Light tinted background
      doc.setFillColor(nc[0], nc[1], nc[2])
      doc.setGState(doc.GState({ opacity: 0.12 }))
      doc.rect(bx, y - 4, bw, bh, 'F')
      doc.setGState(doc.GState({ opacity: 1 }))
      doc.setTextColor(...nc)
      doc.text(label, bx + 4, y)
      bx += bw + 5
    })
    y += 14
  }

  // Generated line
  y = A4.h - 50
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(...C.lightGray)
  doc.text(`Generado el ${formatDate()}`, M, y)

  // Footer
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...C.lightGray)
  doc.text('Creado con Aify · useaify.app', A4.w / 2, A4.h - 20, { align: 'center' })
}

// ── exportarCalendario ────────────────────────────────────────────────────────

export async function exportarCalendario(cliente, posts, mes, año) {
  if (!cliente) throw new Error('No se pudo exportar: falta información del cliente')
  const doc = await newDoc()
  const mesNombre = MESES[mes] || MESES[0]
  const subtitulo = `Calendario de contenido — ${mesNombre} ${año}`

  // Cover
  drawCover(doc, cliente, subtitulo)

  // Group posts by week (1-7, 8-14, 15-21, 22-28, 29+)
  const weekRanges = [
    { label: `Semana 1 — 1 al 7 de ${mesNombre.toLowerCase()}`, min: 1, max: 7 },
    { label: `Semana 2 — 8 al 14 de ${mesNombre.toLowerCase()}`, min: 8, max: 14 },
    { label: `Semana 3 — 15 al 21 de ${mesNombre.toLowerCase()}`, min: 15, max: 21 },
    { label: `Semana 4 — 22 al 28 de ${mesNombre.toLowerCase()}`, min: 22, max: 28 },
    { label: `Semana 5 — 29 al ${new Date(año, mes + 1, 0).getDate()} de ${mesNombre.toLowerCase()}`, min: 29, max: 31 },
  ]

  const pm = makePages(doc, cliente.nombre)

  for (const week of weekRanges) {
    const weekPosts = (posts || []).filter(p => p.dia >= week.min && p.dia <= week.max)
    if (!weekPosts.length) continue

    // Week header — ensure fits
    pm.ensureFits(24)
    if (pm.page === 1) pm.newPage()

    // Week label
    fillRect(doc, M, pm.y - 5, CW, 10, C.veryLight)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...C.black)
    doc.text(week.label, M + 4, pm.y)
    pm.y += 10

    for (const post of weekPosts) {
      const nc = netColor(post.red)
      const copyLines = doc.splitTextToSize(
        (post.copy || '').replace(/[\u{1F300}-\u{1FFFF}]/gu, '').trim(),
        CW - 10
      )
      const hashLines = doc.splitTextToSize(post.hashtags || '', CW - 10)
      const postH = 6 + 5 + 4 + copyLines.length * lh(10) * 1.3 + (hashLines.length ? hashLines.length * lh(8.5) * 1.2 + 3 : 0) + 12
      pm.ensureFits(postH)

      const blockY = pm.y
      // Left color bar
      fillRect(doc, M, blockY, 3, postH - 4, nc)
      const tx = M + 8

      // Day + date
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...C.black)
      doc.text(`Día ${post.dia}`, tx, pm.y)

      // Network badge inline
      const bLabel = netLabel(post.red)
      const tipo = post.tipo || ''
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...nc)
      doc.text(`${bLabel}${tipo ? ' · ' + tipo : ''}`, tx + 22, pm.y)
      pm.y += 5

      // Hour
      if (post.hora) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...C.gray)
        doc.text(`Hora: ${post.hora}`, tx, pm.y)
        pm.y += 4.5
      }

      // Gancho / hook
      if (post.hooks || post.gancho) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        doc.setTextColor(...C.gray)
        const hookLines = doc.splitTextToSize(`Gancho: ${post.hooks || post.gancho}`, CW - 10)
        hookLines.forEach(l => { doc.text(l, tx, pm.y); pm.y += lh(9) * 1.2 })
      }

      // Copy
      pm.y += 1
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...C.black)
      copyLines.forEach(line => { doc.text(line, tx, pm.y); pm.y += lh(10) * 1.3 })

      // Hashtags
      if (post.hashtags) {
        pm.y += 1
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(...C.gray)
        hashLines.forEach(l => { doc.text(l, tx, pm.y); pm.y += lh(8.5) * 1.2 })
      }

      pm.y += 6
      hLine(doc, pm.y - 2, C.line, 0.15)
    }

    pm.y += 8
  }

  // Summary page
  pm.newPage()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...C.black)
  doc.text('Resumen del mes', M, pm.y)
  pm.y += lh(18) + 6

  hLine(doc, pm.y, C.line)
  pm.y += 8

  // Posts by network
  const byNet = {}
  ;(posts || []).forEach(p => { byNet[p.red] = (byNet[p.red] || 0) + 1 })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...C.black)
  doc.text('Posts por red social', M, pm.y)
  pm.y += lh(11) + 5

  let altRow = false
  Object.entries(byNet).forEach(([red, count]) => {
    if (altRow) fillRect(doc, M, pm.y - lh(10), CW, lh(10) + 3, C.veryLight)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...netColor(red))
    doc.text(netLabel(red), M + 4, pm.y)
    doc.setTextColor(...C.black)
    doc.text(String(count), M + 80, pm.y)
    pm.y += lh(10) + 3
    altRow = !altRow
  })

  pm.y += 8

  // Total
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...C.black)
  doc.text(`Total: ${(posts || []).length} posts`, M, pm.y)
  pm.y += lh(11) + 14

  // AI note
  infoBox(doc, pm, 'Nota', `Este calendario fue generado con IA y adaptado al perfil de ${cliente.nombre}. Revisa los copies antes de publicar y ajusta según el tono habitual de la marca.`, C.blueLight, C.blue)

  const fileName = `calendario-${slugify(cliente.nombre)}-${mesNombre.toLowerCase()}-${año}.pdf`
  doc.save(fileName)
}

// ── exportarCopies ────────────────────────────────────────────────────────────

export async function exportarCopies(cliente, copies, red) {
  if (!cliente) throw new Error('No se pudo exportar: falta información del cliente')
  const doc = await newDoc()
  const redName = netLabel(red)
  const subtitulo = `Copies para ${redName}`

  drawCover(doc, cliente, subtitulo)

  const pm = makePages(doc, cliente.nombre)
  const nc = netColor(red)

  ;(copies || []).forEach((copy, idx) => {
    pm.ensureFits(40)
    if (pm.page === 1) pm.newPage()

    // Variant header
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...C.gray)
    doc.text(`Variante ${idx + 1} de ${copies.length}`, M, pm.y)
    pm.y += lh(11) + 2

    // Network label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...nc)
    doc.text(redName, M, pm.y)
    pm.y += lh(10) + 5

    // Copy box
    const rawCopy = (copy.copy || copy.texto || copy.contenido || String(copy))
      .replace(/[\u{1F300}-\u{1FFFF}]/gu, '').trim()
    const copyLines = doc.splitTextToSize(rawCopy, CW - 10)
    const boxH = copyLines.length * lh(10.5) * 1.3 + 12
    pm.ensureFits(boxH + 4)

    const boxY = pm.y
    fillRect(doc, M, boxY, CW, boxH, C.veryLight)
    fillRect(doc, M, boxY, 4, boxH, nc)

    pm.y = boxY + 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.setTextColor(...C.black)
    copyLines.forEach(line => { doc.text(line, M + 8, pm.y); pm.y += lh(10.5) * 1.3 })
    pm.y = boxY + boxH + 5

    // Hashtags
    if (copy.hashtags) {
      const hashLines = doc.splitTextToSize(copy.hashtags, CW)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...C.gray)
      hashLines.forEach(l => { doc.text(l, M, pm.y); pm.y += lh(9) * 1.2 })
      pm.y += 3
    }

    // Why it works note
    if (copy.nota || copy.porQue) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(...C.gray)
      const notaText = copy.nota || copy.porQue
      const notaLines = doc.splitTextToSize(`Por qué funciona: ${notaText}`, CW)
      notaLines.forEach(l => { doc.text(l, M, pm.y); pm.y += lh(9) * 1.2 })
    }

    pm.y += 6
    hLine(doc, pm.y - 2, C.line, 0.15)
    pm.y += 8
  })

  const fileName = `copies-${slugify(red)}-${slugify(cliente.nombre)}.pdf`
  doc.save(fileName)
}

function drawPlanosTable(doc, pm, planos, carrusel = false) {
  const columns = carrusel ? [
    { label: '#', width: 8, value: (_, index) => String(index + 1) },
    { label: 'Slide', width: 26, value: plano => plano.plano },
    { label: 'Texto', width: 68, value: plano => plano.dice },
    { label: 'Imagen', width: 68, value: plano => plano.visual },
  ] : [
    { label: '#', width: 8, value: (_, index) => String(index + 1) },
    { label: 'Seg.', width: 13, value: plano => plano.segundos },
    { label: 'Plano', width: 25, value: plano => plano.plano },
    { label: 'Qué se ve', width: 62, value: plano => plano.visual },
    { label: 'Qué se dice', width: 62, value: plano => plano.dice },
  ]
  const fontSize = 7.2
  const lineH = lh(fontSize) * 1.25
  const drawHeader = () => {
    pm.ensureFits(10)
    let x = M
    fillRect(doc, M, pm.y, CW, 7, C.blue)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...C.white)
    columns.forEach(column => {
      doc.text(column.label, x + 2, pm.y + 4.5)
      x += column.width
    })
    pm.y += 7
  }

  pm.ensureFits(20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...C.black)
  doc.text('PLANOS', M, pm.y)
  pm.y += lh(11) + 5
  drawHeader()

  planos.forEach((plano, index) => {
    const cellLines = columns.map(column => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(fontSize)
      return doc.splitTextToSize(String(column.value(plano || {}, index) || ''), column.width - 4)
    })
    const maxLines = Math.max(...cellLines.map(lines => lines.length), 1)
    let offset = 0

    while (offset < maxLines) {
      const availableLines = Math.max(1, Math.floor((pm.maxY - pm.y - 3) / lineH))
      if (availableLines < 1 || (pm.y + lineH + 3 > pm.maxY)) {
        pm.newPage()
        drawHeader()
        continue
      }
      const count = Math.min(maxLines - offset, availableLines)
      const rowH = count * lineH + 3
      let x = M
      fillRect(doc, M, pm.y, CW, rowH, index % 2 ? C.veryLight : C.white)
      strokeRect(doc, M, pm.y, CW, rowH, C.line, 0.15)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(fontSize)
      doc.setTextColor(...C.black)
      columns.forEach((column, columnIndex) => {
        const lines = cellLines[columnIndex].slice(offset, offset + count)
        lines.forEach((line, lineIndex) => doc.text(line, x + 2, pm.y + 2.5 + (lineIndex + 1) * lineH))
        if (columnIndex < columns.length - 1) {
          doc.setDrawColor(...C.line)
          doc.line(x + column.width, pm.y, x + column.width, pm.y + rowH)
        }
        x += column.width
      })
      pm.y += rowH
      offset += count
      if (offset < maxLines) {
        pm.newPage()
        drawHeader()
      }
    }
  })
  pm.y += 6
}

// En un carrusel el gancho es la portada y el desarrollo/remate ya están en
// las slides: no se repiten.
function drawGuionBody(doc, pm, guion, carrusel = guion?.formato === 'carrusel') {
  const conSlides = carrusel && Array.isArray(guion.planos) && guion.planos.length > 0
  // LA HISTORIA EN 5 LÍNEAS (solo los guiones que la traen)
  const historia = normalizarHistoria(guion.historia)
  if (historia) {
    const texto = CAMPOS_HISTORIA.map(({ key, label }, i) => `${i + 1}. ${label}: ${historia[key]}`).join('\n')
    infoBox(doc, pm, 'La historia en 5 líneas', texto, C.veryLight, C.gray, 10)
    pm.y += 2
  }

  // HOOK
  if (guion.gancho) {
    infoBox(doc, pm, carrusel ? 'Portada' : 'Gancho', guion.gancho, C.blueLight, C.blue, 11)
    pm.y += 2
  }

  // PROBLEMA
  if (guion.problema?.texto) {
    infoBox(doc, pm, 'Problema', guion.problema.texto, C.veryLight, C.gray, 10)
    pm.y += 2
  }

  // PROMESA
  if (guion.promesa?.texto) {
    infoBox(doc, pm, 'Promesa', guion.promesa.texto, C.blueLight, C.blueMid, 10)
    pm.y += 2
  }

  // DESARROLLO — numbered list of script lines (not a production scene table:
  // real guiones are a sequence of frases, not escena/descripcion/duracion rows)
  const frases = conSlides ? [] : (guion.contenido?.frases || [])
  if (frases.length) {
    pm.ensureFits(20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...C.black)
    doc.text('Desarrollo', M, pm.y)
    pm.y += lh(11) + 6

    frases.forEach((frase, i) => {
      const textW = CW - 14
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10.5)
      const lines = doc.splitTextToSize(String(frase || ''), textW)
      const rowH = lines.length * lh(10.5) * 1.3 + 4
      pm.ensureFits(rowH)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      doc.setTextColor(...C.blue)
      doc.text(`${i + 1}.`, M, pm.y)

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.black)
      lines.forEach((l, li) => doc.text(l, M + 8, pm.y + li * lh(10.5) * 1.3))

      pm.y += rowH
    })
    pm.y += 6
  }

  if (guion.contenido?.loopAbierto) {
    infoBox(doc, pm, 'Loop abierto', guion.contenido.loopAbierto, C.yellowLight, [180, 140, 0])
    pm.y += 2
  }
  if (guion.cierre?.remate && !conSlides) {
    infoBox(doc, pm, 'Remate', guion.cierre.remate, C.veryLight, C.gray, 10)
    pm.y += 2
  }
  if (guion.cierre?.cta) {
    // Fondo lima sólido (no un tinte suave) con texto en tinta oscura — el
    // mismo tratamiento que los botones de acción lima del resto de la app,
    // para que el CTA sea inconfundiblemente "la" llamada a la acción.
    infoBox(doc, pm, 'Call to action', guion.cierre.cta, C.lime, C.limeInk)
    pm.y += 2
  }
  if (guion.audio_sugerido) {
    infoBox(doc, pm, 'Audio sugerido', guion.audio_sugerido, C.skyLightBg, C.blueMid)
    pm.y += 2
  }
  if (guion.tip_viral) infoBox(doc, pm, 'Tip Viral', guion.tip_viral, C.yellowLight, [180, 140, 0])
  if (Array.isArray(guion.planos) && guion.planos.length) drawPlanosTable(doc, pm, guion.planos, carrusel)
}

// ── exportarGuion ─────────────────────────────────────────────────────────────
// `guion` is the raw AI-generated shape produced by generarGuion() in services/ai.js
// and stored as-is on idea.guion / post.guion:
//   { gancho, problema:{texto,segundos}, promesa:{texto,segundos},
//     contenido:{frases:[],loopAbierto,segundos}, cierre:{remate,cta,segundos},
//     duracion_total, tip_viral, audio_sugerido }
// There is no `desarrollo` scene/duration table in real guiones — the "desarrollo"
// section below is the numbered list of `contenido.frases`, which is what a real
// script actually contains. Callers holding PanelDesarrollar's flat editable shape
// (shapeAAEditable) should convert back with editableAShapeA() before calling this.
// `titulo` is passed separately since the title lives on the idea/post that owns
// the guión, not on the guión object itself.
export async function exportarGuion(cliente, guion, titulo) {
  if (!cliente) throw new Error('No se pudo exportar: falta información del cliente')
  guion = guion || {}
  const doc = await newDoc()
  const tema = titulo || 'Guion Viral'
  const subtitulo = `Guion Viral — ${tema}`

  drawCover(doc, cliente, subtitulo, { marca: true })

  const pm = makePages(doc, cliente.nombre)
  pm.newPage()

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...C.black)
  const tLines = doc.splitTextToSize(tema, CW)
  tLines.forEach(l => { doc.text(l, M, pm.y); pm.y += lh(18) * 1.2 })

  if (guion.duracion_total) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...C.gray)
    doc.text(`Duración estimada: ${guion.duracion_total}`, M, pm.y)
    pm.y += lh(10) + 6
  }

  hLine(doc, pm.y, C.line)
  pm.y += 10

  drawGuionBody(doc, pm, guion)

  const fileName = `guion-${slugify(tema)}-${slugify(cliente.nombre)}.pdf`
  doc.save(fileName)
}

export async function exportarGuionesMes(cliente, posts, mes, año) {
  if (!cliente) throw new Error('No se pudo exportar: falta información del cliente')
  const doc = await newDoc()
  const mesNombre = MESES[mes] || MESES[0]
  const guiones = (posts || []).filter(post => post.guion)
  drawCover(doc, cliente, `Guiones de ${mesNombre} ${año}`, { marca: true })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...C.gray)
  doc.text(`${guiones.length} ${guiones.length === 1 ? 'guion incluido' : 'guiones incluidos'}`, M, A4.h - 65)

  const pm = makePages(doc, cliente.nombre)
  guiones.forEach(post => {
    pm.newPage()
    const [, month, day] = String(post.fecha || '').split('-').map(Number)
    const fecha = day && month ? `${day} de ${(MESES[month - 1] || '').toLowerCase()}` : `Día ${post.dia || ''}`
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...C.blue)
    doc.text(fecha, M, pm.y)
    pm.y += lh(11) + 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...C.black)
    const titleLines = doc.splitTextToSize(String(post.titulo || 'Guion Viral'), CW)
    titleLines.forEach(line => { doc.text(line, M, pm.y); pm.y += lh(18) * 1.2 })
    pm.y += 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...C.gray)
    doc.text([post.formato, netLabel(post.red)].filter(Boolean).join(' · '), M, pm.y)
    pm.y += lh(9.5) + 5
    const approval = post.aprobacionEstado === 'aprobado'
      ? ['Aprobado', C.green]
      : post.aprobacionEstado === 'cambios'
        ? ['Cambios pedidos', C.orange]
        : ['Pendiente de aprobar', C.gray]
    badge(doc, M, pm.y, approval[0], approval[1])
    pm.y += lh(8) + 7
    if (post.aprobacionComentario) {
      infoBox(doc, pm, 'Comentario del cliente', post.aprobacionComentario, C.veryLight, C.gray, 9.5)
      pm.y += 2
    }
    if (post.guion?.duracion_total) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...C.gray)
      doc.text(esCarrusel(post) ? `Carrusel de ${post.guion.duracion_total}` : `Duración estimada: ${post.guion.duracion_total}`, M, pm.y)
      pm.y += lh(10) + 6
    }
    hLine(doc, pm.y, C.line)
    pm.y += 10
    drawGuionBody(doc, pm, post.guion, esCarrusel(post))
  })
  pm.finalizeFooters()
  doc.save(`guiones-${slugify(cliente.nombre)}-${slugify(mesNombre)}-${año}.pdf`)
}

// ── exportarHojaRodaje ────────────────────────────────────────────────────────
// Hoja para el día de rodaje: todos los planos del mes agrupados por tipo de
// plano (ver utils/hojaRodaje.js → agruparPlanos). `grupos` es
// [{ tipo, planos: [{ postId, titulo, fecha, segundos, visual, dice, grabado }] }].

function fechaCortaPDF(iso) {
  const [, month, day] = String(iso || '').split('-').map(Number)
  return day && month ? `${day} ${(MESES[month - 1] || '').slice(0, 3).toLowerCase()}` : ''
}

function drawRodajeGrupo(doc, pm, grupo, carrusel = false) {
  const columns = carrusel ? [
    { label: '', width: 8, value: () => '' },
    { label: 'Slide', width: 26, bold: true, value: p => p.titulo },
    { label: 'Imagen (foto que hacer)', width: 78, value: p => p.visual },
    { label: 'Texto', width: 58, value: p => p.dice },
  ] : [
    { label: '', width: 8, value: () => '' },
    { label: 'Vídeo', width: 34, bold: true, value: p => [p.titulo, fechaCortaPDF(p.fecha)].filter(Boolean).join(' · ') },
    { label: 'Seg.', width: 11, value: p => (p.segundos !== '' && p.segundos != null ? `${p.segundos}s` : '') },
    { label: 'Se ve', width: 58, value: p => p.visual },
    { label: 'Se dice', width: 59, value: p => (p.dice ? `“${p.dice}”` : '') },
  ]
  const fontSize = 7.2
  const lineH = lh(fontSize) * 1.25
  const drawHeader = () => {
    pm.ensureFits(10)
    let x = M
    fillRect(doc, M, pm.y, CW, 7, C.blue)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...C.white)
    columns.forEach(column => {
      doc.text(column.label, x + 2, pm.y + 4.5)
      x += column.width
    })
    pm.y += 7
  }
  const checkbox = (x, y, marcado) => {
    strokeRect(doc, x + 2, y, 3.6, 3.6, C.gray, 0.3)
    if (marcado) {
      doc.setDrawColor(...C.blue)
      doc.setLineWidth(0.5)
      doc.line(x + 2.7, y + 1.9, x + 3.6, y + 2.9)
      doc.line(x + 3.6, y + 2.9, x + 5, y + 0.8)
    }
  }

  // Título del grupo + cabecera + una fila juntos (sin títulos huérfanos)
  pm.ensureFits(26)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...C.black)
  doc.text(grupo.tipo, M, pm.y)
  const tw = doc.getTextWidth(grupo.tipo)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...C.gray)
  const n = grupo.planos.length
  doc.text(carrusel ? `${n} ${n === 1 ? 'slide' : 'slides'}` : `${n} ${n === 1 ? 'plano' : 'planos'}`, M + tw + 4, pm.y)
  pm.y += lh(12) + 4
  drawHeader()

  grupo.planos.forEach((plano, index) => {
    const cellLines = columns.map(column => {
      doc.setFont('helvetica', column.bold ? 'bold' : 'normal')
      doc.setFontSize(fontSize)
      return doc.splitTextToSize(String(column.value(plano || {}) || ''), column.width - 4)
    })
    const maxLines = Math.max(...cellLines.map(lines => lines.length), 1)
    let offset = 0

    while (offset < maxLines) {
      if (pm.y + lineH + 3 > pm.maxY) {
        pm.newPage()
        drawHeader()
        continue
      }
      const availableLines = Math.max(1, Math.floor((pm.maxY - pm.y - 3) / lineH))
      const count = Math.min(maxLines - offset, availableLines)
      const rowH = count * lineH + 3
      let x = M
      fillRect(doc, M, pm.y, CW, rowH, index % 2 ? C.veryLight : C.white)
      strokeRect(doc, M, pm.y, CW, rowH, C.line, 0.15)
      doc.setFontSize(fontSize)
      columns.forEach((column, columnIndex) => {
        if (columnIndex === 0 && offset === 0) checkbox(x, pm.y + 1.6, plano.grabado)
        doc.setFont('helvetica', column.bold ? 'bold' : 'normal')
        doc.setTextColor(...C.black)
        const lines = cellLines[columnIndex].slice(offset, offset + count)
        lines.forEach((line, lineIndex) => doc.text(line, x + 2, pm.y + 2.5 + (lineIndex + 1) * lineH))
        if (columnIndex < columns.length - 1) {
          doc.setDrawColor(...C.line)
          doc.setLineWidth(0.15)
          doc.line(x + column.width, pm.y, x + column.width, pm.y + rowH)
        }
        x += column.width
      })
      pm.y += rowH
      offset += count
      if (offset < maxLines) {
        pm.newPage()
        drawHeader()
      }
    }
  })
  pm.y += 10
}

// `carruseles` (opcional): un grupo por carrusel (utils/hojaRodaje.js →
// agruparCarruseles), en su propia sección después de los vídeos.
export async function exportarHojaRodaje(cliente, grupos, mes, año, notas, carruseles = []) {
  if (!cliente) throw new Error('No se pudo exportar: falta información del cliente')
  grupos = (grupos || []).filter(g => g.planos?.length)
  carruseles = (carruseles || []).filter(g => g.planos?.length)
  const totalSlides = carruseles.reduce((s, g) => s + g.planos.length, 0)
  const doc = await newDoc()
  const mesNombre = MESES[mes] || MESES[0]
  const titulo = `Hoja de rodaje — ${mesNombre.toLowerCase()} ${año}`
  const totalPlanos = grupos.reduce((s, g) => s + g.planos.length, 0)
  const totalVideos = new Set(grupos.flatMap(g => g.planos.map(p => p.postId ?? p.titulo))).size

  drawCover(doc, cliente, titulo, { marca: true })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...C.gray)
  doc.text(
    `${totalPlanos} ${totalPlanos === 1 ? 'plano' : 'planos'} de ${totalVideos} ${totalVideos === 1 ? 'vídeo' : 'vídeos'}`
      + (carruseles.length ? ` · ${totalSlides} ${totalSlides === 1 ? 'slide' : 'slides'} de ${carruseles.length} ${carruseles.length === 1 ? 'carrusel' : 'carruseles'}` : ''),
    M, A4.h - 65,
  )

  const pm = makePages(doc, cliente.nombre)
  pm.newPage()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...C.black)
  doc.text(titulo, M, pm.y)
  pm.y += lh(18) + 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...C.gray)
  doc.text('Vídeos: planos agrupados por tipo para grabarlos seguidos. Carruseles: las fotos de cada slide.', M, pm.y)
  pm.y += lh(9.5) + 6

  if (String(notas || '').trim()) {
    infoBox(doc, pm, 'Material y notas del día', String(notas).trim(), C.veryLight, C.blue, 10)
    pm.y += 2
  }
  hLine(doc, pm.y, C.line)
  pm.y += 10

  const seccion = (texto) => {
    pm.ensureFits(30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...C.blue)
    doc.text(texto, M, pm.y)
    pm.y += lh(15) + 6
  }
  if (grupos.length) {
    if (carruseles.length) seccion('Vídeos')
    grupos.forEach(grupo => drawRodajeGrupo(doc, pm, grupo))
  }
  if (carruseles.length) {
    seccion('Carruseles')
    carruseles.forEach(grupo => drawRodajeGrupo(doc, pm, grupo, true))
  }

  pm.finalizeFooters()
  doc.save(`hoja-rodaje-${slugify(cliente.nombre)}-${slugify(mesNombre)}-${año}.pdf`)
}

// ── exportarPostGoogleMaps ────────────────────────────────────────────────────

export async function exportarPostGoogleMaps(cliente, post) {
  if (!cliente) throw new Error('No se pudo exportar: falta información del cliente')
  const doc = await newDoc()
  const subtitulo = 'Post Google Maps SEO'

  drawCover(doc, cliente, subtitulo)

  const pm = makePages(doc, cliente.nombre)
  pm.newPage()

  // Title
  if (post.titulo) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...C.black)
    const tLines = doc.splitTextToSize(post.titulo, CW)
    tLines.forEach(l => { doc.text(l, M, pm.y); pm.y += lh(16) * 1.2 })
    pm.y += 4
  }

  // Type badge
  if (post.tipo || post.categoria) {
    badge(doc, M, pm.y, post.tipo || post.categoria, NET_COLORS.googlemaps)
    pm.y += lh(8) + 8
  }

  hLine(doc, pm.y, C.line)
  pm.y += 8

  // Description
  if (post.descripcion || post.copy || post.contenido) {
    const desc = post.descripcion || post.copy || post.contenido
    infoBox(doc, pm, 'Descripción del post', desc.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').trim(), C.veryLight, C.gray, 10.5)
    pm.y += 4
  }

  // CTA
  if (post.cta) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...C.gray)
    doc.text('Call to action:', M, pm.y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.black)
    doc.text(post.cta, M + 32, pm.y)
    pm.y += lh(10) + 8
  }

  // Keywords
  const keywords = post.keywords || post.palabrasClave || post.hashtags
  if (keywords) {
    pm.ensureFits(30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...C.black)
    doc.text('Keywords y hashtags', M, pm.y)
    pm.y += lh(11) + 5

    const kws = typeof keywords === 'string'
      ? keywords.split(/[,\s]+/).filter(Boolean)
      : keywords

    let kx = M
    kws.forEach(kw => {
      const cleaned = kw.replace(/^#/, '')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const tw = doc.getTextWidth(`#${cleaned}`)
      const bw = tw + 8
      if (kx + bw > A4.w - M) { kx = M; pm.y += lh(9) + 5 }
      fillRect(doc, kx, pm.y - lh(9), bw, lh(9) + 3, C.blueLight)
      doc.setTextColor(...C.blue)
      doc.text(`#${cleaned}`, kx + 4, pm.y)
      kx += bw + 4
    })
    pm.y += lh(9) + 12
  }

  // SEO score
  const score = post.seoScore || post.seScore || post.puntuacion
  if (score !== undefined) {
    pm.ensureFits(24)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...C.black)
    doc.text('Puntuación SEO estimada', M, pm.y)
    pm.y += lh(11) + 4

    const barW = CW
    const barH = 6
    fillRect(doc, M, pm.y, barW, barH, C.veryLight)
    const scoreVal = Math.min(Math.max(Number(score) / 100, 0), 1)
    const scoreColor = scoreVal >= 0.75 ? C.green : scoreVal >= 0.5 ? C.orange : C.red
    fillRect(doc, M, pm.y, barW * scoreVal, barH, scoreColor)
    strokeRect(doc, M, pm.y, barW, barH, C.line, 0.2)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...scoreColor)
    doc.text(`${score}/100`, M + barW + 3, pm.y + barH - 1)
    pm.y += barH + 8
  }

  // Suggestions
  const sugerencias = post.mejoras || post.sugerencias || post.recomendaciones
  if (sugerencias?.length) {
    pm.ensureFits(20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...C.black)
    doc.text('Mejoras sugeridas', M, pm.y)
    pm.y += lh(11) + 5

    sugerencias.forEach((s, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${s}`, CW - 6)
      pm.ensureFits(lines.length * lh(10) * 1.3 + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...C.black)
      lines.forEach(l => { doc.text(l, M, pm.y); pm.y += lh(10) * 1.3 })
      pm.y += 2
    })
  }

  const fileName = `googlemaps-${slugify(cliente.nombre)}.pdf`
  doc.save(fileName)
}

// ── exportarFactura / exportarPresupuesto ─────────────────────────────────────
// Single-page documents — deliberately skip drawCover() (which assumes it owns
// page 1 as a title page). Writing starts directly at pm.y on the implicit
// first page; calling pm.newPage() first would leave a blank leading page.

const ESTADO_FACTURA_COLOR = {
  pendiente: C.orange, pagada: C.green, vencida: C.red, cancelada: C.gray,
}
const ESTADO_PRESUPUESTO_COLOR = {
  borrador: C.gray, enviado: C.blue, firmado: C.green, rechazado: C.red,
}

function formatFechaCorta(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return String(iso) }
}

// Hand-drawn two-column "De:"/"Para:" block — infoBox() is single-column and
// doesn't fit two side-by-side parties. Returns the new pm.y.
function drawPartesBlock(doc, pm, emisor, cliente) {
  const colW = (CW - 10) / 2
  const leftX = M
  const rightX = M + colW + 10

  const emisorLines = [emisor?.nombre, emisor?.nif, emisor?.direccion].filter(Boolean)
  const clienteLines = [cliente?.nombre, cliente?.ubicacion].filter(Boolean)
  const nLines = Math.max(emisorLines.length, clienteLines.length, 1)
  const blockH = 14 + nLines * lh(10) * 1.4 + 10
  pm.ensureFits(blockH + 4)

  const boxY = pm.y
  fillRect(doc, leftX, boxY, colW, blockH, C.veryLight)
  fillRect(doc, rightX, boxY, colW, blockH, C.veryLight)
  strokeRect(doc, leftX, boxY, colW, blockH, C.line, 0.2)
  strokeRect(doc, rightX, boxY, colW, blockH, C.line, 0.2)

  let ly = boxY + 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...C.gray)
  doc.text('DE', leftX + 7, ly)
  doc.text('PARA', rightX + 7, ly)
  ly += lh(9) * 1.3

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...C.black)
  let ely = ly, cly = ly
  emisorLines.forEach((line, i) => {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal')
    doc.text(String(line), leftX + 7, ely)
    ely += lh(10) * 1.4
  })
  clienteLines.forEach((line, i) => {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal')
    doc.text(String(line), rightX + 7, cly)
    cly += lh(10) * 1.4
  })

  pm.y = boxY + blockH + 10
  return pm.y
}

// Line-items table — adapted from exportarGuion's table pattern (black header
// row, zebra body rows, strokeRect per row), with the numeric columns
// right-aligned instead of left-aligned.
function drawItemsTable(doc, pm, items) {
  pm.ensureFits(20)
  const cols = [M, M + 90, M + 118, M + 144] // concepto | cantidad | precio unit. | subtotal
  const colEnds = [M + 90, M + 118, M + 144, M + CW]
  const headers = ['Concepto', 'Cant.', 'Precio unit.', 'Subtotal']

  fillRect(doc, M, pm.y - lh(9), CW, lh(9) + 4, C.black)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...C.white)
  headers.forEach((h, i) => {
    if (i === 0) doc.text(h, cols[i] + 3, pm.y)
    else doc.text(h, colEnds[i] - 3, pm.y, { align: 'right' })
  })
  pm.y += lh(9) + 4

  ;(items || []).forEach((item, ri) => {
    const conceptoLines = doc.splitTextToSize(item.concepto || '', 84)
    const rowH = Math.max(conceptoLines.length, 1) * lh(9) * 1.3 + 5
    pm.ensureFits(rowH)

    if (ri % 2 === 1) fillRect(doc, M, pm.y - lh(9), CW, rowH, C.veryLight)
    strokeRect(doc, M, pm.y - lh(9), CW, rowH, C.line, 0.15)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...C.black)
    conceptoLines.forEach((l, li) => doc.text(l, cols[0] + 3, pm.y + li * lh(9) * 1.3))

    doc.text(String(item.cantidad ?? ''), colEnds[1] - 3, pm.y, { align: 'right' })
    doc.text(`${Number(item.precio_unitario ?? item.precioUnitario ?? 0).toFixed(2)} €`, colEnds[2] - 3, pm.y, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.text(`${Number(item.subtotal ?? 0).toFixed(2)} €`, colEnds[3] - 3, pm.y, { align: 'right' })

    pm.y += rowH
  })
  pm.y += 4
}

// Right-aligned Subtotal / IVA / Total block, following the table.
function drawTotales(doc, pm, { subtotal, ivaPct, iva, total, ivaIncluido }) {
  pm.ensureFits(36)
  const rightEdge = M + CW
  const rowH = lh(10) * 1.6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...C.gray)
  doc.text(ivaIncluido ? 'Base imponible' : 'Subtotal', rightEdge - 70, pm.y, { align: 'left' })
  doc.text(`${Number(subtotal || 0).toFixed(2)} €`, rightEdge, pm.y, { align: 'right' })
  pm.y += rowH

  doc.text(`IVA (${Number(ivaPct || 0)}%)`, rightEdge - 70, pm.y, { align: 'left' })
  doc.text(`${Number(iva || 0).toFixed(2)} €`, rightEdge, pm.y, { align: 'right' })
  pm.y += rowH + 2

  hLine(doc, pm.y - lh(12), C.line, 0.3)
  pm.y += 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...C.black)
  doc.text('Total', rightEdge - 70, pm.y, { align: 'left' })
  doc.text(`${Number(total || 0).toFixed(2)} €`, rightEdge, pm.y, { align: 'right' })
  if (ivaIncluido) {
    pm.y += lh(9) * 1.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...C.gray)
    doc.text('(IVA incluido)', rightEdge - 70, pm.y, { align: 'left' })
  }
  pm.y += lh(13) * 1.8
}

export async function exportarFactura(cliente, factura) {
  if (!cliente) throw new Error('No se pudo exportar: falta información del cliente')
  const doc = await newDoc()
  const pm = makePages(doc, cliente.nombre)

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...C.black)
  doc.text('FACTURA', M, pm.y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...C.gray)
  doc.text(factura.numero || '', M, pm.y + 14)

  const estadoColor = ESTADO_FACTURA_COLOR[factura.estado] || C.gray
  badge(doc, M + CW - 40, pm.y + 4, (factura.estado || '').toUpperCase(), estadoColor)
  pm.y += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...C.gray)
  doc.text(`Fecha de emisión: ${formatFechaCorta(factura.fechaEmision)}`, M, pm.y)
  if (factura.fechaVencimiento) {
    doc.text(`Vencimiento: ${formatFechaCorta(factura.fechaVencimiento)}`, M + CW, pm.y, { align: 'right' })
  }
  pm.y += 12

  drawPartesBlock(doc, pm, factura.emisor, cliente)
  drawItemsTable(doc, pm, factura.items)
  drawTotales(doc, pm, factura)

  if (factura.notas) {
    infoBox(doc, pm, 'Notas', factura.notas, C.veryLight, C.gray, 10)
  }

  pm.finalizeFooters()
  const fileName = `factura-${slugify(factura.numero)}-${slugify(cliente.nombre)}.pdf`
  doc.save(fileName)
}

export async function exportarPresupuesto(cliente, presupuesto) {
  if (!cliente) throw new Error('No se pudo exportar: falta información del cliente')
  const doc = await newDoc()
  const pm = makePages(doc, cliente.nombre)

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...C.black)
  doc.text('PRESUPUESTO', M, pm.y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...C.gray)
  doc.text(presupuesto.numero || '', M, pm.y + 14)

  const estadoColor = ESTADO_PRESUPUESTO_COLOR[presupuesto.estado] || C.gray
  badge(doc, M + CW - 40, pm.y + 4, (presupuesto.estado || '').toUpperCase(), estadoColor)
  pm.y += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...C.gray)
  doc.text(`Fecha de emisión: ${formatFechaCorta(presupuesto.fechaEmision)}`, M, pm.y)
  if (presupuesto.validezHasta) {
    doc.text(`Válido hasta: ${formatFechaCorta(presupuesto.validezHasta)}`, M + CW, pm.y, { align: 'right' })
  }
  pm.y += 12

  drawPartesBlock(doc, pm, presupuesto.emisor, cliente)
  drawItemsTable(doc, pm, presupuesto.items)
  drawTotales(doc, pm, presupuesto)

  if (presupuesto.estado === 'firmado' && presupuesto.firmaDataUrl) {
    pm.ensureFits(42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...C.black)
    doc.text(`Firmado por ${presupuesto.firmanteNombre || ''} el ${formatFechaCorta(presupuesto.firmadoEn)}`, M, pm.y)
    pm.y += 6
    try {
      doc.addImage(presupuesto.firmaDataUrl, 'PNG', M, pm.y, 60, 26)
      pm.y += 32
    } catch {
      // Malformed/empty data URL — skip the image rather than crash the export.
      pm.y += 6
    }
  }

  if (presupuesto.notas) {
    infoBox(doc, pm, 'Notas', presupuesto.notas, C.veryLight, C.gray, 10)
  }

  pm.finalizeFooters()
  const fileName = `presupuesto-${slugify(presupuesto.numero)}-${slugify(cliente.nombre)}.pdf`
  doc.save(fileName)
}

// ── Internal factory ──────────────────────────────────────────────────────────

async function newDoc() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const base64 = await fetchSuperJelloBase64()
  if (base64) {
    doc.addFileToVFS('SuperJello.ttf', base64)
    doc.addFont('SuperJello.ttf', 'SuperJello', 'normal')
  }
  return doc
}

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}
