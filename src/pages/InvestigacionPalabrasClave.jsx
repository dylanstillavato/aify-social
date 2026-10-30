import PalabrasClaveExplorer from '../components/PalabrasClaveExplorer'

// Versión del dashboard de /palabras-clave: mismo explorador, sin límite de
// resultados, y "Generar contenido" llama a la IA de verdad (ver POST
// /api/palabras-clave/contenido).
export default function InvestigacionPalabrasClave() {
  return (
    <div style={{ flex: 1, padding: '32px 40px', maxWidth: 880 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Palabras Clave</h1>
        <p style={{ fontSize: 14.5, color: 'var(--text-secondary)' }}>
          Escribe el sitio, @instagram o negocio de tu cliente — te damos las palabras clave reales que busca su audiencia y una idea de contenido por cada una.
        </p>
      </div>
      <PalabrasClaveExplorer publico={false} />
    </div>
  )
}
