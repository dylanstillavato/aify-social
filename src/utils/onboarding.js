export const ONBOARDING_LS_KEY = 'aify_onboarding_completado'

// aify_onboarding_completado era una única clave global en este navegador —
// con el selector de cuentas, una cuenta distinta ya usada aquí podía dejarla
// en 'true' y hacer que CUALQUIER cuenta (incluida una recién invitada que
// nunca completó el onboarding) se saltara el asistente inicial. Se namespacea
// por userId para que cada cuenta tenga su propio flag en este navegador.
// Un valor viejo sin sufijo (de antes de este cambio) queda huérfano bajo la
// clave plana y simplemente se ignora — en el peor caso alguien ve el
// onboarding una vez más de lo estrictamente necesario.
export function onboardingKey(userId) {
  return `${ONBOARDING_LS_KEY}::${userId}`
}

export function isOnboardingCompleto(userId) {
  if (!userId) return false
  try { return localStorage.getItem(onboardingKey(userId)) === 'true' } catch { return false }
}

export function markOnboardingCompleto(userId) {
  if (!userId) return
  try { localStorage.setItem(onboardingKey(userId), 'true') } catch { /* ignore */ }
}

export function resetOnboarding(userId) {
  if (!userId) return
  try { localStorage.removeItem(onboardingKey(userId)) } catch { /* private browsing / quota — nothing to do */ }
}
