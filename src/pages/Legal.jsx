import {
  INK, INK_SOFT, SURFACE_ALT, SKY_DEEP, FONT, CONTACT_EMAIL,
  MarketingNavbar, MarketingFooter, MARKETING_CSS,
} from './marketing/shared'

// Páginas legales (/privacidad, /terminos, /cookies). Estáticas y
// prerenderizadas como el resto de marketing — sin useAuth()/useNavigate().
//
// El contenido describe lo que el código hace de verdad (proveedores en
// server.js/render.yaml/vercel.json, claves de almacenamiento en src/). Si
// añades un proveedor que trate datos (analytics, email, otra IA…), actualiza
// estas páginas y ACTUALIZADO en el mismo commit.
//
// TODO antes de publicar: rellenar TITULAR. La LSSI (art. 10) exige nombre o
// razón social, NIF y domicilio del titular del sitio; mientras falten, esas
// filas no se muestran pero la página NO está completa legalmente.
const TITULAR = {
  nombre: 'Dylan Stillavato',
  nif: '29222422W',
  domicilio: 'Av. Marina 195, 46531 Puzol Playa (Valencia)',
  pais: 'España',
}

const ACTUALIZADO = '2026-10-30'

const PROVEEDORES = [
  ['Supabase', 'Base de datos y autenticación (cuentas, contraseñas cifradas y todo el contenido que guardas en Aify).'],
  ['Google (Gemini)', 'Generación de contenido con IA, solo si guardas tu clave de Gemini: se usa tu clave y se envía el texto de cada petición (por ejemplo, el perfil de marca del cliente y lo que pides generar).'],
  ['Anthropic (Claude)', 'Generación de contenido con IA, solo si guardas tu clave de Claude: se usa tu clave, con los mismos datos que el punto anterior.'],
  ['Google (Business Profile, YouTube, Trends)', 'Solo si conectas tu perfil de empresa de Google (reseñas y respuestas) o usas tendencias: se envían las búsquedas o se leen los datos de la cuenta que autorizas.'],
  ['Meta (Instagram)', 'Solo si conectas la cuenta de Instagram profesional de un cliente: leemos su perfil, publicaciones, estadísticas, comentarios y mensajes, y enviamos las respuestas y publicaciones que programas (ver "Cuentas de Instagram conectadas").'],
  ['TikTok', 'Solo si conectas la cuenta de TikTok de un cliente: leemos su perfil básico y le enviamos los vídeos, fotos y textos que programas para publicar (ver "Cuentas de TikTok conectadas").'],
  ['Vercel y Render', 'Alojamiento de la web y del servidor de Aify.'],
]

function Seccion({ titulo, id, children }) {
  return (
    <section id={id} style={{ marginBottom: 36, scrollMarginTop: 80 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: INK, letterSpacing: '-0.4px', marginBottom: 12 }}>{titulo}</h2>
      <div style={{ fontSize: 15.5, color: INK_SOFT, lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </section>
  )
}

function Titular() {
  const filas = [
    ['Titular', TITULAR.nombre],
    ['NIF', TITULAR.nif],
    ['Domicilio', TITULAR.domicilio],
    ['Contacto', CONTACT_EMAIL],
  ].filter(([, v]) => v)
  return (
    <Seccion titulo="Quién está detrás de Aify">
      {filas.map(([k, v]) => (
        <p key={k} style={{ margin: 0 }}><strong style={{ color: INK }}>{k}:</strong> {v}</p>
      ))}
    </Seccion>
  )
}

const Email = () => <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: SKY_DEEP, fontWeight: 600 }}>{CONTACT_EMAIL}</a>

function LegalLayout({ titulo, intro, children }) {
  return (
    <div style={{ fontFamily: FONT, background: 'white', minHeight: '100vh' }}>
      <style>{MARKETING_CSS}</style>
      <MarketingNavbar />
      <header style={{ background: SURFACE_ALT, padding: '56px 24px 40px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 42px)', fontWeight: 700, color: INK, letterSpacing: '-1.2px', marginBottom: 12 }}>{titulo}</h1>
          <p style={{ fontSize: 16, color: INK_SOFT, lineHeight: 1.6, margin: 0 }}>{intro}</p>
          <p style={{ fontSize: 13, color: INK_SOFT, marginTop: 14 }}>Última actualización: {ACTUALIZADO}</p>
        </div>
      </header>
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 72px' }}>
        {children}
      </main>
      <MarketingFooter />
    </div>
  )
}

