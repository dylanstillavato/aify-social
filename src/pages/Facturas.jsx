import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, FileText, FileSignature, Download, Edit3, Trash2, Link as LinkIcon,
  Settings, Check, Receipt, ArrowRightLeft, CheckCircle2,
} from 'lucide-react'
import { useClientesList } from '../hooks/useClientes'
import { useFacturasList, eliminarFactura, crearFactura } from '../hooks/useFacturas'
import { usePresupuestosList, eliminarPresupuesto } from '../hooks/usePresupuestos'
import { exportarFactura, exportarPresupuesto } from '../services/exportPDF'
import DocumentoPanel from '../components/DocumentoPanel'
import IssuerDataModal from '../components/IssuerDataModal'
import { numeroPorDefecto } from '../utils/numeracionDocumentos'
import { isoDia } from '../utils/metricasDinero'
import { useEsMovil } from '../hooks/useEsMovil'

const ESTADO_BADGE = {
  // facturas
  pendiente: { label: 'Pendiente', bg: '#FF9500', text: 'white' },
  pagada: { label: 'Pagada', bg: '#30D158', text: 'white' },
  vencida: { label: 'Vencida', bg: '#FF3B30', text: 'white' },
  cancelada: { label: 'Cancelada', bg: '#86868B', text: 'white' },
  // presupuestos
  borrador: { label: 'Borrador', bg: '#86868B', text: 'white' },
  enviado: { label: 'Enviado', bg: '#0071E3', text: 'white' },
  firmado: { label: 'Firmado', bg: '#30D158', text: 'white' },
  rechazado: { label: 'Rechazado', bg: '#FF3B30', text: 'white' },
}

