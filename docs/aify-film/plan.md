# @Film: plan (2026-10-31)

El porqué de cada decisión está en [estudio.md](estudio.md).

## Decisión

@Film es un **fork de FilmCraft** ([storytold/filmcraft](https://github.com/storytold/filmcraft), MIT/Apache-2.0), igual que @Pictures es un fork de PhotoCraft. Va en el navegador en `film.useaify.app/app/`, tiene encima un espacio «Reel» sencillo y lo maneja «Tu IA».

## Arquitectura

| Pieza | Repo | Qué es |
|---|---|---|
| Editor | `dylanstillavato/aify-film` (fork de FilmCraft) | Motor + interfaz egui en WASM. Le añadimos el tema Aify, el espacio «Reel» y `window.aifyFilm` |
| Web | `dylanstillavato/aify-film-web` (copia de la estructura de `aify-pictures-web`) | Landing en `/`, editor en `/app/` (copiado con `scripts/publicar-editor.sh`) y PWA. Vercel con cabeceras COOP/COEP para que haya hilos en WASM |
| Pizarra | `aify-pictures-web` (Studio) | La misma pizarra de @Pictures: un proyecto puede tener vídeos y abrirse en @Film |
| Tu IA | `aify-social` (MCP) | Herramientas nuevas `film_*` que dejan órdenes en una tabla. El editor abierto las recibe por Supabase Realtime, las ejecuta con los comandos del motor y devuelve el resultado. Es el mismo patrón que «Mira mi pizarra», y lo que hace la IA se ve en azul |
| Publicar | `aify-social` (MCP) | Al exportar: `pedir_subida` → subida → `programar_publicacion` (ver `docs/mcp.md`) |

Con clave propia, «Pídeselo a la IA» llama a la API desde el navegador con las mismas herramientas. Así funciona aunque el usuario no tenga conector.

## Encargos

Cada uno tiene el tamaño de una noche. Los marcados con **(yo)** los hace Claude Code en sesión, porque crean repos o tocan Vercel.

### Fase 0: preparar
0. **(yo) Fork y web.**
   - Fork de `storytold/filmcraft` → `dylanstillavato/aify-film` y copia local en `~/Desktop/aify-film-editor`.
   - Repo `aify-film-web` con la misma estructura que `aify-pictures-web`.
   - Proyecto de Vercel y dominio `film.useaify.app`.

### Fase 1: @Film con su nombre, en la web
1. **Nombre, icono y créditos.**
   - **Qué:** «@Film» en `APP_NAME`, el título, el menú Ayuda, «Acerca de» y la carga; icono con la teja violeta (#8B5CF6), la «F» blanca y el punto lima (`resources/aify/logos/v2/`); quitar `docs/brand/` de ArtCraft; NOTICE y ATTRIBUTION con el crédito a FilmCraft.
   - **Dónde:** `crates/ui-egui/src/menus/native_menu.rs`, `dialogs.rs`, `links.rs`, `apps/filmcraft-web*/index.html` y `assets/app-icon/`.
   - **Cómo:** copiar lo que hicieron los PRs #1, #2 y #4 de `aify-pictures`.
   - **Hecho cuando:** `cargo xtask ci` pasa y no queda «FilmCraft» visible salvo en los créditos.
   - **No tocar:** el motor (`crates/engine`) ni los códecs.
2. **Español por defecto.**
   - **Qué:** el idioma del navegador decide; si no está soportado, español.
   - **Cómo:** igual que el PR #3 de `aify-pictures` (`i18n/system.rs`, `web.rs`).
3. **Tema Aify.**
   - **Qué:** el tema oscuro de @Pictures (tarjetas grafito, azul #1D5FE0, lima #D7FF3D), por defecto en la web.
   - **Cómo:** portar `crates/ui-egui/src/theme.rs` de `aify-pictures` (PRs #5 y #6).
4. **Publicar en film.useaify.app.**
   - **Qué:** `scripts/publicar-editor.sh`, `vercel.json` con COOP/COEP y PWA instalable.
   - **Dónde:** `aify-film-web`.
   - **Hecho cuando:** `/app/` abre el editor en Chrome y en Safari.
5. **Medir con brutos reales.**
   - **Qué:** importar un vídeo de iPhone de 4K HEVC y uno de 1080p H.264, montar 60 s y exportar en 9:16. Medir fps de reproducción, tiempo de exportación y memoria.
   - **Hecho cuando:** hay un informe en `docs/medidas.md` con los números. Si la reproducción va por debajo de 25 fps, abrir el encargo 5b: proxies 720p al importar.

### Fase 2: el espacio «Reel» (lo que espera quien viene de CapCut)
6. **Espacio de trabajo «Reel».**
   - **Qué:**
     - un espacio nuevo, el que se abre por defecto en la web;
     - secuencia 1080×1920 a 30 fps;
     - visor grande, una pista principal magnética, y pistas de texto, música y b-roll;
     - una barra con botones grandes: Dividir, Borrar, Velocidad, Texto, Música, Subtítulos y Exportar.
   - **Cómo:** solo interfaz (`ui-egui`), llamando a comandos que ya existen (`timeline.*`, `effects.*`).
   - **Hecho cuando:** se monta un reel de 3 clips + título + música sin abrir otro panel.
7. **Exportar para Instagram y TikTok.**
   - **Qué:** preajuste de 1080×1920, H.264 a 16 Mbps, AAC a 48 kHz y bt709.
   - **Hecho cuando:** el MP4 pasa `ffprobe` con esos valores.
8. **Subtítulos automáticos palabra a palabra.**
   - **Qué:** Whisper en el navegador → pista de subtítulos con tiempos por palabra, con estilos «karaoke» (palabra activa en color) y caja fina semitransparente.
   - **No tocar:** nada que envíe audio a un servidor.
9. **Cortar silencios y muletillas.**
   - **Qué:** VAD (Silero, onnxruntime-web) + transcripción → propuesta de cortes que se ve en la timeline antes de aplicarla, con un solo deshacer.
10. **Reencuadre 9:16 siguiendo la cara.**
    - **Qué:** detección de caras (MediaPipe) → keyframes de posición suavizados.

### Fase 3: Tu IA y la pizarra
11. **`window.aifyFilm`.**
    - **Qué:** API del editor para la IA, encima de `window.filmcraft`: `abrir(archivos)`, `ejecutar(comando, params)`, `estado()`, `captura()` y `exportar()`.
    - **Cómo:** se basa en el canal de comandos que ya existe.
12. **MCP `film_*` en aify-social.**
    - **Qué:** herramientas `film_estado`, `film_ejecutar` y `film_captura`; tabla `ordenes_film` (migración nueva) y Realtime hacia el editor abierto.
    - **Dónde:** `server.js`, `docs/mcp.md`.
    - **Hecho cuando:** desde claude.ai con el conector, «corta el silencio del principio» cambia la timeline abierta.
13. **De la pizarra al reel.**
    - **Qué:** Studio manda los vídeos de un proyecto a @Film (`BroadcastChannel('aify-film')`). «Mira mi pizarra» lee las notas y la IA monta con `film_*`.
14. **«Pídeselo a la IA» con clave propia.**
    - **Qué:** panel de chat en el editor con la clave de Claude o Gemini del usuario y las mismas herramientas.
15. **Programar en @Social.**
    - **Qué:** botón «Programar en @Social» al exportar → elegir cliente y hora → `pedir_subida` + `programar_publicacion`.

### Siempre
16. **Sincronizar con upstream cada semana.**
    - **Qué:** merge de `storytold/filmcraft` en el fork, resolviendo conflictos solo en nuestros archivos.
    - **Cómo:** encargo fijo del turno de noche de los lunes.

### Más adelante
- Integrar el motor de edición de DeSancho (`resources/sold-out/desancho/_motor/`) como «kit de edición» por cliente.
- Música y efectos de sonido de librerías CC0.

## Marca
- **Logo:** «@Film» con la @ de Aify (`resources/aify/logos/v4/`).
- **Icono:** teja violeta #8B5CF6 con «F» blanca y punto lima, ya diseñada (`v2/`).

## Relacionado
- [estudio.md](estudio.md)
- `docs/mcp.md`
- Issue #5
