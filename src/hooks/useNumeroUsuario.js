import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'

// Posición de registro del usuario (1, 2, 3...). Se usa para mostrar la
// insignia "USUARIO #N" solo a los primeros 50 — a partir de ahí no tiene
// sentido presumir de "early adopter", así que el resto de la app simplemente
// no muestra nada si este número supera 50.
export function useNumeroUsuario() {
  const { user } = useAuth()
  const [numero, setNumero] = useState(null)

  useEffect(() => {
    if (!supabase || !user) return
    let cancelado = false
    supabase.rpc('mi_numero_usuario').then(({ data, error }) => {
      if (!cancelado && !error && typeof data === 'number') setNumero(data)
    })
    return () => { cancelado = true }
  }, [user])

  return numero
}
