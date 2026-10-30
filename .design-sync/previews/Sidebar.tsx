import { Sidebar } from 'aify'
import { MotionConfig } from 'framer-motion'

// The capture harness freezes the page clock for deterministic screenshots
// (package-capture.mjs's page.clock.setFixedTime), which stalls
// framer-motion's entrance transition at its invisible initial state
// (opacity: 0) on the harness's second navigation — reducedMotion="always"
// alone isn't enough once that happens, so also force the resolved style
// with an !important rule, which always wins over a plain inline style.
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = '*,*::before,*::after{opacity:1 !important;transform:none !important;animation:none !important;transition:none !important}'
  document.head.appendChild(style)
}

export function Default() {
  return (
    <MotionConfig reducedMotion="always">
      <Sidebar />
    </MotionConfig>
  )
}
