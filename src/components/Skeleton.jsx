export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style = {} }) {
  return (
    <div
      className="skeleton-shimmer"
      style={{ width, height, borderRadius, ...style }}
    />
  )
}

export function SkeletonClienteCard() {
  return (
    <div style={{
      background: 'white', borderRadius: 20, padding: '22px',
      boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
      border: '1px solid rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 }}>
        <Skeleton width={52} height={52} borderRadius={16} />
        <div style={{ flex: 1 }}>
          <Skeleton height={16} style={{ width: '65%', marginBottom: 8 }} />
          <Skeleton height={18} borderRadius={20} style={{ width: '38%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
        <Skeleton width={72} height={22} borderRadius={20} />
        <Skeleton width={58} height={22} borderRadius={20} />
        <Skeleton width={64} height={22} borderRadius={20} />
      </div>
      <Skeleton height={1} style={{ marginBottom: 14, borderRadius: 0 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton height={11} style={{ width: '32%' }} />
        <Skeleton width={52} height={22} borderRadius={8} />
      </div>
    </div>
  )
}

export function SkeletonDetalleHeader() {
  return (
    <div style={{ padding: '32px 40px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <Skeleton width={64} height={64} borderRadius={20} />
        <div style={{ flex: 1 }}>
          <Skeleton height={28} style={{ width: '40%', marginBottom: 10 }} />
          <Skeleton height={18} borderRadius={20} style={{ width: '22%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[80, 70, 90, 75, 85].map((w, i) => (
          <Skeleton key={i} width={w} height={34} borderRadius={10} />
        ))}
      </div>
    </div>
  )
}
