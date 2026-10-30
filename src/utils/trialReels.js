// Los posts del calendario creados desde "Variantes Trial" llevan este prefijo
// en el título; al programarlos, la casilla "Publicar como Trial Reel" sale marcada.
export const PREFIJO_TRIAL = 'Trial · '

export const esPostTrial = (post) => String(post?.titulo || '').startsWith(PREFIJO_TRIAL)
