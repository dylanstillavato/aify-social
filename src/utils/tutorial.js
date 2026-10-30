// aify_tutorial_completado y aify_dashboard_visitado eran claves globales de
// este navegador — con el selector de cuentas, quedaban "pegadas" tras usar
// una cuenta y afectaban a la siguiente. Se namespacean por userId, igual que
// aify_onboarding_completado (ver utils/onboarding.js). Una clave vieja sin
// sufijo queda huérfana y se ignora sin más.
const LS_KEY = 'aify_tutorial_completado'
const LS_DASHBOARD_VISITADO = 'aify_dashboard_visitado'

export function tutorialKey(userId) {
  return `${LS_KEY}::${userId}`
}

// Compartido con Dashboard.jsx, que marca la visita con la misma clave.
export function dashboardVisitadoKey(userId) {
  return `${LS_DASHBOARD_VISITADO}::${userId}`
}

export function isTutorialCompletado(userId) {
  if (!userId) return false
  try { return localStorage.getItem(tutorialKey(userId)) === 'true' } catch { return false }
}

export function resetTutorial(userId) {
  if (!userId) return
  try { localStorage.removeItem(tutorialKey(userId)) } catch { /* ignore */ }
}
