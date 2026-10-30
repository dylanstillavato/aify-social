# TikTok en Aify: plan (2026-10-29)

Objetivo: lo mismo que tenemos con Meta (conectar la cuenta del cliente, programar y publicar, métricas), hasta donde lo permite la API de TikTok.

## Qué deja hacer TikTok (developers.tiktok.com, comprobado el 2026-10-29)

| Capacidad | ¿Se puede? | Notas |
|---|---|---|
| Conectar la cuenta (OAuth) | Sí | Login Kit v2. Access token 24 h, refresh token 365 días (rota: guardar el nuevo). Sin PKCE en web. |
| Publicar vídeo | Sí, con límites | Content Posting API, Direct Post (`video.publish`). Hasta pasar la auditoría: solo privado (SELF_ONLY), cuentas privadas y 5 usuarios/24 h. ~15 posts/día por creador. |
| Publicar fotos (carrusel) | Sí, con límites | Hasta 35 JPEG/WebP, solo PULL_FROM_URL: la URL tiene que estar en un dominio o prefijo verificado. |
| Programar | No nativo | TikTok no tiene hora de publicación: Aify publica a la hora con su propio ciclo (como Instagram). |
| Estado de la publicación | Sí | `status/fetch` + webhooks `post.publish.*` firmados. |
| Métricas de cuenta (ahora) | Sí | `user/info`: seguidores, siguiendo, me gustas, nº de vídeos. |
| Métricas por vídeo | Sí, con límites | `video/list` y `video/query`: visualizaciones, me gustas, comentarios, compartidos. Solo vídeos públicos. Sin alcance ni retención. |
| Evolución diaria | No | Ni alcance ni visitas al perfil por día. Se construye con una foto diaria de los contadores que guarda Aify. |
| Leer/responder comentarios | No (salvo Business API) | Solo con TikTok API for Business (cuentas Business y otra aprobación). |
| DMs automáticos por palabra clave | No | No hay webhook de comentarios y la API de mensajes no funciona en el EEE. |
| Bandeja de DMs | No (en España) | Business Messaging API excluye el EEE, Suiza y Reino Unido. |
| Historias | No | La API no publica historias. |

## Fases

### Fase 1: conectar + programar y publicar (PR 1)
- **Backend** (`server.js`, bloque nuevo `/api/tiktok/*`, calcado del de Instagram):
  - Env: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` (por defecto `http://localhost:3011/api/tiktok/callback`). `tiktokConfigurado()`.
  - Scopes: `user.info.basic,user.info.profile,user.info.stats,video.list,video.publish,video.upload`. Guardar los concedidos (el usuario puede quitar alguno).
  - `GET /api/tiktok/conectar` (URL de autorización con `state` firmado, mismo esquema que Instagram), `GET /api/tiktok/callback` (canjea el código, `user/info`, guarda conexión y tokens, vuelve a `/clientes/:id?tiktok=conectado|error&motivo=`), `GET /api/tiktok/estado/:clienteId`, `DELETE /api/tiktok/conexion/:clienteId` (además revoca en TikTok).
  - `tokenTikTokVigente(clienteId)`: refresca si al access token le queda menos de 1 h; guarda el refresh token nuevo; si el refresh falla, conexión `caducada`.
  - `GET /api/tiktok/creador/:clienteId`: `creator_info/query` (nombre, opciones de privacidad, interacciones desactivadas, duración máxima). La pantalla de publicar lo pide cada vez que se abre.
  - `PUT|DELETE /api/tiktok/publicar/:clienteId/:postId` y `GET /api/tiktok/publicar/:clienteId`: igual que Instagram. Tipos: `video` y `fotos`. Guarda todo lo que el usuario eligió: privacidad, comentarios/dúo/stitch, contenido comercial (marca propia / contenido de marca), `is_aigc`, título y descripción (fotos: título ≤ 90, descripción ≤ 4000; vídeo: título ≤ 2200), portada (índice de foto o milisegundo del vídeo) y el consentimiento (fecha).
  - Publicación: ciclo `cicloPublicacionesTikTok` en el mismo tick que Instagram (`/api/instagram/publicar/tick` + `setInterval`), con la misma reserva atómica `programado → procesando`. Antes de publicar vuelve a pedir `creator_info`: si la privacidad elegida ya no está entre las opciones o el creador no puede publicar, error con mensaje claro. Vídeo: `post/publish/video/init/`; fotos: `post/publish/content/init/` (`media_type=PHOTO`, `post_mode=DIRECT_POST`). Ambos con **PULL_FROM_URL** desde una ruta del backend que sirve el archivo del bucket con un token firmado y caducidad (`GET /api/tiktok/medios/:token`), para tener un solo prefijo que verificar en TikTok. Ruta para el archivo de verificación del prefijo (`TIKTOK_VERIFICACION_ARCHIVO` / `TIKTOK_VERIFICACION_CONTENIDO`).
  - Avance: `status/fetch` hasta `PUBLISH_COMPLETE` (y `publicaly_available_post_id` si llega) o `FAILED` (con `fail_reason` traducido). Tiempo máximo 30 min. Al publicar: `calendario_posts.estado='publicado'`, mover la tarea a la columna final y borrar los archivos (sacar a funciones comunes lo que ya hace Instagram).
  - Webhook `POST /api/tiktok/webhook`: verifica `TikTok-Signature` (HMAC-SHA256 de `"{t}.{raw_body}"` con el client secret, tolerancia 5 min), responde 200 al momento, e idempotente. `post.publish.*` adelanta el estado; `authorization.removed` borra tokens y marca la conexión.
  - `limpiarBucketPublicaciones` / `rutasEnUsoBucket` cuentan también `tiktok_publicaciones`.
