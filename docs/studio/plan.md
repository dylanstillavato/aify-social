# @Studio: plan de la app (2026-10-31)

## Qué es

@Studio es una **app de escritorio, gratis y de código abierto (AGPL)** para hacer contenido desde una pizarra:
- **Diseño de ropa:** referencias, prompts, variaciones y acabado.
- **Edición de vídeo:** reels por sector, vlogs, talking heads y sssstilla.
- **Piezas de imagen:** carruseles, historias y portadas.

Junta en una sola app las piezas de la familia Aify:

| Pieza | Qué pone | De dónde sale |
|---|---|---|
| **Pizarra** | Referencias, notas, flechas, pasos de flujo y lo que deja la IA | Studio de `aify-pictures-web` (React) |
| **@Pictures** | Editor manual de fotos | Fork de PhotoCraft (`aify-pictures`), versión de escritorio |
| **@Film** | Editor manual de vídeo con **chat que edita la línea de tiempo** | Fork de FilmCraft (`aify-film`), versión de escritorio |
| **Motores** | Cómo montamos cada tipo de pieza (cortes, subtítulos, color, música, SFX) | Nuestras habilidades y scripts de `AIFY OS` |
| **Tu IA** | Quien hace el trabajo | La IA del usuario. Aify no paga ni guarda nada de IA |

Lo pesado (render, ffmpeg, Whisper, etalonaje) corre en el ordenador del usuario. Los brutos no se suben a ningún sitio.

## Reglas que no se tocan

1. **Gratis.** Nada de planes de pago ni de créditos. Aify no paga IA (decidido el 2026-10-31).
2. **Cada foto y cada vídeo se pueden abrir en su editor manual.** En la pizarra, cualquier imagen tiene «Editar en @Pictures» y cualquier vídeo «Editar en @Film». Al guardar, la pieza vuelve a la pizarra como una versión nueva, sin borrar la anterior.
3. **@Film tiene un chat con Claude que edita la línea de tiempo** («corta los silencios», «sube la música en el gancho», «pon subtítulos»). Lo que haga el chat se puede deshacer con Cmd+Z y se ve en el momento.
4. **Las condiciones de Anthropic se cumplen.** Su documentación dice: «salvo aprobación previa, Anthropic no permite que terceros ofrezcan el inicio de sesión de claude.ai ni sus límites de uso en sus productos». Por eso @Studio no lleva un «Entrar con tu cuenta de Claude» propio. La IA se conecta como se explica abajo.

## Cómo se conecta la IA

| Forma | Quién la usa | Cómo funciona | ¿Cumple? |
|---|---|---|---|
| **A. Claude abre @Studio** (por defecto) | Cualquier plan, también el gratis | @Studio arranca un **servidor MCP local**. El usuario lo añade una vez en *su* Claude (Claude Desktop o Claude Code, con su cuenta, en la app de Anthropic). Desde allí Claude lee la pizarra, maneja @Film y @Pictures por sus MCP y deja los resultados. Los artefactos y Claude Design se usan donde viven, en Claude, y lo que salga se trae a la pizarra | Sí: es el uso normal de los conectores |
| **B. Chat dentro de @Studio y @Film con clave de API** | Quien quiera el chat dentro de la app | El usuario pega su clave de Anthropic (o de OpenAI o Gemini). El chat del panel llama a la API con las mismas herramientas MCP | Sí: es el método que pide Anthropic |
| **C. Chat dentro de la app con el plan del usuario** | Pro o Max | Como Clonify: la app maneja el `claude` que el usuario instaló y en el que inició sesión | **Solo si Anthropic lo aprueba.** Se pide permiso en la fase 0. Hasta entonces, no se hace |

La conexión con la web de Aify («Mira mi pizarra», el MCP remoto) sigue funcionando: sirve para usar la pizarra desde el móvil o desde claude.ai.

## Arquitectura

