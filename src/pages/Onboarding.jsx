import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../services/supabase'
import { markOnboardingCompleto } from '../utils/onboarding'
import { guardarModoCobroDesdeOnboarding } from '../hooks/useOrganizacion'
import Marca from '../components/Marca'
import {
  ArrowRight, ArrowLeft, Check,
  Megaphone, TrendingUp, Image, Search, Star, Code,
  User, Users, Building, Building2,
  BarChart2, Bot, LineChart, Layout, Table, X,
  Clock, Lightbulb, Shield, Calendar, Edit, Layers, Award,
  CalendarCheck, PackageCheck,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────────

const PERFIL_KEY = 'aify_usuario_perfil'

// ── Step config ────────────────────────────────────────────────────────────────

const TIPOS_AGENCIA = [
  { id: 'marketing', icon: Megaphone, label: 'Marketing Digital', desc: 'Redes sociales, contenido, copies, calendarios', available: true },
  { id: 'paid', icon: TrendingUp, label: 'Publicidad y Paid Media', desc: 'SEM, Meta Ads, Google Ads', available: false },
  { id: 'diseno', icon: Image, label: 'Diseño y Creatividad', desc: 'Branding, UI/UX, creatividades', available: false },
  { id: 'seo', icon: Search, label: 'SEO y Contenidos', desc: 'Posicionamiento web, blog, link building', available: false },
  { id: 'branding', icon: Star, label: 'Branding e Identidad', desc: 'Identidad visual, naming, posicionamiento', available: false },
  { id: 'dev', icon: Code, label: 'Desarrollo Web', desc: 'Webs, apps, tiendas online', available: false },
]

const NUM_CLIENTES = [
  { id: '1-3', icon: User, label: '1 a 3 clientes', desc: 'Empezando o muy selectivo' },
  { id: '4-10', icon: Users, label: '4 a 10 clientes', desc: 'Agencia pequeña o freelance consolidado' },
  { id: '11-25', icon: Building, label: '11 a 25 clientes', desc: 'Agencia en crecimiento' },
  { id: '25+', icon: Building2, label: 'Más de 25 clientes', desc: 'Agencia establecida o gran volumen' },
]

// Mismos ids que organizaciones.modo_cobro (0026_modo_cobro.sql)
const MODOS_COBRO = [
  { id: 'adelantado', icon: CalendarCheck, label: 'Por adelantado', desc: 'La factura del mes sale al empezar' },
  { id: 'al_entregar', icon: PackageCheck, label: 'Al entregar', desc: 'La factura sale al publicar' },
]

const HERRAMIENTAS = [
  { id: 'metricool', icon: BarChart2, label: 'Metricool' },
  { id: 'canva', icon: Image, label: 'Canva' },
  { id: 'chatgpt', icon: Bot, label: 'ChatGPT / Claude' },
  { id: 'analytics', icon: LineChart, label: 'Google Analytics' },
  { id: 'notion', icon: Layout, label: 'Notion / Trello' },
  { id: 'sheets', icon: Table, label: 'Excel / Google Sheets' },
  { id: 'ninguna', icon: X, label: 'Ninguna herramienta' },
]

const OBJETIVOS = [
  { id: 'tiempo', icon: Clock, label: 'Ahorrar tiempo en crear contenido' },
  { id: 'ideas', icon: Lightbulb, label: 'Generar más ideas creativas' },
  { id: 'marca', icon: Shield, label: 'Mantener consistencia de marca' },
  { id: 'calendarios', icon: Calendar, label: 'Crear calendarios más rápido' },
  { id: 'copies', icon: Edit, label: 'Mejorar la calidad de los copies' },
  { id: 'organizacion', icon: Layers, label: 'Tener todo organizado en un solo lugar' },
  { id: 'entregables', icon: Award, label: 'Impresionar a mis clientes con entregables' },
]

const LOADING_TEXTS = [
  'Configurando tu espacio de trabajo...',
  'Adaptando Aify a tu agencia...',
  'Preparando tus herramientas de marketing...',
  '¡Todo listo!',
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProgressDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === current ? 20 : 6,
            background: i === current ? '#D7FF3D' : i < current ? '#D7FF3D' : 'rgba(0,0,0,0.12)',
            opacity: i < current ? 0.5 : 1,
          }}
          transition={{ duration: 0.3 }}
          style={{ height: 6, borderRadius: 3 }}
        />
      ))}
    </div>
  )
}