- **Migración 0049**: `tiktok_conexiones` (cliente_id PK, open_id, username, nombre, avatar, permisos text[], token_expira_en, estado activa|caducada, ultimo_error…), `tiktok_tokens` (solo servidor), `tiktok_publicaciones` (calcada de `instagram_publicaciones`, con las opciones de TikTok, `publish_id`, `tiktok_post_id`, `enlace`). RLS como 0027/0036. El bucket ya admite jpeg/mp4/mov.
- **Frontend**:
  - `src/services/tiktok.js` (como `instagram.js`).
  - Conectar/desconectar TikTok en Seguimiento del cliente (al lado de Instagram) y aviso de vuelta `?tiktok=`.
  - `PublicarTikTok.jsx` en `CalendarioPublicacion`: cuando el post es de TikTok (`red === 'tiktok'` o `comparteEn` incluye `tiktok`). Cumple las reglas de TikTok: cuenta que publica (nombre), privacidad desplegable sin valor por defecto, interacciones desmarcadas y en gris si el creador las tiene desactivadas (fotos: solo comentarios), contenido comercial apagado por defecto (si se enciende, obligatorio marcar «Tu marca» y/o «Contenido de marca», textos «Contenido promocional» / «Colaboración pagada», contenido de marca no puede ser «Solo yo»), textos de consentimiento con enlaces a la Music Usage Confirmation y, si aplica, la Branded Content Policy, vista previa, aviso de que puede tardar unos minutos, estado con progreso. Avisar de que hasta la auditoría todo sale privado.
  - En el calendario, el estado de TikTok junto al de Instagram.
- **Legal**: sección de TikTok en `/privacidad` (datos, cómo se borran) y `docs/tiktok-setup.md` (cómo crear la app y las variables).

### Fase 2: métricas (hecha, 2026-10-29)
- `GET /api/tiktok/metricas/:clienteId` con caché de 1 h (`tiktok_metricas_cache`, `?refrescar=1` como mucho cada 5 min): perfil (`user/info`: seguidores, siguiendo, me gustas, nº de vídeos) y vídeos (`video/list`, 20 por página, hasta 60) con visualizaciones, me gustas, comentarios, compartidos, portada, enlace y fecha. Mismo control de plan que Instagram. Sin `user.info.stats` o `video.list` pide reconectar.
- `cicloMetricasTikTok` (cada 15 min, en el mismo tick que Instagram):
  - Foto diaria por cuenta (`tiktok_metricas_dia`: seguidores, me gustas, vídeos y visualizaciones totales = suma de los vídeos listados, hasta 200).
  - Vídeos a las 24 h (`tiktok_videos_24h`, entre las 24 y las 48 h de publicarse): visualizaciones, me gustas, comentarios y compartidos.
