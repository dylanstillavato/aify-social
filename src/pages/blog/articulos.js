import PorQueSaltanTusReels from './articulos/PorQueSaltanTusReels'
import ProcesoMensualContenido from './articulos/ProcesoMensualContenido'

// Registro de artículos del blog. De aquí salen el índice /blog, las rutas
// /blog/<slug> de App.jsx, el prerender (src/entry-prerender.jsx) y la lista
// de rutas a prerenderizar de vite.config.js (que lee los slugs como texto:
// mantener el formato `slug: '...'`).
export const ARTICULOS = [
  {
    slug: 'por-que-saltan-tus-reels',
    titulo: 'Por qué la gente salta tus reels (y qué cambiar en el primer segundo)',
    descripcion: 'Medimos 9 reels de dos restaurantes: en 5 se fue más del 65 % de la gente nada más empezar. Qué tenían en común los que retuvieron y cómo arreglar el inicio.',
    fecha: '2026-10-18',
    lectura: 6,
    Componente: PorQueSaltanTusReels,
  },
  {
    slug: 'proceso-mensual-contenido-clientes',
    titulo: 'Cómo organizar el contenido de varios clientes: el proceso mensual en 6 pasos',
    descripcion: 'El proceso que seguimos cada mes con cada cliente, de la investigación a las métricas, con los números reales de un restaurante en octubre.',
    fecha: '2026-10-19',
    lectura: 7,
    Componente: ProcesoMensualContenido,
  },
]

export function articuloPorSlug(slug) {
  return ARTICULOS.find((a) => a.slug === slug) || null
}
