# MCP de Aify

Con el MCP de Aify, Claude (Claude Code, Claude Desktop o claude.ai) usa Aify
con herramientas: ve los clientes, las ideas, el calendario, los guiones y las
métricas sin abrir el navegador.

- Código: `mcp/servidor.js` (lo monta `server.js` en `POST /mcp`).
- Transporte: Streamable HTTP sin estado (un servidor MCP por petición). `GET`
  y `DELETE /mcp` responden 405.
- Autenticación: clave de API de la organización (`Authorization: Bearer aify_...`),
  creada en Configuración → Tu IA → «Conecta tu Claude o tu ChatGPT». Tabla `claves_api`
  (migración `0046_claves_api.sql`). Sin clave, o con una revocada: 401.
- Cada herramienta solo ve datos de la organización de la clave. Nunca devuelve
  tokens de Instagram ni claves.

## Conectarlo

Desde el navegador (@Pictures), `/mcp` acepta CORS de la web de Aify y de
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
| `pedir_subida` | `cliente_id`, `nombre_archivo`, `tipo` (`video/mp4`/`image/jpeg`) | URL firmada de subida al bucket `publicaciones`, con la ruta `<organización>/<cliente>/<uuid>.<ext>` (la misma que usa el navegador). Caduca a las 2 h |
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