export function Privacidad() {
  return (
    <LegalLayout titulo="Política de privacidad" intro="Qué datos trata Aify, para qué, con quién se comparten y cómo puedes controlarlos.">
      <Titular />
      <Seccion titulo="Qué datos tratamos">
        <p><strong style={{ color: INK }}>Tu cuenta:</strong> email, contraseña (cifrada, nunca la vemos en claro), nombre y datos de tu organización y de los miembros que invites.</p>
        <p><strong style={{ color: INK }}>El contenido que guardas:</strong> clientes, perfiles de marca, fotos, ideas, calendarios, copies, guiones, tareas, presupuestos, facturas y firmas de presupuestos.</p>
        <p><strong style={{ color: INK }}>Tus claves de IA:</strong> si guardas tu clave de Claude o de Gemini, la guardamos cifrada y solo la usa nuestro servidor para las peticiones de IA que haces. Nunca se vuelve a mostrar entera.</p>
        <p><strong style={{ color: INK }}>Lista de espera y recursos gratuitos:</strong> si dejas tu email en una de nuestras páginas públicas, guardamos ese email y la página desde la que lo dejaste.</p>
        <p>No usamos herramientas de analítica, grabación de sesiones ni píxeles publicitarios.</p>
      </Seccion>
      <Seccion titulo="Para qué y con qué base legal">
        <p>Para prestarte el servicio que usas (ejecución del contrato) y para responder al email que nos dejas en la lista de espera (tu consentimiento, que puedes retirar cuando quieras).</p>
        <p>No vendemos tus datos ni los usamos para publicidad. Solo te escribimos sobre tu cuenta o aquello para lo que dejaste tu email.</p>
      </Seccion>
      <Seccion titulo="Datos de tus clientes">
        <p>Cuando guardas en Aify datos de tus propios clientes, tú decides qué se guarda y para qué (eres el responsable) y Aify los trata solo para darte el servicio (encargado del tratamiento). Asegúrate de tener derecho a subir esos datos.</p>
      </Seccion>
      <Seccion titulo="Cuentas de Instagram conectadas" id="instagram">
        <p>Si conectas la cuenta de Instagram profesional de un cliente (con el inicio de sesión de Instagram y la API de Instagram de Meta), Aify trata, solo para esa cuenta y solo dentro de tu organización:</p>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li><strong style={{ color: INK }}>Perfil y publicaciones:</strong> nombre de usuario, tipo de cuenta, seguidores, foto de perfil y la lista de publicaciones (texto, tipo, enlace y fecha), para enseñarlas en el seguimiento del cliente y relacionarlas con su calendario.</li>
          <li><strong style={{ color: INK }}>Estadísticas:</strong> alcance, visualizaciones, interacciones y datos de audiencia de la cuenta y de cada publicación, para los informes del cliente. Se guardan en caché como máximo una hora.</li>
          <li><strong style={{ color: INK }}>Comentarios:</strong> solo los que contienen una palabra clave de una regla de respuesta que tú has creado, para responder a esa persona. El resto se ignora y no se guarda.</li>
          <li><strong style={{ color: INK }}>Mensajes directos:</strong> las conversaciones de la cuenta, para verlas en la bandeja de Aify y responderlas. Solo enviamos los mensajes que escribe tu equipo o los de una regla que has creado, nunca iniciamos conversaciones.</li>
          <li><strong style={{ color: INK }}>Publicaciones programadas:</strong> las imágenes, vídeos y textos que subes para publicar a la hora que eliges.</li>
        </ul>
        <p>No vendemos estos datos ni los usamos para publicidad, y no los compartimos fuera de tu organización salvo con los proveedores de la lista de abajo cuando hace falta (por ejemplo, el texto de un mensaje si pides una respuesta sugerida con IA).</p>
        <p><strong style={{ color: INK }}>Cómo borrarlos:</strong> al desconectar la cuenta desde el cliente en Aify, o al borrar el cliente, eliminamos al momento el token de acceso, las estadísticas en caché y las conversaciones. También puedes quitar el acceso a Aify desde Instagram (Configuración → Seguridad → Apps y sitios web) o pedir la eliminación desde Meta: recibimos el aviso y borramos esos mismos datos. Para cualquier otra petición, escribe a <Email />.</p>
      </Seccion>
      <Seccion titulo="Cuentas de TikTok conectadas" id="tiktok">
        <p>Si conectas la cuenta de TikTok de un cliente (con el inicio de sesión de TikTok y su API para publicar contenido), Aify trata, solo para esa cuenta y solo dentro de tu organización:</p>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li><strong style={{ color: INK }}>Perfil:</strong> identificador de la cuenta, nombre, nombre de usuario y foto de perfil, para saber en qué cuenta se publica y enseñarla en Aify.</li>
          <li><strong style={{ color: INK }}>Permisos y acceso:</strong> los permisos que concede la cuenta y los tokens de acceso de TikTok, que se guardan solo en el servidor y nunca llegan al navegador.</li>
          <li><strong style={{ color: INK }}>Opciones de publicación:</strong> antes de publicar consultamos a TikTok las opciones de la cuenta (quién puede verlo, si admite comentarios, dúos o stitch y la duración máxima del vídeo).</li>
          <li><strong style={{ color: INK }}>Publicaciones programadas:</strong> los vídeos, fotos y textos que subes, con las opciones que eliges (privacidad, interacciones, contenido comercial) y la fecha en que aceptas las condiciones de TikTok. TikTok los descarga de Aify a la hora programada; al publicarse, borramos los archivos de Aify.</li>
          <li><strong style={{ color: INK }}>Estadísticas:</strong> seguidores, seguidos, me gusta y número de vídeos de la cuenta, y de sus vídeos públicos el texto, la portada, el enlace, la fecha, la duración y las visualizaciones, me gusta, comentarios y compartidos. Guardamos una foto diaria de esos números para enseñar su evolución.</li>
        </ul>
        <p>No vendemos estos datos ni los usamos para publicidad, y no los compartimos fuera de tu organización salvo con los proveedores de la lista de abajo cuando hace falta.</p>
        <p><strong style={{ color: INK }}>Cómo borrarlos:</strong> al desconectar la cuenta desde el cliente en Aify, revocamos el acceso en TikTok y borramos al momento los tokens y los datos de la cuenta; al borrar el cliente se borra también su historial de publicaciones. También puedes quitar el acceso a Aify desde la app de TikTok (Ajustes y privacidad → Seguridad → Apps y servicios): TikTok nos avisa y borramos los tokens. Para cualquier otra petición, escribe a <Email />.</p>
      </Seccion>
      <Seccion titulo="Con quién se comparten">
        <p>Solo con los proveedores que hacen funcionar Aify, y solo lo necesario para cada función:</p>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PROVEEDORES.map(([nombre, uso]) => (
            <li key={nombre}><strong style={{ color: INK }}>{nombre}:</strong> {uso}</li>
          ))}
        </ul>
        <p>Algunos de estos proveedores están fuera del Espacio Económico Europeo (principalmente en EE. UU.). En esos casos la transferencia se ampara en las garantías previstas por el RGPD, como las cláusulas contractuales tipo de la Comisión Europea o el Marco de Privacidad de Datos UE-EE. UU.</p>
      </Seccion>
      <Seccion titulo="Cuánto tiempo los guardamos">
        <p>Los datos de tu cuenta y tu contenido, mientras la cuenta esté activa. Si la eliminas, los borramos salvo lo que la ley obligue a conservar (por ejemplo, los registros de facturación, durante los plazos fiscales). El email de la lista de espera, hasta que nos pidas borrarlo.</p>
      </Seccion>
      <Seccion titulo="Tus derechos">
        <p>Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad de tus datos, y retirar tu consentimiento, escribiendo a <Email />. Si crees que no hemos atendido bien tu petición, puedes reclamar ante la autoridad de protección de datos{TITULAR.pais === 'España' ? ' (en España, la Agencia Española de Protección de Datos, aepd.es)' : ''}.</p>
      </Seccion>
    </LegalLayout>
  )
}

