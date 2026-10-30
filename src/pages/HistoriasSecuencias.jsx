import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Sparkles, Trash2, ArrowUp, ArrowDown, Plus, Download, Save, Send, X, FolderOpen } from 'lucide-react'
import CabeceraHerramientaInstagram from '../components/CabeceraHerramientaInstagram'
import { Tarjeta, Aviso, Chip } from '../components/instagramUi'
import { botonPrimario, botonSecundario, textoSecundario, campoStyle, etiquetaCampo } from '../components/instagramEstilos'
import { generarSecuenciaHistorias, PLANTILLAS_HISTORIA, FONDOS_HISTORIA, STICKERS_HISTORIA } from '../services/ai'
import { getPostsCliente, crearPost } from '../hooks/useCalendario'
import { getPublicacionesInstagram, programarPublicacionInstagram } from '../services/instagram'
import { supabase } from '../services/supabase'
import {
  listarSecuencias, guardarSecuencia, borrarSecuencia, prefijoSecuencia, subirArchivo, descargarArchivo,
} from '../services/historiasSecuencias'
import {
  dibujarHistoria, canvasAJpeg, fotoParaIA, cargarFuentes, fuenteDeCliente, paletaDeCliente, FUENTES_HISTORIA,
} from '../utils/historiaRender'

// Herramienta "Secuencias de historias": sube fotos, la IA (que las ve)
// propone una secuencia con la voz y la estética del cliente, Aify la dibuja
// con sus colores, tipografía y logo, y se puede descargar, guardar o
// programar en Instagram (una historia tras otra, con 2 minutos de margen).

const MAX_FOTOS = 10
const NOMBRE_PLANTILLA = { portada: 'Portada', foto_texto: 'Foto + texto', texto: 'Solo texto', cita: 'Cita', cta: 'Llamada a la acción' }
const NOMBRE_FONDO = { primario: 'Color primario', secundario: 'Color secundario', acento: 'Color acento', oscuro: 'Oscuro', claro: 'Claro' }
const NOMBRE_STICKER = { ninguno: 'Sin sticker', encuesta: 'Encuesta', pregunta: 'Pregunta', cuenta_atras: 'Cuenta atrás', enlace: 'Enlace', deslizador: 'Deslizador' }

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function slug(t) {
  return String(t || 'historias').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'historias'
}

// Foto subida → ImageBitmap reducido a 2160 px (de sobra para 1080×1920).
async function prepararFoto(blob) {
  const original = await createImageBitmap(blob)
  const escala = Math.min(1, 2160 / Math.max(original.width, original.height))
  if (escala === 1) return original
  const c = document.createElement('canvas')
  c.width = Math.round(original.width * escala)
  c.height = Math.round(original.height * escala)
  c.getContext('2d').drawImage(original, 0, 0, c.width, c.height)
  original.close?.()
  return createImageBitmap(c)
}

async function bitmapAJpeg(bitmap) {
  const c = document.createElement('canvas')
  c.width = bitmap.width
  c.height = bitmap.height
  c.getContext('2d').drawImage(bitmap, 0, 0)
  return canvasAJpeg(c, 0.9)
}

function Selector({ valor, opciones, nombres, onChange }) {
  return (
    <select value={valor} onChange={e => onChange(e.target.value)} style={{ ...campoStyle, padding: '7px 10px', fontSize: 12 }}>
      {opciones.map(o => <option key={o} value={o}>{nombres[o] || o}</option>)}
    </select>
  )
}

