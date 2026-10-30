---
version: "alpha"
name: Aify
description: >-
  Visual identity of Aify (useaify.app) — contenido con IA para agencias de
  marketing. Tokens extraídos tal cual del código en producción
  (src/pages/Landing.jsx, src/pages/marketing/shared.jsx), no inventados.
colors:
  sky-deep: "#1D5FE0"
  sky-mid: "#4C93FF"
  sky-light: "#8FC2FF"
  lime: "#D7FF3D"
  lime-dark: "#BEE62A"
  ink: "#0B0C10"
  ink-soft: "#5B5D66"
  ink-faint: "#9A9CA5"
  surface: "#FFFFFF"
  surface-alt: "#F3F5EF"
  card: "#FFFFFF"
  green: "#2FBE6B"
  red: "#E5484D"
  orange: "#FF9500"
typography:
  h1:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "clamp(32px, 5.2vw, 52px)"
    fontWeight: 700
    letterSpacing: "-1.5px"
  h2:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "clamp(28px, 4.2vw, 40px)"
    fontWeight: 700
    letterSpacing: "-1px"
  body-md:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  body-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  label-caps:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.6px"
  logotype:
    fontFamily: "none (SVG con el texto en trazados, public/marca/)"
    fontSize: "17px"
    fontWeight: 400
rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 20px
  xl: 24px
  full: 999px
spacing:
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 14px 24px
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: 8px 14px
  card-dark:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    rounded: "{rounded.xl}"
    padding: 40px 36px
  card-light:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 28px 26px
  input:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 13px 16px
---

## Overview

Aify es un SaaS de contenido con IA para agencias de marketing y freelancers
— genera calendarios, copies, guiones e ideas para los clientes de una
agencia. La identidad visual busca sentirse "producto real" y confiable
(fintech/SaaS B2B), no genérica de startup de IA: un degradado azul
consistente como fondo de hero, un único acento lima de alto contraste para
toda acción primaria, y tipografía de sistema en vez de una display font —
la marca no depende de una tipografía llamativa, depende de la consistencia
del azul + lima en cada superficie pública.

## Colors

- **sky-deep → sky-mid → sky-light** (`#1D5FE0 → #4C93FF → #8FC2FF`): el
  degradado de fondo de todo hero público (`linear-gradient(180deg, sky-deep
  0%, sky-mid 55%, sky-light 100%)`). Es el elemento más reconocible de la
  marca — no se sustituye por un color plano ni por otro ángulo de
  degradado.
- **lime / lime-dark** (`#D7FF3D` / `#BEE62A`): único acento de alto
  contraste. Reservado para CTAs primarios y el eyebrow/badge de highlight —
  si todo es lima, deja de significar "acción principal".
- **ink** (`#0B0C10`): texto y fondos oscuros (tarjetas dark, footer). No es
  negro puro.
- **ink-soft / ink-faint**: texto secundario/terciario sobre fondo claro.
- **surface / surface-alt**: fondos claros — `surface` blanco puro para
  tarjetas destacadas, `surface-alt` (`#F3F5EF`) para bloques de contenido
  alterno dentro de una sección blanca.
- **green / red / orange**: estados (éxito, error, aviso) en formularios e
  indicadores — no se usan como color de marca.

## Typography

Tipografía de sistema (`-apple-system`/SF Pro) en absolutamente todo el
texto de producto — títulos, cuerpo, botones, formularios. **El logotipo
"Aify" es una imagen**: los SVG de `public/marca/` (texto en trazados, sin
fuente; componente `src/components/Marca.jsx`), con `tamano` = el cuerpo que
tendría el texto (`logotype`, arriba). La fuente display (`--font-display`,
Fredoka, OFL) es solo para los pocos acentos que no son el logo; nunca para
titulares ni CTAs.

- `h1`: hero de páginas públicas — `clamp(32px, 5.2vw, 52px)`, 700,
  letter-spacing negativo (`-1.5px`) para compactar el trazo a ese tamaño.
- `h2`: títulos de sección — `clamp(28px, 4.2vw, 40px)`, 700, `-1px`.
- `body-md` / `body-sm`: cuerpo de texto y texto secundario, sin tracking
  especial.
- `label-caps`: eyebrows/badges en mayúsculas (`"BETA POR INVITE-CODE"`,
  `"CHECKLIST DESCARGABLE"`) — 12px, 700, `+0.6px` de tracking, siempre
  `text-transform: uppercase`.

## Layout

Contenido público centrado con `max-width` entre 640px (bloques de texto
angosto, tipo CTA final) y 1100px (secciones anchas tipo comparativa
antes/después). Padding lateral de sección: `24px` en móvil sin excepción;
el layout nunca toca el borde del viewport. Grid a dos columnas
(`.marketing-2col`) colapsa a una columna por debajo de 900px.

## Elevation & Depth

Sin sombras difusas de Material Design — la profundidad viene de contraste
de color plano entre bloques (tarjeta `ink` sobre fondo `surface`, o
`surface-alt` sobre `surface`), no de `box-shadow`. Excepción: el CTA
primario del hero puede llevar una sombra sutil (`0 8px 28px
rgba(0,0,0,0.18)`) para que flote sobre el degradado.

## Shapes

Esquinas siempre redondeadas, nunca ángulo recto en superficies
interactivas — de `rounded.xs` (4px, chips pequeños) a `rounded.xl` (24px,
tarjetas grandes). Botones y pills de navegación usan `rounded.full`
(cápsula completa), nunca un radio intermedio.

## Components

Ver bloque `components` del front matter — cubre los patrones ya en
producción (`src/pages/marketing/shared.jsx`): `button-primary` (CTA lima),
`button-secondary` (enlace ghost en el navbar), `card-dark`/`card-light`
(los dos fondos de tarjeta de captura/CTA), `input` (fondo blanco explícito
— un input sin `backgroundColor` fijo quedó invisible sobre `card-dark` en
`/checklist` hasta que se corrigió, ver commit `530010f`).

## Do's and Don'ts

- ✅ Reutiliza los tokens de este archivo al construir cualquier página
  pública nueva (`src/pages/marketing/shared.jsx` ya los exporta como
  constantes JS con estos mismos nombres/valores).
- ✅ Un único acento lima por vista para la acción primaria.
- ❌ No introduzcas una paleta nueva para una pieza de marketing puntual sin
  verificar antes contra este archivo — ya pasó una vez: el primer artefacto
  de pines de Pinterest usó negro + tipografía Archivo Black, una paleta que
  no es la marca real de Aify, y hubo que rehacer los carruseles con los
  tokens correctos.
- ❌ No escribas el logotipo "Aify" con una fuente: usa la marca SVG de `public/marca/`.
- ❌ No añadas `box-shadow` difuso genérico — usa contraste de color plano
  (ver Elevation & Depth).

## 🔗 Relacionado

- `src/pages/Landing.jsx` — origen de estos tokens (constantes `SKY_DEEP`,
  `LIME`, `INK`, etc. en cabecera del archivo).
- `src/pages/marketing/shared.jsx` — mismos tokens re-exportados para
  `/agencias`, `/checklist`, `/calculadora`.
