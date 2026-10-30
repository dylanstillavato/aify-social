import React from 'react'
import { AuthProvider } from './context/AuthContext.jsx'
import Landing from './pages/Landing.jsx'
import Familia from './pages/Familia.jsx'
import Agencias from './pages/Agencias.jsx'
import Checklist from './pages/Checklist.jsx'
import Calculadora from './pages/Calculadora.jsx'
import ReelsIA from './pages/ReelsIA.jsx'
import PalabrasClave from './pages/PalabrasClave.jsx'
import { Privacidad, Terminos, Cookies } from './pages/Legal.jsx'
import Blog, { BlogArticulo } from './pages/blog/Blog.jsx'
import { ARTICULOS } from './pages/blog/articulos.js'

// Dominio canónico: el que lleva www (el que no lo lleva redirige con un 308).
const SITE = 'https://www.useaify.app'

// Rutas públicas de marketing prerenderizadas en build time.
const PAGES = {
  '/': () => Landing,
  '/demo': () => Familia,
  '/agencias': () => Agencias,
  '/checklist': () => Checklist,
  '/calculadora': () => Calculadora,
  '/recursos/reels-ia': () => ReelsIA,
  '/palabras-clave': () => PalabrasClave,
  '/privacidad': () => Privacidad,
  '/terminos': () => Terminos,
  '/cookies': () => Cookies,
  '/blog': () => Blog,
  ...Object.fromEntries(ARTICULOS.map((a) => [`/blog/${a.slug}`, () => function Articulo() { return <BlogArticulo slug={a.slug} /> }])),
}

const TITLES = {
  '/': '@Social — Contenido con IA para agencias de marketing',
  '/demo': 'Aify — Herramientas para quien crea contenido',
  '/agencias': 'Cómo una agencia atiende 10 clientes sin contratar más gente | Aify',
  '/checklist': '5 errores que colapsan el calendario de contenido de una agencia | Aify',
  '/calculadora': 'Calculadora: cuánto tiempo ahorra tu agencia usando IA | Aify',
  '/recursos/reels-ia': 'Cómo hacemos los reels de Aify sin cámara ni editor (PDF gratis) | Aify',
  '/palabras-clave': 'Buscador de palabras clave gratis: qué busca tu cliente en Google | Aify',
  '/privacidad': 'Política de privacidad | Aify',
  '/terminos': 'Términos de uso | Aify',
  '/cookies': 'Política de cookies | Aify',
  '/blog': 'Blog de Aify: reels, ganchos y procesos de contenido para agencias | Aify',
  ...Object.fromEntries(ARTICULOS.map((a) => [`/blog/${a.slug}`, `${a.titulo} | Aify`])),
}

const DESCRIPTIONS = {
  '/': 'Aify centraliza el contenido de tus clientes con IA: calendario, copies, guiones e ideas en un solo sitio. Prueba 30 días gratis, sin invitación.',
  '/demo': 'Aify es una familia de apps para gestores de redes y creadores: @Social (el CRM) y @Pictures (editor de imágenes de código abierto), sobre un mismo motor.',
  '/agencias': 'Cómo una agencia de contenido atiende 3x más clientes sin contratar: calendario multi-cliente + generación con IA. Prueba 30 días gratis.',
  '/checklist': 'Los 5 errores que hacen colapsar el calendario de contenido de una agencia con varios clientes — y cómo evitarlos.',
  '/privacidad': 'Qué datos trata Aify, con qué proveedores y cómo ejercer tus derechos.',
  '/terminos': 'Condiciones de uso de Aify: prueba gratuita, renovación automática, cancelación y uso del contenido generado con IA.',
  '/cookies': 'Aify no usa cookies de analítica ni publicidad: solo almacenamiento técnico necesario para la app.',
  '/calculadora': 'Calcula gratis cuántas horas y cuánto dinero ahorra tu agencia usando IA para generar contenido, con tus propios números.',
  '/recursos/reels-ia': 'Descarga gratis el proceso real de código e IA con el que Aify genera sus propios vídeos promocionales, con un prompt para replicarlo.',
  '/palabras-clave': 'Escribe tu sitio o negocio y descubre gratis las palabras clave reales que busca tu cliente ideal en Google, con ideas de contenido listas.',
  '/blog': 'Lo que aprendemos gestionando el contenido de clientes reales: reels, ganchos, procesos y métricas.',
  ...Object.fromEntries(ARTICULOS.map((a) => [`/blog/${a.slug}`, a.descripcion])),
}

// Rutas cuyo canonical no es su propia URL. /demo ya no es una copia de la
// portada (es la landing de la familia), así que lleva el suyo.
const CANONICAL = {}

// JSON-LD de la portada: la empresa y el producto. Sin offers ni precio.
const JSON_LD_PORTADA = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', name: 'Aify', url: SITE, email: 'hola@useaify.app' },
    {
      '@type': 'SoftwareApplication',
      name: 'Aify',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: 'es',
      url: SITE,
    },
  ],
}

