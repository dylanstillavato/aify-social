import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Sparkles, RefreshCw, ExternalLink } from 'lucide-react'
import { descargarVideoInstagram } from '../services/instagram'
import { estudiarVideo } from '../services/ai'
import { extraerFotogramas } from '../utils/fotogramasVideo'
import { segundos, porcentaje, vecesLaMedia, tasa, interaccionesDe } from '../utils/metricasInstagram'
import { Aviso, Chip } from './instagramUi'
import { labelStyle, textoSecundario, botonSecundario } from './instagramEstilos'

// Estudio de vídeo con IA. Dos orígenes:
//   publicacion → un reel ya publicado: el backend sirve el mp4, se sacan
//                 fotogramas y la IA los cruza con sus métricas y la media.
//   archivo     → un vídeo del ordenador, antes de publicarlo (sin métricas).
// Se monta solo cuando está abierto. El resultado de un reel se guarda en
// este navegador para no gastar IA cada vez que se abre.
// TikTok no entra aquí: su API no da el archivo del vídeo (solo la portada y
// el enlace), así que no hay fotogramas que estudiar. Un vídeo de TikTok se
// puede estudiar subiéndolo como archivo.

const CLAVE_CACHE = (id) => `aify:estudio-video:${id}`
const FASES = { descargando: 'Descargando el vídeo de Instagram…', fotogramas: 'Sacando fotogramas…', analizando: 'La IA está viendo el vídeo…' }
const TONO_GANCHO = { fuerte: 'ok', medio: 'aviso', 'débil': 'error' }

function leerCache(id) {
  if (!id) return null
  try { return JSON.parse(localStorage.getItem(CLAVE_CACHE(id)) || 'null') } catch { return null }
}

function guardarCache(id, valor) {
  if (!id) return
  try { localStorage.setItem(CLAVE_CACHE(id), JSON.stringify(valor)) } catch { /* sin espacio o bloqueado: no pasa nada */ }
}

function Bloque({ titulo, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={labelStyle}>{titulo}</p>
      {children}
    </div>
  )
}

function Lista({ items }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((t, i) => <li key={i} style={{ ...textoSecundario, color: 'var(--text-primary)' }}>{t}</li>)}
    </ul>
  )
}

// Un dato del reel frente a la media de los reels de la cuenta
function Comparacion({ label, valor, mediaCuenta, formato, menosEsMejor = false }) {
  const veces = vecesLaMedia(valor, mediaCuenta)
  const mejor = veces == null ? null : (menosEsMejor ? veces < 1 : veces > 1)
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formato(valor)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
        media {formato(mediaCuenta)}
        {veces != null && <> · <span style={{ fontWeight: 600, color: mejor ? '#1F7A4D' : '#C4271D' }}>{veces.toLocaleString('es-ES')}×</span></>}
      </div>
    </div>
  )
}

