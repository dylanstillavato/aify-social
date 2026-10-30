import { useRef, useState } from 'react'
import { Upload, Trash2, RefreshCw, Check } from 'lucide-react'
import { actualizarCliente } from '../hooks/useClientes'
import { procesarLogoCliente } from '../utils/fotoCliente'
import { esHexValido, normalizarHex, colorTextoLegible } from '../utils/colorMarca'
import { mensajeErrorAmigable } from '../utils/errorMessage'

// Kit de marca del cliente (pestaña Perfil de ClienteDetalle): logo + colores
// editables en el sitio, tipografía / estética / referencia en solo lectura
// (se editan en el onboarding). Se guarda en cliente.identidadVisual con
// actualizarCliente() y el cliente completo, igual que la foto del cliente.
// El logo vive en identidadVisual.logo (data-URL) — el portal lo lee con ese nombre.

const COLORES = [
  { key: 'colorPrimario', label: 'Primario' },
  { key: 'colorSecundario', label: 'Secundario' },
  { key: 'colorAcento', label: 'Acento' },
]

function borradorDe(iv = {}) {
  return {
    logo: iv.logo || '',
    colorPrimario: iv.colorPrimario || '',
    colorSecundario: iv.colorSecundario || '',
    colorAcento: iv.colorAcento || '',
  }
}

const labelStyle = {
  fontSize: 11, fontWeight: 600, color: '#86868B',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
}

const botonSecundario = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 12, fontWeight: 500, padding: '6px 12px', borderRadius: 10,
  border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
  color: 'var(--text-primary)', cursor: 'pointer',
}

