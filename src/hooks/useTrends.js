import { useState, useCallback } from 'react'
import {
  obtenerTendenciasGoogle,
  obtenerBusquedasRelacionadas,
  obtenerTodosLosDias,
  obtenerVideosVirales,
  hasYouTubeKey,
} from '../services/trends'

export function useTrends(cliente) {
  const [tendencias, setTendencias] = useState(null)
  const [festivos, setFestivos] = useState([])
  const [busquedasRelacionadas, setBusquedasRelacionadas] = useState([])
  const [videosVirales, setVideosVirales] = useState([])
  const [loadingFestivos, setLoadingFestivos] = useState(false)
  const [loadingTendencias, setLoadingTendencias] = useState(false)
  const [loadingVideos, setLoadingVideos] = useState(false)

  const cargarFestivos = useCallback(async (mes, año) => {
    if (!cliente) return
    setLoadingFestivos(true)
    try {
      const dias = await obtenerTodosLosDias(año, mes)
      setFestivos(dias)
    } finally {
      setLoadingFestivos(false)
    }
  }, [cliente])

  const cargarTendencias = useCallback(async () => {
    if (!cliente) return
    setLoadingTendencias(true)
    try {
      const [t, b] = await Promise.all([
        obtenerTendenciasGoogle(cliente.sector),
        obtenerBusquedasRelacionadas(cliente.sector),
      ])
      setTendencias(t)
      setBusquedasRelacionadas(b)
    } finally {
      setLoadingTendencias(false)
    }
  }, [cliente])

  const cargarVideos = useCallback(async () => {
    if (!cliente || !hasYouTubeKey()) return
    setLoadingVideos(true)
    try {
      const videos = await obtenerVideosVirales(cliente.sector)
      setVideosVirales(videos)
    } finally {
      setLoadingVideos(false)
    }
  }, [cliente])

  const cargarTodo = useCallback(async (mes, año) => {
    await Promise.all([
      cargarFestivos(mes, año),
      cargarTendencias(),
      cargarVideos(),
    ])
  }, [cargarFestivos, cargarTendencias, cargarVideos])

  return {
    tendencias,
    festivos,
    busquedasRelacionadas,
    videosVirales,
    loadingFestivos,
    loadingTendencias,
    loadingVideos,
    cargarFestivos,
    cargarTendencias,
    cargarVideos,
    cargarTodo,
    hasYouTubeKey: hasYouTubeKey(),
  }
}
