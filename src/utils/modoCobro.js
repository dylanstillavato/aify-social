// Modo de cobro: por adelantado (la factura del mes sale al empezar) o al
// entregar (la factura sale al publicar). Global en organizaciones.modo_cobro,
// con excepción opcional por cliente en clientes.modo_cobro (null = usa el de
// la organización). Ver supabase/migrations/0026_modo_cobro.sql.

export const MODO_COBRO_POR_DEFECTO = 'al_entregar'

export const OPCIONES_MODO_COBRO = [
  { id: 'adelantado', label: 'Por adelantado', desc: 'La factura del mes sale al empezar' },
  { id: 'al_entregar', label: 'Al entregar', desc: 'La factura sale al publicar' },
]

export function esModoCobroValido(modo) {
  return modo === 'adelantado' || modo === 'al_entregar'
}

export function etiquetaModoCobro(modo) {
  return OPCIONES_MODO_COBRO.find(o => o.id === modo)?.label || 'Al entregar'
}

// Modo de la organización (acepta la fila de organizaciones o un objeto con
// modoCobro). Sin valor válido, el de por defecto.
export function modoCobroOrganizacion(organizacion) {
  const modo = organizacion?.modo_cobro ?? organizacion?.modoCobro
  return esModoCobroValido(modo) ? modo : MODO_COBRO_POR_DEFECTO
}

// Modo efectivo de un cliente: el suyo si lo tiene, si no el de la organización.
export function modoCobroCliente(cliente, organizacion) {
  const propio = cliente?.modoCobro ?? cliente?.modo_cobro
  if (esModoCobroValido(propio)) return propio
  return modoCobroOrganizacion(organizacion)
}
