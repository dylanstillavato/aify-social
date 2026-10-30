import CabeceraHerramientaInstagram from '../components/CabeceraHerramientaInstagram'
import SeguimientoCliente from '../components/SeguimientoCliente'

// Herramienta "Métricas de Instagram": las mismas métricas que el paso
// Seguimiento de cada cliente, con selector de cliente (sin los DMs, que
// tienen su propia herramienta).
export default function InstagramMetricas() {
  return (
    <CabeceraHerramientaInstagram
      titulo="Métricas de Instagram"
      descripcion="Alcance, visualizaciones e interacciones reales de los últimos 30 días y las publicaciones del mes"
    >
      {cliente => <SeguimientoCliente key={cliente.id} cliente={cliente} conDms={false} />}
    </CabeceraHerramientaInstagram>
  )
}
