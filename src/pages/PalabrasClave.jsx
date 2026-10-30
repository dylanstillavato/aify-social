import { Search } from 'lucide-react'
import {
  SKY_DEEP, SKY_MID, SKY_LIGHT, SURFACE, LIME, FONT,
  MarketingNavbar, MarketingFooter, SignupCard, MARKETING_CSS,
} from './marketing/shared'
import PalabrasClaveExplorer from '../components/PalabrasClaveExplorer'

// Pilar SEO / herramienta pública (mismo patrón que Calculadora.jsx): sin
// login, sin gate para usarla, pensada para compartirse/enlazarse fuera de
// Aify. La lista de palabras clave se corta a MAX_GRATIS y el resto queda
// bloqueado detrás de "Regístrate gratis" — el lead magnet es la propia
// herramienta, la conversión es ver todas las keywords + poder generar
// contenido con ellas (eso ya vive en /investigacion-palabras-clave, Pro).
const MAX_GRATIS = 8

export default function PalabrasClave() {
  return (
    <div style={{ fontFamily: FONT, background: SURFACE, width: '100%' }}>
      <style>{MARKETING_CSS}</style>
      <MarketingNavbar />

      <section style={{ position: 'relative', padding: '56px 24px 50px', overflow: 'hidden', background: `linear-gradient(180deg, ${SKY_DEEP} 0%, ${SKY_MID} 55%, ${SKY_LIGHT} 100%)` }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {[{ s: 380, t: -80, l: -100, o: 0.4 }, { s: 320, b: -100, r: -60, o: 0.35 }].map((c, i) => (
            <div key={i} style={{ position: 'absolute', width: c.s, height: c.s, borderRadius: '50%', background: 'white', opacity: c.o, filter: 'blur(70px)', top: c.t, left: c.l, right: c.r, bottom: c.b }} />
          ))}
        </div>
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '6px 14px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)', marginBottom: 22 }}>
            <Search size={13} color={LIME} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Buscador de palabras clave gratuito</span>
          </div>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 700, color: 'white', letterSpacing: '-1.4px', lineHeight: 1.15, marginBottom: 16 }}>
            Todo lo que busca tu cliente ideal en Google
          </h1>
          <p style={{ fontSize: 16.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxWidth: 560, margin: '0 auto' }}>
            Escribe tu sitio, tu @instagram o describe tu negocio. La IA encuentra las palabras clave reales que la gente busca — y te da ideas de contenido listas para grabar.
          </p>
        </div>
      </section>

      <section style={{ padding: '56px 24px 90px', background: SURFACE }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <PalabrasClaveExplorer publico maxGratis={MAX_GRATIS} />
        </div>
      </section>

      <section style={{ padding: '20px 24px 96px', background: '#F3F5EF' }}>
        <SignupCard
          eyebrow="Empieza hoy"
          title="Convierte estas palabras clave en contenido real"
          subtitle="Crea tu cuenta gratis, ve la lista completa y genera ideas de contenido con un clic — sin invitación, sin esperas."
          ctaLabel="Crear cuenta gratis"
          dark={false}
        />
      </section>

      <MarketingFooter />
    </div>
  )
}
