import ProcesoCliente from './ProcesoCliente'
import { TABS_SECUNDARIAS } from '../utils/pasosCliente'
import { nombreMes } from '../utils/metricasDinero'
import { useEsMovil } from '../hooks/useEsMovil'

// Barra de navegación de la ficha de cliente, en dos niveles:
// - principal: "Contenido de <mes>", los pasos del mes (editables en
//   Configuración) con su descripción y su check. El mes es el que se ve
//   (`mes`, de ?mes=YYYY-MM en la ficha) o el actual
// - secundaria (a la derecha, más pequeña): Resumen, Perfil, Facturación
// Todo cambia de pestaña dentro de la ficha: nada saca al gestor del cliente.
// En móvil los pasos van en una sola fila que se desliza y las pestañas
// secundarias bajan a su propia fila.

export default function ClienteNavegacion({ cliente, pasos, mes = new Date(), activeTab, onGoToTab }) {
  const esMovil = useEsMovil()
  const proceso = <ProcesoCliente cliente={cliente} pasos={pasos} mes={mes} activeTab={activeTab} refreshKey={activeTab} onGoToTab={onGoToTab} />
  return (
    <div style={{
      background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)',
      padding: esMovil ? '0 16px' : '0 40px', flexShrink: 0,
      display: 'flex', alignItems: esMovil ? 'stretch' : 'flex-end', gap: esMovil ? 0 : 24, flexWrap: esMovil ? 'nowrap' : 'wrap',
      flexDirection: esMovil ? 'column' : 'row',
    }}>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', paddingTop: 12, paddingLeft: 8 }}>
          Contenido de {nombreMes(mes.getMonth()).toLowerCase()}
        </div>
        {esMovil ? (
          // max-content: los pasos no se parten en varias líneas y la fila se desliza
          <div className="fila-deslizable" style={{ overflowX: 'auto', scrollSnapType: 'x proximity', margin: '0 -16px', padding: '0 16px', scrollPaddingLeft: 16 }}>
            <div style={{ width: 'max-content' }}>{proceso}</div>
          </div>
        ) : proceso}
      </div>

      <div role="tablist" aria-label="Datos del cliente" style={{ display: 'flex', gap: 18, marginLeft: esMovil ? 0 : 'auto', ...(esMovil ? { borderTop: '1px solid var(--border-subtle)', paddingLeft: 8 } : {}) }}>
        {TABS_SECUNDARIAS.map(tab => {
          const activo = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => onGoToTab(tab.id)}
              style={{
                padding: '12px 0 13px', marginBottom: -1,
                fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                background: 'none', border: 'none',
                borderBottom: activo ? '2px solid #1D5FE0' : '2px solid transparent',
                color: activo ? '#1D5FE0' : '#86868B',
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