// Elementos del <head> de una ruta pública: description, canonical, Open
// Graph, Twitter y JSON-LD. Separado para que lo reutilicen otras páginas
// (p. ej. el blog).
function headPara(url) {
  const title = TITLES[url] || TITLES['/']
  const description = DESCRIPTIONS[url] || DESCRIPTIONS['/']
  const canonical = SITE + (CANONICAL[url] || url)
  const jsonLd = url === '/'
    ? JSON_LD_PORTADA
    : { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: canonical, inLanguage: 'es' }

  return [
    { type: 'meta', props: { name: 'description', content: description } },
    { type: 'link', props: { rel: 'canonical', href: canonical } },
    { type: 'meta', props: { property: 'og:title', content: title } },
    { type: 'meta', props: { property: 'og:description', content: description } },
    { type: 'meta', props: { property: 'og:url', content: canonical } },
    { type: 'meta', props: { property: 'og:type', content: 'website' } },
    { type: 'meta', props: { property: 'og:site_name', content: 'Aify' } },
    { type: 'meta', props: { property: 'og:locale', content: 'es_ES' } },
    { type: 'meta', props: { name: 'twitter:card', content: 'summary' } },
    // El plugin no escapa children: se escapa "<" para que el JSON nunca
    // pueda cerrar el <script>.
    { type: 'script', props: { type: 'application/ld+json' }, children: JSON.stringify(jsonLd).replace(/</g, '\\u003c') },
  ]
}

// Landing llama useAuth() y useNavigate()
// durante el render, no en un efecto — necesitan un AuthProvider real y un
// Router envolviendo o el prerender revienta:
//   - useAuth() lanza si no hay <AuthProvider> (ver AuthContext.jsx línea 214).
//   - useNavigate() exige un Router de contexto (usamos StaticRouter, el
//     correcto para SSR — no BrowserRouter, que depende de window.history).
// Envolver con AuthProvider aquí es seguro: su cuerpo solo usa useState con
// valores por defecto síncronos (user=null, loading=true, error=null) y su
// useEffect (el único sitio donde toca supabase.auth.getSession()) nunca
// corre durante renderToStaticMarkup. Landing solo desestructura `user` de
// useAuth(), así que renderiza como para un visitante anónimo — el estado
// correcto para una página de marketing prerenderizada.
//
// Agencias/Checklist/Calculadora NO usan useAuth() ni useNavigate() (a
// propósito — ver src/pages/marketing/shared.jsx, que usa <a href> en vez de
// navigate()), así que no necesitan ese envoltorio — se prerenderizan tal
// cual, sin AuthProvider ni StaticRouter, más simple y con menos riesgo.
export async function prerender(data) {
  const { renderToStaticMarkup } = await import('react-dom/server')

  const loadPage = PAGES[data.url]
  if (!loadPage) return { html: '' }
  const Page = loadPage()

  // /demo (Familia) usa <a href> y no necesita el envoltorio.
  const needsAuthAndRouter = data.url === '/'

  const html = needsAuthAndRouter
    ? await (async () => {
        // react-router-dom v7 no expone un subpath "/server" — StaticRouter
        // vive en el paquete base "react-router" (dependencia transitiva de
        // react-router-dom, ya presente en node_modules), no BrowserRouter,
        // que depende de window.history y rompería en el entorno de build
        // sin DOM.
        const { StaticRouter } = await import('react-router')
        return renderToStaticMarkup(
          <StaticRouter location={data.url}>
            <AuthProvider>
              <Page />
            </AuthProvider>
          </StaticRouter>
        )
      })()
    : renderToStaticMarkup(<Page />)

  if (data.url === '/blog' || data.url.startsWith('/blog/')) {
    return {
      html,
      head: { lang: 'es', title: TITLES[data.url], elements: new Set(headBlog(data.url)) },
    }
  }

  return {
    html,
    head: {
      lang: 'es',
      title: TITLES[data.url] || TITLES['/'],
      elements: new Set(headPara(data.url)),
    },
  }
}

// Head del blog: canonical, Open Graph, Twitter y JSON-LD (Article en cada
// artículo, con autor). Va aparte del head del resto de rutas públicas.
function headBlog(url) {
  const site = 'https://www.useaify.app'
  const canonical = site + url
  const title = TITLES[url]
  const description = DESCRIPTIONS[url]
  const articulo = ARTICULOS.find((a) => `/blog/${a.slug}` === url)
  const jsonLd = articulo
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: articulo.titulo,
        description: articulo.descripcion,
        datePublished: articulo.fecha,
        inLanguage: 'es',
        url: canonical,
        author: { '@type': 'Person', name: 'Dylan Stillavato' },
      }
    : { '@context': 'https://schema.org', '@type': 'Blog', name: 'Blog de Aify', description, url: canonical, inLanguage: 'es' }

  return [
    { type: 'meta', props: { name: 'description', content: description } },
    { type: 'link', props: { rel: 'canonical', href: canonical } },
    { type: 'meta', props: { property: 'og:title', content: title } },
    { type: 'meta', props: { property: 'og:description', content: description } },
    { type: 'meta', props: { property: 'og:url', content: canonical } },
    { type: 'meta', props: { property: 'og:type', content: articulo ? 'article' : 'website' } },
    { type: 'meta', props: { property: 'og:site_name', content: 'Aify' } },
    { type: 'meta', props: { property: 'og:locale', content: 'es_ES' } },
    { type: 'meta', props: { name: 'twitter:card', content: 'summary' } },
    // El plugin no escapa children: se escapa "<" para que el JSON nunca
    // pueda cerrar el <script>.
    { type: 'script', props: { type: 'application/ld+json' }, children: JSON.stringify(jsonLd).replace(/</g, '\\u003c') },
  ]
}
