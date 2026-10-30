import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, fallback }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', background: '#F5F5F7', gap: 20,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'linear-gradient(135deg, #007BFF, #4DA3FF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 30px rgba(29,95,224,0.3)',
        }}>
          <Zap size={24} color="white" />
        </div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 22, height: 22, borderRadius: '50%',
            border: '2.5px solid rgba(29,95,224,0.15)',
            borderTopColor: '#1D5FE0',
          }}
        />
      </div>
    )
  }

  if (!user) return fallback ?? <Navigate to="/login" replace />

  return children
}
