import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
import PaletaComandos from './components/PaletaComandos'
import Tutorial from './components/Tutorial'
import BarraGeneracion from './components/BarraGeneracion'
import AvisoConectaIa from './components/AvisoConectaIa'
import { useAuth } from './context/AuthContext'
import { supabase } from './services/supabase'
import { Navigate } from 'react-router-dom'
import { isOnboardingCompleto, markOnboardingCompleto } from './utils/onboarding'
import { useOrganizacion } from './hooks/useOrganizacion'
import { useEsMovil, ALTO_BARRA_INFERIOR } from './hooks/useEsMovil'
import BarraInferiorMovil from './components/BarraInferiorMovil'
import { useTheme } from './context/ThemeContext'
import faviconIcon from './assets/favicon-icon.png'

// Route-level code splitting — each page only downloads when actually visited,
// instead of all pages bloating the initial bundle.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Clientes = lazy(() => import('./pages/Clientes'))
const NuevoCliente = lazy(() => import('./pages/NuevoCliente'))
const GuionesVirales = lazy(() => import('./pages/GuionesVirales'))
const GuionesMes = lazy(() => import('./pages/GuionesMes'))
const Contenido = lazy(() => import('./pages/Contenido'))
const LluviaDeIdeas = lazy(() => import('./pages/LluviaDeIdeas'))
const WhatsAppCanal = lazy(() => import('./pages/WhatsAppCanal'))
const Configuracion = lazy(() => import('./pages/Configuracion'))
const ToDo = lazy(() => import('./pages/ToDo'))
const CalendarioGeneral = lazy(() => import('./pages/CalendarioGeneral'))
const ClienteDetalle = lazy(() => import('./pages/ClienteDetalle'))
const Facturas = lazy(() => import('./pages/Facturas'))
const Dinero = lazy(() => import('./pages/Dinero'))
const FirmarPresupuesto = lazy(() => import('./pages/FirmarPresupuesto'))
const FormularioCliente = lazy(() => import('./pages/FormularioCliente'))
const AprobarGuiones = lazy(() => import('./pages/AprobarGuiones'))
const HojaRodajePublica = lazy(() => import('./pages/HojaRodajePublica'))
const PortalCliente = lazy(() => import('./pages/PortalCliente'))
const Login = lazy(() => import('./pages/Login'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const InvitacionOrganizacion = lazy(() => import('./pages/InvitacionOrganizacion'))
const AutorizarMcp = lazy(() => import('./pages/AutorizarMcp'))
const Landing = lazy(() => import('./pages/Landing'))
const Familia = lazy(() => import('./pages/Familia'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Agencias = lazy(() => import('./pages/Agencias'))
const Checklist = lazy(() => import('./pages/Checklist'))
const Calculadora = lazy(() => import('./pages/Calculadora'))
const PalabrasClave = lazy(() => import('./pages/PalabrasClave'))
const InvestigacionPalabrasClave = lazy(() => import('./pages/InvestigacionPalabrasClave'))
const InstagramMetricas = lazy(() => import('./pages/InstagramMetricas'))
const InstagramProgramar = lazy(() => import('./pages/InstagramProgramar'))
const InstagramDms = lazy(() => import('./pages/InstagramDms'))
const InstagramBandeja = lazy(() => import('./pages/InstagramBandeja'))
const HistoriasSecuencias = lazy(() => import('./pages/HistoriasSecuencias'))
const ReelsIA = lazy(() => import('./pages/ReelsIA'))
const Privacidad = lazy(() => import('./pages/Legal').then(m => ({ default: m.Privacidad })))
const Terminos = lazy(() => import('./pages/Legal').then(m => ({ default: m.Terminos })))
const Cookies = lazy(() => import('./pages/Legal').then(m => ({ default: m.Cookies })))
const Blog = lazy(() => import('./pages/blog/Blog'))
const BlogArticuloRuta = lazy(() => import('./pages/blog/Blog').then(m => ({ default: m.BlogArticuloRuta })))

function RouteFallback() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', width: '100%',
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        style={{
          width: 22, height: 22, borderRadius: '50%',
          border: '2.5px solid rgba(29,95,224,0.15)', borderTopColor: '#1D5FE0',
        }}
      />
    </div>
  )
}

const PUBLIC_PATHS = ['/login', '/forgot-password', '/landing', '/demo', '/agencias', '/checklist', '/calculadora', '/palabras-clave', '/recursos/reels-ia', '/privacidad', '/terminos', '/cookies']

function OnboardingGuard({ children }) {
  const { user } = useAuth()
  const completado = user?.user_metadata?.onboarding_completado || isOnboardingCompleto(user?.id)
  if (user && !completado) return <Navigate to="/onboarding" replace />
  return children
}

// Carga la organización al entrar en la app: la primera vez crea la
// organización personal (bootstrap en useOrganizacion), de la que dependen
// clientes, equipo y claves.
function OrganizacionGuard({ children }) {
  const { loading, organizacion } = useOrganizacion()
  if (loading && !organizacion) return <RouteFallback />
  return children
}

const ALTO_BARRA_MOVIL = 52

// Barra superior fija que solo existe en móvil: logo y nombre. El cajón de la
// barra lateral se abre desde la pestaña «Más» de la barra inferior.
function BarraSuperiorMovil() {
  const { theme } = useTheme()
  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 150,
      height: ALTO_BARRA_MOVIL, paddingTop: 'env(safe-area-inset-top)', boxSizing: 'content-box',
      display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 16,
      background: 'var(--sidebar-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-color)',
    }}>
      <img src={faviconIcon} alt="Aify" style={{ width: 26, height: 26, borderRadius: 7, filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-primary)', lineHeight: 1 }}>Aify</span>
    </header>
  )
}

