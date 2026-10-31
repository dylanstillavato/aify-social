# @Film: estudio (2026-10-31)

@Film es el editor de vídeo de la familia Aify (@Social, @Pictures, @Film, @Gen). Es gratis, va en el navegador, es de código abierto y lo maneja la IA de cada usuario. Este estudio decide sobre qué base se construye y qué tiene que hacer. El plan de trabajo está en [plan.md](plan.md).

## 1. Qué tiene que hacer (lo que la gente espera de CapCut)

Esta lista es de memoria: es lo que un gestor de redes usa a diario en CapCut. No la he contrastado con su centro de ayuda. No se copia nada de su interfaz ni de su marca.

| Bloque | Lo que se espera |
|---|---|
| Montaje | Una pista principal magnética, dividir en el cursor, borrar huecos, recortar, reordenar arrastrando, velocidad (también en curva) y congelar fotograma |
| Formato | Lienzo 9:16, 1:1, 4:5 y 16:9, reencuadre automático siguiendo a la persona, y fondo desenfocado |
| Texto | Títulos con estilos, animaciones de entrada y salida, y subtítulos automáticos palabra a palabra con estilos («karaoke») |
| Sonido | Música y efectos de sonido, bajar la música bajo la voz, quitar ruido, voz con IA y cambiador de voz |
| Imagen | Filtros, ajustes básicos de color, quitar fondo sin croma, y transiciones y efectos |
| IA | Cortar silencios y muletillas, del guion al vídeo, plantillas y «auto-montaje» |
| Exportar | 1080p o 4K, 30 o 60 fps, directo a TikTok o Instagram |

**El flujo de un gestor de redes:**
1. Brutos del móvil.
2. Elegir tomas y cortar silencios.
3. Gancho en los 2 primeros segundos.
4. Subtítulos.
5. B-roll cada 5-8 s.
6. Música baja bajo la voz.
7. Exportar en 9:16.
8. Programar.

**Lo que frustra en CapCut:** lo básico se ha ido metiendo detrás del pago, sube los vídeos a su nube y su IA es suya, no la del usuario. Esos tres puntos son justo lo que hace distinto a @Film.

**Lo que lo hace distinto (como Clonify Studio):** una pizarra junto al vídeo donde dejas indicaciones («gancho: 0:12», «corte en 0:45», «un reel con lo mejor») y tu propia IA monta la pieza. En Aify esa pizarra ya existe: es Studio de @Pictures, con «Mira mi pizarra» y las herramientas MCP de pizarras de @Social (`docs/mcp.md`).

## 2. Bases abiertas: OpenCut frente a FilmCraft

Datos sacados de GitHub el 2026-10-31 (`gh api`).

