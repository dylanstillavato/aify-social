import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, ArrowDownRight, ArrowUpRight, Check, Repeat, X } from 'lucide-react'
import { useClientesList } from '../hooks/useClientes'
import { useOrganizacion } from '../hooks/useOrganizacion'
import { modoCobroCliente } from '../utils/modoCobro'
import { crearFactura, useFacturasList } from '../hooks/useFacturas'
import IssuerDataModal, { getDatosEmisor } from '../components/IssuerDataModal'
import { numeroPorDefecto } from '../utils/numeracionDocumentos'
import {
  cobradoEnMes, pendiente, vencido, facturasPendientes, facturasVencidas,
  serieCobrado, variacionMensual, mrr, euros, nombreMes, isoDia,
} from '../utils/metricasDinero'
import { DocumentosFacturacion } from './Facturas'
import { useEsMovil } from '../hooks/useEsMovil'

// Sección Dinero: presupuestos, facturas e ingresos en un solo sitio.
// Vistas deep-linkables con ?vista=presupuestos|facturas (sin parámetro =
// Resumen). Las listas y el editor son los de Facturas.jsx
// (DocumentosFacturacion), no una copia. Columnas cuota_mensual, periodo y
// presupuesto_id: ver supabase/migrations/0020_dinero.sql.

const VISTAS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'presupuestos', label: 'Presupuestos' },
  { id: 'facturas', label: 'Facturas' },
]

const IVA_CUOTA = 21
const redondear = (n) => Math.round(n * 100) / 100
const periodoDe = (fecha) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
const conceptoCuota = (fecha) => `Servicio de contenido ${nombreMes(fecha.getMonth())} ${fecha.getFullYear()}`
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, boxShadow: '0 2px 20px rgba(0,0,0,0.04)' }

// ── Resumen ───────────────────────────────────────────────────────────────────

function Kpi({ label, valor, detalle, colorValor, children }) {
  return (
    <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.6px', color: colorValor || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {valor}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>{detalle}</span>
      {children}
    </div>
  )
}

function Variacion({ pct }) {
  if (pct === null) return 'Sin cobros el mes pasado para comparar'
  const sube = pct >= 0
  const Icon = sube ? ArrowUpRight : ArrowDownRight
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600, color: sube ? '#1F9D4C' : '#E5484D' }}>
        <Icon size={13} /> {sube ? '+' : ''}{pct} %
      </span>
      frente al mes pasado
    </span>
  )
}

// Barras a escala desde 0: la altura es proporcional al importe cobrado.
function GraficoCobrado({ serie }) {
  const W = 640, H = 220, arriba = 26, abajo = 30, lateral = 12
  const altoUtil = H - arriba - abajo
  const maximo = Math.max(...serie.map(p => p.total), 0)
  const hueco = (W - lateral * 2) / serie.length
  const ancho = Math.min(56, hueco * 0.56)
  const base = H - abajo
  const vacio = maximo === 0

  return (
    <div style={{ ...card, padding: '18px 20px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cobrado por mes</h2>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Últimos 6 meses, facturas pagadas por fecha de emisión</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Importe cobrado en cada uno de los últimos seis meses" style={{ display: 'block', maxHeight: 260 }}>
        <line x1={lateral} x2={W - lateral} y1={base} y2={base} style={{ stroke: 'var(--border-color)' }} strokeWidth="1" />
        {serie.map((p, i) => {
          const alto = vacio ? 0 : (p.total / maximo) * altoUtil
          const cx = lateral + hueco * i + hueco / 2
          const actual = i === serie.length - 1
          return (
            <g key={`${p.año}-${p.mes}`}>
              {alto > 0 && (
                <rect x={cx - ancho / 2} y={base - alto} width={ancho} height={alto} rx="6"
                  fill="#1D5FE0" opacity={actual ? 1 : 0.55} />
              )}
              <text x={cx} y={base - alto - 8} textAnchor="middle"
                style={{ fill: p.total ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 12, fontWeight: actual ? 700 : 500, fontVariantNumeric: 'tabular-nums' }}>
                {euros(p.total)}
              </text>
              <text x={cx} y={H - 9} textAnchor="middle"
                style={{ fill: actual ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 12, fontWeight: actual ? 700 : 500 }}>
                {nombreMes(p.mes).slice(0, 3)}{p.mes === 0 ? ` ${String(p.año).slice(2)}` : ''}
              </text>
            </g>
          )
        })}
      </svg>
      {vacio && (
        <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '4px 0 6px', textAlign: 'center' }}>
          Aún no hay facturas pagadas en estos meses. Marca una factura como pagada para verla aquí.
        </p>
      )}
    </div>
  )
}

