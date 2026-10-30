import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, Settings } from 'lucide-react'
import { crearFactura, actualizarFactura } from '../hooks/useFacturas'
import { crearPresupuesto, actualizarPresupuesto } from '../hooks/usePresupuestos'
import { crearCliente } from '../hooks/useClientes'
import { useOrganizacion } from '../hooks/useOrganizacion'
import IssuerDataModal, { getDatosEmisor } from './IssuerDataModal'
import { numeroPorDefecto } from '../utils/numeracionDocumentos'

const IVA_DEFAULT = 21 // Spain standard VAT rate — used as the line-items default, editable per document.

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function emptyItem() {
  return { concepto: '', cantidad: 1, precioUnitario: 0 }
}

const inputStyle = {
  width: '100%', padding: '9px 11px', borderRadius: 8,
  border: '1.5px solid var(--border-color)', fontSize: 13.5,
  color: 'var(--text-primary)', background: 'var(--bg-secondary)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}
const labelStyle = { fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }
const CLIENTE_NUEVO = '__nuevo__' // valor del select: el presupuesto es para alguien que aún no es cliente

function Interruptor({ activo, onClick, children }) {
  return (
    <button type="button" onClick={onClick} role="switch" aria-checked={activo}
      style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left' }}>
      <span style={{ width: 34, height: 20, borderRadius: 10, background: activo ? '#1D5FE0' : 'var(--border-color)', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: activo ? 16 : 2, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </span>
      {children}
    </button>
  )
}

/**
 * Slide-over create/edit panel shared by `Facturas.jsx` (global list) and
 * `ClienteDetalle.jsx`'s "Facturación" tab (pre-filled cliente). Visual
 * pattern mirrors ClienteDetalle's own edit panel (backdrop + fixed right
 * panel, framer-motion).
 *
 * Props:
 *  - tipo: 'factura' | 'presupuesto'
 *  - open, onClose
 *  - documento: existing doc to edit, or null to create
 *  - clientes: [{id, nombre}] for the select
 *  - clienteIdFijo: pre-fill + lock the cliente select (used from the client tab)
 *  - documentosExistentes: same-type docs, used to prefill `numero`
 *  - onSaved: (doc) => void
 *
 * Presupuestos (0047): "Cliente nuevo" en el select crea un cliente ligero
 * (nombre y email) al guardar, que entra en la columna "Presupuesto enviado"
 * del tablero. La cuota mensual y "pedir onboarding" viajan con el
 * presupuesto; al firmarlo, firmar_presupuesto pasa la cuota al cliente y crea
 * el enlace del formulario.
 *
 * Form state is seeded once per mount via lazy `useState` initializers (no
 * effect-driven reset) — same pattern ClienteDetalle.jsx's own edit panel
 * uses (its `abrirEdicion()` handler builds the initial form snapshot at the
 * moment it's opened). The caller is expected to give this component a
 * fresh `key` each time it opens a *different* create/edit target (see
 * `Facturas.jsx` / `ClienteDetalle.jsx`'s `panelKey`), so a real remount —
 * and a real reseed — happens on every "open".
 */
export default function DocumentoPanel({
  tipo, open, onClose, documento, clientes, clienteIdFijo, documentosExistentes, onSaved,
}) {
  const esFactura = tipo === 'factura'
  const [clienteId, setClienteId] = useState(() => documento ? (documento.clienteId || '') : (clienteIdFijo || ''))
  const [numero, setNumero] = useState(() => documento ? (documento.numero || '') : numeroPorDefecto(tipo, documentosExistentes))
  const [fechaEmision, setFechaEmision] = useState(() => (documento && documento.fechaEmision) || hoyISO())
  const [fechaSecundaria, setFechaSecundaria] = useState(() => // vencimiento (factura) / validez (presupuesto)
    documento ? ((esFactura ? documento.fechaVencimiento : documento.validezHasta) || '') : ''
  )
  const [estado, setEstado] = useState(() => (documento && documento.estado) || (esFactura ? 'pendiente' : 'borrador'))
  const [items, setItems] = useState(() =>
    documento?.items?.length
      ? documento.items.map(i => ({
          concepto: i.concepto || '',
          cantidad: i.cantidad ?? 1,
          precioUnitario: i.precio_unitario ?? i.precioUnitario ?? 0,
        }))
      : [emptyItem()]
  )
  const [ivaPct, setIvaPct] = useState(() => (documento ? documento.ivaPct : null) ?? IVA_DEFAULT)
  // Precios con IVA incluido: lo escrito en las líneas ya lleva el IVA y la base se calcula hacia atrás
  const [ivaIncluido, setIvaIncluido] = useState(() => !!documento?.ivaIncluido)
  const [notas, setNotas] = useState(() => (documento && documento.notas) || '')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [cuotaMensual, setCuotaMensual] = useState(() => documento?.cuotaMensual ?? '')
  const [pedirOnboarding, setPedirOnboarding] = useState(() => !!documento?.pedirOnboarding)
  // Cliente ya creado en un intento de guardado que falló después: no se repite
  const clienteCreadoRef = useRef(null)
  const { organizacion } = useOrganizacion()
  const esClienteNuevo = clienteId === CLIENTE_NUEVO

  const cambiarCliente = (valor) => {
    setClienteId(valor)
    // Lo normal con un cliente nuevo es pedirle el formulario al firmar
    if (valor === CLIENTE_NUEVO && !documento) setPedirOnboarding(true)
  }
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [showIssuerModal, setShowIssuerModal] = useState(false)
  const [issuerModalIsGate, setIssuerModalIsGate] = useState(false)

  const updateItem = (idx, field, val) => {
    setItems(rows => rows.map((r, i) => i === idx ? { ...r, [field]: val } : r))
  }
  const addItem = () => setItems(rows => [...rows, emptyItem()])
  const removeItem = (idx) => setItems(rows => rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows)

  const sumaLineas = items.reduce((sum, r) => sum + (Number(r.cantidad) || 0) * (Number(r.precioUnitario) || 0), 0)
  const redondear = (n) => Math.round(n * 100) / 100
  const pct = Number(ivaPct) || 0
  const subtotal = ivaIncluido ? redondear(sumaLineas / (1 + pct / 100)) : sumaLineas
  const iva = ivaIncluido ? redondear(sumaLineas - subtotal) : sumaLineas * pct / 100
  const total = ivaIncluido ? sumaLineas : subtotal + iva

  const doGuardar = async (emisorParaNuevo) => {
    setGuardando(true)
    setError(null)
    try {
      let idCliente = clienteId
      if (esClienteNuevo) {
        if (!clienteCreadoRef.current) {
          const { data: creado, error: errCliente } = await crearCliente({
            nombre: nuevoNombre.trim(), email: nuevoEmail.trim(), organizacionId: organizacion?.id || null,
          })
          if (errCliente || !creado?.id) throw errCliente || new Error('No se pudo crear el cliente')
          clienteCreadoRef.current = creado.id
        }
        idCliente = clienteCreadoRef.current
      }

      const itemsParaDB = items
        .filter(r => r.concepto.trim())
        .map(r => ({
          concepto: r.concepto.trim(),
          cantidad: Number(r.cantidad) || 0,
          precio_unitario: Number(r.precioUnitario) || 0,
          subtotal: (Number(r.cantidad) || 0) * (Number(r.precioUnitario) || 0),
        }))

      const datos = {
        clienteId: idCliente,
        numero: numero.trim(),
        fechaEmision,
        estado,
        items: itemsParaDB,
        subtotal, ivaPct: Number(ivaPct) || 0, iva, total,
        notas: notas.trim(),
      }
      // Solo se manda si está o estaba activo (sin 0032 aplicada, mandarlo falla)
      if (ivaIncluido || documento?.ivaIncluido) datos.ivaIncluido = ivaIncluido
      if (esFactura) datos.fechaVencimiento = fechaSecundaria || null
      else datos.validezHasta = fechaSecundaria || null
      // Igual con cuota y onboarding (0047): solo si hay algo o lo había
      if (!esFactura) {
        if (Number(cuotaMensual) > 0 || documento?.cuotaMensual) datos.cuotaMensual = cuotaMensual
        if (pedirOnboarding || documento?.pedirOnboarding) datos.pedirOnboarding = pedirOnboarding
      }

      let result
      if (documento) {
        result = esFactura
          ? await actualizarFactura(documento.id, datos)
          : await actualizarPresupuesto(documento.id, datos)
      } else {
        datos.emisor = emisorParaNuevo || getDatosEmisor() || {}
        result = esFactura
          ? await crearFactura(datos)
          : await crearPresupuesto(datos)
      }
      if (result.error) throw result.error
      onSaved?.(result.data)
      onClose?.()
    } catch (e) {
      setError(e?.message || 'No se pudo guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const handleGuardarClick = () => {
    if (!clienteId) { setError('Selecciona un cliente'); return }
    if (esClienteNuevo && !nuevoNombre.trim()) { setError('Escribe el nombre del cliente nuevo'); return }
    if (!numero.trim()) { setError('Indica un número de documento'); return }
    if (!items.some(r => r.concepto.trim())) { setError('Añade al menos un concepto'); return }

    // First save ever (no remembered issuer data): block and collect it first.
    if (!documento && !getDatosEmisor()) {
      setIssuerModalIsGate(true)
      setShowIssuerModal(true)
      return
    }
    doGuardar()
  }

  const titulo = documento
    ? `Editar ${esFactura ? 'factura' : 'presupuesto'}`
    : `${esFactura ? 'Nueva factura' : 'Nuevo presupuesto'}`

  const ESTADOS_FACTURA = [
    { id: 'pendiente', label: 'Pendiente' },
    { id: 'pagada', label: 'Pagada' },
    { id: 'vencida', label: 'Vencida' },
    { id: 'cancelada', label: 'Cancelada' },
  ]
  const ESTADOS_PRESUPUESTO = [
    { id: 'borrador', label: 'Borrador' },
    { id: 'enviado', label: 'Enviado' },
    { id: 'firmado', label: 'Firmado' },
    { id: 'rechazado', label: 'Rechazado' },
  ]
  const estadosDisponibles = esFactura ? ESTADOS_FACTURA : ESTADOS_PRESUPUESTO

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onClose}
              style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)' }}
            />
            <motion.div
              initial={{ x: 480, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 480, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 901,
                width: 480, maxWidth: '100vw', background: 'var(--bg-card)',
                borderLeft: '1px solid var(--border-color)',
                display: 'flex', flexDirection: 'column',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{titulo}</h3>
                <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
                  style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} color="var(--text-primary)" />
                </motion.button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Cliente</label>
                    <select
                      style={inputStyle} value={clienteId} disabled={!!clienteIdFijo}
                      onChange={e => cambiarCliente(e.target.value)}
                    >
                      <option value="">Selecciona un cliente…</option>
                      {!esFactura && !documento && !clienteIdFijo && (
                        <option value={CLIENTE_NUEVO}>+ Cliente nuevo</option>
                      )}
                      {(clientes || []).map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  {esClienteNuevo && (
                    <>
                      <div>
                        <label style={labelStyle}>Nombre del cliente</label>
                        <input style={inputStyle} value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Ej. Peluquería Sol" autoFocus />
                      </div>
                      <div>
                        <label style={labelStyle}>Email (opcional)</label>
                        <input type="email" style={inputStyle} value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} />
                      </div>
                      <p style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-tertiary)', margin: '-4px 0 0', lineHeight: 1.5 }}>
                        Se crea al guardar y aparece en la columna «Presupuesto enviado» del tablero de clientes.
                      </p>
                    </>
                  )}
                  <div>
                    <label style={labelStyle}>Número</label>
                    <input style={inputStyle} value={numero} onChange={e => setNumero(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Estado</label>
                    <select style={inputStyle} value={estado} onChange={e => setEstado(e.target.value)}>
                      {estadosDisponibles.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Fecha de emisión</label>
                    <input type="date" style={inputStyle} value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>{esFactura ? 'Fecha de vencimiento' : 'Válido hasta'}</label>
                    <input type="date" style={inputStyle} value={fechaSecundaria} onChange={e => setFechaSecundaria(e.target.value)} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Conceptos</label>
                    <button
                      onClick={addItem} type="button"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: 'rgba(0,113,227,0.08)', color: '#0071E3', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
                    >
                      <Plus size={12} /> Añadir línea
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map((row, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 72px 24px', gap: 6, alignItems: 'center' }}>
                        <input
                          style={inputStyle} placeholder="Concepto"
                          value={row.concepto} onChange={e => updateItem(idx, 'concepto', e.target.value)}
                        />
                        <input
                          style={{ ...inputStyle, textAlign: 'right' }} type="number" min={0} placeholder="Cant."
                          value={row.cantidad} onChange={e => updateItem(idx, 'cantidad', e.target.value)}
                        />
                        <input
                          style={{ ...inputStyle, textAlign: 'right' }} type="number" min={0} step="0.01" placeholder="Precio"
                          value={row.precioUnitario} onChange={e => updateItem(idx, 'precioUnitario', e.target.value)}
                        />
                        <button
                          onClick={() => removeItem(idx)} type="button" disabled={items.length === 1}
                          style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', cursor: items.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: items.length === 1 ? 0.3 : 1 }}
                        >
                          <Trash2 size={13} color="#FF3B30" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>IVA (%)</label>
                    <input type="number" min={0} step="0.01" style={inputStyle} value={ivaPct} onChange={e => setIvaPct(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                    <button type="button" onClick={() => setIvaIncluido(v => !v)} role="switch" aria-checked={ivaIncluido}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left' }}>
                      <span style={{ width: 34, height: 20, borderRadius: 10, background: ivaIncluido ? '#1D5FE0' : 'var(--border-color)', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}>
                        <span style={{ position: 'absolute', top: 2, left: ivaIncluido ? 16 : 2, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </span>
                      Precios con IVA incluido
                    </button>
                  </div>
                </div>

                {!esFactura && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Cuota mensual (opcional)</label>
                      <input type="number" min={0} step="0.01" style={inputStyle} value={cuotaMensual}
                        onChange={e => setCuotaMensual(e.target.value)} placeholder="€ al mes" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                      <Interruptor activo={pedirOnboarding} onClick={() => setPedirOnboarding(v => !v)}>
                        Al firmar, pedirle el formulario
                      </Interruptor>
                    </div>
                    <p style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-tertiary)', margin: '-4px 0 0', lineHeight: 1.5 }}>
                      Cuando lo firme, la cuota pasa a su ficha (ingreso recurrente y facturas del mes){pedirOnboarding ? ' y le sale el formulario de onboarding justo después de firmar' : ''}.
                    </p>
                  </div>
                )}

                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    <span>{ivaIncluido ? 'Base imponible' : 'Subtotal'}</span><span>{subtotal.toFixed(2)} €</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    <span>IVA ({Number(ivaPct) || 0}%)</span><span>{iva.toFixed(2)} €</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                    <span>Total{ivaIncluido ? ' (IVA incluido)' : ''}</span><span>{total.toFixed(2)} €</span>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Notas (opcional)</label>
                  <textarea
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} rows={3}
                    value={notas} onChange={e => setNotas(e.target.value)}
                    placeholder="Condiciones de pago, observaciones…"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowIssuerModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'inherit', padding: 0, alignSelf: 'flex-start' }}
                >
                  <Settings size={12} /> Editar mis datos fiscales
                </button>

                {error && <p style={{ fontSize: 12.5, color: '#FF3B30', margin: 0 }}>{error}</p>}
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 10, flexShrink: 0 }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={onClose}
                  style={{ padding: '10px 18px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                  Cancelar
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleGuardarClick} disabled={guardando}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, background: guardando ? 'var(--text-tertiary)' : 'var(--accent-blue)', border: 'none', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {guardando ? (
                    <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> Guardando...</>
                  ) : 'Guardar'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <IssuerDataModal
        open={showIssuerModal}
        onClose={() => { setShowIssuerModal(false); setIssuerModalIsGate(false) }}
        onSaved={(datos) => {
          setShowIssuerModal(false)
          // If this modal was triggered as a save-blocking gate (no documento,
          // no emisor data yet), continue the save now that we have it. If it
          // was opened manually via "Editar mis datos fiscales", just close.
          if (issuerModalIsGate) doGuardar(datos)
          setIssuerModalIsGate(false)
        }}
      />
    </>
  )
}