function OptionCard({ icon: Icon, label, desc, selected, onClick, disabled, badge }) {
  return (
    <motion.div
      whileHover={!disabled ? { y: -2, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={disabled ? undefined : onClick}
      title={disabled ? 'Próximamente disponible' : undefined}
      style={{
        background: selected ? 'rgba(29,95,224,0.06)' : 'var(--bg-card)',
        border: selected ? '2px solid #1D5FE0' : '1.5px solid var(--border-color)',
        borderRadius: 16, padding: '18px 20px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', opacity: disabled ? 0.55 : 1,
        transition: 'border 0.15s, background 0.15s',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      {badge && (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
          background: disabled ? 'rgba(0,0,0,0.07)' : 'rgba(52,199,89,0.15)',
          color: disabled ? '#86868B' : '#30D158',
        }}>
          {badge}
        </span>
      )}
      {selected && (
        <div style={{ position: 'absolute', top: 12, right: badge ? 70 : 12, width: 20, height: 20, borderRadius: '50%', background: '#1D5FE0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={11} color="white" strokeWidth={2.5} />
        </div>
      )}
      <div style={{ width: 38, height: 38, borderRadius: 11, background: selected ? 'rgba(29,95,224,0.12)' : 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={selected ? '#1D5FE0' : '#86868B'} strokeWidth={1.8} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: selected ? '#1D5FE0' : 'var(--text-primary)', letterSpacing: '-0.2px' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>
    </motion.div>
  )
}

function MultiCard({ icon: Icon, label, selected, onClick }) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderRadius: 12,
        border: selected ? '1.5px solid #1D5FE0' : '1.5px solid rgba(0,0,0,0.1)',
        background: selected ? 'rgba(29,95,224,0.06)' : 'var(--bg-card)',
        cursor: 'pointer', transition: 'border 0.15s, background 0.15s',
      }}
    >
      <Icon size={16} color={selected ? '#1D5FE0' : '#86868B'} strokeWidth={1.8} />
      <span style={{ fontSize: 13, fontWeight: selected ? 600 : 400, color: selected ? '#1D5FE0' : 'var(--text-primary)' }}>{label}</span>
      {selected && <Check size={13} color="#1D5FE0" style={{ marginLeft: 'auto' }} strokeWidth={2.5} />}
    </motion.div>
  )
}

function BigInput({ value, onChange, placeholder, autoFocus }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{
        width: '100%', padding: '16px 20px',
        fontSize: 22, fontWeight: 400,
        border: 'none', borderBottom: '2px solid rgba(0,0,0,0.12)',
        outline: 'none', background: 'transparent',
        color: 'var(--text-primary)', fontFamily: 'inherit',
        letterSpacing: '-0.3px', boxSizing: 'border-box',
        transition: 'border-color 0.2s',
      }}
      onFocus={e => { e.target.style.borderBottomColor = '#1D5FE0' }}
      onBlur={e => { e.target.style.borderBottomColor = 'rgba(0,0,0,0.12)' }}
    />
  )
}

// ── Loading animation ──────────────────────────────────────────────────────────

function LoadingScreen({ agencia, onDone }) {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const timers = LOADING_TEXTS.map((_, i) =>
      setTimeout(() => {
        setStep(i)
        if (i === LOADING_TEXTS.length - 1) {
          setTimeout(() => setDone(true), 800)
        }
      }, i * 620)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    if (done) onDone()
  }, [done]) // eslint-disable-line

  if (done) return null

  const text = LOADING_TEXTS[step].replace('tu agencia', agencia || 'tu agencia')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 28 }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(29,95,224,0.15)', borderTopColor: '#1D5FE0' }}
      />
      <AnimatePresence mode="wait">
        <motion.p
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'center', letterSpacing: '-0.3px' }}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