```
@Studio.app (Tauri 2)
├─ Ventana Pizarra ─ la web de Studio, empaquetada y sin conexión
│   └─ proyectos en ~/Documentos/@Studio/<proyecto>/ (pizarra.json + archivos o rutas al disco y al USB)
├─ Servidor MCP local «studio» (herramientas de pizarra: ver, añadir, abrir en editor, pedir render)
├─ @Pictures (binario photocraft)  ─ --control <puerto> + photocraft-cli mcp --bridge
├─ @Film     (binario filmcraft)   ─ --control <puerto> + filmcraft-cli mcp --bridge
├─ Herramientas: ffmpeg, whisper.cpp, yt-dlp (incluidas, con sus licencias)
└─ Motores (plugin «aify-motores»): habilidades y scripts para cada tipo de pieza
```

- **Por qué Tauri:** pesa mucho menos que Electron, está en Rust como los dos editores y deja incluir sus binarios como *sidecars*.
- **Los editores ya traen control remoto:** PhotoCraft y FilmCraft tienen un canal de control local con token (`--control`) y un puente MCP (`*-cli mcp --bridge`). Con `command_run`, `sequence_inspect`, `render_frame` y `ui_screenshot`, una IA ya puede editar la línea de tiempo y ver el resultado (`docs/control-protocol.md` y `docs/agents.md` de cada fork). No hay que inventar la API: hay que conectarla.
- **El chat de @Film** es un panel nuevo del propio @Film (egui). Manda cada mensaje al proceso de @Studio, que llama a la IA (forma B, o la C si se aprueba) con las herramientas del puente MCP de @Film y devuelve la respuesta al panel en streaming. Las ediciones van por `command_run`: entran en el historial de deshacer y se ven en el visor al instante.

## Fases y encargos

Cada encargo cabe en una noche o en una sesión. Los que llevan **(yo)** los hago en sesión porque crean repos, firman o tocan cuentas. Los que llevan **(Dylan)** necesitan tu cuenta.

### Fase 0: decisiones y cuentas
0.1 **(Dylan)** Cuenta de Apple Developer (99 $ al año). Sin ella, macOS avisa de «app no verificada» al abrirla. Es lo único que cuesta, y lo pagamos nosotros, no el usuario.
0.2 **(yo + Dylan)** Escribir a Anthropic pidiendo aprobación para la forma C: «@Studio, app gratuita y de código abierto, quiere manejar el Claude Code del usuario con su propio plan».
0.3 **(yo)** Repo público `dylanstillavato/aify-studio` (Tauri 2, AGPL) y el nombre definitivo.

### Fase 1: la pizarra como app
1.1 **Esqueleto Tauri.** Abre la Studio de `aify-pictures-web` empaquetada; ventana, menú e icono.
   - **Hecho cuando:** `npm run tauri build` da un `.app` que abre la pizarra sin internet.
1.2 **Proyectos en disco.** Guardar en `~/Documentos/@Studio/`, en vez de IndexedDB. Los archivos que se arrastran desde Finder o el USB se guardan como *ruta* (con miniatura), y se pueden copiar dentro del proyecto si se quiere.
   - **Hecho cuando:** un bruto de 4 GB entra en la pizarra al instante y sin copiarse.
1.3 **Instalador.** `.dmg` firmado y notarizado, con actualización automática desde los *releases* de GitHub.

### Fase 2: editores manuales (regla 2)
2.1 **@Pictures de escritorio dentro de la app.** Compilar `photocraft` para macOS (arm64 y x64) e incluirlo como sidecar.
2.2 **@Film de escritorio dentro de la app.** Lo mismo con `filmcraft`.
2.3 **«Editar en…» desde la pizarra.**
   - Abre el editor con su canal de control y su token.
   - Le carga la foto o el vídeo (`media_import` y una secuencia nueva en @Film).
   - Al guardar o exportar, deja la versión nueva junto a la original, unidas con una flecha «v2».
   - **Hecho cuando:** foto → @Pictures → recorte → vuelve a la pizarra como v2; vídeo → @Film → corte → vuelve como v2.
2.4 **Varias piezas a la vez.** Un vídeo con varios clips seleccionados se abre como una secuencia con todos ellos en orden.

