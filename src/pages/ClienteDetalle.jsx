import { useState, useEffect, useRef, forwardRef, useImperativeHandle, lazy, Suspense } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Edit3, MoreHorizontal, Check, Calendar,
  Globe, ChevronDown,
  Download, Trash2, Archive, Plus, Link as LinkIcon, Receipt, Camera, Send, LayoutGrid
} from 'lucide-react'
import { getCliente, eliminarCliente, actualizarCliente } from '../hooks/useClientes'
import { useClienteActivo } from '../hooks/useClienteActivo'
import { resizeImagenCliente } from '../utils/fotoCliente'
import { mensajeErrorAmigable } from '../utils/errorMessage'
import { useOrganizacion } from '../hooks/useOrganizacion'
import { etiquetaModoCobro } from '../utils/modoCobro'
import { useCalendarioMes, getPostsCliente } from '../hooks/useCalendario'
import { useTareasList } from '../hooks/useTareas'
import { fechaVencimiento, estaVencida } from '../utils/vencimiento'
import { SkeletonDetalleHeader } from '../components/Skeleton'
import { useFacturasCliente, useFacturasList, eliminarFactura } from '../hooks/useFacturas'
import { usePresupuestosCliente, usePresupuestosList, eliminarPresupuesto } from '../hooks/usePresupuestos'
import { exportarFactura, exportarPresupuesto, exportarGuion } from '../services/exportPDF'
import DocumentoPanel from '../components/DocumentoPanel'
import HistoriaCincoLineas from '../components/HistoriaCincoLineas'
import EnviarFormularioModal from '../components/EnviarFormularioModal'
import PortalClienteModal from '../components/PortalClienteModal'
import ClienteNavegacion from '../components/ClienteNavegacion'
import { PasoInvestigacion, PasoGrabacion, PasoSeguimiento, PasoPersonalizado } from '../components/PasosCliente'
import EmpezarDeCero from '../components/EmpezarDeCero'
import { useProceso } from '../hooks/useProceso'
import TareasDelPaso from '../components/TareasDelPaso'
import { resolverTab } from '../utils/pasosCliente'
import KitMarcaCliente from '../components/KitMarcaCliente'
import { webLimpia, webTextoVisible } from '../utils/webVisible'
import VozClienteCard from '../components/VozClienteCard'
import CalendarioPublicacion from '../components/CalendarioPublicacion'
import { useEsMovil } from '../hooks/useEsMovil'
import { FECHAS_GENERALES } from './NuevoClienteData'

// Lluvia de ideas y Guiones del mes se incrustan en los pasos Ideas y Guiones
// de la ficha (mismo chunk que sus rutas propias, se cargan al abrir el paso)
const PrepararMes = lazy(() => import('../components/PrepararMes'))
const GuionesMes = lazy(() => import('./GuionesMes'))

// ─── Config ───────────────────────────────────────────────────────────────────

const REDES_CONFIG = [
  { id: 'instagram', label: 'Instagram', color: '#E1306C' },
  { id: 'tiktok', label: 'TikTok', color: '#86868B' },
  { id: 'facebook', label: 'Facebook', color: '#1877F2' },
  { id: 'whatsapp', label: 'WhatsApp Canal', color: '#25D366' },
]

const TONE_DESCS = {
  cercano_divertido: 'Como un amigo que te recomienda algo',
  desenfadado_ironico: 'Con humor y personalidad propia',
  aspiracional: 'Inspira y genera deseo',
  profesional: 'Transmite confianza y expertise',
  energetico: 'Directo, dinámico, mucha acción',
  familiar_calido: 'Cercano, inclusivo, de confianza',
}

const FREQ_LABELS = { '1x_semana': '1x/sem', '2x_semana': '2x/sem', '3x_semana': '3x/sem', 'diario': 'Diario' }
const FREQ_NUMS = { 1: '1x/sem', 2: '2x/sem', 3: '3x/sem', 4: '4x/sem', 5: '5x/sem', 7: 'Diario' }

const VALORES_MAP = {
  precio: 'Precio', calidad: 'Calidad', proximidad: 'Proximidad',
  estetica: 'Estética', sostenibilidad: 'Sostenibilidad', familia: 'Familia',
  experiencias: 'Experiencias', rapidez: 'Rapidez',
}
const FECHAS_MAP = {
  navidad: 'Navidad', san_valentin: 'San Valentín', padre_madre: 'Día Padre/Madre',
  halloween: 'Halloween', vuelta_cole: 'Vuelta al cole', verano: 'Verano',
  otono: 'Otoño', black_friday: 'Black Friday', cyber_monday: 'Cyber Monday',
  ano_nuevo: 'Año Nuevo', carnaval: 'Carnaval',
}
const GENERO_MAP = { mixto: 'Mixto', mujer: 'Mayoría mujeres', hombre: 'Mayoría hombres', Mixto: 'Mixto' }

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']


// ─── Calendar helpers ──────────────────────────────────────────────────────────

// fechasClaveObj puede llegar como {} o con listas vacías: sin esto la tarjeta
// "Fechas clave" se pintaba vacía.
// Postgres devuelve "HH:MM:SS" para una columna `time`: se enseña solo "HH:MM".
const horaCorta = (h) => h ? h.slice(0, 5) : null

function tieneFechasClave(cliente) {
  const f = cliente.fechasClaveObj
  if (f) return f.generales?.length > 0 || f.propias?.length > 0 || Boolean(f.temporada)
  return Boolean(cliente.fechasClave)
}


// ─── Sub-components ────────────────────────────────────────────────────────────

function InfoCard({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 18, padding: '22px',
      boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid var(--border-subtle)',
      marginBottom: 16, ...style,
    }}>
      {children}
    </div>
  )
}

function CardLabel({ children, color }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: color || '#86868B',
      textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

function Tag({ children, bg, color, border }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 12, fontWeight: 500,
      padding: '4px 10px', borderRadius: 20, marginRight: 6, marginBottom: 6,
      background: bg || 'rgba(0,0,0,0.05)', color: color || '#1D1D1F',
      border: border || '1px solid transparent',
    }}>
      {children}
    </span>
  )
}

// ─── Tab: Resumen ──────────────────────────────────────────────────────────────
// At-a-glance overview of this client: what's coming up, what's pending, what's
// owed. Built entirely from data other tabs already fetch (calendar, tareas,
// facturas, presupuestos) — no new tables, no new writes, read-only.

const RESUMEN_RED_COLORS = {
  instagram: '#E1306C', tiktok: '#86868B', facebook: '#1877F2',
  youtube: '#FF0000', whatsapp: '#25D366', googlemaps: '#4285F4', linkedin: '#0A66C2',
}
const RESUMEN_ESTADO_POST = {
  borrador: { label: 'Borrador', color: '#86868B' },
  aprobado: { label: 'Aprobado', color: '#30D158' },
  publicado: { label: 'Publicado', color: '#1D5FE0' },
}

function ResumenCard({ label, children, action }) {
  return (
    <InfoCard style={{ height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <CardLabel>{label}</CardLabel>
        {action}
      </div>
      {children}
    </InfoCard>
  )
}

function ResumenEmpty({ children }) {
  return <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{children}</p>
}

function ResumenLinkBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      fontSize: 12, fontWeight: 600, color: '#1D5FE0', fontFamily: 'inherit',
    }}>
      {children}
    </button>
  )
}

