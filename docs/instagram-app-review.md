# Revisión de Meta (App Review): textos y screencasts

App: **Aify Client Insights** (Instagram API con inicio de sesión de Instagram).
Pide acceso avanzado a los cinco permisos en **una sola solicitud**
(App Review → Solicitudes de permisos). Antes: **verificación del negocio**
en el portfolio comercial y la app con política de privacidad, condiciones,
icono y categoría (ver docs/instagram-setup.md §2.6).

Cuenta para grabar: una cuenta de Instagram profesional con rol de **tester**
en la app, conectada a un cliente de Aify. Para los DMs hace falta una
segunda cuenta (la que comenta).

Los textos van en inglés: los revisores trabajan en inglés y lo agradecen.

---

## instagram_business_basic

**How will your app use this permission?**

> Aify is a content-planning tool for social media agencies. Each agency connects the Instagram professional account of each of its clients. We use instagram_business_basic to read the connected account's profile (username, account type, follower count, profile picture) and its list of media (id, caption, media type, permalink, timestamp, thumbnail). We show this in the client's "Seguimiento" (tracking) step, match published media with the posts planned in the agency's content calendar, and let the agency choose a specific reel when it sets up an automatic reply rule. We never post or share this data outside the agency's own workspace.

**Screencast:** iniciar sesión en Aify → abrir un cliente → paso Seguimiento →
"Conectar Instagram" → autorizar en instagram.com → volver a Aify y enseñar el
perfil (@usuario, seguidores) y la lista de publicaciones.

## instagram_business_manage_insights

**How will your app use this permission?**

> We read account insights for the last 30 days (reach, views, accounts engaged, total interactions, likes, comments, saves, shares) and per-media insights for the current month's posts. The agency sees them in the client's "Seguimiento" step to report results to its client and to decide what content to plan next month. Data is cached for at most one hour and deleted when the account is disconnected.

**Screencast:** con la cuenta ya conectada, paso Seguimiento → enseñar los KPI
de 30 días y la tabla de publicaciones del mes → pulsar "Actualizar".

## instagram_business_manage_comments

**How will your app use this permission?**

> Agencies create "keyword reply" rules: a reel's call to action says "comment GUIDE and we'll send it to you by DM". We subscribe the connected account to the comments webhook, and when a new comment on the account's media contains the rule's keyword we (1) send a private reply to that comment (see instagram_business_manage_messages) and (2) optionally post one short public reply to the comment, e.g. "Sent to your DMs!". We only act on comments that match a rule the agency created; other comments are ignored and not stored.

**Screencast:** paso Seguimiento → "DMs automáticos" → "Nueva regla" →
palabra clave GUIA, mensaje con un enlace, respuesta pública "¡Te lo he
mandado por DM!" → guardar. Desde la segunda cuenta, comentar "guía" en un
reel de la cuenta conectada → enseñar la respuesta pública en el comentario
→ volver a Aify y enseñar el registro "Últimos comentarios" con estado
"Enviado".

## instagram_business_manage_messages

**How will your app use this permission?**

> Aify is a CRM for social media managers who run several clients' Instagram accounts. We use this permission for three things:
> 1. Unified inbox: we receive the connected account's messages through the messages webhook (and read recent conversations with GET /me/conversations when the agency presses "Sync"), and show them in one inbox with every client's DMs, so the agency can answer them without switching accounts. Messages are only visible to the members of the agency that connected the account, and are deleted when the account is disconnected or the client is deleted.
> 2. Human replies: a team member writes the reply in Aify (optionally starting from an AI-suggested draft they review and edit) and we send it with POST /<IG_ID>/messages, only within the 24-hour window after the person's last message.
> 3. Keyword replies: when a person comments a rule's keyword (private reply with recipient.comment_id, within 7 days) or sends it by DM, we send the rule's message once (typically a link to the resource promised in the reel). We never message the same person twice for the same rule and never start conversations.

**Screencast:** continuación del anterior → abrir los mensajes de la segunda
cuenta en Instagram y enseñar el DM recibido con el texto de la regla →
desde la segunda cuenta, escribir un DM a la cuenta conectada → en Aify,
abrir **Bandeja de DMs**, enseñar el mensaje recibido (con el cliente al que
pertenece), pulsar "Sugerir con IA", editar el texto y **Enviar** → enseñar la
respuesta recibida en Instagram.

## instagram_business_content_publish

**How will your app use this permission?**

> Agencies plan their clients' content in Aify's calendar. From a calendar post, the agency uploads the final image(s) or video and schedules it: Aify stores the files privately, and at the scheduled time creates the media container (image, carousel, reel or story), waits until its status is FINISHED and calls media_publish on the connected account. We check content_publishing_limit before publishing. The agency always chooses the content, the caption and the time; nothing is published automatically without that explicit action.

**Screencast:** abrir el calendario de un cliente → un post de Instagram →
"Programar publicación" → tipo Reel → subir un vídeo → texto → hora dentro de
2 minutos → "Programar" → enseñar "Se publicará el…" → esperar → enseñar
"Publicado" con "Ver en Instagram" y abrir el reel publicado.

---

## Instrucciones para el revisor (campo "Notes for reviewer")

> Test login: [usuario y contraseña de una cuenta de Aify de prueba]. The test Aify account already has a client with a tester Instagram account connected. To test keyword replies, comment "guia" on any reel of @[cuenta] from any account; you'll receive the DM within a few seconds. To test publishing, open Calendario → any Instagram post → "Programar publicación".

Crea una cuenta de Aify de prueba solo para la revisión (no uses la tuya) y
pon aquí sus datos al enviar la solicitud.
