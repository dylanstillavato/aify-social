# TikTok: puesta en marcha (conectar, publicar y métricas)

Esta guía explica qué hay que hacer fuera del código para que Aify pueda
conectar el TikTok de un cliente y publicar en él desde el calendario. Mientras
no esté hecho, la app muestra "La conexión con TikTok todavía no está
configurada". El plan completo está en `docs/tiktok-plan.md`.

## 1. Qué usa Aify

- **Login Kit v2** (OAuth web) para conectar la cuenta. Access token de 24 h
  (Aify lo renueva solo cuando le queda menos de 1 h) y refresh token de 365
  días, que rota en cada renovación (se guarda el nuevo).
- **Content Posting API → Direct Post** para publicar vídeos y fotos.
  TikTok no programa: Aify guarda la hora y su propio ciclo (el mismo tick que
  Instagram) manda la publicación a su hora.
- **PULL_FROM_URL**: TikTok descarga los archivos de Aify, de
  `https://aify-backend.onrender.com/api/tiktok/medios/<token>`. El token va
  firmado y caduca a las 2 h. Ese prefijo hay que verificarlo en TikTok.
- **Webhooks** firmados (`TikTok-Signature`) para enterarse antes de cómo va
  la publicación y de cuándo un usuario quita el permiso.

Scopes que pide: `user.info.basic`, `user.info.profile`, `user.info.stats`,
`video.list`, `video.publish`, `video.upload`. Los de estadísticas y lista de
vídeos son para las métricas. Si la cuenta desmarca alguno al autorizar, Aify
guarda los concedidos; sin `video.publish` no deja publicar y sin
`user.info.stats` o `video.list` no enseña métricas, y en los dos casos pide
reconectar.

## 2. Crear la app en TikTok for Developers

1. Entra en https://developers.tiktok.com con la cuenta de desarrollador (la de
   Aify) → **Manage apps → Connect an app**. Tipo: organización si lo pide.
2. **App details**:
   - Nombre: Aify (el nombre **no puede incluir «TikTok»**).
   - Icono, categoría y descripción.
   - Web: `https://www.useaify.app`.
   - Terms of Service: `https://www.useaify.app/terminos`.
   - Privacy Policy: `https://www.useaify.app/privacidad` (tiene sección de
     TikTok, `#tiktok`).
   - Plataforma: **Web**.
3. **Products** → añade:
   - **Login Kit**. Redirect URI (Web):
     `https://aify-backend.onrender.com/api/tiktok/callback`. Tiene que
     coincidir **carácter por carácter** con `TIKTOK_REDIRECT_URI`. Para probar
     en local, añade también `http://localhost:3011/api/tiktok/callback`
     (si no acepta http, prueba en producción o con el sandbox).
   - **Content Posting API**, con **Direct Post** activado.
   - **Display API** (para la fase 2).
4. **Scopes**: añade los seis de arriba.
5. **Webhooks** → Callback URL:
   `https://aify-backend.onrender.com/api/tiktok/webhook`. El botón de
   prueba de TikTok tiene que devolver 200 (el backend comprueba la firma con
   el client secret, así que primero pon las variables del paso 4).
6. Copia el **Client key** y el **Client secret** (Basic information).

## 3. Verificar el prefijo de URL de los archivos

TikTok solo descarga archivos de dominios o prefijos verificados.

1. En la app → **Content Posting API → Verify domains / URL properties** →
   añade un **URL prefix**: `https://aify-backend.onrender.com/api/tiktok/medios/`.
2. TikTok te da un archivo de verificación para descargar (algo como
   `tiktokXXXXXXXX.txt`) con una línea de texto dentro.
3. En Render pon:
   - `TIKTOK_VERIFICACION_ARCHIVO` = el nombre del archivo (p. ej. `tiktokXXXXXXXX.txt`).
   - `TIKTOK_VERIFICACION_CONTENIDO` = el texto que hay dentro, tal cual.
4. Tras el despliegue, comprueba que
   `https://aify-backend.onrender.com/api/tiktok/medios/tiktokXXXXXXXX.txt`
   enseña ese texto, y pulsa **Verify** en TikTok.

Los archivos se sirven tal cual (sin redirecciones, que TikTok no sigue), con
su `Content-Type` y `Content-Length`, y aceptan `Range`.

