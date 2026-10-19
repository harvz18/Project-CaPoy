export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="MULTIVENT">
      <span className="brand__mark" aria-hidden="true">M</span>
      <span className="brand__copy">
        <strong>MULTIVENT</strong>
        {!compact && <small>Events, thoughtfully managed</small>}
      </span>
    </div>
  )
}
