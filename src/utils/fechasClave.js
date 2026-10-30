// Fechas importantes del onboarding (fechasClaveObj) llevadas al calendario:
// devuelve, para un mes concreto, qué días tienen una fecha marcada.
//
// - Generales (FECHAS_GENERALES de NuevoClienteData.js): solo las que tienen un
//   día real en el año (fijo o calculable). Vuelta al cole, Verano y Otoño no
//   tienen un día concreto, así que no se pintan (no inventamos fechas).
// - Propias: el cliente las da con fecha (YYYY-MM-DD). Se tratan como fechas
//   que se repiten cada año (aniversario, fiesta del local...): se pintan el
//   mismo día y mes en el año que se esté viendo.

// Domingo de Pascua (algoritmo anónimo gregoriano), para Carnaval
function domingoPascua(anio) {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(anio, mes - 1, dia)
}

// n-ésimo día de la semana (0 = domingo) de un mes
function enesimoDiaSemana(anio, mes, diaSemana, n) {
  const primero = new Date(anio, mes, 1).getDay()
  const dia = 1 + ((diaSemana - primero + 7) % 7) + (n - 1) * 7
  return new Date(anio, mes, dia)
}

function blackFriday(anio) {
  const accionGracias = enesimoDiaSemana(anio, 10, 4, 4) // 4º jueves de noviembre
  return new Date(anio, 10, accionGracias.getDate() + 1)
}

// id -> [{ fecha, label }] para un año (fechas en España)
const GENERALES_POR_ANIO = {
  navidad: a => [{ fecha: new Date(a, 11, 25), label: 'Navidad' }],
  san_valentin: a => [{ fecha: new Date(a, 1, 14), label: 'San Valentín' }],
  padre_madre: a => [
    { fecha: new Date(a, 2, 19), label: 'Día del Padre' },
    { fecha: enesimoDiaSemana(a, 4, 0, 1), label: 'Día de la Madre' }, // 1er domingo de mayo
  ],
  halloween: a => [{ fecha: new Date(a, 9, 31), label: 'Halloween' }],
  black_friday: a => [{ fecha: blackFriday(a), label: 'Black Friday' }],
  cyber_monday: a => {
    const bf = blackFriday(a)
    return [{ fecha: new Date(a, bf.getMonth(), bf.getDate() + 3), label: 'Cyber Monday' }]
  },
  ano_nuevo: a => [{ fecha: new Date(a, 0, 1), label: 'Año Nuevo' }],
  carnaval: a => {
    const pascua = domingoPascua(a)
    return [{ fecha: new Date(a, pascua.getMonth(), pascua.getDate() - 47), label: 'Carnaval' }] // martes de Carnaval
  },
}

// { [dia]: [{ label, tipo: 'general' | 'propia' }] } para el mes `mes` (0-11) de `anio`
export function fechasClaveDelMes(fechasClaveObj, anio, mes) {
  const porDia = {}
  if (!fechasClaveObj || typeof fechasClaveObj !== 'object') return porDia
  const añadir = (dia, label, tipo) => {
    if (!porDia[dia]) porDia[dia] = []
    if (!porDia[dia].some(x => x.label === label)) porDia[dia].push({ label, tipo })
  }

  ;(Array.isArray(fechasClaveObj.generales) ? fechasClaveObj.generales : []).forEach(id => {
    const calc = GENERALES_POR_ANIO[id]
    if (!calc) return
    calc(anio).forEach(({ fecha, label }) => {
      if (fecha.getMonth() === mes) añadir(fecha.getDate(), label, 'general')
    })
  })

  ;(Array.isArray(fechasClaveObj.propias) ? fechasClaveObj.propias : []).forEach(fp => {
    const [, m, d] = String(fp?.fecha || '').split('-').map(Number)
    if (!fp?.nombre || !m || !d) return
    // 29 de febrero en un año no bisiesto: no existe, no se pinta
    const fecha = new Date(anio, m - 1, d)
    if (fecha.getMonth() !== m - 1) return
    if (m - 1 === mes) añadir(d, fp.nombre, 'propia')
  })

  return porDia
}
