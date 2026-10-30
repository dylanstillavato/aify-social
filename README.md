<h1 align="center">@Social</h1>

<p align="center"><i>Antes «Aify Social». Las apps de Aify llevan la @ delante, como la «i» de las de Apple.</i></p>

<p align="center">
  <b>El CRM gratis y de código abierto para gestores de redes.</b><br>
  Clientes, ideas, guiones, calendario, publicación en Instagram y TikTok y métricas, con la memoria de cada marca.<br>
  <a href="https://www.useaify.app">useaify.app</a> · parte de la familia <a href="https://www.useaify.app/demo">Aify</a> · <a href="https://github.com/dylanstillavato/aify-pictures">@Pictures</a>
</p>

## Qué es

@Social es la app que usamos para llevar las redes de nuestros clientes. Tiene:

- **Clientes:** una ficha por marca, con su tono, su sector, su público, lo prohibido y sus competidores.
- **Ideas y guiones:** lluvia de ideas y guiones de reels con gancho, desarrollo y cierre.
- **Calendario:** el mes de cada cliente; arrastrar entre días; aprobación de guiones por el cliente.
- **Publicar:** programar en Instagram (reels, posts, carruseles e historias) y en TikTok.
- **Métricas:** cada pieza a las 24 h, las visitas del mes y la bandeja de DMs.
- **MCP:** tu propio Claude o ChatGPT trabaja con tus clientes, ideas y calendario (`docs/mcp.md`).

Es gratis. **La IA la pone cada usuario («Tu IA»)**, nunca Aify:

1. **Conecta tu Claude o tu ChatGPT con tu plan**, con el conector MCP de Aify.
2. **O tu clave de API** de Claude o de Gemini. Se guarda cifrada en el servidor (con `AI_KEYS_SECRET`) y la usan los botones de IA.

Nunca pedimos la contraseña de Claude ni de ChatGPT.

## Ponerlo en marcha

```bash
npm install
cp .env.example .env   # rellena tus claves (Supabase, OAuth de Instagram, TikTok y Google, AI_KEYS_SECRET)
npm run dev:full       # frontend (Vite, :5174) + backend (Express, :3011)
```

- **Frontend:** React + Vite en `src/`. Lo desplegamos en Vercel (`vercel.json`).
- **Backend:** Express en `server.js` y el MCP en `mcp/servidor.js`. Lo desplegamos en Render (`render.yaml`).
- **Base de datos:** Supabase. Las migraciones están en `supabase/migrations/`, numeradas e idempotentes: se pegan en el SQL Editor en orden.
- **Guías:** Instagram en `docs/instagram-setup.md`, TikTok en `docs/tiktok-setup.md` y el MCP en `docs/mcp.md`.

## Mejóralo con nosotros

Es de código abierto para mejorarlo entre todos los que lo usan:

- **Ideas y fallos:** abre una issue (qué esperabas, qué pasó y una captura).
- **Código:** manda un PR pequeño y concreto, en español, con lo que cambia y cómo lo comprobaste. `npm run build` tiene que pasar.

## Licencia

[AGPL-3.0](LICENSE). Puedes usarlo, cambiarlo y montarlo para ti o para tus clientes. Si lo ofreces como servicio a otros, tienes que publicar tus cambios con la misma licencia.

Copyright © 2026 Aify y los colaboradores de @Social.