## 4. Variables de entorno (Render, servicio aify-backend)

| Variable | Valor |
|---|---|
| `TIKTOK_CLIENT_KEY` | Client key del paso 2.6 |
| `TIKTOK_CLIENT_SECRET` | Client secret del paso 2.6 (secreto: solo en Render). Firma también el `state` del OAuth y los enlaces de los archivos, y comprueba el webhook |
| `TIKTOK_REDIRECT_URI` | `https://aify-backend.onrender.com/api/tiktok/callback` |
| `TIKTOK_VERIFICACION_ARCHIVO` | Nombre del archivo de verificación (paso 3) |
| `TIKTOK_VERIFICACION_CONTENIDO` | Contenido del archivo de verificación (paso 3) |
| `TIKTOK_VERIFICACION_CODIGOS` | Opcional. Más códigos de verificación (sandbox), separados por comas: el archivo `tiktok<código>.txt` responde `tiktok-developers-site-verification=<código>`. Los de la app y el sandbox actuales ya están en `server.js` |
| `TIKTOK_AUDITADA` | Vacía hasta que TikTok apruebe la auditoría de Direct Post; entonces `1` |
| `TIKTOK_MEDIOS_BASE_URL` | Opcional. Por defecto, el origen de `TIKTOK_REDIRECT_URI` (`https://aify-backend.onrender.com`) |

Se reutilizan las que ya están: `SUPABASE_SERVICE_ROLE_KEY`,
`GOOGLE_FRONTEND_URL` (para volver a `/clientes/<id>?tiktok=conectado|error`)
e `INSTAGRAM_CRON_SECRET` (el tick de pg_cron de la migración 0037 mueve
también las publicaciones de TikTok; no hace falta otro cron).

## 5. Base de datos

Pega `supabase/migrations/0049_tiktok.sql` en Supabase → SQL Editor y dale a
**Run**. Es idempotente. Crea `tiktok_conexiones`, `tiktok_tokens` (solo la
lee el servidor) y `tiktok_publicaciones`. Los archivos van al bucket
`publicaciones` de la 0036, que ya admite JPEG, MP4 y MOV.

Para las métricas, pega también `supabase/migrations/0050_tiktok_metricas.sql`:
crea `tiktok_metricas_cache`, `tiktok_metricas_dia` y `tiktok_videos_24h`
(solo las usa el servidor). Sin ella las métricas funcionan sin caché, pero no
se guardan las fotos diarias ni los vídeos a las 24 h, y TikTok no suma en la
tarjeta «Visualizaciones por mes».

## 6. Probar en el sandbox

1. En la app de TikTok for Developers, crea un **Sandbox** y añade como
   **target users** las cuentas de TikTok de prueba (hasta 10).
2. Pon en Render el client key y el client secret **del sandbox** (son
   distintos de los de producción).
3. La cuenta de prueba tiene que ser **privada** (TikTok → Ajustes y
   privacidad → Privacidad → Cuenta privada): sin auditoría solo se puede
   publicar en cuentas privadas.
4. En Aify: cliente → Seguimiento → **Conectar TikTok** → autorizar.
5. Calendario → un post con red TikTok (o que se comparte en TikTok) →
   **Programar en TikTok** con privacidad **Solo yo** y una hora a 2-3 minutos.
6. Comprueba en los logs de Render `[tiktok]` y en la app de TikTok que el
   vídeo aparece como privado. El calendario lo marca como publicado.

## 7. Revisión de la app y auditoría de Direct Post

Hasta pasar la auditoría:

- Todo se publica como **privado (SELF_ONLY)** y solo en **cuentas privadas**.
  Aify solo deja elegir «Solo yo» mientras `TIKTOK_AUDITADA` no sea `1`.
- Como mucho 5 usuarios distintos publicando en 24 h.
- ~15 publicaciones al día por creador (límite de TikTok también después).

Para pedirla:

1. **App review** (Submit for review): explica cada scope y adjunta un vídeo de
   demo que enseñe el flujo completo en `https://www.useaify.app`: conectar la
   cuenta, abrir un post del calendario, el formulario de TikTok (cuenta que
   publica, privacidad sin elegir, interacciones, contenido comercial, textos
   de consentimiento, vista previa) y el resultado publicado.
