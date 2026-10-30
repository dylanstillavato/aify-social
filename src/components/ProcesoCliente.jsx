import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { useCalendarioMes } from '../hooks/useCalendario'
import { agruparPlanos, claveStorageRodaje } from '../utils/hojaRodaje'
import { PASOS_CLIENTE, esVideo } from '../utils/pasosCliente'
import { getInvestigacion } from '../hooks/useInvestigacion'

// Pasos del "Contenido de <mes>" de la ficha de cliente: las pestañas
// principales (ideas, guiones, grabación, publicar, seguimiento), cada una
// con una descripción fija de para qué sirve y un check verde cuando está
// hecha, calculado a partir de los posts del mes y el progreso de la hoja de
// rodaje. El mes es el que se está viendo (?mes=YYYY-MM) o el actual.
// Pulsar un paso cambia de pestaña dentro de la ficha (nunca navega fuera).
// Los pasos (nombre, orden, ocultos y personalizados) salen del proceso de la
// organización (useProceso, 0029); los personalizados leen su casilla de
// "hecho" de investigaciones.datos.pasos del mes.

// Planos marcados como grabados en la hoja de rodaje (localStorage, ver
// HojaRodaje.jsx) o de un vídeo ya grabado (post.grabadoEn, 0036: lo marca
// también el enlace /rodaje). Solo cuentan los que siguen en los guiones.
function progresoRodaje(clienteId, año, mes, videos) {
  let marcados = {}
  try {
    const raw = localStorage.getItem(claveStorageRodaje(clienteId, año, mes))
    const data = raw ? JSON.parse(raw) : null
    if (data && typeof data.marcados === 'object' && data.marcados) marcados = data.marcados
  } catch { /* almacenamiento bloqueado o dato corrupto: sin progreso */ }
  const planos = agruparPlanos(videos).flatMap(g => g.planos)
  const grabados = new Set(videos.filter(v => v.grabadoEn).map(v => String(v.id)))
  return { grabados: planos.filter(p => marcados[p.key] || grabados.has(String(p.postId))).length, total: planos.length }
}

// Debajo de cada paso base, para qué sirve (no un contador: el avance lo
// marca solo el check verde)
const DESCRIPCIONES = {
  ideas: 'Lluvia de ideas',
  guiones: 'Escribir y aprobar',
  grabacion: 'Hoja de rodaje',
  edicion: 'Calendario',
  seguimiento: 'Métricas de Instagram',
}

function calcularPasos({ cliente, posts, cargandoPosts, mes }) {
  let ideas = false, guiones = false, grabacion = false, edicion = false
  if (!cargandoPosts) {
    const total = posts.length
    ideas = total > 0

    const videos = posts.filter(esVideo)
    const conGuion = videos.filter(p => p.guion).length
    const aprobados = videos.filter(p => p.aprobacionEstado === 'aprobado').length
    guiones = videos.length > 0 && conGuion === videos.length && aprobados === videos.length

    const rodaje = progresoRodaje(cliente.id, mes.getFullYear(), mes.getMonth(), videos)
    grabacion = rodaje.grabados > 0 && rodaje.grabados === rodaje.total

    const publicados = posts.filter(p => p.estado === 'publicado').length
    edicion = total > 0 && publicados === total
  }

  const done = { ideas, guiones, grabacion, edicion, seguimiento: false }
  return Object.fromEntries(Object.entries(DESCRIPCIONES).map(([id, estado]) => [id, { estado, done: done[id] }]))
}

// `mes`: un Date dentro del mes que se ve (por defecto, el actual)
export default function ProcesoCliente({ cliente, pasos = PASOS_CLIENTE, mes = new Date(), activeTab, refreshKey, onGoToTab }) {
  const { posts, loading: cargandoPosts, refetch: refetchPosts } = useCalendarioMes(cliente.id, mes.getFullYear(), mes.getMonth(), { incluirSinProgramar: true })

  // Al cambiar de pestaña se vuelve a leer, para reflejar lo que se haya
  // editado en Ideas, Guiones o el calendario (el primer render ya lee solo)
  const primerRender = useRef(true)
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return }
    refetchPosts()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Casillas de los pasos personalizados de este mes (solo si hay alguno)
  const hayPersonalizados = pasos.some(p => p.personalizado)
  const [pasosMes, setPasosMes] = useState({})
  useEffect(() => {
    if (!hayPersonalizados) return undefined
    let vivo = true
    getInvestigacion(cliente.id, mes.getFullYear(), mes.getMonth() + 1).then(({ data }) => {
      if (vivo) setPasosMes(data?.pasos || {})
    })
    return () => { vivo = false }
  }, [cliente.id, hayPersonalizados, refreshKey, mes.getFullYear(), mes.getMonth()]) // eslint-disable-line react-hooks/exhaustive-deps

  const estados = calcularPasos({ cliente, posts: posts || [], cargandoPosts, mes })
  for (const p of pasos) {
    if (p.personalizado) estados[p.id] = pasosMes[p.id]?.hecho ? { estado: 'Hecho', done: true } : { estado: 'Pendiente', done: false }
  }

  return (
    <div role="tablist" aria-label="Proceso del mes" style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {pasos.map((paso, i) => (
        <PasoProceso
          key={paso.id}
          n={i + 1}
          label={paso.label}
          activo={activeTab === paso.id}
          {...estados[paso.id]}
          onClick={() => onGoToTab(paso.id)}
        />
      ))}
    </div>
  )
}

function PasoProceso({ n, label, estado, done, tono, activo, onClick }) {
  const colorEstado = tono === 'error' ? '#FF3B30' : done ? '#30D158' : 'var(--text-secondary)'
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px 11px 8px', marginBottom: -1,
        background: 'none', border: 'none',
        borderBottom: activo ? '2px solid #1D5FE0' : '2px solid transparent',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        transition: 'border-color 0.15s',
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700,
        background: done ? '#30D158' : activo ? '#1D5FE0' : 'transparent',
        border: done || activo ? 'none' : '1.5px solid var(--text-tertiary)',
        color: done || activo ? '#fff' : 'var(--text-secondary)',
      }}>
        {done ? <Check size={11} strokeWidth={3} /> : n}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: activo ? '#1D5FE0' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: colorEstado, whiteSpace: 'nowrap' }}>{estado}</span>
      </span>
    </button>
  )
}
