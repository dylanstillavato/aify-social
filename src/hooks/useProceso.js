import { useAjusteOrganizacion } from './useAjusteOrganizacion'
import { normalizarProceso, pasosVisibles, procesoEditable } from '../utils/pasosCliente'

// Proceso del mes de la organización (0029_proceso.sql): los pasos de la
// ficha de cliente, renombrados, ocultos o añadidos en Configuración.
export function useProceso() {
  const { valor, loading, enOrganizacion, guardar } = useAjusteOrganizacion('proceso', normalizarProceso)
  return {
    config: valor,
    pasos: pasosVisibles(valor),
    editable: procesoEditable(valor),
    loading,
    enOrganizacion,
    guardar,
  }
}
