import { useAppContext } from '../context/AppContext'

/**
 * Cliente activo compartido por todas las páginas de creación (fuente única,
 * persistida en localStorage 'aify_cliente_activo' y sincronizada entre
 * pestañas por AppProvider).
 *
 * clienteActivoId es siempre un string (o null). El cliente efectivo se deriva
 * en cada página: clientes.find(c => String(c.id) === clienteActivoId) || clientes[0]
 */
export function useClienteActivo() {
  const { clienteActivo, setClienteActivo } = useAppContext()
  return { clienteActivoId: clienteActivo, setClienteActivoId: setClienteActivo }
}
