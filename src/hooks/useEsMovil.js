import { useState, useEffect } from 'react'

// Por debajo de este ancho la app pasa a su versión de móvil (barra lateral
// como cajón, rejillas a una columna…).
export const ANCHO_MOVIL = 820

export function useEsMovil() {
  const [movil, setMovil] = useState(() => typeof window !== 'undefined' && window.innerWidth < ANCHO_MOVIL)
  useEffect(() => {
    const alCambiar = () => setMovil(window.innerWidth < ANCHO_MOVIL)
    window.addEventListener('resize', alCambiar)
    return () => window.removeEventListener('resize', alCambiar)
  }, [])
  return movil
}

// Alto de la barra de pestañas de abajo en móvil (sin contar la zona segura
// de la barra de inicio del iPhone). Lo usan App.jsx para dejar hueco en
// <main> y los paneles fijos abajo para no quedar tapados.
export const ALTO_BARRA_INFERIOR = 56
