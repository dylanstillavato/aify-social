import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { abrirPortal, empezarPago, verMiLicencia } from '../services/aifyos'

// Alta de AifyOS: iniciar sesión, pagar 44 €/mes con Stripe y entrar en la app web.
// Igual que /autorizar-mcp, funciona con y sin sesión. Tras pagar, la
// licencia la activa el webhook, así que la página vuelve a mirar unos segundos.

// Dónde vive la app (decisión de dominio en el PR): se cambia sin tocar código.
const URL_APP = import.meta.env.VITE_AIFYOS_URL || 'https://app.useaify.app'

const caja = { maxWidth: 520, margin: '0 auto', padding: '56px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif', color: 'var(--text-primary)' }
const boton = { padding: '12px 18px', borderRadius: 12, border: 'none', background: 'var(--accent-blue)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }
const secundario = { ...boton, background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }
const nota = { fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }
const fechaLarga = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

export default function AifyosAlta() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const volvioDePagar = new URLSearchParams(location.search).get('pago') === 'ok'
  const [licencia, setLicencia] = useState(null)
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    const l = await verMiLicencia()
    setLicencia(l)
    return l
  }, [])

  useEffect(() => {
    if (!user) return undefined
    let vivo = true
    let reloj = null
    let intentos = 0
    const mirar = async () => {
      try {
        const l = await cargar()
        if (vivo && volvioDePagar && !l.activa && intentos++ < 15) reloj = setTimeout(mirar, 2000)
      } catch (err) {
        if (vivo) setError(err.message)
      }
    }
    mirar()
    return () => { vivo = false; clearTimeout(reloj) }
  }, [user, volvioDePagar, cargar])

  const accion = async (fn) => {
    setOcupado(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }
  const irA = (fn) => accion(async () => { window.location.assign((await fn()).url) })

  if (!user) {
    return (
      <main style={caja}>
        <h1>AifyOS, 44 € al mes</h1>
        <p style={nota}>La suscripción va ligada a tu cuenta de Aify. Inicia sesión o crea una cuenta para seguir.</p>
        <button style={boton} onClick={() => navigate('/login', { state: { returnTo: '/aifyos' } })}>Entrar en Aify</button>
      </main>
    )
  }

  return (
    <main style={caja}>
      <h1>AifyOS</h1>
      {error && <p style={{ ...nota, color: '#FF3B30' }}>{error}</p>}
      {!licencia && !error && <p style={nota}>Comprobando tu suscripción…</p>}

      {licencia && !licencia.activa && (
        <>
          <p style={nota}>{volvioDePagar ? 'Estamos confirmando tu pago. Tarda unos segundos.' : '44 € al mes. Funciona con tu propia clave de Anthropic y tu token de Apify, que pagas aparte a cada proveedor. Se renueva cada mes hasta que canceles.'}</p>
          {!volvioDePagar && <button style={boton} disabled={ocupado} onClick={() => irA(empezarPago)}>Suscribirme</button>}
          <p style={nota}><a href="https://os.useaify.app/terminos">Términos y privacidad</a></p>
        </>
      )}

      {licencia?.activa && (
        <>
          <p style={nota}>
            {licencia.motivo === 'cortesia' ? 'Tienes acceso a AifyOS.' : licencia.cancel_at_period_end && licencia.current_period_end ? `Tu suscripción termina el ${fechaLarga(licencia.current_period_end)}.` : 'Tu suscripción está activa.'}
            {licencia.subscription_status === 'past_due' ? ' El último cobro ha fallado: revisa tu tarjeta.' : ''}
          </p>
          <p><a href={URL_APP} style={{ ...boton, display: 'inline-block', textDecoration: 'none' }}>Entrar en AifyOS</a></p>
          {licencia.motivo !== 'cortesia' && <p><button style={secundario} disabled={ocupado} onClick={() => irA(abrirPortal)}>Gestionar o cancelar la suscripción</button></p>}
        </>
      )}
    </main>
  )
}
