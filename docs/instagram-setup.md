# Instagram: puesta en marcha de las métricas reales (Fase 8 · Seguimiento)

Esta guía explica qué hay que hacer fuera del código para que el paso
"Seguimiento" de cada cliente muestre métricas reales de Instagram. Mientras
no esté hecho, la app muestra "La conexión con Instagram todavía no está
configurada" y no ofrece el botón de conectar.

## 1. Qué flujo usa Aify y por qué

Aify usa **Instagram API with Instagram Login** (también llamado "Business
Login for Instagram"), con la API en `graph.instagram.com`.

Permisos que pide:

- `instagram_business_basic`: perfil, seguidores y lista de publicaciones.
- `instagram_business_manage_insights`: estadísticas de la cuenta y de cada publicación.

Por qué este flujo y no el antiguo de Facebook Login
(`instagram_basic` + `instagram_manage_insights` + `pages_show_list` +
`pages_read_engagement`):

- El cliente de una agencia (una peluquería, un restaurante) inicia sesión con
  su usuario de Instagram. No necesita una página de Facebook ni vincularla a
  Instagram, que es donde más se atasca la gente.
- Hacen falta solo dos permisos, así que la revisión de Meta es más sencilla.
- Es el flujo que Meta recomienda hoy para apps nuevas.

Lo que sigue haciendo falta: la cuenta de Instagram del cliente tiene que ser
**profesional** (Empresa o Creador). Con una cuenta personal Meta no da estadísticas.

## 2. Crear la app en Meta for Developers

1. Entra en https://developers.facebook.com/apps con la cuenta de Meta del
   negocio (la que será administradora de la app) y pulsa **Crear app**.
2. Caso de uso: elige el de Instagram ("Gestionar mensajes y contenido en
   Instagram"). Si el asistente pide tipo de app, elige **Empresa (Business)**.
   Conecta el portfolio comercial (Business Manager) de Aify si lo pide.
3. Dentro de la app, abre **Instagram → Configuración de la API con inicio de sesión de Instagram**
   ("API setup with Instagram login").
4. En esa página verás el **Instagram App ID** y el **Instagram App Secret**.
   Ojo: son distintos del ID de la app de Meta que aparece arriba del todo.
   Son los que van en `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET`.
5. En la sección **Configurar el inicio de sesión para empresas de Instagram**
   ("Set up Instagram business login") → **Configuración de la app de empresa**, rellena:

   | Campo en Meta | Valor para producción |
   |---|---|
   | URI de redirección de OAuth válidos | `https://aify-backend.onrender.com/api/instagram/callback` |
   | URL de devolución de llamada para cancelar la autorización (Deauthorize) | `https://aify-backend.onrender.com/api/instagram/desautorizar` |
   | URL de solicitud de eliminación de datos (Data deletion) | `https://aify-backend.onrender.com/api/instagram/eliminar-datos` |

   Si quieres probar en local, añade también
   `http://localhost:3011/api/instagram/callback` como URI de redirección
   (si Meta exige https en local, pruébalo directamente en producción).

   La URI de redirección tiene que coincidir **carácter por carácter** con
   `INSTAGRAM_REDIRECT_URI` (sin barra final).

6. En **Configuración de la app → Básica** rellena la URL de la política de
   privacidad (`https://www.useaify.app/privacidad`), la de condiciones
   (`https://www.useaify.app/terminos`), el icono y la categoría. Son
   obligatorios para pasar la app a modo Live y para la revisión.
   En **Dominios de la app** añade `useaify.app`.

El usuario nunca sale de `https://www.useaify.app`, salvo para autorizar en
instagram.com. Al terminar, el backend lo devuelve a
`https://www.useaify.app/clientes/<id>?instagram=conectado` (o `=error`).

## 3. Variables de entorno

### Render (backend, servicio aify-backend)

| Variable | Valor |
|---|---|
| `INSTAGRAM_APP_ID` | Instagram App ID del paso 2.4 |
| `INSTAGRAM_APP_SECRET` | Instagram App Secret del paso 2.4 (secreto: solo en Render) |
| `INSTAGRAM_REDIRECT_URI` | `https://aify-backend.onrender.com/api/instagram/callback` |
| `INSTAGRAM_GRAPH_VERSION` | Opcional. Por defecto `v23.0` |

Estas variables tienen que estar ya puestas (se reutilizan):

- `GOOGLE_FRONTEND_URL`: el primer valor tiene que ser `https://www.useaify.app`,
  porque es adonde vuelve el usuario tras conectar.
- `SUPABASE_SERVICE_ROLE_KEY`: sin ella no se pueden guardar los tokens y la
  app muestra "no configurada".

### Vercel (frontend)

No hace falta ninguna variable nueva. Basta con la que ya existe,
`VITE_API_URL=https://aify-backend.onrender.com`. El secreto de Instagram no
va nunca en Vercel.

## 4. Base de datos

Ejecuta `supabase/migrations/0027_instagram.sql` en Supabase → SQL Editor.
Se puede ejecutar más de una vez sin problema. Crea:

- `instagram_conexiones`: estado de la conexión de cada cliente. El equipo la puede leer; el navegador no puede escribirla.
- `instagram_tokens`: los tokens. RLS sin policies y sin permisos para
  `anon`/`authenticated`: solo el backend (service role) puede leerlos.
- `instagram_metricas_cache`: la última lectura de métricas de cada cliente, para no llamar a Meta en cada visita.

## 5. Modo desarrollo, testers y revisión de Meta

Mientras la app no pase la **revisión de Meta (App Review)** con **acceso
avanzado** a los dos permisos, solo pueden conectarse cuentas de Instagram que
tengan un rol en la app:

1. En la app de Meta: **Roles de la app → Roles → Añadir personas → Tester de
   Instagram** e introduce el usuario de Instagram.
2. Desde esa cuenta de Instagram (web): **Configuración → Apps y sitios web →
   Invitaciones de tester** y acepta la invitación.

Con eso se puede probar con tu cuenta y con las de los clientes de cortesía.
Una cuenta sin ese rol recibirá un error de Instagram al intentar conectar.

Para abrirlo a cualquier cliente:

1. **Verificación del negocio** (Business Verification) en el portfolio
   comercial de Aify: la exige Meta para dar acceso avanzado.
2. **Revisión de la app**: pide acceso avanzado para
   `instagram_business_basic` e `instagram_business_manage_insights`. Para cada
   permiso Meta pide explicar cómo se usa y un **vídeo (screencast)** del flujo
   completo: iniciar sesión en Aify, abrir un cliente, paso Seguimiento, pulsar
   "Conectar Instagram", autorizar y ver las métricas. Usa una cuenta tester.
3. Pasa la app a modo **Live** (publicada).

Suele tardar de unos días a un par de semanas y es habitual que Meta pida cambios.

## 6. Cómo funciona una vez configurado

- **Conectar**: en el paso Seguimiento de un cliente, "Conectar Instagram" →
  el cliente autoriza en instagram.com → vuelve a Aify. El backend guarda un
  token de 60 días y lo renueva solo cuando le quedan menos de 15 días y se
  consultan métricas. Si un cliente pasa más de 60 días sin consultar
  métricas, el token caduca y la app pide reconectar.
- **Métricas de cuenta (últimos 30 días)**: seguidores, alcance,
  visualizaciones, interacciones totales, cuentas que interactuaron, me gusta,
  comentarios, guardados y compartidos.
- **Publicaciones**: las del mes en curso con alcance, visualizaciones, me
  gusta, comentarios, guardados y compartidos. Se cruzan por fecha con los
  posts de Instagram del calendario del cliente. Si este mes aún no hay
  publicaciones, se muestran las más recientes.
- **Caché**: se pide a Meta como mucho una vez por hora por cliente. El botón
  "Actualizar" fuerza una lectura nueva, como mucho cada 5 minutos.
- **Desconectar**: el botón "Desconectar" borra el token, la conexión y la
  caché del cliente. Lo mismo ocurre si el usuario quita el acceso a Aify
  desde Instagram (callbacks de desautorizar y eliminar datos).

Límites conocidos de la API de Meta:

- Las estadísticas de publicaciones anteriores a que la cuenta fuera
  profesional no están disponibles. Se muestran como "—".
- Meta retiró `impressions` y `plays`. Aify usa `views` (visualizaciones), su sustituto actual.
- Las historias no aparecen en la lista de publicaciones: la API solo las
  devuelve durante las 24 h en que están activas.

---

# Instagram, segunda parte: DMs automáticos y publicar desde el calendario

Dos funciones nuevas sobre la misma conexión (mismo login, mismo token, mismo
plan: Pro, Agency y cortesía):

- **DMs automáticos por palabra clave** (paso Seguimiento → "DMs automáticos"):
  "Comenta GUIA y te lo mando por DM". Sustituye a ManyChat para este caso.
- **Publicar en Instagram** (calendario → post → "Publicar en Instagram"):
  posts, carruseles, reels e historias, programados a una hora.

## 1. Permisos nuevos

El botón "Conectar Instagram" ahora pide también:

| Permiso | Para qué |
|---|---|
| `instagram_business_manage_comments` | Recibir los comentarios por webhook y responder en público |
| `instagram_business_manage_messages` | Mandar el DM (respuesta privada al comentario) |
| `instagram_business_content_publish` | Publicar desde el calendario |

Las cuentas conectadas antes **tienen que volver a conectar** (la app lo avisa:
guarda los permisos concedidos en `instagram_conexiones.permisos`).

En la app de Meta, en **Instagram → Configuración de la API con inicio de
sesión de Instagram**, comprueba que estos permisos aparecen añadidos.

## 2. Webhook (solo para los DMs)

En la app de Meta → **Instagram → Configuración de la API… → 2. Configurar webhooks**:

| Campo | Valor |
|---|---|
| URL de devolución de llamada | `https://aify-backend.onrender.com/api/instagram/webhook` |
| Token de verificación | el mismo valor que `META_WEBHOOK_VERIFY_TOKEN` en Render |

Pulsa **Verificar y guardar** y suscríbete a los campos **comments** y
**messages** (este último alimenta la **Bandeja de DMs**, `/instagram/bandeja`,
y las reglas que saltan por DM; tablas en `0039_instagram_bandeja_dms.sql`).
Cada cuenta se suscribe sola al conectarla o al crear la primera regla
(`POST /me/subscribed_apps`). Mientras no lleguen webhooks, el botón
**Sincronizar** de la bandeja trae las conversaciones recientes con
`GET /me/conversations`.

**Importante:** Meta solo manda webhooks si la app está en modo **Live**, con
**acceso avanzado** a `instagram_business_manage_comments` y el negocio
**verificado**. Hasta pasar la revisión, los DMs automáticos no se disparan
(publicar sí funciona con cuentas tester). La cuenta tiene que ser pública.

Límites de Meta: **un solo mensaje por comentario**, en los **7 días**
siguientes al comentario. Si la persona contesta, se abre una ventana de 24 h
(eso todavía no lo automatiza Aify). Aify no manda dos veces el mismo DM a la
misma persona por la misma regla.

## 3. Variables de entorno nuevas (Render)

| Variable | Valor |
|---|---|
| `META_WEBHOOK_VERIFY_TOKEN` | Una cadena larga aleatoria inventada por ti (la misma que pones en Meta) |
| `INSTAGRAM_CRON_SECRET` | Otra cadena aleatoria, para el cron de publicar (punto 5) |
| `META_APP_SECRET` | Opcional. Solo si Meta firma los webhooks con el secreto de la app de Meta en vez del de Instagram (si el webhook responde 401 en los logs, ponlo) |

## 4. Base de datos

Ejecuta `supabase/migrations/0036_instagram_dm_publicar.sql` en Supabase →
SQL Editor (idempotente). Crea `instagram_dm_reglas`, `instagram_dm_envios`,
`instagram_publicaciones`, la columna `instagram_conexiones.permisos` y el
bucket privado `publicaciones`.

Tamaño de los vídeos: el plan gratuito de Supabase limita cada archivo a
**50 MB**. Para reels más pesados sube el límite en Supabase → Storage →
Settings (plan Pro).

## 5. Publicar a la hora: el servidor tiene que estar despierto

La API de Instagram no programa: Aify guarda la hora y un proceso del
servidor revisa cada minuto qué toca publicar. **El plan free de Render
duerme el servicio tras 15 min sin tráfico**, y dormido no publica.

**Opción montada (recomendada): pg_cron en Supabase.** La migración
`0037_instagram_cron_publicar.sql` programa una llamada cada minuto al
`/tick` desde el propio Supabase. El secreto va en Supabase Vault (nombre
`instagram_cron_secret`), no en el repo; las instrucciones están en la
cabecera de la migración.

Alternativas:

- Pasar `aify-backend` a un plan de pago de Render (siempre encendido), o
- un cron externo gratuito (p. ej. cron-job.org) que cada minuto haga
  `POST https://aify-backend.onrender.com/api/instagram/publicar/tick` con la
  cabecera `x-cron-secret: <INSTAGRAM_CRON_SECRET>`.

Los webhooks de los DMs despiertan al servidor solos (Meta reintenta si tarda).

Cómo se publica: Aify crea el contenedor en Meta con una URL firmada del
archivo (24 h) → espera a que Meta lo procese (`status_code = FINISHED`,
hasta 30 min) → `media_publish`. Al publicarse, el post del calendario pasa a
"publicado" y guarda el enlace. Antes consulta `content_publishing_limit`
(100 publicaciones por cuenta en 24 h); si está lleno, lo reintenta en 30 min.

Lo que la API no permite (igual que Metricool): música de la biblioteca de
Instagram, stickers en historias (enlace, encuesta, menciones), etiquetar
productos. Imágenes solo en JPEG (el navegador las convierte antes de subir).

## 6. Revisión de Meta

Textos por permiso y guion de cada screencast: `docs/instagram-app-review.md`.

Pide en la **misma revisión** el acceso avanzado a los cinco permisos
(`instagram_business_basic`, `instagram_business_manage_insights`,
`instagram_business_manage_comments`, `instagram_business_manage_messages`,
`instagram_business_content_publish`). Un screencast por permiso:

- comments + messages: crear una regla en Seguimiento, comentar la palabra
  desde otra cuenta y enseñar el DM recibido y el registro en Aify.
- content_publish: subir un reel en un post del calendario, programarlo y
  enseñarlo publicado en Instagram.
