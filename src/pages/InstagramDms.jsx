import CabeceraHerramientaInstagram from '../components/CabeceraHerramientaInstagram'
import DmAutomaticos from '../components/DmAutomaticos'

// Herramienta "DMs automáticos": reglas de palabra clave → DM de cada cliente.
export default function InstagramDms() {
  return (
    <CabeceraHerramientaInstagram
      titulo="DMs automáticos"
      descripcion="Cuando alguien comenta la palabra clave en un reel, le llega tu mensaje por DM"
    >
      {cliente => <DmAutomaticos key={cliente.id} clienteId={cliente.id} />}
    </CabeceraHerramientaInstagram>
  )
}
