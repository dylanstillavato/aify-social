# MCP de Aify

Con el MCP de Aify, Claude (Claude Code, Claude Desktop o claude.ai) usa Aify
con herramientas: ve los clientes, las ideas, el calendario, los guiones y las
métricas sin abrir el navegador. También lee y escribe las pizarras de Aify
Pictures («Mira mi pizarra»).

- Código: `mcp/servidor.js` (lo monta `server.js` en `POST /mcp`).
- Transporte: Streamable HTTP sin estado (un servidor MCP por petición). `GET`
  y `DELETE /mcp` responden 405.
- Autenticación: clave de API de la organización (`Authorization: Bearer aify_...`),
  creada en Configuración → Tu IA → «Conecta tu Claude o tu ChatGPT». Tabla `claves_api`
  (migración `0046_claves_api.sql`). Sin clave, o con una revocada: 401.
- Cada herramienta solo ve datos de la organización de la clave. Nunca devuelve
  tokens de Instagram ni claves.

## Conectarlo

Desde el navegador (Aify Pictures), `/mcp` acepta CORS de la web de Aify y de
`AIFY_PICTURES_ORIGINS` (por defecto `https://pictures.useaify.app`,
`http://localhost:5173` y `http://localhost:4173`); la clave sigue siendo obligatoria.

### Claude Code

```bash
claude mcp add --transport http aify https://aify-backend.onrender.com/mcp \
  --header "Authorization: Bearer <tu clave>"
```

Configuración enseña este comando ya con la URL del servidor (y con la clave
recién creada, mientras se ve).

### Claude Desktop / claude.ai

Ajustes → Conectores → Añadir conector personalizado, con la URL
`https://aify-backend.onrender.com/mcp` y la cabecera
`Authorization: Bearer <tu clave>`.

Si el conector no deja poner cabeceras, en Claude Desktop se puede usar
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) en
`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aify": {
      "command": "npx",
      "args": ["mcp-remote", "https://aify-backend.onrender.com/mcp", "--header", "Authorization: Bearer <tu clave>"]
    }
  }
}
```

### ChatGPT

Ajustes → Aplicaciones y conectores → Configuración avanzada → modo
desarrollador (depende del plan de ChatGPT). Después, en Conectores, crear uno
nuevo con la misma URL (`https://aify-backend.onrender.com/mcp`) y la misma
cabecera `Authorization: Bearer <tu clave>`. Configuración → Tu IA enseña estos
pasos con la URL del servidor.

## Herramientas de lectura

| Herramienta | Entrada | Devuelve |
| --- | --- | --- |
| `listar_clientes` | — | id, nombre, sector, redes activas y si está archivado |
| `ver_cliente` | `cliente_id` | perfil: descripción, audiencia, diferencial, tono, prohibido, temas, competidores… |
| `ver_calendario` | `cliente_id`, `mes` (`YYYY-MM`), `red?` (`instagram`/`tiktok`) | posts del mes (fecha, hora, red y `comparte_en`, formato, título, estado, aprobación, si tiene guion y su programación en Instagram y en TikTok) y los guiones del mes aún sin fecha. Con `red`, solo los de esa red |
| `listar_ideas` | `cliente_id`, `mes?` | ideas: título, concepto, formato, mes y si ya tienen guion |
| `ver_guion` | `post_id` | guion, copy, hashtags y notas del post |
| `ver_metricas` | `cliente_id` | cuenta de Instagram conectada y las métricas de cada reel a las 24 h (`instagram_reels_24h`); cuenta de TikTok conectada, su última foto diaria (`tiktok_metricas_dia`) y las métricas de cada vídeo a las 24 h (`tiktok_videos_24h`) |
| `ver_creador_tiktok` | `cliente_id` | lo que TikTok deja hacer ahora a la cuenta (`creator_info`): cuenta que publica, privacidades, interacciones desactivadas y duración máxima del vídeo |

Los errores vuelven en español y con `isError: true` (por ejemplo, «No hay
ningún cliente con ese id en tu organización»).

## Herramientas de escritura

Todas comprueban que el cliente o el post son de la organización de la clave.
No hay herramientas para borrar clientes ni posts.