function formatFecha(iso) {
  if (!iso) return '–'
  try { return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

function EstadoBadge({ estado }) {
  const cfg = ESTADO_BADGE[estado] || { label: estado, bg: '#86868B', text: 'white' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, color: cfg.text, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function IconButton({ icon: Icon, label, onClick, color, disabled }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 30, height: 30, borderRadius: 8, background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)', cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon size={13} color={color || 'var(--text-primary)'} />
    </motion.button>
  )
}


// Factura a partir de un presupuesto firmado: mismos importes, conceptos,
// emisor y notas; emitida hoy, vence a 15 días, numerada como cualquier
// factura nueva (numeroPorDefecto sobre las facturas existentes).
function facturaDesdePresupuesto(presupuesto, facturasExistentes) {
  const hoy = new Date()
  const vence = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 15)
  const periodo = isoDia(hoy).slice(0, 7)
  return {
    clienteId: presupuesto.clienteId,
    numero: numeroPorDefecto('factura', facturasExistentes),
    fechaEmision: isoDia(hoy),
    fechaVencimiento: isoDia(vence),
    estado: 'pendiente',
    items: presupuesto.items || [],
    subtotal: presupuesto.subtotal,
    ivaPct: presupuesto.ivaPct,
    iva: presupuesto.iva,
    total: presupuesto.total,
    ivaIncluido: !!presupuesto.ivaIncluido,
    emisor: presupuesto.emisor || {},
    notas: presupuesto.notas || '',
    presupuestoId: presupuesto.id,
    // Con cuota (0047), esta factura cubre el mes en curso: con periodo,
    // "Generar facturas de <mes>" ya no se lo vuelve a facturar. Solo si ese
    // mes está libre (índice único cliente + periodo de 0020).
    ...(Number(presupuesto.cuotaMensual) > 0 && !(facturasExistentes || []).some(f =>
      String(f.clienteId) === String(presupuesto.clienteId) && f.periodo === periodo)
      ? { periodo } : {}),
  }
}

const COLUMNAS = {
  facturas: '110px 1fr 100px 100px 110px 130px',
  presupuestos: '110px 1fr 100px 100px 110px 290px',
}

/**
 * Lista + editor de facturas o presupuestos (según `tab`), sin cabecera de
 * página. La usan la página /facturas y la sección Dinero (/dinero).
 *
 * Props:
 *  - tab: 'facturas' | 'presupuestos'
 *  - nuevoAlAbrir: abre el editor de un documento nuevo al montar (deep link ?nuevo=)
 */
export function DocumentosFacturacion({ tab, nuevoAlAbrir = false }) {
  const esFacturas = tab === 'facturas'
  const esMovil = useEsMovil()

  const { clientes } = useClientesList()
  const { facturas, loading: loadingFacturas, refetch: refetchFacturas } = useFacturasList()
  const { presupuestos, loading: loadingPresupuestos, refetch: refetchPresupuestos } = usePresupuestosList()

  const [panelOpen, setPanelOpen] = useState(nuevoAlAbrir)
  const [panelKey, setPanelKey] = useState(0) // bumped on every open — forces DocumentoPanel to remount with fresh initial state
  const [panelTipo, setPanelTipo] = useState(esFacturas ? 'factura' : 'presupuesto')
  const [editando, setEditando] = useState(null)
  const [showIssuerModal, setShowIssuerModal] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(null) // { tipo, id, numero }
  const [toast, setToast] = useState(null)
  const [exportandoId, setExportandoId] = useState(null)
  const [convirtiendoId, setConvirtiendoId] = useState(null)

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t) }
  }, [toast])

  const clienteById = useMemo(() => {
    const map = {}
    ;(clientes || []).forEach(c => { map[String(c.id)] = c })
    return map
  }, [clientes])

  // presupuestoId -> factura generada a partir de él. Sin la migración 0020 la
  // factura se guarda sin presupuestoId, así que también se reconoce una
  // factura sin vínculo del mismo cliente, total y conceptos: sin esto, cada
  // clic en "Convertir en factura" crearía otra.
  const facturaPorPresupuesto = useMemo(() => {
    const map = {}
    ;(facturas || []).forEach(f => { if (f.presupuestoId) map[String(f.presupuestoId)] = f })
    // Cada factura sin vínculo empareja como mucho un presupuesto (el firmado
    // antes), y solo si se creó después de la firma.
    const usadas = new Set()
    const sinVinculo = (facturas || []).filter(f => !f.presupuestoId)
    ;[...(presupuestos || [])]
      .filter(p => p.estado === 'firmado' && !map[String(p.id)])
      .sort((a, b) => String(a.firmadoEn || '').localeCompare(String(b.firmadoEn || '')))
      .forEach(p => {
        const igual = sinVinculo.find(f =>
          !usadas.has(f.id) &&
          String(f.clienteId) === String(p.clienteId) &&
          Number(f.total) === Number(p.total) &&
          (!p.firmadoEn || !f.creadoEn || String(f.creadoEn) >= String(p.firmadoEn)) &&
          JSON.stringify(f.items || []) === JSON.stringify(p.items || []))
        if (igual) { usadas.add(igual.id); map[String(p.id)] = igual }
      })
    return map
  }, [facturas, presupuestos])

  const tipoDeTab = esFacturas ? 'factura' : 'presupuesto'
  const abrirPanel = (tipo, doc) => { setPanelTipo(tipo); setEditando(doc); setPanelKey(k => k + 1); setPanelOpen(true) }
  const abrirNuevo = () => abrirPanel(tipoDeTab, null)
  const abrirEditar = (doc) => abrirPanel(tipoDeTab, doc)

  const handleSaved = () => {
    refetchFacturas()
    refetchPresupuestos()
    setToast(panelTipo === 'factura' ? 'Factura guardada' : 'Presupuesto guardado')
  }

  const handleExportar = async (doc) => {
    const cliente = clienteById[String(doc.clienteId)]
    if (!cliente) { setToast('No se encontró el cliente de este documento'); return }
    setExportandoId(doc.id)
    try {
      if (esFacturas) await exportarFactura(cliente, doc)
      else await exportarPresupuesto(cliente, doc)
    } catch (e) {
      setToast(e.message || 'No se pudo exportar el PDF')
    } finally {
      setExportandoId(null)
    }
  }

  const handleCopiarEnlace = async (presupuesto) => {
    try {
      const url = `${window.location.origin}/firmar/${presupuesto.token}`
      await navigator.clipboard.writeText(url)
      setToast('Enlace de firma copiado')
    } catch {
      setToast('No se pudo copiar el enlace')
    }
  }

  const handleConvertir = async (presupuesto) => {
    if (convirtiendoId || facturaPorPresupuesto[String(presupuesto.id)]) return
    setConvirtiendoId(presupuesto.id)
    try {
      const { data, error } = await crearFactura(facturaDesdePresupuesto(presupuesto, facturas))
      if (error) throw error
      await refetchFacturas()
      setToast(`Factura ${data.numero} creada`)
      abrirPanel('factura', data)
    } catch (e) {
      setToast(e?.message || 'No se pudo crear la factura')
    } finally {
      setConvirtiendoId(null)
    }
  }

  const handleEliminar = async () => {
    if (!confirmEliminar) return
    if (confirmEliminar.tipo === 'factura') await eliminarFactura(confirmEliminar.id)
    else await eliminarPresupuesto(confirmEliminar.id)
    setConfirmEliminar(null)
    refetchFacturas()
    refetchPresupuestos()
    setToast('Documento eliminado')
  }

  const docs = esFacturas ? facturas : presupuestos
  const loading = esFacturas ? loadingFacturas : loadingPresupuestos
  const columnas = COLUMNAS[tab] || COLUMNAS.facturas

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginBottom: 18 }}>
        <button
          onClick={() => setShowIssuerModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'inherit' }}
        >
          <Settings size={13} /> Mis datos fiscales
        </button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={abrirNuevo}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', borderRadius: 10,
            background: 'var(--accent-blue)', color: 'white', border: 'none',
            cursor: 'pointer', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          <Plus size={14} /> {esFacturas ? 'Nueva factura' : 'Nuevo presupuesto'}
        </motion.button>
      </div>

      {!loading && docs.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(0,113,227,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Receipt size={24} color="#0071E3" />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            {esFacturas ? 'Sin facturas todavía' : 'Sin presupuestos todavía'}
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 340, lineHeight: 1.6, marginBottom: 24 }}>
            {esFacturas
              ? 'Crea tu primera factura para uno de tus clientes.'
              : 'Crea un presupuesto y comparte su enlace de firma con el cliente.'}
          </p>
          <button
            onClick={abrirNuevo}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, background: '#0071E3', color: 'white', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}
          >
            <Plus size={14} /> {esFacturas ? 'Nueva factura' : 'Nuevo presupuesto'}
          </button>
        </div>
      )}

      {docs.length > 0 && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-subtle)',
          overflow: 'hidden', boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
        }}>
          {/* En móvil se desliza la tabla, no la página */}
          <div style={esMovil ? { overflowX: 'auto' } : undefined}>
          <div style={esMovil ? { minWidth: esFacturas ? 780 : 940 } : undefined}>
          <div style={{
            display: 'grid', gridTemplateColumns: columnas,
            gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
            fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px',
          }}>
            <span>Número</span>
            <span>Cliente</span>
            <span>Fecha</span>
            <span>Total</span>
            <span>Estado</span>
            <span style={{ textAlign: 'right' }}>Acciones</span>
          </div>
          {docs.map(doc => {
            const cliente = clienteById[String(doc.clienteId)]
            const facturaGenerada = !esFacturas ? facturaPorPresupuesto[String(doc.id)] : null
            return (
              <div
                key={doc.id}
                style={{
                  display: 'grid', gridTemplateColumns: columnas,
                  gap: 12, padding: '14px 20px', alignItems: 'center',
                  borderBottom: '1px solid var(--border-subtle)', fontSize: 13.5,
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{doc.numero}</span>
                <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cliente?.nombre || 'Cliente eliminado'}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{formatFecha(doc.fechaEmision)}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{Number(doc.total || 0).toFixed(2)} €</span>
                <EstadoBadge estado={doc.estado} />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {!esFacturas && doc.estado === 'firmado' && (facturaGenerada ? (
                    <button
                      onClick={() => abrirPanel('factura', facturaGenerada)}
                      title={`Abrir factura ${facturaGenerada.numero}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, height: 30, padding: '0 10px', borderRadius: 8,
                        background: 'transparent', border: '1px solid var(--border-subtle)', cursor: 'pointer',
                        fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit', whiteSpace: 'nowrap',
                      }}
                    >
                      <CheckCircle2 size={13} color="#30D158" /> Ya facturado
                    </button>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleConvertir(doc)}
                      disabled={!!convirtiendoId}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, height: 30, padding: '0 11px', borderRadius: 8,
                        background: '#D7FF3D', color: '#0B0C10', border: 'none',
                        cursor: convirtiendoId ? 'wait' : 'pointer', opacity: convirtiendoId && convirtiendoId !== doc.id ? 0.5 : 1,
                        fontSize: 12, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
                      }}
                    >
                      <ArrowRightLeft size={13} /> {convirtiendoId === doc.id ? 'Creando…' : 'Convertir en factura'}
                    </motion.button>
                  ))}
                  <IconButton icon={Edit3} label="Editar" onClick={() => abrirEditar(doc)} />
                  <IconButton
                    icon={Download} label="Exportar PDF"
                    onClick={() => handleExportar(doc)}
                    disabled={exportandoId === doc.id}
                  />
                  {!esFacturas && (
                    <IconButton icon={LinkIcon} label="Copiar enlace de firma" onClick={() => handleCopiarEnlace(doc)} />
                  )}
                  <IconButton
                    icon={Trash2} label="Eliminar" color="#FF3B30"
                    onClick={() => setConfirmEliminar({ tipo: tipoDeTab, id: doc.id, numero: doc.numero })}
                  />
                </div>
              </div>
            )
          })}
          </div>
          </div>
        </div>
      )}

      <DocumentoPanel
        key={panelKey}
        tipo={panelTipo}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        documento={editando}
        clientes={clientes}
        documentosExistentes={panelTipo === 'factura' ? facturas : presupuestos}
        onSaved={handleSaved}
      />

      <IssuerDataModal open={showIssuerModal} onClose={() => setShowIssuerModal(false)} onSaved={() => setShowIssuerModal(false)} />

      {/* Confirm delete */}
      <AnimatePresence>
        {confirmEliminar && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setConfirmEliminar(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '24px 26px', maxWidth: 360, boxShadow: 'var(--shadow-lg)' }}
            >
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                ¿Eliminar {confirmEliminar.tipo === 'factura' ? 'factura' : 'presupuesto'} {confirmEliminar.numero}?
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
                Esta acción no se puede deshacer.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmEliminar(null)}
                  style={{ padding: '9px 16px', borderRadius: 9, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button onClick={handleEliminar}
                  style={{ padding: '9px 16px', borderRadius: 9, background: '#FF3B30', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
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
    </>
  )
}

// Página /facturas (se mantiene por enlaces existentes; la navegación principal
// ya lleva a /dinero). Deep links: ?tab=presupuestos, ?nuevo=factura|presupuesto
export default function Facturas() {
  const [searchParams, setSearchParams] = useSearchParams()
  const nuevo = searchParams.get('nuevo')
  const activeTab = nuevo === 'presupuesto' || searchParams.get('tab') === 'presupuestos' ? 'presupuestos' : 'facturas'
  // Solo se lee en el primer render: el editor se abre una vez por deep link
  // (y deja de aplicarse en cuanto se cambia de pestaña)
  const [nuevoAlAbrir, setNuevoAlAbrir] = useState(() => nuevo === 'factura' || nuevo === 'presupuesto')

  useEffect(() => {
    if (!nuevo) return
    const next = new URLSearchParams(searchParams)
    next.delete('nuevo')
    if (nuevo === 'presupuesto') next.set('tab', 'presupuestos')
    setSearchParams(next, { replace: true })
  }, [nuevo, searchParams, setSearchParams])

  const cambiarTab = (tab) => {
    setNuevoAlAbrir(false)
    const next = new URLSearchParams(searchParams)
    if (tab === 'presupuestos') next.set('tab', 'presupuestos')
    else next.delete('tab')
    setSearchParams(next, { replace: true })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--gradient-bg)', minHeight: '100vh' }}
    >
      {/* Header */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '24px 40px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: 0 }}>
          Facturación
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 3 }}>
          Facturas y presupuestos de todos tus clientes
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)',
        padding: '0 40px', display: 'flex', gap: 0,
      }}>
        {[
          { id: 'facturas', label: 'Facturas', icon: FileText },
          { id: 'presupuestos', label: 'Presupuestos', icon: FileSignature },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => cambiarTab(tab.id)}
            style={{
              padding: '14px 0', marginRight: 28,
              fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #0071E3' : '2px solid transparent',
              color: activeTab === tab.id ? '#0071E3' : '#86868B',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: '28px 40px' }}>
        <DocumentosFacturacion key={activeTab} tab={activeTab} nuevoAlAbrir={nuevoAlAbrir} />
      </div>
    </motion.div>
  )
}
