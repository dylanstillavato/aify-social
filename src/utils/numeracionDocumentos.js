// Numbering scheme: {PREFIX}-{año}-{seq}, sequential per type per year: el
// siguiente al mayor número de este año que ya exista. Contar documentos (lo
// que se hacía antes) repetía números al borrar uno intermedio, y ahora la
// sección Dinero numera sin que el usuario lo vea. Documentos con otro formato
// de número no cuentan.
//
// Compartido por DocumentoPanel (documento nuevo) y la sección Dinero
// (convertir presupuesto en factura, generar facturas de cuota mensual).
export function numeroPorDefecto(tipo, documentosExistentes) {
  const prefix = tipo === 'factura' ? 'F' : 'P'
  const año = new Date().getFullYear()
  const patron = new RegExp(`^${prefix}-${año}-(\\d+)$`)
  const maximo = (documentosExistentes || []).reduce((max, d) => {
    const m = patron.exec(String(d.numero || '').trim())
    return m ? Math.max(max, Number(m[1])) : max
  }, 0)
  const seq = maximo + 1
  return `${prefix}-${año}-${String(seq).padStart(4, '0')}`
}
