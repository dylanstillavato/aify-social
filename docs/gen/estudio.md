# @Gen: estudio (2026-10-31)

@Gen es la app de la familia Aify (@Social, @Pictures, @Film, @Gen) para generar imágenes y vídeos con IA: plantillas, movimientos de cámara, producto en escena, anuncios y personajes. Como el resto de la familia, es gratis, va en el navegador, es de código abierto (AGPL-3.0, como `aify-social`) y usa **la IA de cada usuario**: sus claves y sus cuentas de los proveedores. Aify nunca paga una generación. Este estudio toma Higgsfield como referencia de lo que la gente espera. El plan de trabajo está en [plan.md](plan.md).

Todas las páginas se leyeron el 2026-10-31. Lo que no se pudo leer o comprobar se marca como **sin verificar**.

## 1. Higgsfield: qué hace

### Herramientas

Según su [centro de ayuda](https://higgsfield.ai/creator-hub/help-center/tools/which-higgsfield-tool-should-i-use) y su [portada](https://higgsfield.ai/):

| Herramienta | Qué hace |
|---|---|
| Cinema Studio | Vídeo «de cine» con control de cámara y de luz, escenas de varios planos, personajes y lugares reutilizables, y acceso a todos sus modelos de imagen y de vídeo. Va con Soul ID para mantener al personaje entre clips |
| Marketing Studio | Anuncios de producto, vídeos estilo UGC y piezas de campaña a partir de la URL o la foto del producto, con lipsync propio |
| Soul 2.0 y Soul ID | Imagen «estética» con más de 20 estilos. Soul ID entrena la cara de una persona: [al menos 20 fotos y unos 3-5 minutos](https://higgsfield.ai/blog/Soul-ID-AI-Character-Consistency) |
| AI Influencer | Constructor de influencers y embajadores de marca virtuales, con los rasgos elegidos en la interfaz y no en el prompt |
| Canvas | Pizarra de nodos que une prompts, referencias y generaciones; se guarda como plantilla y admite trabajo en equipo |
| Supercomputer | Agente que planifica un proyecto a partir de un encargo en lenguaje normal, elige modelos y entrega las piezas |
| Genjutsu y Genjutsu Lite | Rehace el movimiento de un vídeo con tus personajes, lugares o productos, o cambia un elemento y deja el resto ([portada](https://higgsfield.ai/)) |
| Upscale | Sube la resolución y la nitidez de vídeos de móvil o antiguos ([blog, 2025-10-15](https://higgsfield.ai/blog/BA5iuVmE9aFEEVxpNMyeI)). En esa página no se habla de imágenes ni de escalas concretas |
| MCP y CLI | Higgsfield desde Claude, Cursor o Codex sin clave de API, gastando los mismos créditos |
| Otras | En la portada: Content Factory (series «listas para publicar» a partir de tendencias), Playable (juegos desde un prompt), face swap y prueba virtual de ropa. «Product Placement» aparece solo como entrada de menú: **sin verificar** qué hace |

**Reencuadre:** no he encontrado en Higgsfield una herramienta de reencuadre documentada (**sin verificar**). Luma sí lo vende por API (sección 2).

### Modelos

Higgsfield no tiene un modelo propio de vídeo de referencia: revende los de otros, con algunos propios (Soul, Speak, Genjutsu). En la [portada](https://higgsfield.ai/) salen Kling 4.0, Seedance 2.5, Genjutsu, Sora 2, Kling 3.0 y Veo 3.1 («más de 30 modelos»). En su [guía de precios](https://higgsfield.ai/blog/higgsfield-pricing-explained) (2026-10-24) salen además FLUX.2 Pro y Max, Nano Banana, Nano Banana 2 y Pro, Seedream 4.5 y 5.0, Seedance 2.0, Wan 2.5 Speak, Higgsfield Speak 2.0, Veo 3 y Veo 3 Fast, Kling O1 Image y GPT Image.

### Plantillas y movimientos de cámara

- **Marketing Studio:** biblioteca de plantillas web en siete categorías: Product Shot, Motion, UGC, TikTok, Ads, Posters y Marketplace. Las de imagen son Product Shot, Ads y Marketplace; las de vídeo, UGC, Motion y TikTok. El producto entra por enlace o por fotos; la persona, desde una galería de avatares, un AI Influencer o un avatar propio ([ayuda](https://higgsfield.ai/creator-hub/help-center/tools/how-do-i-use-marketing-studio-to-create-video-ads)).
- **Cámara:** Cinema Studio controla cámara y luz ([ayuda](https://higgsfield.ai/creator-hub/help-center/tools/which-higgsfield-tool-should-i-use)). El número y la lista exacta de presets de cámara no los he podido leer: la página del blog sobre control de cámara da 404 y el listado del blog no los enumera (**sin verificar**).

### Precios y créditos

Su página de precios se pinta con JavaScript y no se puede leer sin navegador. Los datos son de su propia [guía de precios](https://higgsfield.ai/blog/higgsfield-pricing-explained), que dice estar comprobada en octubre de 2026:

| Plan | Precio al mes | Créditos al mes |
|---|---|---|
| Free | 0 | 0, sin uso comercial |
| Starter | 15 $ | 200 |
| Plus | 49 $ | 1000 |
| Ultra | 129 $ | 3000 |
| Team | 79 $ por puesto (2-9) | 1000 por puesto |
| Scale | 215 $ por puesto (5-15) | 2500 por puesto |

| Ejemplo de gasto | Créditos |
|---|---|
| Imagen FLUX.2 Pro / Nano Banana Pro / Nano Banana Pro 4K | 1 / 2 / 4 |
| Vídeo Seedance 2.0, 5 s: 720p / 1080p / 4K | 30 / 60 / 130 |
| Vídeo Veo 3 con audio, 8 s, 720p | unos 58 |
| Anuncio UGC de Marketing Studio, 10 s, 720p / 1080p | 70 / 160 |

**Reglas:** los créditos del plan no pasan al mes siguiente y los paquetes caducan a los 90 días. Se devuelven si la generación falla, no si no te gusta. Los modelos «Unlimited» solo valen en la web: MCP, CLI, Canvas y Supercomputer gastan siempre. Su API tiene un saldo aparte, en dólares ([misma guía](https://higgsfield.ai/blog/higgsfield-pricing-explained)). Otras webs dan planes y precios distintos ([Krea](https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs), [Layer3Labs](https://www.layer3labs.io/guides/higgsfield-ai-pricing)): Higgsfield cambia los precios a menudo.

### Qué valora la gente y qué le frustra

[Trustpilot](https://www.trustpilot.com/review/higgsfield.ai): 4,0 de 5 con 5227 opiniones (62 % de 5 estrellas, 19 % de 1 estrella).

| Valoran | Les frustra |
|---|---|
| Calidad de imagen y vídeo («by far the best platform for my content creation») | **Créditos:** el vídeo gasta mucho y recargar sale caro («run out of credit a lot») |
| Muchos modelos en un solo sitio («Simple access to heaps of models») | **«Unlimited» con letra pequeña:** una generación cada vez, colas largas («Unlimited should not mean unlimited waiting»); el interruptor hay que activarlo a mano |
| Soporte rápido y comunidad en Discord | **Cobros y bajas:** cargos tras cancelar, reembolsos discutidos, difícil darse de baja |
| | **Precios que cambian:** el coste de una misma generación subió dos veces en ocho días, sin aviso |
| | Resultados que no siguen el prompt y no devuelven los créditos ([Trustpilot, pág. 9](https://uk.trustpilot.com/review/higgsfield.ai?page=9); visto solo en el extracto del buscador) |

Reddit no se puede leer desde aquí (el buscador lo bloquea). La crítica más citada, «Higgsfield AI eats up credit so fast», me llega de segunda mano por un [blog de la competencia](https://www.blotato.com/blog/higgsfield-alternatives): **sin verificar**.

**Contexto:** el 2026-10-16, ComfyUI lanzó el reto [#OpenSourceHiggsfield](https://comfy.org/open-source-higgsfield/), porque «Higgsfield said they'd open source their platform». Según una [lista de la comunidad](https://github.com/jutsuhq/open-source-higgsfield), Higgsfield respondió con un requerimiento para cerrarlo. Para @Gen, la lección es clara: estudiar cómo funciona, sin copiar su marca, su interfaz ni sus plantillas.

**Lo que hace distinto a @Gen:** los tres dolores de Higgsfield son los créditos, los cobros y los precios opacos. @Gen no vende créditos: el usuario paga al proveedor con su clave, al precio de lista, y ve el coste antes de pulsar.

## 2. Proveedores con clave propia

**Navegador (CORS)** se ha comprobado de verdad el 2026-10-31: una petición `OPTIONS` y otra `POST` con `Origin: https://gen.useaify.app` contra cada API, mirando si vuelve `Access-Control-Allow-Origin`. Además se ha leído lo que dice cada SDK oficial.

| Proveedor | Imagen | Vídeo | ¿Desde el navegador? | Precio orientativo |
|---|---|---|---|---|
| **Google** (Gemini API) | Nano Banana 2.1, Nano Banana 2 (`gemini-3.1-flash-image`), 2 Lite y Pro (`gemini-3-pro-image`). **Imagen está retirado** ([docs](https://ai.google.dev/gemini-api/docs/imagen)) | Gemini Omni Flash (`gemini-omni-1.1-flash`): texto, imagen, referencias, editar y extender, de 360p a 4K, en 9:16. **Veo 3.1 preview se apagó el 2026-10-22** ([docs](https://ai.google.dev/gemini-api/docs/video), [Omni](https://ai.google.dev/gemini-api/docs/omni)) | **Sí.** CORS con el origen. El SDK `@google/genai` funciona igual en el navegador, aunque avisa de no exponer la clave ([README](https://github.com/googleapis/js-genai)) | Nano Banana 2: 0,067 $ (1K) a 0,151 $ (4K) por imagen; Omni Flash: unos 0,10 $/s a 720p. Sin capa gratis para imagen ([precios](https://ai.google.dev/gemini-api/docs/pricing)) |
| **OpenAI** | `gpt-image-2`, `gpt-image-2.5-*`, `gpt-image-1.5`, `gpt-image-1-mini`. `gpt-image-1` se apagó el 2026-10-23 | **Ninguno:** Sora 2 y la Videos API se apagaron el 2026-09-24 ([docs](https://developers.openai.com/api/docs/guides/video-generation)) | **Sí.** CORS `*`. El SDK lo bloquea salvo `dangerouslyAllowBrowser: true` ([README](https://github.com/openai/openai-node)) | `gpt-image-2` 1024×1024: 0,006 $ (baja), 0,053 $ (media), 0,211 $ (alta) ([guía](https://developers.openai.com/api/docs/guides/image-generation), [precios](https://developers.openai.com/api/docs/pricing)) |
| **fal.ai** | Cientos de endpoints: Nano Banana 2 y Pro, Seedream 4.5, FLUX.1 y FLUX 2, Z Image… | Kling v3 y v2.6, MiniMax H3, Grok Imagine, PixVerse V6, Seedance 2.0, FLUX 3 Max… | **Sí.** CORS con el origen. Su cliente funciona en el navegador, pero recomienda un proxy para no exponer la clave ([README](https://github.com/fal-ai/fal-js), [docs](https://fal.ai/docs/model-endpoints/server-side)) | Nano Banana 2: 0,08 $ por imagen; FLUX 2: 0,012 $/MP; Kling v3 Pro: 0,14 $/s. Saldo prepago ([precios](https://fal.ai/pricing)) |
| **Replicate** | FLUX 1.1 Pro, FLUX dev y schnell, Ideogram v3, Recraft v3… (modelos de la comunidad) | Wan 2.1 y otros | **No.** Sin cabeceras CORS. Su SDK: «can't interact with Replicate's API directly from a browser» ([README](https://github.com/replicate/replicate-javascript)). **Proxy** | FLUX 1.1 Pro: 0,04 $ por imagen; Wan 2.1 a 720p: 0,25 $/s ([precios](https://replicate.com/pricing)) |
| **Runway** | `gen4_image`, `gen4_image_turbo` y modelos de terceros (Gemini, GPT Image, Seedream, Ideogram…) | `gen4.5`, `gen4_turbo`, `aleph2`, `act_two` y de terceros: Kling 3.0 y 4, Veo 3.1, Seedance 2 y 2.5, Wan 3, Gemini Omni Flash… | **No.** La preflight responde 401 sin CORS y el SDK lanza un error en el navegador ([README](https://github.com/runwayml/sdk-node)). **Proxy** | 1 crédito = 0,01 $. `gen4.5`: 0,12 $/s; `gen4_image` a 1080p: 0,08 $ ([precios](https://docs.dev.runwayml.com/guides/pricing/)) |
| **Luma** | `uni-1.1` y `uni-1.1-max` (con referencias) | `ray-3.2`: texto e imagen a vídeo, vídeo a vídeo y **reencuadre** | **Sí, con la API nueva** (`agents.lumalabs.ai/v1`, CORS `*`; SDK con navegador entre los entornos admitidos, [README](https://github.com/lumalabs/luma-agents-typescript)). La API antigua (Dream Machine, `api.lumalabs.ai`) responde «Disallowed CORS origin» | Ray 3.2 a 720p: 0,30 $ los 5 s; reencuadre: 0,12 $/s; Uni-1.1: unos 0,04 $ por imagen ([precios](https://lumalabs.ai/api/pricing)) |
| **Kling** | **Sin verificar:** la documentación oficial ([kling.ai/document-api](https://kling.ai/document-api/apiReference/commonInfo)) se pinta con JavaScript y no se puede leer | **Sin verificar** en la API oficial. Kling 3.0 y 4 sí están por fal y por Runway | **No.** La preflight a `api-singapore.klingai.com` responde 401 sin CORS. Según guías de terceros, se firma un JWT con access key + secret key (**sin verificar**). **Proxy** | **Sin verificar** (no hay página oficial legible). Por fal: Kling v3 Pro a 0,14 $/s |

**Lo que sale de la tabla:**
- **Los modelos cambian cada mes.** En septiembre y octubre de 2026 se han apagado Imagen, Veo 3.1 preview, Sora 2 y `gpt-image-1`. @Gen no puede tener modelos escritos a fuego: necesita un catálogo que se actualice.
- **Agregadores:** fal y Runway revenden modelos de otros, Kling y Veo incluidos. Con dos o tres claves, el usuario llega a casi todo.
- **Cuatro de siete se llaman desde el navegador** (Google, OpenAI, fal y Luma). Replicate, Runway y Kling necesitan un proxy.

### Condiciones de uso con contenido de terceros

| Proveedor | Lo que dicen |
|---|---|
| Google | Prohíbe usar datos personales o biométricos sin el consentimiento exigido por ley y suplantar a alguien sin avisar, para engañar ([política de uso](https://policies.google.com/terms/generative-ai/use-policy)). Omni Flash no admite imágenes de ciertas personas reconocibles. En la EEE, Suiza y el Reino Unido no deja editar vídeos subidos ni imágenes de menores ([docs](https://ai.google.dev/gemini-api/docs/omni)). Todo sale con marca de agua SynthID |
| OpenAI | Las [políticas de uso](https://openai.com/policies/usage-policies/) y los [Service Terms](https://openai.com/policies/service-terms/) dan 403 desde aquí. Según el extracto del buscador, prohíben reproducir la imagen de una persona sin su consentimiento expreso: **sin verificar** el texto literal. Sora, ya apagado, rechazaba caras en las imágenes de entrada ([docs](https://developers.openai.com/api/docs/guides/video-generation)) |
| fal | Lo que se suba y lo que salga es responsabilidad del cliente, y hace falta permiso del titular de los derechos. Cada modelo de terceros trae sus propias condiciones ([términos](https://fal.ai/terms)) |
| Replicate | El cliente responde de la legalidad de lo que sube. Prohíbe suplantar a otra persona sin consentimiento. La licencia de cada modelo está en su página ([términos](https://replicate.com/terms)) |
| Runway | Solo referencias de personas que te hayan dado permiso: «You are responsible for the rights to any likeness you submit» ([guía de referencias](https://docs.dev.runwayml.com/recipes/reference-media/)). Su [política de uso](https://help.runwayml.com/hc/en-us/articles/17944787368595-Runway-s-Usage-Policy) da 403 desde aquí; según el extracto del buscador, prohíbe usar la imagen o la voz de alguien sin permiso y suplantar a nadie (**sin verificar**) |
| Luma | Por API, la app tiene que avisar a sus usuarios de que lo generado es IA y no dejar que lo hagan pasar por hecho por personas. El cliente responde ante reclamaciones por derechos de imagen, privacidad o propiedad intelectual de terceros ([términos de la API](https://lumalabs.ai/legal/api-terms-of-use)) |
| Kling | **Sin verificar** |

**Para @Gen:** los personajes con la cara de alguien piden una casilla de «tengo su permiso». Lo que se publique con una persona generada lleva la etiqueta de IA (TikTok ya lo pide con `es_ia` en `programar_tiktok`).

## 3. Bases de código abierto

Datos de GitHub del 2026-10-31 (`gh api`). «Último push» es `pushed_at`, que puede ser de una rama.

| Proyecto | Qué es | Licencia | Estrellas | Último push | ¿En el navegador? |
|---|---|---|---|---|---|
| [ComfyUI](https://github.com/Comfy-Org/ComfyUI) | Motor local de nodos (Python), con una API local, plantillas y «App Mode» | GPL-3.0 | 144 215 | 2026-10-31 | La interfaz es web, pero el motor va en tu GPU o en Comfy Cloud. Acepta CORS con `--enable-cors-header <origen>` ([cli_args.py](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy/cli_args.py)) |
| [workflow_templates](https://github.com/Comfy-Org/workflow_templates) | Plantillas oficiales de ComfyUI en JSON, con la web [comfy.org/workflows](https://comfy.org/workflows/) | MIT | 1391 | 2026-10-31 | Son datos: necesitan un ComfyUI |
| [InvokeAI](https://github.com/invoke-ai/InvokeAI) | Motor local con una interfaz web muy cuidada | Apache-2.0 | 28 932 | 2026-10-31 | No: servidor local |
| [SwarmUI](https://github.com/mcmonkeyprojects/SwarmUI) | Interfaz web modular sobre motores locales (C#) | MIT | 4724 | 2026-10-30 | No: servidor local |
| [video-starter-kit](https://github.com/fal-ai-community/video-starter-kit) | Next.js + Remotion + fal: generar y montar vídeo, guardado en IndexedDB | MIT | 2411 | 2026-10-21 (último commit de código: 2025-03-19) | Sí. La clave fal del usuario va en `localStorage` (`key-dialog.tsx`), con una ruta proxy en `api/fal` |
| [BeatDesign](https://github.com/BeatAPI/BeatDesign) | «Your local Higgsfield alternative»: pizarra infinita + editor de vídeo + 30-38 herramientas MCP | Apache-2.0 | 281 | 2026-10-30 | Interfaz en Chrome, pero con servidor Node y base de datos locales. Su único proveedor es BeatAPI |
| [OpenStudio](https://github.com/clawnify/OpenStudio) | Galería + flujos de nodos (React Flow), «subject lock» y estilos guardados, coste por generación | MIT | 65 | 2026-10-21 | No del todo: backend Hono + SQLite, y solo OpenRouter |
| [NodeTool](https://github.com/nodetool-ai/nodetool) | Espacio creativo de agentes: nodos, storyboard y timeline, con tus claves («at their price, with no billing unit in between») | AGPL-3.0 | 601 | 2026-10-31 | No: app de escritorio; la versión en la nube está en alfa |
| [ComfyArt](https://github.com/jtydhr88/ComfyArt) | Lienzo de diseño (tldraw) con agente, encima de ComfyUI | MIT | 404 | 2026-10-31 | Va dentro de ComfyUI (`127.0.0.1:8188/comfyart/`) |
| [OPENjutsu](https://github.com/D3voz/openjutsu) | Cambio de personaje en un vídeo, al estilo Genjutsu, sobre ComfyUI | MIT | 639 | 2026-10-30 | Necesita ComfyUI |
| [Open-Higgsfield-AI](https://github.com/ClabstreamTeam/Open-Higgsfield-AI) | Herramienta interna; su README dice que la generación está en pausa | sin licencia | 272 | 2026-04-19 | No se puede reutilizar (sin licencia) |
| [StableStudio](https://github.com/Stability-AI/StableStudio) | Interfaz de Stability | MIT | 9033 | 2024-04-30 | Parada |
| [replicate/zoo](https://github.com/replicate/zoo) | Patio de imágenes sobre Replicate | Apache-2.0 | 326 | 2024-02-20 | **Archivado** |

La [lista #OpenSourceHiggsfield](https://github.com/jutsuhq/open-source-higgsfield) reúne 96 proyectos del reto. Casi todos son pantallas encima de un ComfyUI local o de Comfy Cloud, y no proveedores con clave propia en el navegador.

**Conclusión:** ninguna base hace lo que necesita @Gen, que es ir en el navegador, con varias claves propias, sin servidor ni base de datos propios, y enlazado con la familia Aify.
- Las fuertes (ComfyUI, InvokeAI, SwarmUI) son motores locales que piden GPU.
- Las de «estudio» (BeatDesign, OpenStudio, NodeTool) llevan servidor y base de datos locales, o están atadas a un solo agregador.
- La más cercana, video-starter-kit, solo habla con fal y no se toca desde 2025.

Se aprovechan **ideas y piezas MIT/Apache**: la clave en `localStorage` y la cola de fal (video-starter-kit), «subject lock» y el coste por generación (OpenStudio), y ComfyUI como motor local opcional.

## 4. Cómo encaja con la familia Aify

| Hacia | Cómo | Ya existe |
|---|---|---|
| Pizarra de @Pictures (Studio) | `pedir_subida` con `destino: "pizarra"`, un PUT del archivo y `anadir_a_pizarra` con `cerca_de` el nodo de la petición. Sin MCP: `POST /api/pizarras/subidas` + `POST /api/pizarras/:id/nodos` | Sí (`docs/mcp.md`, migración 0054) |
| Editor de @Pictures | «Abrir en @Pictures» con la imagen | Hay que hacerlo |
| Timeline de @Film | Mismo canal que propone el plan de @Film (`BroadcastChannel('aify-film')`, encargo 13 de [su plan](../aify-film/plan.md)) | Pendiente en @Film |
| @Social (programar) | `pedir_subida` (`video/mp4` o `image/jpeg`) → PUT → `programar_publicacion`, o `programar_tiktok` | Sí |
| «Tu IA» | Herramientas MCP nuevas `gen_*`: el Claude o el ChatGPT del usuario pide «hazme 3 portadas con el kit de marca», @Gen genera con la clave del usuario y deja el resultado en la pizarra | Hay que hacerlo |
| Claves | @Social ya guarda claves de IA **cifradas** (AES-256-GCM con `AI_KEYS_SECRET`, tabla `organizaciones_claves_ia`, proveedores `gemini` y `anthropic`; `server.js` y migración 0053). @Pictures las guarda solo en el `localStorage` del navegador (`src/lib/ia.js` de `aify-pictures-web`) | Sí, en los dos estilos |

**Detalle útil:** la clave de Gemini que una organización ya puso en @Social sirve tal cual para Nano Banana y Omni Flash. Es la misma Gemini API.

## Relacionado
- [plan.md](plan.md)
- [Estudio de @Film](../aify-film/estudio.md)
- `docs/mcp.md` (subida, programación y pizarras)
- Issue #9 (encargo de este estudio)
