import { motion } from 'framer-motion'
import { MessageCircle, Sparkles, Users, Zap } from 'lucide-react'

const FEATURES = [
  { icon: MessageCircle, text: 'Mensajes exclusivos adaptados al tono de cada cliente' },
  { icon: Users, text: 'Segmentacion por tipo de audiencia y canal' },
  { icon: Zap, text: 'Integracion con WhatsApp Business API' },
  { icon: Sparkles, text: 'Generacion automatica con IA segun temporada' },
]

export default function WhatsAppCanal() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12 }}
        style={{ textAlign: 'center', maxWidth: 460 }}
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{
            width: 80, height: 80, borderRadius: 24,
            background: 'linear-gradient(135deg, rgba(0,123,255,0.12), rgba(61,155,255,0.12))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 32px rgba(29,95,224,0.12)',
          }}
        >
          <MessageCircle size={36} color="#1D5FE0" strokeWidth={1.6} />
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ marginBottom: 14 }}
        >
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 700,
            color: 'var(--text-secondary)', background: 'var(--bg-hover)',
            padding: '4px 12px', borderRadius: 20, letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>
            En desarrollo
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.5px' }}
        >
          WhatsApp Canal
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent-blue)', margin: '0 0 16px' }}
        >
          Proximamente
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 32px' }}
        >
          Estamos construyendo la herramienta definitiva para crear y gestionar mensajes para canales de WhatsApp Business. Adaptados al tono de cada cliente, listos para enviar.
        </motion.p>

        {/* Feature list */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            background: 'var(--bg-card)', borderRadius: 16, padding: '20px 24px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
          }}
        >
          {FEATURES.map(({ icon: Icon, text }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 + i * 0.06 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: i < FEATURES.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: 'rgba(29,95,224,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={15} color="#1D5FE0" />
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', textAlign: 'left' }}>{text}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
