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
      <Image
        className="brand__wordmark"
        src="/multivent-metallic-wordmark.png"
        alt=""
        width={2172}
        height={724}
        priority={compact}
      />
    </div>
  )
}
