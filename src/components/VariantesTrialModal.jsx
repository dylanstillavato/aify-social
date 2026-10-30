import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, Sparkles, RefreshCw, Copy, Check, CalendarPlus } from 'lucide-react'
import { generarVariantesTrial } from '../services/ai'
import { crearPost } from '../hooks/useCalendario'
import { useClienteActivo } from '../hooks/useClienteActivo'
import { PREFIJO_TRIAL } from '../utils/trialReels'
import { Aviso, Chip } from './instagramUi'
import { labelStyle, textoSecundario, botonSecundario, botonPrimario, campoStyle } from './instagramEstilos'

// Variantes Trial de un reel publicado que funcionó: 5 versiones del mismo
// vídeo (gancho, texto en pantalla, música, descripción y ajuste visual) para
// volver a subirlo como Trial Reel. Cada variante se puede llevar al
// calendario como post "Trial · ..."; al programarlo, la casilla de Trial Reel
// sale marcada (ver PublicarInstagram).

const CAMPOS = [
  ['gancho', 'Gancho (3 primeros segundos)'],
  ['textoPantalla', 'Texto en pantalla'],
  ['musica', 'Música'],
  ['caption', 'Descripción'],
  ['ajusteVisual', 'Ajuste visual para el editor'],
]

const mañana = () => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function textoVariante(v) {
  return CAMPOS.map(([clave, label]) => `${label}: ${v[clave]}`).join('\n')
}

function BotonCopiar({ texto, etiqueta = 'Copiar' }) {
  const [hecho, setHecho] = useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      setHecho(true)
      setTimeout(() => setHecho(false), 1500)
    } catch { /* sin permiso de portapapeles: no pasa nada */ }
  }
  return (
    <button type="button" onClick={copiar} style={{ ...botonSecundario, padding: '4px 9px', fontSize: 11.5 }} aria-label={`${etiqueta}: ${texto.slice(0, 40)}`}>
      {hecho ? <Check size={12} /> : <Copy size={12} />} {hecho ? 'Copiado' : etiqueta}
    </button>
  )
}

function Variante({ v, i, cliente, publicacion }) {
  const navigate = useNavigate()
  const { setClienteActivoId } = useClienteActivo()
  const [programando, setProgramando] = useState(false)
  const [fecha, setFecha] = useState(mañana())
  const [estado, setEstado] = useState(null) // null | 'guardando' | 'hecho' | { error }

  const llevarAlCalendario = async () => {
    setEstado('guardando')
    const { error } = await crearPost({
      clienteId: cliente.id, fecha, hora: '12:00', red: 'instagram', formato: 'video', estado: 'borrador',
      titulo: `${PREFIJO_TRIAL}${v.gancho}`.slice(0, 200),
      copy: v.caption,
      notas: [
        `Variante Trial del reel ${publicacion?.enlace || ''}`.trim(),
        `Texto en pantalla: ${v.textoPantalla}`,
        `Música: ${v.musica}`,
        `Ajuste visual: ${v.ajusteVisual}`,
      ].join('\n'),
    })
    setEstado(error ? { error: 'No se pudo crear el post en el calendario.' } : 'hecho')
  }

  const abrirCalendario = () => {
    setClienteActivoId(String(cliente.id))
    navigate('/instagram/programar')
  }

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Variante {i + 1}</span>
          {v.tipo && <Chip>{v.tipo}</Chip>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <BotonCopiar texto={textoVariante(v)} etiqueta="Copiar todo" />
          <button type="button" style={{ ...botonSecundario, padding: '4px 9px', fontSize: 11.5 }} onClick={() => setProgramando(p => !p)}>
            <CalendarPlus size={12} /> Programar como Trial
          </button>
        </div>
      </div>

      {CAMPOS.map(([clave, label]) => (
        <div key={clave} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ ...labelStyle, marginBottom: 3 }}>{label}</p>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{v[clave] || '—'}</p>
          </div>
          {v[clave] && <BotonCopiar texto={v[clave]} />}
        </div>
      ))}

      {programando && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {estado === 'hecho' ? (
            <>
              <p style={textoSecundario}>
                Creado en el calendario el {fecha.split('-').reverse().join('/')}. Ábrelo, sube el vídeo editado con esta variante y prográmalo: la casilla «Publicar como Trial Reel» ya sale marcada.
              </p>
              <button type="button" style={{ ...botonPrimario, alignSelf: 'flex-start' }} onClick={abrirCalendario}>Abrir el calendario</button>
            </>
          ) : (
            <>
              <p style={textoSecundario}>Crea un post en el calendario con esta descripción y las notas para el editor.</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" value={fecha} min={mañana()} onChange={e => setFecha(e.target.value)} style={{ ...campoStyle, width: 170 }} aria-label="Día de publicación" />
                <button type="button" style={botonPrimario} onClick={llevarAlCalendario} disabled={estado === 'guardando' || !fecha}>
                  {estado === 'guardando' ? 'Creando...' : 'Llevar al calendario'}
                </button>
              </div>
              {estado?.error && <Aviso tono="error" style={{ marginBottom: 0 }}>{estado.error}</Aviso>}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function VariantesTrialModal({ cliente, publicacion, onClose }) {
  const [fase, setFase] = useState('cargando') // cargando | listo | error
  const [variantes, setVariantes] = useState([])
  const [error, setError] = useState(null)

  const generar = useCallback(async () => {
    setFase('cargando')
    setError(null)
    try {
      setVariantes(await generarVariantesTrial(cliente, publicacion))
      setFase('listo')
    } catch (err) {
      setError(err.message || 'No se pudieron generar las variantes')
      setFase('error')
    }
  }, [cliente, publicacion])

  // Primera tanda al abrir (el estado inicial ya es "cargando").
  useEffect(() => {
    let vivo = true
    generarVariantesTrial(cliente, publicacion)
      .then(v => { if (vivo) { setVariantes(v); setFase('listo') } })
      .catch(err => { if (vivo) { setError(err.message || 'No se pudieron generar las variantes'); setFase('error') } })
    return () => { vivo = false }
  }, [cliente, publicacion])

  useEffect(() => {
    const alPulsar = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [onClose])

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199 }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, pointerEvents: 'none' }}>
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          role="dialog" aria-modal="true" aria-label="Variantes Trial"
          style={{ pointerEvents: 'auto', width: 760, maxWidth: '100%', maxHeight: '100%', background: 'var(--bg-card)', borderRadius: 20, boxShadow: '0 16px 56px rgba(0,0,0,0.24)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="#1D5FE0" /> Variantes Trial
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {publicacion?.texto || 'Reel'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {fase !== 'cargando' && (
                <button type="button" style={botonSecundario} onClick={generar}><RefreshCw size={13} /> Generar otras 5</button>
              )}
              <button onClick={onClose} aria-label="Cerrar"
                style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} color="var(--text-secondary)" />
              </button>
            </div>
          </div>

          <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={textoSecundario}>
              Publícalas como Trial Reel: Instagram las enseña solo a gente que no te sigue. Cambia también color o música al editar para que no cuente como duplicado, y sube una al día.
            </p>
            {fase === 'cargando' && (
              <p style={{ ...textoSecundario, display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Preparando 5 variantes...
              </p>
            )}
            {error && <Aviso tono="error" style={{ marginBottom: 0 }}>{error}</Aviso>}
            {fase === 'listo' && variantes.map((v, i) => (
              <Variante key={`${i}-${v.gancho}`} v={v} i={i} cliente={cliente} publicacion={publicacion} />
            ))}
          </div>
        </motion.div>
      </div>
    </>
  )
}
