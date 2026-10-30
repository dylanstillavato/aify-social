// Saca fotogramas de un vídeo (Blob o File) en el navegador para que la IA lo
// "vea": varios en los 3 primeros segundos (el gancho) y el resto repartidos
// hasta el final. Devuelve JPEG en base64 listos para /api/claude-vision.

const MAX_FOTOGRAMAS = 10
const LADO = 640

const ESPERA_MAX_MS = 20000

// Chrome no carga ni decodifica vídeo en pestañas ocultas: si el usuario se
// va a otra pestaña, se sigue cuando vuelve en vez de quedarse colgado.
function pestanaVisible() {
  if (!document.hidden) return Promise.resolve()
  return new Promise(resolve => {
    const alCambiar = () => {
      if (document.hidden) return
      document.removeEventListener('visibilitychange', alCambiar)
      resolve()
    }
    document.addEventListener('visibilitychange', alCambiar)
  })
}

async function esperar(video, evento, accion) {
  await pestanaVisible()
  return new Promise((resolve, reject) => {
    const ok = () => { limpiar(); resolve() }
    const ko = () => { limpiar(); reject(new Error('El navegador no puede leer este vídeo. Prueba con un .mp4 o .mov.')) }
    const tarde = setTimeout(() => {
      limpiar()
      reject(new Error('El vídeo tarda demasiado en cargar. Vuelve a intentarlo sin cambiar de pestaña.'))
    }, ESPERA_MAX_MS)
    const limpiar = () => {
      clearTimeout(tarde)
      video.removeEventListener(evento, ok)
      video.removeEventListener('error', ko)
    }
    video.addEventListener(evento, ok)
    video.addEventListener('error', ko)
    accion?.()
  })
}

// Momentos (en segundos) a capturar según la duración
export function momentosFotogramas(duracion) {
  const fin = Math.max(0, duracion - 0.2)
  if (duracion <= 8) {
    const n = Math.min(8, Math.max(2, Math.round(duracion * 1.5)))
    return Array.from({ length: n }, (_, i) => +(fin * i / (n - 1)).toFixed(2))
  }
  const gancho = [0, 0.8, 1.6, 3]
  const resto = MAX_FOTOGRAMAS - gancho.length
  const desde = 4.5
  const cuerpo = Array.from({ length: resto }, (_, i) => +(desde + (fin - desde) * i / (resto - 1)).toFixed(2))
  return [...gancho, ...cuerpo.filter(t => t > 3.5)]
}

export async function extraerFotogramas(fuente) {
  const url = URL.createObjectURL(fuente)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  try {
    // Hasta loadeddata: con solo los metadatos aún no hay fotograma que pintar
    await esperar(video, 'loadeddata', () => { video.src = url })
    const duracion = Number.isFinite(video.duration) ? video.duration : 0
    if (!duracion || !video.videoWidth) throw new Error('No se pudo leer la duración del vídeo.')

    const escala = Math.min(1, LADO / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * escala)
    canvas.height = Math.round(video.videoHeight * escala)
    const ctx = canvas.getContext('2d')

    const fotogramas = []
    for (const t of momentosFotogramas(duracion)) {
      // 0,05 en vez de 0: así siempre hay un seek real y llega "seeked"
      await esperar(video, 'seeked', () => { video.currentTime = Math.max(0.05, t) })
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
      fotogramas.push({ segundo: t, dataUrl, mediaType: 'image/jpeg', data: dataUrl.split(',')[1] })
    }
    return { duracion, vertical: video.videoHeight > video.videoWidth, fotogramas }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
