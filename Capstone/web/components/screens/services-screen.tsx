'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  mdiArrowLeft,
  mdiCheck,
  mdiClose,
  mdiEyeOutline,
  mdiImageMultipleOutline,
  mdiMagnify,
  mdiMapMarkerOutline,
  mdiPackageVariantClosed,
  mdiRefresh,
  mdiStorefrontOutline,
} from '@mdi/js'
import { MdiIcon } from '@/components/icons'
import { EmptyState, formatDate, formatMoney, InlineError, SegmentedFilter, StatusBadge, TableSkeleton } from '@/components/ui'
import { getSupabase } from '@/lib/supabase'
import { useStaff } from '@/components/dashboard-shell'

type ServicePackage = {
  discount_amount: number | null
  discount_type: string | null
  discount_value: number | null
  id: string
  name: string
  description: string | null
  price: number | null
  inclusions: unknown
  is_active: boolean
  is_deleted: boolean
  pricing_unit: string | null
  service_package_items: Array<{
    position: number
    services: unknown
  }> | null
  subtotal: number | null
}

type Service = {
  id: string
  category_id: string | null
  name: string
  description: string | null
  base_price: number | null
  location: string | null
  cover_image_url: string | null
  gallery_urls: unknown
  pricing_model: string | null
  pricing_unit: string | null
  pricing_details: string | null
  status: string
  moderation_note: string | null
  submission_kind: 'new' | 'updated'
  last_approved_snapshot: unknown
  created_at: string
  updated_at: string
  provider_profiles: unknown
  service_categories: unknown
  service_packages: ServicePackage[] | null
}

type Decision = 'approved' | 'declined'
type ReviewCollection = 'services' | 'packages'

const serviceSelection = `
  id, category_id, name, description, base_price, location, cover_image_url, gallery_urls,
  pricing_model, pricing_unit, pricing_details, status, moderation_note,
  submission_kind, last_approved_snapshot,
  created_at, updated_at,
  provider_profiles(business_name, contact_email, contact_phone, location, verification_status),
  service_categories(name),
  service_packages(id, name, description, price, inclusions, pricing_unit, subtotal, is_active, is_deleted,
    discount_type, discount_value, discount_amount,
    service_package_items(position, services(name)))
`

