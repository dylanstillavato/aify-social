import { createContext, useCallback, useContext, useEffect, useRef } from 'react'

// Contexto de la cola de generaciones (lo rellena GeneracionesProvider, en
// context/GeneracionesContext.jsx). Va en su propio archivo para que el del
// proveedor solo exporte componentes (react-refresh/only-export-components).
export const GeneracionesContext = createContext(null)

export function useGeneraciones() {
  const ctx = useContext(GeneracionesContext)
  if (!ctx) throw new Error('useGeneraciones must be used within GeneracionesProvider')
  return ctx
}

// Generación de un solo paso lanzada desde un botón de una pantalla (regenerar
// un guion, sacar planos, rehacer una idea...). Va a la cola: sigue aunque se
// cambie de página y sale en la barra. Si la pantalla sigue abierta al
// terminar, se quita de la barra y el resultado sale donde siempre (como
// PrepararMes); si no, la barra lo enseña con «Ver».
// - ejecutar(trabajo, fn): como lanzar, con barra indeterminada por defecto.
//   Devuelve lo que devuelve fn y lanza el error si falla (solo con la
//   pantalla abierta: fuera, el error ya lo enseña la barra).
// - enCurso(clave): el trabajo que sigue corriendo con esa `clave` (para que,
//   al volver a la pantalla, el botón siga «Generando...»).
export function useGeneracionDePantalla() {
  const { lanzar, quitar, trabajos } = useGeneraciones()
  const montadoRef = useRef(true)
  useEffect(() => { montadoRef.current = true; return () => { montadoRef.current = false } }, [])

  const ejecutar = useCallback(async (trabajo, fn) => {
    const { id, promesa } = lanzar({ indeterminado: true, ...trabajo }, fn)
    const r = await promesa
    if (!montadoRef.current) return r
    quitar(id)
    if (r?.error) throw new Error(r.error)
    return r
  }, [lanzar, quitar])

  const enCurso = useCallback((clave) => (clave
    ? trabajos.find(t => t.clave === clave && t.estado === 'corriendo') || null
    : null), [trabajos])

  return { ejecutar, enCurso }
}
