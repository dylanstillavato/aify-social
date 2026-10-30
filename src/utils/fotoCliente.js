// Redimensiona/comprime una foto de cliente en el navegador (sin Supabase Storage):
// recorta al cuadrado más grande centrado (cover, sin deformar), la reduce a `size`x`size`
// y la exporta como data-URL JPEG comprimida, lista para guardar en una columna text.

export function resizeImagenCliente(file, { size = 256, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Selecciona un archivo de imagen válido'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
      img.onload = () => {
        const ladoCorto = Math.min(img.width, img.height)
        const sx = (img.width - ladoCorto) / 2
        const sy = (img.height - ladoCorto) / 2
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, sx, sy, ladoCorto, ladoCorto, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// ── Logo del kit de marca ─────────────────────────────────────────────────────
// Se guarda en cliente.identidadVisual.logo como data-URL (lo lee también el
// portal del cliente). A diferencia de la foto, NO se recorta: se escala para
// que el lado largo mida como mucho `max` px, conservando proporción. PNG/SVG/WebP
// se exportan a PNG (conserva la transparencia); JPEG se queda en JPEG.

export const LOGO_TIPOS_ACEPTADOS = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
export const LOGO_MAX_BYTES = 2 * 1024 * 1024

// Escala (ancho, alto) para que quepa en una caja maxAncho x maxAlto sin
// deformar y sin ampliar nunca. Pura: la usan el logo y los PDF.
export function encajarEnCaja(ancho, alto, maxAncho, maxAlto = maxAncho) {
  if (!(ancho > 0) || !(alto > 0)) return { ancho: 0, alto: 0 }
  const escala = Math.min(1, maxAncho / ancho, maxAlto / alto)
  return { ancho: ancho * escala, alto: alto * escala }
}

export function procesarLogoCliente(file, { max = 512, quality = 0.9 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Selecciona un archivo de imagen'))
      return
    }
    if (!LOGO_TIPOS_ACEPTADOS.includes(file.type)) {
      reject(new Error('Formato no admitido. Usa PNG, JPG, SVG o WebP'))
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      reject(new Error('El logo pesa más de 2 MB. Sube una versión más ligera'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('No se pudo cargar la imagen del logo'))
      img.onload = () => {
        // Un SVG sin width/height puede llegar con tamaño 0: se dibuja a `max`.
        const w0 = img.naturalWidth || img.width || max
        const h0 = img.naturalHeight || img.height || max
        const esSvg = file.type === 'image/svg+xml'
        const escala = esSvg ? max / Math.max(w0, h0) : Math.min(1, max / Math.max(w0, h0))
        const w = Math.max(1, Math.round(w0 * escala))
        const h = Math.max(1, Math.round(h0 * escala))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        const esJpeg = file.type === 'image/jpeg'
        if (esJpeg) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, w, h)
        }
        ctx.drawImage(img, 0, 0, w, h)
        try {
          resolve(esJpeg ? canvas.toDataURL('image/jpeg', quality) : canvas.toDataURL('image/png'))
        } catch {
          reject(new Error('No se pudo procesar el logo'))
        }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
