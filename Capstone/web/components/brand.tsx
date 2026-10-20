import Image from 'next/image'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="MULTIVENT">
      <Image
        className="brand__logo"
        src="/multivent-metallic-logo.png"
        alt=""
        width={48}
        height={48}
        priority={compact}
      />
      <span className="brand__copy">
        <strong>MULTIVENT</strong>
        {!compact && <small>Events, thoughtfully managed</small>}
      </span>
    </div>
  )
}
