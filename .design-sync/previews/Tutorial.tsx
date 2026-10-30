import { Tutorial } from 'aify'
import { MotionConfig } from 'framer-motion'

// Tutorial only activates when onboarding is done but the tutorial and
// dashboard-visited flags aren't set, and even then waits 800ms before
// showing itself. Prime localStorage and collapse that delay so the first
// step ("bienvenida") renders immediately for this static preview — the
// component always resets to step 0 on a fresh mount, so no later step is
// reachable without simulating clicks.
try {
  localStorage.removeItem('aify_tutorial_completado')
  localStorage.removeItem('aify_dashboard_visitado')
  localStorage.setItem('aify_onboarding_completado', 'true')
} catch { /* ignore */ }
const realSetTimeout = window.setTimeout
// @ts-ignore
window.setTimeout = ((fn: any, _ms?: number, ...rest: any[]) => realSetTimeout(fn, 0, ...rest)) as typeof setTimeout

// See Sidebar.tsx for why both reducedMotion and this !important override
// are needed — the modal card is also a framer-motion entrance transition,
// and the capture harness's frozen clock can stall it at opacity: 0.
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = '*,*::before,*::after{opacity:1 !important;transform:none !important;animation:none !important;transition:none !important}'
  document.head.appendChild(style)
}
export function Default() {
  return (
    <MotionConfig reducedMotion="always">
      <Tutorial />
    </MotionConfig>
  )
}