// ── Confirmation screen ────────────────────────────────────────────────────────

function ConfirmScreen({ perfil, onEnter }) {
  const sugerencias = []
  if (perfil.numClientes === '1-3') sugerencias.push('Empieza añadiendo tu primer cliente')
  else sugerencias.push('Importa tus clientes actuales a Aify')
  if (perfil.objetivos.includes('calendarios')) sugerencias.push('Genera tu primer calendario en 30 segundos')
  if (perfil.objetivos.includes('tiempo')) sugerencias.push('Activa la generación automática con IA')
  if (perfil.herramientas.includes('metricool')) sugerencias.push('Conecta Metricool para importar métricas reales')
  const top3 = sugerencias.slice(0, 3)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20 }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        style={{
          width: 80, height: 80, borderRadius: '50%',
          background: '#1D5FE0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 700, color: 'white',
          boxShadow: '0 8px 30px rgba(29,95,224,0.4)',
        }}
      >
        {(perfil.nombre || 'A').charAt(0).toUpperCase()}
      </motion.div>

      <div>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.6px', marginBottom: 8 }}>
          ¡Todo listo, {perfil.nombre}!
        </h2>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Tu espacio de trabajo en Aify está configurado para {perfil.agencia || 'tu agencia'}
        </p>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 16, padding: '18px 22px', width: '100%', maxWidth: 400, textAlign: 'left' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
          Para empezar
        </div>
        {top3.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < top3.length - 1 ? 10 : 0 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1D5FE0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{i + 1}</span>
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s}</span>
          </div>
        ))}
      </div>

      <motion.button
        whileHover={{ backgroundColor: '#BEE62A', y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={onEnter}
        style={{
          width: '100%', maxWidth: 400, height: 54, borderRadius: 14,
          background: '#D7FF3D', color: '#0B0C10',
          fontSize: 17, fontWeight: 600, border: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 4px 24px rgba(215,255,61,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        Entrar a Aify <ArrowRight size={18} />
      </motion.button>
    </motion.div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7 // steps 0-6 (visual steps 1-7), then loading + confirm

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const [nombre, setNombre] = useState('')
  const [agencia, setAgencia] = useState('')

  // Pre-fill nombre from registration metadata
  useEffect(() => {
    if (user?.user_metadata?.nombre && !nombre) {
      setNombre(user.user_metadata.nombre)
    }
  }, [user]) // eslint-disable-line
  const [tipoTrabajo, setTipoTrabajo] = useState('')
  const [tipoAgencia, setTipoAgencia] = useState('marketing')
  const [numClientes, setNumClientes] = useState('')
  const [modoCobro, setModoCobro] = useState('al_entregar')
  const [herramientas, setHerramientas] = useState([])
  const [objetivos, setObjetivos] = useState([])

  const canContinue = [
    nombre.trim().length > 0,
    agencia.trim().length > 0 && tipoTrabajo !== '',
    tipoAgencia !== '',
    numClientes !== '',
    true, // modo de cobro — siempre hay uno elegido (al entregar por defecto)
    true, // herramientas — optional
    objetivos.length > 0,
  ][step]

  const go = (dir) => {
    setDirection(dir)
    setStep(s => s + dir)
  }

  const toggleMulti = (arr, setArr, id) => {
    setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleFinish = async () => {
    const perfil = {
      email: user?.email || '',
      nombre: nombre.trim(),
      agencia: agencia.trim(),
      tipoTrabajo,
      tipoAgencia,
      numClientes,
      modoCobro,
      herramientas,
      objetivos,
      onboardingCompletado: true,
      fechaRegistro: new Date().toISOString(),
    }
    // Save to localStorage
    try {
      localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil))
      markOnboardingCompleto(user?.id)
      localStorage.setItem('aify_perfil', JSON.stringify({
        nombre: perfil.nombre,
        email: user?.email || '',
        agencia: perfil.agencia,
        pais: 'España',
        idioma: 'Español',
        avatarColor: '#1D5FE0',
      }))
    } catch { /* ignore */ }
    // Save to Supabase — the local flag above only marks this device as done;
    // without this actually landing, logging in from another device sends the
    // user through onboarding again even though they already have real data.
    // Retry a couple of times before giving up (still non-blocking beyond that).
    if (supabase) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { error } = await supabase.auth.updateUser({
            data: {
              nombre: perfil.nombre,
              agencia: perfil.agencia,
              modo_cobro: perfil.modoCobro,
              onboarding_completado: true,
            },
          })
          if (!error) break
          throw error
        } catch (err) {
          console.warn(`[Onboarding] Supabase update intento ${attempt + 1} falló:`, err.message)
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        }
      }
    }
    // Modo de cobro: se guarda en la organización si ya existe y eres su
    // owner; si no (lo normal en el primer onboarding), queda pendiente y
    // useOrganizacion lo aplica al crearla. No bloquea el final.
    await guardarModoCobroDesdeOnboarding(user, perfil.modoCobro)
    setLoading(true)
  }

  const stepVariants = {
    enter: (dir) => ({ x: dir * 60, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] } },
    exit: (dir) => ({ x: dir * -60, opacity: 0, transition: { duration: 0.22 } }),
  }

  if (loading && !done) {
    return (
      <div style={pageStyle}>
        <Logo />
        <div style={{ maxWidth: 500, width: '100%', padding: '0 24px' }}>
          <LoadingScreen
            agencia={agencia}
            onDone={() => setDone(true)}
          />
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={pageStyle}>
        <Logo />
        <div style={{ maxWidth: 520, width: '100%', padding: '0 24px' }}>
          <ConfirmScreen
            perfil={{ nombre, agencia, numClientes, herramientas, objetivos }}
            onEnter={() => navigate('/dashboard')}
          />
        </div>
      </div>
    )
  }

  const steps = [
    // Step 0 — Nombre
    <div key="0">
      <StepTitle>Hola, bienvenido a Aify</StepTitle>
      <StepSubtitle>Vamos a personalizar tu experiencia en 2 minutos</StepSubtitle>
      <div style={{ marginTop: 40 }}>
        <label style={labelStyle}>¿Cómo te llamas?</label>
        <BigInput
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Tu nombre"
          autoFocus
        />
      </div>
    </div>,

    // Step 1 — Agencia
    <div key="1">
      <StepTitle>¿Cómo se llama tu agencia?</StepTitle>
      <StepSubtitle>Este nombre aparecerá en toda la app y en los PDFs que exportes</StepSubtitle>
      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <label style={labelStyle}>Nombre de la agencia o negocio</label>
          <BigInput
            value={agencia}
            onChange={e => setAgencia(e.target.value)}
            placeholder="Nombre de tu agencia"
            autoFocus
          />
        </div>
        <div>
          <label style={labelStyle}>¿Cómo trabajas?</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <OptionCard icon={User} label="Freelance / Solo" desc="Trabajas de forma independiente" selected={tipoTrabajo === 'freelance'} onClick={() => setTipoTrabajo('freelance')} />
            <OptionCard icon={Users} label="Equipo / Agencia" desc="Tienes compañeros o empleados" selected={tipoTrabajo === 'equipo'} onClick={() => setTipoTrabajo('equipo')} />
          </div>
        </div>
      </div>
    </div>,

    // Step 2 — Tipo de agencia
    <div key="2">
      <StepTitle>¿En qué se especializa tu agencia?</StepTitle>
      <StepSubtitle>Aify se adaptará a tu tipo de trabajo</StepSubtitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 28 }}>
        {TIPOS_AGENCIA.map(t => (
          <OptionCard
            key={t.id}
            icon={t.icon}
            label={t.label}
            desc={t.desc}
            selected={tipoAgencia === t.id}
            disabled={!t.available}
            badge={t.available ? 'Disponible' : 'Próximamente'}
            onClick={() => t.available && setTipoAgencia(t.id)}
          />
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 14, textAlign: 'center' }}>
        ¿Tu especialidad no está aquí? La añadiremos pronto.
      </p>
    </div>,

    // Step 3 — Número de clientes
    <div key="3">
      <StepTitle>¿Cuántos clientes gestionas habitualmente?</StepTitle>
      <StepSubtitle>Esto nos ayuda a configurar Aify para tu volumen de trabajo</StepSubtitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 28 }}>
        {NUM_CLIENTES.map(n => (
          <OptionCard key={n.id} icon={n.icon} label={n.label} desc={n.desc} selected={numClientes === n.id} onClick={() => setNumClientes(n.id)} />
        ))}
      </div>
    </div>,

    // Step 4 — Modo de cobro
    <div key="4">
      <StepTitle>¿Cómo cobras a tus clientes?</StepTitle>
      <StepSubtitle>Aify preparará las facturas mensuales a tu ritmo. Puedes cambiarlo en Configuración o para cada cliente.</StepSubtitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 28 }}>
        {MODOS_COBRO.map(m => (
          <OptionCard key={m.id} icon={m.icon} label={m.label} desc={m.desc} selected={modoCobro === m.id} onClick={() => setModoCobro(m.id)} />
        ))}
      </div>
    </div>,

    // Step 5 — Herramientas
    <div key="5">
      <StepTitle>¿Qué herramientas usas ahora mismo?</StepTitle>
      <StepSubtitle>Así sabemos dónde puede ayudarte más Aify</StepSubtitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginTop: 28 }}>
        {HERRAMIENTAS.map(h => (
          <MultiCard
            key={h.id}
            icon={h.icon}
            label={h.label}
            selected={herramientas.includes(h.id)}
            onClick={() => toggleMulti(herramientas, setHerramientas, h.id)}
          />
        ))}
      </div>
    </div>,

    // Step 6 — Objetivos
    <div key="6">
      <StepTitle>¿Qué quieres mejorar con Aify?</StepTitle>
      <StepSubtitle>Selecciona todo lo que aplique</StepSubtitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginTop: 28 }}>
        {OBJETIVOS.map(o => (
          <MultiCard
            key={o.id}
            icon={o.icon}
            label={o.label}
            selected={objetivos.includes(o.id)}
            onClick={() => toggleMulti(objetivos, setObjetivos, o.id)}
          />
        ))}
      </div>
    </div>,
  ]

  return (
    <div style={pageStyle}>
      <Logo />

      <div style={{ maxWidth: 640, width: '100%', padding: '0 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <ProgressDots current={step} total={TOTAL_STEPS} />
        </div>

        <div style={{ minHeight: 380 }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {steps[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 40 }}>
          {step > 0 ? (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => go(-1)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 20px', borderRadius: 12, background: 'rgba(0,0,0,0.05)', border: 'none', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <ArrowLeft size={16} /> Atrás
            </motion.button>
          ) : <div />}

          <motion.button
            whileHover={canContinue ? { backgroundColor: '#BEE62A' } : {}}
            whileTap={canContinue ? { scale: 0.97 } : {}}
            onClick={canContinue ? (step < TOTAL_STEPS - 1 ? () => go(1) : handleFinish) : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 12,
              background: canContinue ? '#D7FF3D' : 'rgba(0,0,0,0.08)',
              color: canContinue ? '#0B0C10' : '#86868B',
              border: 'none', cursor: canContinue ? 'pointer' : 'not-allowed',
              fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            {step < TOTAL_STEPS - 1 ? 'Continuar' : 'Finalizar'}
            <ArrowRight size={16} />
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const pageStyle = {
  minHeight: '100vh', background: 'var(--bg-primary)',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: '40px 0 60px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
}

const labelStyle = { fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }

function Logo() {
  const { theme } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
      <Marca oscuro={theme === 'dark'} tamano={22} />
    </div>
  )
}

function StepTitle({ children }) {
  return (
    <h1 style={{ fontSize: 34, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.8px', lineHeight: 1.15, marginBottom: 10 }}>
      {children}
    </h1>
  )
}

function StepSubtitle({ children }) {
  return (
    <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{children}</p>
  )
}