function AppContent() {
  const location = useLocation()
  const { user, loading } = useAuth()
  const esMovil = useEsMovil()
  // Ruta en la que se abrió el cajón del móvil: al navegar deja de coincidir
  // y el cajón se cierra solo.
  const [menuAbiertoEn, setMenuAbiertoEn] = useState(null)
  const menuAbierto = menuAbiertoEn === location.pathname

  useEffect(() => {
    if (!user) return
    if (user?.user_metadata?.onboarding_completado) {
      markOnboardingCompleto(user.id)
    }
    if (isOnboardingCompleto(user.id) && !user?.user_metadata?.onboarding_completado) {
      if (supabase) supabase.auth.updateUser({ data: { onboarding_completado: true } }).catch(() => {})
    }
  }, [user])

  // Root: redirect to dashboard if authenticated, else show Landing
  if (location.pathname === '/') {
    if (loading) return null
    return user ? <Navigate to="/dashboard" replace /> : (
      <Suspense fallback={<RouteFallback />}><Landing /></Suspense>
    )
  }

  // El blog es público entero: /blog y cualquier /blog/<slug>.
  const esBlog = location.pathname === '/blog' || location.pathname.startsWith('/blog/')

  if (PUBLIC_PATHS.includes(location.pathname) || esBlog) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/demo" element={<Familia />} />
          <Route path="/agencias" element={<Agencias />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/calculadora" element={<Calculadora />} />
          <Route path="/palabras-clave" element={<PalabrasClave />} />
          <Route path="/recursos/reels-ia" element={<ReelsIA />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogArticuloRuta />} />
        </Routes>
      </Suspense>
    )
  }

  // Reset-password: Supabase's recovery link signs the user in automatically,
  // so this needs ProtectedRoute (to wait for that session) but must bypass
  // OnboardingGuard/Sidebar — a user resetting their password shouldn't be
  // shoved into onboarding first.
  if (location.pathname === '/reset-password') {
    return (
      <ProtectedRoute fallback={<Suspense fallback={<RouteFallback />}><ResetPassword /></Suspense>}>
        <Suspense fallback={<RouteFallback />}>
          <ResetPassword />
        </Suspense>
      </ProtectedRoute>
    )
  }

  // Invitación a organización: enlace compartible que debe funcionar tanto con
  // como sin sesión (sin sesión, la propia página pide iniciar sesión). Igual
  // que /reset-password, usamos el mismo componente como fallback de
  // ProtectedRoute para que nunca redirija automáticamente a /login — es la
  // página la que decide qué mostrar según haya o no usuario.
  if (location.pathname.startsWith('/invitacion/')) {
    return (
      <ProtectedRoute fallback={<Suspense fallback={<RouteFallback />}><InvitacionOrganizacion /></Suspense>}>
        <Suspense fallback={<RouteFallback />}>
          <InvitacionOrganizacion />
        </Suspense>
      </ProtectedRoute>
    )
  }

  // Pantalla «Permitir» del OAuth del MCP (claude.ai, ChatGPT): con y sin
  // sesión, como /invitacion/ (sin sesión, la propia página pide iniciar
  // sesión y vuelve aquí). Fuera de OnboardingGuard y del Sidebar.
  if (location.pathname === '/autorizar-mcp') {
    return (
      <ProtectedRoute fallback={<Suspense fallback={<RouteFallback />}><AutorizarMcp /></Suspense>}>
        <Suspense fallback={<RouteFallback />}>
          <AutorizarMcp />
        </Suspense>
      </ProtectedRoute>
    )
  }

  // Firma pública de presupuestos: enlace compartible sin sesión de Aify — el
  // token en la propia URL es la autenticación (ver RPCs security definer en
  // 0002_facturas_presupuestos.sql). Nunca debe pasar por ProtectedRoute.
  if (location.pathname.startsWith('/firmar/')) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <FirmarPresupuesto />
      </Suspense>
    )
  }

  // Formulario de onboarding para el cliente del gestor: mismo modelo que
  // /firmar/ (token en la URL, sin sesión; ver 0018_onboarding_externo.sql).
  // No confundir con /onboarding, que es el onboarding del propio usuario.
  if (location.pathname.startsWith('/formulario/')) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <FormularioCliente />
      </Suspense>
    )
  }

  // Aprobación de los guiones del mes por el cliente del gestor: mismo modelo
  // que /formulario/ (token en la URL, sin sesión; ver 0019_aprobacion_guiones.sql).
  if (location.pathname.startsWith('/aprobar/')) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <AprobarGuiones />
      </Suspense>
    )
  }

  // Hoja de rodaje compartida, vídeo a vídeo: mismo modelo que /aprobar/
  // (token en la URL, sin sesión, solo lectura; ver 0035_hoja_rodaje_enlace.sql).
  if (location.pathname.startsWith('/rodaje/')) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <HojaRodajePublica />
      </Suspense>
    )
  }

  // Portal del cliente del gestor: un enlace estable que reúne formularios,
  // presupuestos, guiones y facturas (token en la URL, sin sesión; ver
  // 0021_portal_cliente.sql).
  if (location.pathname.startsWith('/portal/')) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <PortalCliente />
      </Suspense>
    )
  }

  if (location.pathname === '/onboarding') {
    const yaCompleto = (user?.user_metadata?.onboarding_completado) || isOnboardingCompleto(user?.id)
    return (
      <ProtectedRoute>
        {yaCompleto ? <Navigate to="/dashboard" replace /> : (
          <Suspense fallback={<RouteFallback />}>
            <Onboarding />
          </Suspense>
        )}
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <OnboardingGuard>
        <OrganizacionGuard>
        <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: 'var(--gradient-bg)' }}>
          <Tutorial />
          {esMovil && <BarraSuperiorMovil />}
          {esMovil && <BarraInferiorMovil onAbrirMenu={() => setMenuAbiertoEn(location.pathname)} />}
          <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbiertoEn(null)} />
          <PaletaComandos />
          <BarraGeneracion />
          <AvisoConectaIa />
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden', ...(esMovil ? { paddingTop: `calc(${ALTO_BARRA_MOVIL}px + env(safe-area-inset-top))`, paddingBottom: `calc(${ALTO_BARRA_INFERIOR}px + env(safe-area-inset-bottom))` } : {}) }}>
            <Suspense fallback={<RouteFallback />}>
              {/* Sin AnimatePresence mode="wait": esperar la animación de salida
                  retrasaba cada navegación. Cada página hace un fade-in corto (120 ms). */}
              <Routes location={location} key={location.pathname}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/clientes/:id" element={<ClienteDetalle />} />
                <Route path="/nuevo-cliente" element={<NuevoCliente />} />
                <Route path="/copies" element={<Navigate to="/dashboard" replace />} />
                <Route path="/guiones" element={<GuionesVirales />} />
                <Route path="/guiones-del-mes" element={<GuionesMes />} />
                <Route path="/contenido" element={<Contenido />} />
                <Route path="/lluvia-de-ideas" element={<LluviaDeIdeas />} />
                <Route path="/investigacion-palabras-clave" element={<InvestigacionPalabrasClave />} />
                <Route path="/instagram/metricas" element={<InstagramMetricas />} />
                <Route path="/instagram/programar" element={<InstagramProgramar />} />
                <Route path="/instagram/bandeja" element={<InstagramBandeja />} />
                <Route path="/instagram/dms" element={<InstagramDms />} />
                <Route path="/instagram/historias" element={<HistoriasSecuencias />} />
                <Route path="/facturas" element={<Facturas />} />
                <Route path="/dinero" element={<Dinero />} />
                <Route path="/whatsapp" element={<WhatsAppCanal />} />
                <Route path="/todo" element={<ToDo />} />
                <Route path="/calendario" element={<CalendarioGeneral />} />
                <Route path="/configuracion" element={<Configuracion />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
        </OrganizacionGuard>
      </OnboardingGuard>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
