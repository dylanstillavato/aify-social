import { useState } from 'react'
import { motion } from 'framer-motion'
import { BadgeCheck, FileSignature, Plus, UserPlus } from 'lucide-react'
import { useNumeroUsuario } from '../hooks/useNumeroUsuario'

// Tarjeta de saludo del Inicio: saludo según la hora, frase del día y, para
// los primeros 50 usuarios, el reverso con su número de socio fundador al
// hacer clic. Abajo, lo que pase el Inicio como children (la barra del
// objetivo del mes) y los botones Presupuesto y Crear.

const SALUDOS_MADRUGADA = [
  'Vaya noctámbulo', 'Menudo trabajador', 'Directo al grano a estas horas', 'Qué horas son estas',
]

// De madrugada (00:00-05:59) "buenos días" no tiene sentido: mejor un mensaje
// con algo de personalidad. Fuera de esa franja, para que no suene siempre
// igual, a veces se usa un saludo corto en vez del literal por hora del día.
function getGreeting() {
  const h = new Date().getHours()
  if (h < 6) return SALUDOS_MADRUGADA[Math.floor(Math.random() * SALUDOS_MADRUGADA.length)]
  if (Math.random() < 0.3) return Math.random() < 0.5 ? 'Hola' : 'Buenas'
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// Frases sobre los dolores que Aify soluciona: una por día, estable 24 h
const FRASES = [
  'Se acabó mirar la pantalla en blanco cada lunes.',
  'Tus clientes no esperan, y tú tampoco deberías.',
  'Menos horas planificando, más horas vendiendo.',
  'Ideas listas antes de que se te acabe el café.',
  'Cero excusas para publicar tarde otra vez.',
  'Contenido para toda la semana, resuelto en minutos.',
  'Deja de improvisar guiones a las once de la noche.',
  'Tu agencia, con la cabeza despejada.',
]

function fraseDelDia(fecha) {
  const dia = Math.floor((fecha - new Date(fecha.getFullYear(), 0, 0)) / 86400000)
  return FRASES[dia % FRASES.length]
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function formatDesde(fechaISO) {
  if (!fechaISO) return ''
  const d = new Date(fechaISO)
  return `${MESES_CORTOS[d.getMonth()]}, ${d.getFullYear()}`
}

// aify_usuario_perfil es una clave global del navegador: con el selector de
// cuentas puede ser de otra cuenta, así que solo vale si el email coincide.
function getNombre(userEmail) {
  try {
    const op = JSON.parse(localStorage.getItem('aify_usuario_perfil'))
    if (op?.nombre && op?.email === userEmail) return op.nombre
    const cp = JSON.parse(localStorage.getItem('aify_perfil'))
    if (cp?.nombre && cp?.email === userEmail) return cp.nombre
    return ''
  } catch { return '' }
}

const botonTarjeta = (primario) => ({
  display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 999,
  border: primario ? 'none' : '1px solid rgba(255,255,255,0.35)',
  background: primario ? '#D7FF3D' : 'rgba(255,255,255,0.16)',
  color: primario ? '#0B0C10' : 'white',
  fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  backdropFilter: primario ? undefined : 'blur(12px)',
})

export default function TarjetaSaludo({ user, sinClientes, children, onNuevoPresupuesto, onCrear, onNuevoCliente }) {
  const nombre = getNombre(user?.email) || user?.user_metadata?.nombre || user?.email?.split('@')[0] || ''
  // Una vez al montar: si no, el saludo cambiaría al azar en cada render
  const [saludo] = useState(getGreeting)
  const [frase] = useState(() => fraseDelDia(new Date()))
  const numeroUsuario = useNumeroUsuario()
  const esFundador = typeof numeroUsuario === 'number' && numeroUsuario <= 50
  const [volteada, setVolteada] = useState(false)

  return (
    <div style={{ perspective: 1200, height: '100%' }}>
      <motion.div
        animate={{ rotateY: esFundador && volteada ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        onClick={() => esFundador && setVolteada(v => !v)}
        title={esFundador ? 'Eres uno de nuestros primeros 50 usuarios' : undefined}
        style={{
          position: 'relative', transformStyle: 'preserve-3d', borderRadius: 24, height: '100%',
          boxShadow: '0 10px 40px rgba(0,123,255,0.3)', cursor: esFundador ? 'pointer' : 'default',
        }}
      >
        {/* Frente */}
        <div style={{
          background: 'var(--gradient-brand)', borderRadius: 24, padding: '26px 28px 24px', color: 'white', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          position: 'relative', overflow: 'hidden', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, right: 80, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 20, right: 120, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: '1 1 360px' }}>
              <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.6px', margin: '0 0 8px', lineHeight: 1.2 }}>
                {nombre
                  ? <>{saludo}, <span style={{ fontFamily: 'var(--font-display)' }}>{nombre}</span></>
                  : sinClientes ? 'Bienvenido a Aify' : saludo}
                {esFundador && (
                  <span style={{
                    display: 'inline-block', marginLeft: 10, verticalAlign: 'middle', fontSize: 12, fontWeight: 700,
                    color: '#007BFF', background: 'white', padding: '2px 9px', borderRadius: 10, letterSpacing: '0.2px',
                  }}>
                    #{numeroUsuario}
                  </span>
                )}
              </h1>

              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', margin: 0, fontWeight: 500 }}>{frase}</p>
            </div>
          </div>

          {/* Fila de abajo: objetivo del mes y acciones */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
            <div style={{ flex: '1 1 260px', minWidth: 0 }} onClick={e => e.stopPropagation()}>
              {sinClientes ? (
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => onNuevoCliente?.()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 12, background: 'white', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#007BFF', fontFamily: 'inherit' }}>
                  <UserPlus size={15} /> Añadir tu primer cliente
                </motion.button>
              ) : children}
            </div>
            {/* Juntos: con la tarjeta a media anchura bajan los dos a la vez */}
            <div style={{ display: 'flex', gap: 10 }}>
              <motion.button whileTap={{ scale: 0.97 }} style={botonTarjeta(false)}
                onClick={(e) => { e.stopPropagation(); onNuevoPresupuesto?.() }}>
                <FileSignature size={14} /> Presupuesto
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} style={botonTarjeta(true)}
                onClick={(e) => { e.stopPropagation(); onCrear?.() }}>
                <Plus size={15} strokeWidth={2.4} /> Crear
                <kbd style={{ fontFamily: 'inherit', fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 6, background: 'rgba(11,12,16,0.1)', color: 'rgba(11,12,16,0.7)' }}>⌘K</kbd>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Reverso: insignia de socio fundador, solo para los primeros 50 */}
        {esFundador && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden',
            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
            background: 'radial-gradient(ellipse 480px 260px at 50% 45%, rgba(0,123,255,0.45), transparent 70%), linear-gradient(135deg, #0a0d14 0%, #050608 100%)',
          }}>
            <div style={{ position: 'relative', zIndex: 1, height: '100%', padding: '26px 30px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)' }}>Eres nuestro usuario</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>Aify</span>
              </div>
              <div style={{
                fontSize: 46, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1,
                background: 'linear-gradient(135deg, #9CC9FF, #007BFF)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                #{String(numeroUsuario).padStart(4, '0')}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 16px',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'white' }}>
                  {nombre}
                  <BadgeCheck size={15} color="#4DA3FF" />
                </span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                  Desde <strong style={{ color: 'white', fontWeight: 600 }}>{formatDesde(user?.created_at)}</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
