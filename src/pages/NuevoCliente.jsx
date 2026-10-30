import { useState } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, Plus, X, Sparkles,
  MapPin, CheckCircle, AlertCircle, Camera, ImagePlus,
  User, Users, Store, MessageCircle, Megaphone, CalendarDays, Send, UserRound,
} from 'lucide-react'
import { crearCliente, actualizarCliente, useClientesList, clienteDataParaDB, mapearCliente } from '../hooks/useClientes'
import { addActividad } from '../hooks/useActividad'
import { useOrganizacion } from '../hooks/useOrganizacion'
import { useEsMovil, ALTO_BARRA_INFERIOR } from '../hooks/useEsMovil'
import { analizarWebNegocio } from '../services/ai'
import { resizeImagenCliente, procesarLogoCliente } from '../utils/fotoCliente'
import { SECTOR_MARCA_PERSONAL, COLOR_MARCA_PERSONAL, marcaPersonalDesdeForm } from '../utils/marcaPersonal'
import {
  SECTORES, TONOS, REDES_CONFIG, VALORES, FECHAS_GENERALES,
  ENERGIA_OPTS, VOZ_OPTS, EMOJIS_OPTS, ESTILO_TEXTO_PILLS,
  RANGO_PRECIO_OPTS, FRECUENCIA_OPTS, REDES_ENLACES_CAMPOS, NUM_TEMAS, PASOS_TITULOS,
  TOTAL_PASOS, defaultForm, clienteToForm,
} from './NuevoClienteData'

// ─── Shared style helpers ─────────────────────────────────────────────────────

const iStyle = (err, ai = false) => ({
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: `1.5px solid ${err ? '#FF3B30' : 'var(--border-color)'}`,
  ...(ai ? { borderLeft: '3px solid rgba(29,95,224,0.45)', background: 'rgba(29,95,224,0.015)' } : { background: 'var(--bg-card)' }),
  fontSize: 15, color: 'var(--text-primary)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
})

const pillStyle = (sel, color = '#1D5FE0') => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
  border: `1.5px solid ${sel ? color : 'var(--border-color)'}`,
  background: sel ? color : 'var(--bg-card)',
  color: sel ? 'white' : 'var(--text-primary)',
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
})

const cardStyle = (sel, color = '#1D5FE0') => ({
  position: 'relative', borderRadius: 14, padding: '16px', cursor: 'pointer',
  border: `1.5px solid ${sel ? color : 'var(--border-color)'}`,
  background: sel ? `${color}0D` : 'var(--bg-card)',
  transition: 'all 0.2s',
})

function FieldError({ msg }) {
  if (!msg) return null
  return (
    <motion.p initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }}
      style={{ fontSize: 12, color: '#FF3B30', marginTop: 5, fontWeight: 500, margin: '5px 0 0 0' }}>
      {msg}
    </motion.p>
  )
}

function Label({ children, optional, ai }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{children}</span>
      {optional && <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>(opcional)</span>}
      {ai && <span title="Rellenado automáticamente. Puedes editarlo." style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(29,95,224,0.1)', color: '#1D5FE0', letterSpacing: '0.3px' }}>IA</span>}
    </div>
  )
}

function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.7px', marginBottom: 8 }}>{children}</h2>
      {sub && <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{sub}</p>}
    </div>
  )
}

// Borde azul al enfocar, vuelta al borde normal (o rojo si hay error) al salir
const focusProps = (err) => ({
  onFocus: e => { e.target.style.borderColor = '#1D5FE0' },
  onBlur: e => { e.target.style.borderColor = err ? '#FF3B30' : 'var(--border-color)' },
})

// Lista corta de textos (competidores, cuentas de referencia): input + chips
function ListaTextos({ label, hint, placeholder, items, onChange, max = 8 }) {
  const [valor, setValor] = useState('')
  const añadir = () => {
    const v = valor.trim()
    if (!v || items.includes(v) || items.length >= max) return
    onChange([...items, v])
    setValor('')
  }
  return (
    <div style={{ marginBottom: 20 }}>
      <Label optional>{label}</Label>
      {hint && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '-4px 0 8px' }}>{hint}</p>}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {items.map((it, i) => (
            <span key={it} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 8px 6px 12px', borderRadius: 999, background: 'rgba(29,95,224,0.08)', color: '#1D5FE0', fontSize: 13, fontWeight: 500, maxWidth: '100%' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it}</span>
              <button type="button" aria-label={`Quitar ${it}`} onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={13} color="#1D5FE0" />
              </button>
            </span>
          ))}
        </div>
      )}
      {items.length < max && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={valor} onChange={e => setValor(e.target.value)} placeholder={placeholder}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); añadir() } }}
            style={{ ...iStyle(false), flex: 1 }} {...focusProps(false)} />
          <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={añadir}
            style={{ padding: '0 16px', borderRadius: 10, background: 'rgba(29,95,224,0.1)', border: '1.5px solid rgba(29,95,224,0.25)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1D5FE0', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Plus size={14} /> Añadir
          </motion.button>
        </div>
      )}
    </div>
  )
}

