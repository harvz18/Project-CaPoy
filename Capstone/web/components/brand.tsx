import { MdiIcon } from './icons'
import { mdiCalendarStar } from '@mdi/js'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <span className="brand__mark"><MdiIcon path={mdiCalendarStar} size={0.95} /></span>
      <span className="brand__copy">
        <strong>MULTIVENT</strong>
        {!compact && <small>Events, thoughtfully managed</small>}
      </span>
    </div>
  )
}
