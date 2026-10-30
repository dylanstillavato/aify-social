import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { GeneracionesProvider } from './context/GeneracionesContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

const app = (
  <StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <GeneracionesProvider>
          <App />
        </GeneracionesProvider>
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>
)

const rootEl = document.getElementById('root')
// Siempre createRoot, nunca hydrateRoot. Las rutas de marketing traen HTML
// prerenderizado en #root (solo para SEO / primer pintado), pero ese HTML no
// es hidratable: se genera con renderToStaticMarkup a partir de la página
// suelta (src/entry-prerender.jsx), mientras que el cliente monta <App/> con
// otros providers, rutas lazy() dentro de <Suspense> y, en "/", devuelve null
// mientras AuthContext carga. Además, el fallback SPA servía ese mismo HTML
// de la landing en cualquier ruta (/dashboard...). hydrateRoot daba siempre
// el error #418 (hydration mismatch) y React acababa re-renderizando todo en
// cliente igualmente. createRoot conserva el HTML prerenderizado visible
// hasta el primer commit y entonces lo sustituye, sin error.
createRoot(rootEl).render(app)