2. **Direct Post audit** (Content Posting API → Direct Post → Apply for
   audit): el formulario pregunta por el uso de la API; adjunta el mismo vídeo
   y capturas del formulario. Aify ya cumple las reglas de UX de TikTok:
   - Nombre (y usuario) de la cuenta que publica, pedido a `creator_info`
     cada vez que se abre el formulario y otra vez justo antes de publicar.
   - Privacidad en un desplegable **sin valor por defecto**, con las opciones
     que da TikTok para esa cuenta.
   - Comentarios, dúo y stitch **desmarcados** y en gris si la cuenta los tiene
     desactivados (en fotos, solo comentarios).
   - Duración del vídeo comprobada en el navegador contra
     `max_video_post_duration_sec` antes de programar.
   - Contenido comercial **apagado** por defecto; si se enciende, hay que
     marcar «Tu marca» y/o «Contenido de marca», se dice si se etiquetará como
     «Contenido promocional» o «Colaboración pagada», y el contenido de marca
     no puede ser «Solo yo».
   - Texto de consentimiento con enlace a la
     [Music Usage Confirmation](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en)
     y, con contenido de marca, a la
     [Branded Content Policy](https://www.tiktok.com/legal/page/global/bc-policy/en).
     Aify guarda la fecha en que se aceptó.
   - Vista previa del vídeo o de las fotos y aviso de que puede tardar unos
     minutos en aparecer.
3. Al aprobarse: `TIKTOK_AUDITADA=1` en Render y redeploy.

## 8. Cómo funciona por dentro (resumen)

| Ruta | Para qué |
|---|---|
| `GET /api/tiktok/conectar?clienteId=` | URL de autorización (`state` firmado, 15 min) |
| `GET /api/tiktok/callback` | Canjea el código, lee el perfil, guarda conexión y tokens |
| `GET /api/tiktok/estado/:clienteId` | Estado de la conexión (sin tokens) |
| `DELETE /api/tiktok/conexion/:clienteId` | Revoca en TikTok y borra tokens y conexión |
| `GET /api/tiktok/creador/:clienteId` | `creator_info` para el formulario |
| `GET /api/tiktok/publicar/:clienteId` | Publicaciones de TikTok del cliente |
| `PUT /api/tiktok/publicar/:clienteId/:postId` | Programa o reprograma un post |
| `PATCH /api/tiktok/publicar/:clienteId/:postId` | Solo cambia la hora (al mover el post en el calendario) |
| `DELETE /api/tiktok/publicar/:clienteId/:postId` | Cancela |
| `GET /api/tiktok/medios/:archivo` | Archivo para TikTok (token firmado) o archivo de verificación |
| `POST /api/tiktok/webhook` | Eventos `post.publish.*` y `authorization.removed` |
| `GET /api/tiktok/metricas/:clienteId` | Perfil y hasta 60 vídeos con sus números (caché de 1 h; `?refrescar=1`) |
| `GET /api/instagram/visitas-mensuales` | Visualizaciones por mes de Instagram y TikTok (tarjeta del Inicio) |

El ciclo (`cicloPublicacionesTikTok`, cada minuto y en
`POST /api/instagram/publicar/tick`) reserva lo que toca
(`programado → procesando`), vuelve a pedir `creator_info`, llama a
`post/publish/video/init/` o `post/publish/content/init/` y después a
`status/fetch` hasta `PUBLISH_COMPLETE` o `FAILED` (máximo 30 min). Al
publicarse: el post del calendario pasa a publicado, su tarea a la columna
final y se borran los archivos del bucket.

Las métricas: `cicloMetricasTikTok` (cada 15 min y en el mismo tick) guarda
una vez al día por cuenta la foto de los contadores (`tiktok_metricas_dia`,
con la suma de visualizaciones de hasta 200 vídeos) y, una vez por vídeo
entre las 24 y las 48 h de publicarse, sus números (`tiktok_videos_24h`).
Las visualizaciones de TikTok de un mes son la diferencia entre la última foto
del mes y la del mes anterior.

El MCP (`mcp/servidor.js`) usa las mismas funciones que la web:
`programar_tiktok` → `programarPublicacionTikTok` (PUT), `mover_post` →
`moverPublicacionTikTok` (PATCH) y `ver_creador_tiktok` → `creadorTikTok`.