| Herramienta | Entrada | Qué hace |
| --- | --- | --- |
| `crear_idea` | `cliente_id`, `titulo`, `concepto`, `formato` (`video`/`carrusel`), `mes?` | guarda una idea en la Lluvia de ideas del cliente |
| `crear_post` | `cliente_id`, `fecha` (`YYYY-MM-DD`), `hora` (`HH:MM`), `formato` (`video`/`reel`/`carrusel`/`historia`), `titulo`, `red?` (`instagram`/`tiktok`/`instagram_y_tiktok`, por defecto `instagram`), `guion?` | crea un post en el calendario, como «Nuevo post» en la web (los dos = red `instagram` + `comparte_en: ['tiktok']`). El guion puede ser un texto (una frase por línea) o el objeto de Aify (`gancho`, `contenido.frases`, `cierre`…) |
| `mover_post` | `post_id`, `fecha`, `hora` | cambia el día y la hora (y pone fecha a un guion sin programar). Si está programado en Instagram o en TikTok, lo reprograma a la nueva hora (hora de España). Lo que se está publicando o ya salió desde Aify (en cualquiera de las dos) no se mueve |
| `pedir_subida` | `cliente_id`, `nombre_archivo`, `tipo`, `destino?` (`publicacion`/`pizarra`, por defecto `publicacion`) | URL firmada de subida al bucket `publicaciones`. Sin `destino` (o `publicacion`): `video/mp4` o `image/jpeg`, ruta `<organización>/<cliente>/<uuid>.<ext>` (la misma que usa el navegador), igual que siempre. Con `destino: "pizarra"`: además `image/png`, `image/webp`, `video/quicktime`, `audio/webm`, `audio/mpeg` y `audio/mp4`, ruta `<organización>/<cliente>/pizarras/<uuid>.<ext>`, para `anadir_a_pizarra`. Caduca a las 2 h |
| `programar_publicacion` | `cliente_id`, `post_id`, `tipo` (`reel`/`post`/`carrusel`/`historia`), `rutas[]`, `caption`, `publicar_en` (ISO con zona), `compartir_en_feed?` | programa (o reprograma) la publicación con la misma función que el botón «Programar» de la web (`programarPublicacion` en `server.js`). Si sustituye archivos, borra los anteriores que ya no se usan. |
| `programar_tiktok` | `cliente_id`, `post_id`, `tipo` (`video`/`fotos`), `rutas[]`, `titulo`, `descripcion?`, `privacidad`, `permitir_comentarios?`, `permitir_duo?`, `permitir_stitch?`, `contenido_comercial?`, `marca_propia?`, `contenido_de_marca?`, `es_ia?`, `musica_auto?`, `consentimiento: true`, `publicar_en` | programa (o reprograma) en TikTok un post que sale en TikTok, con la misma función que la web (`programarPublicacionTikTok`). La privacidad la elige el usuario (sin valor por defecto) entre las de `ver_creador_tiktok`; las interacciones van desmarcadas salvo que las pida; `consentimiento` solo si aceptó las condiciones de TikTok (se guarda la fecha). Hasta la auditoría de TikTok, solo `SELF_ONLY`. Necesita TikTok conectado |
| `marcar_publicado` | `post_id` | marca como publicado un post que se subió a Instagram o a TikTok a mano. Lo programado desde Aify (en cualquiera de las dos) se marca solo al publicarse |

## Subir y programar un reel

1. `crear_post` (o `ver_calendario` para coger el `post_id` de uno que ya existe).
2. `pedir_subida` con `tipo: "video/mp4"` → devuelve `url_subida` y `ruta`.
3. Subir el archivo con un PUT a esa URL:

   ```bash
   curl -X PUT -H "Content-Type: video/mp4" --data-binary @"reel.mp4" "<url_subida>"
   ```

4. `programar_publicacion` con `tipo: "reel"`, `rutas: ["<ruta>"]`, el `caption` y
   `publicar_en` (por ejemplo `2026-11-05T18:30:00+01:00`). Si el archivo no se
   ha subido, la herramienta lo dice y no programa nada.

Desde ahí, el proceso de publicación de `server.js` lo publica a su hora igual
que lo programado desde la web.

## Pizarras (Aify Pictures)

Aify Pictures Studio sube la pizarra de un proyecto (notas, referencias,
flechas, notas de voz, kit de marca) y la IA del usuario la lee y deja ahí lo
que hace. Tabla `pizarras` (migración `0054_pizarras.sql`); la lógica está en
`mcp/pizarras.js` y la comparten las herramientas y las rutas REST. Sin la
migración, las herramientas responden «Las pizarras aún no están activadas en
Aify» (con `isError`) y las rutas, 503.

El `contenido` es el JSON de Studio: `{ nodos, flechas, apuntes }`, como mucho 1 MB.

- Nodo: `{ id, tipo, x, y, ancho, alto, datos }`. Tipos: `nota` (texto en
  `datos.texto`), `imagen`, `video`, `voz` (audio), `enlace` (URL en
  `datos.url`) y `kit` (kit de marca). Los archivos subidos a Aify llevan su
  ruta en `datos.ruta`.
- Flecha: `{ id, desde, hasta, texto? }` (ids de nodos).
- Apunte: `{ id, titulo, texto, actualizado }` (markdown).

Aify guarda tal cual lo que no conoce del contenido.