function Secuencias({ cliente }) {
  const iv = useMemo(() => cliente.identidadVisual || {}, [cliente])
  const paleta = useMemo(() => paletaDeCliente(iv), [iv])
  const inputRef = useRef(null)

  const [fotos, setFotos] = useState([]) // [{ id, nombre, bitmap, url, ruta? }]
  const [objetivo, setObjetivo] = useState('')
  const [num, setNum] = useState('')
  const [fuenteId, setFuenteId] = useState(() => fuenteDeCliente(iv))
  const [secuencia, setSecuencia] = useState(null) // { id, titulo, historias }
  const [guardada, setGuardada] = useState(false)
  const [previas, setPrevias] = useState([])
  const [logo, setLogo] = useState(null)
  const [trabajo, setTrabajo] = useState(null) // texto de lo que se está haciendo
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [anteriores, setAnteriores] = useState([])
  const [recientes, setRecientes] = useState([])
  const [ig, setIg] = useState(null)
  const [programar, setProgramar] = useState({ abierto: false, fecha: hoyISO(), hora: '10:00' })

  // Logo del kit de marca
  useEffect(() => {
    if (!iv.logo) return
    const img = new Image()
    img.onload = () => setLogo(img)
    img.src = iv.logo
  }, [iv.logo])

  // Contexto: secuencias anteriores, últimos posts y estado de Instagram
  useEffect(() => {
    let activo = true
    listarSecuencias(cliente.id).then(l => { if (activo) setAnteriores(l) }).catch(() => {})
    getPostsCliente(cliente.id).then(({ data }) => {
      if (activo) setRecientes((data || []).filter(p => p.titulo).slice(0, 10).map(p => p.titulo))
    }).catch(() => {})
    getPublicacionesInstagram(cliente.id).then(d => { if (activo) setIg(d) }).catch(() => {})
    return () => { activo = false }
  }, [cliente.id])

  // Vistas previas: se redibujan al cambiar textos, fotos, fuente o logo
  useEffect(() => {
    if (!secuencia) return
    let activo = true
    cargarFuentes(fuenteId).then(f => {
      if (!activo) return
      const marca = { paleta, fuentes: { titulo: f.titulo, cuerpo: f.cuerpo }, logo }
      const urls = secuencia.historias.map(h => {
        const c = dibujarHistoria(document.createElement('canvas'), h, h.foto !== null ? fotos[h.foto]?.bitmap : null, marca)
        return c.toDataURL('image/jpeg', 0.8)
      })
      setPrevias(urls)
    })
    return () => { activo = false }
  }, [secuencia, fotos, fuenteId, paleta, logo])

  const añadirFotos = async (files) => {
    setError(null)
    const lista = Array.from(files || []).filter(f => f.type.startsWith('image/')).slice(0, MAX_FOTOS - fotos.length)
    if (!lista.length) return
    setTrabajo('Preparando fotos…')
    try {
      const nuevas = await Promise.all(lista.map(async file => ({
        id: crypto.randomUUID(), nombre: file.name, bitmap: await prepararFoto(file), url: URL.createObjectURL(file),
      })))
      setFotos(f => [...f, ...nuevas])
    } catch {
      setError('No se pudo leer alguna foto. Prueba con JPG o PNG.')
    } finally {
      setTrabajo(null)
    }
  }

  const quitarFoto = (i) => {
    setFotos(f => f.filter((_, j) => j !== i))
    if (secuencia) {
      setSecuencia(s => ({
        ...s,
        historias: s.historias.map(h => ({ ...h, foto: h.foto === i ? null : h.foto > i ? h.foto - 1 : h.foto })),
      }))
      setGuardada(false)
    }
  }

  const generar = async () => {
    if (!fotos.length) return setError('Sube al menos una foto.')
    setError(null)
    setAviso(null)
    setTrabajo('La IA está viendo las fotos y escribiendo la secuencia…')
    try {
      const fotosIA = await Promise.all(fotos.map(f => fotoParaIA(f.bitmap)))
      const res = await generarSecuenciaHistorias(cliente, {
        objetivo,
        fotos: fotosIA,
        numHistorias: num ? Number(num) : null,
        anteriores: anteriores.slice(0, 5).map(a => ({ titulo: a.titulo, titulares: (a.historias || []).map(h => h.titular) })),
        postsRecientes: recientes,
      })
      setSecuencia({ id: crypto.randomUUID(), ...res })
      setGuardada(false)
    } catch (err) {
      setError(err.message || 'No se pudo generar la secuencia')
    } finally {
      setTrabajo(null)
    }
  }

  const editar = (i, cambios) => {
    setSecuencia(s => ({ ...s, historias: s.historias.map((h, j) => (j === i ? { ...h, ...cambios } : h)) }))
    setGuardada(false)
  }
  const mover = (i, d) => {
    setSecuencia(s => {
      const hs = [...s.historias]
      const j = i + d
      if (j < 0 || j >= hs.length) return s
      ;[hs[i], hs[j]] = [hs[j], hs[i]]
      return { ...s, historias: hs }
    })
    setGuardada(false)
  }
  const quitar = (i) => { setSecuencia(s => ({ ...s, historias: s.historias.filter((_, j) => j !== i) })); setGuardada(false) }
  const añadirHistoria = () => {
    setSecuencia(s => ({ ...s, historias: [...s.historias, { foto: null, plantilla: 'texto', fondo: 'primario', titular: 'Nuevo titular', texto: '', sticker: { tipo: 'ninguno', texto: '' } }] }))
    setGuardada(false)
  }

  // Historias a tamaño real (1080×1920) en JPEG
  const historiasJpeg = async () => {
    const f = await cargarFuentes(fuenteId)
    const marca = { paleta, fuentes: { titulo: f.titulo, cuerpo: f.cuerpo }, logo }
    return Promise.all(secuencia.historias.map(h =>
      canvasAJpeg(dibujarHistoria(document.createElement('canvas'), h, h.foto !== null ? fotos[h.foto]?.bitmap : null, marca))))
  }

  const descargar = async () => {
    setTrabajo('Preparando descargas…')
    try {
      const blobs = await historiasJpeg()
      blobs.forEach((b, i) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = `${slug(secuencia.titulo)}-${i + 1}.jpg`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setTrabajo(null)
    }
  }

  // Sube fotos originales e historias al bucket y guarda la fila.
  const guardar = async () => {
    if (!supabase) throw new Error('Guardar necesita la base de datos conectada')
    const prefijo = await prefijoSecuencia(cliente.id, secuencia.id)
    const rutasFotos = []
    for (let i = 0; i < fotos.length; i++) {
      setTrabajo(`Guardando fotos (${i + 1} de ${fotos.length})…`)
      rutasFotos[i] = fotos[i].ruta || await subirArchivo(`${prefijo}foto-${fotos[i].id}.jpg`, await bitmapAJpeg(fotos[i].bitmap))
    }
    setFotos(fs => fs.map((f, i) => ({ ...f, ruta: rutasFotos[i] })))
    setTrabajo('Guardando historias…')
    const blobs = await historiasJpeg()
    const historias = []
    for (let i = 0; i < blobs.length; i++) {
      const h = secuencia.historias[i]
      const render = await subirArchivo(`${prefijo}historia-${i + 1}.jpg`, blobs[i])
      historias.push({ ...h, foto_ruta: h.foto !== null ? rutasFotos[h.foto] : null, render_ruta: render })
    }
    await guardarSecuencia({
      id: secuencia.id, clienteId: cliente.id, organizacionId: cliente.organizacionId,
      titulo: secuencia.titulo, objetivo, historias, estilo: { fuenteId },
    })
    setGuardada(true)
    listarSecuencias(cliente.id).then(setAnteriores).catch(() => {})
    return historias
  }

  const accionGuardar = async () => {
    setError(null)
    try {
      await guardar()
      setAviso('Secuencia guardada.')
    } catch (err) {
      setError(err.message)
    } finally {
      setTrabajo(null)
    }
  }

  // Una historia del calendario por cada historia de la secuencia, con 2 min de margen.
  const accionProgramar = async () => {
    setError(null)
    setAviso(null)
    try {
      const historias = await guardar()
      const inicio = new Date(`${programar.fecha}T${programar.hora}:00`)
      if (Number.isNaN(inicio.getTime())) throw new Error('Fecha u hora no válidas')
      for (let i = 0; i < historias.length; i++) {
        setTrabajo(`Programando historia ${i + 1} de ${historias.length}…`)
        const cuando = new Date(inicio.getTime() + i * 2 * 60 * 1000)
        const hora = `${String(cuando.getHours()).padStart(2, '0')}:${String(cuando.getMinutes()).padStart(2, '0')}`
        const fecha = `${cuando.getFullYear()}-${String(cuando.getMonth() + 1).padStart(2, '0')}-${String(cuando.getDate()).padStart(2, '0')}`
        const { data: post, error: errPost } = await crearPost({
          clienteId: cliente.id, fecha, hora, red: 'instagram', formato: 'historia', estado: 'borrador',
          titulo: `${secuencia.titulo} · ${i + 1}/${historias.length}`,
          notas: historias[i].sticker?.tipo && historias[i].sticker.tipo !== 'ninguno'
            ? `Sticker sugerido: ${NOMBRE_STICKER[historias[i].sticker.tipo]}${historias[i].sticker.texto ? ` — ${historias[i].sticker.texto}` : ''}`
            : null,
        })
        if (errPost || !post?.id) throw new Error('No se pudo crear la historia en el calendario')
        await programarPublicacionInstagram(cliente.id, post.id, {
          tipo: 'historia', archivos: [{ ruta: historias[i].render_ruta, tipo: 'imagen' }],
          caption: '', compartirEnFeed: true, publicarEn: cuando.toISOString(),
        })
      }
      setProgramar(p => ({ ...p, abierto: false }))
      setAviso(`Programadas ${historias.length} historias desde el ${inicio.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Las verás en Programar publicaciones y en el calendario.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setTrabajo(null)
    }
  }

  const abrir = async (a) => {
    setError(null)
    setAviso(null)
    setTrabajo('Abriendo la secuencia…')
    try {
      const rutas = [...new Set(a.historias.map(h => h.foto_ruta).filter(Boolean))]
      const nuevas = await Promise.all(rutas.map(async ruta => {
        const blob = await descargarArchivo(ruta)
        return { id: crypto.randomUUID(), nombre: ruta.split('/').pop(), bitmap: await prepararFoto(blob), url: URL.createObjectURL(blob), ruta }
      }))
      setFotos(nuevas)
      setObjetivo(a.objetivo || '')
      if (a.estilo?.fuenteId) setFuenteId(a.estilo.fuenteId)
      setSecuencia({
        id: a.id, titulo: a.titulo,
        historias: a.historias.map(h => ({
          foto: h.foto_ruta ? rutas.indexOf(h.foto_ruta) : null,
          plantilla: h.plantilla, fondo: h.fondo, titular: h.titular, texto: h.texto,
          sticker: h.sticker || { tipo: 'ninguno', texto: '' },
        })),
      })
      setGuardada(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setTrabajo(null)
    }
  }

  const eliminar = async (a) => {
    if (!window.confirm(`¿Borrar la secuencia "${a.titulo}"? Las historias ya programadas no se cancelan.`)) return
    try {
      await borrarSecuencia(a.id)
      setAnteriores(l => l.filter(x => x.id !== a.id))
    } catch (err) {
      setError(err.message)
    }
  }

  const puedeProgramar = ig?.conectado && ig?.permisosOk
  const ocupado = Boolean(trabajo)

  return (
    <>
      {error && <Aviso tono="error">{error}</Aviso>}
      {aviso && <Aviso tono="ok">{aviso}</Aviso>}

      <Tarjeta titulo="1 · Fotos y objetivo">
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); añadirFotos(e.dataTransfer.files) }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {fotos.map((f, i) => (
            <div key={f.id} style={{ position: 'relative', width: 84, height: 112, borderRadius: 10, overflow: 'hidden', background: 'var(--bg-secondary)' }}>
              <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <span style={{ position: 'absolute', left: 5, top: 5, fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 6, padding: '1px 6px' }}>{i + 1}</span>
              <button type="button" aria-label="Quitar foto" onClick={() => quitarFoto(i)} disabled={ocupado}
                style={{ position: 'absolute', right: 4, top: 4, width: 20, height: 20, borderRadius: 10, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                <X size={12} />
              </button>
            </div>
          ))}
          {fotos.length < MAX_FOTOS && (
            <button type="button" onClick={() => inputRef.current?.click()} disabled={ocupado}
              style={{ width: 84, height: 112, borderRadius: 10, border: '1.5px dashed var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, fontFamily: 'inherit' }}>
              <ImagePlus size={18} /> Añadir
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => { añadirFotos(e.target.files); e.target.value = '' }} />
        </div>

        <label style={etiquetaCampo}>¿De qué va la secuencia?</label>
        <textarea value={objetivo} onChange={e => setObjetivo(e.target.value)} rows={2} maxLength={400}
          placeholder="Ej.: presentar el menú de otoño y que pregunten por reservas"
          style={{ ...campoStyle, resize: 'vertical', marginBottom: 12 }} />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={etiquetaCampo}>Historias</label>
            <select value={num} onChange={e => setNum(e.target.value)} style={{ ...campoStyle, width: 'auto' }}>
              <option value="">Las que pida la historia</option>
              {[3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={etiquetaCampo}>Tipografía</label>
            <select value={fuenteId} onChange={e => setFuenteId(e.target.value)} style={{ ...campoStyle, width: 'auto' }}>
              {FUENTES_HISTORIA.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', paddingBottom: 8 }} title="Colores del kit de marca">
            {['primario', 'secundario', 'acento'].map(k => (
              <span key={k} style={{ width: 22, height: 22, borderRadius: 11, background: paleta[k], border: '1px solid rgba(0,0,0,0.1)' }} />
            ))}
          </div>
          <button type="button" onClick={generar} disabled={ocupado || !fotos.length}
            style={{ ...botonPrimario, marginLeft: 'auto', opacity: ocupado || !fotos.length ? 0.6 : 1 }}>
            <Sparkles size={14} /> {secuencia ? 'Crear otra versión' : 'Crear secuencia'}
          </button>
        </div>
        {!iv.colorPrimario && (
          <p style={{ ...textoSecundario, fontSize: 11, marginTop: 10 }}>Este cliente no tiene colores en su kit de marca (Perfil → Kit de marca); se usan colores neutros.</p>
        )}
        {trabajo && <p style={{ ...textoSecundario, marginTop: 12, fontWeight: 600 }}>{trabajo}</p>}
      </Tarjeta>

      {secuencia && (
        <Tarjeta titulo={`2 · ${secuencia.historias.length} historias`} accion={
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" style={botonSecundario} onClick={descargar} disabled={ocupado}><Download size={13} /> Descargar</button>
            <button type="button" style={botonSecundario} onClick={accionGuardar} disabled={ocupado || guardada}><Save size={13} /> {guardada ? 'Guardada' : 'Guardar'}</button>
            <button type="button" style={{ ...botonSecundario, opacity: puedeProgramar ? 1 : 0.5 }} disabled={ocupado || !puedeProgramar}
              title={puedeProgramar ? '' : 'Conecta el Instagram del cliente (con los permisos de publicar) para programar'}
              onClick={() => setProgramar(p => ({ ...p, abierto: !p.abierto }))}>
              <Send size={13} /> Programar en Instagram
            </button>
          </div>
        }>
          <input value={secuencia.titulo} onChange={e => { setSecuencia(s => ({ ...s, titulo: e.target.value })); setGuardada(false) }}
            style={{ ...campoStyle, fontWeight: 600, fontSize: 15, marginBottom: 14 }} aria-label="Nombre de la secuencia" />

          {programar.abierto && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--bg-secondary)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div>
                <label style={etiquetaCampo}>Día</label>
                <input type="date" value={programar.fecha} onChange={e => setProgramar(p => ({ ...p, fecha: e.target.value }))} style={{ ...campoStyle, width: 'auto', background: 'var(--bg-card)' }} />
              </div>
              <div>
                <label style={etiquetaCampo}>Primera historia</label>
                <input type="time" value={programar.hora} onChange={e => setProgramar(p => ({ ...p, hora: e.target.value }))} style={{ ...campoStyle, width: 'auto', background: 'var(--bg-card)' }} />
              </div>
              <button type="button" style={botonPrimario} onClick={accionProgramar} disabled={ocupado}>
                <Send size={13} /> Programar {secuencia.historias.length} historias
              </button>
              <p style={{ ...textoSecundario, fontSize: 11, width: '100%' }}>
                Se publican en orden, una cada 2 minutos. Los stickers (encuesta, pregunta, enlace…) no se pueden poner por API: quedan anotados en cada historia del calendario para añadirlos a mano si quieres.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
            {secuencia.historias.map((h, i) => (
              <div key={i} style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ position: 'relative' }}>
                  {previas[i]
                    ? <img src={previas[i]} alt={`Historia ${i + 1}`} style={{ width: 220, height: 391, borderRadius: 14, objectFit: 'cover', display: 'block', boxShadow: '0 4px 18px rgba(0,0,0,0.12)' }} />
                    : <div style={{ width: 220, height: 391, borderRadius: 14, background: 'var(--bg-secondary)' }} />}
                  <span style={{ position: 'absolute', left: 8, top: 8, fontSize: 11, fontWeight: 700, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 8, padding: '2px 8px' }}>{i + 1}</span>
                </div>
                <input value={h.titular} onChange={e => editar(i, { titular: e.target.value })} placeholder="Titular"
                  style={{ ...campoStyle, padding: '7px 10px', fontSize: 12, fontWeight: 600 }} />
                <textarea value={h.texto} onChange={e => editar(i, { texto: e.target.value })} placeholder="Texto (opcional)" rows={3}
                  style={{ ...campoStyle, padding: '7px 10px', fontSize: 12, resize: 'vertical' }} />
                <Selector valor={h.plantilla} opciones={PLANTILLAS_HISTORIA} nombres={NOMBRE_PLANTILLA} onChange={v => editar(i, { plantilla: v })} />
                <Selector valor={h.fondo} opciones={FONDOS_HISTORIA} nombres={NOMBRE_FONDO} onChange={v => editar(i, { fondo: v })} />
                <select value={h.foto ?? ''} onChange={e => editar(i, { foto: e.target.value === '' ? null : Number(e.target.value) })}
                  style={{ ...campoStyle, padding: '7px 10px', fontSize: 12 }}>
                  <option value="">Sin foto</option>
                  {fotos.map((f, j) => <option key={f.id} value={j}>Foto {j + 1}</option>)}
                </select>
                <Selector valor={h.sticker?.tipo || 'ninguno'} opciones={STICKERS_HISTORIA} nombres={NOMBRE_STICKER}
                  onChange={v => editar(i, { sticker: { ...h.sticker, tipo: v } })} />
                {h.sticker?.tipo && h.sticker.tipo !== 'ninguno' && (
                  <input value={h.sticker.texto || ''} onChange={e => editar(i, { sticker: { ...h.sticker, texto: e.target.value } })}
                    placeholder="Texto del sticker" style={{ ...campoStyle, padding: '7px 10px', fontSize: 12 }} />
                )}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" style={botonSecundario} onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Mover antes"><ArrowUp size={12} /></button>
                  <button type="button" style={botonSecundario} onClick={() => mover(i, 1)} disabled={i === secuencia.historias.length - 1} aria-label="Mover después"><ArrowDown size={12} /></button>
                  <button type="button" style={{ ...botonSecundario, marginLeft: 'auto' }} onClick={() => quitar(i)} aria-label="Quitar historia"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
            <button type="button" onClick={añadirHistoria}
              style={{ flex: '0 0 120px', height: 391, borderRadius: 14, border: '1.5px dashed var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontFamily: 'inherit' }}>
              <Plus size={18} /> Añadir historia
            </button>
          </div>
        </Tarjeta>
      )}

      {anteriores.length > 0 && (
        <Tarjeta titulo="Secuencias anteriores">
          {anteriores.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.titulo}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {new Date(a.creadoEn).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} · {a.historias.length} historias
                  {a.objetivo ? ` · ${a.objetivo.slice(0, 80)}` : ''}
                </div>
              </div>
              {secuencia?.id === a.id && <Chip tono="ok">Abierta</Chip>}
              <button type="button" style={botonSecundario} onClick={() => abrir(a)} disabled={ocupado}><FolderOpen size={12} /> Abrir</button>
              <button type="button" style={botonSecundario} onClick={() => eliminar(a)} disabled={ocupado} aria-label="Borrar secuencia"><Trash2 size={12} /></button>
            </div>
          ))}
        </Tarjeta>
      )}
    </>
  )
}

export default function HistoriasSecuencias() {
  return (
    <CabeceraHerramientaInstagram
      titulo="Secuencias de historias"
      descripcion="Sube fotos y Aify crea una secuencia de historias con la voz, los colores y la tipografía de cada cliente"
      ancho={1180}
    >
      {cliente => <Secuencias key={cliente.id} cliente={cliente} />}
    </CabeceraHerramientaInstagram>
  )
}