function TabResumen({ cliente, onGoToTab }) {
  const navigate = useNavigate()
  const esMovil = useEsMovil()
  const now = new Date()
  const { posts: postsMes } = useCalendarioMes(cliente.id, now.getFullYear(), now.getMonth())
  const { tareas: todasTareas } = useTareasList()
  const { facturas } = useFacturasCliente(cliente.id)
  const { presupuestos } = usePresupuestosCliente(cliente.id)

  const hoyStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const proximosPosts = (postsMes || [])
    .filter(p => p.fecha >= hoyStr && p.estado !== 'publicado')
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
    .slice(0, 5)

  const pendientesDesarrollo = (postsMes || []).filter(p => p.estado === 'aprobado' && !p.desarrollado).length

  const tareasCliente = todasTareas.filter(t => String(t.clienteId) === String(cliente.id) && !t.completada)
  const tareasPendientes = [...tareasCliente]
    .sort((a, b) => (fechaVencimiento(a) || '9999').localeCompare(fechaVencimiento(b) || '9999'))
    .slice(0, 5)

  const facturasPendientes = (facturas || []).filter(f => f.estado === 'pendiente' || f.estado === 'vencida')
  const totalPendiente = facturasPendientes.reduce((sum, f) => sum + Number(f.total || 0), 0)
  const presupuestosPorFirmar = (presupuestos || []).filter(p => p.estado === 'enviado')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: esMovil ? '1fr' : '1fr 1fr', gap: 16, maxWidth: 1100 }}>
      <ResumenCard label={`Próximos posts · ${MESES[now.getMonth()]}`} action={<ResumenLinkBtn onClick={() => onGoToTab?.('calendario')}>Ver calendario</ResumenLinkBtn>}>
        {proximosPosts.length === 0 ? (
          <ResumenEmpty>No hay posts programados para lo que queda de mes.</ResumenEmpty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {proximosPosts.map(post => {
              const color = RESUMEN_RED_COLORS[post.red] || '#86868B'
              const estado = RESUMEN_ESTADO_POST[post.estado] || RESUMEN_ESTADO_POST.borrador
              return (
                <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, background: 'var(--bg-secondary)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#86868B', width: 26, flexShrink: 0 }}>{post.dia}</div>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {post.titulo || 'Post sin título'}
                  </div>
                  {horaCorta(post.hora) && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#86868B', flexShrink: 0 }}>{horaCorta(post.hora)}</span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 600, color: estado.color, flexShrink: 0 }}>{estado.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </ResumenCard>

      <ResumenCard label="Tareas pendientes" action={<ResumenLinkBtn onClick={() => navigate('/todo')}>Ver todas</ResumenLinkBtn>}>
        {tareasPendientes.length === 0 ? (
          <ResumenEmpty>Sin tareas pendientes para este cliente.</ResumenEmpty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tareasPendientes.map(t => {
              const fecha = fechaVencimiento(t)
              const vencida = estaVencida(t, hoyStr)
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, background: 'var(--bg-secondary)' }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.titulo}
                  </div>
                  {fecha && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: vencida ? '#FF3B30' : '#86868B', flexShrink: 0 }}>
                      {vencida ? 'Vencida' : fecha}
                    </span>
                  )}
                </div>
              )
            })}
            {tareasCliente.length > 5 && (
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>+{tareasCliente.length - 5} más</p>
            )}
          </div>
        )}
      </ResumenCard>

      <ResumenCard label="Por desarrollar" action={<ResumenLinkBtn onClick={() => onGoToTab?.('ideas')}>Ver</ResumenLinkBtn>}>
        {pendientesDesarrollo === 0 ? (
          <ResumenEmpty>No hay posts aprobados esperando copy o guión.</ResumenEmpty>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
            <strong>{pendientesDesarrollo}</strong> post{pendientesDesarrollo === 1 ? '' : 's'} aprobado{pendientesDesarrollo === 1 ? '' : 's'} este mes {pendientesDesarrollo === 1 ? 'espera' : 'esperan'} copy o guión.
          </p>
        )}
      </ResumenCard>

      <ResumenCard label="Facturación" action={<ResumenLinkBtn onClick={() => onGoToTab?.('facturacion')}>Ver</ResumenLinkBtn>}>
        {facturasPendientes.length === 0 && presupuestosPorFirmar.length === 0 ? (
          <ResumenEmpty>Sin facturas pendientes ni presupuestos por firmar.</ResumenEmpty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {facturasPendientes.length > 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                <strong>{facturasPendientes.length}</strong> factura{facturasPendientes.length === 1 ? '' : 's'} pendiente{facturasPendientes.length === 1 ? '' : 's'} · {totalPendiente.toFixed(2)} €
              </p>
            )}
            {presupuestosPorFirmar.length > 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                <strong>{presupuestosPorFirmar.length}</strong> presupuesto{presupuestosPorFirmar.length === 1 ? '' : 's'} esperando firma
              </p>
            )}
          </div>
        )}
      </ResumenCard>
    </div>
  )
}

// ─── Tab: Perfil ───────────────────────────────────────────────────────────────
// Antes esta pestaña era de solo lectura y toda la edición vivía en un panel
// lateral aparte ("Editar cliente"). Ahora el propio Perfil tiene un modo
// edición (mismo patrón: un botón activa inputs en vez de texto, con
// Guardar/Cancelar) que reutiliza exactamente la lógica de guardado que antes
// tenía ese panel — no se reinventa, solo se traslada aquí.

const editFieldLabelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }
const editInputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: 14, color: 'var(--text-primary)', background: 'var(--bg-secondary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
const editTextareaStyle = { ...editInputStyle, resize: 'vertical', lineHeight: 1.5 }
const editFocusHandlers = {
  onFocus: e => { e.target.style.borderColor = 'var(--accent-blue)' },
  onBlur: e => { e.target.style.borderColor = 'var(--border-color)' },
}

function EditField({ label, optional, value, onChange, placeholder, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 16 }}>
      <p style={editFieldLabelStyle}>{label}{optional && <span style={{ fontWeight: 400, marginLeft: 4 }}>(opcional)</span>}</p>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={editInputStyle} {...editFocusHandlers} />
    </div>
  )
}

function EditTextArea({ label, optional, value, onChange, placeholder, rows = 3, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 16 }}>
      <p style={editFieldLabelStyle}>{label}{optional && <span style={{ fontWeight: 400, marginLeft: 4 }}>(opcional)</span>}</p>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={editTextareaStyle} {...editFocusHandlers} />
    </div>
  )
}

