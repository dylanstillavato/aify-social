import { Edit3, ExternalLink, Palette, Clapperboard, Sparkles, Check } from 'lucide-react'
import HojaRodaje from './HojaRodaje'
import SeguimientoCliente from './SeguimientoCliente'
import { useInvestigacion } from '../hooks/useInvestigacion'
import { useCalendarioMes } from '../hooks/useCalendario'
import { esVideo, ordenarPorFecha } from '../utils/pasosCliente'

// Vistas de los pasos del proceso mensual de la ficha de cliente que no son
// una página existente incrustada: Investigación (provisional), Grabación,
// Seguimiento (métricas de Instagram, Fase 8) y los pasos personalizados del
// proceso (0029). Ideas, Guiones y Publicar se montan
// directamente en ClienteDetalle.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const tarjeta = {
  background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-subtle)',
  boxShadow: '0 2px 20px rgba(0,0,0,0.06)', padding: '20px 22px', marginBottom: 14,
}

const etiqueta = {
  fontSize: 11, fontWeight: 600, color: '#86868B',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
}

const texto = { fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }

const vacio = { fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }

function Titulo({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, flex: 1 }}>{children}</h3>
      {action}
    </div>
  )
}

function Campo({ label, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 12 }}>
      <div style={etiqueta}>{label}</div>
      {children}
    </div>
  )
}

function BotonTexto({ icon: Icon, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9,
        background: 'rgba(29,95,224,0.08)', color: '#1D5FE0', border: 'none', cursor: 'pointer',
        fontSize: 12, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}>
      {Icon && <Icon size={12} />} {children}
    </button>
  )
}