| Criterio | OpenCut ([OpenCut-app/OpenCut](https://github.com/OpenCut-app/OpenCut)) | FilmCraft ([storytold/filmcraft](https://github.com/storytold/filmcraft)) |
|---|---|---|
| Licencia | MIT | MIT o Apache-2.0 |
| Estado | **Se está reescribiendo desde cero.** La versión usable ([opencut-classic](https://github.com/OpenCut-app/opencut-classic)) está **archivada** desde 2026-05-17. La nueva vivirá en new.opencut.app «cuando esté lista» | Alfa. Según su README: «amplitud de funciones ~86 %, listo para trabajo real ~56 %» (medido el 2026-10-10) |
| Contribuciones | «No aceptamos contribuciones externas todavía» | Abiertas (CONTRIBUTING, AGENTS.md, CLAUDE.md en el repo) |
| Actividad | 96 800 estrellas; último push el 2026-09-24 | 17 000 estrellas, 7000 forks; 100 commits del 27 al 31 de octubre |
| Lenguaje | TypeScript y, en la reescritura, núcleo en Rust | Rust puro, con la interfaz en egui |
| En el navegador | Sí (web) | Sí: mismo motor y misma interfaz en WebAssembly (`apps/filmcraft-web`, [docs/web.md](https://github.com/storytold/filmcraft/blob/main/docs/web.md)), con un zip web en cada versión |
| Vídeo 4K de móvil | Sin datos de la reescritura | Decodifica H.264, HEVC, VP9 y AV1 por WebCodecs, con el hardware del navegador. El color, las claves y la exportación aún tiran de CPU: **hay que medirlo con brutos reales** |
| Timeline | Pistas, cortes y keyframes básicos (classic) | De nivel profesional: three-point editing, todos los recortes, multicámara, keyframes Bezier y anidado |
| Texto y subtítulos | Texto básico | Motor de texto OpenType. Pistas de subtítulos SRT, VTT y SCC que se queman al exportar. Transcripción opcional, desactivada por defecto |
| Exportar | MP4 | H.264 + AAC con su propio codificador, en cualquier tamaño (9:16 incluido). También ProRes, GIF y secuencias PNG |
| Manejo desde la IA | Prometido en la reescritura: «Editor API», MCP y modo sin interfaz | **Ya existe:** más de 650 comandos con parámetros tipados, la misma vía para interfaz, CLI, canal JSON y **servidor MCP**. En la web, `window.filmcraft` para agentes y tests |
| Que un agente lo mejore de noche | JS es más fácil, pero no admiten PRs y la base cambia entera | Rust es más difícil, pero tiene `cargo xtask ci`, tests y reglas de capas. **Ya lo hacemos con @Pictures**, que es un fork de PhotoCraft, del mismo equipo y con la misma arquitectura |
| Quitar su marca | Logo y nombre | Igual que en @Pictures: nombre, icono, `docs/brand/` (ArtCraft), carga y créditos; NOTICE y ATTRIBUTION se mantienen |

### Recomendación

**FilmCraft.** OpenCut no tiene hoy una base viva sobre la que construir: la vieja está archivada y la nueva ni está lista ni acepta código. FilmCraft ya hace lo difícil: códecs propios, timeline profesional, web y MCP. Además, es gemelo de PhotoCraft, así que reutilizamos todo lo de @Pictures:
- el fork con nombre y créditos;
- el tema «Aify»;
- español por defecto;
- `publicar-editor.sh`;
- la PWA;
- el despliegue en Vercel.

**Riesgos y cómo se cubren:**
- **Su interfaz es de editor profesional, no de CapCut.** Su UI es un crate aparte (`ui-egui`) encima del motor. Añadimos un espacio de trabajo «Reel» sencillo, sin tocar el motor.
- **Rendimiento con 4K del móvil en el navegador.** El primer encargo técnico es medirlo. Si va lento, se usan proxies 720p generados al importar.
- **Va muy rápido** (cientos de commits por semana). Hay que sincronizar con upstream cada semana; si no, el fork se queda atrás.

## 3. La IA en @Film (siempre «Tu IA»)

Nunca la paga Aify ni se pide la contraseña. Es el Claude o ChatGPT del usuario por el conector MCP de Aify, o su clave de API.

| Tarea | En el navegador, sin IA | Necesita la IA del usuario |
|---|---|---|
| Subtítulos automáticos | Whisper en WASM/WebGPU | No |
| Cortar silencios | VAD (Silero en onnxruntime-web) | No |
| Cortar muletillas («eee») | Con la transcripción palabra a palabra | No |
| Elegir la mejor toma | Puntúa audio y nitidez | Para juzgar el contenido: sí |
| Gancho en 2 s | No | Sí, con la transcripción |
| B-roll cada 5-8 s | Coloca los planos | Elegir cuáles: sí |
| Reencuadre 9:16 siguiendo la cara | Detección de caras (MediaPipe) → keyframes de posición | No |
| Música bajo la voz | Automatización de volumen con la voz detectada | No |
| Del guion al montaje | No | Sí |
| De la pizarra al reel | No | Sí («Mira mi pizarra») |
| Publicar en @Social | `pedir_subida` + `programar_publicacion` del MCP | No (lo hace la app con el token del usuario) |

## Relacionado
- [plan.md](plan.md)
- `docs/mcp.md` (herramientas MCP, pizarras, subida y programación)
- Issue #5 (encargo original del estudio)
