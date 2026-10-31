# @Studio: plan (2026-10-31, en el navegador)

## Qué es

@Studio es el sitio, **en el navegador, gratis y de código abierto (AGPL)**, donde se hace el contenido desde una pizarra:
- **Diseño de ropa:** referencias, prompts, variaciones y acabado.
- **Edición de vídeo:** reels por sector, vlogs, talking heads y sssstilla.
- **Piezas de imagen:** carruseles, historias y portadas.

No es una app que haya que instalar. Junta en una web las piezas que ya tenemos:

| Pieza | Qué pone | Hoy |
|---|---|---|
| **Pizarra** | Referencias, notas, flechas, pasos de flujo y lo que deja la IA | Studio en `pictures.useaify.app/studio` (`aify-pictures-web`) |
| **@Pictures** | Editor manual de fotos (WASM) | Fork de PhotoCraft, en `pictures.useaify.app/app/` |
| **@Film** | Editor manual de vídeo (WASM) con **chat que edita la línea de tiempo** | Fork de FilmCraft, `film.useaify.app` (en marcha) |
| **Recetas** | Cómo montamos cada tipo de pieza (cortes, subtítulos, color, música) | Hoy son scripts de Python en `AIFY OS`; aquí pasan a ser recetas de comandos de @Film |
| **Tu IA** | Quien hace el trabajo | La del usuario. Aify no paga ni guarda nada de IA |

## Reglas que no se tocan

1. **Gratis y en el navegador.** Sin instalar nada, sin planes de pago y sin créditos (decidido el 2026-10-31).
2. **Cada foto y cada vídeo se pueden abrir en su editor manual.** En la pizarra, cualquier imagen tiene «Editar en @Pictures» y cualquier vídeo «Editar en @Film». Al guardar, la pieza vuelve a la pizarra como una versión nueva (v2, v3…), sin borrar la anterior.
3. **@Film tiene un chat con Claude que edita la línea de tiempo** («quita los silencios», «pon subtítulos», «sube la música en el gancho»). Lo que hace se ve en el visor al momento y se deshace con Cmd+Z.
4. **Se cumplen las condiciones de Anthropic.** Su documentación dice: «salvo aprobación previa, no se permite a terceros ofrecer el inicio de sesión de claude.ai ni sus límites de uso en sus productos». Por eso @Studio no lleva un «Entrar con tu Claude» propio. La IA se conecta como se explica abajo.

## Cómo se conecta la IA

| Forma | Plan del usuario | Cómo funciona |
|---|---|---|
| **A. Tu Claude, en su web** | Cualquiera, también el gratis | El conector de Aify («Mira mi pizarra», MCP remoto) gana herramientas `film_*` y `pictures_*`. El usuario habla con su Claude en claude.ai, con sus artefactos y Claude Design, en otra pestaña o al lado. Claude lee la pizarra y edita @Film y @Pictures en vivo: las órdenes llegan al editor abierto por Supabase Realtime. Lo que hace se ve en azul |
| **B. Chat dentro de @Film y de la pizarra** | Con clave de API | El usuario pega su clave de Anthropic (o de OpenAI o Gemini) en «Tu IA». El chat llama a la API desde el navegador, como ya hace «Pídeselo a la IA», con las herramientas del editor |
| **C. Tu Claude Code, con tu plan** (decidido el 2026-10-31) | Pro o Max | **Puente local.** El usuario pega `curl -fsSL …/instalar.sh \| bash` en la Terminal. Si falta, se instala el Claude Code oficial de Anthropic, y el usuario inicia sesión en Claude Code, en la Terminal de Anthropic, nunca en una pantalla nuestra. Un servicio pequeño en su Mac (`127.0.0.1:4317`) conecta la pizarra con su `claude` (stream-json y un MCP «studio»). Es lo que hace Clonify. Está hecho en `aify-pictures-web` #35 |

Imágenes con la suscripción del usuario: las genera en ChatGPT o Gemini web, en otra pestaña, y las arrastra a la pizarra. Con clave, el paso Generador lo hace solo (ya existe).

