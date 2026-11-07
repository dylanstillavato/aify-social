# @Gen: plan (2026-10-31)

El porqué de cada decisión está en [estudio.md](estudio.md).

## Decisión

- **Desde cero, sin fork.** Ninguna base abierta va en el navegador con varias claves propias y sin servidor propio (estudio, sección 3). @Gen es una app web nueva con la misma pila que `aify-pictures-web` (Vite + React, español, tema Aify, PWA). Se toman ideas y piezas MIT/Apache:
  - de [video-starter-kit](https://github.com/fal-ai-community/video-starter-kit): la clave en `localStorage` y la cola de fal;
  - de [OpenStudio](https://github.com/clawnify/OpenStudio): el «subject lock» y el coste por generación;
  - de [ComfyUI](https://github.com/Comfy-Org/ComfyUI): el motor local opcional.
- **Licencia:** AGPL-3.0, como `aify-social`. Lo que se tome de código MIT o Apache conserva su aviso en NOTICE.
- **Proveedores, por orden:**
  1. **Google** (Nano Banana + Gemini Omni Flash): imagen y vídeo con una sola clave, CORS directo, y muchas organizaciones ya la tienen puesta en @Social.
  2. **fal**: el catálogo más amplio (Kling, Seedance, FLUX, MiniMax…) con una clave, y CORS directo.
  3. **OpenAI** (`gpt-image-2`): imagen con texto bien escrito, CORS directo.
  4. **Luma** (Uni + Ray 3.2): con reencuadre de vídeo por API, CORS directo en la API nueva.
  5. Después, por el proxy: **Runway** (también revende Kling y Veo), **Replicate** y **Kling** oficial (su documentación no se ha podido verificar).
- **Claves: en el navegador por defecto y, si el usuario quiere, cifradas en Aify.**
  - **Navegador** (`localStorage`, como `src/lib/ia.js` de @Pictures): la clave solo sale hacia la API del proveedor. Es lo que se usa para Google, fal, OpenAI y Luma.
  - **«Guardar en Aify»** (opcional): cifrada con `AI_KEYS_SECRET` (AES-256-GCM) en `organizaciones_claves_ia`, como ya hace @Social con Gemini y Claude. Hace falta para dos cosas:
    - que «Tu IA» pueda encargar generaciones por MCP con la pestaña cerrada;
    - no tener que mandar la clave en cada petición a los proveedores que van por proxy.
  - **Proxy** para Replicate, Runway y Kling, que no admiten CORS. Es una ruta de paso en `aify-social`, sin estado:
    - no guarda la clave, ni la escribe en los logs ni en la URL;
    - solo deja llegar a una lista cerrada de hosts;
    - solo atiende a usuarios de Aify (sesión o clave `aify_`), para no ser un proxy abierto.
  - **Aify nunca pone una clave suya ni paga una generación.** Sin clave del usuario, @Gen no genera: dice qué clave falta y dónde se saca.
- **Precio a la vista:** antes de cada generación se enseña el coste estimado con el precio de lista del proveedor (tabla con la fuente enlazada y su fecha). Es la respuesta a lo que más frustra de Higgsfield.

## Arquitectura

| Pieza | Repo | Qué es |
|---|---|---|
| App | `dylanstillavato/aify-gen-web` (nuevo) | Landing en `/` y app en `/app/`, en Vercel, con el dominio `gen.useaify.app`. Todo pasa en el navegador: claves, cola de generaciones, galería (IndexedDB), plantillas, personajes y productos |
| Proveedores | `aify-gen-web/src/proveedores/` | Un adaptador por proveedor con la misma interfaz: `generar({ tipo, prompt, referencias, formato, duracion, modelo })` → `{ id }`, más `estado(id)` y `resultado(id)` → archivos. El catálogo de modelos y los precios van en JSON, no en el código |
| Proxy | `aify-social` (`server.js`) | `POST /api/gen/proxy/:proveedor/*`: reenvía al host permitido con la clave del usuario (de la cabecera o, si la guardó, de `organizaciones_claves_ia`). CORS para `gen.useaify.app`, con el mismo saneado que `AIFY_PICTURES_ORIGINS` |
| Claves en Aify | `aify-social` | `organizaciones_claves_ia` con más proveedores (migración nueva). `/api/ia/clave` los acepta |
| Tu IA | `aify-social` (MCP) | Herramientas `gen_modelos`, `gen_generar`, `gen_estado` y `gen_plantillas`, y una tabla `generaciones`. Con la clave guardada en Aify, el servidor genera, sondea y deja el archivo en el bucket. Si no, la orden la recoge la pestaña de @Gen abierta por Supabase Realtime (mismo patrón que `film_*` en @Film) |
| Salidas | familia | Pizarra de Studio (`pedir_subida` con destino `pizarra` + `anadir_a_pizarra`, o `/api/pizarras`), editor de @Pictures, timeline de @Film (`BroadcastChannel`) y @Social (`pedir_subida` + `programar_publicacion` / `programar_tiktok`) |
| Motor local (opcional) | el ComfyUI del usuario | `http://127.0.0.1:8188` arrancado con `--enable-cors-header https://gen.useaify.app`. Ejecuta plantillas de [workflow_templates](https://github.com/Comfy-Org/workflow_templates) (MIT) |

## Encargos

Cada uno tiene el tamaño de una noche. Los marcados con **(yo)** los hace Claude Code en sesión, porque crean repos o tocan Vercel o Supabase.

### Fase 0: preparar
0. **(yo) Repo y web.**
   - Repo `aify-gen-web` con la estructura de `aify-pictures-web` (sin su Studio).
   - Proyecto de Vercel y dominio `gen.useaify.app`.
   - Añadir `https://gen.useaify.app` a `AIFY_PICTURES_ORIGINS` en Render.

### Fase 1: generar con tu clave, en el navegador
1. **Esqueleto de @Gen.**
   - **Qué:** landing en `/` y app en `/app/`, en español, con el tema oscuro de la familia, el icono de @Gen y una PWA instalable. Pantallas vacías: Generar, Plantillas, Personajes, Galería y Tu IA.
   - **Dónde:** `aify-gen-web`.
   - **Cómo:** copiar la base (Vite, tema y PWA) de `aify-pictures-web`.
   - **Hecho cuando:** `npm run build` pasa y `/app/` abre en Chrome y en Safari.
   - **No tocar:** nada de Studio ni del editor de @Pictures.
2. **Tu IA: claves por proveedor.**
   - **Qué:** una tarjeta por proveedor (Google, fal, OpenAI, Luma) con «Pegar clave», «Probar» (una llamada barata o de listado) y «Quitar», el enlace a la página donde se saca la clave y los últimos 4 caracteres a la vista.
   - **Dónde:** `src/lib/claves.js` y `src/pantallas/TuIA.jsx`.
   - **Cómo:** mismo estilo que `src/lib/ia.js` de @Pictures (prefijo `aify-gen:` en `localStorage` y evento al cambiar).
   - **Hecho cuando:** con una clave falsa, «Probar» dice el error del proveedor en español. La clave nunca aparece en la consola, en una URL ni en una petición a otro host.
   - **No tocar:** nada de servidor.
3. **Adaptadores de imagen: Google, OpenAI y fal.**
   - **Qué:** `generar` y `resultado` para Nano Banana 2 y Pro (`gemini-3.1-flash-image`, `gemini-3-pro-image`), `gpt-image-2` (`dangerouslyAllowBrowser`) y fal (cola `queue.fal.run`). Más `catalogo.json` con modelos, formatos, si admiten referencias y precio con fuente y fecha.
   - **Dónde:** `src/proveedores/{google,openai,fal}.js` y `src/proveedores/catalogo.json`.
   - **Hecho cuando:** los tests, con `fetch` simulado, cubren el éxito, la clave mala y la moderación (`moderation_blocked` y equivalentes). Hay una prueba manual con una clave real por proveedor.
   - **No tocar:** Imagen ni `gpt-image-1`, que están apagados.
4. **Pantalla Generar imagen.**
   - **Qué:**
     - prompt, formato (9:16, 4:5, 1:1, 16:9), de 1 a 4 variantes y hasta 4 imágenes de referencia;
     - selector de modelo, con solo los que tienen clave;
     - **coste estimado antes de pulsar**;
     - resultados en la galería (IndexedDB) con prompt, modelo, coste y fecha.
   - **Hecho cuando:** se genera una portada 4:5 con Nano Banana 2 y se ve en la galería tras recargar.
5. **Vídeo: Gemini Omni Flash, fal y Luma.**
   - **Qué:** texto a vídeo, imagen a vídeo, primer y último fotograma, y duración y resolución según el modelo. Una cola visible que sigue sondeando aunque se recargue la página (los ids se guardan en IndexedDB).
   - **Dónde:** `src/proveedores/{google,fal,luma}.js` (Luma con la API nueva `agents.lumalabs.ai/v1`) y `src/pantallas/Generar.jsx`.
   - **Hecho cuando:** un vídeo 9:16 de 5 s con Omni Flash y otro con Kling v3 por fal acaban en la galería, y se pueden descargar en MP4.
   - **No tocar:** Veo 3.1 preview ni Sora, que están apagados.
6. **Medir descargas y CORS de las salidas.**
   - **Qué:** comprobar que los archivos que devuelve cada proveedor (URLs de fal y Luma, base64 o URI de Google) se pueden leer desde `gen.useaify.app` para guardarlos y subirlos a Aify.
   - **Hecho cuando:** hay un informe en `docs/medidas.md` con una fila por proveedor. Si alguna URL no admite CORS, ese proveedor pasa al proxy del encargo 7.

### Fase 2: proxy y más proveedores
7. **Proxy `/api/gen/proxy` en aify-social.**
   - **Qué:**
     - ruta de paso con una lista cerrada de hosts (`api.replicate.com`, `api.dev.runwayml.com`, `api-singapore.klingai.com` y los de descarga que salgan del encargo 6);
     - pide sesión o clave `aify_`, con el mismo límite de uso que el resto de rutas;
     - tope de tamaño;
     - no guarda la clave del proveedor ni la escribe en los logs.
   - **Dónde:** `server.js` y `docs/gen-proxy.md`.
   - **Hecho cuando:** un test comprueba que un host fuera de la lista da 400, que sin auth da 401 y que la clave no aparece en ningún `console.*`.
   - **No tocar:** `programarPublicacion` ni el MCP.
8. **Adaptadores de Runway, Replicate y Kling por el proxy.**
   - **Qué:** Runway (`gen4.5`, `gen4_image` y sus modelos de terceros), Replicate (modelos con precio fijo de la [página de precios](https://replicate.com/pricing)) y Kling oficial.
   - **Cómo:** antes de escribir el de Kling, leer su documentación oficial con navegador (el estudio no pudo leerla). Si su firma JWT con access key y secret key se confirma, se firma en el proxy.
   - **Hecho cuando:** una generación de cada uno llega a la galería.

### Fase 3: plantillas, personajes y producto
9. **Plantillas propias.**
   - **Qué:** un formato JSON propio (prompt con huecos `{producto}`, `{persona}`, `{lugar}`, formato, tipo, huecos de referencia y modelos recomendados) y 12 plantillas originales para gestores de redes: producto en escena, producto en la mano, UGC hablando a cámara, antes y después, plato que humea, portada de reel, etc. Los movimientos de cámara (travelling, órbita, grúa, zoom lento…) van como fragmentos de prompt. Se usan los parámetros nativos solo donde el proveedor los documente.
   - **No tocar:** nada de Higgsfield (nombres, textos, miniaturas ni orden de su biblioteca).
10. **Personajes y productos.**
    - **Qué:** una biblioteca de referencias (de 3 a 8 fotos + rasgos escritos) que se manda como referencia a los modelos que la admiten (Nano Banana, Omni Flash `reference_to_video`, Uni de Luma y Runway).
    - **Personas:** la casilla «Tengo permiso de esta persona» es obligatoria. Aviso cuando el proveedor tenga límites (Omni Flash en la EEE con menores o vídeo subido).
    - **Hecho cuando:** 4 imágenes con el mismo producto en 4 escenas mantienen la etiqueta y la forma.
11. **Reencuadre y escalado.**
    - **Qué:** «Pasar a 9:16» con el reencuadre de Luma (`ray-3.2`) y escalado con los modelos de upscale del catálogo de fal que se comprueben en ese momento.
    - **Hecho cuando:** un vídeo 16:9 sale en 9:16 y el coste estimado coincide con lo que cobra el proveedor.

### Fase 4: la familia y Tu IA
12. **Enviar a la familia.**
    - **Qué:** en cada resultado, cuatro botones:
      - «A la pizarra»: `POST /api/pizarras/subidas` + PUT + `POST /api/pizarras/:id/nodos`;
      - «Abrir en @Pictures»;
      - «Llevar a @Film»: `BroadcastChannel`, cuando exista su encargo 13;
      - «Programar en @Social»: elegir cliente y hora, y luego `pedir_subida` + `programar_publicacion`.
    - **Cómo:** con la clave `aify_` del usuario, como hace Studio.
    - **Hecho cuando:** una imagen generada aparece en la pizarra al lado de la nota que la pidió, y un reel queda programado.
13. **(yo) Claves de @Gen guardadas en Aify.**
    - **Qué:**
      - migración nueva (siguiente número libre) que amplía `organizaciones_claves_ia.proveedor` a `openai`, `fal`, `luma`, `replicate`, `runway` y `kling`;
      - `/api/ia/clave` los acepta;
      - en @Gen, el botón «Guardar en Aify» con aviso de qué implica.
    - **Cómo:** igual que la 0053: idempotente y sin RLS para `anon`/`authenticated`.
    - **No tocar:** las claves `gemini` y `anthropic` que ya hay.
14. **MCP `gen_*`.**
    - **Qué:**
      - una tabla `generaciones` (migración);
      - las herramientas `gen_modelos` (los modelos con clave de la organización y su precio), `gen_plantillas`, `gen_generar` (`cliente_id`, `tipo`, `prompt`, `modelo?`, `plantilla?`, `referencias[]` como rutas de pizarra, `formato`, `pizarra_id?`, `cerca_de?`) y `gen_estado`;
      - con la clave guardada, el servidor genera, sondea, sube el resultado a `pizarras/` y lo añade a la pizarra; sin ella, la orden espera a la pestaña de @Gen (Realtime).
    - **Dónde:** `mcp/`, `server.js` y `docs/mcp.md`.
    - **Hecho cuando:** desde claude.ai con el conector, «hazme 3 portadas 4:5 para el reel de mañana con el kit de marca» deja 3 imágenes en la pizarra, cobradas a la clave del usuario.
    - **No tocar:** las herramientas que ya existen.
15. **«Pídeselo a la IA» en @Gen.**
    - **Qué:** un chat con la clave de Claude del usuario (como Studio) que escribe prompts a partir del kit de marca y de la pizarra, y lanza generaciones con los adaptadores del navegador.

### Más adelante
- **Motor local ComfyUI.** Conectar con el ComfyUI del usuario y ejecutar plantillas de `workflow_templates`. Primero hay que medir si Chrome y Safari dejan a `https://gen.useaify.app` llamar a `127.0.0.1` (Private Network Access).
- **Revisión mensual del catálogo.** Encargo fijo del turno de noche: comprobar modelos retirados y precios contra sus páginas. En dos meses se han apagado Imagen, Veo 3.1 preview, Sora 2 y `gpt-image-1`.

## Marca
- **Logo:** «@Gen» con la @ de Aify (`resources/aify/logos/v4/`).
- **Icono:** teja de 512 px con `rx=112` (como las de `v2/`), la «G» blanca en Super Jello y el punto lima `#D7FF3D`.
- **Color de la teja: naranja brasa `#E8431F`.**
  - Es el único color cálido de la familia: lima (@Social), azul (@Pictures) y violeta (@Film) son fríos o ácidos. En la fila de iconos, @Gen no se confunde con nadie.
  - Se lee como chispa y fuego: «crear de la nada», que es lo que hace la app.
  - Contraste (WCAG): la «G» blanca, 4,0:1; el punto lima sobre la teja, 3,5:1. Los dos pasan el 3:1 de los elementos gráficos y del texto grande.
  - Se aleja del rosa de FARKY (`#EC5EA1`) y del rojo de error de las interfaces.

## Relacionado
- [estudio.md](estudio.md)
- [Plan de @Film](../aify-film/plan.md)
- `docs/mcp.md`
- Issue #9