### Fase 3: «Claude abre @Studio» (forma A)
3.1 **Servidor MCP local «studio».**
   - Herramientas: `ver_pizarra`, `anadir_a_pizarra`, `abrir_en_pictures`, `abrir_en_film` y `exportar`.
   - Sirve por stdio y por HTTP en `127.0.0.1`, con token.
   - Reutiliza la forma de las herramientas de pizarra de `mcp/servidor.js`, para que una IA que ya conoce «Mira mi pizarra» sepa usarlo.
3.2 **Botón «Conectar mi Claude».** No inicia sesión. Explica los pasos y le genera al usuario su configuración: el bloque para Claude Desktop o el `claude mcp add` para Claude Code, con los MCP de studio, @Film y @Pictures. Es lo mismo que «Tu IA» de la web, pero en local.
3.3 **Lo que hace la IA, en azul en la pizarra**, como ya pasa con «Mira mi pizarra».
   - **Hecho cuando:** desde Claude Desktop, «mira mi pizarra y monta el reel con los clips» deja el reel en la pizarra.

### Fase 4: el chat de @Film (regla 3)
4.1 **Panel «Chat» en @Film** (egui, junto a Efectos). Burbujas, streaming, botón Parar y «Deshacer lo del chat».
4.2 **Puente panel ↔ @Studio.** Un método nuevo del canal de control (`chat.send` / `chat.event`), para que el panel no lleve claves ni red.
4.3 **La IA del chat.** Forma B con la clave de Anthropic del usuario: Claude Opus 5.5 con las herramientas del puente MCP de @Film. Antes de cada respuesta lee `sequence_inspect`, y mira `render_frame` antes de dar algo por bueno.
4.4 **Contexto del reel.** El chat sabe qué tipo de pieza es (reel de restaurante, talking head…) y usa la habilidad de su motor.
   - **Hecho cuando:** «quita los silencios de más de 0,4 s y pon subtítulos» cambia la línea de tiempo, se ve en el visor y un Cmd+Z lo deshace.
4.5 **El mismo chat en @Pictures** («quita el fondo», «pásalo a 4:5 con el logo»).

### Fase 5: los motores
5.1 **Plugin `aify-motores`**, público, con las habilidades generalizadas: diseño de ropa, reel por sector (restaurante, peluquería), talking head, vlog, sssstilla e historias.
   - Se sacan de `.claude/skills/` y `resources/` de AIFY OS **sin datos de clientes**: los perfiles de marca (LMP, DeSancho…) se quedan en local, en cada proyecto.
5.2 **Herramientas incluidas.** ffmpeg, whisper.cpp con modelo descargable y yt-dlp, con un comprobador de «todo listo».
5.3 **Plantillas de pizarra.** «Diseño de ropa», «Reel de cliente» y «Vlog»: cada una crea sus cajas y sus pasos.

### Fase 6: más IAs y más sistemas
6.1 **ChatGPT y Codex** como alternativa en las formas A y B: Codex admite MCP y OpenAI tiene «Sign in with ChatGPT». Hay que investigar si deja hacer la forma C.
6.2 **Imágenes con el plan del usuario.** La IA usa ChatGPT o Gemini web, que el usuario tiene abiertos en su navegador, y trae la imagen a la pizarra.
6.3 **Windows.**

## Riesgos

- **Forma C:** sin aprobación de Anthropic no se hace, aunque Clonify lo haga. Las formas A y B no dependen de ella.
- **Compilar los editores de escritorio:** son proyectos de Rust grandes (unos 7 minutos en frío y más de 20 GB de `target/`). Hay que mirar el espacio en disco y compilarlos en CI con GitHub Actions para macOS.
- **Rutas a discos externos:** si el USB no está conectado, la pizarra enseña la miniatura y avisa.
- **Licencias:** PhotoCraft y FilmCraft son MIT/Apache, compatibles con AGPL. ffmpeg se distribuye en build LGPL, y Whisper y yt-dlp con sus avisos.

## Relacionado

- Pizarra y modo flujo: `aify-pictures-web` (PRs #32 y #33).
- @Film: `docs/aify-film/plan.md`.
- MCP de pizarras: `docs/mcp.md`.
