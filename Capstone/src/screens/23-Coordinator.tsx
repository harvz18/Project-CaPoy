import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Text } from '../components/AppText'
import { BrandIdentity } from '../components/BrandIdentity'
import { CoordinatorBottomNavigation } from '../components/CoordinatorBottomNavigation'
import {
  ChurchLocationMap,
  ChurchTimePickerModal,
  formatChurchDate,
  formatChurchTime,
  type ChurchCoordinates,
} from '../components/ChurchArrangementControls'
import type {
  CoordinatorBookedService,
  CoordinatorDashboard,
  CoordinatorEvent,
  CoordinatorInvitation,
  CoordinatorResult,
  CoordinatorWallet,
  ChurchArrangementStatus,
  ChurchConfirmationMethod,
  ConfirmChurchWeddingArrangementInput,
  CoordinatorTask,
  CreateCoordinatorTaskInput,
  SaveChurchWeddingArrangementInput,
} from '../lib/coordinator'

export type CoordinatorView = 'events' | 'overview' | 'tasks'
type TaskFilter = 'all' | 'due' | 'open'
type DueChoice = 'event' | 'none' | 'today' | 'tomorrow'

interface CoordinatorScreenProps {
  activeView?: CoordinatorView
  avatarUrl?: string
  busyInvitationId?: string
  busyTaskId?: string
  dashboard?: CoordinatorDashboard
  errorMessage?: string
  hasUnreadEventUpdates?: boolean
  hasUnreadTaskUpdates?: boolean
  isLoading?: boolean
  isRefreshing?: boolean
  initialScrollOffset?: number
  onCreateTask?: (input: CreateCoordinatorTaskInput) => Promise<CoordinatorResult>
  onConfirmChurchArrangement?: (input: ConfirmChurchWeddingArrangementInput) => Promise<CoordinatorResult>
  onMessageClient?: (event: CoordinatorEvent) => void
  onMessageProvider?: (event: CoordinatorEvent, service: CoordinatorBookedService) => void
  onOpenEvent?: (event: CoordinatorEvent) => void
  onSaveChurchArrangement?: (input: SaveChurchWeddingArrangementInput) => Promise<CoordinatorResult>
  onOpenNotifications?: () => void
  onOpenMessages?: () => void
  onOpenProfile?: () => void
  onOpenServiceProfile?: () => void
  onRefresh?: () => void
  onRespondInvitation?: (invitation: CoordinatorInvitation, accepted: boolean) => void
  onSignOut?: () => void
  onToggleTask?: (task: CoordinatorTask) => void
  onViewChange?: (view: CoordinatorView) => void
  onScrollPositionChange?: (offset: number) => void
  unreadNotificationCount?: number
  unreadMessageCount?: number
  userName?: string
}

export interface ChurchArrangementDraft {
  ceremonyDate: string
  ceremonyTime: string
  churchAddress: string
  churchContact: string
  churchName: string
  coordinates?: ChurchCoordinates
  notes: string
  preferredChurch: string
}

const emptyDashboard: CoordinatorDashboard = {
  events: [],
  invitations: [],
  tasks: [],
  wallet: {
    availableBalance: 0,
    currency: 'PHP',
    pendingPayouts: 0,
    receivables: 0,
    rows: [],
    totalPaidOut: 0,
  },
}

