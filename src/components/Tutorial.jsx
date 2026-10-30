import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { onboardingKey } from '../utils/onboarding'
import { tutorialKey, dashboardVisitadoKey } from '../utils/tutorial'

const PASOS = [
  { id: 'bienvenida',    tipo: 'modal',     target: null },
  { id: 'clientes',      tipo: 'spotlight', target: '[data-tutorial="clientes"]' },
  { id: 'nuevo_cliente', tipo: 'modal',     target: null },
  { id: 'lluvia',        tipo: 'spotlight', target: '[data-tutorial="lluvia"]' },
  { id: 'guardar',       tipo: 'modal',     target: null },
  { id: 'calendario',    tipo: 'modal',     target: null },
  { id: 'desarrollar',   tipo: 'modal',     target: null },
  { id: 'todo',          tipo: 'spotlight', target: '[data-tutorial="todo"]' },
  { id: 'calendario_general', tipo: 'modal', target: null },
  { id: 'guiones',       tipo: 'spotlight', target: '[data-tutorial="guiones"]' },
  { id: 'final',         tipo: 'modal',     target: null },
]

const CONTENIDO = {
  bienvenida: {
    titulo: 'Bienvenido a Aify',
    texto: 'Aify es tu agencia de contenido con IA. En los próximos pasos te mostramos el flujo principal para que crees contenido de calidad desde el primer día.',
    cta: 'Empezar',
  },
  clientes: {
    titulo: 'Clientes',
    texto: 'Aquí gestionas todos tus clientes. Cada uno tiene su ficha con el proceso del mes: perfil, ideas, calendario, contenido y facturación. También aparecen en la barra lateral, con un botón para añadir uno nuevo. Empieza creando tu primer cliente.',
    cta: 'Siguiente',
    accion: { label: 'Añadir cliente ahora', ruta: '/nuevo-cliente' },
  },
  nuevo_cliente: {
    titulo: 'Crear un cliente',
    texto: 'Rellena el nombre, el sector y las redes de tu cliente, o mándale el formulario para que lo rellene él. Cuanta más información tenga, mejores serán las ideas que genera la IA.',
    cta: 'Siguiente',
  },
  lluvia: {
    titulo: 'Lluvia de ideas',
    texto: 'Elige el tipo de contenido y deja que la IA proponga ideas para el cliente activo. Está en Herramientas, en la barra lateral, y también en el botón Crear.',
    cta: 'Siguiente',
  },
  guardar: {
    titulo: 'Guarda las mejores ideas',
    texto: 'Cuando una idea te guste, pulsa el icono de marcador para guardarla. Las guardadas del mes salen debajo: elige las que quieras y genera todos sus guiones de una vez.',
    cta: 'Siguiente',
  },
  calendario: {
    titulo: 'El calendario de contenido',
    texto: 'En la ficha de cada cliente tienes la pestaña Calendario. Antes de grabar solo está el día de grabación; después de grabar, arrastras cada guion al día en que se publica.',
    cta: 'Siguiente',
  },
  desarrollar: {
    titulo: 'Guiones del mes',
    texto: 'En Contenido, Guiones del mes, revisas los guiones generados con sus planos y se los mandas al cliente para que los apruebe desde el móvil.',
    cta: 'Siguiente',
  },
  todo: {
    titulo: 'Tareas',
    texto: 'Al fijar el día de grabación, cada vídeo aprobado entra como tarea en el tablero, y lo urgente aparece en Inicio. Así no se te pasa ninguna publicación.',
    cta: 'Siguiente',
  },
  calendario_general: {
    titulo: 'Contenido de todos tus clientes',
    texto: 'En Contenido ves todas las piezas del mes de todos tus clientes, de la idea a la publicación, en tablero o en lista. Calendario muestra las mismas piezas por fechas.',
    cta: 'Siguiente',
  },
  guiones: {
    titulo: 'Ideas y guiones',
    texto: 'Organiza las ideas de cada cliente y conviértelas en guiones y copies. Está en Herramientas, en la barra lateral.',
    cta: 'Siguiente',
  },
  final: {
    titulo: 'Ya conoces Aify',
    texto: 'Crea clientes, saca ideas, guarda las que te gusten, genera sus guiones, que el cliente los apruebe, graba, prográmalos en el calendario y cobra desde Dinero. Todo en un mismo sitio. Pulsa Cmd+K cuando quieras crear o buscar algo.',
    cta: 'Crear mi primer cliente',
  },
}