export function Terminos() {
  return (
    <LegalLayout titulo="Términos de uso" intro="Las condiciones para usar Aify. Están escritas para que se entiendan.">
      <Titular />
      <Seccion titulo="El servicio">
        <p>Aify es una herramienta con IA para que agencias y profesionales del marketing organicen y generen el contenido de sus clientes. Está pensada para uso profesional.</p>
        <p>Aify está en fase beta: hay funciones que pueden cambiar, fallar o desaparecer. Haz copia de lo importante.</p>
      </Seccion>
      <Seccion titulo="Tu cuenta">
        <p>Eres responsable de la actividad de tu cuenta y de los miembros que invites a tu organización. Mantén tu contraseña a salvo.</p>
      </Seccion>
      <Seccion titulo="Precio">
        <p>Aify Social es gratis y de código abierto. No hay planes de pago ni se pide tarjeta.</p>
      </Seccion>
      <Seccion titulo="Tu contenido y el contenido generado con IA">
        <p>Lo que subes y lo que generas con Aify es tuyo. Nos das permiso solo para almacenarlo y procesarlo en la medida necesaria para prestarte el servicio.</p>
        <p>El contenido generado por IA puede contener errores o parecerse a contenido existente. Revísalo antes de publicarlo o entregarlo: la responsabilidad de lo que publicas es tuya.</p>
      </Seccion>
      <Seccion titulo="Uso aceptable">
        <p>No uses Aify para actividades ilegales, para infringir derechos de terceros, para enviar spam ni para intentar saltarte los límites o la seguridad del servicio. Podemos suspender cuentas que lo hagan.</p>
      </Seccion>
      <Seccion titulo="Responsabilidad">
        <p>Aify es gratis y se ofrece "tal cual", sin garantías, especialmente durante la beta. En la medida en que la ley lo permita, no respondemos de los daños que se deriven de su uso.</p>
      </Seccion>
      <Seccion titulo="Baja y cambios en estos términos">
        <p>Puedes dejar de usar Aify y pedir que borremos tu cuenta cuando quieras escribiendo a <Email />. Si cambiamos estos términos de forma relevante, te avisaremos antes de que se apliquen.</p>
        <p>Estos términos se rigen por la ley de {TITULAR.pais}. La <a href="/privacidad" style={{ color: SKY_DEEP, fontWeight: 600 }}>política de privacidad</a> forma parte de ellos.</p>
      </Seccion>
    </LegalLayout>
  )
}

