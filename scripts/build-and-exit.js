// `vite build` (con vite-prerender-plugin) escribe dist/ correctamente y
// registra "Prerendered N pages" pero luego no cierra el proceso solo —
// se queda colgado indefinidamente (reproducido en local y en Vercel,
// donde llegó a superar los 6 minutos sin terminar nunca). Este wrapper
// lanza `vite build`, observa su stdout, y en cuanto ve la línea de éxito
// del prerender fuerza el cierre con exit 0 — en ese punto dist/ ya está
// completo, así que no hay riesgo de cortar una escritura a medias.
import { spawn } from 'node:child_process'

// detached:true hace que el hijo (npx) sea líder de su propio grupo de
// procesos, así que -child.pid (negativo) mata a todo ese grupo de una
// vez — el propio npx, vite, y cualquier proceso que vite/el plugin de
// prerender haya lanzado por debajo. Solo matar `child` (npx) no basta:
// vite/el prerender headless quedan huérfanos y siguen vivos, y como
// heredan los mismos file descriptors de stdout/stderr, el pipe nunca
// llega a EOF y quien esté esperando esta llamada (el propio `npm run
// build`, o Vercel) se queda colgado para siempre aunque este proceso sí
// haya terminado.
const child = spawn('npx', ['vite', 'build'], { stdio: ['inherit', 'pipe', 'inherit'], detached: true })

let finished = false

function finish(code) {
  if (finished) return
  finished = true
  try { process.kill(-child.pid, 'SIGKILL') } catch { /* ya estaba muerto */ }
  process.exit(code)
}

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk)
  if (/Prerendered \d+ pages?:/.test(chunk.toString())) {
    // Pequeño margen para que termine de volcar el resto del log/flush de
    // disco antes de forzar la salida.
    setTimeout(() => finish(0), 1000)
  }
})

child.on('exit', (code) => finish(code ?? 1))
child.on('error', () => finish(1))

// Red de seguridad si por lo que sea nunca aparece la línea de "Prerendered"
// (build sin prerender, o el propio build falla de otra forma silenciosa):
// no colgar el deploy para siempre, fallar explícito a los 5 minutos.
setTimeout(() => {
  if (!finished) {
    console.error('[build-and-exit] Timeout: "vite build" no terminó en 5 minutos.')
    finish(1)
  }
}, 5 * 60 * 1000)
