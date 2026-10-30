import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react'
import { Eraser } from 'lucide-react'

// Canvas-based signature capture. Draw state lives in a ref (not React state)
// so pointer-move handling never waits on a re-render. The canvas background
// is always painted white — independent of the app's dark/light theme — so a
// PNG export (used both as the stored firma_data_url and embedded in the PDF)
// stays legible regardless of which theme the signer's browser is in.
const SignaturePad = forwardRef(function SignaturePad(
  { width = 460, height = 180, style = {} },
  ref
) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const lastPoint = useRef(null)
  const hasDrawn = useRef(false)
  const [isEmptyState, setIsEmptyState] = useState(true)

  const getCtx = () => canvasRef.current?.getContext('2d')

  const paintBackground = () => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Render at devicePixelRatio for crisp strokes, keep CSS size fixed.
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = getCtx()
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.2
    ctx.strokeStyle = '#1D1D1F'
    paintBackground()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  const pointFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = (e) => {
    e.preventDefault()
    canvasRef.current.setPointerCapture?.(e.pointerId)
    drawing.current = true
    lastPoint.current = pointFromEvent(e)
  }

  const handlePointerMove = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = getCtx()
    const pt = pointFromEvent(e)
    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    lastPoint.current = pt
    if (!hasDrawn.current) {
      hasDrawn.current = true
      setIsEmptyState(false)
    }
  }

  const handlePointerUp = (e) => {
    if (!drawing.current) return
    drawing.current = false
    canvasRef.current.releasePointerCapture?.(e.pointerId)
    lastPoint.current = null
  }

  useImperativeHandle(ref, () => ({
    clear() {
      paintBackground()
      hasDrawn.current = false
      setIsEmptyState(true)
    },
    isEmpty() {
      return !hasDrawn.current
    },
    toDataURL() {
      return canvasRef.current?.toDataURL('image/png') || ''
    },
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      <div
        style={{
          borderRadius: 12, border: '1.5px dashed var(--border-color)',
          background: '#FFFFFF', overflow: 'hidden', width, touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width, height, display: 'block', cursor: 'crosshair', touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {isEmptyState ? 'Firma aquí con el ratón o el dedo' : 'Firma capturada'}
        </span>
        <button
          type="button"
          onClick={() => {
            paintBackground()
            hasDrawn.current = false
            setIsEmptyState(true)
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            cursor: 'pointer', fontSize: 12, fontWeight: 500,
            color: 'var(--text-primary)', fontFamily: 'inherit',
          }}
        >
          <Eraser size={13} /> Borrar firma
        </button>
      </div>
    </div>
  )
})

export default SignaturePad
