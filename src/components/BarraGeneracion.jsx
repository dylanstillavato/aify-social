import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Check, AlertCircle, X, ArrowRight } from 'lucide-react'
import { useGeneraciones } from '../hooks/useGeneraciones'
import { useEsMovil, ALTO_BARRA_INFERIOR } from '../hooks/useEsMovil'
import { duracionMedia } from '../utils/duracionGeneraciones'

// Barra fija con las generaciones en marcha (GeneracionesContext), visible en
// cualquier página de la app: abajo a la derecha en escritorio y abajo del
// todo en móvil, por encima de la barra de pestañas (BarraInferiorMovil). Al terminar
// enseña el resumen con «Ver» y se cierra sola a los 10 s.

const CIERRE_AUTOMATICO_MS = 10000

const duracion = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s`
  const m = Math.round(s / 60)
  return `${m} min`
}

// «quedan ~2 min»: media de lo que ha tardado cada elemento × los que faltan.
// Las de un solo paso: lo que lleva y, si ese tipo ya se ha hecho antes, lo
// que suele tardar («lleva 8 s de ~25 s»)
function restante(t, ahora) {
  if (t.indeterminado) {
    const media = duracionMedia(t.tipo)
    return `lleva ${duracion(ahora - t.empezadoEn)}${media ? ` de ~${duracion(media)}` : ''}`
  }
  if (!t.hechos || !t.ultimoAvanceEn) return 'calculando…'
  const media = (t.ultimoAvanceEn - t.empezadoEn) / t.hechos
  const falta = media * (t.total - t.hechos) - (ahora - t.ultimoAvanceEn)
  return falta > 0 ? `quedan ~${duracion(falta)}` : 'terminando…'
}

function FilaTrabajo({ t, ahora, onVer, onQuitar }) {
  const terminado = t.estado !== 'corriendo'
  // Se cierra sola un rato después de terminar
  useEffect(() => {
    if (!terminado) return undefined
    const id = setTimeout(onQuitar, CIERRE_AUTOMATICO_MS)
    return () => clearTimeout(id)
  }, [terminado]) // eslint-disable-line react-hooks/exhaustive-deps

  const fallo = t.estado === 'error' || !!t.resultado?.error
  const pct = t.total ? Math.min(100, (t.hechos / t.total) * 100) : 0
  return (
    <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!terminado
          ? <Sparkles size={14} color="#1D5FE0" style={{ flexShrink: 0 }} />
          : fallo ? <AlertCircle size={14} color="#FF9500" style={{ flexShrink: 0 }} /> : <Check size={14} color="#30D158" style={{ flexShrink: 0 }} />}
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.titulo}
        </span>
        {terminado && (
          <button type="button" onClick={onQuitar} aria-label="Cerrar"
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 8, background: 'var(--bg-secondary)', cursor: 'pointer', flexShrink: 0 }}>
            <X size={13} color="var(--text-secondary)" />
          </button>
        )}
      </div>

      {!terminado ? (
        <>
          <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden', margin: '9px 0 6px', position: 'relative' }}>
            {t.indeterminado
              ? <motion.div animate={{ x: ['-100%', '250%'] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: '#1D5FE0', borderRadius: 3 }} />
              : <motion.div animate={{ width: `${pct}%` }} style={{ height: '100%', background: '#1D5FE0', borderRadius: 3 }} />}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: 'var(--text-secondary)' }}>
            <span>{t.indeterminado ? (t.paso || 'Generando…') : `${t.hechos} de ${t.total}`}</span>
            <span>{restante(t, ahora)}</span>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 6 }}>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0 }}>
            {t.estado === 'error' ? 'No se ha podido terminar' : `Hecho${t.resultado?.texto ? ` · ${t.resultado.texto}` : ''}`}
          </p>
          {(t.error || t.resultado?.error) && (
            <p style={{ fontSize: 12, color: '#FF3B30', margin: '3px 0 0' }}>{t.error || t.resultado.error}</p>
          )}
          {t.resultado?.fallidas?.length > 0 && (
            <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '3px 0 0' }}>No se pudieron hacer: {t.resultado.fallidas.join(' · ')}</p>
          )}
          {t.destino && t.estado === 'hecho' && (
            <button type="button" onClick={onVer}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '7px 12px', minHeight: 32, borderRadius: 9, border: 'none', background: '#D7FF3D', color: '#0B0C10', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              Ver <ArrowRight size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function BarraGeneracion() {
  const { trabajos, quitar } = useGeneraciones()
  const navigate = useNavigate()
  const esMovil = useEsMovil()
  const hayCorriendo = trabajos.some(t => t.estado === 'corriendo')

  // Reloj para el tiempo restante / transcurrido mientras algo corre
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!hayCorriendo) return undefined
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hayCorriendo])

  return (
    <AnimatePresence>
      {trabajos.length > 0 && (
        <motion.div
          key="barra-generacion"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.2 }}
          role="status" aria-live="polite"
          style={{
            position: 'fixed', zIndex: 160,
            ...(esMovil
              ? { left: 12, right: 12, bottom: `calc(${ALTO_BARRA_INFERIOR + 12}px + env(safe-area-inset-bottom))` }
              : { right: 24, bottom: 24, width: 340 }),
            background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.16)', overflow: 'hidden',
          }}
        >
          {hayCorriendo && (
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, padding: '9px 14px 0' }}>
              Sigue aunque cambies de página. Si cierras la pestaña, se corta.
            </p>
          )}
          <div style={{ maxHeight: esMovil ? 220 : 360, overflowY: 'auto', marginTop: hayCorriendo ? 8 : 0 }}>
            {trabajos.map(t => (
              <FilaTrabajo key={t.id} t={t} ahora={ahora}
                onQuitar={() => quitar(t.id)}
                onVer={() => { quitar(t.id); navigate(t.destino.ruta, t.destino.state ? { state: t.destino.state } : undefined) }} />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