| Herramienta | Entrada | Qué hace |
| --- | --- | --- |
| `listar_pizarras` | `cliente_id` | las 50 pizarras más recientes del cliente: `pizarra_id`, título y fechas |
| `ver_pizarra` | `pizarra_id` | título, cliente, `actualizada_en` y contenido. Cada nodo con archivo trae `url`, una URL de lectura que caduca en 1 h. Solo se firman rutas de la carpeta `pizarras/` de su cliente |
| `guardar_pizarra` | `cliente_id`, `pizarra_id?`, `titulo`, `contenido` | sin `pizarra_id` crea una pizarra; con él la sustituye entera. Devuelve `{ pizarra_id, actualizada_en }` |
| `anadir_a_pizarra` | `pizarra_id`, `nodos[]` (máx. 20): `{ tipo: nota/imagen/video/audio, texto?, ruta?, cerca_de? }` | añade nodos sin borrar los que hay. Una nota lleva `texto`; imagen, vídeo y audio, la `ruta` de `pedir_subida` con destino `pizarra` (de esa organización y ese cliente). Con `cerca_de` (id de un nodo) el nuevo va a su derecha; si no, a la derecha de todo. Cada nodo nuevo lleva `id`, `autor: "claude"` y `creado_en`; el audio se guarda con el tipo `voz` de Studio. Devuelve los ids creados |

### «Mira mi pizarra»

1. En Aify Pictures, el usuario pulsa «Mira mi pizarra»: Studio guarda la
   pizarra en Aify y le da a su IA el `pizarra_id`.
2. La IA llama a `ver_pizarra`: lee las notas, sigue las flechas y abre las
   imágenes, los vídeos y los audios con su `url`.
3. Trabaja: escribe el guion o el copy, genera la imagen, monta el reel.
4. Para cada archivo, `pedir_subida` con `destino: "pizarra"` y un PUT a la
   `url_subida`:

   ```bash
   curl -X PUT -H "Content-Type: image/png" --data-binary @"portada.png" "<url_subida>"
   ```

5. `anadir_a_pizarra` con una nota por texto y un nodo por archivo (su `ruta`),
   con `cerca_de` el nodo al que responde. Studio los ve al volver a leer la
   pizarra.

### Desde Studio, sin MCP: `/api/pizarras`

Las mismas operaciones por REST, con la misma autenticación que `/mcp`
(`Authorization: Bearer aify_...`) y el mismo formato de respuesta. Aceptan
CORS de los mismos orígenes que `/mcp` (`AIFY_PICTURES_ORIGINS`). Errores:
`{ error }` con 400, 401, 404, 409, 413 o 503.

| Ruta | Cuerpo | Respuesta |
| --- | --- | --- |
| `GET /api/pizarras?cliente_id=<id>` | — | `{ cliente, pizarras: [{ pizarra_id, titulo, cliente_id, creada_en, actualizada_en }] }` |
| `POST /api/pizarras` | `{ cliente_id, titulo, contenido }` | `{ pizarra_id, actualizada_en, creada: true }` |
| `GET /api/pizarras/:id` | — | lo mismo que `ver_pizarra` |
| `PUT /api/pizarras/:id` | `{ titulo, contenido, actualizada_en? }` | `{ pizarra_id, actualizada_en, creada: false }`. Con `actualizada_en` (la de la última lectura), solo guarda si nadie ha cambiado la pizarra desde entonces; si la IA ha añadido algo, 409 y hay que volver a leerla |
| `POST /api/pizarras/:id/nodos` | `{ nodos }` | lo mismo que `anadir_a_pizarra` |
| `POST /api/pizarras/subidas` | `{ cliente_id, nombre_archivo, tipo }` | lo mismo que `pedir_subida` con destino `pizarra` |

Antes de guardar, Studio quita el campo `url` de los nodos (lo añade Aify al
leer y caduca). Ejemplo:

```js
const AIFY = 'https://aify-backend.onrender.com'
const cabeceras = { Authorization: `Bearer ${claveAify}`, 'Content-Type': 'application/json' }

// Leer (por ejemplo, cada pocos segundos mientras la IA trabaja)
const pizarra = await fetch(`${AIFY}/api/pizarras/${pizarraId}`, { headers: cabeceras }).then(r => r.json())

// Guardar sin pisar lo que haya añadido la IA
const nodos = pizarra.contenido.nodos.map(({ url, ...nodo }) => nodo)
const r = await fetch(`${AIFY}/api/pizarras/${pizarraId}`, {
  method: 'PUT',
  headers: cabeceras,
  body: JSON.stringify({ titulo: pizarra.titulo, contenido: { ...pizarra.contenido, nodos }, actualizada_en: pizarra.actualizada_en }),
})
if (r.status === 409) { /* volver a leer, mezclar y guardar otra vez */ }
```

Los archivos de las pizarras viven en el bucket `publicaciones`, bajo
`<organización>/<cliente>/pizarras/`. La limpieza del bucket de `server.js`
no borra los que usa alguna pizarra; los que no usa ninguna se borran a las 24 h,
como el resto.
