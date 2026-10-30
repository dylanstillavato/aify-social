import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { vitePrerenderPlugin } from 'vite-prerender-plugin'
import { readFileSync } from 'node:fs'

// Slugs de los artículos del blog, sacados del registro
// (src/pages/blog/articulos.js) para prerenderizar /blog/<slug> sin tener que
// apuntarlos a mano. Se leen como texto en vez de importar el módulo: importarlo
// arrastraría los componentes JSX de los artículos a la config de Vite.
const SLUGS_BLOG = [...readFileSync(new URL('./src/pages/blog/articulos.js', import.meta.url), 'utf8').matchAll(/slug: '([^']+)'/g)].map((m) => m[1])

// Emite dist/app.html: el index.html de Vite SIN prerender (#root vacío).
// vercel.json reescribe a este shell todas las rutas que no son ficheros
// estáticos (app autenticada: /dashboard, /clientes/..., /login...), para que
// no reciban el HTML prerenderizado de la landing. Corre antes que
// vite-prerender-plugin (que rellena index.html en su propio
// generateBundle), así que copia la plantilla todavía vacía.
function appShellPlugin() {
  return {
    name: 'aify-app-shell',
    apply: 'build',
    // 'post' para correr después de vite:build-html (que emite index.html);
    // entre plugins 'post' manda el orden del array, y este va antes que
    // vitePrerenderPlugin.
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset') {
        this.error('aify-app-shell: no se encontró index.html en el bundle')
      }
      const source = String(index.source)
      if (!source.includes('<div id="root"></div>')) {
        this.error('aify-app-shell: index.html ya trae contenido en #root (¿cambió el orden de los plugins?)')
      }
      this.emitFile({ type: 'asset', fileName: 'app.html', source })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    appShellPlugin(),
    vitePrerenderPlugin({
      renderTarget: '#root', // mismo selector que usa src/main.jsx
      prerenderScript: new URL('./src/entry-prerender.jsx', import.meta.url).pathname,
      // Rutas públicas de marketing prerenderizadas — ver PAGES/TITLES en
      // src/entry-prerender.jsx.
      additionalPrerenderRoutes: ['/', '/demo', '/agencias', '/checklist', '/calculadora', '/palabras-clave', '/recursos/reels-ia', '/privacidad', '/terminos', '/cookies', '/blog', ...SLUGS_BLOG.map((slug) => `/blog/${slug}`)],
    }),
  ],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3011',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
    },
  },
})
