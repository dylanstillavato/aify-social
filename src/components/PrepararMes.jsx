import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Minus, Plus, Mic, MicOff, Sparkles, X, CalendarDays, AlertCircle, Check } from 'lucide-react'
import { TIPOS_PIEZA } from '../utils/formato'
import { fechasClaveDelMes } from '../utils/fechasClave'
import { usePlanMes, inicioMes } from '../hooks/usePlanMes'
import { crearIdea, getIdeas, eliminarIdeaConGuiones } from '../hooks/useIdeas'
import { getPostsCliente } from '../hooks/useCalendario'
import { generarIdeasMes } from '../services/ai'
import { useGeneraciones } from '../hooks/useGeneraciones'

// Paso Ideas = Preparar el mes (#83). Se trabaja a un mes vista: el gestor
// elige cuántas piezas quiere de cada tipo, revisa las fechas importantes y
// cuenta (o dicta) de qué quiere hablar. El plan se guarda solo mientras se
// escribe (planes_mes, 0045) y con él se generan las ideas del mes, ya ligadas
// a su mes y a su tipo. Después se revisan y se guionizan en el paso Guiones.
// La generación corre en GeneracionesContext: sigue aunque se cambie de paso
// o de página, y la barra fija (BarraGeneracion) enseña cómo va.

const isoMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
const nombreMes = (mes) => new Date(`${mes.slice(0, 7)}-01T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
const moverMes = (mes, delta) => { const d = new Date(`${mes.slice(0, 7)}-01T12:00:00`); d.setMonth(d.getMonth() + delta, 1); return isoMes(d) }

// Fechas del cliente para ese mes (generales y propias del perfil)
function fechasDelCliente(cliente, mes) {
  const [anio, m] = mes.split('-').map(Number)
  const porDia = fechasClaveDelMes(cliente?.fechasClaveObj, anio, m - 1)
  return Object.keys(porDia).map(Number).sort((a, b) => a - b)
    .flatMap(dia => porDia[dia].map(f => ({ fecha: `${mes.slice(0, 7)}-${String(dia).padStart(2, '0')}`, nombre: f.label })))
}

const tarjeta = { background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 16px rgba(0,0,0,0.05)', padding: '18px 20px', marginBottom: 14 }
const titulo = { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }
const sub = { fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 14px' }
const redondo = { width: 30, height: 30, borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }
const input = { padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
const botonSuave = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 20, background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'inherit' }

export default function PrepararMes({ cliente, onIrAGuiones }) {
  // Por defecto, el mes siguiente: en octubre se prepara noviembre
  const [mes, setMes] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 1, 1); return isoMes(d) })
  if (!cliente) return null
  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Preparar el mes</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '3px 0 0' }}>Qué piezas quieres, qué fechas importan y de qué hablar. Con eso salen las ideas del mes.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setMes(m => moverMes(m, -1))} style={redondo} aria-label="Mes anterior"><ChevronLeft size={15} /></button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 140, textAlign: 'center', textTransform: 'capitalize' }}>{nombreMes(mes)}</span>
          <button onClick={() => setMes(m => moverMes(m, 1))} style={redondo} aria-label="Mes siguiente"><ChevronRight size={15} /></button>
        </div>
      </div>
      {/* key: al cambiar de cliente o de mes se remonta y carga su plan */}
      <FormularioMes key={`${cliente.id}_${mes}`} cliente={cliente} mes={mes} onIrAGuiones={onIrAGuiones} />
    </div>
  )
}

function FormularioMes({ cliente, mes, onIrAGuiones }) {
  const { plan, cargando, error: errorPlan, guardar } = usePlanMes(cliente, mes)
  // null hasta que el gestor toca algo: mientras, se ve lo cargado (o lo
  // propuesto). Solo se guarda lo que ha editado, así no hay bucles de guardado.
  const [editado, setEditado] = useState(null)
  const datos = editado ?? {
    notas: plan?.notas || '',
    cantidades: plan?.cantidades || {},
    fechas: plan?.fechas?.length ? plan.fechas : fechasDelCliente(cliente, mes),
  }
  const cambiar = (campo, valor) => setEditado(d => ({ ...(d ?? datos), [campo]: typeof valor === 'function' ? valor((d ?? datos)[campo]) : valor }))

  const [guardado, setGuardado] = useState(null) // 'guardando' | 'guardado' | 'error'
  useEffect(() => {
    if (!editado) return
    const t = setTimeout(async () => {
      setGuardado('guardando')
      const { error } = await guardar(editado)
      setGuardado(error ? 'error' : 'guardado')
    }, 700)
    return () => clearTimeout(t)
  }, [editado, guardar])

  const total = TIPOS_PIEZA.reduce((a, t) => a + (Number(datos.cantidades[t.id]) || 0), 0)

  // Dictado del navegador (Chrome/Safari); si no existe, no sale el botón
  const Reconocimiento = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
  const reconRef = useRef(null)
  const [dictando, setDictando] = useState(false)
  const dictar = () => {
    if (dictando) { reconRef.current?.stop(); return }
    const r = new Reconocimiento()
    r.lang = 'es-ES'
    r.continuous = true
    r.onresult = (e) => {
      const texto = Array.from(e.results).slice(e.resultIndex).filter(x => x.isFinal).map(x => x[0].transcript.trim()).join(' ')
      if (texto) cambiar('notas', v => `${v}${v && !/\s$/.test(v) ? ' ' : ''}${texto}`)
    }
    r.onend = () => setDictando(false)
    reconRef.current = r
    r.start()
    setDictando(true)
  }
  useEffect(() => () => reconRef.current?.stop(), [])

  const [aviso, setAviso] = useState(null) // { existentes } cuando ya hay ideas del mes
  const [error, setError] = useState(null)
  // La generación de este cliente y mes, si está en marcha (también si se
  // lanzó, se salió del paso y se ha vuelto)
  const { lanzar, quitar, trabajos } = useGeneraciones()
  const enCurso = trabajos.find(t => t.tipo === 'ideas-mes' && t.clienteId === cliente.id && t.mes === mes && t.estado === 'corriendo')
  const generando = enCurso ? (enCurso.paso || 'Generando...') : null
  const montadoRef = useRef(true)
  useEffect(() => { montadoRef.current = true; return () => { montadoRef.current = false } }, [])

  const generar = async (modo) => {
    if (!total || generando) return
    setError(null)
    if (!modo) {
      const { data: existentes, error: e } = await getIdeas(cliente.id, inicioMes(mes))
      if (e) return setError('No se pudieron leer las ideas de este mes. ¿Está aplicada la migración 0045?')
      if (existentes?.length) return setAviso({ existentes })
    }
    setAviso(null)
    const existentes = aviso?.existentes || []
    const { id, promesa } = lanzar({
      tipo: 'ideas-mes', mes, indeterminado: true, paso: 'Guardando el plan...',
      titulo: `Ideas de ${nombreMes(mes).split(' ')[0]} · ${cliente.nombre}`,
      clienteId: cliente.id,
      destino: { ruta: `/clientes/${cliente.id}?mes=${mes.slice(0, 7)}`, state: { tabInicial: 'guiones' } },
    }, async (avanzar) => {
      const { data: guardadoPlan } = await guardar(datos)
      if (modo === 'reemplazar') {
        // Se quitan las ideas del mes que aún no tienen guion; las guionizadas se quedan
        avanzar(0, 'Quitando las ideas anteriores...')
        const { data: posts } = await getPostsCliente(cliente.id, { incluirSinProgramar: true })
        const conGuion = new Set((posts || []).filter(p => p.origenIdeaId && p.guion).map(p => String(p.origenIdeaId)))
        for (const idea of existentes) {
          if (!conGuion.has(String(idea.id))) await eliminarIdeaConGuiones(cliente.id, idea.id)
        }
      }
      avanzar(0, `Generando ${total} ideas para ${nombreMes(mes)}...`)
      const ideas = await generarIdeasMes({ cliente, mes, notas: datos.notas, fechas: datos.fechas, cantidades: datos.cantidades })
      avanzar(0, 'Guardando las ideas...')
      for (const idea of ideas) {
        const tipo = TIPOS_PIEZA.find(t => t.id === idea.tipoPieza)
        const { error: e } = await crearIdea({
          ...idea, clienteId: cliente.id, formato: tipo?.formato || 'video',
          mes: inicioMes(mes), planMesId: guardadoPlan?.id || null,
        })
        if (e) throw new Error(`No se pudo guardar la idea "${idea.titulo}".`)
      }
      return { texto: `${ideas.length} ${ideas.length === 1 ? 'idea' : 'ideas'}` }
    })
    // Si se sigue en este paso al terminar, se va a Guiones como antes (y la
    // barra no hace falta); si no, la barra avisa y lleva con «Ver»
    const r = await promesa
    if (!montadoRef.current) return
    quitar(id)
    if (r?.error) setError(r.error || 'Algo ha fallado generando las ideas.')
    else onIrAGuiones?.(mes)
  }

  if (cargando) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Cargando el plan de {nombreMes(mes)}...</p>
  }

  return (
    <>
      {/* 1 · Cuántas piezas */}
      <div style={tarjeta}>
        <p style={titulo}>Piezas del mes · {total}</p>
        <p style={sub}>Cuántas quieres de cada tipo.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
          {TIPOS_PIEZA.map(t => {
            const n = Number(datos.cantidades[t.id]) || 0
            const poner = (v) => cambiar('cantidades', c => ({ ...c, [t.id]: Math.max(0, Math.min(40, v)) }))
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: n ? 'rgba(29,95,224,0.06)' : 'var(--bg-secondary)', border: `1px solid ${n ? 'rgba(29,95,224,0.25)' : 'transparent'}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{t.etiqueta}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '1px 0 0' }}>{t.formato === 'carrusel' ? 'Carrusel' : 'Vídeo'}{t.sinTexto ? ' · sin texto' : ''}</p>
                </div>
                <button onClick={() => poner(n - 1)} disabled={!n} style={{ ...redondo, width: 26, height: 26, opacity: n ? 1 : 0.4 }} aria-label={`Quitar ${t.etiqueta}`}><Minus size={12} /></button>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', minWidth: 20, textAlign: 'center' }}>{n}</span>
                <button onClick={() => poner(n + 1)} style={{ ...redondo, width: 26, height: 26 }} aria-label={`Añadir ${t.etiqueta}`}><Plus size={12} /></button>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2 · Fechas importantes */}
      <div style={tarjeta}>
        <p style={titulo}>Fechas importantes</p>
        <p style={sub}>Las del perfil del cliente para este mes. Quita las que no toquen y añade las tuyas.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {datos.fechas.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <CalendarDays size={14} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
              <input type="date" value={f.fecha || ''} min={mes} max={moverMes(mes, 1)}
                onChange={e => cambiar('fechas', fs => fs.map((x, n) => n === i ? { ...x, fecha: e.target.value } : x))} style={input} />
              <input value={f.nombre || ''} placeholder="Qué pasa ese día"
                onChange={e => cambiar('fechas', fs => fs.map((x, n) => n === i ? { ...x, nombre: e.target.value } : x))} style={{ ...input, flex: 1, minWidth: 0 }} />
              <button onClick={() => cambiar('fechas', fs => fs.filter((_, n) => n !== i))} aria-label="Quitar fecha"
                style={{ ...redondo, border: 'none', background: 'rgba(255,59,48,0.08)', color: '#FF3B30' }}><X size={13} /></button>
            </div>
          ))}
          {!datos.fechas.length && <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: 0 }}>No hay fechas este mes.</p>}
        </div>
        <button onClick={() => cambiar('fechas', fs => [...fs, { fecha: mes, nombre: '' }])} style={{ ...botonSuave, marginTop: 10 }}>
          <Plus size={12} /> Añadir fecha
        </button>
      </div>

      {/* 3 · De qué hablar */}
      <div style={tarjeta}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={titulo}>¿De qué quieres hablar este mes?</p>
            <p style={sub}>Temas, novedades, campañas. Por ejemplo: «cenas de empresa, ir hablando de Navidad, la carta nueva».</p>
          </div>
          {Reconocimiento && (
            <button onClick={dictar} style={{ ...botonSuave, background: dictando ? '#FF3B30' : 'var(--bg-secondary)', color: dictando ? 'white' : 'var(--text-primary)' }}>
              {dictando ? <><MicOff size={12} /> Parar</> : <><Mic size={12} /> Dictar</>}
            </button>
          )}
        </div>
        <textarea value={datos.notas} onChange={e => cambiar('notas', e.target.value)} rows={4}
          placeholder="Escribe o dicta de qué quieres que vayan las ideas"
          style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
      </div>

      {/* Generar */}
      {aviso && (
        <div style={{ ...tarjeta, borderColor: 'rgba(255,149,0,0.4)', background: 'rgba(255,149,0,0.06)' }}>
          <p style={{ ...titulo, marginBottom: 10 }}>Ya hay {aviso.existentes.length} {aviso.existentes.length === 1 ? 'idea' : 'ideas'} de {nombreMes(mes)}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => generar('añadir')} style={botonSuave}><Plus size={12} /> Añadir las nuevas</button>
            <button onClick={() => generar('reemplazar')} style={botonSuave}>Reemplazar las que no tienen guion</button>
            <button onClick={() => setAviso(null)} style={{ ...botonSuave, background: 'transparent', color: 'var(--text-secondary)' }}>Cancelar</button>
          </div>
        </div>
      )}
      {(error || errorPlan) && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#FF3B30', margin: '0 0 12px' }}>
          <AlertCircle size={13} /> {error || 'El plan no se ha podido guardar. ¿Está aplicada la migración 0045?'}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <motion.button whileTap={{ scale: total && !generando ? 0.97 : 1 }} onClick={() => generar()} disabled={!total || !!generando || !!aviso}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 12, border: 'none', background: total && !generando ? '#D7FF3D' : 'var(--bg-secondary)', color: total && !generando ? '#0B0C10' : 'var(--text-tertiary)', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: total && !generando ? 'pointer' : 'not-allowed' }}>
          <Sparkles size={15} /> {generando || (total ? `Generar ${total} ${total === 1 ? 'idea' : 'ideas'} para ${nombreMes(mes)}` : 'Elige cuántas piezas quieres')}
        </motion.button>
        {guardado && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: guardado === 'error' ? '#FF3B30' : 'var(--text-tertiary)' }}>
            {guardado === 'guardado' && <Check size={12} />}
            {guardado === 'guardando' ? 'Guardando...' : guardado === 'guardado' ? 'Plan guardado' : 'No se ha guardado'}
          </span>
        )}
      </div>
    </>
  )
}