export default function KitMarcaCliente({ cliente, onSaved }) {
  const ivRaw = cliente.identidadVisual
  const iv = ivRaw || {}
  const inputLogoRef = useRef(null)

  const [base, setBase] = useState({ id: cliente.id, iv: ivRaw })
  const [borrador, setBorrador] = useState(() => borradorDe(iv))
  const [procesandoLogo, setProcesandoLogo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [guardadoOk, setGuardadoOk] = useState(false)

  // Resincroniza el borrador si cambia el cliente (o su identidad visual) sin
  // desmontar la pestaña — mismo patrón que la foto en TabPerfil.
  if (base.id !== cliente.id || base.iv !== ivRaw) {
    setBase({ id: cliente.id, iv: ivRaw })
    setBorrador(borradorDe(iv))
    setError(null)
  }

  const original = borradorDe(iv)
  const cambiado = Object.keys(original).some(k => original[k] !== borrador[k])

  const setCampo = (key, valor) => {
    setBorrador(b => ({ ...b, [key]: valor }))
    setGuardadoOk(false)
  }

  const handleLogo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setProcesandoLogo(true)
    try {
      const dataUrl = await procesarLogoCliente(file)
      setCampo('logo', dataUrl)
    } catch (err) {
      setError(err.message || 'No se pudo procesar el logo')
    } finally {
      setProcesandoLogo(false)
    }
  }

  const guardar = async () => {
    // Solo se validan los colores que se han tocado: un valor antiguo en texto
    // libre (del onboarding) no debe bloquear el guardado del logo.
    const nuevo = { ...iv }
    for (const { key, label } of COLORES) {
      const valor = borrador[key].trim()
      if (valor === (original[key] || '').trim()) continue
      if (valor && !esHexValido(valor)) {
        setError(`El color ${label.toLowerCase()} no es un hex válido (ej. #1A2B3C)`)
        return
      }
      nuevo[key] = valor ? normalizarHex(valor) : ''
    }
    if (borrador.logo) nuevo.logo = borrador.logo
    else delete nuevo.logo

    setError(null)
    setGuardando(true)
    try {
      const actualizado = { ...cliente, identidadVisual: nuevo }
      const { data, error: err } = await actualizarCliente(cliente.id, actualizado)
      if (err) {
        setError(mensajeErrorAmigable(err, 'No se pudo guardar el kit de marca'))
        return
      }
      setGuardadoOk(true)
      onSaved?.(data || actualizado)
    } catch (err) {
      setError(mensajeErrorAmigable(err, 'No se pudo guardar el kit de marca'))
    } finally {
      setGuardando(false)
    }
  }

  const descartar = () => {
    setBorrador(original)
    setError(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div style={{ ...labelStyle, marginBottom: 0 }}>Kit de marca</div>
        {guardadoOk && !cambiado && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#30D158' }}>
            <Check size={13} /> Guardado
          </span>
        )}
      </div>

      {/* Logo */}
      <div style={{ marginBottom: 16 }}>
        <div style={labelStyle}>Logo</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{
            width: 120, height: 72, borderRadius: 12, flexShrink: 0,
            border: '1px dashed var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            // Cuadrícula suave para que se note la transparencia del PNG
            background: borrador.logo ? 'repeating-conic-gradient(rgba(0,0,0,0.04) 0% 25%, transparent 0% 50%) 50% / 12px 12px' : 'var(--bg-secondary)',
            overflow: 'hidden',
          }}>
            {borrador.logo
              ? <img src={borrador.logo} alt="Logo del cliente" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
              : <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sin logo</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={botonSecundario} disabled={procesandoLogo || guardando} onClick={() => inputLogoRef.current?.click()}>
              {borrador.logo ? <RefreshCw size={13} /> : <Upload size={13} />}
              {procesandoLogo ? 'Procesando…' : borrador.logo ? 'Cambiar' : 'Subir logo'}
            </button>
            {borrador.logo && (
              <button type="button" style={{ ...botonSecundario, color: '#FF3B30' }} disabled={procesandoLogo || guardando} onClick={() => setCampo('logo', '')}>
                <Trash2 size={13} /> Quitar
              </button>
            )}
          </div>
          <input
            ref={inputLogoRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={handleLogo}
            style={{ display: 'none' }}
          />
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
          PNG, JPG, SVG o WebP, hasta 2 MB. Mejor con fondo transparente.
        </p>
      </div>

      {/* Colores */}
      <div style={{ marginBottom: 14 }}>
        <div style={labelStyle}>Colores</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {COLORES.map(({ key, label }) => {
            const valor = borrador[key]
            const hex = normalizarHex(valor)
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: 8, paddingRight: 12,
                borderRadius: 12, border: '1px solid var(--border-subtle)', minWidth: 150,
              }}>
                <label title={`Elegir color ${label.toLowerCase()}`} style={{
                  position: 'relative', width: 36, height: 36, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
                  background: valor || 'var(--bg-secondary)', border: '1px solid rgba(0,0,0,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600, color: hex ? colorTextoLegible(hex) : 'var(--text-secondary)',
                }}>
                  {hex ? 'Aa' : '+'}
                  <input
                    type="color"
                    value={hex || '#000000'}
                    onChange={e => setCampo(key, e.target.value)}
                    style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                  />
                </label>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
                  <input
                    type="text"
                    value={valor}
                    placeholder="#000000"
                    onChange={e => setCampo(key, e.target.value)}
                    spellCheck={false}
                    style={{
                      width: 84, fontSize: 13, fontFamily: 'monospace', padding: 0,
                      border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {cambiado && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || procesandoLogo}
            style={{
              fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 10, border: 'none',
              background: 'var(--accent-lime, #D7FF3D)', color: '#0B0C10', cursor: 'pointer',
              opacity: guardando ? 0.6 : 1,
            }}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" style={botonSecundario} onClick={descartar} disabled={guardando}>Descartar</button>
        </div>
      )}
      {error && <p style={{ fontSize: 12, color: '#FF3B30', margin: '0 0 12px' }}>{error}</p>}

      {iv.estiloTipografia && (
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>Tipografía</div>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>
            {iv.estiloTipografia}{iv.fuenteEspecifica ? ` — ${iv.fuenteEspecifica}` : ''}
          </p>
        </div>
      )}
      {iv.estetica?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>Estética</div>
          <div>
            {iv.estetica.map(e => (
              <span key={e} style={{
                display: 'inline-block', fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 20,
                marginRight: 6, marginBottom: 6, background: 'rgba(0,0,0,0.05)', color: '#1D1D1F',
              }}>{e}</span>
            ))}
          </div>
        </div>
      )}
      {iv.referenciaEstetica && (
        <div>
          <div style={labelStyle}>Referencia</div>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>{iv.referenciaEstetica}</p>
        </div>
      )}
    </div>
  )
}