const TabPerfil = forwardRef(function TabPerfil({ cliente, startInEdit, onSaved, onClienteActualizado }, ref) {
  const esMovil = useEsMovil()
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const audiencia = cliente.audiencia || {}
  const historial = cliente.historial || {}
  const hasHistorial = Object.values(historial).some(v => v && (Array.isArray(v) ? v.length : true))

  const [fotoClienteRef, setFotoClienteRef] = useState({ id: cliente.id, url: cliente.fotoUrl || null })
  const [fotoUrl, setFotoUrl] = useState(cliente.fotoUrl || null)
  const [procesandoFoto, setProcesandoFoto] = useState(false)
  const [fotoError, setFotoError] = useState(null)

  // Mantiene fotoUrl sincronizada si cambia el cliente (o su foto) sin desmontar este tab
  if (fotoClienteRef.id !== cliente.id || fotoClienteRef.url !== cliente.fotoUrl) {
    setFotoClienteRef({ id: cliente.id, url: cliente.fotoUrl || null })
    setFotoUrl(cliente.fotoUrl || null)
  }

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFotoError(null)
    setProcesandoFoto(true)
    try {
      const dataUrl = await resizeImagenCliente(file)
      setFotoUrl(dataUrl)
      const { data, error } = await actualizarCliente(cliente.id, { ...cliente, fotoUrl: dataUrl })
      if (error) {
        // El guardado se rechazó de verdad (no un simple offline) — no lo
        // escondemos: revertimos el cambio optimista y avisamos, para no
        // repetir el bug de "la foto parece guardada pero no lo está".
        setFotoUrl(cliente.fotoUrl || null)
        setFotoError(mensajeErrorAmigable(error, 'No se pudo guardar la foto'))
        return
      }
      // Antes este guardado nunca avisaba al componente padre: la foto
      // podía guardarse bien y aun así "desaparecer" al cambiar de pestaña
      // y volver, porque el `cliente` que usa el resto de la app (cabecera,
      // otras pestañas) seguía siendo el objeto viejo sin fotoUrl.
      onSaved?.(data || { ...cliente, fotoUrl: dataUrl })
    } catch (err) {
      setFotoUrl(cliente.fotoUrl || null)
      setFotoError(mensajeErrorAmigable(err, 'No se pudo guardar la foto'))
    } finally {
      setProcesandoFoto(false)
    }
  }

  // ── Modo edición (reemplaza al antiguo panel lateral "Editar cliente") ──
  //
  // El botón "Editar" de la cabecera de la página puede llegar aquí de dos
  // formas distintas y ambas se resuelven sin useEffect (para no repetir el
  // patrón "setState dentro de un efecto" ya señalado en otras partes del
  // archivo):
  //  1. Viniendo de otra pestaña: este componente se monta de cero, así que
  //     basta con que el estado inicial de editMode/editData lea `startInEdit`
  //     a través del inicializador perezoso de useState (se ejecuta una sola
  //     vez, durante el propio montaje).
  //  2. Ya estando en Perfil: el componente sigue montado, así que la
  //     cabecera llama directamente a `entrarEnEdicion()` a través de un ref
  //     imperativo (useImperativeHandle más abajo).

  const construirEditData = () => {
    const redesForm = {}
    REDES_CONFIG.forEach(r => {
      const detalles = cliente.redesDetalladas?.[r.id] || {}
      redesForm[r.id] = {
        activa: cliente.redes?.includes(r.id) || detalles.activa || false,
        frecuencia: detalles.frecuencia || '3x_semana',
      }
    })
    return {
      nombre: cliente.nombre || '',
      sector: cliente.sector || '',
      web: cliente.web || '',
      descripcion: cliente.descripcion || '',
      diferencial: cliente.diferencial || '',
      ubicacion: cliente.ubicacion || '',
      edadMin: cliente.audiencia?.edadMin ?? 25,
      edadMax: cliente.audiencia?.edadMax ?? 40,
      genero: cliente.audiencia?.genero || 'mixto',
      audienciaDesc: cliente.audiencia?.descripcion || '',
      tono: cliente.tono || '',
      energia: cliente.energia || '',
      usoEmojis: cliente.usoEmojis || '',
      vozPropia: cliente.vozPropia || '',
      prohibido: cliente.prohibido || '',
      redes: redesForm,
      queHaFuncionado: historial.queHaFuncionado || '',
      mejorPost: historial.mejorPost || '',
      hashtagsPropio: historial.hashtagsPropio || '',
      referencias: historial.referencias || '',
      fechasGenerales: cliente.fechasClaveObj?.generales || [],
      fechasPropias: cliente.fechasClaveObj?.propias || [],
      temporada: cliente.fechasClaveObj?.temporada || '',
    }
  }

  const [editMode, setEditMode] = useState(() => !!startInEdit)
  const [editData, setEditData] = useState(() => (startInEdit ? construirEditData() : null))
  const [guardando, setGuardando] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const entrarEnEdicion = () => {
    setEditData(construirEditData())
    setSaveError(null)
    setEditMode(true)
  }

  useImperativeHandle(ref, () => ({ entrarEnEdicion }))

  const cancelarEdicion = () => {
    setEditMode(false)
    setEditData(null)
    setSaveError(null)
  }

  const updateEdit = (key, val) => setEditData(d => ({ ...d, [key]: val }))
  const updateEditRed = (redId, field, val) => setEditData(d => ({
    ...d, redes: { ...d.redes, [redId]: { ...d.redes[redId], [field]: val } }
  }))

  const guardarEdicion = async () => {
    if (!editData) return
    setGuardando(true)
    setSaveError(null)
    try {
      const redesActivas = Object.entries(editData.redes).filter(([, v]) => v.activa).map(([k]) => k)
      const freqMap = { '1x_semana': 1, '2x_semana': 2, '3x_semana': 3, 'diario': 7 }
      const frecuencia = Object.fromEntries(
        Object.entries(editData.redes).filter(([, v]) => v.activa).map(([k, v]) => [k, freqMap[v.frecuencia] || 3])
      )
      const redesDetalladas = { ...(cliente.redesDetalladas || {}) }
      Object.entries(editData.redes).forEach(([k, v]) => {
        redesDetalladas[k] = { ...(redesDetalladas[k] || {}), activa: v.activa, frecuencia: v.frecuencia }
      })
      const actualizado = {
        ...cliente,
        nombre: editData.nombre,
        sector: editData.sector,
        web: editData.web,
        descripcion: editData.descripcion,
        diferencial: editData.diferencial,
        ubicacion: editData.ubicacion,
        audiencia: { ...cliente.audiencia, edadMin: editData.edadMin, edadMax: editData.edadMax, genero: editData.genero, descripcion: editData.audienciaDesc },
        tono: editData.tono,
        energia: editData.energia,
        usoEmojis: editData.usoEmojis,
        vozPropia: editData.vozPropia,
        prohibido: editData.prohibido,
        redes: redesActivas,
        frecuencia,
        redesDetalladas,
        historial: { ...cliente.historial, queHaFuncionado: editData.queHaFuncionado, mejorPost: editData.mejorPost, hashtagsPropio: editData.hashtagsPropio, referencias: editData.referencias },
        avatar: editData.nombre.charAt(0).toUpperCase(),
        fechasClaveObj: { generales: editData.fechasGenerales, propias: editData.fechasPropias, temporada: editData.temporada },
      }
      const { data, error } = await actualizarCliente(cliente.id, actualizado)
      if (error) {
        setSaveError(mensajeErrorAmigable(error))
        return
      }
      onSaved?.(data || actualizado)
      setEditMode(false)
      setEditData(null)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      {/* Barra de acción: Editar perfil, o Cancelar/Guardar en modo edición */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 16, maxWidth: 1100 }}>
        {saveError && (
          <p style={{ fontSize: 12, color: '#FF3B30', margin: 0, flex: 1 }}>{saveError}</p>
        )}
        {!editMode && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setFormularioAbierto(true)}
            title="Manda a tu cliente un enlace con su ficha para que la complete él mismo"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}>
            <Send size={13} /> Pedir al cliente que la complete
          </motion.button>
        )}
        {!editMode ? (
          <motion.button whileTap={{ scale: 0.97 }} onClick={entrarEnEdicion}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'var(--accent-blue)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}>
            <Edit3 size={13} /> Editar perfil
          </motion.button>
        ) : (
          <>
            <motion.button whileTap={{ scale: 0.97 }} onClick={cancelarEdicion} disabled={guardando}
              style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'inherit' }}>
              Cancelar
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={guardarEdicion} disabled={guardando}
              style={{ padding: '8px 18px', borderRadius: 10, background: guardando ? 'var(--text-tertiary)' : 'var(--accent-lime)', border: 'none', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: guardando ? 'white' : '#0B0C10', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
              {guardando ? (
                <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> Guardando...</>
              ) : 'Guardar cambios'}
            </motion.button>
          </>
        )}
      </div>

      <EnviarFormularioModal open={formularioAbierto} onClose={() => setFormularioAbierto(false)} cliente={cliente} />

      {!editMode && <VozClienteCard cliente={cliente} onClienteActualizado={onClienteActualizado} />}

    {/* minmax(0, 1fr): sin el 0, una columna no puede estrecharse por debajo
        de su contenido más ancho (una URL larga) y empuja todo fuera de la pantalla */}
    <div style={{ display: 'grid', gridTemplateColumns: esMovil ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, alignItems: 'start', maxWidth: 1100 }}>
      {/* LEFT */}
      <div>
        {/* Foto del cliente */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <InfoCard>
            <CardLabel>Foto del cliente</CardLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <label htmlFor="foto-cliente-perfil-input" style={{
                position: 'relative', width: 68, height: 68, borderRadius: '50%', flexShrink: 0,
                cursor: procesandoFoto ? 'not-allowed' : 'pointer', overflow: 'hidden',
                border: `1.5px dashed ${fotoUrl ? 'transparent' : 'var(--border-color)'}`,
                background: fotoUrl ? `url(${fotoUrl}) center/cover no-repeat` : 'var(--bg-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {!fotoUrl && (procesandoFoto
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.15)', borderTopColor: '#1D5FE0' }} />
                  : <Camera size={20} color="#86868B" strokeWidth={1.8} />)}
                {fotoUrl && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                    <Camera size={16} color="white" strokeWidth={1.8} />
                  </div>
                )}
                <input id="foto-cliente-perfil-input" type="file" accept="image/*" onChange={handleFotoChange} disabled={procesandoFoto} style={{ display: 'none' }} />
              </label>
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {procesandoFoto ? 'Guardando...' : fotoUrl ? 'Toca la foto para cambiarla' : 'Sube una foto para este cliente'}
                </p>
                {fotoError && <p style={{ fontSize: 11, color: '#FF3B30', margin: '4px 0 0' }}>{fotoError}</p>}
              </div>
            </div>
          </InfoCard>
        </motion.div>

        {/* Información básica / Sobre el negocio */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <InfoCard>
            <CardLabel>{editMode ? 'Información básica' : 'Sobre el negocio'}</CardLabel>
            {editMode ? (
              <>
                <EditField label="Nombre del negocio" value={editData.nombre} onChange={v => updateEdit('nombre', v)} placeholder="Ej: Café Aurora" />
                <EditField label="Sector" value={editData.sector} onChange={v => updateEdit('sector', v)} placeholder="Restauración, Moda, Fitness..." />
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <EditField label="Web o perfil" optional value={editData.web} onChange={v => updateEdit('web', v)} placeholder="https://... o @usuario" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <EditField label="Ubicación" optional value={editData.ubicacion} onChange={v => updateEdit('ubicacion', v)} placeholder="Ej: Puzol, Valencia" />
                  </div>
                </div>
                <EditTextArea label="Descripción" value={editData.descripcion} onChange={v => updateEdit('descripcion', v)} placeholder="Qué vende o ofrece..." rows={3} />
                <EditTextArea label="Diferencial" optional value={editData.diferencial} onChange={v => updateEdit('diferencial', v)} placeholder="Por qué elegirles..." rows={2} last />
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: cliente.diferencial ? 16 : 0 }}>
                  {cliente.descripcion || 'N/A'}
                </p>
                {cliente.diferencial && (
                  <div style={{ marginTop: 16 }}>
                    <CardLabel>Diferencial</CardLabel>
                    <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{cliente.diferencial}</p>
                  </div>
                )}
                {cliente.web && (
                  <div style={{ marginTop: 16 }}>
                    <CardLabel>Web</CardLabel>
                    <a
                      href={webLimpia(cliente.web)}
                      target="_blank" rel="noopener noreferrer"
                      title={cliente.web}
                      style={{ fontSize: 14, color: '#1D5FE0', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}
                    >
                      <Globe size={13} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{webTextoVisible(cliente.web)}</span>
                    </a>
                  </div>
                )}
              </>
            )}
          </InfoCard>
        </motion.div>

        {/* Tono de voz */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <InfoCard>
            <CardLabel>Tono de voz</CardLabel>
            {editMode ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <p style={editFieldLabelStyle}>Tono de voz</p>
                  <div style={{ display: 'grid', gridTemplateColumns: esMovil ? '1fr' : '1fr 1fr', gap: 8 }}>
                    {[
                      { id: 'Cercano y divertido', label: 'Cercano y divertido' }, { id: 'Desenfadado e irónico', label: 'Desenfadado e irónico' },
                      { id: 'Aspiracional', label: 'Aspiracional' }, { id: 'Profesional y serio', label: 'Profesional y serio' },
                      { id: 'Energético', label: 'Energético' }, { id: 'Familiar y cálido', label: 'Familiar y cálido' },
                    ].map(t => (
                      <motion.div key={t.id} whileTap={{ scale: 0.97 }} onClick={() => updateEdit('tono', t.id)}
                        style={{ padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${editData.tono === t.id ? 'var(--accent-blue)' : 'var(--border-color)'}`, background: editData.tono === t.id ? 'rgba(29,95,224,0.07)' : 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: editData.tono === t.id ? 'var(--accent-blue)' : 'var(--text-primary)', margin: 0 }}>{t.label}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
                <EditTextArea label="Voz y estilo propio" optional value={editData.vozPropia} onChange={v => updateEdit('vozPropia', v)} placeholder='Ej: Siempre usa emojis, llama a sus clientes "familia"...' rows={2} />
                <EditTextArea label="Lo que NUNCA debe publicar" optional value={editData.prohibido} onChange={v => updateEdit('prohibido', v)} placeholder="Ej: No hablar de precios de competidores..." rows={2} last />
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{
                    background: '#1D5FE0', color: 'white', borderRadius: 20,
                    padding: '5px 14px', fontSize: 13, fontWeight: 600,
                  }}>
                    {cliente.tono || 'N/A'}
                  </span>
                </div>
                {cliente.tonoId && TONE_DESCS[cliente.tonoId] && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 12 }}>
                    {TONE_DESCS[cliente.tonoId]}
                  </p>
                )}
                {cliente.vozPropia && (
                  <div style={{ marginBottom: 12 }}>
                    <CardLabel>Estilo propio</CardLabel>
                    <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{cliente.vozPropia}</p>
                  </div>
                )}
                {cliente.prohibido && (
                  <div>
                    <CardLabel color="#FF3B30">Prohibido</CardLabel>
                    <div style={{
                      background: 'rgba(255,59,48,0.05)', borderRadius: 10,
                      padding: '10px 14px', border: '1px solid rgba(255,59,48,0.12)',
                    }}>
                      <p style={{ fontSize: 14, color: '#FF3B30', lineHeight: 1.6, margin: 0 }}>{cliente.prohibido}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </InfoCard>
        </motion.div>

        {/* Fechas clave */}
        {(tieneFechasClave(cliente) || editMode) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <InfoCard>
              <CardLabel>Fechas clave</CardLabel>
              {editMode && (
                <>
                  <p style={editFieldLabelStyle}>Fechas especiales del año</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
                    {FECHAS_GENERALES.map(f => {
                      const activa = editData.fechasGenerales.includes(f.id)
                      return <button key={f.id} type="button" onClick={() => updateEdit('fechasGenerales', activa ? editData.fechasGenerales.filter(x => x !== f.id) : [...editData.fechasGenerales, f.id])}
                        style={{ padding: '6px 10px', borderRadius: 16, border: `1px solid ${activa ? '#1D5FE0' : 'var(--border-color)'}`, background: activa ? 'rgba(29,95,224,.08)' : 'var(--bg-secondary)', color: activa ? '#1D5FE0' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>{f.label}</button>
                    })}
                  </div>
                  <p style={editFieldLabelStyle}>Fechas propias</p>
                  {editData.fechasPropias.map((f, i) => <div key={`${f.nombre}-${i}`} style={{ display: 'flex', gap: 7, marginBottom: 7 }}>
                    <input value={f.nombre || ''} onChange={e => updateEdit('fechasPropias', editData.fechasPropias.map((x, n) => n === i ? { ...x, nombre: e.target.value } : x))} placeholder="Nombre" style={{ ...editInputStyle, flex: 1 }} />
                    <input type="date" value={f.fecha || ''} onChange={e => updateEdit('fechasPropias', editData.fechasPropias.map((x, n) => n === i ? { ...x, fecha: e.target.value } : x))} style={editInputStyle} />
                    <button type="button" onClick={() => updateEdit('fechasPropias', editData.fechasPropias.filter((_, n) => n !== i))} style={{ border: 'none', background: 'transparent', color: '#FF3B30', cursor: 'pointer' }}>×</button>
                  </div>)}
                  <button type="button" onClick={() => updateEdit('fechasPropias', [...editData.fechasPropias, { nombre: '', fecha: '' }])} style={{ border: 'none', background: 'transparent', color: '#1D5FE0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>+ Añadir fecha</button>
                  <EditTextArea label="Temporada" optional value={editData.temporada} onChange={v => updateEdit('temporada', v)} rows={2} />
                </>
              )}
              {!editMode && <>
              {cliente.fechasClaveObj?.generales?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <CardLabel>Generales</CardLabel>
                  <div>
                    {cliente.fechasClaveObj.generales.map(f => (
                      <Tag key={f} bg="rgba(29,95,224,0.07)" color="#1D5FE0" border="1px solid rgba(29,95,224,0.15)">
                        {FECHAS_MAP[f] || f}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}
              {cliente.fechasClaveObj?.propias?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <CardLabel>Propias</CardLabel>
                  {cliente.fechasClaveObj.propias.map((fp, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Calendar size={13} color="#86868B" />
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{fp.nombre}</span>
                      {fp.fecha && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fp.fecha}</span>}
                    </div>
                  ))}
                </div>
              )}
              {cliente.fechasClaveObj?.temporada && (
                <div style={{ marginBottom: 6 }}>
                  <CardLabel>Temporada</CardLabel>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{cliente.fechasClaveObj.temporada}</p>
                </div>
              )}
              {!cliente.fechasClaveObj && cliente.fechasClave && (
                <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{cliente.fechasClave}</p>
              )}
              </>}
            </InfoCard>
          </motion.div>
        )}
      </div>

      {/* RIGHT */}
      <div>
        {/* Redes activas */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
          <InfoCard>
            <CardLabel>Redes activas</CardLabel>
            {editMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {REDES_CONFIG.filter(r => r.id !== 'whatsapp').map(red => {
                  const r = editData.redes[red.id] || { activa: false, frecuencia: '3x_semana' }
                  return (
                    <div key={red.id} style={{ background: 'var(--bg-secondary)', borderRadius: 12, border: `1.5px solid ${r.activa ? red.color + '40' : 'var(--border-color)'}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${red.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: red.color }}>{red.label.charAt(0)}</span>
                        </div>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{red.label}</span>
                        <motion.div onClick={() => updateEditRed(red.id, 'activa', !r.activa)}
                          style={{ width: 40, height: 24, borderRadius: 12, cursor: 'pointer', background: r.activa ? red.color : 'rgba(0,0,0,0.15)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                          <motion.div animate={{ x: r.activa ? 18 : 2 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-card)', position: 'absolute', top: 3, left: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </motion.div>
                      </div>
                      <AnimatePresence>
                        {r.activa && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '8px 14px 12px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Frecuencia:</span>
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {[['1x_semana','1x/sem'],['2x_semana','2x/sem'],['3x_semana','3x/sem'],['diario','Diario']].map(([val, lbl]) => (
                                  <motion.button key={val} whileTap={{ scale: 0.94 }} onClick={() => updateEditRed(red.id, 'frecuencia', val)}
                                    style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, border: `1.5px solid ${r.frecuencia === val ? red.color : 'var(--border-color)'}`, background: r.frecuencia === val ? `${red.color}15` : 'transparent', color: r.frecuencia === val ? red.color : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                                    {lbl}
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            ) : (
              REDES_CONFIG.map(red => {
                const activa = cliente.redes?.includes(red.id) || cliente.redesDetalladas?.[red.id]?.activa
                const freqNum = FREQ_NUMS[cliente.frecuencia?.[red.id]]
                const freqLabel = FREQ_LABELS[cliente.redesDetalladas?.[red.id]?.frecuencia]
                const freq = freqNum || freqLabel
                const objetivo = cliente.redesDetalladas?.[red.id]?.objetivo

                if (!activa) return null

                return (
                  <div key={red.id} style={{
                    borderRadius: 10, padding: '12px 14px',
                    border: '1px solid var(--border-subtle)', marginBottom: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: red.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{red.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {freq && (
                        <span style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 20,
                          background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                        }}>{freq}</span>
                      )}
                      {objetivo && (
                        <span style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 20,
                          background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                          maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{objetivo}</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </InfoCard>
        </motion.div>

        {/* Audiencia */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
          <InfoCard>
            <CardLabel>Audiencia</CardLabel>
            {editMode ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <p style={editFieldLabelStyle}>Rango de edad</p>
                  <div style={{ display: 'inline-block', background: 'var(--accent-blue)', color: 'white', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                    {editData.edadMin}–{editData.edadMax} años
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {[{ key: 'edadMin', label: 'Desde', min: 18, max: editData.edadMax - 1 }, { key: 'edadMax', label: 'Hasta', min: editData.edadMin + 1, max: 65 }].map(s => (
                      <div key={s.key} style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{s.label} <strong style={{ color: 'var(--text-primary)' }}>{editData[s.key]}</strong></p>
                        <input type="range" min={s.min} max={s.max} value={editData[s.key]} onChange={e => updateEdit(s.key, Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-blue)' }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <p style={editFieldLabelStyle}>Género predominante</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[{ id: 'mixto', label: 'Mixto' }, { id: 'mujer', label: 'Mayoría mujeres' }, { id: 'hombre', label: 'Mayoría hombres' }].map(g => (
                      <motion.div key={g.id} whileTap={{ scale: 0.97 }} onClick={() => updateEdit('genero', g.id)}
                        style={{ flex: 1, padding: '10px 8px', borderRadius: 10, textAlign: 'center', border: `1.5px solid ${editData.genero === g.id ? 'var(--accent-blue)' : 'var(--border-color)'}`, background: editData.genero === g.id ? 'rgba(29,95,224,0.07)' : 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: editData.genero === g.id ? 'var(--accent-blue)' : 'var(--text-primary)', margin: 0 }}>{g.label}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
                <EditTextArea label="Descripción del cliente ideal" optional value={editData.audienciaDesc} onChange={v => updateEdit('audienciaDesc', v)} placeholder="Ej: Parejas y grupos de amigos de 25-35 años..." rows={3} last />
              </>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <span style={{
                    background: '#1D5FE0', color: 'white', borderRadius: 20,
                    display: 'inline-block', padding: '6px 16px', fontSize: 14, fontWeight: 600,
                  }}>
                    {audiencia.edadMin || '?'}—{audiencia.edadMax || '?'} años
                  </span>
                </div>
                {audiencia.genero && (
                  <div style={{ marginBottom: 10 }}>
                    <CardLabel>Género</CardLabel>
                    <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>{GENERO_MAP[audiencia.genero] || audiencia.genero}</p>
                  </div>
                )}
                {audiencia.descripcion && (
                  <div style={{ marginBottom: 10 }}>
                    <CardLabel>Descripción</CardLabel>
                    <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{audiencia.descripcion}</p>
                  </div>
                )}
                {audiencia.valores?.length > 0 && (
                  <div>
                    <CardLabel>Valores</CardLabel>
                    <div>
                      {audiencia.valores.map(v => (
                        <Tag key={v}>{VALORES_MAP[v] || v}</Tag>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </InfoCard>
        </motion.div>

        {/* Historial */}
        {(hasHistorial || editMode) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <InfoCard>
              <CardLabel>Historial</CardLabel>
              {editMode ? (
                <>
                  <EditTextArea label="¿Qué tipo de contenido ha generado más interacción?" optional value={editData.queHaFuncionado} onChange={v => updateEdit('queHaFuncionado', v)} placeholder="Ej: Los vídeos de making-of, las fotos del atardecer..." rows={2} />
                  <EditTextArea label="¿Hay algún post o campaña especialmente exitoso?" optional value={editData.mejorPost} onChange={v => updateEdit('mejorPost', v)} placeholder="Ej: El vídeo del reto llegó a 50k reproducciones..." rows={2} />
                  <EditTextArea label="¿Tienen algún hashtag propio o de marca?" optional value={editData.hashtagsPropio} onChange={v => updateEdit('hashtagsPropio', v)} placeholder="#tuhashtag #tunegocio" rows={1} />
                  <EditTextArea label="¿Hay competidores o referencias que admiras?" optional value={editData.referencias} onChange={v => updateEdit('referencias', v)} placeholder="Ej: Me gusta cómo comunica @deleito_oficial..." rows={2} last />
                </>
              ) : (
                <>
                  {historial.queHaFuncionado && (
                    <div style={{ marginBottom: 12 }}>
                      <CardLabel>Qué ha funcionado</CardLabel>
                      <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{historial.queHaFuncionado}</p>
                    </div>
                  )}
                  {historial.mejorPost && (
                    <div style={{ marginBottom: 12 }}>
                      <CardLabel>Mejor post</CardLabel>
                      <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{historial.mejorPost}</p>
                    </div>
                  )}
                  {historial.hashtagsPropio && (
                    <div style={{ marginBottom: 12 }}>
                      <CardLabel>Hashtags propios</CardLabel>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(Array.isArray(historial.hashtagsPropio)
                          ? historial.hashtagsPropio
                          : historial.hashtagsPropio.split(' ')
                        ).map(h => (
                          <code key={h} style={{
                            fontSize: 12, background: 'rgba(29,95,224,0.08)', color: '#1D5FE0',
                            padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace',
                          }}>{h}</code>
                        ))}
                      </div>
                    </div>
                  )}
                  {historial.referencias && (
                    <div>
                      <CardLabel>Referencias</CardLabel>
                      <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{historial.referencias}</p>
                    </div>
                  )}
                  {!hasHistorial && (
                    <ResumenEmpty>Sin historial registrado todavía. Pulsa "Editar perfil" para añadirlo.</ResumenEmpty>
                  )}
                </>
              )}
            </InfoCard>
          </motion.div>
        )}

        {/* Comunicación y voz */}
        {(cliente.energia || cliente.vozGenero || cliente.usoEmojis || cliente.estiloTexto?.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <InfoCard>
              <CardLabel>Comunicación y voz</CardLabel>
              {cliente.energia && (
                <div style={{ marginBottom: 10 }}>
                  <CardLabel>Energía</CardLabel>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>{{ calmado: 'Calmado y pausado', equilibrado: 'Equilibrado y natural', energetico: 'Energético y dinámico', intenso: 'Muy intenso' }[cliente.energia] || cliente.energia}</p>
                </div>
              )}
              {cliente.vozGenero && (
                <div style={{ marginBottom: 10 }}>
                  <CardLabel>Voz</CardLabel>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>{{ femenina: 'Femenina', masculina: 'Masculina', neutro: 'Neutra / Indistinta' }[cliente.vozGenero] || cliente.vozGenero}</p>
                </div>
              )}
              {cliente.usoEmojis && (
                <div style={{ marginBottom: 10 }}>
                  <CardLabel>Uso de emojis</CardLabel>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>{{ ninguno: 'Sin emojis', puntual: 'Puntual (máx. 1)', frecuente: 'Frecuente (2-3)', muchos: 'Muchos' }[cliente.usoEmojis] || cliente.usoEmojis}</p>
                </div>
              )}
              {cliente.estiloTexto?.length > 0 && (
                <div>
                  <CardLabel>Estilo de texto</CardLabel>
                  <div>{cliente.estiloTexto.map(e => <Tag key={e}>{e}</Tag>)}</div>
                </div>
              )}
            </InfoCard>
          </motion.div>
        )}

        {/* Kit de marca (logo + colores editables, resto de la identidad visual) */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
          <InfoCard>
            <KitMarcaCliente cliente={cliente} onSaved={onSaved} />
          </InfoCard>
        </motion.div>

        {/* Estilo de vídeos */}
        {cliente.textoVideos && (cliente.textoVideos.posicion || cliente.textoVideos.animaciones?.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
            <InfoCard>
              <CardLabel>Estilo de vídeos</CardLabel>
              {cliente.textoVideos.posicion && (
                <div style={{ marginBottom: 10 }}>
                  <CardLabel>Posición del texto</CardLabel>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>{cliente.textoVideos.posicion}</p>
                </div>
              )}
              {cliente.textoVideos.tamano && (
                <div style={{ marginBottom: 10 }}>
                  <CardLabel>Tamaño del texto</CardLabel>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>{cliente.textoVideos.tamano}</p>
                </div>
              )}
              {cliente.textoVideos.animaciones?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <CardLabel>Animaciones</CardLabel>
                  <div>{cliente.textoVideos.animaciones.map(a => <Tag key={a}>{a}</Tag>)}</div>
                </div>
              )}
              <div>
                <CardLabel>Subtítulos automáticos</CardLabel>
                <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>{cliente.textoVideos.subtitulosAuto ? `Sí — estilo ${cliente.textoVideos.estiloSubtitulos || 'no definido'}` : 'No'}</p>
              </div>
            </InfoCard>
          </motion.div>
        )}
      </div>
    </div>
    </div>
  )
})

// ─── Tab: Contenido ────────────────────────────────────────────────────────────

function TabContenido({ cliente }) {
  const [expandedGuion, setExpandedGuion] = useState(null)
  const [exportandoGuionId, setExportandoGuionId] = useState(null)

  const handleExportarGuion = async (item, e) => {
    e.stopPropagation()
    if (exportandoGuionId) return
    setExportandoGuionId(item._uid)
    try {
      await exportarGuion(cliente, item.guion, item.titulo || 'Guión')
    } catch (err) {
      console.error('Error exportando PDF:', err)
    } finally {
      setExportandoGuionId(null)
    }
  }

  // Real posts for this client, across every month — pulls out the ones that
  // actually have a generated guión, never placeholder demo content.
  const [guiones, setGuiones] = useState([])

  useEffect(() => {
    let cancelled = false
    getPostsCliente(cliente.id).then(({ data }) => {
      if (cancelled) return
      const posts = (data || []).map(post => ({ ...post, _uid: post.id, fecha: post.fecha }))
      setGuiones(posts.filter(p => p.guion).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')))
    })
    return () => { cancelled = true }
  }, [cliente.id])

  return (
    <div>
      {guiones.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>
              Todavía no hay guiones generados. Desarrolla ideas del calendario para verlos aquí.
            </p>
          )}
          {guiones.map(item => {
            const isExpanded = expandedGuion === item._uid
            return (
              <InfoCard key={item._uid} style={{ marginBottom: 12 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setExpandedGuion(isExpanded ? null : item._uid)}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{item.titulo || 'Guión'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.guion.duracion_total || ''}{item.fecha ? ` · ${item.fecha}` : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => handleExportarGuion(item, e)}
                disabled={exportandoGuionId === item._uid}
                title="Exportar PDF"
                style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.05)', border: 'none', cursor: exportandoGuionId === item._uid ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                {exportandoGuionId === item._uid
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(0,0,0,0.15)', borderTopColor: '#1D5FE0' }} />
                  : <Download size={13} color="#86868B" />}
              </motion.button>
              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                <ChevronDown size={18} color="#86868B" />
              </motion.div>
            </div>
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ paddingTop: 16 }}>
                  <HistoriaCincoLineas historia={item.guion.historia} style={{ marginBottom: 14 }} />
                  <div style={{
                    background: 'rgba(29,95,224,0.06)', borderRadius: 10, padding: '12px 14px', marginBottom: 14,
                  }}>
                    <CardLabel>Gancho</CardLabel>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', fontStyle: 'italic' }}>{item.guion.gancho}</p>
                  </div>
                  {item.guion.problema?.texto && (
                    <div style={{ marginBottom: 12 }}>
                      <CardLabel>Problema</CardLabel>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.guion.problema.texto}</p>
                    </div>
                  )}
                  {item.guion.promesa?.texto && (
                    <div style={{ marginBottom: 12 }}>
                      <CardLabel>Promesa</CardLabel>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.guion.promesa.texto}</p>
                    </div>
                  )}
                  {(item.guion.contenido?.frases?.length > 0) && (
                    <>
                      <CardLabel>Desarrollo</CardLabel>
                      {item.guion.contenido.frases.map((frase, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%', background: '#1D5FE0', color: 'white',
                            fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, marginTop: 1,
                          }}>
                            {i + 1}
                          </div>
                          <p style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{frase}</p>
                        </div>
                      ))}
                    </>
                  )}
                  {item.guion.cierre?.cta && (
                    <div style={{ marginTop: 12, background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px' }}>
                      <CardLabel>CTA</CardLabel>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.guion.cierre.cta}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
              </InfoCard>
            )
          })}
    </div>
  )
}

// ─── Tab: Facturación ──────────────────────────────────────────────────────────

const ESTADO_BADGE_FACTURACION = {
  pendiente: { label: 'Pendiente', bg: '#FF9500' },
  pagada: { label: 'Pagada', bg: '#30D158' },
  vencida: { label: 'Vencida', bg: '#FF3B30' },
  cancelada: { label: 'Cancelada', bg: '#86868B' },
  borrador: { label: 'Borrador', bg: '#86868B' },
  enviado: { label: 'Enviado', bg: '#0071E3' },
  firmado: { label: 'Firmado', bg: '#30D158' },
  rechazado: { label: 'Rechazado', bg: '#FF3B30' },
}

// Cuota mensual del cliente (lo que se le cobra cada mes). Alimenta el ingreso
// mensual recurrente y "Generar facturas del mes" en /dinero. Guarda con
// actualizarCliente() pasando el cliente completo (clienteDataParaDB mapea
// todo el perfil, así que un objeto parcial borraría el resto de campos).
// Modo de cobro del cliente (0026_modo_cobro.sql): vacío = como la
// organización (Configuración), o una excepción para este cliente.
function ModoCobroCampo({ cliente, onClienteActualizado }) {
  const { modoCobro: modoOrg } = useOrganizacion()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const valor = cliente.modoCobro || ''

  const cambiar = async (nuevo) => {
    const modo = nuevo || null
    setGuardando(true)
    setError(null)
    const { data, error: err } = await actualizarCliente(cliente.id, { ...cliente, modoCobro: modo })
    setGuardando(false)
    if (err) {
      const faltaMigracion = err.code === 'PGRST204' || err.code === '42703' || /modo_cobro/.test(err.message || '')
      setError(faltaMigracion
        ? 'Falta actualizar la base de datos para guardar el modo de cobro (migración 0026)'
        : mensajeErrorAmigable(err, 'No se pudo guardar el modo de cobro'))
      return
    }
    onClienteActualizado?.(data || { ...cliente, modoCobro: modo })
  }

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Cobro</span>
      <select
        value={valor} disabled={guardando}
        onChange={e => cambiar(e.target.value)}
        title={error || undefined}
        style={{ padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${error ? '#FF3B30' : 'var(--border-color)'}`, fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-secondary)', outline: 'none', fontFamily: 'inherit', cursor: guardando ? 'wait' : 'pointer' }}
      >
        <option value="">Como en Configuración ({etiquetaModoCobro(modoOrg).toLowerCase()})</option>
        <option value="adelantado">Por adelantado</option>
        <option value="al_entregar">Al entregar</option>
      </select>
      {error && <span style={{ fontSize: 11.5, color: '#FF3B30', maxWidth: 260 }}>{error}</span>}
    </label>
  )
}

function CuotaMensualCampo({ cliente, onClienteActualizado }) {
  const inicial = cliente.cuotaMensual != null ? String(cliente.cuotaMensual) : ''
  const [valor, setValor] = useState(inicial)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null) // { ok, texto }
  const cambiado = valor.trim() !== inicial

  const guardar = async () => {
    const numero = valor.trim() === '' ? 0 : Number(valor.replace(',', '.'))
    if (!Number.isFinite(numero) || numero < 0) { setMensaje({ ok: false, texto: 'Introduce un importe válido' }); return }
    setGuardando(true)
    setMensaje(null)
    const { data, error } = await actualizarCliente(cliente.id, { ...cliente, cuotaMensual: numero })
    setGuardando(false)
    if (error) {
      // Sin la migración 0020 la columna no existe: mensaje claro en vez del
      // error técnico de PostgREST
      const faltaMigracion = error.code === 'PGRST204' || /cuota_mensual/.test(error.message || '')
      setMensaje({ ok: false, texto: faltaMigracion
        ? 'Falta actualizar la base de datos para guardar cuotas (migración 0020)'
        : mensajeErrorAmigable(error, 'No se pudo guardar la cuota') })
      return
    }
    const actualizado = data || { ...cliente, cuotaMensual: numero }
    // Mismo formato que `inicial`, o el botón Guardar seguiría activo tras guardar 0
    setValor(actualizado.cuotaMensual != null ? String(actualizado.cuotaMensual) : '')
    onClienteActualizado?.(actualizado)
    setMensaje({ ok: true, texto: 'Cuota guardada' })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', width: '100%', boxSizing: 'border-box', padding: '14px 16px', marginBottom: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Cuota mensual (€)</span>
        <input
          type="number" min="0" step="0.01" inputMode="decimal" placeholder="0"
          value={valor}
          onChange={e => { setValor(e.target.value); setMensaje(null) }}
          onKeyDown={e => { if (e.key === 'Enter' && cambiado) guardar() }}
          style={{ width: 150, padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: 13.5, color: 'var(--text-primary)', background: 'var(--bg-secondary)', outline: 'none', fontFamily: 'inherit' }}
        />
      </label>
      <button
        onClick={guardar} disabled={!cambiado || guardando}
        style={{ padding: '8px 14px', borderRadius: 9, border: 'none', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', background: '#0071E3', color: 'white', cursor: !cambiado || guardando ? 'default' : 'pointer', opacity: !cambiado || guardando ? 0.45 : 1 }}
      >
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
      <ModoCobroCampo cliente={cliente} onClienteActualizado={onClienteActualizado} />
      <span style={{ flex: '1 1 240px', minWidth: 0, fontSize: 12, color: mensaje ? (mensaje.ok ? '#30D158' : '#FF3B30') : 'var(--text-tertiary)', paddingBottom: 8 }}>
        {mensaje ? mensaje.texto : 'Lo que le cobras cada mes. Se usa para el ingreso recurrente y las facturas mensuales.'}
      </span>
    </div>
  )
}

function TabFacturacion({ cliente, onClienteActualizado }) {
  const [subTab, setSubTab] = useState('facturas')
  const { facturas, refetch: refetchFacturas } = useFacturasCliente(cliente.id)
  const { presupuestos, refetch: refetchPresupuestos } = usePresupuestosCliente(cliente.id)
  // La numeración es por año para todos los clientes: con solo los documentos
  // de este cliente se proponían números que ya usa otro cliente
  const { facturas: todasFacturas } = useFacturasList()
  const { presupuestos: todosPresupuestos } = usePresupuestosList()
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelKey, setPanelKey] = useState(0) // bumped on every open — forces DocumentoPanel to remount with fresh initial state
  const [editando, setEditando] = useState(null)
  const [exportandoId, setExportandoId] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t) }
  }, [toast])

  const docs = subTab === 'facturas' ? facturas : presupuestos

  const abrirNuevo = () => { setEditando(null); setPanelKey(k => k + 1); setPanelOpen(true) }
  const abrirEditar = (doc) => { setEditando(doc); setPanelKey(k => k + 1); setPanelOpen(true) }

  const handleSaved = () => {
    refetchFacturas()
    refetchPresupuestos()
    setToast(subTab === 'facturas' ? 'Factura guardada' : 'Presupuesto guardado')
  }

  const handleEliminar = async (doc) => {
    if (subTab === 'facturas') await eliminarFactura(doc.id)
    else await eliminarPresupuesto(doc.id)
    refetchFacturas()
    refetchPresupuestos()
    setToast('Documento eliminado')
  }

  const handleExportar = async (doc) => {
    setExportandoId(doc.id)
    try {
      if (subTab === 'facturas') await exportarFactura(cliente, doc)
      else await exportarPresupuesto(cliente, doc)
    } catch (e) {
      setToast(e.message || 'No se pudo exportar el PDF')
    } finally {
      setExportandoId(null)
    }
  }

  const handleCopiarEnlace = async (presupuesto) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/firmar/${presupuesto.token}`)
      setToast('Enlace de firma copiado')
    } catch {
      setToast('No se pudo copiar el enlace')
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 900, position: 'relative' }}>
      <CuotaMensualCampo key={cliente.id} cliente={cliente} onClienteActualizado={onClienteActualizado} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 9, padding: 3 }}>
          {[{ id: 'facturas', label: 'Facturas' }, { id: 'presupuestos', label: 'Presupuestos' }].map(t => (
            <button
              key={t.id} onClick={() => setSubTab(t.id)}
              style={{
                padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                background: subTab === t.id ? 'var(--bg-card)' : 'transparent',
                color: subTab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: subTab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={abrirNuevo}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: '#0071E3', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit' }}
        >
          <Plus size={13} /> {subTab === 'facturas' ? 'Nueva factura' : 'Nuevo presupuesto'}
        </button>
      </div>

      {docs.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(0,113,227,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Receipt size={20} color="#0071E3" />
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Sin {subTab === 'facturas' ? 'facturas' : 'presupuestos'} todavía para {cliente.nombre}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map(doc => {
            const cfg = ESTADO_BADGE_FACTURACION[doc.estado] || { label: doc.estado, bg: '#86868B' }
            return (
              <div key={doc.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 12,
                border: '1px solid var(--border-subtle)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{doc.numero}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{doc.fechaEmision}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{Number(doc.total || 0).toFixed(2)} €</span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: cfg.bg, color: 'white' }}>
                    {cfg.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => abrirEditar(doc)} title="Editar"
                    style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Edit3 size={12} color="var(--text-primary)" />
                  </button>
                  <button onClick={() => handleExportar(doc)} disabled={exportandoId === doc.id} title="Exportar PDF"
                    style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: exportandoId === doc.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: exportandoId === doc.id ? 0.5 : 1 }}>
                    <Download size={12} color="var(--text-primary)" />
                  </button>
                  {subTab === 'presupuestos' && (
                    <button onClick={() => handleCopiarEnlace(doc)} title="Copiar enlace de firma"
                      style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LinkIcon size={12} color="var(--text-primary)" />
                    </button>
                  )}
                  <button onClick={() => handleEliminar(doc)} title="Eliminar"
                    style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={12} color="#FF3B30" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <DocumentoPanel
        key={panelKey}
        tipo={subTab === 'facturas' ? 'factura' : 'presupuesto'}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        documento={editando}
        clientes={[{ id: cliente.id, nombre: cliente.nombre }]}
        clienteIdFijo={cliente.id}
        documentosExistentes={subTab === 'facturas' ? todasFacturas : todosPresupuestos}
        onSaved={handleSaved}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              position: 'absolute', top: -8, right: 0, zIndex: 10,
              background: '#1D1D1F', color: 'white', borderRadius: 10,
              padding: '9px 14px', fontSize: 12.5, fontWeight: 500,
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <Check size={13} color="#30D158" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Paso Publicar: calendario / contenido ─────────────────────────────────────

function SubvistaEdicion({ value, onChange, compacta }) {
  const opciones = [{ id: 'calendario', label: 'Calendario' }, { id: 'contenido', label: 'Contenido' }]
  return (
    <div role="tablist" aria-label="Publicar" style={{ display: 'inline-flex', gap: 2, padding: compacta ? 2 : 3, borderRadius: compacta ? 8 : 10, background: 'var(--bg-secondary)', marginBottom: compacta ? 0 : 20 }}>
      {opciones.map(o => {
        const activo = value === o.id
        return (
          <button key={o.id} type="button" role="tab" aria-selected={activo} onClick={() => onChange(o.id)}
            style={{
              padding: compacta ? '4px 10px' : '6px 14px', borderRadius: compacta ? 6 : 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: compacta ? 12 : 13, fontWeight: compacta ? 500 : 600,
              background: activo ? 'var(--bg-card)' : 'transparent',
              color: activo ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activo ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function CargandoPaso() {
  return <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 0' }}>Cargando...</div>
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ClienteDetalle() {
  const { id } = useParams()
  const esMovil = useEsMovil()
  const navigate = useNavigate()
  const location = useLocation()
  const dropdownRef = useRef(null)
  const tabPerfilRef = useRef(null)
  // Pestaña inicial: la de tabInicial (ids antiguos como 'calendario' o
  // 'contenido' se traducen al paso Publicar) o Ideas
  // Al volver de conectar Instagram o TikTok (?instagram= / ?tiktok=) se abre Seguimiento
  const parametrosEntrada = new URLSearchParams(location.search)
  const tabDeEntrada = location.state?.tabInicial
    ?? (parametrosEntrada.has('instagram') || parametrosEntrada.has('tiktok') ? 'seguimiento' : undefined)
  const [activeTab, setActiveTab] = useState(() => resolverTab(tabDeEntrada).tab)
  const [subEdicion, setSubEdicion] = useState(() => resolverTab(location.state?.tabInicial).sub || 'calendario')
  // Mes que se ve (?mes=YYYY-MM, lo pone p. ej. «Ir a Guiones» de Ideas) o el
  // actual: el encabezado y los checks del proceso son de ese mes
  const mesUrl = /^(\d{4})-(\d{2})$/.exec(new URLSearchParams(location.search).get('mes') || '')
  const mesVisto = mesUrl && Number(mesUrl[2]) >= 1 && Number(mesUrl[2]) <= 12
    ? new Date(Number(mesUrl[1]), Number(mesUrl[2]) - 1, 1)
    : new Date()
  const [showDropdown, setShowDropdown] = useState(false)
  const [cliente, setCliente] = useState(null)
  const [clienteLoading, setClienteLoading] = useState(true)
  const [clienteError, setClienteError] = useState(null)
  const [toast, setToast] = useState(location.state?.toast || null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [portalAbierto, setPortalAbierto] = useState(false)
  // El antiguo panel lateral "Editar cliente" desapareció: el botón "Editar"
  // de la cabecera ahora solo te lleva a la pestaña Perfil, que tiene su
  // propio modo edición in situ. `perfilStartInEdit` solo importa para el
  // caso "vengo de otra pestaña" (TabPerfil se monta de cero y lee este
  // valor una sola vez al montarse); si ya estamos en Perfil, se usa
  // `tabPerfilRef` para activar el modo edición directamente en la instancia
  // ya montada, sin pasar por props.
  const [perfilStartInEdit, setPerfilStartInEdit] = useState(false)
  const { setClienteActivoId } = useClienteActivo()
  // Pasos del proceso del mes de la organización (editables en Configuración).
  // Si la pestaña abierta es un paso que se ha ocultado, se muestra el primero.
  const proceso = useProceso()
  const tab = resolverTab(activeTab, proceso.pasos).tab
  const pasoPersonalizado = proceso.pasos.find(p => p.personalizado && p.id === tab)

  useEffect(() => {
    setClienteLoading(true)
    getCliente(id).then(({ data, error }) => {
      // Abrir un cliente lo convierte en el cliente activo de las páginas de creación
      if (data?.id != null) setClienteActivoId(String(data.id))
      setCliente(data)
      setClienteError(error)
      setClienteLoading(false)
    })
  }, [id, setClienteActivoId])

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t) }
  }, [toast])

  useEffect(() => {
    const h = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Navegación en dos niveles (ClienteNavegacion): los seis pasos del proceso
  // del mes y, a la derecha, Resumen / Perfil / Facturación. Acepta también
  // los ids antiguos 'calendario' y 'contenido' (ver utils/pasosCliente.js).
  const irATab = (tabId) => {
    const { tab, sub } = resolverTab(tabId, proceso.pasos)
    setActiveTab(tab)
    if (sub) setSubEdicion(sub)
    setPerfilStartInEdit(false)
  }

  const editarPerfil = () => {
    if (activeTab === 'perfil' && tabPerfilRef.current) {
      tabPerfilRef.current.entrarEnEdicion()
    } else {
      setActiveTab('perfil')
      setPerfilStartInEdit(true)
    }
  }

  if (clienteLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, background: 'var(--gradient-bg)' }}>
        <SkeletonDetalleHeader />
      </motion.div>
    )
  }

  if (!cliente || clienteError) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-secondary)', padding: 40,
        }}
      >
        <div style={{
          background: 'var(--bg-card)', borderRadius: 18, padding: '48px 40px', textAlign: 'center',
          boxShadow: '0 2px 20px rgba(0,0,0,0.06)', maxWidth: 400,
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Cliente no encontrado
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
            El cliente con ID {id} no existe o ha sido eliminado.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/clientes')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 10,
              background: '#1D5FE0', color: 'white', border: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
            }}
          >
            <ArrowLeft size={14} /> Volver a Clientes
          </motion.button>
        </div>
      </motion.div>
    )
  }

  const activeNetworks = REDES_CONFIG.filter(r =>
    cliente.redes?.includes(r.id) || cliente.redesDetalladas?.[r.id]?.activa
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--gradient-bg)', minHeight: '100vh', position: 'relative' }}
    >
      {/* ── Header ── */}
      <div style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)',
        padding: esMovil ? '14px 16px' : '20px 40px', display: 'flex', alignItems: 'center', gap: esMovil ? 12 : 16, flexShrink: 0,
        flexWrap: esMovil ? 'wrap' : 'nowrap',
      }}>
        {/* Back */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/clientes')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'inherit',
            padding: '4px 8px', borderRadius: 8, minHeight: esMovil ? 44 : undefined,
          }}
        >
          <ArrowLeft size={15} /> Clientes
        </motion.button>

        {!esMovil && <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.1)' }} />}

        {/* Avatar */}
        <div style={{
          width: esMovil ? 44 : 56, height: esMovil ? 44 : 56, borderRadius: '50%', flexShrink: 0,
          background: `${cliente.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: cliente.color }}>
            {cliente.nombre.charAt(0)}
          </span>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: esMovil ? 22 : 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1.1, fontFamily: 'var(--font-display)' }}>
            {cliente.nombre}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 3 }}>
            {cliente.sector}{cliente.ubicacion ? ` · ${cliente.ubicacion}` : ''}
          </p>
          {/* Network badges */}
          <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
            {activeNetworks.map(r => (
              <span key={r.id} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 500,
                background: `${r.color}12`, color: r.color, border: `1px solid ${r.color}25`,
              }}>
                {r.label}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        {/* En móvil los botones bajan a su propia fila, debajo del nombre */}
        <div ref={dropdownRef} style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative', ...(esMovil ? { width: '100%', flexWrap: 'wrap' } : {}) }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setPortalAbierto(true)}
            title="Un enlace con todo lo que tu cliente tiene pendiente y sus facturas"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 10, minHeight: esMovil ? 44 : undefined,
              background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            }}
          >
            <LayoutGrid size={13} /> Portal del cliente
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={editarPerfil}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 10, minHeight: esMovil ? 44 : undefined,
              background: 'var(--accent-blue)', color: 'white', border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            }}
          >
            <Edit3 size={13} /> Editar
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowDropdown(v => !v)}
            style={{
              width: esMovil ? 44 : 36, height: esMovil ? 44 : 36, borderRadius: 10,
              background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MoreHorizontal size={16} color="#1D1D1F" />
          </motion.button>
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                style={{
                  position: 'absolute', top: esMovil ? 52 : 44, right: 0,
                  background: 'var(--bg-card)', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                  border: '1px solid var(--border-color)', minWidth: 190, zIndex: 200, overflow: 'hidden',
                }}
              >
                {[
                  { icon: Download, label: 'Exportar datos', action: () => {
                    const blob = new Blob([JSON.stringify(cliente, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href = url
                    a.download = `${cliente.nombre.replace(/\s+/g, '_')}_datos.json`; a.click()
                    URL.revokeObjectURL(url); setShowDropdown(false)
                  }},
                  { icon: Archive, label: cliente.archivado ? 'Desarchivar cliente' : 'Archivar cliente', action: async () => {
                    const updated = { ...cliente, archivado: !cliente.archivado }
                    await actualizarCliente(cliente.id, updated)
                    setCliente(updated); setShowDropdown(false)
                  }},
                ].map(({ icon: Icon, label, action }) => (
                  <button key={label} onClick={action}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 16px', border: 'none', borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--text-primary)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <Icon size={14} color="#86868B" /> {label}
                  </button>
                ))}
                <button
                  onClick={() => { setShowDropdown(false); setConfirmarEliminar(true) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: '#FF3B30' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,48,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <Trash2 size={14} color="#FF3B30" /> Eliminar cliente
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Navegación: proceso del mes + pestañas secundarias ── */}
      <ClienteNavegacion cliente={cliente} pasos={proceso.pasos} mes={mesVisto} activeTab={tab} onGoToTab={irATab} />

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: esMovil ? '20px 16px' : '32px 40px' }} onClick={() => showDropdown && setShowDropdown(false)}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {/* En "Publicar" el calendario va primero y las tareas debajo */}
            {proceso.pasos.some(p => p.id === tab) && tab !== 'edicion' && <TareasDelPaso clienteId={cliente.id} cliente={cliente} paso={tab} />}
            {tab === 'resumen' && <TabResumen cliente={cliente} onGoToTab={irATab} />}
            {tab === 'investigacion' && (
              <PasoInvestigacion cliente={cliente} onEditar={editarPerfil} onIrAKitMarca={() => irATab('perfil')} />
            )}
            {tab === 'ideas' && (
              <Suspense fallback={<CargandoPaso />}>
                <PrepararMes cliente={cliente} onIrAGuiones={(mes) => { navigate({ search: `?mes=${mes.slice(0, 7)}` }, { replace: true }); irATab('guiones') }} />
              </Suspense>
            )}
            {tab === 'guiones' && (
              <Suspense fallback={<CargandoPaso />}>
                <GuionesMes clienteId={cliente.id} cliente={cliente} onIrAPaso={irATab} />
              </Suspense>
            )}
            {tab === 'grabacion' && <PasoGrabacion cliente={cliente} onIrAGuiones={() => irATab('guiones')} />}
            {tab === 'edicion' && (
              <>
                {subEdicion === 'calendario' ? (
                  // Calendario de publicación (el de Programar publicaciones) con huecos sugeridos
                  <CalendarioPublicacion cliente={cliente} conHuecos
                    cabecera={<SubvistaEdicion compacta value={subEdicion} onChange={setSubEdicion} />} />
                ) : (
                  <>
                    <SubvistaEdicion value={subEdicion} onChange={setSubEdicion} />
                    <TabContenido cliente={cliente} />
                  </>
                )}
                <div style={{ marginTop: 20 }}>
                  <TareasDelPaso clienteId={cliente.id} cliente={cliente} paso="edicion" />
                </div>
              </>
            )}
            {tab === 'seguimiento' && <PasoSeguimiento cliente={cliente} />}
            {pasoPersonalizado && <PasoPersonalizado key={pasoPersonalizado.id} cliente={cliente} paso={pasoPersonalizado} />}
            {tab === 'facturacion' && <TabFacturacion cliente={cliente} onClienteActualizado={setCliente} />}
            {tab === 'perfil' && (
              <>
              <TabPerfil
                ref={tabPerfilRef}
                cliente={cliente}
                startInEdit={perfilStartInEdit}
                onSaved={(actualizado) => { setCliente(actualizado); setToast('Cliente actualizado correctamente') }}
                onClienteActualizado={setCliente}
              />
              <EmpezarDeCero cliente={cliente} onHecho={() => setToast('Listo: el cliente empieza de cero')} />
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            style={{
              position: 'fixed', top: 20, right: 20, zIndex: 1000,
              background: '#1D1D1F', color: 'white', borderRadius: 12,
              padding: '12px 18px', fontSize: 13, fontWeight: 500,
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <Check size={15} color="#30D158" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <PortalClienteModal open={portalAbierto} onClose={() => setPortalAbierto(false)} cliente={cliente} />

      {/* Confirm delete */}
      <AnimatePresence>
        {confirmarEliminar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setConfirmarEliminar(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '28px', maxWidth: 380, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Trash2 size={20} color="#FF3B30" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>¿Eliminar a {cliente.nombre}?</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 24 }}>Se eliminará el cliente y todo su contenido generado. Esta acción no se puede deshacer.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setConfirmarEliminar(false)}
                  style={{ flex: 1, padding: '11px', borderRadius: 12, background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                  Cancelar
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={async () => { await eliminarCliente(cliente.id); navigate('/clientes') }}
                  style={{ flex: 1, padding: '11px', borderRadius: 12, background: '#FF3B30', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                  Eliminar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