const startOfDay = (value: Date) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const parseLocalDate = (value?: string) => {
  if (!value) return undefined
  const dateOnly = value.slice(0, 10)
  const parsed = new Date(`${dateOnly}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

const dateLabel = (value?: string, fallback = 'Date to be confirmed') => {
  const date = parseLocalDate(value)
  if (!date) return fallback
  return date.toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    year: 'numeric',
  })
}

const shortDateLabel = (value?: string) => {
  const date = value ? new Date(value) : undefined
  if (!date || Number.isNaN(date.getTime())) return 'No deadline'
  return date.toLocaleDateString('en-PH', { day: 'numeric', month: 'short' })
}

const timeLabel = (value?: string) => {
  if (!value) return 'Time to be confirmed'
  const [hoursValue, minutesValue] = value.split(':')
  const hours = Number(hoursValue)
  const minutes = Number(minutesValue)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const normalizedHours = hours % 12 || 12
  return `${normalizedHours}:${String(minutes).padStart(2, '0')} ${suffix}`
}

const daysRemainingLabel = (value?: string) => {
  const eventDate = parseLocalDate(value)
  if (!eventDate) return 'Schedule pending'
  const days = Math.round(
    (startOfDay(eventDate).getTime() - startOfDay(new Date()).getTime()) / 86_400_000
  )
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days remaining`
}

const statusLabel = (value: string) =>
  value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const pesoLabel = (value: number) =>
  `PHP ${Math.max(0, Math.floor(value)).toLocaleString('en-PH')}`

const CoordinatorFinancialSummary: React.FC<{
  financial: CoordinatorEvent['financial']
}> = ({ financial }) => (
  <View style={styles.financialCard}>
    <View style={styles.financialHeader}>
      <View style={styles.financialHeaderCopy}>
        <Text style={styles.financialEyebrow}>PAYMENT &amp; COORDINATOR BALANCE</Text>
        <Text style={styles.financialStatus}>{financial.paymentStatus}</Text>
      </View>
      <MaterialIcons
        color={financial.paymentConfirmed ? palette.success : palette.secondary}
        name={financial.paymentConfirmed ? 'verified' : 'hourglass-empty'}
        size={20}
      />
    </View>
    {financial.paymentConfirmed ? (
      <View style={styles.financialGrid}>
        <View style={styles.financialItem}>
          <Text style={styles.financialLabel}>COORDINATION FEE</Text>
          <Text style={styles.financialValue}>{pesoLabel(financial.coordinationFee)}</Text>
        </View>
        <View style={styles.financialItem}>
          <Text style={styles.financialLabel}>CLIENT DOWNPAYMENT</Text>
          <Text style={styles.financialValue}>{pesoLabel(financial.downpaymentAmount)}</Text>
        </View>
        <View style={styles.financialItem}>
          <Text style={styles.financialLabel}>INITIAL COORDINATOR SHARE</Text>
          <Text style={styles.financialValue}>{pesoLabel(financial.initialCoordinatorShare)}</Text>
        </View>
        <View style={styles.financialItem}>
          <Text style={styles.financialLabel}>REMAINING COORDINATOR BALANCE</Text>
          <Text style={styles.financialValue}>{pesoLabel(financial.remainingCoordinatorBalance)}</Text>
        </View>
      </View>
    ) : null}
    <Text style={styles.financialExplanation}>
      {financial.paymentConfirmed
        ? `The downpayment already includes MULTIVENT's ${pesoLabel(financial.platformFeePaid)} commission. The remaining balance above is based only on your coordination fee.`
        : financial.balanceStatus}
    </Text>
    {financial.paymentConfirmed ? (
      <Text style={styles.financialBalanceStatus}>{financial.balanceStatus}</Text>
    ) : null}
  </View>
)

const CoordinatorWalletSummary: React.FC<{ wallet: CoordinatorWallet }> = ({ wallet }) => (
  <View style={styles.walletCard}>
    <View style={styles.walletHeader}>
      <View>
        <Text style={styles.walletEyebrow}>COORDINATOR WALLET</Text>
        <Text style={styles.walletTitle}>Receivables and payouts</Text>
      </View>
      <MaterialIcons color={palette.primaryContainer} name="account-balance-wallet" size={22} />
    </View>
    <View style={styles.walletGrid}>
      <View style={styles.walletItem}>
        <Text style={styles.walletLabel}>RECEIVABLES (HELD)</Text>
        <Text style={styles.walletValue}>{pesoLabel(wallet.receivables)}</Text>
      </View>
      <View style={styles.walletItem}>
        <Text style={styles.walletLabel}>AVAILABLE BALANCE</Text>
        <Text style={styles.walletValue}>{pesoLabel(wallet.availableBalance)}</Text>
      </View>
      <View style={styles.walletItem}>
        <Text style={styles.walletLabel}>PENDING PAYOUTS</Text>
        <Text style={styles.walletValue}>{pesoLabel(wallet.pendingPayouts)}</Text>
      </View>
      <View style={styles.walletItem}>
        <Text style={styles.walletLabel}>TOTAL PAID OUT</Text>
        <Text style={styles.walletValue}>{pesoLabel(wallet.totalPaidOut)}</Text>
      </View>
    </View>
    <Text style={styles.walletExplanation}>
      Held allocations are managed by MULTIVENT and are expected to become eligible 14 days before
      the event, provided the booking remains valid. This workspace does not submit payout requests.
    </Text>
    {wallet.rows.length ? (
      <View style={styles.walletReceivableList}>
        {wallet.rows.map((row, index) => (
          <View
            key={row.id}
            style={[styles.walletReceivableRow, index < wallet.rows.length - 1 && styles.walletReceivableRowBorder]}
          >
            <View style={styles.walletReceivableCopy}>
              <Text numberOfLines={1} style={styles.walletReceivableEvent}>{row.eventName}</Text>
              <Text numberOfLines={1} style={styles.walletReceivableService}>{row.serviceName}</Text>
              <Text style={styles.walletReceivableMeta}>Event: {dateLabel(row.eventDate)}</Text>
              <Text style={styles.walletReceivableMeta}>
                {row.isReconciliationRequired
                  ? 'Eligibility requires a review.'
                  : `Expected eligibility: ${dateLabel(row.payoutEligibleOn, 'To be determined')}`}
              </Text>
            </View>
            <View style={styles.walletReceivableAmountColumn}>
              <Text style={styles.walletReceivableAmount}>{pesoLabel(row.allocationAmount)}</Text>
              <Text numberOfLines={1} style={styles.walletReceivableStatus}>
                {statusLabel(row.fundsStatus)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    ) : null}
  </View>
)

const taskIsOverdue = (task: CoordinatorTask) => {
  if (!task.dueAt || task.status === 'completed') return false
  return new Date(task.dueAt).getTime() < Date.now()
}

const taskIsDueToday = (task: CoordinatorTask) => {
  if (!task.dueAt || task.status === 'completed') return false
  return startOfDay(new Date(task.dueAt)).getTime() === startOfDay(new Date()).getTime()
}

const eventProgress = (event: CoordinatorEvent) => {
  if (!event.taskCount) return 0
  return Math.min(100, Math.round((event.completedTaskCount / event.taskCount) * 100))
}

const initialsFrom = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'EC'

const todayHeading = () =>
  new Date().toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  })

const EventCard: React.FC<{
  churchDraft?: ChurchArrangementDraft
  event: CoordinatorEvent
  mode?: 'compact' | 'detail'
  onChurchDraftChange?: (draft: ChurchArrangementDraft) => void
  onChurchDraftSaved?: () => void
  onConfirmChurchArrangement?: (input: ConfirmChurchWeddingArrangementInput) => Promise<CoordinatorResult>
  onMessageClient?: (event: CoordinatorEvent) => void
  onMessageProvider?: (event: CoordinatorEvent, service: CoordinatorBookedService) => void
  onOpen?: (event: CoordinatorEvent) => void
  onSaveChurchArrangement?: (input: SaveChurchWeddingArrangementInput) => Promise<CoordinatorResult>
}> = ({
  churchDraft,
  event,
  mode = 'compact',
  onChurchDraftChange,
  onChurchDraftSaved,
  onConfirmChurchArrangement,
  onMessageClient,
  onMessageProvider,
  onOpen,
  onSaveChurchArrangement,
}) => {
  const progress = eventProgress(event)
  const venue = event.venue || event.location || 'Venue to be confirmed'
  const bookingServices = event.services.filter((service) => service.booked && service.bookingId)
  const pendingBookingCount = bookingServices.filter((service) =>
    ['requested', 'payment_required', 'paid', 'approved'].includes(service.status)
  ).length
  const declinedBookingCount = bookingServices.filter((service) => service.status === 'rejected').length
  const replacementBookingCount = bookingServices.filter((service) =>
    Boolean(service.replacementStatus && !['closed'].includes(service.replacementStatus))
  ).length
  const expanded = mode === 'detail'
  const [expandedServiceIds, setExpandedServiceIds] = React.useState<string[]>([])

  const toggleService = (serviceId: string) => {
    setExpandedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    )
  }

  return (
    <View style={styles.eventCard}>
      <View style={styles.eventAccent} />
      <View style={styles.eventCardBody}>
        <Pressable
          accessibilityLabel={expanded ? `${event.name} event overview` : `View details for ${event.name}`}
          accessibilityRole="button"
          disabled={expanded}
          onPress={() => onOpen?.(event)}
          style={({ pressed }) => [styles.eventCardHeader, pressed && styles.pressedSurface]}
        >
          <View style={styles.eventHeadingCopy}>
            <Text style={styles.eventType}>{statusLabel(event.type || 'Event')}</Text>
            <Text numberOfLines={2} style={styles.eventName}>{event.name}</Text>
            <Text style={styles.clientName}>For {event.clientName}</Text>
            {event.isChurchWedding ? (
              <Text style={styles.churchWeddingNotice}>Church wedding — church coordination required</Text>
            ) : null}
          </View>
          <View style={styles.eventHeaderAside}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{statusLabel(event.status)}</Text>
            </View>
            {!expanded ? <MaterialIcons color={palette.primaryContainer} name="chevron-right" size={23} /> : null}
          </View>
        </Pressable>

        {expanded ? <Text style={styles.detailSectionLabel}>EVENT OVERVIEW</Text> : null}
        <View style={styles.eventMetaGrid}>
          <View style={styles.eventMetaItem}>
            <MaterialIcons color={palette.primaryContainer} name="event" size={17} />
            <View style={styles.metaCopy}>
              <Text style={styles.metaLabel}>DATE & TIME</Text>
              <Text style={styles.metaValue}>{dateLabel(event.date)}</Text>
              <Text style={styles.metaSubvalue}>{timeLabel(event.time)}</Text>
            </View>
          </View>
          <View style={styles.eventMetaItem}>
            <MaterialIcons color={palette.primaryContainer} name="location-on" size={17} />
            <View style={styles.metaCopy}>
              <Text style={styles.metaLabel}>VENUE</Text>
              <Text numberOfLines={2} style={styles.metaValue}>{venue}</Text>
            </View>
          </View>
        </View>

        <View style={styles.eventCountdownRow}>
          <MaterialIcons color={palette.primaryContainer} name="hourglass-bottom" size={15} />
          <Text style={styles.eventCountdownText}>{daysRemainingLabel(event.date)}</Text>
        </View>

        {!expanded ? (
          <Pressable
            accessibilityLabel={`View event details for ${event.name}`}
            accessibilityRole="button"
            onPress={() => onOpen?.(event)}
            style={({ pressed }) => [styles.disclosureHint, pressed && styles.pressed]}
          >
            <Text style={styles.disclosureHintText}>View Event</Text>
            <MaterialIcons color={palette.primaryContainer} name="arrow-forward" size={18} />
          </Pressable>
        ) : null}

        {expanded ? (
          <View style={styles.eventExpandedContent}>
            <Text style={styles.detailSectionLabel}>SERVICE BOOKING PROGRESS</Text>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Coordination progress</Text>
              <Text style={styles.progressValue}>{progress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <View style={styles.eventFooter}>
              <Text style={styles.eventFooterText}>
                {event.completedTaskCount}/{event.taskCount} tasks complete
              </Text>
              <Text style={styles.eventFooterText}>
                {event.confirmedBookingCount}/{event.bookingCount} providers secured
              </Text>
            </View>
            <View style={styles.requestFacts}>
              <Text style={styles.requestFact}>Services: {bookingServices.length}</Text>
              <Text style={styles.requestFact}>Confirmed: {event.confirmedBookingCount}</Text>
              <Text style={styles.requestFact}>Pending: {pendingBookingCount}</Text>
              <Text style={styles.requestFact}>Declined: {declinedBookingCount}</Text>
              {replacementBookingCount ? (
                <Text style={styles.requestFact}>Replacement activity: {replacementBookingCount}</Text>
              ) : null}
            </View>

            {event.isChurchWedding ? (
              <ChurchArrangementPanel
                draft={churchDraft}
                event={event}
                onDraftChange={onChurchDraftChange}
                onDraftSaved={onChurchDraftSaved}
                onConfirm={onConfirmChurchArrangement}
                onMessageClient={() => onMessageClient?.(event)}
                onSave={onSaveChurchArrangement}
              />
            ) : (
              <Pressable
                accessibilityLabel={`Message ${event.clientName} about ${event.name}`}
                accessibilityRole="button"
                onPress={() => onMessageClient?.(event)}
                style={({ pressed }) => [styles.confirmChurchButton, pressed && styles.pressed]}
              >
                <MaterialIcons color={palette.primaryContainer} name="chat-bubble-outline" size={17} />
                <Text style={styles.confirmChurchButtonText}>Message Client</Text>
              </Pressable>
            )}

            <Text style={[styles.detailSectionLabel, styles.detailManagementLabel]}>EVENT MANAGEMENT</Text>
            <View style={styles.requestFacts}>
              <Text style={styles.requestFact}>Event type: {statusLabel(event.type || 'Event')}</Text>
              <Text style={event.isChurchWedding ? styles.churchWeddingFact : styles.requestFact}>
                Wedding type: {event.isChurchWedding ? 'Church wedding' : 'Non-church / not applicable'}
              </Text>
              <Text style={styles.requestFact}>Coordinator booking: {statusLabel(event.status)}</Text>
              <Text style={styles.requestFact}>Guests: {event.guestCount ?? 'Not specified'}</Text>
              <Text style={styles.requestFact}>
                Event budget: {event.totalBudget == null ? 'Not specified' : pesoLabel(event.totalBudget)}
              </Text>
              <Text style={styles.requestFact}>
                Venue plan: {statusLabel(event.venueStatus || 'Not specified')}
              </Text>
            </View>

            {event.budgetAllocations.length ? (
              <View style={styles.requestServicesBlock}>
                <Text style={styles.financialEyebrow}>CATEGORY BUDGET ALLOCATIONS</Text>
                {event.budgetAllocations.map((allocation) => (
                  <View key={allocation.categoryKey || allocation.label} style={styles.requestServiceRow}>
                    <MaterialIcons color={palette.primaryContainer} name="account-balance-wallet" size={15} />
                    <View style={styles.requestServiceCopy}>
                      <Text style={styles.requestServiceName}>{allocation.label}</Text>
                      <Text style={styles.requestServiceMeta}>{pesoLabel(allocation.allocatedAmount)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <CoordinatorFinancialSummary financial={event.financial} />

            {event.clientNotes ? (
              <View style={styles.clientRequestNote}>
                <Text style={styles.instructionLabel}>CLIENT EVENT NOTE</Text>
                <Text style={styles.instructionBody}>{event.clientNotes}</Text>
              </View>
            ) : null}

            {event.instructions.length ? (
              <View style={styles.coordinatorInstructionsBlock}>
                <View style={styles.coordinatorInstructionsHeading}>
                  <MaterialIcons color={palette.primaryContainer} name="assignment-ind" size={17} />
                  <View style={styles.instructionCopy}>
                    <Text style={styles.instructionLabel}>CLIENT NOTES FOR YOUR COORDINATION</Text>
                    <Text style={styles.coordinatorInstructionsCaption}>
                      Instructions addressed directly to you by the client.
                    </Text>
                  </View>
                </View>
                {event.instructions.map((instruction) => (
                  <View key={instruction.id} style={styles.instructionRow}>
                    <MaterialIcons color={palette.primaryContainer} name="sticky-note-2" size={14} />
                    <View style={styles.instructionCopy}>
                      <Text style={styles.instructionTitle}>{instruction.title}</Text>
                      {instruction.body ? (
                        <Text style={styles.instructionBody}>{instruction.body}</Text>
                      ) : null}
                      {instruction.tags.length ? (
                        <Text style={styles.instructionTags}>{instruction.tags.join(' · ')}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.servicesBlock}>
              <View style={styles.servicesHeader}>
                <Text style={styles.servicesLabel}>BOOKED &amp; SELECTED SERVICES</Text>
                <Text style={styles.servicesCount}>{event.services.length}</Text>
              </View>
              {event.services.length ? event.services.map((service) => {
                const serviceExpanded = expandedServiceIds.includes(service.id)
                const instructionCount = service.instructions.length + (service.clientNotes ? 1 : 0)

                return (
                  <View key={service.id} style={styles.serviceRow}>
                    <Pressable
                      accessibilityLabel={`${serviceExpanded ? 'Hide' : 'Show'} instructions for ${service.serviceName}`}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: serviceExpanded }}
                      onPress={() => toggleService(service.id)}
                      style={({ pressed }) => [styles.serviceSummaryRow, pressed && styles.pressedSurface]}
                    >
                      <View style={styles.serviceIcon}>
                        <MaterialIcons color={palette.primaryContainer} name="business-center" size={15} />
                      </View>
                      <View style={styles.serviceCopy}>
                        <Text numberOfLines={1} style={styles.serviceName}>{service.serviceName}</Text>
                        <Text numberOfLines={1} style={styles.serviceProvider}>
                          {service.providerName} · {service.categoryName}
                        </Text>
                        <Text style={styles.serviceInstructionCount}>
                          {instructionCount
                            ? `${instructionCount} client ${instructionCount === 1 ? 'instruction' : 'instructions'}`
                            : 'No client instructions'}
                        </Text>
                      </View>
                      <View style={styles.serviceAside}>
                        <Text style={styles.serviceAmount}>{pesoLabel(service.amount)}</Text>
                        <Text style={[styles.serviceStatus, service.booked && styles.serviceStatusBooked]}>
                          {statusLabel(service.status)}
                        </Text>
                        <MaterialIcons
                          color={palette.primaryContainer}
                          name={serviceExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                          size={19}
                        />
                      </View>
                    </Pressable>

                    {serviceExpanded ? (
                      <View style={styles.serviceExpandedContent}>
                        {service.clientNotes ? (
                          <View style={styles.clientNote}>
                            <MaterialIcons color={palette.primaryContainer} name="notes" size={14} />
                            <View style={styles.instructionCopy}>
                              <Text style={styles.instructionLabel}>CLIENT BOOKING NOTE</Text>
                              <Text style={styles.instructionBody}>{service.clientNotes}</Text>
                            </View>
                          </View>
                        ) : null}
                        {service.cateringOptionName || service.venueOptionName ? (
                          <Text style={styles.requestServiceMeta}>
                            Selected option: {service.cateringOptionName || service.venueOptionName}
                            {service.venueBookedHours ? ` · ${service.venueBookedHours} hours` : ''}
                          </Text>
                        ) : null}
                        {service.replacementStatus ? (
                          <Text style={styles.requestServiceMeta}>
                            Replacement: {statusLabel(service.replacementStatus)}
                          </Text>
                        ) : null}
                        {service.instructions.map((instruction) => (
                          <View key={instruction.id} style={styles.instructionRow}>
                            <MaterialIcons
                              color={instruction.isRequired ? palette.danger : palette.secondary}
                              name={instruction.isRequired ? 'priority-high' : 'assignment'}
                              size={14}
                            />
                            <View style={styles.instructionCopy}>
                              <Text style={styles.instructionTitle}>
                                {instruction.title}{instruction.isRequired ? ' · Required' : ''}
                              </Text>
                              {instruction.body ? <Text style={styles.instructionBody}>{instruction.body}</Text> : null}
                              {instruction.tags.length ? (
                                <Text style={styles.instructionTags}>{instruction.tags.join(' · ')}</Text>
                              ) : null}
                            </View>
                          </View>
                        ))}
                        {!instructionCount ? (
                          <Text style={styles.noServicesText}>The client has not added instructions for this service.</Text>
                        ) : null}
                        {service.booked && service.bookingId && !['rejected', 'cancelled', 'expired'].includes(service.status) ? (
                          <View style={styles.providerActions}>
                            <Pressable
                              accessibilityRole="button"
                              disabled={!service.bookingId}
                              onPress={() => onMessageProvider?.(event, service)}
                              style={({ pressed }) => [styles.providerAction, !service.bookingId && styles.disabled, pressed && styles.pressed]}
                            >
                              <MaterialIcons color={palette.primaryContainer} name="chat-bubble-outline" size={15} />
                              <Text style={styles.providerActionText}>Message provider</Text>
                            </Pressable>
                            {service.providerPhone ? (
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => void Linking.openURL(`tel:${service.providerPhone}`)}
                                style={({ pressed }) => [styles.providerAction, pressed && styles.pressed]}
                              >
                                <MaterialIcons color={palette.primaryContainer} name="phone" size={15} />
                                <Text style={styles.providerActionText}>Call</Text>
                              </Pressable>
                            ) : null}
                            {service.providerEmail ? (
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => void Linking.openURL(`mailto:${service.providerEmail}`)}
                                style={({ pressed }) => [styles.providerAction, pressed && styles.pressed]}
                              >
                                <MaterialIcons color={palette.primaryContainer} name="email" size={15} />
                                <Text style={styles.providerActionText}>Email</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                )
              }) : (
                <Text style={styles.noServicesText}>No services have been selected for this event yet.</Text>
              )}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const churchArrangementLabel = (status: ChurchArrangementStatus) => ({
  awaiting_client_confirmation: 'Awaiting Client Confirmation',
  client_approved: 'Client Approved',
  confirmed: 'Confirmed (Existing Record)',
  coordinator_confirmed: 'Coordinator Confirmed',
  declined: 'Declined',
  looking_for_church: 'Looking for a Church',
  not_started: 'Not Started',
  proposed: 'Awaiting Client Confirmation',
}[status])

const churchConfirmationMethods: Array<{ label: string; value: ChurchConfirmationMethod }> = [
  { label: 'Discussed with Client Externally', value: 'external_discussion' },
  { label: 'Confirmed Through Multivent', value: 'multivent' },
  { label: 'Other', value: 'other' },
]

const ChurchArrangementPanel: React.FC<{
  draft?: ChurchArrangementDraft
  event: CoordinatorEvent
  onConfirm?: (input: ConfirmChurchWeddingArrangementInput) => Promise<CoordinatorResult>
  onDraftChange?: (draft: ChurchArrangementDraft) => void
  onDraftSaved?: () => void
  onMessageClient?: () => void
  onSave?: (input: SaveChurchWeddingArrangementInput) => Promise<CoordinatorResult>
}> = ({ draft, event, onConfirm, onDraftChange, onDraftSaved, onMessageClient, onSave }) => {
  const arrangement = event.churchArrangement
  const eventDate = event.date?.slice(0, 10) ?? ''
  const [preferredChurch, setPreferredChurch] = React.useState(draft?.preferredChurch ?? arrangement?.preferredChurch ?? '')
  const [churchName, setChurchName] = React.useState(draft?.churchName ?? arrangement?.churchName ?? '')
  const [churchAddress, setChurchAddress] = React.useState(draft?.churchAddress ?? arrangement?.churchAddress ?? '')
  const [churchContact, setChurchContact] = React.useState(draft?.churchContact ?? arrangement?.churchContact ?? '')
  const [ceremonyTime, setCeremonyTime] = React.useState(draft?.ceremonyTime ?? arrangement?.ceremonyTime ?? '')
  const [coordinates, setCoordinates] = React.useState<ChurchCoordinates | undefined>(() =>
    draft
      ? draft.coordinates
      : arrangement?.churchLatitude != null && arrangement.churchLongitude != null
        ? { latitude: arrangement.churchLatitude, longitude: arrangement.churchLongitude }
        : undefined
  )
  const [draftCoordinates, setDraftCoordinates] = React.useState<ChurchCoordinates | undefined>()
  const [notes, setNotes] = React.useState(draft?.notes ?? arrangement?.notes ?? '')
  const [error, setError] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [showConfirmation, setShowConfirmation] = React.useState(false)
  const [detailsExpanded, setDetailsExpanded] = React.useState(false)
  const [confirmationMethod, setConfirmationMethod] = React.useState<ChurchConfirmationMethod>('external_discussion')
  const [confirmationNotes, setConfirmationNotes] = React.useState('')
  const [confirmationError, setConfirmationError] = React.useState('')
  const [confirming, setConfirming] = React.useState(false)
  const [showLocationPicker, setShowLocationPicker] = React.useState(false)
  const [showTimePicker, setShowTimePicker] = React.useState(false)

  React.useEffect(() => {
    setPreferredChurch(draft?.preferredChurch ?? arrangement?.preferredChurch ?? '')
    setChurchName(draft?.churchName ?? arrangement?.churchName ?? '')
    setChurchAddress(draft?.churchAddress ?? arrangement?.churchAddress ?? '')
    setChurchContact(draft?.churchContact ?? arrangement?.churchContact ?? '')
    setCeremonyTime(draft?.ceremonyTime ?? arrangement?.ceremonyTime ?? '')
    setCoordinates(draft
      ? draft.coordinates
      : arrangement?.churchLatitude != null && arrangement.churchLongitude != null
        ? { latitude: arrangement.churchLatitude, longitude: arrangement.churchLongitude }
        : undefined)
    setNotes(draft?.notes ?? arrangement?.notes ?? '')
    setError('')
  }, [arrangement, draft, event.id])

  const publishDraft = (updates: Partial<ChurchArrangementDraft>) => {
    onDraftChange?.({
      ceremonyTime,
      churchAddress,
      churchContact,
      churchName,
      coordinates,
      notes,
      preferredChurch,
      ...updates,
      // The ceremony date belongs to the client event schedule and cannot be
      // edited from the coordinator workspace.
      ceremonyDate: eventDate,
    })
  }

  const save = async () => {
    if (!onSave || saving) return
    const normalizedChurchName = churchName.trim()
    setSaving(true)
    setError('')
    const result = await onSave({
      arrangementStatus: normalizedChurchName
        ? 'proposed'
        : preferredChurch.trim() || notes.trim()
          ? 'looking_for_church'
          : 'not_started',
      ceremonyDate: eventDate || undefined,
      ceremonyTime,
      churchAddress,
      churchContact,
      churchLatitude: coordinates?.latitude,
      churchLongitude: coordinates?.longitude,
      churchName,
      eventId: event.id,
      notes,
      preferredChurch,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message ?? 'Unable to save the church arrangement.')
      return
    }
    onDraftSaved?.()
  }

  const closeConfirmation = () => {
    if (confirming) return
    setShowConfirmation(false)
    setConfirmationError('')
  }

  const confirmArrangement = async () => {
    if (!onConfirm || confirming) return
    setConfirming(true)
    setConfirmationError('')
    const result = await onConfirm({
      confirmationMethod,
      confirmationNotes,
      eventId: event.id,
    })
    setConfirming(false)
    if (!result.ok) {
      setConfirmationError(result.message ?? 'Unable to confirm the church arrangement.')
      return
    }
    setShowConfirmation(false)
    setConfirmationNotes('')
  }

  const status = arrangement?.arrangementStatus ?? 'not_started'
  const isConfirmed = ['confirmed', 'coordinator_confirmed'].includes(status)
  const proposalWasDeclined = status === 'declined'
  const submitLabel = churchName.trim()
    ? arrangement?.activeProposalId
      ? 'Submit Revised Church Proposal'
      : 'Submit Church Proposal'
    : 'Save Church Search Notes'

  return (
    <View style={styles.churchArrangementPanel}>
      <View style={styles.churchArrangementPanelHeading}>
        <View style={styles.instructionCopy}>
          <Text style={styles.churchArrangementTitle}>CHURCH ARRANGEMENT</Text>
          <Text style={styles.churchArrangementCaption}>Record coordination details only. This does not reserve a church or confirm payment.</Text>
        </View>
        <MaterialIcons color={palette.primaryContainer} name="church" size={21} />
      </View>
      <Pressable
        accessibilityLabel={detailsExpanded ? 'Hide church proposal and details' : 'Show church proposal and details'}
        accessibilityRole="button"
        accessibilityState={{ expanded: detailsExpanded }}
        onPress={() => setDetailsExpanded((current) => !current)}
        style={({ pressed }) => [styles.churchDetailsDisclosure, pressed && styles.pressed]}
      >
        <View style={styles.instructionCopy}>
          <Text style={styles.inputLabel}>CURRENT STATUS</Text>
          <Text style={styles.churchCurrentStatusText}>{churchArrangementLabel(status)}</Text>
          {arrangement?.proposalVersion ? (
            <Text style={styles.churchProposalVersion}>Proposal version {arrangement.proposalVersion}</Text>
          ) : null}
        </View>
        <MaterialIcons color={palette.primaryContainer} name={detailsExpanded ? 'expand-less' : 'expand-more'} size={22} />
      </Pressable>
      <View style={!detailsExpanded && styles.churchDetailsCollapsed}>
      <Pressable
        accessibilityLabel={`Message ${event.clientName} about the church arrangement`}
        accessibilityRole="button"
        onPress={onMessageClient}
        style={({ pressed }) => [styles.confirmChurchButton, pressed && styles.pressed]}
      >
        <MaterialIcons color={palette.primaryContainer} name="chat-bubble-outline" size={17} />
        <Text style={styles.confirmChurchButtonText}>Message Client</Text>
      </Pressable>
      {arrangement?.clientResponseStatus && arrangement.clientResponseStatus !== 'not_requested' ? (
        <View style={styles.churchResponseCard}>
          <Text style={styles.inputLabel}>CLIENT RESPONSE</Text>
          <Text style={styles.churchResponseValue}>{statusLabel(arrangement.clientResponseStatus)}</Text>
          {arrangement.clientResponseReason ? (
            <Text style={styles.churchDeclineReason}>Reason: {arrangement.clientResponseReason}</Text>
          ) : null}
        </View>
      ) : null}
      {arrangement?.coordinatorConfirmedAt ? (
        <View style={styles.churchResponseCard}>
          <Text style={styles.inputLabel}>COORDINATOR CONFIRMATION</Text>
          <Text style={styles.churchResponseValue}>
            {churchConfirmationMethods.find((method) => method.value === arrangement.confirmationMethod)?.label ?? 'Documented confirmation'}
          </Text>
          {arrangement.confirmationNotes ? <Text style={styles.churchDeclineReason}>{arrangement.confirmationNotes}</Text> : null}
          <Text style={styles.churchProposalVersion}>{new Date(arrangement.coordinatorConfirmedAt).toLocaleString('en-PH')}</Text>
        </View>
      ) : null}
      <Text style={styles.inputLabel}>CLIENT PREFERRED CHURCH</Text>
      <TextInput onChangeText={(value) => { setPreferredChurch(value); publishDraft({ preferredChurch: value }) }} placeholder="Client preference, if shared" placeholderTextColor={palette.secondary} style={styles.textInput} value={preferredChurch} />
      <Text style={styles.inputLabel}>PROPOSED / SELECTED CHURCH</Text>
      <TextInput onChangeText={(value) => { setChurchName(value); publishDraft({ churchName: value }) }} placeholder="Church name" placeholderTextColor={palette.secondary} style={styles.textInput} value={churchName} />
      <Text style={styles.inputLabel}>ADDRESS OR LOCATION</Text>
      <TextInput onChangeText={(value) => { setChurchAddress(value); publishDraft({ churchAddress: value }) }} placeholder="Church address or location" placeholderTextColor={palette.secondary} style={styles.textInput} value={churchAddress} />
      <View style={styles.churchLocationCard}>
        {coordinates ? (
          <ChurchLocationMap coordinates={coordinates} />
        ) : (
          <View style={styles.churchLocationFallback}>
            <MaterialIcons color={palette.primaryContainer} name="location-off" size={21} />
            <View style={styles.instructionCopy}>
              <Text style={styles.churchLocationFallbackTitle}>No map pin saved</Text>
              <Text style={styles.churchLocationFallbackText}>The written address remains available even without coordinates.</Text>
            </View>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setDraftCoordinates(coordinates)
            setShowLocationPicker(true)
          }}
          style={({ pressed }) => [styles.churchPickerButton, pressed && styles.pressed]}
        >
          <MaterialIcons color={palette.primaryContainer} name={coordinates ? 'edit-location-alt' : 'add-location-alt'} size={18} />
          <Text style={styles.churchPickerButtonText}>{coordinates ? 'Edit map pin' : 'Pin church location'}</Text>
        </Pressable>
      </View>
      <Text style={styles.inputLabel}>CHURCH CONTACT</Text>
      <TextInput onChangeText={(value) => { setChurchContact(value); publishDraft({ churchContact: value }) }} placeholder="Contact person or number" placeholderTextColor={palette.secondary} style={styles.textInput} value={churchContact} />
      <View style={styles.churchDateTimeRow}>
        <View style={styles.churchDateTimeField}>
          <Text style={styles.inputLabel}>CEREMONY DATE</Text>
          <View accessibilityLabel="Ceremony date set by the client event schedule" style={styles.churchDateReadOnlyField}>
            <MaterialIcons color={palette.primaryContainer} name="event" size={18} />
            <View style={styles.churchDateReadOnlyCopy}>
              <Text numberOfLines={1} style={[styles.churchPickerFieldText, !eventDate && styles.churchPickerPlaceholder]}>{formatChurchDate(eventDate)}</Text>
              <Text numberOfLines={1} style={styles.churchDateReadOnlyHint}>
                {eventDate ? "Set by the client's event schedule" : 'Client event date not set'}
              </Text>
            </View>
            <MaterialIcons color={palette.secondary} name="lock-outline" size={17} />
          </View>
        </View>
        <View style={styles.churchDateTimeField}>
          <Text style={styles.inputLabel}>TIME</Text>
          <Pressable accessibilityRole="button" onPress={() => setShowTimePicker(true)} style={({ pressed }) => [styles.churchPickerField, pressed && styles.pressed]}>
            <MaterialIcons color={palette.primaryContainer} name="schedule" size={18} />
            <Text numberOfLines={1} style={[styles.churchPickerFieldText, !ceremonyTime && styles.churchPickerPlaceholder]}>{formatChurchTime(ceremonyTime)}</Text>
            <MaterialIcons color={palette.secondary} name="expand-more" size={19} />
          </Pressable>
        </View>
      </View>
      <Text style={styles.inputLabel}>NOTES / INSTRUCTIONS</Text>
      <TextInput multiline onChangeText={(value) => { setNotes(value); publishDraft({ notes: value }) }} placeholder="Record coordination notes for the client" placeholderTextColor={palette.secondary} style={[styles.textInput, styles.notesInput]} textAlignVertical="top" value={notes} />
      {arrangement?.updatedAt ? <Text style={styles.churchUpdatedAt}>Last updated {new Date(arrangement.updatedAt).toLocaleString('en-PH')}</Text> : null}
      {error ? <Text style={styles.formError}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={!onSave || saving} onPress={() => void save()} style={({ pressed }) => [styles.createButton, (!onSave || saving) && styles.disabled, pressed && styles.addButtonPressed]}>
        {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <MaterialIcons color="#FFFFFF" name="save" size={16} />}
        <Text style={styles.createButtonText}>{saving ? 'Saving...' : submitLabel}</Text>
      </Pressable>
      {churchName.trim() && !isConfirmed ? (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={!onConfirm || confirming || proposalWasDeclined}
            onPress={() => {
              setConfirmationError('')
              setShowConfirmation(true)
            }}
            style={({ pressed }) => [
              styles.confirmChurchButton,
              (!onConfirm || confirming || proposalWasDeclined) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons color={palette.primaryContainer} name="verified" size={17} />
            <Text style={styles.confirmChurchButtonText}>Mark Church as Confirmed</Text>
          </Pressable>
          {proposalWasDeclined ? (
            <Text style={styles.churchDeclinedGuidance}>The client declined this proposal. Submit a revised proposal before confirming an arrangement.</Text>
          ) : null}
        </>
      ) : null}
      </View>

      <Modal animationType="fade" onRequestClose={closeConfirmation} transparent visible={showConfirmation}>
        <View style={styles.churchModalBackdrop}>
          <View accessibilityViewIsModal style={styles.churchModalCard}>
            <View style={styles.churchModalHeader}>
              <View style={styles.instructionCopy}>
                <Text style={styles.churchModalTitle}>Confirm Church Arrangement</Text>
                <Text style={styles.churchModalText}>Are you sure this church arrangement has already been confirmed?</Text>
              </View>
              <Pressable accessibilityLabel="Close confirmation" accessibilityRole="button" disabled={confirming} onPress={closeConfirmation}>
                <MaterialIcons color={palette.secondary} name="close" size={22} />
              </Pressable>
            </View>
            <Text style={styles.inputLabel}>CONFIRMATION METHOD</Text>
            <View style={styles.churchConfirmationChoices}>
              {churchConfirmationMethods.map((method) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: confirmationMethod === method.value }}
                  key={method.value}
                  onPress={() => setConfirmationMethod(method.value)}
                  style={[
                    styles.churchConfirmationChoice,
                    confirmationMethod === method.value && styles.churchConfirmationChoiceSelected,
                  ]}
                >
                  <MaterialIcons
                    color={confirmationMethod === method.value ? '#FFFFFF' : palette.primaryContainer}
                    name={confirmationMethod === method.value ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={17}
                  />
                  <Text style={[
                    styles.churchConfirmationChoiceText,
                    confirmationMethod === method.value && styles.churchConfirmationChoiceTextSelected,
                  ]}>{method.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.inputLabel}>OPTIONAL NOTES</Text>
            <TextInput
              editable={!confirming}
              maxLength={1000}
              multiline
              onChangeText={setConfirmationNotes}
              placeholder="Add context about how the arrangement was confirmed"
              placeholderTextColor={palette.secondary}
              style={[styles.textInput, styles.notesInput]}
              textAlignVertical="top"
              value={confirmationNotes}
            />
            <Text style={styles.churchConfirmationDisclaimer}>This records the coordinator-client arrangement only. It does not verify an external church reservation.</Text>
            {confirmationError ? <Text style={styles.formError}>{confirmationError}</Text> : null}
            <View style={styles.churchModalActions}>
              <Pressable accessibilityRole="button" disabled={confirming} onPress={closeConfirmation} style={styles.churchModalCancel}>
                <Text style={styles.churchModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={!onConfirm || confirming} onPress={() => void confirmArrangement()} style={[styles.churchModalConfirm, (!onConfirm || confirming) && styles.disabled]}>
                {confirming ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
                <Text style={styles.churchModalConfirmText}>{confirming ? 'Confirming...' : 'Confirm Arrangement'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {showTimePicker ? (
        <ChurchTimePickerModal
          onClose={() => setShowTimePicker(false)}
          onConfirm={(value) => { setCeremonyTime(value); publishDraft({ ceremonyTime: value }) }}
          value={ceremonyTime}
        />
      ) : null}
      {showLocationPicker ? (
        <Modal animationType="fade" onRequestClose={() => setShowLocationPicker(false)} transparent visible>
          <View style={styles.churchModalBackdrop}>
            <View accessibilityViewIsModal style={styles.churchMapModalCard}>
              <View style={styles.churchModalHeader}>
                <View style={styles.instructionCopy}>
                  <Text style={styles.churchModalTitle}>Pin Church Location</Text>
                  <Text style={styles.churchModalText}>Tap the demo coordinate map to place or move the pin. Confirm only coordinates you have checked.</Text>
                </View>
                <Pressable accessibilityLabel="Close location picker" accessibilityRole="button" onPress={() => setShowLocationPicker(false)}>
                  <MaterialIcons color={palette.secondary} name="close" size={22} />
                </Pressable>
              </View>
              <ChurchLocationMap coordinates={draftCoordinates} interactive onChange={setDraftCoordinates} showOpenStreetMapLink={false} />
              <Text style={styles.churchMapDisclaimer}>The map does not claim or verify a church. Use OpenStreetMap after saving to verify the exact coordinates.</Text>
              <View style={styles.churchModalActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setCoordinates(undefined)
                    publishDraft({ coordinates: undefined })
                    setDraftCoordinates(undefined)
                    setShowLocationPicker(false)
                  }}
                  style={styles.churchModalCancel}
                >
                  <Text style={styles.churchModalCancelText}>Use Address Only</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !draftCoordinates }}
                  disabled={!draftCoordinates}
                  onPress={() => {
                    setCoordinates(draftCoordinates)
                    publishDraft({ coordinates: draftCoordinates })
                    setShowLocationPicker(false)
                  }}
                  style={[styles.churchModalConfirm, !draftCoordinates && styles.disabled]}
                >
                  <MaterialIcons color="#FFFFFF" name="location-on" size={17} />
                  <Text style={styles.churchModalConfirmText}>Confirm Pin</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

interface CoordinatorEventDetailsScreenProps {
  churchDraft?: ChurchArrangementDraft
  errorMessage?: string
  event?: CoordinatorEvent
  isLoading?: boolean
  isRefreshing?: boolean
  onBack?: () => void
  onChurchDraftChange?: (draft: ChurchArrangementDraft) => void
  onChurchDraftSaved?: () => void
  onConfirmChurchArrangement?: (input: ConfirmChurchWeddingArrangementInput) => Promise<CoordinatorResult>
  onMessageClient?: (event: CoordinatorEvent) => void
  onMessageProvider?: (event: CoordinatorEvent, service: CoordinatorBookedService) => void
  onRefresh?: () => void
  onSaveChurchArrangement?: (input: SaveChurchWeddingArrangementInput) => Promise<CoordinatorResult>
}

export const CoordinatorEventDetailsScreen: React.FC<CoordinatorEventDetailsScreenProps> = ({
  churchDraft,
  errorMessage,
  event,
  isLoading = false,
  isRefreshing = false,
  onBack,
  onChurchDraftChange,
  onChurchDraftSaved,
  onConfirmChurchArrangement,
  onMessageClient,
  onMessageProvider,
  onRefresh,
  onSaveChurchArrangement,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768

  return (
    <View style={styles.screen}>
      <View style={styles.detailTopBar}>
        <View style={[styles.detailTopBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Back to coordinator home"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.detailBackButton, pressed && styles.pressedSurface]}
          >
            <MaterialIcons color={palette.primaryContainer} name="arrow-back" size={22} />
          </Pressable>
          <View style={styles.detailHeadingCopy}>
            <Text style={styles.detailEyebrow}>COORDINATOR WORKSPACE</Text>
            <Text numberOfLines={1} style={styles.detailTitle}>Event Details</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.detailContent,
          isWide ? styles.detailContentWide : styles.detailContentMobile,
        ]}
        refreshControl={
          <RefreshControl
            colors={[palette.primaryContainer]}
            onRefresh={onRefresh}
            refreshing={isRefreshing}
            tintColor={palette.primaryContainer}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {errorMessage ? (
          <View style={styles.errorCard}>
            <MaterialIcons color={palette.danger} name="error-outline" size={20} />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Event details could not refresh</Text>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {isLoading && !event ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={palette.primaryContainer} size="large" />
            <Text style={styles.loadingTitle}>Loading event details</Text>
            <Text style={styles.loadingText}>Syncing the event, services, and client instructions.</Text>
          </View>
        ) : event ? (
          <>
            <View style={styles.detailIntro}>
              <Text style={styles.sectionEyebrow}>CLIENT REQUEST DETAILS</Text>
              <Text style={styles.detailEventName}>{event.name}</Text>
              <Text style={styles.detailIntroText}>
                Review the confirmed request, service progress, and every coordination action in one place.
              </Text>
            </View>
            <EventCard
              churchDraft={churchDraft}
              event={event}
              mode="detail"
              onChurchDraftChange={onChurchDraftChange}
              onChurchDraftSaved={onChurchDraftSaved}
              onConfirmChurchArrangement={onConfirmChurchArrangement}
              onMessageClient={onMessageClient}
              onMessageProvider={onMessageProvider}
              onSaveChurchArrangement={onSaveChurchArrangement}
            />
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons color={palette.primaryContainer} name="event-busy" size={34} />
            </View>
            <Text style={styles.emptyTitle}>Event is no longer available</Text>
            <Text style={styles.emptyText}>
              This assigned event could not be found. Return to the coordinator workspace to choose another event.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onBack}
              style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
            >
              <MaterialIcons color={palette.primaryContainer} name="arrow-back" size={18} />
              <Text style={styles.refreshButtonText}>Back to coordinator home</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const InvitationCard: React.FC<{
  busy?: boolean
  invitation: CoordinatorInvitation
  onRespond?: (invitation: CoordinatorInvitation, accepted: boolean) => void
}> = ({ busy, invitation, onRespond }) => {
  const [expanded, setExpanded] = React.useState(false)
  const cannotAccept = busy

  return (
  <View style={styles.invitationCard}>
    <View style={styles.invitationHeader}>
      <View style={styles.invitationIcon}>
        <MaterialIcons color={palette.primaryContainer} name="mark-email-unread" size={21} />
      </View>
      <View style={styles.invitationCopy}>
        <Text style={styles.invitationEyebrow}>COORDINATOR BOOKING REQUEST</Text>
        <Text style={styles.invitationTitle}>{invitation.eventName}</Text>
        <Text style={styles.invitationClient}>Requested by {invitation.clientName}</Text>
      </View>
    </View>
    <View style={styles.invitationMeta}>
      <Text style={styles.invitationMetaText}>{dateLabel(invitation.date)}</Text>
      <Text style={styles.invitationMetaText}>
        {invitation.venue || invitation.location || 'Venue to be confirmed'}
      </Text>
      {invitation.guestCount ? (
        <Text style={styles.invitationMetaText}>{invitation.guestCount} guests</Text>
      ) : null}
      <Text style={styles.invitationMetaText}>
        {invitation.currency} {invitation.coordinationFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
      </Text>
    </View>
    <Text style={styles.invitationNotice}>
      Review the request below, then accept to add the event to your coordinator workspace. The client can pay only after every required provider and coordinator has accepted.
    </Text>
    {invitation.isChurchWedding ? (
      <Text style={styles.churchWeddingNotice}>Church wedding — church coordination will be required after acceptance.</Text>
    ) : null}
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((current) => !current)}
      style={({ pressed }) => [styles.invitationDisclosure, pressed && styles.pressedSurface]}
    >
      <Text style={styles.invitationDisclosureText}>
        {expanded ? 'Hide client request' : 'View client request and pricing'}
      </Text>
      <MaterialIcons
        color={palette.primaryContainer}
        name={expanded ? 'expand-less' : 'expand-more'}
        size={19}
      />
    </Pressable>
    {expanded ? (
      <View style={styles.invitationExpanded}>
        <View style={styles.requestFacts}>
          <Text style={styles.requestFact}>Event type: {statusLabel(invitation.eventType || 'Event')}</Text>
          {invitation.isChurchWedding ? (
            <Text style={styles.churchWeddingFact}>Church wedding: church coordination required</Text>
          ) : null}
          <Text style={styles.requestFact}>Time: {timeLabel(invitation.time)}</Text>
          <Text style={styles.requestFact}>
            Event budget: {invitation.totalBudget == null
              ? 'Not specified'
              : pesoLabel(invitation.totalBudget)}
          </Text>
          <Text style={styles.requestFact}>
            Venue plan: {statusLabel(invitation.venueStatus || 'Not specified')}
          </Text>
          {invitation.packageName ? (
            <Text style={styles.requestFact}>Coordinator package: {invitation.packageName}</Text>
          ) : null}
        </View>
        {invitation.clientNotes ? (
          <View style={styles.clientRequestNote}>
            <Text style={styles.instructionLabel}>CLIENT EVENT NOTE</Text>
            <Text style={styles.instructionBody}>{invitation.clientNotes}</Text>
          </View>
        ) : null}
        {invitation.budgetAllocations.length ? (
          <View style={styles.requestServicesBlock}>
            <Text style={styles.financialEyebrow}>CATEGORY BUDGET ALLOCATIONS</Text>
            {invitation.budgetAllocations.map((allocation) => (
              <View key={allocation.categoryKey || allocation.label} style={styles.requestServiceRow}>
                <MaterialIcons color={palette.primaryContainer} name="account-balance-wallet" size={15} />
                <View style={styles.requestServiceCopy}>
                  <Text style={styles.requestServiceName}>{allocation.label}</Text>
                  <Text style={styles.requestServiceMeta}>{pesoLabel(allocation.allocatedAmount)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.requestServicesBlock}>
          <Text style={styles.financialEyebrow}>SELECTED SERVICES</Text>
          {invitation.selectedServices.length ? invitation.selectedServices.map((service) => (
            <View key={service.id} style={styles.requestServiceRow}>
              <MaterialIcons color={palette.primaryContainer} name="business-center" size={15} />
              <View style={styles.requestServiceCopy}>
                <Text style={styles.requestServiceName}>{service.serviceName}</Text>
                <Text style={styles.requestServiceMeta}>
                  {service.providerName} · {service.categoryName}
                </Text>
                {service.cateringOptionName || service.venueOptionName ? (
                  <Text style={styles.requestServiceMeta}>
                    {service.cateringOptionName || service.venueOptionName}
                    {service.venueBookedHours ? ` · ${service.venueBookedHours} hours` : ''}
                  </Text>
                ) : null}
                {service.notes ? <Text style={styles.requestServiceNote}>{service.notes}</Text> : null}
              </View>
            </View>
          )) : (
            <Text style={styles.noServicesText}>No marketplace services have been selected yet.</Text>
          )}
        </View>
        <CoordinatorFinancialSummary financial={invitation.financial} />
      </View>
    ) : null}
    <View style={styles.invitationActions}>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => onRespond?.(invitation, false)}
        style={({ pressed }) => [styles.declineButton, pressed && styles.pressed, busy && styles.disabled]}
      >
        <Text style={styles.declineButtonText}>Decline</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: cannotAccept }}
        disabled={cannotAccept}
        onPress={() => onRespond?.(invitation, true)}
        style={({ pressed }) => [styles.acceptButton, pressed && styles.addButtonPressed, cannotAccept && styles.disabled]}
      >
        {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
          <MaterialIcons color="#FFFFFF" name="check" size={17} />
        )}
        <Text style={styles.acceptButtonText}>{busy ? 'Responding...' : 'Accept booking'}</Text>
      </Pressable>
    </View>
  </View>
  )
}

const TaskRow: React.FC<{
  busy?: boolean
  onToggle?: () => void
  task: CoordinatorTask
}> = ({ busy, onToggle, task }) => {
  const completed = task.status === 'completed'
  const overdue = taskIsOverdue(task)
  const dueToday = taskIsDueToday(task)
  const dueTone = overdue ? styles.taskDueDanger : dueToday ? styles.taskDueToday : undefined

  return (
    <View style={[styles.taskRow, completed && styles.taskRowCompleted]}>
      <Pressable
        accessibilityLabel={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed, disabled: busy }}
        disabled={busy}
        hitSlop={8}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.taskCheckbox,
          completed && styles.taskCheckboxComplete,
          pressed && styles.pressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={palette.primaryContainer} size="small" />
        ) : completed ? (
          <MaterialIcons color="#FFFFFF" name="check" size={16} />
        ) : null}
      </Pressable>
      <View style={styles.taskCopy}>
        <Text numberOfLines={2} style={[styles.taskTitle, completed && styles.taskTitleCompleted]}>
          {task.title}
        </Text>
        <Text numberOfLines={1} style={styles.taskEvent}>{task.eventName}</Text>
        {task.description ? (
          <Text numberOfLines={2} style={styles.taskDescription}>{task.description}</Text>
        ) : null}
      </View>
      <View style={styles.taskAside}>
        <Text style={[styles.taskDue, dueTone]}>
          {overdue ? 'Overdue' : dueToday ? 'Today' : shortDateLabel(task.dueAt)}
        </Text>
        <Text style={styles.taskStatus}>{statusLabel(task.status)}</Text>
      </View>
    </View>
  )
}

const dueAtFrom = (
  choice: DueChoice,
  event: CoordinatorEvent | undefined
) => {
  if (choice === 'none') return undefined
  if (choice === 'event' && event?.date) {
    const eventDate = parseLocalDate(event.date)
    if (!eventDate) return undefined
    eventDate.setHours(9, 0, 0, 0)
    return eventDate.toISOString()
  }

  const due = new Date()
  if (choice === 'tomorrow') due.setDate(due.getDate() + 1)
  due.setHours(17, 0, 0, 0)
  return due.toISOString()
}

export const CoordinatorScreen: React.FC<CoordinatorScreenProps> = ({
  activeView: controlledActiveView,
  avatarUrl,
  busyInvitationId,
  busyTaskId,
  dashboard = emptyDashboard,
  errorMessage,
  hasUnreadEventUpdates = false,
  hasUnreadTaskUpdates = false,
  isLoading = false,
  isRefreshing = false,
  initialScrollOffset = 0,
  onCreateTask,
  onConfirmChurchArrangement,
  onMessageClient,
  onMessageProvider,
  onOpenEvent,
  onSaveChurchArrangement,
  onOpenMessages,
  onOpenNotifications,
  onOpenProfile,
  onOpenServiceProfile,
  onRefresh,
  onRespondInvitation,
  onSignOut,
  onToggleTask,
  onViewChange,
  onScrollPositionChange,
  unreadMessageCount = 0,
  unreadNotificationCount = 0,
  userName = 'Coordinator',
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const [activeView, setActiveView] = React.useState<CoordinatorView>(controlledActiveView ?? 'overview')
  const [taskFilter, setTaskFilter] = React.useState<TaskFilter>('open')
  const [showComposer, setShowComposer] = React.useState(false)
  const [selectedEventId, setSelectedEventId] = React.useState('')
  const [taskTitle, setTaskTitle] = React.useState('')
  const [taskDescription, setTaskDescription] = React.useState('')
  const [dueChoice, setDueChoice] = React.useState<DueChoice>('event')
  const [composerError, setComposerError] = React.useState('')
  const [isCreating, setIsCreating] = React.useState(false)
  const contentSlide = React.useRef(new Animated.Value(1)).current

  React.useEffect(() => {
    if (controlledActiveView && controlledActiveView !== activeView) setActiveView(controlledActiveView)
  }, [activeView, controlledActiveView])

  const activeEvents = dashboard.events.filter(
    (event) => event.status !== 'completed' && event.status !== 'cancelled'
  )
  const openTasks = dashboard.tasks.filter((task) => task.status !== 'completed')
  const completedTasks = dashboard.tasks.length - openTasks.length
  const attentionTasks = openTasks.filter((task) => taskIsOverdue(task) || taskIsDueToday(task))
  const filteredTasks = dashboard.tasks.filter((task) => {
    if (taskFilter === 'open') return task.status !== 'completed'
    if (taskFilter === 'due') return taskIsOverdue(task) || taskIsDueToday(task)
    return true
  })
  const overviewTasks = [...openTasks]
    .sort((left, right) => {
      if (!left.dueAt) return 1
      if (!right.dueAt) return -1
      return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime()
    })
    .slice(0, 4)
  const selectableEvents = activeEvents.length ? activeEvents : dashboard.events
  const selectedEvent = selectableEvents.find((event) => event.id === selectedEventId)

  React.useEffect(() => {
    if (!selectedEventId && selectableEvents[0]) setSelectedEventId(selectableEvents[0].id)
    if (selectedEventId && !selectableEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(selectableEvents[0]?.id ?? '')
    }
  }, [selectableEvents, selectedEventId])

  const selectView = React.useCallback((nextView: CoordinatorView) => {
    if (nextView === activeView) return

    contentSlide.stopAnimation()
    contentSlide.setValue(0)
    setActiveView(nextView)
    onViewChange?.(nextView)
    Animated.timing(contentSlide, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start()
  }, [activeView, contentSlide, onViewChange])

  const submitTask = async () => {
    const normalizedTitle = taskTitle.trim()
    if (normalizedTitle.length < 3) {
      setComposerError('Enter a task title with at least 3 characters.')
      return
    }
    if (!selectedEventId) {
      setComposerError('Choose an assigned event first.')
      return
    }
    if (!onCreateTask) return

    setComposerError('')
    setIsCreating(true)
    const result = await onCreateTask({
      description: taskDescription.trim() || undefined,
      dueAt: dueAtFrom(dueChoice, selectedEvent),
      eventId: selectedEventId,
      title: normalizedTitle,
    })
    setIsCreating(false)

    if (!result.ok) {
      setComposerError(result.message || 'Unable to create the task.')
      return
    }

    setTaskTitle('')
    setTaskDescription('')
    setDueChoice('event')
    setShowComposer(false)
    selectView('tasks')
    setTaskFilter('open')
  }

  const tabs: Array<{ icon: React.ComponentProps<typeof MaterialIcons>['name']; id: CoordinatorView; label: string }> = [
    { icon: 'home', id: 'overview', label: 'Home' },
    { icon: 'event-available', id: 'events', label: 'Events' },
    { icon: 'check-circle', id: 'tasks', label: 'Tasks' },
  ]

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={[styles.topBarContent, isWide && styles.wideHorizontalPadding]}>
          <View style={styles.brandRow}>
            <View>
              <BrandIdentity markSize={34} />
              <Text style={styles.roleLabel}>COORDINATOR WORKSPACE</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="Open messages"
              accessibilityRole="button"
              onPress={onOpenMessages}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressedSurface]}
            >
              <MaterialIcons color={palette.primary} name="chat-bubble-outline" size={21} />
              {unreadMessageCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {Math.min(unreadMessageCount, 9)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityLabel="Open coordinator service profile"
              accessibilityRole="button"
              onPress={onOpenServiceProfile}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressedSurface]}
            >
              <MaterialIcons color={palette.primary} name="storefront" size={22} />
            </Pressable>
            <Pressable
              accessibilityLabel="Open notifications"
              accessibilityRole="button"
              onPress={onOpenNotifications}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressedSurface]}
            >
              <MaterialIcons color={palette.primary} name="notifications-none" size={22} />
              {unreadNotificationCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {Math.min(unreadNotificationCount, 9)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <View style={styles.avatarButton}>
              {avatarUrl ? (
                <Image
                  accessibilityLabel={`${userName} profile photo`}
                  resizeMode="cover"
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>{initialsFrom(userName)}</Text>
              )}
            </View>
            <Pressable
              accessibilityLabel="Sign out"
              accessibilityRole="button"
              onPress={onSignOut}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressedSurface]}
            >
              <MaterialIcons color={palette.primary} name="logout" size={21} />
            </Pressable>
          </View>
        </View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.contentWide : styles.contentMobile,
        ]}
        style={{
          transform: [{
            translateX: contentSlide.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            }),
          }],
        }}
        refreshControl={
          <RefreshControl
            colors={[palette.primaryContainer]}
            onRefresh={onRefresh}
            refreshing={isRefreshing}
            tintColor={palette.primaryContainer}
          />
        }
        contentOffset={{ x: 0, y: initialScrollOffset }}
        onScroll={(event) => onScrollPositionChange?.(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcomeRow}>
          <View style={styles.welcomeCopy}>
            <Text style={styles.eyebrow}>{todayHeading().toUpperCase()}</Text>
            <Text style={styles.greeting}>Good day, {userName}.</Text>
            <Text style={styles.greetingSubtitle}>
              Keep every event, provider, and deadline moving together.
            </Text>
          </View>
          {activeEvents.length > 0 ? (
            <Pressable
              accessibilityLabel="Create coordination task"
              accessibilityRole="button"
              onPress={() => setShowComposer((current) => !current)}
              style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            >
              <MaterialIcons color="#FFFFFF" name={showComposer ? 'close' : 'add'} size={20} />
              <Text style={styles.addButtonText}>{showComposer ? 'Close' : 'New task'}</Text>
            </Pressable>
          ) : null}
        </View>

        {isWide ? <View style={styles.tabBar} accessibilityRole="tablist">
          {tabs.map((tab) => {
            const selected = activeView === tab.id
            return (
              <Pressable
                key={tab.id}
                accessibilityLabel={`Open ${tab.label}`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => selectView(tab.id)}
                style={({ pressed }) => [
                  styles.tab,
                  selected && styles.tabSelected,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons
                  color={selected ? palette.primaryContainer : palette.secondary}
                  name={tab.icon}
                  size={18}
                />
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
              </Pressable>
            )
          })}
        </View> : null}

        {showComposer ? (
          <View style={styles.composerCard}>
            <View style={styles.composerHeader}>
              <View>
                <Text style={styles.composerTitle}>Create coordination task</Text>
                <Text style={styles.composerSubtitle}>Add a clear next action to an assigned event.</Text>
              </View>
              <MaterialIcons color={palette.primaryContainer} name="playlist-add-check" size={26} />
            </View>

            <Text style={styles.inputLabel}>ASSIGNED EVENT</Text>
            <ScrollView
              contentContainerStyle={styles.choiceRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {selectableEvents.map((event) => {
                const selected = event.id === selectedEventId
                return (
                  <Pressable
                    key={event.id}
                    onPress={() => setSelectedEventId(event.id)}
                    style={[styles.choiceChip, selected && styles.choiceChipSelected]}
                  >
                    <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>
                      {event.name}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <Text style={styles.inputLabel}>TASK TITLE</Text>
            <TextInput
              accessibilityLabel="Task title"
              maxLength={160}
              onChangeText={setTaskTitle}
              placeholder="e.g. Confirm venue ingress schedule"
              placeholderTextColor={palette.muted}
              style={styles.textInput}
              value={taskTitle}
            />

            <Text style={styles.inputLabel}>NOTES (OPTIONAL)</Text>
            <TextInput
              accessibilityLabel="Task notes"
              maxLength={1000}
              multiline
              onChangeText={setTaskDescription}
              placeholder="Add the outcome, contact, or details needed."
              placeholderTextColor={palette.muted}
              style={[styles.textInput, styles.notesInput]}
              textAlignVertical="top"
              value={taskDescription}
            />

            <Text style={styles.inputLabel}>DUE</Text>
            <View style={styles.dueChoices}>
              {([
                ['today', 'Today'],
                ['tomorrow', 'Tomorrow'],
                ['event', 'Event day'],
                ['none', 'No deadline'],
              ] as Array<[DueChoice, string]>).map(([id, label]) => {
                const selected = dueChoice === id
                const disabled = id === 'event' && !selectedEvent?.date
                return (
                  <Pressable
                    key={id}
                    disabled={disabled}
                    onPress={() => setDueChoice(id)}
                    style={[
                      styles.dueChip,
                      selected && styles.dueChipSelected,
                      disabled && styles.disabled,
                    ]}
                  >
                    <Text style={[styles.dueChipText, selected && styles.dueChipTextSelected]}>
                      {label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {composerError ? <Text style={styles.formError}>{composerError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={isCreating}
              onPress={() => void submitTask()}
              style={({ pressed }) => [
                styles.createButton,
                pressed && styles.addButtonPressed,
                isCreating && styles.disabled,
              ]}
            >
              {isCreating ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
              <Text style={styles.createButtonText}>{isCreating ? 'Creating task...' : 'Create task'}</Text>
            </Pressable>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <MaterialIcons color={palette.danger} name="error-outline" size={20} />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Workspace could not refresh</Text>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </View>
            <Pressable onPress={onRefresh}><Text style={styles.retryText}>Retry</Text></Pressable>
          </View>
        ) : null}

        {dashboard.invitations.length ? (
          <View style={styles.invitationsBlock}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>AWAITING YOUR RESPONSE</Text>
                <Text style={styles.sectionTitle}>Booking requests</Text>
              </View>
              <Text style={styles.sectionCount}>{dashboard.invitations.length} pending</Text>
            </View>
            <View style={styles.invitationList}>
              {dashboard.invitations.map((invitation) => (
                <InvitationCard
                  key={invitation.eventId}
                  busy={busyInvitationId === invitation.eventId}
                  invitation={invitation}
                  onRespond={onRespondInvitation}
                />
              ))}
            </View>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={palette.primaryContainer} size="large" />
            <Text style={styles.loadingTitle}>Loading coordinator workspace</Text>
            <Text style={styles.loadingText}>Syncing assigned events and task deadlines.</Text>
          </View>
        ) : dashboard.events.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons color={palette.primaryContainer} name="event-busy" size={34} />
            </View>
            <Text style={styles.emptyTitle}>No accepted events yet</Text>
            <Text style={styles.emptyText}>
              Client booking requests appear above. Event schedules, booked services,
              instructions, and tasks become available only after you accept a request.
            </Text>
            <Pressable onPress={onRefresh} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
              <MaterialIcons color={palette.primaryContainer} name="refresh" size={18} />
              <Text style={styles.refreshButtonText}>Check booking requests</Text>
            </Pressable>
          </View>
        ) : activeView === 'overview' ? (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Active events</Text>
                <Text style={styles.statValue}>{activeEvents.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Need attention</Text>
                <Text style={[styles.statValue, attentionTasks.length > 0 && styles.statValueAttention]}>{attentionTasks.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Tasks completed</Text>
                <Text style={styles.statValue}>{completedTasks}</Text>
              </View>
            </View>

            <CoordinatorWalletSummary wallet={dashboard.wallet} />

            <View style={[styles.overviewGrid, isWide && styles.overviewGridWide]}>
              <View style={styles.overviewColumn}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionEyebrow}>NEXT ON YOUR CALENDAR</Text>
                    <Text style={styles.sectionTitle}>Upcoming event</Text>
                  </View>
                  {dashboard.events.length > 1 ? (
                    <Pressable onPress={() => selectView('events')}><Text style={styles.sectionLink}>View all</Text></Pressable>
                  ) : null}
                </View>
                <EventCard
                  event={activeEvents[0] ?? dashboard.events[0]}
                  onConfirmChurchArrangement={onConfirmChurchArrangement}
                  onMessageClient={onMessageClient}
                  onMessageProvider={onMessageProvider}
                  onOpen={onOpenEvent}
                  onSaveChurchArrangement={onSaveChurchArrangement}
                />
              </View>

              <View style={styles.overviewColumn}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionEyebrow}>PRIORITY QUEUE</Text>
                    <Text style={styles.sectionTitle}>Next actions</Text>
                  </View>
                  <Pressable onPress={() => selectView('tasks')}><Text style={styles.sectionLink}>View all</Text></Pressable>
                </View>
                <View style={styles.taskListCard}>
                  {overviewTasks.length ? overviewTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      busy={busyTaskId === task.id}
                      onToggle={() => onToggleTask?.(task)}
                      task={task}
                    />
                  )) : (
                    <View style={styles.compactEmpty}>
                      <MaterialIcons color={palette.success} name="done-all" size={24} />
                      <Text style={styles.compactEmptyTitle}>All caught up</Text>
                      <Text style={styles.compactEmptyText}>There are no open tasks for your assigned events.</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </>
        ) : activeView === 'events' ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>ASSIGNED PORTFOLIO</Text>
                <Text style={styles.sectionTitle}>Your events</Text>
              </View>
              <Text style={styles.sectionCount}>{dashboard.events.length} total</Text>
            </View>
            <View style={[styles.eventList, isWide && styles.eventListWide]}>
              {dashboard.events.map((event) => (
                <View key={event.id} style={isWide ? styles.eventCardWide : undefined}>
                  <EventCard
                    event={event}
                    onConfirmChurchArrangement={onConfirmChurchArrangement}
                    onMessageClient={onMessageClient}
                    onMessageProvider={onMessageProvider}
                    onOpen={onOpenEvent}
                    onSaveChurchArrangement={onSaveChurchArrangement}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>OPERATIONS CHECKLIST</Text>
                <Text style={styles.sectionTitle}>Coordination tasks</Text>
              </View>
              <Text style={styles.sectionCount}>{openTasks.length} open</Text>
            </View>
            <View style={styles.filterRow}>
              {([
                ['open', 'Open'],
                ['due', 'Due now'],
                ['all', 'All tasks'],
              ] as Array<[TaskFilter, string]>).map(([id, label]) => (
                <Pressable
                  key={id}
                  onPress={() => setTaskFilter(id)}
                  style={[styles.filterChip, taskFilter === id && styles.filterChipSelected]}
                >
                  <Text style={[styles.filterText, taskFilter === id && styles.filterTextSelected]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.taskListCard}>
              {filteredTasks.length ? filteredTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  busy={busyTaskId === task.id}
                  onToggle={() => onToggleTask?.(task)}
                  task={task}
                />
              )) : (
                <View style={styles.compactEmpty}>
                  <MaterialIcons color={palette.success} name="check-circle-outline" size={28} />
                  <Text style={styles.compactEmptyTitle}>Nothing in this view</Text>
                  <Text style={styles.compactEmptyText}>Choose another filter or create a task for an active event.</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.securityNote}>
          <MaterialIcons color={palette.secondary} name="verified-user" size={17} />
          <Text style={styles.securityText}>
            This workspace only shows events assigned to your coordinator account.
          </Text>
        </View>
      </Animated.ScrollView>

      {!isWide ? (
        <CoordinatorBottomNavigation
          activeTab={activeView === 'overview' ? 'home' : activeView}
          hasUnreadEvents={hasUnreadEventUpdates}
          hasUnreadMessages={unreadMessageCount > 0}
          hasUnreadTasks={hasUnreadTaskUpdates}
          onSelectTab={(tab) => {
            if (tab === 'account') {
              onOpenProfile?.()
              return
            }
            if (tab === 'messages') {
              onOpenMessages?.()
              return
            }
            selectView(tab === 'home' ? 'overview' : tab)
          }}
        />
      ) : null}
    </View>
  )
}

const palette = {
  background: '#FFFFFF',
  border: '#DFE0E0',
  danger: '#A12C40',
  dangerSoft: '#FBECEF',
  muted: '#9B9290',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5E9EB',
  secondary: '#5D5F5F',
  success: '#1D6B4A',
  successSoft: '#EAF5EF',
  surface: '#FFFFFF',
  surfaceLow: '#F5F3F3',
  text: '#1B1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topBar: {
    zIndex: 20,
    minHeight: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface,
  },
  topBarContent: {
    width: '100%',
    maxWidth: 1024,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  detailTopBar: { minHeight: 64, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  detailTopBarContent: { width: '100%', maxWidth: 900, minHeight: 64, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 10 },
  detailBackButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  detailHeadingCopy: { minWidth: 0, flex: 1 },
  detailEyebrow: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1 },
  detailTitle: { color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '700', marginTop: 1 },
  detailContent: { width: '100%', maxWidth: 900, alignSelf: 'center' },
  detailContentMobile: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  detailContentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 56 },
  detailIntro: { marginBottom: 16 },
  detailEventName: { color: palette.text, fontSize: 23, lineHeight: 30, fontWeight: '700', marginTop: 3 },
  detailIntroText: { maxWidth: 620, color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
  detailSectionLabel: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  detailManagementLabel: { marginBottom: 6, marginTop: 14 },
  wideHorizontalPadding: { paddingHorizontal: 32 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roleLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.1, marginLeft: 44 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  notificationBadge: {
    position: 'absolute', top: 2, right: 1, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: palette.surface, borderRadius: 8, backgroundColor: palette.primaryContainer,
  },
  notificationBadgeText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  avatarButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: palette.primary },
  avatarImage: { width: '100%', height: '100%', borderRadius: 18 },
  avatarText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  content: { width: '100%', maxWidth: 768, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 112 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 48 },
  welcomeRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 },
  welcomeCopy: { minWidth: 0, flex: 1 },
  eyebrow: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.1, marginBottom: 5 },
  greeting: { color: palette.text, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  greetingSubtitle: { color: palette.secondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  addButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: palette.primaryContainer, paddingHorizontal: 14 },
  addButtonPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  addButtonText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  tabBar: { flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: palette.surface, padding: 4, marginBottom: 22 },
  tab: { minHeight: 40, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8 },
  tabSelected: { backgroundColor: palette.primarySoft },
  tabText: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  tabTextSelected: { color: palette.primaryContainer, fontWeight: '700' },
  composerCard: { borderWidth: 1, borderColor: '#D9C4C8', borderRadius: 14, backgroundColor: palette.surface, padding: 16, marginBottom: 22 },
  composerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  composerTitle: { color: palette.text, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  composerSubtitle: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 3 },
  inputLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.8, marginBottom: 7, marginTop: 12 },
  choiceRow: { gap: 8, paddingRight: 4 },
  choiceChip: { maxWidth: 240, minHeight: 36, justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 18, paddingHorizontal: 12 },
  choiceChipSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primarySoft },
  choiceChipText: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  choiceChipTextSelected: { color: palette.primaryContainer, fontWeight: '700' },
  textInput: { minHeight: 44, borderWidth: 1, borderColor: palette.border, borderRadius: 9, backgroundColor: '#FCFBFB', color: palette.text, fontFamily: 'Inter_400Regular', fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  notesInput: { minHeight: 76 },
  dueChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  dueChip: { minHeight: 34, justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 17, paddingHorizontal: 11 },
  dueChipSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primaryContainer },
  dueChipText: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  dueChipTextSelected: { color: '#FFFFFF' },
  formError: { color: palette.danger, fontSize: 12, lineHeight: 16, marginTop: 12 },
  createButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 9, backgroundColor: palette.primaryContainer, marginTop: 16 },
  createButtonText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#ECC7CF', borderRadius: 10, backgroundColor: palette.dangerSoft, padding: 12, marginBottom: 20 },
  errorCopy: { minWidth: 0, flex: 1 },
  errorTitle: { color: palette.danger, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  errorMessage: { color: '#7D4650', fontSize: 12, lineHeight: 16, marginTop: 2 },
  retryText: { color: palette.danger, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  loadingState: { alignItems: 'center', justifyContent: 'center', minHeight: 330, padding: 28 },
  loadingTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '700', marginTop: 16 },
  loadingText: { color: palette.secondary, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
  emptyState: { alignItems: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 16, backgroundColor: palette.surface, paddingHorizontal: 28, paddingVertical: 44 },
  emptyIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 32, backgroundColor: palette.primarySoft, marginBottom: 16 },
  emptyTitle: { color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  emptyText: { maxWidth: 480, color: palette.secondary, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  refreshButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#D8C5C8', borderRadius: 9, paddingHorizontal: 14, marginTop: 20 },
  refreshButtonText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  statCard: { minWidth: 0, minHeight: 88, flex: 1, justifyContent: 'space-between', borderWidth: 1, borderColor: '#E3E2E2', borderRadius: 8, backgroundColor: palette.surface, padding: 16 },
  statIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: palette.primarySoft, marginBottom: 12 },
  statIconAttention: { backgroundColor: palette.dangerSoft },
  statValue: { color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  statValueAttention: { color: palette.danger },
  statLabel: { minHeight: 32, color: palette.secondary, fontSize: 12, lineHeight: 16, marginBottom: 8 },
  walletCard: { gap: 12, borderWidth: 1, borderColor: '#D9C4C8', borderRadius: 12, backgroundColor: palette.surface, marginBottom: 26, padding: 14 },
  walletHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  walletEyebrow: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.8 },
  walletTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '700', marginTop: 2 },
  walletGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  walletItem: { minWidth: '47%', flexGrow: 1, borderRadius: 8, backgroundColor: palette.surfaceLow, padding: 9 },
  walletLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.35 },
  walletValue: { color: palette.primaryContainer, fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 3 },
  walletExplanation: { color: palette.secondary, fontSize: 12, lineHeight: 17 },
  walletReceivableList: { borderTopWidth: 1, borderTopColor: palette.border },
  walletReceivableRow: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  walletReceivableRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  walletReceivableCopy: { minWidth: 0, flex: 1 },
  walletReceivableEvent: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  walletReceivableService: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 1 },
  walletReceivableMeta: { color: palette.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  walletReceivableAmountColumn: { maxWidth: '42%', alignItems: 'flex-end' },
  walletReceivableAmount: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  walletReceivableStatus: { maxWidth: 126, color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 3, textAlign: 'right' },
  overviewGrid: { gap: 26 },
  overviewGridWide: { alignItems: 'stretch' },
  overviewColumn: { minWidth: 0, width: '100%' },
  sectionBlock: { marginBottom: 18 },
  sectionHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 9, marginBottom: 12 },
  sectionEyebrow: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.9 },
  sectionTitle: { color: palette.text, fontSize: 17, lineHeight: 23, fontWeight: '700', marginTop: 2 },
  sectionLink: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  sectionCount: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  invitationsBlock: { marginBottom: 24 },
  invitationList: { gap: 10 },
  invitationCard: { borderWidth: 1, borderColor: '#D9C4C8', borderRadius: 13, backgroundColor: palette.surface, padding: 14 },
  invitationHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  invitationIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: palette.primarySoft },
  invitationCopy: { minWidth: 0, flex: 1 },
  invitationEyebrow: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.7 },
  invitationTitle: { color: palette.text, fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: 2 },
  invitationClient: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 1 },
  invitationMeta: { gap: 3, borderTopWidth: 1, borderTopColor: palette.border, marginTop: 12, paddingTop: 10 },
  invitationMetaText: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  invitationNotice: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 10 },
  churchWeddingNotice: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 5 },
  invitationDisclosure: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: palette.surfaceLow, marginTop: 10, paddingHorizontal: 10 },
  invitationDisclosureText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  invitationExpanded: { gap: 10, borderTopWidth: 1, borderTopColor: palette.border, marginTop: 12, paddingTop: 12 },
  requestFacts: { gap: 3 },
  requestFact: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  churchWeddingFact: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  churchArrangementPanel: { borderWidth: 1, borderColor: '#D9C4C8', borderRadius: 10, backgroundColor: '#FFFBFB', marginTop: 13, padding: 12 },
  churchArrangementPanelHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  churchArrangementTitle: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.7 },
  churchArrangementCaption: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  churchDetailsDisclosure: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 8, backgroundColor: palette.primarySoft, marginTop: 12, padding: 10 },
  churchDetailsCollapsed: { display: 'none' },
  churchCurrentStatusText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  churchProposalVersion: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  churchResponseCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: palette.surfaceLow, marginTop: 9, padding: 10 },
  churchResponseValue: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  churchDeclineReason: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 4 },
  churchStatusChoices: { gap: 7, paddingRight: 6 },
  churchStatusChip: { minHeight: 32, justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 16, paddingHorizontal: 10 },
  churchStatusChipSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primarySoft },
  churchStatusChipText: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  churchStatusChipTextSelected: { color: palette.primaryContainer, fontWeight: '700' },
  churchLocationCard: { gap: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 11, backgroundColor: palette.surfaceLow, padding: 10 },
  churchLocationFallback: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  churchLocationFallbackTitle: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  churchLocationFallbackText: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  churchPickerButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: palette.primaryContainer, borderRadius: 9 },
  churchPickerButtonText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  churchDateTimeRow: { flexDirection: 'row', gap: 8 },
  churchDateTimeField: { minWidth: 0, flex: 1 },
  churchPickerField: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: palette.border, borderRadius: 9, backgroundColor: '#FCFBFB', paddingHorizontal: 10 },
  churchDateReadOnlyField: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: palette.border, borderRadius: 9, backgroundColor: '#F6F2F3', paddingHorizontal: 10 },
  churchDateReadOnlyCopy: { minWidth: 0, flex: 1, gap: 1 },
  churchDateReadOnlyHint: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  churchPickerFieldText: { minWidth: 0, flex: 1, color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  churchPickerPlaceholder: { color: palette.secondary, fontWeight: '400' },
  churchUpdatedAt: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 10 },
  confirmChurchButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: palette.primaryContainer, borderRadius: 9, marginTop: 9 },
  confirmChurchButtonText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  churchDeclinedGuidance: { color: palette.danger, fontSize: 12, lineHeight: 16, marginTop: 7 },
  churchModalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28, 18, 20, 0.58)', padding: 20 },
  churchModalCard: { width: '100%', maxWidth: 520, borderRadius: 16, backgroundColor: palette.surface, padding: 18 },
  churchMapModalCard: { width: '100%', maxWidth: 620, borderRadius: 16, backgroundColor: palette.surface, padding: 18 },
  churchModalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  churchModalTitle: { color: palette.text, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  churchModalText: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
  churchConfirmationChoices: { gap: 7, marginBottom: 14 },
  churchConfirmationChoice: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: palette.border, borderRadius: 9, paddingHorizontal: 11 },
  churchConfirmationChoiceSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primaryContainer },
  churchConfirmationChoiceText: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  churchConfirmationChoiceTextSelected: { color: '#FFFFFF' },
  churchConfirmationDisclaimer: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 9 },
  churchMapDisclaimer: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 10 },
  churchModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  churchModalCancel: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 9, paddingHorizontal: 15 },
  churchModalCancelText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  churchModalConfirm: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 9, backgroundColor: palette.primaryContainer, paddingHorizontal: 15 },
  churchModalConfirmText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  requestServicesBlock: { gap: 7 },
  requestServiceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 8, backgroundColor: palette.surfaceLow, padding: 9 },
  requestServiceCopy: { minWidth: 0, flex: 1 },
  requestServiceName: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  requestServiceMeta: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 1 },
  requestServiceNote: { color: palette.text, fontSize: 12, lineHeight: 16, marginTop: 4 },
  invitationActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 13 },
  declineButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D8C5C8', borderRadius: 9, paddingHorizontal: 15 },
  declineButtonText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  acceptButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9, backgroundColor: palette.primaryContainer, paddingHorizontal: 15 },
  acceptButtonText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  eventList: { gap: 12 },
  eventListWide: { flexDirection: 'row', flexWrap: 'wrap' },
  eventCardWide: { width: '49%' },
  eventCard: { overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: palette.surface },
  eventAccent: { width: 4, backgroundColor: palette.primaryContainer },
  eventCardBody: { minWidth: 0, flex: 1, padding: 14 },
  eventCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  eventHeadingCopy: { minWidth: 0, flex: 1 },
  eventHeaderAside: { alignItems: 'flex-end', gap: 5 },
  eventType: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  eventName: { color: palette.text, fontSize: 16, lineHeight: 21, fontWeight: '700', marginTop: 2 },
  clientName: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  statusPill: { borderRadius: 10, backgroundColor: palette.primarySoft, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  eventMetaGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  eventMetaItem: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  metaCopy: { minWidth: 0, flex: 1 },
  metaLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6 },
  metaValue: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '600', marginTop: 2 },
  metaSubvalue: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  eventCountdownRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 9 },
  eventCountdownText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  disclosureHint: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 9 },
  disclosureHintText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  eventExpandedContent: { borderTopWidth: 1, borderTopColor: palette.border, marginTop: 4, paddingTop: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  progressValue: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  progressTrack: { height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: palette.surfaceLow },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: palette.primaryContainer },
  eventFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  eventFooterText: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  financialCard: { gap: 9, borderWidth: 1, borderColor: '#D7E5DC', borderRadius: 9, backgroundColor: '#F4FAF6', marginTop: 13, padding: 11 },
  financialHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  financialHeaderCopy: { minWidth: 0, flex: 1 },
  financialEyebrow: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.7 },
  financialStatus: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  financialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  financialItem: { minWidth: '47%', flexGrow: 1, borderRadius: 7, backgroundColor: palette.surface, padding: 8 },
  financialLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4 },
  financialValue: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  financialExplanation: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  financialBalanceStatus: { color: palette.success, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  clientRequestNote: { gap: 4, borderLeftWidth: 3, borderLeftColor: palette.primaryContainer, borderRadius: 7, backgroundColor: palette.primarySoft, marginTop: 11, padding: 10 },
  coordinatorInstructionsBlock: { gap: 8, borderWidth: 1, borderColor: '#D9C4C8', borderRadius: 9, backgroundColor: palette.primarySoft, marginTop: 13, padding: 10 },
  coordinatorInstructionsHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  coordinatorInstructionsCaption: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  servicesBlock: { borderTopWidth: 1, borderTopColor: palette.border, marginTop: 13, paddingTop: 12, gap: 8 },
  servicesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  servicesLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.7 },
  servicesCount: { minWidth: 20, color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', textAlign: 'right' },
  serviceRow: { gap: 8, borderRadius: 8, backgroundColor: palette.surfaceLow, padding: 8 },
  serviceSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: palette.primarySoft },
  serviceCopy: { minWidth: 0, flex: 1 },
  serviceName: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  serviceProvider: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 1 },
  serviceInstructionCount: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '600', marginTop: 2 },
  serviceAside: { alignItems: 'flex-end' },
  serviceAmount: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  serviceStatus: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 1 },
  serviceStatusBooked: { color: palette.success },
  serviceExpandedContent: { gap: 8 },
  clientNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, paddingTop: 8 },
  instructionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, paddingTop: 8 },
  instructionCopy: { minWidth: 0, flex: 1 },
  instructionLabel: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.5 },
  instructionTitle: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  instructionBody: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  instructionTags: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '600', marginTop: 3 },
  providerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, paddingTop: 8 },
  providerAction: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#D8C5C8', borderRadius: 8, backgroundColor: palette.surface, paddingHorizontal: 10 },
  providerActionText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  noServicesText: { color: palette.muted, fontSize: 12, lineHeight: 16, fontStyle: 'italic' },
  taskListCard: { overflow: 'hidden', borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: palette.surface },
  taskRow: { minHeight: 76, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border, padding: 12 },
  taskRowCompleted: { backgroundColor: '#FBFAFA' },
  taskCheckbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#B9AFAD', borderRadius: 7, marginTop: 1 },
  taskCheckboxComplete: { borderColor: palette.success, backgroundColor: palette.success },
  taskCopy: { minWidth: 0, flex: 1 },
  taskTitle: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  taskTitleCompleted: { color: palette.secondary, textDecorationLine: 'line-through' },
  taskEvent: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '600', marginTop: 2 },
  taskDescription: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 4 },
  taskAside: { width: 66, alignItems: 'flex-end' },
  taskDue: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  taskDueDanger: { color: palette.danger },
  taskDueToday: { color: palette.primaryContainer },
  taskStatus: { color: palette.muted, fontSize: 12, lineHeight: 16, marginTop: 4 },
  compactEmpty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 30 },
  compactEmptyTitle: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 8 },
  compactEmptyText: { color: palette.secondary, fontSize: 12, lineHeight: 16, textAlign: 'center', marginTop: 3 },
  filterRow: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  filterChip: { minHeight: 34, justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 17, backgroundColor: palette.surface, paddingHorizontal: 12 },
  filterChipSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primarySoft },
  filterText: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  filterTextSelected: { color: palette.primaryContainer, fontWeight: '700' },
  securityNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 30, paddingVertical: 12 },
  securityText: { color: palette.secondary, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  bottomNavigation: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    left: 20,
    zIndex: 50,
    height: 60,
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
  },
  bottomNavigationContent: {
    width: '100%',
    maxWidth: 600,
    height: 52,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomNavActiveIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 64,
    borderRadius: 28,
    backgroundColor: 'rgba(226, 226, 226, 0.6)',
  },
  bottomNavItem: {
    minWidth: 0,
    height: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavIcon: {
    width: 40,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    marginBottom: 2,
  },
  bottomNavLabel: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    opacity: 0.8,
  },
  bottomNavLabelSelected: { color: palette.primary, fontWeight: '700', opacity: 1 },
  pressed: { opacity: 0.65 },
  pressedSurface: { backgroundColor: palette.surfaceLow },
  disabled: { opacity: 0.45 },
})