export function ServicesScreen() {
  const { can } = useStaff()
  const [services, setServices] = useState<Service[]>([])
  const [selected, setSelected] = useState<Service | null>(null)
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null)
  const [collection, setCollection] = useState<ReviewCollection>('services')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadServices = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('services')
      .select(serviceSelection)
      .neq('status', 'deleted')
      .order('updated_at', { ascending: false })
      .limit(150)

    if (queryError) setError(queryError.message)
    else setServices((data || []) as unknown as Service[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    let active = true
    void supabase.from('services').select(serviceSelection).neq('status', 'deleted').order('updated_at', { ascending: false }).limit(150).then(({ data, error: queryError }) => {
      if (!active) return
      if (queryError) setError(queryError.message)
      else setServices((data || []) as unknown as Service[])
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const visibleServices = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return services.filter((service) => {
      const provider = nestedRecord(service.provider_profiles)
      const category = nestedRecord(service.service_categories)
      const matchesStatus = status === 'all' || service.status === status
      const matchesCategory = categoryFilter === 'all' || String(category?.name || '') === categoryFilter
      const matchesSearch = !needle || [service.name, service.description, provider?.business_name]
        .some((value) => String(value || '').toLowerCase().includes(needle))
      return matchesStatus && matchesCategory && matchesSearch
    })
  }, [categoryFilter, search, services, status])

  const packages = useMemo(() => services.flatMap((service) =>
    (service.service_packages || [])
      .filter((item) => !item.is_deleted)
      .map((item) => ({ item, service }))
  ), [services])

  const visiblePackages = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return packages.filter(({ item, service }) => {
      const provider = nestedRecord(service.provider_profiles)
      const category = nestedRecord(service.service_categories)
      const packageServices = (item.service_package_items || [])
        .map((entry) => String(nestedRecord(entry.services)?.name || ''))
        .filter(Boolean)
      const matchesStatus = status === 'all' || service.status === status
      const matchesCategory = categoryFilter === 'all' || String(category?.name || '') === categoryFilter
      const matchesSearch = !needle || [
        item.name,
        item.description,
        service.name,
        provider?.business_name,
        ...packageServices,
      ].some((value) => String(value || '').toLowerCase().includes(needle))
      return matchesStatus && matchesCategory && matchesSearch
    })
  }, [categoryFilter, packages, search, status])

  const pendingServiceCount = services.filter((service) => service.status === 'pending_review').length
  const pendingPackageCount = packages.filter(({ service }) => service.status === 'pending_review').length
  const pendingCount = collection === 'services' ? pendingServiceCount : pendingPackageCount
  const categories = Array.from(new Set(services.map((service) => String(nestedRecord(service.service_categories)?.name || '')).filter(Boolean))).sort()

  function requestDecision(nextDecision: Decision) {
    setNote('')
    setDecision(nextDecision)
  }

  async function submitDecision() {
    if (!selected || !decision || submitting) return
    if (decision === 'declined' && !note.trim()) return
    const supabase = getSupabase()
    if (!supabase) return

    setSubmitting(true)
    setError('')
    const { error: actionError } = await supabase.rpc('admin_review_service', {
      target_service_id: selected.id,
      decision,
      review_note: note.trim() || null,
    })
    setSubmitting(false)

    if (actionError) {
      const moderationFunctionMissing = actionError.code === 'PGRST202'
        || actionError.message.toLowerCase().includes('admin_review_service')
          && actionError.message.toLowerCase().includes('schema cache')
      setError(moderationFunctionMissing
        ? 'Listing moderation is not installed in this database. Apply migrations through 50, then refresh the page.'
        : actionError.message)
      setDecision(null)
      return
    }

    setDecision(null)
    setSelected(null)
    setSelectedPackage(null)
    await loadServices()
  }

  return (
    <div className="screen-stack">
      <section className="page-heading page-heading--with-action">
        <div><span className="eyebrow">MARKETPLACE</span><h1>Listing approvals</h1><p>Review provider services and packages before they become visible to clients.</p></div>
        <div className="heading-actions"><span className="queue-count"><i />{pendingCount} awaiting review</span><button className="secondary-button" onClick={() => void loadServices()}><MdiIcon path={mdiRefresh} /> Refresh</button></div>
      </section>

      <section className="panel data-panel">
        <div className="approval-type-tabs" role="tablist" aria-label="Listing type">
          <button type="button" role="tab" aria-selected={collection === 'services'} className={collection === 'services' ? 'active' : ''} onClick={() => setCollection('services')}>Services <span>{services.length}</span></button>
          <button type="button" role="tab" aria-selected={collection === 'packages'} className={collection === 'packages' ? 'active' : ''} onClick={() => setCollection('packages')}>Packages <span>{packages.length}</span></button>
        </div>
        <div className="table-toolbar service-toolbar">
          <label className="search-box"><MdiIcon path={mdiMagnify} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${collection} or providers…`} /></label>
          <SegmentedFilter
            ariaLabel={`Filter ${collection} by status`}
            value={status}
            onChange={setStatus}
            options={[["all", "All"], ["pending_review", "For review"], ["active", "Approved"], ["rejected", "Declined"]]}
          />
          <select className="inline-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter services by category"><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
        </div>
        {error && <InlineError message={error} onClose={() => setError('')} />}
        {loading ? <TableSkeleton /> : collection === 'services' && visibleServices.length === 0 ? <EmptyState title="No matching services" copy={status === 'pending_review' ? 'The service review queue is clear.' : 'Try another filter or search term.'} /> : collection === 'packages' && visiblePackages.length === 0 ? <EmptyState title="No matching packages" copy={status === 'pending_review' ? 'The package review queue is clear.' : 'Try another filter or search term.'} /> : collection === 'services' ? (
          <div className="service-review-list">
            {visibleServices.map((service) => {
              const provider = nestedRecord(service.provider_profiles)
              const category = nestedRecord(service.service_categories)
              return (
                <article key={service.id} className="service-review-row">
                  <ServiceImage service={service} />
                  <div className="service-review-row__main">
                    <div><strong>{service.name}</strong><StatusBadge value={service.status} /><SubmissionBadge kind={service.submission_kind} /></div>
                    <p>{String(provider?.business_name || 'Unknown provider')} · {String(category?.name || 'Uncategorized')}</p>
                    <small>{service.description || 'No service description provided.'}</small>
                  </div>
                  <div className="service-review-row__meta"><span>Provider price</span><strong>{service.base_price ? formatMoney(service.base_price) : 'Custom quote'}</strong><small>Submitted {formatDate(service.updated_at)}</small></div>
                  <button className="review-button" onClick={() => { setSelectedPackage(null); setSelected(service) }}><MdiIcon path={mdiEyeOutline} /> Review details</button>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="service-review-list">
            {visiblePackages.map(({ item, service }) => {
              const provider = nestedRecord(service.provider_profiles)
              const packageServices = (item.service_package_items || [])
                .sort((left, right) => left.position - right.position)
                .map((entry) => String(nestedRecord(entry.services)?.name || ''))
                .filter(Boolean)
              return (
                <article key={item.id} className="service-review-row">
                  <div className="service-review-image service-review-image--package"><MdiIcon path={mdiPackageVariantClosed} /></div>
                  <div className="service-review-row__main">
                    <div><strong>{item.name}</strong><StatusBadge value={service.status} /><SubmissionBadge kind={service.submission_kind} /></div>
                    <p>{String(provider?.business_name || 'Unknown provider')} · Package</p>
                    <small>{packageServices.length ? packageServices.join(' · ') : `Hosted by ${service.name}`}</small>
                  </div>
                  <div className="service-review-row__meta"><span>Package price</span><strong>{item.price ? formatMoney(item.price) : 'Custom quote'}</strong><small>Updated {formatDate(service.updated_at)}</small></div>
                  <button className="review-button" onClick={() => { setSelectedPackage(item); setSelected(service) }}><MdiIcon path={mdiEyeOutline} /> Review package</button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {selected && (
        <ServiceDetailModal
          canApprove={can('services.approve')}
          canReject={can('services.reject')}
          reviewTarget={selectedPackage ? 'package' : 'service'}
          selectedPackageId={selectedPackage?.id}
          service={selected}
          onClose={() => { setSelected(null); setSelectedPackage(null) }}
          onDecision={requestDecision}
        />
      )}

      {selected && decision && (
        <div className="modal-backdrop modal-backdrop--front" role="presentation">
          <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="decision-title">
            <span className={`confirmation-dialog__icon confirmation-dialog__icon--${decision}`}><MdiIcon path={decision === 'approved' ? mdiCheck : mdiClose} /></span>
            <h2 id="decision-title">{decision === 'approved' ? `Approve this ${selectedPackage ? 'package' : 'service'}?` : `Decline this ${selectedPackage ? 'package' : 'service'}?`}</h2>
            <p>{decision === 'approved'
              ? selectedPackage
                ? `${selectedPackage.name} and its host-listing revision will become visible to clients.`
                : selected.submission_kind === 'updated'
                  ? `The reviewed changes will replace the current version of ${selected.name} and become visible to clients.`
                  : `${selected.name} will immediately become visible and bookable by clients.`
              : `${selectedPackage?.name || selected.name} will remain hidden. The provider will receive your feedback.`}</p>
            <label className="decision-note"><span>{decision === 'approved' ? 'Note to provider (optional)' : 'Reason for declining'}</span><textarea autoFocus={decision === 'declined'} value={note} onChange={(event) => setNote(event.target.value)} placeholder={decision === 'declined' ? 'Explain what needs to be corrected before resubmission…' : 'Add a short approval note…'} /></label>
            <div className="confirmation-dialog__actions"><button className="secondary-button" disabled={submitting} onClick={() => setDecision(null)}>Cancel</button><button className={decision === 'approved' ? 'confirm-button confirm-button--approve' : 'confirm-button confirm-button--decline'} disabled={submitting || (decision === 'declined' && !note.trim())} onClick={() => void submitDecision()}>{submitting ? 'Saving decision…' : decision === 'approved' ? `Yes, approve ${selectedPackage ? 'package' : 'service'}` : `Yes, decline ${selectedPackage ? 'package' : 'service'}`}</button></div>
          </section>
        </div>
      )}
    </div>
  )
}

function ServiceDetailModal({ service, canApprove, canReject, reviewTarget, selectedPackageId, onClose, onDecision }: { service: Service; canApprove: boolean; canReject: boolean; reviewTarget: 'service' | 'package'; selectedPackageId?: string; onClose: () => void; onDecision: (decision: Decision) => void }) {
  const provider = nestedRecord(service.provider_profiles)
  const category = nestedRecord(service.service_categories)
  const packages = (service.service_packages || []).filter((item) => !item.is_deleted)
  const focusedPackage = packages.find((item) => item.id === selectedPackageId)
  const gallery = Array.isArray(service.gallery_urls) ? service.gallery_urls.filter((item): item is string => typeof item === 'string') : []
  const canReview = service.status === 'pending_review' || service.status === 'rejected'
  const changes = buildServiceChanges(service)

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="service-detail-modal" role="dialog" aria-modal="true" aria-labelledby="service-detail-title">
        <header><button onClick={onClose} aria-label="Close listing details"><MdiIcon path={mdiArrowLeft} /></button><div><span className="eyebrow">{reviewTarget === 'package' ? 'PACKAGE REVIEW' : 'SERVICE REVIEW'}</span><h2 id="service-detail-title">{focusedPackage?.name || service.name}</h2></div><StatusBadge value={service.status} /></header>
        <div className="service-detail-modal__body">
          <section className={`revision-summary revision-summary--${service.submission_kind}`}>
            <div className="revision-summary__heading">
              <SubmissionBadge kind={service.submission_kind} />
              <div>
                <strong>{service.submission_kind === 'updated' ? `Updated ${reviewTarget} submission` : `New ${reviewTarget} submission`}</strong>
                <p>{service.submission_kind === 'updated' ? 'Compare these changes with the last approved version before deciding.' : `This ${reviewTarget} has not been approved before.`}</p>
              </div>
            </div>
            {service.submission_kind === 'updated' && (
              changes.length > 0 ? (
                <div className="revision-changes">
                  {changes.map((change) => (
                    <article key={`${change.label}-${change.before}-${change.after}`}>
                      <strong>{change.label}</strong>
                      <div><span>Before</span><p>{change.before}</p></div>
                      <i aria-hidden="true">→</i>
                      <div><span>After</span><p>{change.after}</p></div>
                    </article>
                  ))}
                </div>
              ) : <p className="revision-summary__empty">No material field differences were detected. Check the full listing below before deciding.</p>
            )}
          </section>
          <div className="service-hero" style={service.cover_image_url ? { backgroundImage: `linear-gradient(180deg, transparent, rgba(38,15,22,.72)), url("${safeCssUrl(service.cover_image_url)}")` } : undefined}><span><MdiIcon path={mdiImageMultipleOutline} />{gallery.length + (service.cover_image_url ? 1 : 0)} photos</span></div>
          <div className="service-detail-grid">
            <main>
              <section className="detail-section"><span className="detail-label">DESCRIPTION</span><p>{service.description || 'The provider did not include a description.'}</p></section>
              <section className="detail-section"><span className="detail-label">PROVIDER PRICING</span><div className="price-summary"><strong>{service.base_price ? formatMoney(service.base_price) : 'Custom quote'}</strong><span>{formatPricing(service)}</span></div><p>MULTIVENT adds the configured commission on top when showing the client-facing price.</p>{service.pricing_details && <p>{service.pricing_details}</p>}</section>
              <section className="detail-section"><span className="detail-label">PACKAGES ({packages.length})</span>{packages.length ? <div className="package-review-list">{packages.map((item) => {
                const packageServices = (item.service_package_items || [])
                  .sort((left, right) => left.position - right.position)
                  .map((entry) => String(nestedRecord(entry.services)?.name || ''))
                  .filter(Boolean)
                const promo = item.discount_amount && item.discount_amount > 0
                  ? item.discount_type === 'percentage'
                    ? `${item.discount_value || 0}% discount`
                    : `${formatMoney(item.discount_amount)} discount`
                  : ''
                return <article key={item.id}><span><MdiIcon path={mdiPackageVariantClosed} /></span><div><strong>{item.name}</strong><p>{[item.description || formatInclusions(item.inclusions), packageServices.length ? `Services: ${packageServices.join(', ')}` : '', promo].filter(Boolean).join(' · ')}</p></div><b>{item.price ? formatMoney(item.price) : 'Quote'}</b></article>
              })}</div> : <p>No packages were added.</p>}</section>
            </main>
            <aside>
              <section className="provider-summary"><span><MdiIcon path={mdiStorefrontOutline} /></span><div><small>PROVIDER</small><strong>{String(provider?.business_name || 'Unknown provider')}</strong><p>{String(provider?.contact_email || 'No email')}</p></div></section>
              <dl className="service-facts"><div><dt>Category</dt><dd>{String(category?.name || 'Uncategorized')}</dd></div><div><dt>Location</dt><dd><MdiIcon path={mdiMapMarkerOutline} />{service.location || String(provider?.location || 'Not specified')}</dd></div><div><dt>Submitted</dt><dd>{formatDate(service.updated_at)}</dd></div></dl>
              {service.moderation_note && <div className="previous-note"><strong>Previous moderation note</strong><p>{service.moderation_note}</p></div>}
            </aside>
          </div>
        </div>
        <footer><button className="secondary-button" onClick={onClose}>Close</button>{canReview && (canApprove || canReject) && <div>{canReject && <button className="decline-button" onClick={() => onDecision('declined')}><MdiIcon path={mdiClose} /> Decline</button>}{canApprove && <button className="approve-button" onClick={() => onDecision('approved')}><MdiIcon path={mdiCheck} /> Approve {reviewTarget}</button>}</div>}</footer>
      </section>
    </div>
  )
}

function ServiceImage({ service }: { service: Service }) {
  return <div className="service-review-image" style={service.cover_image_url ? { backgroundImage: `url("${safeCssUrl(service.cover_image_url)}")` } : undefined}>{!service.cover_image_url && service.name.slice(0, 1).toUpperCase()}</div>
}

function SubmissionBadge({ kind }: { kind: Service['submission_kind'] }) {
  return <span className={`submission-badge submission-badge--${kind}`}>{kind === 'updated' ? 'Updated' : 'New'}</span>
}

type ServiceChange = { after: string; before: string; label: string }

function buildServiceChanges(service: Service): ServiceChange[] {
  const snapshot = nestedRecord(service.last_approved_snapshot)
  const beforeService = nestedRecord(snapshot?.service)
  if (!beforeService) return []

  const category = nestedRecord(service.service_categories)
  const fields: Array<[string, string, unknown, unknown]> = [
    ['name', 'Service name', beforeService.name, service.name],
    ['description', 'Description', beforeService.description, service.description],
    ['base_price', 'Base price', beforeService.base_price, service.base_price],
    ['category_id', 'Category', beforeService.category_name ?? beforeService.category_id, category?.name ?? service.category_id],
    ['location', 'Location', beforeService.location, service.location],
    ['pricing_model', 'Pricing model', beforeService.pricing_model, service.pricing_model],
    ['pricing_unit', 'Pricing unit', beforeService.pricing_unit, service.pricing_unit],
    ['pricing_details', 'Pricing details', beforeService.pricing_details, service.pricing_details],
    ['cover_image_url', 'Cover photo', beforeService.cover_image_url, service.cover_image_url],
    ['gallery_urls', 'Gallery photos', beforeService.gallery_urls, service.gallery_urls],
  ]

  const changes = fields.flatMap(([key, label, before, after]) => {
    if (stableValue(before) === stableValue(after)) return []
    return [{
      after: formatChangedValue(key, after),
      before: formatChangedValue(key, before),
      label,
    }]
  })

  const oldPackages = Array.isArray(snapshot?.packages) ? snapshot.packages.filter(isRecord) : []
  const newPackages = (service.service_packages || []) as unknown as Record<string, unknown>[]
  const packageNames = new Set([
    ...oldPackages.map((item) => String(item.name || '').trim().toLowerCase()),
    ...newPackages.map((item) => String(item.name || '').trim().toLowerCase()),
  ])

  packageNames.forEach((normalizedName) => {
    const before = oldPackages.find((item) => String(item.name || '').trim().toLowerCase() === normalizedName)
    const after = newPackages.find((item) => String(item.name || '').trim().toLowerCase() === normalizedName)
    if (stableValue(before && packageComparable(before)) === stableValue(after && packageComparable(after))) return
    const displayName = String(after?.name || before?.name || 'Package')
    changes.push({
      after: after ? formatPackageChange(after) : 'Removed',
      before: before ? formatPackageChange(before) : 'Not included',
      label: `Package: ${displayName}`,
    })
  })

  return changes
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function packageComparable(value: Record<string, unknown>) {
  return {
    description: value.description ?? null,
    discount_amount: value.discount_amount ?? 0,
    discount_type: value.discount_type ?? 'none',
    discount_value: value.discount_value ?? 0,
    inclusions: value.inclusions ?? [],
    name: value.name ?? '',
    price: value.price ?? null,
    pricing_unit: value.pricing_unit ?? null,
    services: packageServiceNames(value),
    subtotal: value.subtotal ?? value.price ?? null,
  }
}

function formatPackageChange(value: Record<string, unknown>) {
  const price = typeof value.price === 'number' ? formatMoney(value.price) : 'Custom quote'
  const unit = value.pricing_unit ? ` per ${String(value.pricing_unit)}` : ''
  const description = String(value.description || '').trim()
  const inclusions = Array.isArray(value.inclusions) ? value.inclusions.map(String).join(', ') : ''
  const services = packageServiceNames(value)
  const discountAmount = Number(value.discount_amount || 0)
  const promo = discountAmount > 0
    ? value.discount_type === 'percentage'
      ? `${Number(value.discount_value || 0)}% discount`
      : `${formatMoney(discountAmount)} discount`
    : ''
  return [price + unit, services.length ? `Services: ${services.join(', ')}` : '', promo, description, inclusions]
    .filter(Boolean)
    .join(' · ')
}

function packageServiceNames(value: Record<string, unknown>) {
  const snapshotItems = Array.isArray(value.services) ? value.services : []
  const liveItems = Array.isArray(value.service_package_items) ? value.service_package_items : []
  return (snapshotItems.length ? snapshotItems : liveItems)
    .filter(isRecord)
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0))
    .map((entry) => {
      if (entry.service_name) return String(entry.service_name)
      return String(nestedRecord(entry.services)?.name || '')
    })
    .filter(Boolean)
}

function formatChangedValue(key: string, value: unknown) {
  if (key === 'base_price') return typeof value === 'number' ? formatMoney(value) : 'Custom quote'
  if (key === 'cover_image_url') return value ? 'Photo provided' : 'No cover photo'
  if (key === 'gallery_urls') return `${Array.isArray(value) ? value.length : 0} photo(s)`
  if (value === null || value === undefined || value === '') return 'Not provided'
  return String(value)
}

function stableValue(value: unknown) {
  if (Array.isArray(value)) return JSON.stringify([...value].sort())
  if (isRecord(value)) {
    return JSON.stringify(Object.keys(value).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = value[key]
      return result
    }, {}))
  }
  return String(value ?? '')
}

function nestedRecord(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

function formatPricing(service: Service) {
  const model = service.pricing_model === 'startingAt' ? 'Starting price' : service.pricing_model === 'customQuote' ? 'Custom quotation' : 'Fixed price'
  return service.pricing_unit ? `${model} · per ${service.pricing_unit}` : model
}

function formatInclusions(value: unknown) {
  return Array.isArray(value) && value.length ? value.join(' · ') : 'No package details provided.'
}

function safeCssUrl(value: string) {
  return value.replace(/["'()\\]/g, '')
}