function TablaPorCliente({ clientes, facturas, hoy }) {
  const esMovil = useEsMovil()
  const filas = useMemo(() => {
    const año = String(hoy.getFullYear())
    return (clientes || [])
      .map(c => {
        const suyas = facturas.filter(f => String(f.clienteId) === String(c.id))
        return {
          cliente: c,
          cuota: Number(c.cuotaMensual) || 0,
          cobradoAño: suyas.filter(f => f.estado === 'pagada' && (f.fechaEmision || '').startsWith(año)).reduce((a, f) => a + (Number(f.total) || 0), 0),
          pendiente: pendiente(suyas, hoy),
          vencido: vencido(suyas, hoy),
        }
      })
      // archivados solo si todavía hay dinero por cobrar
      .filter(r => !r.cliente.archivado || r.pendiente + r.vencido > 0)
      .sort((a, b) => (b.cobradoAño - a.cobradoAño) || (b.cuota - a.cuota) || (a.cliente.nombre || '').localeCompare(b.cliente.nombre || ''))
  }, [clientes, facturas, hoy])

  const columnas = 'minmax(0, 1.6fr) 1fr 1fr 1.2fr'
  const num = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, padding: '16px 20px' }}>Por cliente</h2>
      {/* En móvil se desliza la tabla, no la página */}
      <div style={esMovil ? { overflowX: 'auto' } : undefined}>
      <div style={esMovil ? { minWidth: 560 } : undefined}>
      <div style={{
        display: 'grid', gridTemplateColumns: columnas, gap: 12, padding: '10px 20px',
        borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)',
        fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px',
      }}>
        <span>Cliente</span>
        <span style={num}>Cuota mensual</span>
        <span style={num}>Cobrado este año</span>
        <span style={num}>Pendiente + vencido</span>
      </div>
      {filas.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '18px 20px', margin: 0 }}>Todavía no tienes clientes.</p>
      )}
      {filas.map(r => (
        <div key={r.cliente.id} style={{
          display: 'grid', gridTemplateColumns: columnas, gap: 12, padding: '12px 20px', alignItems: 'center',
          borderBottom: '1px solid var(--border-subtle)', fontSize: 13.5, color: 'var(--text-primary)',
        }}>
          <Link to={`/clientes/${r.cliente.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.cliente.nombre}{r.cliente.archivado ? ' (archivado)' : ''}
          </Link>
          <span style={{ ...num, color: r.cuota ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{r.cuota ? euros(r.cuota) : 'Sin cuota'}</span>
          <span style={num}>{euros(r.cobradoAño)}</span>
          <span style={num}>
            {euros(r.pendiente + r.vencido)}
            {r.vencido > 0 && (
              <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#E5484D' }}>{euros(r.vencido)} vencido</span>
            )}
          </span>
        </div>
      ))}
      </div>
      </div>
    </div>
  )
}

// "Generar facturas de <mes>": una factura pendiente por cliente activo con
// cuota y sin factura de este periodo. Paso de confirmación en la página
// (window.confirm está bloqueado en este entorno). Según el modo de cobro
// (0026, utils/modoCobro.js): los clientes por adelantado salen marcados; los
// de al entregar salen desmarcados, porque su factura toca al publicar, y el
// gestor decide cuáles incluir.
function GenerarFacturasMes({ clientes, facturas, hoy, cargando, onCreadas, organizacion }) {
  const [confirmando, setConfirmando] = useState(false)
  const [seleccion, setSeleccion] = useState(() => new Set()) // ids marcados
  const [generando, setGenerando] = useState(false)
  const [resultado, setResultado] = useState(null) // { ok, texto }
  const [showIssuerModal, setShowIssuerModal] = useState(false)
  const [tieneEmisor, setTieneEmisor] = useState(() => !!getDatosEmisor())

  const periodo = periodoDe(hoy)
  const concepto = conceptoCuota(hoy)
  const mes = nombreMes(hoy.getMonth())

  const conCuota = (clientes || []).filter(c => !c.archivado && Number(c.cuotaMensual) > 0)
  // periodo es la marca fiable; el concepto cubre facturas creadas antes de
  // ejecutar la migración 0020 (se guardan sin periodo)
  const yaFacturado = (c) => facturas.some(f => String(f.clienteId) === String(c.id) &&
    (f.periodo === periodo || (!f.periodo && (f.items || []).some(i => i.concepto === concepto))))
  const porGenerar = conCuota.filter(c => !yaFacturado(c))
  const modoDe = (c) => modoCobroCliente(c, organizacion)
  const seleccionados = porGenerar.filter(c => seleccion.has(String(c.id)))
  const totalConIva = seleccionados.reduce((a, c) => a + redondear(Number(c.cuotaMensual) * (1 + IVA_CUOTA / 100)), 0)

  const generar = async () => {
    setGenerando(true)
    setResultado(null)
    const emisor = getDatosEmisor() || {}
    const vence = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 15)
    let existentes = [...facturas]
    let creadas = 0
    let fallidas = 0
    for (const c of seleccionados) {
      const cuota = redondear(Number(c.cuotaMensual))
      const iva = redondear(cuota * IVA_CUOTA / 100)
      const datos = {
        clienteId: c.id,
        numero: numeroPorDefecto('factura', existentes),
        fechaEmision: isoDia(hoy),
        fechaVencimiento: isoDia(vence),
        estado: 'pendiente',
        items: [{ concepto, cantidad: 1, precio_unitario: cuota, subtotal: cuota }],
        subtotal: cuota, ivaPct: IVA_CUOTA, iva, total: redondear(cuota + iva),
        notas: '',
        emisor,
        periodo,
      }
      const { data, error } = await crearFactura(datos)
      if (error) { fallidas += 1; continue }
      creadas += 1
      existentes = [data || datos, ...existentes]
    }
    await onCreadas?.()
    setGenerando(false)
    setConfirmando(false)
    setResultado({
      ok: fallidas === 0,
      texto: fallidas
        ? `${plural(creadas, 'factura creada', 'facturas creadas')}, ${fallidas} no se pudieron crear`
        : `${plural(creadas, 'factura creada', 'facturas creadas')} para ${mes}. Las tienes en Facturas como pendientes.`,
    })
  }

  let motivoDesactivado = null
  if (cargando) motivoDesactivado = 'Cargando facturas…'
  else if (conCuota.length === 0) motivoDesactivado = 'Ningún cliente tiene cuota mensual'
  else if (porGenerar.length === 0) motivoDesactivado = `Las facturas de ${mes} ya están generadas`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <motion.button
        whileTap={motivoDesactivado ? undefined : { scale: 0.97 }}
        onClick={() => {
          setResultado(null)
          setTieneEmisor(!!getDatosEmisor())
          setSeleccion(new Set(porGenerar.filter(c => modoDe(c) === 'adelantado').map(c => String(c.id))))
          setConfirmando(true)
        }}
        disabled={!!motivoDesactivado || confirmando}
        title={motivoDesactivado || undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10, border: 'none',
          background: '#D7FF3D', color: '#0B0C10', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
          cursor: motivoDesactivado ? 'not-allowed' : 'pointer', opacity: motivoDesactivado ? 0.5 : 1,
        }}
      >
        <Repeat size={14} /> Generar facturas de {mes}
      </motion.button>
      {motivoDesactivado && !cargando && !resultado && (
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{motivoDesactivado}</span>
      )}
      {resultado && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: resultado.ok ? '#1F9D4C' : '#E5484D' }}>
          {resultado.ok ? <Check size={14} /> : <AlertCircle size={14} />} {resultado.texto}
        </span>
      )}

      <AnimatePresence>
        {confirmando && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            style={{ ...card, width: 'min(420px, 100%)', padding: '16px 18px', marginTop: 4, textAlign: 'left', boxShadow: 'var(--shadow-lg, 0 12px 40px rgba(0,0,0,0.18))' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <p style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Crear {plural(seleccionados.length, 'factura', 'facturas')} de {mes}
                </p>
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                  Pendientes de cobro, con IVA {IVA_CUOTA} % y vencimiento a 15 días. Marca los clientes a los que quieres facturar ahora.
                </p>
              </div>
              <button onClick={() => setConfirmando(false)} disabled={generando} title="Cerrar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-secondary)' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ margin: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
              {porGenerar.map(c => {
                const id = String(c.id)
                const marcado = seleccion.has(id)
                const adelantado = modoDe(c) === 'adelantado'
                return (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13, cursor: generando ? 'default' : 'pointer' }}>
                    <input
                      type="checkbox" checked={marcado} disabled={generando}
                      onChange={() => setSeleccion(prev => {
                        const next = new Set(prev)
                        if (next.has(id)) next.delete(id)
                        else next.add(id)
                        return next
                      })}
                      style={{ accentColor: '#1D5FE0', width: 15, height: 15, margin: 0, flexShrink: 0 }}
                    />
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ color: marcado ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                      <span style={{ fontSize: 11.5, color: adelantado ? '#1D5FE0' : 'var(--text-tertiary)' }}>
                        {adelantado ? 'Por adelantado' : 'Al entregar: genérala cuando publiques'}
                      </span>
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {euros(c.cuotaMensual)} + IVA
                    </span>
                  </label>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                <span>Total con IVA</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{euros(totalConIva)}</span>
              </div>
            </div>
            {!tieneEmisor && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', margin: '0 0 12px', lineHeight: 1.5 }}>
                Aún no has guardado tus datos fiscales, así que las facturas saldrán sin emisor.{' '}
                <button onClick={() => setShowIssuerModal(true)} style={{ background: 'none', border: 'none', padding: 0, color: '#1D5FE0', fontWeight: 600, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                  Añadir datos fiscales
                </button>
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setConfirmando(false)} disabled={generando}
                style={{ padding: '8px 14px', borderRadius: 9, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={generar} disabled={generando || seleccionados.length === 0}
                style={{ padding: '8px 14px', borderRadius: 9, background: '#1D5FE0', border: 'none', cursor: generando ? 'wait' : seleccionados.length === 0 ? 'not-allowed' : 'pointer', opacity: seleccionados.length === 0 ? 0.5 : 1, fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                {generando ? 'Creando…' : `Crear ${plural(seleccionados.length, 'factura', 'facturas')}`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <IssuerDataModal
        open={showIssuerModal}
        onClose={() => setShowIssuerModal(false)}
        onSaved={() => { setShowIssuerModal(false); setTieneEmisor(!!getDatosEmisor()) }}
      />
    </div>
  )
}

function Resumen() {
  const { clientes } = useClientesList()
  const { facturas, loading, refetch } = useFacturasList()
  const { organizacion } = useOrganizacion()
  // Fecha fija durante la vida de la vista (referencia estable para los memos)
  const [hoy] = useState(() => new Date())

  const cobradoMes = cobradoEnMes(facturas, hoy.getFullYear(), hoy.getMonth())
  const variacion = variacionMensual(facturas, hoy)
  const nPendientes = facturasPendientes(facturas, hoy).length
  const nVencidas = facturasVencidas(facturas, hoy).length
  const totalVencido = vencido(facturas, hoy)
  const ingresoRecurrente = mrr(clientes || [])
  const nConCuota = (clientes || []).filter(c => !c.archivado && Number(c.cuotaMensual) > 0).length
  const serie = useMemo(() => serieCobrado(facturas, hoy, 6), [facturas, hoy])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <GenerarFacturasMes clientes={clientes} facturas={facturas} hoy={hoy} cargando={loading} onCreadas={refetch} organizacion={organizacion} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <Kpi label="Cobrado este mes" valor={euros(cobradoMes)} detalle={<Variacion pct={variacion} />} />
        <Kpi label="Pendiente" valor={euros(pendiente(facturas, hoy))}
          detalle={nPendientes ? `${plural(nPendientes, 'factura', 'facturas')} dentro de plazo` : 'Nada pendiente de cobro'} />
        <Kpi label="Vencido" valor={euros(totalVencido)} colorValor={totalVencido > 0 ? '#E5484D' : undefined}
          detalle={nVencidas ? `${plural(nVencidas, 'factura', 'facturas')} fuera de plazo` : 'Ninguna factura vencida'} />
        <Kpi label="Ingreso mensual recurrente" valor={euros(ingresoRecurrente)}
          detalle={nConCuota
            ? plural(nConCuota, 'cliente con cuota', 'clientes con cuota')
            : 'Añade la cuota mensual en la ficha de cada cliente'}>
          {!nConCuota && (
            <Link to="/clientes" style={{ fontSize: 12, fontWeight: 600, color: '#1D5FE0', textDecoration: 'none', marginTop: 2 }}>
              Ir a clientes
            </Link>
          )}
        </Kpi>
      </div>

      <GraficoCobrado serie={serie} />
      <TablaPorCliente clientes={clientes} facturas={facturas} hoy={hoy} />
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function Dinero() {
  const esMovil = useEsMovil()
  const [searchParams, setSearchParams] = useSearchParams()
  const nuevo = searchParams.get('nuevo') // deep link ?nuevo=factura|presupuesto
  const vistaParam = searchParams.get('vista')
  const vista = nuevo === 'presupuesto' ? 'presupuestos'
    : nuevo === 'factura' ? 'facturas'
      : (vistaParam === 'presupuestos' || vistaParam === 'facturas' ? vistaParam : 'resumen')
  // Abre el editor al llegar con ?nuevo=; deja de aplicarse al cambiar de vista
  const [nuevoAlAbrir, setNuevoAlAbrir] = useState(() => nuevo === 'factura' || nuevo === 'presupuesto')
  // Si ya estás en /dinero y llega otro ?nuevo= (p. ej. desde Cmd+K), la página
  // no se vuelve a montar: se detecta el cambio durante el render y se remonta
  // la lista (key) para que abra el editor otra vez.
  const [nuevoPrevio, setNuevoPrevio] = useState(nuevo)
  const [aperturas, setAperturas] = useState(0)
  if (nuevo !== nuevoPrevio) {
    setNuevoPrevio(nuevo)
    if (nuevo === 'factura' || nuevo === 'presupuesto') {
      setNuevoAlAbrir(true)
      setAperturas(n => n + 1)
    }
  }

  useEffect(() => {
    if (!nuevo) return
    const next = new URLSearchParams(searchParams)
    next.delete('nuevo')
    if (nuevo === 'factura' || nuevo === 'presupuesto') next.set('vista', nuevo === 'factura' ? 'facturas' : 'presupuestos')
    setSearchParams(next, { replace: true })
  }, [nuevo, searchParams, setSearchParams])

  const cambiarVista = (id) => {
    setNuevoAlAbrir(false)
    const next = new URLSearchParams(searchParams)
    if (id === 'resumen') next.delete('vista')
    else next.set('vista', id)
    setSearchParams(next, { replace: true })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}
      className={esMovil ? 'pagina-movil' : undefined}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--gradient-bg)', minHeight: '100vh' }}
    >
      <div style={{ padding: esMovil ? '20px 16px 0' : '28px 40px 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: 0 }}>Dinero</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '3px 0 0' }}>
            Presupuestos, facturas e ingresos de todos tus clientes
          </p>
        </div>
        <div role="tablist" aria-label="Vista" style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 10, padding: 3, border: '1px solid var(--border-subtle)' }}>
          {VISTAS.map(v => {
            const activa = vista === v.id
            return (
              <button
                key={v.id} role="tab" aria-selected={activa}
                onClick={() => cambiarVista(v.id)}
                style={{
                  padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  background: activa ? 'var(--bg-card)' : 'transparent',
                  color: activa ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: activa ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {v.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, padding: esMovil ? '18px 16px 40px' : '22px 40px 40px' }}>
        {vista === 'resumen'
          ? <Resumen />
          : <DocumentosFacturacion key={`${vista}-${aperturas}`} tab={vista} nuevoAlAbrir={nuevoAlAbrir} />}
      </div>
    </motion.div>
  )
}
