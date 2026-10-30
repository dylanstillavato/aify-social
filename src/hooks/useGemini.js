import { useState } from 'react'
import { analizarVideoCliente } from '../services/gemini'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function useGemini() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [progreso, setProgreso] = useState('')

  const analizarVideos = async (urls, cliente) => {
    setLoading(true)
    setError(null)

    try {
      setProgreso('Conectando con Gemini AI...')
      await delay(800)

      setProgreso(`Analizando ${urls.length} vídeo${urls.length > 1 ? 's' : ''}...`)
      await delay(1000)

      setProgreso('Identificando tono de voz...')
      const resultado = await analizarVideoCliente(urls, cliente)

      setProgreso('Extrayendo expresiones propias...')
      await delay(600)

      setProgreso('Generando perfil de comunicación...')
      await delay(800)

      return resultado
    } catch (err) {
      setError('Error al analizar los vídeos. Comprueba que las URLs son válidas y públicas.')
      throw err
    } finally {
      setLoading(false)
      setProgreso('')
    }
  }

  return { analizarVideos, loading, error, progreso }
}
