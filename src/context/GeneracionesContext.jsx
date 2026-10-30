import { useCallback, useEffect, useRef, useState } from 'react'
import { GeneracionesContext } from '../hooks/useGeneraciones'
import { registrarDuracion } from '../utils/duracionGeneraciones'

// Cola de generaciones con IA de toda la app (guiones en lote, ideas del
// mes...). La promesa de cada trabajo vive aquí, no en el componente que la
// lanza: cerrar el modal o cambiar de página no la corta, y BarraGeneracion
// enseña su progreso desde cualquier pantalla. Solo cerrar o recargar la
// pestaña del navegador la corta (se avisa con beforeunload).
//
// Un trabajo: { id, tipo, titulo, clienteId, destino ({ ruta, state? } para
// el botón «Ver»), total, hechos, indeterminado, empezadoEn, ultimoAvanceEn,
// terminadoEn, estado: 'corriendo'|'hecho'|'error', error, resultado }.
// lanzar(trabajo, fn) llama a fn(avanzar, debeParar): avanzar(hechos, paso?)
// mueve la barra (`paso`: texto de lo que hace ahora) y debeParar() dice si el gestor ha pulsado Parar. Lo que devuelve fn
// queda en `resultado` (si trae `ver`, sustituye al destino; `texto` es el
// resumen de la barra: «8 guiones»; `error` y `fallidas`, lo que falló).
// Se usa con useGeneraciones (hooks/useGeneraciones.js). `clave` (opcional)
// identifica el trabajo de un botón concreto (useGeneracionDePantalla). De
// los de un solo paso (indeterminado) se apunta cuánto han tardado, para la
// estimación de la barra (utils/duracionGeneraciones.js).

let siguienteId = 0

export function GeneracionesProvider({ children }) {
  const [trabajos, setTrabajos] = useState([])
  // Sube cada vez que termina un trabajo: las pantallas abiertas lo miran para
  // volver a leer lo que se ha guardado
  const [terminados, setTerminados] = useState(0)
  const parados = useRef(new Set())

  const actualizar = useCallback((id, cambios) => {
    setTrabajos(ts => ts.map(t => (t.id === id ? { ...t, ...cambios } : t)))
  }, [])

  const lanzar = useCallback((trabajo, fn) => {
    siguienteId += 1
    const id = `gen-${Date.now()}-${siguienteId}`
    const ahora = Date.now()
    setTrabajos(ts => [...ts, {
      total: 1, indeterminado: false, ...trabajo,
      id, hechos: 0, empezadoEn: ahora, ultimoAvanceEn: null, terminadoEn: null,
      estado: 'corriendo', error: null, resultado: null,
    }])
    const avanzar = (hechos, paso) => actualizar(id, { hechos, ultimoAvanceEn: Date.now(), ...(paso ? { paso } : {}) })
    const debeParar = () => parados.current.has(id)
    const promesa = Promise.resolve()
      .then(() => fn(avanzar, debeParar))
      .then((resultado) => {
        if (trabajo.indeterminado) registrarDuracion(trabajo.tipo, Date.now() - ahora)
        actualizar(id, { estado: 'hecho', resultado: resultado ?? null, terminadoEn: Date.now(), ...(resultado?.ver ? { destino: resultado.ver } : {}) })
        return resultado
      }, (e) => {
        const error = e?.message || 'Algo ha fallado en la generación.'
        actualizar(id, { estado: 'error', error, terminadoEn: Date.now() })
        return { error }
      })
      .finally(() => {
        parados.current.delete(id)
        setTerminados(n => n + 1)
      })
    return { id, promesa }
  }, [actualizar])

  const parar = useCallback((id) => { parados.current.add(id) }, [])
  const quitar = useCallback((id) => setTrabajos(ts => ts.filter(t => t.id !== id)), [])

  // Cerrar o recargar la pestaña corta lo que esté en marcha: se avisa
  const hayCorriendo = trabajos.some(t => t.estado === 'corriendo')
  useEffect(() => {
    if (!hayCorriendo) return undefined
    const avisar = (e) => {
      e.preventDefault()
      e.returnValue = 'Hay generaciones en marcha. Si cierras o recargas la pestaña, se cortarán.'
      return e.returnValue
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayCorriendo])

  return (
    <GeneracionesContext.Provider value={{ trabajos, terminados, lanzar, parar, quitar }}>
      {children}
    </GeneracionesContext.Provider>
  )
}