const etiquetaResumen = { fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }
const chipSuave = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const chipAzul = { fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(29,95,224,0.08)', color: '#1D5FE0', fontWeight: 500 }

// 'YYYY-MM-DD' -> '14 feb' (sin pasar por UTC, que en España puede restar un día)
function formatearFechaCorta(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

// identidadVisual.logo puede venir como data URL o como objeto con la URL dentro
function logoSrc(logo) {
  if (!logo) return null
  if (typeof logo === 'string') return logo
  return logo.url || logo.dataUrl || logo.src || null
}

const stepVariants = {
  enter: (d) => ({ x: d * 60, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: (d) => ({ x: d * -60, opacity: 0, transition: { duration: 0.2 } }),
}

// ─── Main component ───────────────────────────────────────────────────────────

// `externo` = modo formulario público (/formulario/<token>, ver
// FormularioCliente.jsx): lo rellena el propio cliente del gestor, sin cuenta.
// { datosIniciales: fila de clientes o null, onEnviar: async (filaDB) => { error } }.
// En ese modo no hay límite de plan ni duplicados (son cosas de la cuenta del
// gestor), ni análisis con IA (gastarían su cuota y piden sesión).
export default function NuevoCliente({ externo = null } = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const clienteEditar = externo ? null : (location.state?.cliente || null)
  const modoEdicion = !!clienteEditar
  const { clientes: clientesExistentes } = useClientesList()
  const { organizacion } = useOrganizacion()
  const esMovil = useEsMovil()
  const clienteInicialExterno = externo?.datosIniciales ? mapearCliente(externo.datosIniciales) : null

  const [paso, setPaso] = useState(1)
  const [direction, setDirection] = useState(1)
  const [form, setForm] = useState(() => {
    const base = clienteEditar || clienteInicialExterno
    if (base) return clienteToForm(base)
    // "Mi marca personal" desde la lista de clientes llega con state.marcaPersonal
    return !externo && location.state?.marcaPersonal ? { ...defaultForm, esMarcaPersonal: true } : defaultForm
  })
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState(null)
  const [showAddFecha, setShowAddFecha] = useState(false)
  const [newFecha, setNewFecha] = useState({ nombre: '', fecha: '', descripcion: '' })
  const shakeControls = useAnimation()

  // Foto de cliente (subida manual, se guarda como data-URL comprimida)
  const [fotoUrl, setFotoUrl] = useState(clienteEditar?.fotoUrl || clienteInicialExterno?.fotoUrl || null)
  // "Es el logo de la marca": la imagen subida se guarda también en
  // identidadVisual.logo, en una versión sin recortar (la foto se recorta en
  // cuadrado; el logo no). Arranca marcado si el cliente ya tiene logo.
  const [fotoEraLogo] = useState(() => {
    const base = clienteEditar || clienteInicialExterno
    return !!logoSrc(base?.identidadVisual?.logo)
  })
  const [logoNuevo, setLogoNuevo] = useState(null)
  const [fotoEsLogo, setFotoEsLogo] = useState(fotoEraLogo)
  const [fotoError, setFotoError] = useState(null)
  const [procesandoFoto, setProcesandoFoto] = useState(false)

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFotoError(null)
    setProcesandoFoto(true)
    try {
      const [dataUrl, logo] = await Promise.all([
        resizeImagenCliente(file),
        procesarLogoCliente(file).catch(() => null),
      ])
      setFotoUrl(dataUrl)
      setLogoNuevo(logo)
    } catch (err) {
      setFotoError(err.message || 'No se pudo procesar la imagen')
    } finally {
      setProcesandoFoto(false)
    }
  }

  // Análisis web (paso 1)
  const [analizandoWeb, setAnalizandoWeb] = useState(false)
  const [webAnalizada, setWebAnalizada] = useState(false)
  const [camposIA, setCamposIA] = useState([])
  const [errorAnalisis, setErrorAnalisis] = useState(null)

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const toggleArr = (key, id) => setForm(f => ({ ...f, [key]: f[key].includes(id) ? f[key].filter(x => x !== id) : [...f[key], id] }))
  const updateRed = (redId, field, val) => setForm(f => ({ ...f, redes: { ...f.redes, [redId]: { ...f.redes[redId], [field]: val } } }))
  const updateEnlace = (redId, val) => setForm(f => ({ ...f, redesEnlaces: { ...f.redesEnlaces, [redId]: val } }))
  const updateTema = (idx, val) => setForm(f => ({ ...f, temas: f.temas.map((t, i) => (i === idx ? val : t)) }))
  const updateMp = (campo, val) => setForm(f => ({ ...f, marcaPersonal: { ...f.marcaPersonal, [campo]: val } }))
  const esMp = !externo && form.esMarcaPersonal
  const cambiarTipo = (mp) => setForm(f => ({
    ...f, esMarcaPersonal: mp,
    sector: mp ? SECTOR_MARCA_PERSONAL : (f.sector === SECTOR_MARCA_PERSONAL ? '' : f.sector),
  }))
  // Copy para el gestor (interno) o para el propio cliente (externo). La marca
  // personal es del propio gestor, así que también va en segunda persona.
  const tx = (interno, paraCliente) => (externo || esMp ? paraCliente : interno)


  const TICKET_MAP = { menos_15: 'Menos de 15€', '15_30': '15-30€', '30_60': '30-60€', mas_60: 'Más de 60€', no_aplica: 'No aplica' }
  const TONO_VALID = ['cercano_divertido', 'desenfadado_ironico', 'aspiracional', 'profesional', 'energetico', 'familiar_calido']

  const [confianzaIA, setConfianzaIA] = useState(null)

  const aplicarDatosWeb = (datos) => {
    setConfianzaIA(datos.confianza || null)
    setForm(prev => {
      const next = { ...prev }
      if (datos.nombre && !prev.nombre) next.nombre = datos.nombre
      if (datos.sector) {
        const s = SECTORES.find(x => x.label.toLowerCase() === datos.sector.toLowerCase())
        if (s) next.sector = s.id
      }
      if (datos.sectorCustom) next.sectorCustom = datos.sectorCustom
      if (datos.descripcion) next.descripcion = datos.descripcion
      if (datos.diferencial) next.diferencial = datos.diferencial
      if (datos.ubicacion) next.ubicacion = datos.ubicacion
      if (datos.ticketMedio) next.ticketMedio = TICKET_MAP[datos.ticketMedio] || datos.ticketMedio
      if (datos.audiencia) {
        const a = datos.audiencia
        if (a.edadMin) next.edadMin = a.edadMin
        if (a.edadMax) next.edadMax = a.edadMax
        if (a.genero) next.genero = a.genero
        if (a.descripcion) next.audienciaDesc = a.descripcion
        if (a.valores?.length) next.valores = a.valores
      }
      if (datos.tono) {
        const t = datos.tono === 'profesional_serio' ? 'profesional' : datos.tono
        if (TONO_VALID.includes(t)) next.tono = t
      }
      if (datos.energia) next.energia = datos.energia
      if (datos.usoEmojis) next.usoEmojis = datos.usoEmojis
      if (datos.redesSociales) {
        const redes = { ...prev.redes }
        Object.entries(datos.redesSociales).forEach(([red, activa]) => {
          const redKey = red === 'googleMaps' ? 'googlemaps' : red
          if (activa && redes[redKey]) redes[redKey] = { ...redes[redKey], activa: true, frecuencia: '3x_semana', objetivo: 'engagement' }
        })
        next.redes = redes
      }
      if (datos.estetica?.length || datos.referenciaEstetica) {
        next.identidadVisual = {
          ...prev.identidadVisual,
          ...(datos.estetica?.length && { estetica: datos.estetica }),
          ...(datos.referenciaEstetica && { referenciaEstetica: datos.referenciaEstetica }),
        }
      }
      if (datos.hashtagsConocidos?.length) next.hashtagsPropio = datos.hashtagsConocidos.join(' ')
      return next
    })
    const campos = []
    if (datos.nombre) campos.push('nombre')
    if (datos.sector) campos.push('sector')
    if (datos.sectorCustom) campos.push('sectorCustom')
    if (datos.descripcion) campos.push('descripcion')
    if (datos.diferencial) campos.push('diferencial')
    if (datos.ubicacion) campos.push('ubicacion')
    if (datos.ticketMedio) campos.push('ticketMedio')
    if (datos.audiencia?.edadMin) campos.push('edadMin')
    if (datos.audiencia?.edadMax) campos.push('edadMax')
    if (datos.audiencia?.genero) campos.push('genero')
    if (datos.audiencia?.descripcion) campos.push('audienciaDesc')
    if (datos.tono) campos.push('tono')
    if (datos.energia) campos.push('energia')
    if (datos.usoEmojis) campos.push('usoEmojis')
    if (datos.hashtagsConocidos?.length) campos.push('hashtagsPropio')
    setCamposIA(campos)
  }

  const handleAnalizarWeb = async () => {
    const url = form.web.trim()
    if (!url || analizandoWeb) return
    setAnalizandoWeb(true)
    setErrorAnalisis(null)
    setWebAnalizada(false)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const datos = await analizarWebNegocio(url, form.nombre, controller.signal)
      clearTimeout(timer)
      aplicarDatosWeb(datos)
      setWebAnalizada(true)
    } catch (e) {
      clearTimeout(timer)
      setErrorAnalisis(
        e.name === 'AbortError'
          ? 'El análisis tardó demasiado. Continúa manualmente.'
          : 'No pudimos analizar esa URL. Rellena los campos manualmente.'
      )
    } finally {
      setAnalizandoWeb(false)
    }
  }

  const validar = (p) => {
    const e = {}
    if (p === 1) {
      if (!form.nombre.trim()) e.nombre = esMp ? 'Pon tu nombre o el de tu marca' : 'El nombre del negocio es obligatorio'
      else if (!externo && clientesExistentes.some(c =>
        c.nombre?.trim().toLowerCase() === form.nombre.trim().toLowerCase() && c.id !== clienteEditar?.id
      )) e.nombre = 'Ya tienes un cliente con este nombre'
      if (!esMp && !form.sector) e.sector = 'Selecciona el sector del negocio'
      if (esMp && !form.marcaPersonal.negocio.trim()) e.mpNegocio = 'Dinos para qué negocio quieres conseguir clientes'
    }
    if (p === 1 && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Revisa el email, parece que falta algo'
    if (p === 2 && !form.descripcion.trim()) e.descripcion = esMp ? 'Cuenta brevemente de qué hablas' : 'Describe brevemente el negocio'
    if (p === 4 && !form.tono) e.tono = 'Selecciona el tono de voz'
    if (p === 5 && !Object.values(form.redes).some(r => r.activa)) e.redes = 'Activa al menos una red social'
    return e
  }

  const siguiente = async () => {
    const e = validar(paso)
    if (Object.keys(e).length > 0) {
      setErrores(e)
      shakeControls.start({ x: [0, -7, 7, -7, 7, 0], transition: { duration: 0.35 } })
      return
    }
    setErrores({})
    setDirection(1)
    setPaso(p => p + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const anterior = () => {
    setDirection(-1)
    setErrores({})
    setPaso(p => Math.max(1, p - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addFechaPropia = () => {
    if (!newFecha.nombre.trim() || form.fechasPropias.length >= 5) return
    setForm(f => ({ ...f, fechasPropias: [...f.fechasPropias, { ...newFecha, id: Date.now() }] }))
    setNewFecha({ nombre: '', fecha: '', descripcion: '' })
    setShowAddFecha(false)
  }

  const guardar = async () => {
    setGuardando(true)
    const sectorData = SECTORES.find(s => s.id === form.sector) || {}
    const tonoData = TONOS.find(t => t.id === form.tono) || {}
    const redesActivas = Object.entries(form.redes).filter(([, v]) => v.activa).map(([k]) => k)
    const freqMap = { '1x_semana': 1, '2x_semana': 2, '3x_semana': 3, 'diario': 7 }
    const frecuencia = Object.fromEntries(
      Object.entries(form.redes).filter(([, v]) => v.activa).map(([k, v]) => [k, freqMap[v.frecuencia] || 3])
    )
    // Historial y vídeos ya no se preguntan, pero siguen en `form` (cargados
    // por clienteToForm) y se reescriben tal cual: editar no los borra.
    let identidadVisual = form.identidadVisual || {}
    // Con la casilla marcada: imagen nueva subida → su versión sin recortar;
    // sin imagen nueva, el logo que ya había se queda como estaba.
    if (fotoUrl && fotoEsLogo && (logoNuevo || !identidadVisual.logo)) {
      identidadVisual = { ...identidadVisual, logo: logoNuevo || fotoUrl }
    } else if (!fotoEsLogo && fotoEraLogo) {
      identidadVisual = { ...identidadVisual }
      delete identidadVisual.logo
    }
    const datosCliente = {
      nombre: form.nombre,
      fotoUrl: fotoUrl || null,
      sector: esMp ? SECTOR_MARCA_PERSONAL : (sectorData.label || form.sector),
      sectorCustom: form.sectorCustom || '',
      web: form.web || form.webCarta || '',
      descripcion: form.descripcion,
      diferencial: form.diferencial,
      ubicacion: form.ubicacion,
      ticketMedio: form.ticketMedio,
      // Onboarding v2 (columnas de 0023; clienteDataParaDB solo las envía con valor)
      nombreContacto: form.nombreContacto,
      email: form.email,
      telefono: form.telefono,
      googleMaps: form.googleMaps,
      redesEnlaces: form.redesEnlaces,
      porQueElegirnos: form.porQueElegirnos,
      rangoPrecio: form.rangoPrecio,
      temas: form.temas.map(t => t.trim()).filter(Boolean),
      barrerasInternas: form.barrerasInternas,
      barrerasExternas: form.barrerasExternas,
      publicoObjetivo: form.publicoObjetivo,
      queBuscan: form.queBuscan,
      competidores: form.competidores,
      cuentasReferencia: form.cuentasReferencia,
      ritmoPublicacion: form.ritmoPublicacion,
      audiencia: { edadMin: form.edadMin, edadMax: form.edadMax, genero: form.genero, descripcion: form.audienciaDesc, valores: form.valores },
      tono: tonoData.label || form.tono,
      tonoId: form.tono,
      vozPropia: form.vozPropia,
      prohibido: form.prohibido,
      energia: form.energia,
      vozGenero: form.vozGenero,
      usoEmojis: form.usoEmojis,
      estiloTexto: form.estiloTexto,
      redes: redesActivas,
      frecuencia,
      redesDetalladas: form.redes,
      contenidoBueno: form.queHaFuncionado,
      contenidoMalo: form.prohibido,
      historial: { queHaFuncionado: form.queHaFuncionado, mejorPost: form.mejorPost, hashtagsPropio: form.hashtagsPropio, referencias: form.referencias },
      fechasClave: [...form.fechasGenerales, ...form.fechasPropias.map(f => f.nombre)].join(', ') + (form.temporada ? '. ' + form.temporada : ''),
      fechasClaveObj: { generales: form.fechasGenerales, propias: form.fechasPropias, temporada: form.temporada },
      identidadVisual,
      textoVideos: form.textoVideos,
      videosCliente: form.videosCliente,
      videosReferencia: form.videosReferencia,
      avatar: form.nombre.charAt(0).toUpperCase(),
      color: esMp ? COLOR_MARCA_PERSONAL : (sectorData.color || clienteEditar?.color || '#86868B'),
      ultimaActividad: 'Ahora mismo',
      // false = no es marca personal (clienteDataParaDB escribe null)
      ...(externo ? {} : { marcaPersonal: esMp ? marcaPersonalDesdeForm(form.marcaPersonal) : false }),
      perfilComunicacion: form.perfilComunicacion || null,
    }

    if (externo) {
      // organizacion_id lo fija el enlace en el servidor, nunca el visitante
      const filaDB = clienteDataParaDB(datosCliente)
      delete filaDB.organizacion_id
      setErrorEnvio(null)
      const { error } = await externo.onEnviar(filaDB)
      if (error) setErrorEnvio(error.message || 'No se pudo enviar el formulario. Inténtalo de nuevo.')
      setGuardando(false)
      return
    }

    if (modoEdicion) {
      await actualizarCliente(clienteEditar.id, { ...clienteEditar, ...datosCliente })
      addActividad({ tipo: 'cliente', descripcion: `Cliente actualizado: ${datosCliente.nombre}`, clienteNombre: datosCliente.nombre, count: 0 })
      await new Promise(r => setTimeout(r, 600))
      navigate(`/clientes/${clienteEditar.id}`, { state: { toast: 'Cliente actualizado correctamente' } })
    } else {
      const nuevoCliente = { ...datosCliente, postsEsteMes: 0, creadoEn: new Date().toISOString(), organizacionId: organizacion?.id || null }
      const { data: clienteCreado } = await crearCliente(nuevoCliente)
      addActividad({ tipo: 'cliente', descripcion: `Nuevo cliente añadido: ${nuevoCliente.nombre}`, clienteNombre: nuevoCliente.nombre, count: 1 })
      await new Promise(r => setTimeout(r, 500))
      navigate(`/clientes/${clienteCreado.id}`, { state: { toast: 'Cliente creado correctamente' } })
    }
  }

  const isResumen = paso === TOTAL_PASOS + 1

  return (
    <div style={{ flex: 1, background: 'var(--gradient-bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Progress bar */}
      {!isResumen && (
        <div style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-color)', padding: '16px 40px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {modoEdicion ? 'Editando cliente' : `Paso ${paso}`} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{!modoEdicion && `de ${TOTAL_PASOS}`} · {PASOS_TITULOS[paso - 1]}</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{Math.round((paso / TOTAL_PASOS) * 100)}% completado</span>
            </div>
            <div style={{ height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                animate={{ width: `${(paso / TOTAL_PASOS) * 100}%` }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #007BFF, #4DA3FF)', borderRadius: 2 }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step content */}
      <div style={{ flex: 1, padding: isResumen ? '48px 40px' : '48px 40px 120px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {isResumen ? renderResumen() : (
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div key={paso} custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                <motion.div animate={shakeControls}>
                  {paso === 1 && renderPaso1()}
                  {paso === 2 && renderPaso2()}
                  {paso === 3 && renderPaso3()}
                  {paso === 4 && renderPaso4()}
                  {paso === 5 && renderPaso5()}
                  {paso === 6 && renderPaso6()}
                </motion.div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Nav buttons */}
      {!isResumen && (
        <div style={{ position: 'fixed', bottom: !externo && esMovil ? `calc(${ALTO_BARRA_INFERIOR}px + env(safe-area-inset-bottom))` : 0, left: externo || esMovil ? 0 : 240, right: 0, background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border-color)', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={anterior}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 12, fontSize: 14, fontWeight: 500, background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', cursor: 'pointer', color: paso === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)', fontFamily: 'inherit', opacity: paso === 1 ? 0.4 : 1, pointerEvents: paso === 1 ? 'none' : 'auto' }}>
            <ArrowLeft size={16} /> Atrás
          </motion.button>
          <motion.button whileHover={{ backgroundColor: '#1850BE' }} whileTap={{ scale: 0.97 }} onClick={siguiente}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 12, fontSize: 14, fontWeight: 600, background: '#1D5FE0', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 16px rgba(29,95,224,0.3)', transition: 'background 0.2s' }}>
            {paso === TOTAL_PASOS ? 'Ver resumen' : 'Continuar'} <ArrowRight size={16} />
          </motion.button>
        </div>
      )}
    </div>
  )

  // ─── Helpers de campos (funciones, no componentes: no remontan inputs) ────────

  function campoTexto({ key, label, placeholder, optional, textarea, rows = 3, error, ai, hint, type = 'text' }) {
    const conError = errores[error || key]
    return (
      <div key={key} style={{ marginBottom: 20 }}>
        <Label optional={optional} ai={ai}>{label}</Label>
        {hint && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '-4px 0 8px', lineHeight: 1.5 }}>{hint}</p>}
        {textarea ? (
          <textarea value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} rows={rows}
            style={{ ...iStyle(conError, ai), resize: 'vertical', lineHeight: 1.55 }} {...focusProps(conError)} />
        ) : (
          <input type={type} value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder}
            style={iStyle(conError, ai)} {...focusProps(conError)} />
        )}
        <FieldError msg={conError} />
      </div>
    )
  }

  // Marca personal: para qué negocio quiere clientes y a quién (form.marcaPersonal)
  function campoMp({ campo, label, placeholder, hint, optional, textarea, rows = 2, error }) {
    const conError = error && errores[error]
    const props = { value: form.marcaPersonal[campo], onChange: e => updateMp(campo, e.target.value), placeholder, ...focusProps(conError) }
    return (
      <div key={campo} style={{ marginBottom: 18 }}>
        <Label optional={optional}>{label}</Label>
        {hint && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '-4px 0 8px', lineHeight: 1.5 }}>{hint}</p>}
        {textarea
          ? <textarea rows={rows} {...props} style={{ ...iStyle(conError), resize: 'vertical', lineHeight: 1.55 }} />
          : <input {...props} style={iStyle(conError)} />}
        <FieldError msg={conError} />
      </div>
    )
  }

  function renderCamposMarcaPersonal() {
    return (
      <div style={{ marginBottom: 24, padding: 16, borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Para qué es tu marca personal</p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>
          Las ideas, guiones y copies irán enfocados a que tu cliente ideal confíe en ti y te contrate.
        </p>
        {campoMp({ campo: 'negocio', label: '¿Para qué negocio quieres conseguir clientes?', placeholder: 'Ej: mi agencia de contenido', error: 'mpNegocio' })}
        {campoMp({ campo: 'oferta', label: '¿Qué vende ese negocio?', placeholder: 'Ej: contenido orgánico para redes: grabamos, editamos y publicamos cada semana', textarea: true, optional: true })}
        {campoMp({ campo: 'clienteIdeal', label: '¿A quién quieres conseguir como cliente?', placeholder: 'Ej: dueños de peluquerías y restaurantes que no tienen tiempo para redes', textarea: true, optional: true })}
        {campoMp({ campo: 'llamadaAccion', label: '¿Qué quieres que hagan al ver tu contenido?', placeholder: 'Ej: que me escriban "CONTENIDO" por DM para una llamada de 15 minutos', optional: true })}
        {campoMp({ campo: 'historia', label: 'Tu historia y credenciales', hint: 'De dónde vienes, con quién has trabajado, resultados reales. La IA no inventará ninguno.', placeholder: 'Ej: llevo 5 años grabando contenido para negocios locales, empecé con la peluquería de mi barrio...', textarea: true, rows: 3, optional: true })}
      </div>
    )
  }

  // ─── PASO 1: Quién es ─────────────────────────────────────────────────────────

  function renderPaso1() {
    return (
      <>
        <SectionTitle sub={tx('Lo esencial para saber con quién trabajamos y dónde encontrarle.', 'Lo esencial para conocerte y saber dónde encontrarte.')}>
          {esMp ? 'Tu marca personal' : tx('¿Quién es el cliente?', 'Cuéntanos quién eres')}
        </SectionTitle>

        {!externo && !modoEdicion && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 24 }}>
            {[
              { mp: false, icon: Store, label: 'Negocio de un cliente', desc: 'Una marca a la que le llevas las redes' },
              { mp: true, icon: UserRound, label: 'Mi marca personal', desc: 'Tu cuenta, para conseguir clientes para tu negocio' },
            ].map(o => {
              const sel = form.esMarcaPersonal === o.mp
              return (
                <motion.div key={o.label} whileTap={{ scale: 0.97 }} onClick={() => cambiarTipo(o.mp)} style={{ ...cardStyle(sel), display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <o.icon size={20} color={sel ? '#1D5FE0' : '#86868B'} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: sel ? '#1D5FE0' : 'var(--text-primary)', margin: '0 0 3px' }}>{o.label}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{o.desc}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Foto o logo */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 18, padding: 16, borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <label htmlFor="foto-cliente-input" style={{
            position: 'relative', width: 88, height: 88, borderRadius: 22, flexShrink: 0,
            cursor: procesandoFoto ? 'not-allowed' : 'pointer', overflow: 'hidden',
            border: `1.5px dashed ${fotoUrl ? 'transparent' : 'var(--border-color)'}`,
            background: fotoUrl ? `url(${fotoUrl}) center/cover no-repeat` : 'var(--bg-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {!fotoUrl && (procesandoFoto
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.15)', borderTopColor: '#1D5FE0' }} />
              : <ImagePlus size={24} color="#86868B" strokeWidth={1.8} />)}
            {fotoUrl && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = 1 }} onMouseLeave={e => { e.currentTarget.style.opacity = 0 }}>
                <Camera size={18} color="white" strokeWidth={1.8} />
              </div>
            )}
            <input id="foto-cliente-input" type="file" accept="image/*" onChange={handleFotoChange} disabled={procesandoFoto} style={{ display: 'none' }} />
          </label>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px' }}>Foto o logo <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>(opcional)</span></p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {fotoUrl ? 'Toca la imagen para cambiarla.' : tx('Se mostrará en el dashboard y en el resumen.', 'Sube tu logo o una foto que te represente.')}
            </p>
            {fotoUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={fotoEsLogo} onChange={e => setFotoEsLogo(e.target.checked)} style={{ accentColor: '#1D5FE0', width: 15, height: 15 }} />
                  Es el logo de la marca
                </label>
                <button type="button" onClick={() => { setFotoUrl(null); setLogoNuevo(null); setFotoEsLogo(false) }}
                  style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}>
                  Quitar imagen
                </button>
              </div>
            )}
            {fotoError && <p style={{ fontSize: 11, color: '#FF3B30', margin: '4px 0 0' }}>{fotoError}</p>}
          </div>
        </div>

        {/* Nombre del negocio */}
        <div style={{ marginBottom: 20 }}>
          <Label ai={camposIA.includes('nombre')}>{esMp ? 'Tu nombre o el de tu marca' : 'Nombre del negocio'}</Label>
          <input value={form.nombre} onChange={e => update('nombre', e.target.value)} placeholder={esMp ? 'Ej: Laura Martínez' : 'Ej: Café Aurora'} autoFocus
            style={{ ...iStyle(errores.nombre, camposIA.includes('nombre')), fontSize: 20, padding: '14px 16px', fontWeight: 500 }}
            {...focusProps(errores.nombre)} />
          <FieldError msg={errores.nombre} />
        </div>

        {esMp ? renderCamposMarcaPersonal() : campoTexto({ key: 'nombreContacto', label: tx('Nombre del cliente (persona de contacto)', 'Tu nombre'), placeholder: 'Ej: Laura Martínez', optional: true })}

        {/* URL + Analizar */}
        <div style={{ marginBottom: 16 }}>
          <Label optional>Página web</Label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={form.web}
              onChange={e => {
                update('web', e.target.value)
                if (webAnalizada) { setWebAnalizada(false); setCamposIA([]) }
              }}
              onBlur={() => { if (!externo && form.web.trim() && !webAnalizada && !analizandoWeb) handleAnalizarWeb() }}
              placeholder="https://..."
              disabled={analizandoWeb}
              style={{ ...iStyle(false), flex: 1 }}
              onFocus={e => e.target.style.borderColor = '#1D5FE0'}
            />
            {!externo && <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAnalizarWeb}
              disabled={!form.web.trim() || analizandoWeb}
              style={{
                padding: '0 18px', borderRadius: 10, border: 'none', cursor: !form.web.trim() || analizandoWeb ? 'not-allowed' : 'pointer',
                background: !form.web.trim() || analizandoWeb ? '#86868B' : '#1D5FE0',
                color: 'white', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'background 0.2s',
              }}>
              {analizandoWeb
                ? <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', flexShrink: 0 }} />
                    Analizando...
                  </>
                : <><Sparkles size={13} /> Analizar con IA</>
              }
            </motion.button>}
          </div>

          {analizandoWeb && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
              Analizando el negocio... esto puede tardar unos segundos.
            </p>
          )}

          {errorAnalisis && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '9px 12px', background: 'rgba(255,149,0,0.08)', borderRadius: 8, border: '1px solid rgba(255,149,0,0.2)' }}>
              <AlertCircle size={13} color="#FF9500" />
              <span style={{ fontSize: 12, color: '#FF9500' }}>{errorAnalisis}</span>
            </div>
          )}
        </div>

        {/* Badge éxito */}
        <AnimatePresence>
          {webAnalizada && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              style={{ marginBottom: 12, padding: '12px 16px', background: 'rgba(48,209,88,0.06)', borderRadius: 12, border: '1px solid rgba(48,209,88,0.2)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <CheckCircle size={14} color="#30D158" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#30D158' }}>Información importada automáticamente</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Hemos rellenado lo que hemos encontrado. Revisa y ajusta si algo no es correcto.
                </p>
              </div>
              <button
                onClick={() => { setWebAnalizada(false); setCamposIA([]); setErrorAnalisis(null); setConfianzaIA(null); setForm(defaultForm) }}
                style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', padding: 0, flexShrink: 0, marginTop: 2 }}>
                Limpiar y empezar de cero
              </button>
            </motion.div>
          )}
          {webAnalizada && (confianzaIA === 'baja' || confianzaIA === 'media') && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              style={{ marginBottom: 20, padding: '11px 14px', background: 'rgba(255,149,0,0.07)', borderRadius: 10, border: '1px solid rgba(255,149,0,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={13} color="#FF9500" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#CC7700' }}>Algunos datos son estimaciones. Revísalos antes de continuar.</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sector */}
        {!esMp && <div style={{ marginBottom: 24 }}>
          <Label ai={camposIA.includes('sector')}>Sector</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {SECTORES.map(s => (
              <motion.div key={s.id} whileTap={{ scale: 0.97 }} onClick={() => update('sector', s.id)}
                style={cardStyle(form.sector === s.id)}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <s.icon size={22} color={form.sector === s.id ? '#1D5FE0' : '#86868B'} strokeWidth={1.8} />
                </div>
                <p style={{ fontSize: 12, fontWeight: form.sector === s.id ? 600 : 500, color: form.sector === s.id ? '#1D5FE0' : 'var(--text-primary)', margin: 0, textAlign: 'center' }}>{s.label}</p>
              </motion.div>
            ))}
          </div>
          <FieldError msg={errores.sector} />
        </div>}

        <AnimatePresence>
          {!esMp && form.sector === 'otro' && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ marginBottom: 24 }}>
              <Label>¿Cuál es tu sector?</Label>
              <input value={form.sectorCustom} onChange={e => update('sectorCustom', e.target.value)} placeholder="Ej: Fotografía, Consultoría..."
                style={iStyle(false)} onFocus={e => e.target.style.borderColor = '#1D5FE0'} onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.12)'} />
            </motion.div>
          )}
        </AnimatePresence>

        {!esMp && campoTexto({ key: 'googleMaps', label: 'Google Maps', placeholder: 'Enlace a la ficha de Google Maps', optional: true })}
        {campoTexto({ key: 'ubicacion', label: tx('Ubicación', '¿Dónde estás?'), placeholder: 'Ej: Puzol, Valencia', optional: true, ai: camposIA.includes('ubicacion') })}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 14 }}>
          {campoTexto({ key: 'email', label: 'Email', placeholder: 'hola@negocio.com', optional: true, type: 'email' })}
          {campoTexto({ key: 'telefono', label: 'Teléfono', placeholder: 'Ej: 600 123 456', optional: true, type: 'tel' })}
        </div>

        <div style={{ marginBottom: 8 }}>
          <Label optional>Instagram y otras redes</Label>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '-4px 0 10px' }}>Pon el @ o el enlace. Solo las que tenga{tx('', 's')}.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {REDES_ENLACES_CAMPOS.map(r => (
              <div key={r.id} style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: 7, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.3px', textTransform: 'uppercase' }}>{r.label}</span>
                <input value={form.redesEnlaces?.[r.id] || ''} onChange={e => updateEnlace(r.id, e.target.value)} placeholder={r.placeholder}
                  style={{ ...iStyle(false), paddingTop: 22, paddingBottom: 8, fontSize: 14 }} {...focusProps(false)} />
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  // ─── PASO 2: Qué hace ─────────────────────────────────────────────────────────

  function renderPaso2() {
    const temasRellenos = form.temas.filter(t => t.trim()).length
    return (
      <>
        <SectionTitle sub={tx('Cuanto más detalle, mejor contenido genera la IA.', 'Cuanto más detalle, mejor será tu contenido.')}>
          {esMp ? '¿De qué hablas?' : tx('¿Qué hace el negocio?', '¿Qué haces?')}
        </SectionTitle>

        {esMp
          ? campoTexto({ key: 'descripcion', label: '¿De qué hablas en tu marca personal?', placeholder: 'Ej: cómo hacemos contenido para negocios locales, el día a día de montar una agencia, lo que aprendo con cada cliente...', textarea: true, rows: 4 })
          : campoTexto({ key: 'descripcion', label: tx('¿Qué vende o qué ofrece?', '¿Qué vendes o qué ofreces?'), placeholder: 'Ej: Restaurante de hamburguesas artesanales en primera línea de playa...', textarea: true, rows: 4, ai: camposIA.includes('descripcion') })}
        {campoTexto({ key: 'diferencial', label: 'Punto diferencial', placeholder: 'Ej: Únicos en la zona con hamburguesas al momento y ambiente de playa...', textarea: true, optional: true, ai: camposIA.includes('diferencial') })}
        {campoTexto({ key: 'porQueElegirnos', label: tx('¿Por qué elegirlos a ellos y no al resto?', '¿Por qué te eligen a ti y no al resto?'), placeholder: 'Ej: Trato cercano, te conocen por tu nombre, resultados que se notan en 4 semanas...', textarea: true, optional: true })}

        {/* Rango de precio */}
        <div style={{ marginBottom: 20 }}>
          <Label optional ai={camposIA.includes('ticketMedio')}>Rango de precio</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 10 }}>
            {RANGO_PRECIO_OPTS.map(r => {
              const sel = form.rangoPrecio === r.id
              return (
                <motion.div key={r.id} whileTap={{ scale: 0.97 }} onClick={() => update('rangoPrecio', sel ? '' : r.id)} style={{ ...cardStyle(sel), padding: '14px 12px' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: sel ? '#1D5FE0' : 'var(--text-primary)', margin: '0 0 3px' }}>{r.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{r.desc}</p>
                </motion.div>
              )
            })}
          </div>
          <input value={form.ticketMedio} onChange={e => update('ticketMedio', e.target.value)}
            placeholder="Precio orientativo (opcional). Ej: menú a 15 €, sesiones desde 40 €"
            style={iStyle(false, camposIA.includes('ticketMedio'))} {...focusProps(false)} />
        </div>

        {/* 5 temas */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <Label optional>{tx('Divide su sector en 5 temas', 'Divide tu sector en 5 temas')}</Label>
            <span style={{ fontSize: 12, fontWeight: 600, color: temasRellenos >= 3 ? '#1D5FE0' : 'var(--text-tertiary)' }}>{temasRellenos} de {NUM_TEMAS}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '-2px 0 12px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 10, lineHeight: 1.55 }}>
            Son los grandes temas de los que se puede hablar en el sector. Recomendamos al menos 3.
            <br />{esMp
              ? <><strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Ejemplo · Marca personal de agencia:</strong> Casos de clientes, Detrás de cámaras, Errores en redes, Mi historia, Cómo trabajamos.</>
              : <><strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Ejemplo · Nicho fitness:</strong> Cardio, Fuerza, Movilidad, Hipertrofia, Nutrición.</>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {form.temas.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: t.trim() ? '#D7FF3D' : 'var(--bg-secondary)', color: t.trim() ? '#0B0C10' : 'var(--text-tertiary)', transition: 'all 0.2s' }}>{i + 1}</span>
                <input value={t} onChange={e => updateTema(i, e.target.value)} placeholder={`Tema ${i + 1}`} maxLength={60}
                  style={{ ...iStyle(false), padding: '9px 12px', fontSize: 14 }} {...focusProps(false)} />
              </div>
            ))}
          </div>
        </div>

        {/* Valores (se guardan en audiencia.valores, como siempre) */}
        <div style={{ marginBottom: 24 }}>
          <Label optional>{tx('Valores con los que conecta la marca', 'Valores con los que conecta tu marca')}</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {VALORES.map(v => {
              const sel = form.valores.includes(v.id)
              return (
                <motion.button key={v.id} whileTap={{ scale: 0.94 }} onClick={() => toggleArr('valores', v.id)} style={pillStyle(sel)}>
                  <v.icon size={12} style={{ flexShrink: 0 }} /> {v.label}
                </motion.button>
              )
            })}
          </div>
        </div>

        {campoTexto({ key: 'barrerasInternas', label: 'Barreras internas', hint: tx('Lo que les frena por dentro a la hora de crear contenido.', 'Lo que te frena por dentro a la hora de crear contenido.'), placeholder: 'Ej: vergüenza a salir en cámara, poco tiempo para grabar...', textarea: true, rows: 2, optional: true })}
        {campoTexto({ key: 'barrerasExternas', label: 'Barreras externas', hint: 'Límites del mercado, la competencia o el presupuesto.', placeholder: 'Ej: mucha competencia en la zona, presupuesto ajustado, sector muy regulado...', textarea: true, rows: 2, optional: true })}
      </>
    )
  }

  // ─── PASO 3: A quién vende ────────────────────────────────────────────────────

  function renderPaso3() {
    const generoOpts = [{ id: 'mixto', label: 'Mixto' }, { id: 'mujer', label: 'Mayoría mujeres' }, { id: 'hombre', label: 'Mayoría hombres' }]
    return (
      <>
        <SectionTitle sub="Definir bien a quién se vende es la diferencia entre contenido que conecta y contenido que pasa desapercibido.">
          {tx('¿A quién vende?', '¿A quién vendes?')}
        </SectionTitle>

        <div style={{ marginBottom: 28 }}>
          <Label>Rango de edad</Label>
          <div style={{ display: 'inline-block', background: '#1D5FE0', color: 'white', borderRadius: 20, padding: '7px 18px', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
            Audiencia principal: {form.edadMin}–{form.edadMax} años
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[{ key: 'edadMin', label: 'Desde', min: 18, max: form.edadMax - 1 }, { key: 'edadMax', label: 'Hasta', min: form.edadMin + 1, max: 65 }].map(s => (
              <div key={s.key} style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{s.label} <strong style={{ color: 'var(--text-primary)' }}>{form[s.key]}</strong> años</p>
                <input type="range" min={s.min} max={s.max} value={form[s.key]} onChange={e => update(s.key, Number(e.target.value))} style={{ width: '100%', accentColor: '#1D5FE0' }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Label>Género predominante</Label>
          <div style={{ display: 'flex', gap: 10 }}>
            {generoOpts.map(g => (
              <motion.div key={g.id} whileTap={{ scale: 0.97 }} onClick={() => update('genero', g.id)}
                style={{ flex: 1, padding: '12px 10px', borderRadius: 12, textAlign: 'center', border: `1.5px solid ${form.genero === g.id ? '#1D5FE0' : 'var(--border-color)'}`, background: form.genero === g.id ? 'rgba(29,95,224,0.06)' : 'var(--bg-card)', cursor: 'pointer', transition: 'all 0.2s' }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: form.genero === g.id ? '#1D5FE0' : 'var(--text-primary)', margin: 0 }}>{g.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {campoTexto({ key: 'publicoObjetivo', label: 'Público objetivo en pocas palabras', placeholder: 'Ej: familias jóvenes del barrio, opositores, dueños de pymes...', optional: true })}
        {campoTexto({ key: 'audienciaDesc', label: 'Describe al cliente ideal en 2-3 frases', placeholder: 'Ej: Parejas de 25-35 años que viven en la zona norte de Valencia y salen a cenar los fines de semana...', textarea: true, optional: true, ai: camposIA.includes('audienciaDesc') })}
        {campoTexto({ key: 'queBuscan', label: tx('¿Qué buscan en este negocio?', '¿Qué buscan en ti?'), placeholder: 'Ej: un sitio de confianza, rapidez, sentirse cuidados, aprender...', textarea: true, rows: 2, optional: true })}

        <ListaTextos label="Competidores" hint="Nombres, @cuentas o enlaces." placeholder="Ej: @competidor o https://..."
          items={form.competidores} onChange={v => update('competidores', v)} />
        <ListaTextos label={tx('Referencias: cuentas que admiran', 'Referencias: cuentas que admiras')} hint="Aunque no sean del sector." placeholder="Ej: @cuenta o enlace"
          items={form.cuentasReferencia} onChange={v => update('cuentasReferencia', v)} />
      </>
    )
  }

  // ─── PASO 4: Tono y personalidad ──────────────────────────────────────────────

  function renderPaso4() {
    return (
      <>
        <SectionTitle sub="El tono de voz es lo que hace que el contenido suene auténtico.">¿Cómo habla este negocio?</SectionTitle>

        <div style={{ marginBottom: 24 }}>
          <Label>Tono de voz</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 4 }}>
            {TONOS.map(t => {
              const sel = form.tono === t.id
              return (
                <motion.div key={t.id} whileTap={{ scale: 0.97 }} onClick={() => update('tono', t.id)} style={cardStyle(sel)}>
                  {sel && <div style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: '50%', background: 'rgba(29,95,224,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={13} color="#1D5FE0" /></div>}
                  <div style={{ marginBottom: 8 }}><t.icon size={22} color={sel ? '#1D5FE0' : '#86868B'} strokeWidth={1.8} /></div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: sel ? '#1D5FE0' : 'var(--text-primary)', margin: '0 0 3px' }}>{t.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>{t.desc}</p>
                </motion.div>
              )
            })}
          </div>
          <FieldError msg={errores.tono} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <Label optional>¿Cómo es la energía de la comunicación?</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {ENERGIA_OPTS.map(e => {
              const sel = form.energia === e.id
              return (
                <motion.div key={e.id} whileTap={{ scale: 0.97 }} onClick={() => update('energia', e.id)} style={cardStyle(sel)}>
                  <div style={{ marginBottom: 8 }}><e.icon size={20} color={sel ? '#1D5FE0' : '#86868B'} strokeWidth={1.8} /></div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: sel ? '#1D5FE0' : 'var(--text-primary)', margin: '0 0 3px' }}>{e.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{e.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Label optional>¿Qué género de voz encaja mejor con la marca?</Label>
          <div style={{ display: 'flex', gap: 10 }}>
            {VOZ_OPTS.map(v => {
              const sel = form.vozGenero === v.id
              return (
                <motion.div key={v.id} whileTap={{ scale: 0.97 }} onClick={() => update('vozGenero', v.id)}
                  style={{ flex: 1, ...cardStyle(sel), textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                    <v.icon size={20} color={sel ? '#1D5FE0' : '#86868B'} strokeWidth={1.8} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: sel ? '#1D5FE0' : 'var(--text-primary)', margin: 0 }}>{v.label}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Label optional>¿Cómo usa los emojis esta marca?</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {EMOJIS_OPTS.map(e => {
              const sel = form.usoEmojis === e.id
              return (
                <motion.div key={e.id} whileTap={{ scale: 0.97 }} onClick={() => update('usoEmojis', e.id)} style={cardStyle(sel)}>
                  <div style={{ marginBottom: 8 }}><e.icon size={20} color={sel ? '#1D5FE0' : '#86868B'} strokeWidth={1.8} /></div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: sel ? '#1D5FE0' : 'var(--text-primary)', margin: '0 0 3px' }}>{e.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{e.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Label optional>¿Cómo escribe los textos?</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ESTILO_TEXTO_PILLS.map(p => {
              const sel = form.estiloTexto.includes(p.id)
              return (
                <motion.button key={p.id} whileTap={{ scale: 0.94 }} onClick={() => toggleArr('estiloTexto', p.id)} style={pillStyle(sel)}>
                  {p.label}
                </motion.button>
              )
            })}
          </div>
        </div>

        {[
          { key: 'vozPropia', label: '¿Hay alguna frase, palabra o estilo que defina su voz?', placeholder: 'Ej: Siempre usa emojis, llama a sus clientes "familia"...' },
          { key: 'prohibido', label: '¿Qué NO quiere publicar NUNCA?', placeholder: 'Ej: No hablar de precios de competidores, no hacer política...' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 20 }}>
            <Label optional>{f.label}</Label>
            <textarea value={form[f.key]} onChange={e => update(f.key, e.target.value)} rows={3} placeholder={f.placeholder}
              style={{ ...iStyle(false), resize: 'vertical', lineHeight: 1.55 }}
              onFocus={e => e.target.style.borderColor = '#1D5FE0'} onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.12)'} />
          </div>
        ))}
      </>
    )
  }

  // ─── PASO 5: Redes sociales ───────────────────────────────────────────────────

  function renderPaso5() {
    const redesActivas = REDES_CONFIG.filter(r => form.redes[r.id]?.activa)
    return (
      <>
        <SectionTitle sub="Solo activaremos las redes que se usen de verdad.">{tx('¿Dónde está presente y a qué ritmo?', '¿Dónde estás y a qué ritmo?')}</SectionTitle>

        <Label>Redes activas</Label>

        {/* Grid de redes seleccionables */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
          {REDES_CONFIG.map(red => {
            const activa = form.redes[red.id]?.activa
            return (
              <motion.div
                key={red.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => updateRed(red.id, 'activa', !activa)}
                style={{
                  position: 'relative', borderRadius: 16, padding: '18px 12px 14px', cursor: 'pointer',
                  border: `2px solid ${activa ? red.color : 'var(--border-color)'}`,
                  background: activa ? `${red.color}10` : 'var(--bg-secondary)',
                  transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}
              >
                {activa && (
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%', background: red.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={11} color="white" />
                  </div>
                )}
                <red.icon size={28} color={activa ? red.color : 'var(--text-secondary)'} strokeWidth={1.6} />
                <span style={{ fontSize: 12, fontWeight: activa ? 600 : 500, color: activa ? red.color : 'var(--text-primary)', textAlign: 'center', lineHeight: 1.3 }}>{red.label}</span>
              </motion.div>
            )
          })}
        </div>

        {/* Configuración de redes activas: solo para el gestor. El cliente
            (modo externo) elige el ritmo general de abajo, no formatos ni
            frecuencias por red. */}
        <AnimatePresence>
          {!externo && redesActivas.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Configura las redes activas</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {redesActivas.map(red => {
                  const r = form.redes[red.id]
                  const otrasActivas = redesActivas.filter(ra => ra.id !== red.id)
                  return (
                    <div key={red.id} style={{ background: 'var(--bg-card)', borderRadius: 14, border: `1.5px solid ${red.color}30`, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <red.icon size={16} color={red.color} strokeWidth={1.8} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{red.label}</span>
                      </div>
                      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Frecuencia */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Frecuencia:</span>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {[['1x_semana','1x/sem'],['2x_semana','2x/sem'],['3x_semana','3x/sem'],['diario','Diario']].map(([val, label]) => (
                              <motion.button key={val} whileTap={{ scale: 0.95 }} onClick={() => updateRed(red.id, 'frecuencia', val)}
                                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: `1.5px solid ${r.frecuencia === val ? red.color : 'var(--border-color)'}`, background: r.frecuencia === val ? `${red.color}15` : 'var(--bg-secondary)', color: r.frecuencia === val ? red.color : 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                                {label}
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {/* Multiplataforma */}
                        {otrasActivas.length > 0 && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <motion.div onClick={() => updateRed(red.id, 'estrategia', r.estrategia === 'compartido' ? 'especifico' : 'compartido')}
                                style={{ width: 38, height: 22, borderRadius: 11, cursor: 'pointer', background: r.estrategia === 'compartido' ? red.color : 'rgba(0,0,0,0.15)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                                <motion.div animate={{ x: r.estrategia === 'compartido' ? 18 : 2 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                  style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-card)', position: 'absolute', top: 3, left: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                              </motion.div>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Compartir con otras redes</span>
                            </div>
                            <AnimatePresence>
                              {r.estrategia === 'compartido' && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {otrasActivas.map(oa => {
                                      const sel = (r.comparteConRedes || []).includes(oa.id)
                                      return (
                                        <motion.button key={oa.id} whileTap={{ scale: 0.95 }} onClick={() => {
                                          const curr = r.comparteConRedes || []
                                          updateRed(red.id, 'comparteConRedes', sel ? curr.filter(x => x !== oa.id) : [...curr, oa.id])
                                        }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: `1.5px solid ${sel ? oa.color : 'var(--border-color)'}`, background: sel ? `${oa.color}15` : 'var(--bg-secondary)', color: sel ? oa.color : 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                                          {sel && <Check size={10} />} {oa.label}
                                        </motion.button>
                                      )
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <FieldError msg={errores.redes} />

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '16px 0 32px', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 10, lineHeight: 1.5 }}>
          Recomendamos empezar con 2-3 redes y hacerlas bien antes de expandir.
        </p>

        {/* Ritmo de publicación */}
        <div>
          <Label optional>¿Con qué frecuencia te gustaría publicar?</Label>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '-4px 0 12px', lineHeight: 1.5 }}>
            {tx('El cliente solo elige el ritmo. Los formatos (reels, carruseles, historias) los decide la agencia.', 'Tú solo eliges el ritmo. Los formatos (reels, carruseles, historias) los decidimos nosotros según lo que mejor te funcione.')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FRECUENCIA_OPTS.map(f => {
              const sel = form.ritmoPublicacion === f.id
              return (
                <motion.div key={f.id} whileTap={{ scale: 0.98 }} onClick={() => update('ritmoPublicacion', sel ? '' : f.id)}
                  style={{ ...cardStyle(sel), display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `2px solid ${sel ? '#1D5FE0' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {sel && <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1D5FE0' }} />}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: sel ? '#1D5FE0' : 'var(--text-primary)', margin: '0 0 2px' }}>{f.label}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{f.desc}</p>
                  </div>
                  {f.recomendado && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: '#D7FF3D', color: '#0B0C10', flexShrink: 0 }}>Recomendado</span>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </>
    )
  }

  // ─── PASO 6: Fechas importantes ───────────────────────────────────────────────

  function renderPaso6() {
    return (
      <>
        <SectionTitle sub={externo ? 'Las tendremos en cuenta al planificar tu calendario para no perder ninguna oportunidad.' : 'La IA las tendrá en cuenta al generar calendarios para no perderse ninguna oportunidad.'}>
          ¿Hay fechas importantes en el año?
        </SectionTitle>

        <div style={{ marginBottom: 28 }}>
          <Label optional>Fechas especiales del año</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FECHAS_GENERALES.map(f => {
              const sel = form.fechasGenerales.includes(f.id)
              return (
                <motion.button key={f.id} whileTap={{ scale: 0.94 }} onClick={() => toggleArr('fechasGenerales', f.id)} style={pillStyle(sel)}>
                  <f.icon size={12} style={{ flexShrink: 0 }} /> {f.label}
                </motion.button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Label optional>Fechas propias del negocio</Label>
          {form.fechasPropias.map((fp, i) => (
            <motion.div key={fp.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{fp.nombre}</p>
                {fp.fecha && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{fp.fecha}</p>}
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setForm(f => ({ ...f, fechasPropias: f.fechasPropias.filter((_, idx) => idx !== i) }))}
                style={{ background: 'rgba(255,59,48,0.1)', border: 'none', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={13} color="#FF3B30" />
              </motion.button>
            </motion.div>
          ))}
          <AnimatePresence>
            {showAddFecha && form.fechasPropias.length < 5 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px', border: '1.5px solid rgba(29,95,224,0.2)', marginBottom: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { key: 'nombre', placeholder: 'Nombre del evento (Ej: Aniversario del local)', type: 'text' },
                    { key: 'fecha', placeholder: '', type: 'date' },
                    { key: 'descripcion', placeholder: 'Descripción breve (opcional)', type: 'text' },
                  ].map(f => (
                    <input key={f.key} type={f.type} value={newFecha[f.key]} onChange={e => setNewFecha(n => ({ ...n, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} style={iStyle(false)}
                      onFocus={e => e.target.style.borderColor = '#1D5FE0'} onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.12)'} />
                  ))}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={addFechaPropia}
                      style={{ padding: '9px 18px', borderRadius: 10, background: '#1D5FE0', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}>Añadir</motion.button>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAddFecha(false)}
                      style={{ padding: '9px 18px', borderRadius: 10, background: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}>Cancelar</motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!showAddFecha && form.fechasPropias.length < 5 && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAddFecha(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, background: 'var(--bg-card)', border: '1.5px dashed rgba(0,0,0,0.18)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
              <Plus size={14} /> Añadir fecha
            </motion.button>
          )}
        </div>

        <div>
          <Label optional>¿Hay temporada alta o baja en este negocio?</Label>
          <textarea value={form.temporada} onChange={e => update('temporada', e.target.value)} rows={3}
            placeholder="Ej: Alta en verano (junio-septiembre) por la playa, baja en enero-febrero..."
            style={{ ...iStyle(false), resize: 'vertical', lineHeight: 1.55 }}
            onFocus={e => e.target.style.borderColor = '#1D5FE0'} onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.12)'} />
        </div>
      </>
    )
  }

  // ─── RESUMEN FINAL ────────────────────────────────────────────────────────────

  function renderResumen() {
    const sectorData = SECTORES.find(s => s.id === form.sector)
    const tonoData = TONOS.find(t => t.id === form.tono)
    const redesActivas = REDES_CONFIG.filter(r => form.redes[r.id]?.activa)
    const ritmo = FRECUENCIA_OPTS.find(f => f.id === form.ritmoPublicacion)
    const rango = RANGO_PRECIO_OPTS.find(r => r.id === form.rangoPrecio)
    const temas = form.temas.map(t => t.trim()).filter(Boolean)
    const enlaces = REDES_ENLACES_CAMPOS.filter(r => form.redesEnlaces?.[r.id]?.trim())
    const fechasGen = FECHAS_GENERALES.filter(f => form.fechasGenerales.includes(f.id))
    const generoLabel = { mixto: 'Mixto', mujer: 'Mayoría mujeres', hombre: 'Mayoría hombres' }[form.genero]
    const sectorLabel = esMp ? SECTOR_MARCA_PERSONAL : sectorData ? `${sectorData.label}${form.sectorCustom ? ` · ${form.sectorCustom}` : ''}` : (form.sectorCustom || '')

    const bloques = [
      {
        id: 'quien', title: 'Quién es', icon: User,
        filas: esMp ? [
          ['Negocio', form.marcaPersonal.negocio],
          ['Qué vende', form.marcaPersonal.oferta],
          ['Cliente que buscas', form.marcaPersonal.clienteIdeal],
          ['Llamada a la acción', form.marcaPersonal.llamadaAccion],
          ['Tu historia', form.marcaPersonal.historia],
          ['Email', form.email],
          ['Web', form.web],
        ] : [
          ['Contacto', form.nombreContacto],
          ['Email', form.email],
          ['Teléfono', form.telefono],
          ['Web', form.web],
          ['Google Maps', form.googleMaps],
        ],
        extra: enlaces.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {enlaces.map(r => <span key={r.id} style={chipSuave}><strong style={{ fontWeight: 600 }}>{r.label}</strong>&nbsp;{form.redesEnlaces[r.id].trim()}</span>)}
          </div>
        ),
      },
      {
        id: 'que', title: 'Qué hace', icon: Store, ancho: true,
        filas: [
          ['Qué vende', form.descripcion],
          ['Diferencial', form.diferencial],
          ['Por qué elegirlos', form.porQueElegirnos],
          ['Precio', [rango?.label, form.ticketMedio].filter(Boolean).join(' · ')],
          ['Barreras internas', form.barrerasInternas],
          ['Barreras externas', form.barrerasExternas],
        ],
        extra: (temas.length > 0 || form.valores.length > 0) && (
          <>
            {temas.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <p style={etiquetaResumen}>Sus 5 temas</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {temas.map((t, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: '#D7FF3D', color: '#0B0C10', fontSize: 13, fontWeight: 600 }}>
                      <span style={{ fontSize: 10, opacity: 0.55 }}>{i + 1}</span>{t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {form.valores.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={etiquetaResumen}>Valores</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {form.valores.map(v => { const vd = VALORES.find(x => x.id === v); return vd ? <span key={v} style={chipAzul}>{vd.label}</span> : null })}
                </div>
              </div>
            )}
          </>
        ),
      },
      {
        id: 'aquien', title: 'A quién vende', icon: Users,
        filas: [
          ['Edad y género', `${form.edadMin}–${form.edadMax} años · ${generoLabel}`],
          ['Público objetivo', form.publicoObjetivo],
          ['Cliente ideal', form.audienciaDesc],
          ['Qué buscan', form.queBuscan],
          ['Competidores', form.competidores.join(', ')],
          ['Referencias', form.cuentasReferencia.join(', ')],
        ],
      },
      {
        id: 'como', title: 'Cómo habla', icon: MessageCircle,
        filas: [
          ['Tono', tonoData?.label],
          ['Energía', ENERGIA_OPTS.find(e => e.id === form.energia)?.label],
          ['Voz', VOZ_OPTS.find(v => v.id === form.vozGenero)?.label],
          ['Emojis', EMOJIS_OPTS.find(e => e.id === form.usoEmojis)?.label],
          ['Su forma de hablar', form.vozPropia],
          ['Nunca publicar', form.prohibido],
        ],
      },
      {
        id: 'redes', title: 'Redes y ritmo', icon: Megaphone,
        filas: [['Ritmo', ritmo ? `${ritmo.label} · ${ritmo.desc.toLowerCase()}` : '']],
        extra: redesActivas.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 4 }}>
            {redesActivas.map(r => <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, background: `${r.color}12`, border: `1px solid ${r.color}30`, fontSize: 12, fontWeight: 600, color: r.color }}><r.icon size={12} /> {r.label}</span>)}
          </div>
        ),
      },
      {
        id: 'fechas', title: 'Fechas importantes', icon: CalendarDays,
        filas: [['Temporada', form.temporada]],
        extra: (fechasGen.length > 0 || form.fechasPropias.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {fechasGen.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fechasGen.map(f => <span key={f.id} style={chipSuave}><f.icon size={11} /> {f.label}</span>)}
              </div>
            )}
            {form.fechasPropias.map((fp, i) => (
              <div key={fp.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ minWidth: 64, textAlign: 'center', padding: '4px 8px', borderRadius: 8, background: 'rgba(29,95,224,0.08)', color: '#1D5FE0', fontSize: 11, fontWeight: 700 }}>{fp.fecha ? formatearFechaCorta(fp.fecha) : 'Sin fecha'}</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{fp.nombre}</span>
              </div>
            ))}
          </div>
        ),
      },
    ].map(b => ({ ...b, filas: b.filas.filter(([, v]) => v && String(v).trim()) }))
      .filter(b => b.filas.length > 0 || b.extra)

    return (
      <>
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, padding: fotoUrl ? '32px 28px' : '36px 28px', marginBottom: 20, background: 'linear-gradient(135deg, #1D5FE0 0%, #0F3FA8 100%)', color: 'white', boxShadow: '0 12px 40px rgba(29,95,224,0.25)' }}>
          <div style={{ position: 'absolute', right: -60, top: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(215,255,61,0.16)' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            {fotoUrl && (
              <img src={fotoUrl} alt={form.nombre}
                style={{ width: 140, height: 140, borderRadius: 32, objectFit: 'cover', background: 'white', flexShrink: 0, boxShadow: '0 8px 28px rgba(0,0,0,0.25)', border: '4px solid rgba(255,255,255,0.9)' }} />
            )}
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D7FF3D', margin: '0 0 8px' }}>
                {externo ? 'Tu resumen' : modoEdicion ? 'Revisa los cambios' : 'Nuevo cliente'}
              </p>
              <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.8px', lineHeight: 1.1, margin: '0 0 12px', color: 'white', wordBreak: 'break-word' }}>{form.nombre}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sectorLabel && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.16)', fontSize: 13, fontWeight: 600 }}>
                    {sectorData && <sectorData.icon size={13} />} {sectorLabel}
                  </span>
                )}
                {form.ubicacion && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.16)', fontSize: 13, fontWeight: 500 }}>
                    <MapPin size={13} /> {form.ubicacion}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
          {externo ? 'Revisa que todo esté correcto antes de enviarlo.' : modoEdicion ? 'Revisa los cambios antes de guardar.' : 'Revisa que todo esté correcto antes de crear el cliente.'}
        </p>

        {/* Bloques */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {bloques.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}
              style={{ gridColumn: b.ancho ? '1 / -1' : 'auto', background: 'var(--bg-card)', borderRadius: 18, padding: '20px 22px', boxShadow: '0 2px 14px rgba(0,0,0,0.05)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(29,95,224,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <b.icon size={15} color="#1D5FE0" strokeWidth={2} />
                </span>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{b.title}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {b.filas.map(([label, valor]) => (
                  <div key={label}>
                    <p style={etiquetaResumen}>{label}</p>
                    <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{valor}</p>
                  </div>
                ))}
                {b.extra || null}
              </div>
            </motion.div>
          ))}
        </div>

        {errorEnvio && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, padding: '12px 14px', background: 'rgba(255,59,48,0.06)', borderRadius: 10, border: '1px solid rgba(255,59,48,0.18)' }}>
            <AlertCircle size={14} color="#FF3B30" />
            <span style={{ fontSize: 13, color: '#FF3B30' }}>{errorEnvio}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 32 }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setDirection(-1); setPaso(1) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 22px', borderRadius: 12, background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'inherit' }}>
            <ArrowLeft size={15} /> Editar algo
          </motion.button>
          <motion.button whileHover={{ backgroundColor: '#BEE62A' }} whileTap={{ scale: 0.97 }} onClick={guardar} disabled={guardando}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '15px 22px', borderRadius: 12, background: guardando ? '#86868B' : '#D7FF3D', color: guardando ? 'white' : '#0B0C10', border: 'none', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 2px 16px rgba(215,255,61,0.35)', transition: 'background 0.2s' }}>
            {guardando ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                {externo ? 'Enviando...' : modoEdicion ? 'Guardando...' : 'Creando cliente...'}
              </>
            ) : (
              <>{externo ? <Send size={15} /> : <Check size={15} />} {externo ? 'Enviar' : modoEdicion ? 'Guardar cambios' : 'Crear cliente'}</>
            )}
          </motion.button>
        </div>
      </>
    )
  }
}
