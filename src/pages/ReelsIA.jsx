import { useEffect } from 'react'
import { FileDown, Sparkles, Code2, Mic, Clapperboard } from 'lucide-react'
import {
  SKY_DEEP, SKY_MID, SKY_LIGHT, LIME, INK, INK_SOFT, SURFACE, SURFACE_ALT, FONT,
  MarketingNavbar, MarketingFooter, SignupCard, MARKETING_CSS,
} from './marketing/shared'

// Lead magnet sin gate de email: se pidió expresamente un enlace que
// descargue el PDF automáticamente, no un formulario. El PDF real vive en
// public/recursos/ (build-pdf.py en el vault genera este archivo — si el
// contenido del PDF cambia, hay que volver a copiarlo aquí y redesplegar).
// Página estática prerenderizada: sin useAuth()/useNavigate() (ver
// entry-prerender.jsx), enlaces con <a> normal. El useEffect de descarga
// no corre en el prerender (Node no ejecuta efectos de React al hacer
// renderToStaticMarkup), así que es seguro tenerlo aquí.
const PDF_URL = '/recursos/como-hacemos-los-reels-de-aify.pdf'

function descargarPDF() {
  const a = document.createElement('a')
  a.href = PDF_URL
  a.download = 'como-hacemos-los-reels-de-aify.pdf'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const PASOS = [
  { icon: Clapperboard, title: 'El guion, en una tabla', desc: 'Qué se dice en cada escena — nada más.' },
  { icon: Mic, title: 'La voz, generada con IA', desc: 'Una locución por frase, con el ritmo pedido en el propio prompt.' },
  { icon: Code2, title: 'Sincronizar con Python', desc: 'Se recorta el silencio y se reparte cada frase palabra por palabra.' },
  { icon: Sparkles, title: 'La animación, como función del tiempo', desc: 'Una web donde todo se calcula a partir del segundo exacto del vídeo.' },
]

function Hero() {
  useEffect(() => {
    // La descarga se dispara sola al entrar — el enlace que se comparte
    // apunta a esta página, no directo al .pdf, para poder explicar de
    // qué va y enlazar a la app además de descargar.
    const t = setTimeout(descargarPDF, 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <section style={{ position: 'relative', padding: '64px 24px 60px', overflow: 'hidden', background: `linear-gradient(180deg, ${SKY_DEEP} 0%, ${SKY_MID} 55%, ${SKY_LIGHT} 100%)` }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[{ s: 380, t: -80, r: -80, o: 0.4 }, { s: 320, b: -100, l: -60, o: 0.4 }].map((c, i) => (
          <div key={i} style={{ position: 'absolute', width: c.s, height: c.s, borderRadius: '50%', background: 'white', opacity: c.o, filter: 'blur(70px)', top: c.t, left: c.l, right: c.r, bottom: c.b }} />
        ))}
      </div>
      <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '6px 14px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)', marginBottom: 22 }}>
          <FileDown size={13} color={LIME} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Recurso gratuito · PDF</span>
        </div>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 700, color: 'white', letterSpacing: '-1.4px', lineHeight: 1.15, marginBottom: 18 }}>
          Cómo hacemos los reels de Aify sin cámara y sin editor
        </h1>
        <p style={{ fontSize: 16.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxWidth: 560, margin: '0 auto 30px' }}>
          El proceso real de código e IA con el que montamos nuestros vídeos promocionales: guion, voz, sincronización palabra por palabra y una web que se graba sola. Con el prompt para que lo repliques.
        </p>
        <button
          onClick={descargarPDF}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, background: LIME, color: INK,
            fontWeight: 700, fontSize: 16, padding: '15px 30px', borderRadius: 999, border: 'none',
            cursor: 'pointer', fontFamily: FONT, boxShadow: '0 14px 30px rgba(0,0,0,0.18)',
          }}
        >
          <FileDown size={19} />
          Descargar el PDF gratis
        </button>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>
          Se descarga solo al entrar — sin dejar el email. Si no empieza sola, pulsa el botón.
        </p>
      </div>
    </section>
  )
}

function QueIncluye() {
  return (
    <section style={{ padding: '70px 24px 20px', background: SURFACE }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: INK, letterSpacing: '-0.4px', marginBottom: 24, textAlign: 'center' }}>
          Qué encontrarás en las 10 páginas
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PASOS.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 16, padding: '20px 22px', borderRadius: 16,
              background: SURFACE_ALT, border: '1px solid rgba(11,11,15,0.06)',
            }}>
              <div style={{ width: 26, height: 26, flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p.icon size={18} color={SKY_DEEP} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 4 }}>{i + 1}. {p.title}</div>
                <p style={{ fontSize: 14.5, color: INK_SOFT, lineHeight: 1.5, margin: 0 }}>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 14.5, color: INK_SOFT, marginTop: 24 }}>
          Y al final, un prompt listo para pegar en tu asistente de código para que te construya tu propia versión.
        </p>
      </div>
    </section>
  )
}

export default function ReelsIA() {
  return (
    <div style={{ fontFamily: FONT, background: SURFACE, width: '100%' }}>
      <style>{MARKETING_CSS}</style>
      <MarketingNavbar />
      <Hero />
      <QueIncluye />
      <section style={{ padding: '70px 24px 96px', background: SURFACE }}>
        <SignupCard
          eyebrow="Si lo tuyo es el contenido, no el código"
          title="Aify aplica esta misma lógica a tus clientes"
          subtitle="Ideas, guiones, copies y calendario con IA, con el contexto real de cada cliente guardado — sin que tengas que montar tú el pipeline. Prueba 30 días gratis."
        />
      </section>
      <MarketingFooter />
    </div>
  )
}