export default function Tutorial() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activo, setActivo] = useState(false)
  const [paso, setPaso] = useState(0)
  const [confirmSaltar, setConfirmSaltar] = useState(false)
  const [highlightRect, setHighlightRect] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!user?.id) return
    try {
      const onboarding = localStorage.getItem(onboardingKey(user.id)) === 'true'
      const completado = localStorage.getItem(tutorialKey(user.id)) === 'true'
      const dashboardVisitado = localStorage.getItem(dashboardVisitadoKey(user.id)) === 'true'
      if (onboarding && !completado && !dashboardVisitado) {
        const timer = setTimeout(() => setActivo(true), 800)
        return () => clearTimeout(timer)
      }
    } catch { /* ignore */ }
  }, [user?.id])

  const pasoCfg = PASOS[paso]

  useEffect(() => {
    if (!activo || pasoCfg?.tipo !== 'spotlight' || !pasoCfg?.target) {
      setHighlightRect(null)
      return
    }
    let reintento = null
    const update = () => {
      const el = document.querySelector(pasoCfg.target)
      if (!el) {
        setHighlightRect(null)
        // El objetivo puede estar dentro del grupo "Herramientas" plegado de
        // la barra lateral: se pide desplegarlo y se reintenta una vez.
        if (!reintento) {
          window.dispatchEvent(new CustomEvent('aify:desplegar-herramientas'))
          reintento = setTimeout(update, 60)
        }
        return
      }
      const rect = el.getBoundingClientRect()
      setHighlightRect(rect)
      const tooltipTop = rect.bottom + 14
      const tooltipLeft = Math.min(rect.left, window.innerWidth - 380)
      setTooltipPos({ top: tooltipTop, left: Math.max(12, tooltipLeft) })
    }
    update()
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      if (reintento) clearTimeout(reintento)
    }
  }, [activo, paso, pasoCfg])

  const completar = () => {
    if (user?.id) {
      try { localStorage.setItem(tutorialKey(user.id), 'true') } catch { /* ignore */ }
    }
    setActivo(false)
    setConfirmSaltar(false)
  }

  const siguiente = () => {
    if (paso >= PASOS.length - 1) {
      completar()
      navigate('/nuevo-cliente')
    } else {
      setPaso(p => p + 1)
    }
  }

  const irARuta = (ruta) => {
    completar()
    navigate(ruta)
  }

  const saltar = () => setConfirmSaltar(true)

  if (!activo) return null

  const contenido = CONTENIDO[pasoCfg.id]
  const esFinal = paso === PASOS.length - 1

  return (
    <>
      {/* Confirm skip dialog */}
      <AnimatePresence>
        {confirmSaltar && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 10100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              style={{ background: '#FFFFFF', borderRadius: 18, padding: '28px 28px 24px', maxWidth: 340, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', margin: '0 0 10px' }}>Seguro que quieres saltar el tutorial?</h3>
              <p style={{ fontSize: 13, color: '#86868B', lineHeight: 1.6, margin: '0 0 20px' }}>Puedes verlo de nuevo desde Configuración en cualquier momento.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmSaltar(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#1D1D1F', fontFamily: 'inherit' }}>
                  Continuar tutorial
                </button>
                <button onClick={completar}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#FF3B30', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                  Saltar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay */}
      {pasoCfg.tipo === 'spotlight' && highlightRect ? (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none' }} />
          <div style={{
            position: 'fixed',
            top: highlightRect.top - 6, left: highlightRect.left - 6,
            width: highlightRect.width + 12, height: highlightRect.height + 12,
            borderRadius: 10,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
            zIndex: 9999, pointerEvents: 'none',
          }} />
          {/* Tooltip */}
          <motion.div
            key={paso} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            style={{ position: 'fixed', top: tooltipPos.top, left: tooltipPos.left, zIndex: 10001, width: 360 }}
          >
            <TutorialCard contenido={contenido} paso={paso} total={PASOS.length} onSaltar={saltar} onSiguiente={siguiente} onAccion={irARuta} esFinal={esFinal} />
          </motion.div>
        </>
      ) : (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
          {/* Centered modal */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <motion.div
              key={paso} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
              style={{ pointerEvents: 'all', width: 400, maxWidth: '92vw' }}
            >
              <TutorialCard contenido={contenido} paso={paso} total={PASOS.length} onSaltar={saltar} onSiguiente={siguiente} onAccion={irARuta} esFinal={esFinal} />
            </motion.div>
          </div>
        </>
      )}
    </>
  )
}

function TutorialCard({ contenido, paso, total, onSaltar, onSiguiente, onAccion, esFinal }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '28px 28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} style={{ width: i === paso ? 16 : 6, height: 6, borderRadius: 3, background: i === paso ? '#1D5FE0' : i < paso ? '#1D5FE0' : '#E5E5EA', transition: 'all 0.3s' }} />
          ))}
        </div>
        <span style={{ fontSize: 11, color: '#86868B', fontWeight: 500 }}>Paso {paso + 1} de {total}</span>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1D1D1F', margin: '0 0 10px', letterSpacing: '-0.3px', lineHeight: 1.3 }}>{contenido.titulo}</h2>
      <p style={{ fontSize: 14, color: '#3C3C43', lineHeight: 1.65, margin: '0 0 24px' }}>{contenido.texto}</p>

      {contenido.accion && (
        <button
          onClick={() => onAccion(contenido.accion.ruta)}
          style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'rgba(29,95,224,0.08)', border: '1px solid rgba(29,95,224,0.2)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1D5FE0', fontFamily: 'inherit', marginBottom: 12 }}
        >
          {contenido.accion.label}
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        {!esFinal ? (
          <button onClick={onSaltar}
            style={{ fontSize: 13, color: '#86868B', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 500 }}>
            Saltar tutorial
          </button>
        ) : <div />}
        <button onClick={onSiguiente}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 12, background: '#1D5FE0', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
          {contenido.cta}
          {!esFinal && <ChevronRight size={15} />}
        </button>
      </div>
    </div>
  )
}
