import CabeceraHerramientaInstagram from '../components/CabeceraHerramientaInstagram'
import CalendarioPublicacion from '../components/CalendarioPublicacion'

// Herramienta "Programar publicaciones": el calendario de publicación de un
// cliente (solo posts de Instagram y TikTok, con filtro por red). El mismo
// componente es el paso "Publicar" de la ficha, con huecos sugeridos.
export default function InstagramProgramar() {
  return (
    <CabeceraHerramientaInstagram
      titulo="Programar publicaciones"
      descripcion="Sube el post, el reel, el carrusel o la historia y Aify lo publica en Instagram o en TikTok a la hora que elijas"
      ancho={1180}
    >
      {cliente => <CalendarioPublicacion key={cliente.id} cliente={cliente} />}
    </CabeceraHerramientaInstagram>
  )
}