## Arquitectura

```
studio.useaify.app        (un solo origen, para que todo se hable sin cruzar dominios)
├─ /            pizarra (React)
├─ /pictures/   @Pictures (WASM) + window.aifyPictures
├─ /film/       @Film (WASM)     + window.aifyFilm
├─ Archivos     File System Access: los brutos se quedan en el disco o en el USB,
│               y la pizarra guarda el permiso de cada uno, sin subirlos
├─ Tu IA        claves en localStorage (forma B) · conector de Aify (forma A)
└─ Aify (MCP)   pizarras + film_* / pictures_* → Supabase Realtime → editor abierto
```

- **Un solo origen** (`studio.useaify.app`, con redirecciones desde `pictures.` y `film.`):
  - la pizarra y los editores se hablan por `BroadcastChannel` y comparten archivos sin pedir permisos dos veces;
  - @Film necesita las cabeceras COOP/COEP para tener hilos, y se ponen en todo el origen.
- **Los editores ya saben de IA:** PhotoCraft y FilmCraft traen un registro de comandos (`engine.commands`) y, en escritorio, un puente MCP con `command_run`, `sequence_inspect` y `render_frame`. En la web falta exponer esos comandos a JavaScript (`window.aifyFilm.run(command, params)`, `inspect()`, `renderFrame(t)`, `open(file)`, `export()`). Es trabajo de Rust con wasm-bindgen en cada fork, sin tocar el motor.
- **Editar desde la transcripción ya existe en @Film:** `transcript.generate`, quitar muletillas y pausas, y pasar a subtítulos (`docs/transcripts.md`). Su Whisper (Rust, candle) está desactivado en la web: hay que compilarlo para WASM o usar Whisper con WebGPU en el navegador.
- **Los brutos pesados son el límite del navegador.** El 4K de cámara se reproduce hoy a 5-10 fps en la web (issue #6 de `aify-film`). Se resuelve con proxies de 720p al importar: se edita con el proxy y se exporta con el original.

## Fases y encargos

Cada encargo cabe en una noche o en una sesión. **(yo)** = lo hago en sesión (dominios, Vercel, cuentas). **(Dylan)** = hace falta tu cuenta.

### Fase 0: un solo sitio
0.1 **(yo)** `studio.useaify.app` sirve la pizarra en `/`, @Pictures en `/pictures/` y @Film en `/film/`, desde `aify-pictures-web` y con las cabeceras COOP/COEP. Las direcciones de ahora redirigen.
   - **Hecho cuando:** los tres cargan en el mismo origen y @Film tiene hilos (`crossOriginIsolated === true`).
0.2 **(yo + Dylan)** Escribir a Anthropic pidiendo aprobación para la forma C: el puente ya está hecho (#35).

### Fase 1: los brutos sin subir y las versiones
1.1 **Archivos del disco con File System Access.** Arrastrar o «Añadir archivos» guarda el permiso del archivo (Chrome y Edge), no una copia. En Safari se copia, como ahora.
   - **Hecho cuando:** un bruto de 4 GB del USB entra al instante y sigue ahí al recargar.
1.2 **Versiones en la pizarra.** Un nodo puede tener v1, v2… con flechas «v2», y elegir cuál es la buena.

### Fase 2: editores manuales (regla 2)
2.1 **`window.aifyPictures` en el fork de PhotoCraft:** `open(file)`, `run(command, params)`, `inspect()`, `export()`.
2.2 **«Editar en @Pictures» desde la pizarra.** Abre `/pictures/` con la imagen. «Guardar en la pizarra» la deja como v2.
2.3 **`window.aifyFilm` en el fork de FilmCraft:** lo mismo, más `renderFrame(t)` e `importar(clips)` en una secuencia nueva.
2.4 **«Editar en @Film» desde la pizarra.** Un vídeo, o varios seleccionados en orden, se abren como secuencia. «Exportar a la pizarra» la deja como v2.
   - **Hecho cuando:** foto → recorte → vuelve como v2; vídeo → corte → vuelve como v2.

### Fase 3: el chat de @Film (regla 3)
3.1 **Panel «Chat» en @Film** (egui, junto a Efectos): burbujas, respuesta en streaming, Parar y «Deshacer lo del chat».
3.2 **La IA del chat (forma B).** Claude Opus 5.5 con la clave del usuario y tres herramientas sobre `window.aifyFilm`: `ver_secuencia`, `ejecutar` (`command_run` / `command_batch`) y `ver_fotograma`. Lee la secuencia antes de responder y mira el fotograma antes de dar algo por bueno. Cada respuesta es un paso de deshacer.
3.3 **Transcripción en el navegador.** Whisper en WASM o WebGPU, para que funcionen «quita los silencios», «quita las muletillas» y «pon subtítulos».
   - **Hecho cuando:** «quita las pausas de más de 0,4 s y pon subtítulos» cambia la línea de tiempo, se ve en el visor y un Cmd+Z lo deshace.
3.4 **El mismo chat en @Pictures** («quita el fondo», «pásalo a 4:5 con el logo»).

### Fase 4: tu Claude de claude.ai maneja los editores (forma A)
4.1 **Herramientas `film_*` y `pictures_*` en el MCP de Aify.** Ver la secuencia, ejecutar comandos y ver un fotograma. Las órdenes van a una tabla y el editor abierto las recibe por Supabase Realtime, como dice `docs/aify-film/plan.md`.
4.2 **«Conectar mi Claude»** en la pizarra y en @Film: los pasos del conector (ya existen en «Tu IA») y un indicador «Tu Claude está editando».
   - **Hecho cuando:** desde claude.ai, «mira mi pizarra y monta el reel» deja la secuencia montada en @Film abierto.

### Fase 5: las recetas (nuestros motores, en el navegador)
5.1 **Recetas de @Film.** Lo que hacen hoy `lmx.py`, el motor de DeSancho, `vlog.py` y el de sssstilla, traducido a comandos de @Film y a instrucciones para la IA: cortar en silencios, subtítulos palabra a palabra con estilo, b-roll cada 5-8 s, colchón musical y SFX.
5.2 **Material de las recetas.**
   - LUTs (`resources/looks/`, sin datos de clientes).
   - Estilos de subtítulo.
   - Rótulos y cierres.
   - Una biblioteca de música y SFX con licencia libre.
5.3 **Plantillas de pizarra.** «Diseño de ropa», «Reel de cliente», «Vlog» y «sssstilla»: cada una crea sus cajas y sus pasos.

### Fase 6: brutos pesados y más IAs
6.1 **Proxies de 720p al importar** en @Film (issue #6 de `aify-film`): editar fluido con 4K y LOG, exportar con el original.
6.2 **ChatGPT y Gemini** en el chat de @Film (forma B), con las mismas herramientas.
6.3 **Safari:** probar los dos editores y avisar de lo que no funcione.

## Riesgos

- **Rendimiento:** el navegador va más lento que el escritorio con 4K y LOG. La fase 6.1 es imprescindible para los clientes con cámara.
- **File System Access** solo existe en Chrome y Edge. En Safari, los archivos se copian al navegador.
- **COOP/COEP** en todo el origen: las miniaturas externas (YouTube, IG) necesitan `credentialless` o un proxy.
- **Forma C:** Anthropic no permite «salvo aprobación previa» que terceros ofrezcan el inicio de sesión de claude.ai. Aquí el inicio de sesión es el de Claude Code y lo hace el usuario, como en Clonify, pero es zona gris: conviene pedir la aprobación. Si lo cierran, quedan las formas A y B.
- **Recetas frente a scripts:** nuestros motores de Python hacen cosas (DeepFilterNet, etalonajes con ffgraph) que no existen tal cual en @Film. Al traducirlos habrá diferencias, y algunas piezas de cliente seguirán montándose en local mientras tanto.

## Relacionado

- Pizarra y modo flujo: `aify-pictures-web` (PRs #32 y #33).
- @Film: `docs/aify-film/plan.md`.
- MCP de pizarras: `docs/mcp.md`.
