import {
  Lightbulb, Video, Clapperboard, UserPlus, Send, FileText, FileSignature, CheckSquare,
  LayoutDashboard, LayoutGrid, Users, Calendar, Search, Wallet, Settings,
  BarChart3, CalendarClock, MessageCircle, GalleryVerticalEnd, Inbox,
} from 'lucide-react'

// Acciones y API de la paleta de comandos (PaletaComandos.jsx). Vive en un
// archivo aparte para que PaletaComandos.jsx solo exporte el componente
// (react-refresh/only-export-components).

// Evento global para abrir la paleta desde cualquier sitio (p.ej. el botón
// "Crear" de la barra lateral): window.dispatchEvent(new Event(EVENTO_ABRIR_COMANDOS))
export const EVENTO_ABRIR_COMANDOS = 'aify:abrir-comandos'

export function abrirPaletaComandos() {
  window.dispatchEvent(new Event(EVENTO_ABRIR_COMANDOS))
}

// Acciones estáticas de la paleta. Otras funcionalidades pueden añadir
// entradas aquí (o hacer ACCIONES_PALETA.push(...) al importarse).
// - grupo: 'crear' | 'ir'
// - to: ruta a la que navegar; o bien run({ navigate }) para lógica propia
// - keywords: términos extra para la búsqueda
// - hint: texto opcional a la derecha
export const ACCIONES_PALETA = [
  { id: 'crear-idea', grupo: 'crear', label: 'Nueva idea', icon: Lightbulb, to: '/lluvia-de-ideas', keywords: 'lluvia ideas brainstorming' },
  { id: 'crear-guion', grupo: 'crear', label: 'Nuevo guion', icon: Video, to: '/guiones', keywords: 'guion reel video script' },
  { id: 'crear-guiones-mes', grupo: 'crear', label: 'Guiones del mes', icon: Clapperboard, to: '/guiones-del-mes', keywords: 'mensual planificacion aprobar' },
  { id: 'crear-cliente', grupo: 'crear', label: 'Nuevo cliente', icon: UserPlus, to: '/nuevo-cliente', keywords: 'anadir cliente alta' },
  { id: 'crear-formulario', grupo: 'crear', label: 'Enviar formulario a un cliente', icon: Send, to: '/clientes', keywords: 'onboarding formulario enlace whatsapp' },
  { id: 'crear-factura', grupo: 'crear', label: 'Nueva factura', icon: FileText, to: '/dinero?vista=facturas&nuevo=factura', keywords: 'factura cobro dinero' },
  { id: 'crear-presupuesto', grupo: 'crear', label: 'Nuevo presupuesto', icon: FileSignature, to: '/dinero?vista=presupuestos&nuevo=presupuesto', keywords: 'presupuesto propuesta firma dinero' },
  { id: 'crear-tarea', grupo: 'crear', label: 'Nueva tarea', icon: CheckSquare, to: '/todo', keywords: 'tarea todo pendiente' },

  { id: 'ir-inicio', grupo: 'ir', label: 'Inicio', icon: LayoutDashboard, to: '/dashboard', keywords: 'dashboard panel home' },
  { id: 'ir-contenido', grupo: 'ir', label: 'Contenido', icon: LayoutGrid, to: '/contenido', keywords: 'tablero pipeline piezas publicaciones' },
  { id: 'ir-clientes', grupo: 'ir', label: 'Clientes', icon: Users, to: '/clientes', keywords: 'mis clientes' },
  { id: 'ir-calendario', grupo: 'ir', label: 'Calendario', icon: Calendar, to: '/calendario', keywords: 'publicaciones fechas' },
  { id: 'ir-guiones', grupo: 'ir', label: 'Ideas y guiones', icon: Video, to: '/guiones', keywords: 'guiones virales' },
  { id: 'ir-guiones-mes', grupo: 'ir', label: 'Guiones del mes', icon: Clapperboard, to: '/guiones-del-mes', keywords: 'mensual' },
  { id: 'ir-lluvia', grupo: 'ir', label: 'Lluvia de ideas', icon: Lightbulb, to: '/lluvia-de-ideas', keywords: 'ideas brainstorming' },
  { id: 'ir-palabras', grupo: 'ir', label: 'Palabras clave', icon: Search, to: '/investigacion-palabras-clave', keywords: 'seo investigacion keywords' },
  { id: 'ir-ig-metricas', grupo: 'ir', label: 'Métricas de Instagram', icon: BarChart3, to: '/instagram/metricas', keywords: 'instagram estadisticas alcance seguimiento insights' },
  { id: 'ir-ig-programar', grupo: 'ir', label: 'Programar publicaciones', icon: CalendarClock, to: '/instagram/programar', keywords: 'instagram publicar reel carrusel historia programacion metricool' },
  { id: 'ir-ig-historias', grupo: 'ir', label: 'Secuencias de historias', icon: GalleryVerticalEnd, to: '/instagram/historias', keywords: 'instagram stories historias fotos secuencia diseño' },
  { id: 'ir-ig-bandeja', grupo: 'ir', label: 'Bandeja de DMs', icon: Inbox, to: '/instagram/bandeja', keywords: 'instagram mensajes directos dm inbox responder conversaciones clientes' },
  { id: 'ir-ig-dms', grupo: 'ir', label: 'DMs automáticos', icon: MessageCircle, to: '/instagram/dms', keywords: 'instagram mensajes palabra clave comentarios manychat' },
  { id: 'ir-tareas', grupo: 'ir', label: 'Tareas', icon: CheckSquare, to: '/todo', keywords: 'lista de tareas todo' },
  { id: 'ir-dinero', grupo: 'ir', label: 'Dinero', icon: Wallet, to: '/dinero', keywords: 'ingresos cobros finanzas' },
  { id: 'ir-facturas', grupo: 'ir', label: 'Facturas', icon: FileText, to: '/dinero?vista=facturas', keywords: 'presupuestos cobros' },
  { id: 'ir-configuracion', grupo: 'ir', label: 'Configuración', icon: Settings, to: '/configuracion', keywords: 'ajustes cuenta equipo miembros' },
]
