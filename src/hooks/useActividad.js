import { useState, useEffect } from 'react'

const KEY = 'aify_actividad'
const MAX = 20

export function getActividad() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

export function addActividad({ tipo, descripcion, clienteNombre, count = 1 }) {
  const lista = getActividad()
  const nueva = [
    { tipo, descripcion, clienteNombre, count, timestamp: Date.now() },
    ...lista,
  ].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(nueva))
  window.dispatchEvent(new CustomEvent('aify:actividad'))
}

export function useActividad() {
  const [actividad, setActividad] = useState(getActividad)

  useEffect(() => {
    const handler = () => setActividad(getActividad())
    window.addEventListener('aify:actividad', handler)
    return () => window.removeEventListener('aify:actividad', handler)
  }, [])

  return actividad
}