- Tarjeta del Inicio «Visualizaciones por mes» (`/api/instagram/visitas-mensuales`): suma Instagram y TikTok y da cada red por separado. TikTok de un mes = total de la última foto del mes menos el de la última del mes anterior (el primer mes, desde la primera foto; sin fotos, `null`).
- Seguimiento del cliente: bloque de métricas de TikTok debajo de la conexión (`MetricasTikTok.jsx`), como el de Instagram con los campos que da TikTok.
- Lluvia de ideas: la IA recibe también lo que le funciona en TikTok (`utils/resumenTikTok.js`).
- Migración `0050_tiktok_metricas.sql`. Al desconectar la cuenta se borran sus métricas guardadas.

### Fase 3: MCP y calendario (hecha, 2026-10-29)
- MCP (`mcp/servidor.js`):
  - `crear_post`: `red` = `instagram` (por defecto), `tiktok` o `instagram_y_tiktok` (red instagram + `comparte_en` tiktok, como «Nuevo post»).
  - `ver_calendario`: estado de la publicación de TikTok de cada post y filtro `red`.
  - `ver_metricas`: conexión de TikTok, última foto diaria y vídeos a las 24 h.
  - `mover_post`: también mueve la hora de lo programado en TikTok (`moverPublicacionTikTok`, la misma función que el PATCH de la web) y no mueve lo que se está publicando o ya está publicado en TikTok.
  - `marcar_publicado`: tiene en cuenta también la publicación de TikTok.
  - Nuevas: `ver_creador_tiktok` (`creator_info`) y `programar_tiktok` (la misma función que el PUT de la web, `programarPublicacionTikTok`). La privacidad es obligatoria, sin valor por defecto, y tiene que estar entre las opciones de `creator_info`; interacciones desmarcadas por defecto; `consentimiento: true` obligatorio (se guarda la fecha). Hasta la auditoría, solo «Solo yo».
- Calendario general y página «Programar» (y paso «Publicar» de la ficha): filtro Todas / Instagram / TikTok. El estado de TikTok ya salía al lado del de Instagram en las tarjetas de «Programar».

### Lo que no se puede hacer con TikTok (y no está en Aify)
- **DMs automáticos por palabra clave**: no hay webhook de comentarios y la API de mensajes no funciona en el EEE.
- **Bandeja de DMs**: la Business Messaging API excluye el EEE, Suiza y Reino Unido.
- **Reglas de comentarios / leer y responder comentarios**: solo con TikTok API for Business.
- **Historias**: la API no las publica (y «Historias en secuencia» sigue siendo solo de Instagram).
- **Estudiar un vídeo publicado con IA**: la API no da el archivo del vídeo, solo portada y enlace. Se puede estudiar subiendo el archivo.
- **Alcance, retención, visitas al perfil y series diarias**: la API no los da; la evolución sale de la foto diaria de Aify y solo cuenta los vídeos públicos que devuelve `video/list`.

### Más adelante (a decidir)
- TikTok API for Business para comentarios y estadísticas diarias: exige que los clientes tengan cuenta Business y otra aprobación de TikTok.

## Lo que tiene que hacer Dylan en TikTok for Developers
1. Crear la cuenta de desarrollador y la app (nombre sin «TikTok»), web `https://www.useaify.app`, Términos y Privacidad.
2. Productos: Login Kit (redirect `https://aify-backend.onrender.com/api/tiktok/callback`), Content Posting API con Direct Post, Display API. Scopes de arriba.
3. Verificar el prefijo `https://aify-backend.onrender.com/api/tiktok/medios/` (archivo de verificación servido por el backend).
4. Webhook: `https://aify-backend.onrender.com/api/tiktok/webhook`.
5. Variables en Render: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`.
6. Probar en sandbox, grabar los vídeos de demo y mandar la revisión de la app y la auditoría de Direct Post (hasta entonces, todo se publica privado).
