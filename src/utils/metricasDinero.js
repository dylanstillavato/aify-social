// Métricas de dinero a partir de facturas, presupuestos y clientes, en
// funciones puras (sin React ni Supabase) para compartirlas entre el Inicio
// y la sección Dinero. Las fechas de factura son strings 'YYYY-MM-DD'.
//
// Definiciones:
// - cobrado en un mes: facturas 'pagada' con fecha de emisión en ese mes (no
//   hay fecha de pago guardada, así que la emisión es la mejor aproximación)
// - vencido: 'vencida', o 'pendiente' con fecha de vencimiento anterior a hoy
// - pendiente: 'pendiente' que todavía no ha vencido

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export const nombreMes = (mes) => MESES[mes]

export function isoDia(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

const enMes = (fechaStr, año, mes) => {
  if (!fechaStr) return false
  const [y, m] = fechaStr.split('-').map(Number)
  return y === año && m === mes + 1
}

const suma = (lista) => lista.reduce((acc, f) => acc + (Number(f.total) || 0), 0)

export function esVencida(factura, hoy) {
  if (factura.estado === 'vencida') return true
  return factura.estado === 'pendiente' && !!factura.fechaVencimiento && factura.fechaVencimiento < isoDia(hoy)
}

// mes 0-indexed (convención de Date)
export function cobradoEnMes(facturas, año, mes) {
  return suma(facturas.filter(f => f.estado === 'pagada' && enMes(f.fechaEmision, año, mes)))
}

export function facturasPendientes(facturas, hoy) {
  return facturas.filter(f => f.estado === 'pendiente' && !esVencida(f, hoy))
}

export function facturasVencidas(facturas, hoy) {
  return facturas.filter(f => esVencida(f, hoy))
}

export const pendiente = (facturas, hoy) => suma(facturasPendientes(facturas, hoy))
export const vencido = (facturas, hoy) => suma(facturasVencidas(facturas, hoy))

// Últimos `meses` meses terminando en el de `hoy`, del más antiguo al actual:
// [{ año, mes, total }]
export function serieCobrado(facturas, hoy, meses = 6) {
  const serie = []
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    serie.push({ año: d.getFullYear(), mes: d.getMonth(), total: cobradoEnMes(facturas, d.getFullYear(), d.getMonth()) })
  }
  return serie
}

// Variación del mes actual frente al anterior, en %, o null si el anterior es 0
export function variacionMensual(facturas, hoy) {
  const actual = cobradoEnMes(facturas, hoy.getFullYear(), hoy.getMonth())
  const prev = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const anterior = cobradoEnMes(facturas, prev.getFullYear(), prev.getMonth())
  if (!anterior) return null
  return Math.round(((actual - anterior) / anterior) * 100)
}

// Ingreso mensual recurrente: suma de la cuota de los clientes no archivados
export function mrr(clientes) {
  return clientes
    .filter(c => !c.archivado)
    .reduce((acc, c) => acc + (Number(c.cuotaMensual) || 0), 0)
}

const formatoEuros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const euros = (n) => formatoEuros.format(Number(n) || 0)
