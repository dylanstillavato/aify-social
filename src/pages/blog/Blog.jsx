import { useParams } from 'react-router-dom'
import {
  SKY_DEEP, INK, INK_SOFT, INK_FAINT, SURFACE, SURFACE_ALT, FONT,
  MarketingNavbar, MarketingFooter, SignupCard, MARKETING_CSS,
} from '../marketing/shared'
import { ARTICULOS, articuloPorSlug } from './articulos'

// Blog público (/blog y /blog/:slug). Páginas estáticas prerenderizadas, sin
// useAuth()/useNavigate() (ver entry-prerender.jsx), enlaces con <a href>.
// Los artículos son JSX con etiquetas normales (h2, p, ul, table,
// blockquote): el estilo de lectura sale de BLOG_CSS, no de cada artículo.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// A mano en vez de toLocaleDateString: el prerender (Node) y el navegador
// tienen que pintar exactamente lo mismo.
function fechaLarga(fecha) {
  const [a, m, d] = fecha.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${a}`
}

const BLOG_CSS = `
  .blog-cuerpo { font-size: 17.5px; line-height: 1.75; color: ${INK}; }
  .blog-cuerpo p { margin: 0 0 20px; }
  .blog-cuerpo h2 { font-size: 25px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.25; margin: 44px 0 16px; }
  .blog-cuerpo ul, .blog-cuerpo ol { margin: 0 0 20px; padding-left: 24px; }
  .blog-cuerpo li { margin-bottom: 8px; }
  .blog-cuerpo a { color: ${SKY_DEEP}; font-weight: 600; }
  .blog-cuerpo blockquote { margin: 0 0 20px; padding: 4px 0 4px 18px; border-left: 3px solid ${SKY_DEEP}; color: ${INK_SOFT}; }
  .blog-tabla { overflow-x: auto; margin: 0 0 24px; }
  .blog-cuerpo table { width: 100%; border-collapse: collapse; font-size: 15px; line-height: 1.45; }
  .blog-cuerpo th { text-align: left; font-weight: 700; padding: 10px 12px; background: ${SURFACE_ALT}; border-bottom: 1px solid rgba(11,11,15,0.1); }
  .blog-cuerpo td { padding: 10px 12px; border-bottom: 1px solid rgba(11,11,15,0.07); }
  @media (max-width: 600px) {
    .blog-cuerpo { font-size: 17px; }
    .blog-cuerpo table { font-size: 14px; }
  }
`

function Meta({ articulo }) {
  return (
    <div style={{ fontSize: 14, color: INK_FAINT }}>
      <time dateTime={articulo.fecha}>{fechaLarga(articulo.fecha)}</time> · {articulo.lectura} min de lectura
    </div>
  )
}

function CajaAutor() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '22px 24px', borderRadius: 16, background: SURFACE_ALT, border: '1px solid rgba(11,11,15,0.06)', margin: '48px 0 56px' }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #FF2D55, #FF9500)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 600, color: 'white',
      }}>
        D
      </div>
      <p style={{ fontSize: 15.5, color: INK_SOFT, lineHeight: 1.6, margin: 0 }}>
        <strong style={{ color: INK }}>Dylan Stillavato</strong>, fundador de Aify y de SOLD OUT, una agencia de contenido orgánico para restaurantes y peluquerías en Valencia. Lo que cuento aquí sale de las cuentas que llevamos cada mes.
      </p>
    </div>
  )
}

function Pagina({ children }) {
  return (
    <div style={{ fontFamily: FONT, background: SURFACE, width: '100%' }}>
      <style>{MARKETING_CSS + BLOG_CSS}</style>
      <MarketingNavbar />
      {children}
      <MarketingFooter />
    </div>
  )
}

// Índice /blog: del más nuevo al más antiguo.
export default function Blog() {
  const articulos = [...ARTICULOS].sort((a, b) => b.fecha.localeCompare(a.fecha))
  return (
    <Pagina>
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '64px 24px 96px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 42px)', fontWeight: 700, color: INK, letterSpacing: '-1.2px', lineHeight: 1.15, marginBottom: 14 }}>
          Blog de Aify
        </h1>
        <p style={{ fontSize: 17.5, color: INK_SOFT, lineHeight: 1.6, marginBottom: 40 }}>
          Lo que aprendemos gestionando el contenido de clientes reales: reels, ganchos, procesos y métricas.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {articulos.map((a) => (
            <a key={a.slug} href={`/blog/${a.slug}`} style={{ display: 'block', padding: '24px 26px', borderRadius: 18, background: SURFACE_ALT, border: '1px solid rgba(11,11,15,0.06)', textDecoration: 'none' }}>
              <h2 style={{ fontSize: 21, fontWeight: 700, color: INK, letterSpacing: '-0.4px', lineHeight: 1.3, marginBottom: 10 }}>{a.titulo}</h2>
              <p style={{ fontSize: 15.5, color: INK_SOFT, lineHeight: 1.6, margin: '0 0 12px' }}>{a.descripcion}</p>
              <Meta articulo={a} />
            </a>
          ))}
        </div>
      </main>
    </Pagina>
  )
}

// /blog/:slug. Recibe el slug por prop para poder prerenderizarse sin Router;
// en la app lo envuelve BlogArticuloRuta.
export function BlogArticulo({ slug }) {
  const articulo = articuloPorSlug(slug)

  if (!articulo) {
    return (
      <Pagina>
        <main style={{ maxWidth: 680, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: INK, marginBottom: 14 }}>No encontramos este artículo</h1>
          <a href="/blog" style={{ fontSize: 16, color: SKY_DEEP, fontWeight: 600, textDecoration: 'none' }}>Ver todos los artículos</a>
        </main>
      </Pagina>
    )
  }

  const { Componente } = articulo
  return (
    <Pagina>
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '56px 24px 96px' }}>
        <a href="/blog" style={{ fontSize: 14, fontWeight: 600, color: SKY_DEEP, textDecoration: 'none' }}>Blog de Aify</a>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 42px)', fontWeight: 700, color: INK, letterSpacing: '-1.2px', lineHeight: 1.15, margin: '14px 0 14px' }}>
          {articulo.titulo}
        </h1>
        <Meta articulo={articulo} />
        <article className="blog-cuerpo" style={{ marginTop: 36 }}>
          <Componente />
        </article>
        <CajaAutor />
        <SignupCard
          title="Organiza el contenido de tus clientes con Aify"
          ctaLabel="Empezar prueba gratis"
        />
      </main>
    </Pagina>
  )
}

export function BlogArticuloRuta() {
  const { slug } = useParams()
  return <BlogArticulo slug={slug} />
}