function Placeholder({ icon: Icon, titulo, children }) {
  return (
    <div style={{ ...tarjeta, background: 'var(--bg-secondary)', boxShadow: 'none', borderStyle: 'dashed', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(29,95,224,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} color="#1D5FE0" />
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{titulo}</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{children}</p>
      </div>
    </div>
  )
}

function ListaVideos({ videos, campoNota, prefijoNota }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {videos.map((v, i) => (
        <div key={`${v.url}_${i}`} style={{ padding: '9px 12px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
          <a href={v.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#1D5FE0', textDecoration: 'none', wordBreak: 'break-all' }}>
            {v.label || v.url} <ExternalLink size={11} style={{ flexShrink: 0 }} />
          </a>
          {v[campoNota] && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0', lineHeight: 1.5 }}>{prefijoNota}{v[campoNota]}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Investigación (provisional) ──────────────────────────────────────────────
// Muestra lo que el onboarding deja de pedir y que vivirá aquí: historial,
// vídeos de referencia e identidad visual. Solo lectura; "Editar" abre la
// edición del perfil y el kit de marca sigue en Perfil.

export function PasoInvestigacion({ cliente, onEditar, onIrAKitMarca }) {
  const historial = cliente.historial || {}
  const hashtags = historial.hashtagsPropio
    ? (Array.isArray(historial.hashtagsPropio) ? historial.hashtagsPropio : String(historial.hashtagsPropio).split(/\s+/)).filter(Boolean)
    : []
  const hayHistorial = !!(historial.queHaFuncionado || historial.mejorPost || hashtags.length || historial.referencias)

  const videosCliente = cliente.videosCliente || []
  const videosReferencia = cliente.videosReferencia || []
  const tv = cliente.textoVideos || {}
  const hayEstiloTexto = !!(tv.posicion || tv.tamano || tv.animaciones?.length || tv.subtitulosAuto)

  const iv = cliente.identidadVisual || {}
  const colores = [
    ['Primario', iv.colorPrimario], ['Secundario', iv.colorSecundario],
    ['Acento', iv.colorAcento], ['Fondo', iv.colorFondo],
  ].filter(([, c]) => c)
  const hayIdentidad = !!(colores.length || iv.estiloTipografia || iv.fuenteEspecifica || iv.estetica?.length || iv.referenciaEstetica)

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, flex: 1, lineHeight: 1.5 }}>
          Lo que sabes de {cliente.nombre} antes de sacar las ideas del mes: qué le ha funcionado, qué vídeos le gustan y su identidad visual.
        </p>
        <BotonTexto icon={Edit3} onClick={onEditar}>Editar</BotonTexto>
      </div>

      <div style={tarjeta}>
        <Titulo>Qué ha funcionado antes</Titulo>
        {hayHistorial ? (
          <>
            {historial.queHaFuncionado && <Campo label="Contenido con más interacción"><p style={texto}>{historial.queHaFuncionado}</p></Campo>}
            {historial.mejorPost && <Campo label="Mejor post o campaña"><p style={texto}>{historial.mejorPost}</p></Campo>}
            {hashtags.length > 0 && (
              <Campo label="Hashtags propios">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {hashtags.map(h => (
                    <code key={h} style={{ fontSize: 12, background: 'rgba(29,95,224,0.08)', color: '#1D5FE0', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace' }}>{h}</code>
                  ))}
                </div>
              </Campo>
            )}
            {historial.referencias && <Campo label="Competidores y referencias" last><p style={texto}>{historial.referencias}</p></Campo>}
          </>
        ) : (
          <p style={vacio}>Sin historial todavía. Pulsa "Editar" para apuntar qué le ha funcionado.</p>
        )}
      </div>

      <div style={tarjeta}>
        <Titulo>Vídeos de referencia</Titulo>
        {videosCliente.length === 0 && videosReferencia.length === 0 && !hayEstiloTexto ? (
          <p style={vacio}>Sin vídeos de referencia todavía.</p>
        ) : (
          <>
            {videosCliente.length > 0 && (
              <Campo label="Sus vídeos que mejor han funcionado">
                <ListaVideos videos={videosCliente} campoNota="motivo" prefijoNota="Por qué funcionó: " />
              </Campo>
            )}
            {videosReferencia.length > 0 && (
              <Campo label="Vídeos que le gustan">
                <ListaVideos videos={videosReferencia} campoNota="queMeGusta" prefijoNota="Le gusta: " />
              </Campo>
            )}
            {hayEstiloTexto && (
              <Campo label="Texto en los vídeos" last>
                <p style={texto}>
                  {[
                    tv.posicion && `Posición: ${tv.posicion}`,
                    tv.tamano && `tamaño: ${tv.tamano}`,
                    tv.animaciones?.length > 0 && `animaciones: ${tv.animaciones.join(', ')}`,
                    `subtítulos automáticos: ${tv.subtitulosAuto ? `sí${tv.estiloSubtitulos ? ` (${tv.estiloSubtitulos})` : ''}` : 'no'}`,
                  ].filter(Boolean).join(' · ')}
                </p>
              </Campo>
            )}
          </>
        )}
      </div>

      <div style={tarjeta}>
        <Titulo action={<BotonTexto icon={Palette} onClick={onIrAKitMarca}>Ver kit de marca</BotonTexto>}>Identidad visual</Titulo>
        {hayIdentidad ? (
          <>
            {colores.length > 0 && (
              <Campo label="Colores">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {colores.map(([nombre, c]) => (
                    <div key={nombre} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, background: c, border: '1px solid var(--border-color)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{nombre} <span style={{ fontFamily: 'monospace' }}>{c}</span></span>
                    </div>
                  ))}
                </div>
              </Campo>
            )}
            {(iv.estiloTipografia || iv.fuenteEspecifica) && (
              <Campo label="Tipografía">
                <p style={texto}>{[iv.estiloTipografia, iv.fuenteEspecifica].filter(Boolean).join(' — ')}</p>
              </Campo>
            )}
            {iv.estetica?.length > 0 && (
              <Campo label="Estética">
                <p style={texto}>{iv.estetica.join(', ')}</p>
              </Campo>
            )}
            {iv.referenciaEstetica && (
              <Campo label="Referencia estética" last>
                <p style={texto}>{iv.referenciaEstetica}</p>
              </Campo>
            )}
          </>
        ) : (
          <p style={vacio}>Sin identidad visual todavía. Añade logo y colores en el kit de marca.</p>
        )}
      </div>

      <Placeholder icon={Sparkles} titulo="Moodboard, colores, tipografía, música y fechas del sector llegarán aquí">
        La investigación completa del cliente se está construyendo. De momento, los datos de arriba son los que usa la IA para sacar ideas y guiones.
      </Placeholder>
    </div>
  )
}

// ─── Grabación ────────────────────────────────────────────────────────────────
// Hoja de rodaje del mes en curso del cliente, dentro de la página.

export function PasoGrabacion({ cliente, onIrAGuiones }) {
  const hoy = new Date()
  const año = hoy.getFullYear()
  const mes = hoy.getMonth()
  const { posts, loading } = useCalendarioMes(cliente.id, año, mes, { incluirSinProgramar: true })
  const videos = ordenarPorFecha(posts.filter(esVideo))
  const hayPlanos = videos.some(p => p.guion?.planos?.length)

  return (
    <div style={{ maxWidth: 820 }}>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.5 }}>
        Los planos de los vídeos de {MESES[mes]} agrupados por tipo, para grabarlos seguidos en un día, y aparte las fotos de cada carrusel. Márcalos según los hagas.
      </p>

      {loading ? (
        <div style={{ ...tarjeta, fontSize: 13, color: 'var(--text-secondary)' }}>Cargando vídeos del mes...</div>
      ) : !hayPlanos ? (
        <div style={{ ...tarjeta, textAlign: 'center', padding: '28px 20px' }}>
          <Clapperboard size={24} color="var(--text-tertiary)" style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            Ningún vídeo de {MESES[mes]} tiene planos todavía
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
            Escribe los guiones y saca sus planos para preparar el rodaje.
          </p>
          <BotonTexto icon={Clapperboard} onClick={onIrAGuiones}>Ir a guiones</BotonTexto>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          {/* key: al cambiar de cliente o mes se remonta y relee su progreso guardado */}
          <HojaRodaje key={`${cliente.id}_${año}-${mes}`} inline cliente={cliente} piezas={videos} año={año} mes={mes} />
        </div>
      )}

      <Placeholder icon={Clapperboard} titulo="Planificación del día de grabación">
        La fecha, la hora y el lugar del día de rodaje, con aviso al cliente, llegarán en una fase posterior.
      </Placeholder>
    </div>
  )
}

// ─── Seguimiento (provisional) ────────────────────────────────────────────────

export function PasoSeguimiento({ cliente }) {
  return (
    <div style={{ maxWidth: 820 }}>
      <SeguimientoCliente cliente={cliente} />
    </div>
  )
}

// Paso añadido por la agencia en Configuración (p. ej. "Reunión mensual"): una
// casilla de hecho y una nota por mes, en investigaciones.datos.pasos[id].
export function PasoPersonalizado({ cliente, paso }) {
  const hoy = new Date()
  const anio = hoy.getFullYear()
  const mes = hoy.getMonth() + 1
  const { datos, cargando, setDatos, guardado } = useInvestigacion({
    clienteId: cliente.id, organizacionId: cliente.organizacionId, anio, mes,
  })
  const actual = datos?.pasos?.[paso.id] || {}
  const cambiar = (cambios) => setDatos(d => ({
    ...d, pasos: { ...(d?.pasos || {}), [paso.id]: { ...(d?.pasos?.[paso.id] || {}), ...cambios } },
  }))

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={tarjeta}>
        <Titulo action={
          <span style={{ fontSize: 12, color: guardado === 'error' ? '#FF3B30' : 'var(--text-tertiary)' }}>
            {guardado === 'guardando' || guardado === 'pendiente' ? 'Guardando...' : guardado === 'guardado' ? 'Guardado' : guardado === 'error' ? 'No se pudo guardar' : ''}
          </span>
        }>
          {paso.label} · {MESES[mes - 1]}
        </Titulo>
        {cargando ? <p style={vacio}>Cargando...</p> : (
          <>
            <button onClick={() => cambiar({ hecho: !actual.hecho, hechoEn: actual.hecho ? null : new Date().toISOString() })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${actual.hecho ? '#30D158' : 'var(--border-color)'}`, background: actual.hecho ? 'rgba(48,209,88,0.08)' : 'var(--bg-card)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14 }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: actual.hecho ? '#30D158' : 'transparent', border: actual.hecho ? 'none' : '1.5px solid var(--text-tertiary)' }}>
                {actual.hecho && <Check size={13} color="white" strokeWidth={3} />}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {actual.hecho ? `Hecho en ${MESES[mes - 1]}` : `Marcar como hecho en ${MESES[mes - 1]}`}
              </span>
            </button>
            <div style={etiqueta}>Notas del mes</div>
            <textarea value={actual.nota || ''} onChange={e => cambiar({ nota: e.target.value })} rows={5}
              placeholder={`Lo que haya que recordar de "${paso.label}" este mes`}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border-color)', fontSize: 14, lineHeight: 1.55, fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
          </>
        )}
      </div>
    </div>
  )
}