export function Cookies() {
  const claves = [
    ['Sesión de inicio (Supabase)', 'Mantiene tu sesión abierta. Si desmarcas "Recordarme", se borra al cerrar el navegador.'],
    ['aify_recordar_sesion', 'Recuerda si marcaste "Recordarme".'],
    ['aify_theme', 'Tema claro u oscuro.'],
    ['Preferencias de la app', 'Vistas del calendario y de tareas, último cliente abierto, y estado del onboarding.'],
  ]
  return (
    <LegalLayout titulo="Política de cookies" intro="Aify no usa cookies de analítica ni de publicidad. Solo guarda en tu navegador lo necesario para que la app funcione.">
      <Seccion titulo="Qué guardamos en tu navegador">
        <p>Usamos el almacenamiento local del navegador (localStorage y sessionStorage), no cookies de terceros. Todo es técnico y necesario para el servicio o para recordar preferencias que tú eliges, así que no necesita tu consentimiento previo:</p>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {claves.map(([k, v]) => (
            <li key={k}><strong style={{ color: INK }}>{k}:</strong> {v}</li>
          ))}
        </ul>
      </Seccion>
      <Seccion titulo="Servicios de terceros">
        <p>Cuando conectas Google, te llevamos a su página. Esa página es suya y pone sus propias cookies según sus políticas. Aify no carga scripts de terceros de analítica ni de publicidad.</p>
      </Seccion>
      <Seccion titulo="Cómo borrarlo">
        <p>Puedes borrar estos datos desde la configuración de tu navegador. Si borras la sesión, tendrás que volver a iniciar sesión. Dudas: <Email />.</p>
      </Seccion>
    </LegalLayout>
  )
}
