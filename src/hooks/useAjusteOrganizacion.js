import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'

// Un ajuste jsonb de la organización (organizaciones.<columna>) que el owner
// cambia y el equipo ve: el objetivo del mes del Inicio (0028) o el proceso
// del mes (0029). Si la columna aún no existe (migración sin aplicar) o quien
// guarda no es el owner, el valor se queda en este navegador para que la
// pantalla funcione igual.
//
// `normalizar(valor)` devuelve el valor limpio o null si no es válido.

const claveLocal = (columna, userId) => `aify_ajuste_${columna}:${userId}`

function leerLocal(columna, userId, normalizar) {
  try { return normalizar(JSON.parse(localStorage.getItem(claveLocal(columna, userId)))) } catch { return null }
}

function guardarLocal(columna, userId, valor) {
  try {
    if (valor == null) localStorage.removeItem(claveLocal(columna, userId))
    else localStorage.setItem(claveLocal(columna, userId), JSON.stringify(valor))
  } catch { /* sin almacenamiento: solo esta sesión */ }
}

export function useAjusteOrganizacion(columna, normalizar) {
  const { user } = useAuth()
  const userId = user?.id
  const [estado, setEstado] = useState({ valor: null, orgId: null, enOrganizacion: false, loading: true })

  useEffect(() => {
    if (!userId) return
    let vivo = true
    ;(async () => {
      const local = leerLocal(columna, userId, normalizar)
      if (!supabase) { if (vivo) setEstado({ valor: local, orgId: null, enOrganizacion: false, loading: false }); return }
      const { data: orgId } = await supabase.rpc('mi_organizacion_id')
      const { data, error } = orgId
        ? await supabase.from('organizaciones').select(columna).eq('id', orgId).maybeSingle()
        : { data: null, error: true }
      if (!vivo) return
      // Error = columna sin migrar: el valor vive en el navegador
      if (error) setEstado({ valor: local, orgId, enOrganizacion: false, loading: false })
      else setEstado({ valor: normalizar(data?.[columna]) ?? local, orgId, enOrganizacion: true, loading: false })
    })()
    return () => { vivo = false }
  }, [userId, columna]) // eslint-disable-line react-hooks/exhaustive-deps -- normalizar es una función pura de módulo

  // Devuelve { soloLocal }: true si no se pudo guardar en la organización
  const guardar = useCallback(async (valor) => {
    const limpio = valor == null ? null : normalizar(valor)
    setEstado(s => ({ ...s, valor: limpio }))
    if (estado.enOrganizacion && estado.orgId) {
      const { data, error } = await supabase.from('organizaciones')
        .update({ [columna]: limpio }).eq('id', estado.orgId).select('id')
      // RLS no da error si no deja actualizar (no es owner): devuelve 0 filas
      if (!error && data?.length) { guardarLocal(columna, userId, null); return { soloLocal: false } }
    }
    guardarLocal(columna, userId, limpio)
    return { soloLocal: true }
  }, [estado.enOrganizacion, estado.orgId, userId, columna, normalizar])

  return { ...estado, guardar }
}