export default function EstudioVideo({ cliente, publicacion = null, archivo = null, mediaReels = null, onClose }) {
  const cacheId = publicacion?.id || null
  const [cache] = useState(() => leerCache(cacheId))
  const [fase, setFase] = useState(cache ? 'listo' : (publicacion ? 'descargando' : 'fotogramas'))
  const [estudio, setEstudio] = useState(cache?.estudio || null)
  const [fotogramas, setFotogramas] = useState([])
  const [duracion, setDuracion] = useState(cache?.duracion ?? null)
  const [error, setError] = useState(null)
  const activo = useRef(true)

  const estudiar = useCallback(async () => {
    setError(null)
    try {
      let fuente = archivo
      if (publicacion) {
        setFase('descargando')
        fuente = await descargarVideoInstagram(cliente.id, publicacion.id)
      }
      if (!activo.current) return
      setFase('fotogramas')
      const video = await extraerFotogramas(fuente)
      if (!activo.current) return
      setFotogramas(video.fotogramas)
      setDuracion(video.duracion)
      setFase('analizando')
      const resultado = await estudiarVideo(cliente, {
        fotogramas: video.fotogramas,
        duracion: video.duracion,
        texto: publicacion?.texto || '',
        metricas: publicacion,
        media: publicacion ? mediaReels : null,
      })
      if (!activo.current) return
      setEstudio(resultado)
      setFase('listo')
      guardarCache(cacheId, { estudio: resultado, duracion: video.duracion, fecha: new Date().toISOString() })
    } catch (err) {
      if (!activo.current) return
      setError(err.message || 'No se pudo estudiar el vídeo.')
      setFase('error')
    }
  }, [archivo, publicacion, cliente, mediaReels, cacheId])

  useEffect(() => {
    activo.current = true
    // Fuera del cuerpo del efecto; en StrictMode el primer montaje lo cancela.
    const t = cache ? null : setTimeout(estudiar, 0)
    return () => { activo.current = false; clearTimeout(t) }
    // Solo al abrir: "Volver a estudiar" lo relanza a mano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const alPulsar = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [onClose])

  const trabajando = Boolean(FASES[fase])
  const titulo = publicacion
    ? (publicacion.planificado?.titulo || publicacion.texto || 'Reel')
    : (archivo?.name || 'Vídeo')
  const subtitulo = publicacion
    ? `Publicado el ${new Date(publicacion.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}${duracion ? ` · ${duracion.toFixed(1)} s` : ''}`
    : `Antes de publicar${duracion ? ` · ${duracion.toFixed(1)} s` : ''}`
  const tasaPub = publicacion ? tasa(interaccionesDe(publicacion), publicacion.alcance) : null

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199 }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, pointerEvents: 'none' }}>
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          role="dialog" aria-modal="true" aria-label="Estudio de vídeo con IA"
          style={{ pointerEvents: 'auto', width: 720, maxWidth: '100%', maxHeight: '100%', background: 'var(--bg-card)', borderRadius: 20, boxShadow: '0 16px 56px rgba(0,0,0,0.24)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="#1D5FE0" /> Estudio de vídeo con IA
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {titulo} · {subtitulo}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {publicacion?.enlace && (
                <a href={publicacion.enlace} target="_blank" rel="noreferrer" style={{ ...botonSecundario, textDecoration: 'none' }}>
                  <ExternalLink size={13} /> Ver
                </a>
              )}
              {(fase === 'listo' || fase === 'error') && (
                <button type="button" style={botonSecundario} onClick={estudiar}>
                  <RefreshCw size={13} /> Volver a estudiar
                </button>
              )}
              <button onClick={onClose} aria-label="Cerrar"
                style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} color="var(--text-secondary)" />
              </button>
            </div>
          </div>

          <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {trabajando && (
              <p style={{ ...textoSecundario, display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> {FASES[fase]}
              </p>
            )}
            {error && <Aviso tono="error" style={{ marginBottom: 0 }}>{error}</Aviso>}

            {fotogramas.length > 0 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                {fotogramas.map((f, i) => (
                  <figure key={i} style={{ margin: 0, flexShrink: 0, textAlign: 'center' }}>
                    <img src={f.dataUrl} alt={`Segundo ${f.segundo}`} style={{ height: 120, borderRadius: 8, display: 'block', border: f.segundo <= 3 ? '2px solid #1D5FE0' : '2px solid transparent' }} />
                    <figcaption style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                      {f.segundo.toLocaleString('es-ES')} s
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}

            {publicacion && mediaReels && publicacion.tipo === 'REEL' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                <Comparacion label="Visualizaciones" valor={publicacion.visualizaciones} mediaCuenta={mediaReels.visualizaciones} formato={v => (v == null ? '—' : Number(v).toLocaleString('es-ES'))} />
                <Comparacion label="Tiempo medio visto" valor={publicacion.vistoMedioMs} mediaCuenta={mediaReels.vistoMedioMs} formato={segundos} />
                <Comparacion label="Lo saltaron" valor={publicacion.saltos} mediaCuenta={mediaReels.saltos} formato={porcentaje} menosEsMejor />
                <Comparacion label="Interacción / alcance" valor={tasaPub} mediaCuenta={mediaReels.tasaInteraccion} formato={porcentaje} />
              </div>
            )}

            {estudio && (
              <>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {estudio.nota != null && (
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--text-primary)', color: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                      aria-label={`Nota ${estudio.nota} sobre 10`}>
                      {estudio.nota}
                    </div>
                  )}
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{estudio.veredicto}</p>
                </div>

                <Bloque titulo="Gancho (primeros 3 segundos)">
                  {estudio.gancho.valoracion && <div><Chip tono={TONO_GANCHO[estudio.gancho.valoracion]}>Gancho {estudio.gancho.valoracion}</Chip></div>}
                  {estudio.gancho.analisis && <p style={{ ...textoSecundario, color: 'var(--text-primary)' }}>{estudio.gancho.analisis}</p>}
                  {estudio.gancho.alternativas.length > 0 && (
                    <>
                      <p style={{ ...textoSecundario, fontSize: 12 }}>Ganchos alternativos:</p>
                      <Lista items={estudio.gancho.alternativas} />
                    </>
                  )}
                </Bloque>
                {estudio.ritmo && <Bloque titulo="Ritmo y retención"><p style={{ ...textoSecundario, color: 'var(--text-primary)' }}>{estudio.ritmo}</p></Bloque>}
                {estudio.visual && <Bloque titulo="Imagen y texto en pantalla"><p style={{ ...textoSecundario, color: 'var(--text-primary)' }}>{estudio.visual}</p></Bloque>}
                {estudio.funciona.length > 0 && <Bloque titulo="Qué funciona"><Lista items={estudio.funciona} /></Bloque>}
                {estudio.mejorar.length > 0 && <Bloque titulo="Qué mejorar"><Lista items={estudio.mejorar} /></Bloque>}
                {estudio.siguienteVideo && (
                  <Bloque titulo="Siguiente vídeo">
                    <p style={{ ...textoSecundario, color: 'var(--text-primary)', background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 10 }}>{estudio.siguienteVideo}</p>
                  </Bloque>
                )}
                {cache && fotogramas.length === 0 && (
                  <p style={{ ...textoSecundario, fontSize: 11 }}>
                    Estudio guardado el {new Date(cache.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}. Pulsa "Volver a estudiar" para repetirlo con los datos de ahora.
                  </p>
                )}
              </>
            )}
            <p style={{ ...textoSecundario, fontSize: 11 }}>
              La IA ve fotogramas del vídeo, no oye el audio.
            </p>
          </div>
        </motion.div>
      </div>
    </>
  )
}
