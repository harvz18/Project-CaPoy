import React from 'react'
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { MerchantBottomNavigation } from '../components/MerchantBottomNavigation'
import type { MerchantServiceListing } from '../lib/merchant'
import type { MerchantHomeTab } from './16-MerchantHome'

interface ProviderServicesScreenProps {
  hasDraft?: boolean
  deletingServiceId?: string
  updatingAvailabilityServiceId?: string
  services?: MerchantServiceListing[]
  onAddService?: () => void
  onBack?: () => void
  onContinueDraft?: () => void
  onDeleteService?: (service: MerchantServiceListing) => void
  onEditService?: (service: MerchantServiceListing) => void
  onOpenAccount?: () => void
  onSelectService?: (service: MerchantServiceListing) => void
  onSetAvailability?: (service: MerchantServiceListing, isAvailable: boolean) => void
  onSelectTab?: (tab: MerchantHomeTab) => void
}

const formatPrice = (value: number) => {
  if (!value) return 'Quote based'

  return `PHP ${Math.round(value).toLocaleString('en-US')}`
}

const formatApprovalStatus = (status: string) => {
  const normalized = status.trim().toLowerCase()

  if (normalized === 'active') return 'Approved'
  if (normalized === 'draft') return 'Draft'
  if (normalized === 'pending_review') return 'Awaiting review'
  if (normalized === 'rejected') return 'Needs changes'
  if (normalized === 'inactive') return 'Hidden'

  return normalized.length > 0 ? normalized : 'Draft'
}

export const ProviderServicesScreen: React.FC<ProviderServicesScreenProps> = ({
  hasDraft = false,
  deletingServiceId = '',
  updatingAvailabilityServiceId = '',
  services = [],
  onAddService,
  onBack,
  onContinueDraft,
  onDeleteService,
  onEditService,
  onOpenAccount,
  onSelectService,
  onSetAvailability,
  onSelectTab,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const [deleteTarget, setDeleteTarget] = React.useState<MerchantServiceListing>()
  const [availabilityTarget, setAvailabilityTarget] = React.useState<MerchantServiceListing>()

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.widePadding]}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Text style={styles.iconText}>{'<'}</Text>
          </Pressable>
          <Text style={styles.brand}>MULTIVENT</Text>
          <Pressable
            accessibilityLabel="Open account"
            accessibilityRole="button"
            onPress={onOpenAccount}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Text style={styles.accountIcon}>O</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide && styles.contentWide,
          !isWide && styles.contentWithNav,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Your Services</Text>
            <Text style={styles.subtitle}>
              {services.length === 0
                ? 'Published services will appear here.'
                : `${services.length} ${services.length === 1 ? 'service' : 'services'} uploaded`}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Add service"
            accessibilityRole="button"
            onPress={onAddService}
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          >
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addText}>Add Service</Text>
          </Pressable>
        </View>

        {hasDraft ? (
          <Pressable
            accessibilityLabel="Continue saved service draft"
            accessibilityRole="button"
            onPress={onContinueDraft}
            style={({ pressed }) => [styles.draftBanner, pressed && styles.draftBannerPressed]}
          >
            <View style={styles.draftCopy}>
              <Text style={styles.draftTitle}>Unpublished draft saved</Text>
              <Text style={styles.draftText}>Continue your last service listing.</Text>
            </View>
            <Text style={styles.draftAction}>Continue</Text>
          </Pressable>
        ) : null}

        {services.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No services uploaded yet</Text>
            <Text style={styles.emptyCopy}>
              Add a service to make it visible to clients once it is published.
            </Text>
          </View>
        ) : (
          <View style={styles.serviceList}>
            {services.map((service) => (
              <View
                key={service.id}
                style={styles.serviceCard}
              >
                {service.coverImageUrl ? (
                  <Image
                    accessibilityLabel={`${service.name} cover photo`}
                    resizeMode="cover"
                    source={{ uri: service.coverImageUrl }}
                    style={styles.serviceImage}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderText}>
                      {service.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={styles.serviceBody}>
                  <View style={styles.serviceTitleRow}>
                    <Text numberOfLines={1} style={styles.serviceName}>
                      {service.name}
                    </Text>
                  </View>
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusPill,
                        service.status === 'active' && styles.statusApproved,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          service.status === 'active' && styles.statusApprovedText,
                        ]}
                      >
                        {formatApprovalStatus(service.status)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.visibilityPill,
                        service.status === 'active' && service.isAvailable && styles.visibilityLive,
                      ]}
                    >
                      <View
                        style={[
                          styles.visibilityDot,
                          service.status === 'active' && service.isAvailable && styles.visibilityDotLive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.visibilityText,
                          service.status === 'active' && service.isAvailable && styles.visibilityTextLive,
                        ]}
                      >
                        {service.status === 'active' && service.isAvailable ? 'Live' : 'Not available'}
                      </Text>
                    </View>
                  </View>
                  <Text numberOfLines={2} style={styles.serviceDescription}>
                    {service.description || service.categoryName}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>{service.categoryName}</Text>
                    <Text style={styles.metaDot}>|</Text>
                    <Text style={styles.metaText}>{formatPrice(service.basePrice)}</Text>
                    <Text style={styles.metaDot}>|</Text>
                    <Text style={styles.metaText}>
                      {service.packageCount} {service.packageCount === 1 ? 'package' : 'packages'}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    {service.status === 'active' ? (
                      <Pressable
                        accessibilityLabel={`${service.isAvailable ? 'Mark' : 'Make'} ${service.name} ${service.isAvailable ? 'not available' : 'live'}`}
                        accessibilityRole="switch"
                        accessibilityState={{
                          checked: service.isAvailable,
                          disabled: updatingAvailabilityServiceId === service.id,
                        }}
                        disabled={updatingAvailabilityServiceId === service.id}
                        onPress={() => setAvailabilityTarget(service)}
                        style={({ pressed }) => [
                          styles.availabilityButton,
                          pressed && styles.serviceCardPressed,
                        ]}
                      >
                        <View style={[styles.toggleTrack, service.isAvailable && styles.toggleTrackOn]}>
                          <View style={[styles.toggleThumb, service.isAvailable && styles.toggleThumbOn]} />
                        </View>
                        <Text style={styles.availabilityButtonText}>
                          {updatingAvailabilityServiceId === service.id
                            ? 'Updating...'
                            : service.isAvailable
                              ? 'Set N/A'
                              : 'Go live'}
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityLabel={`Edit ${service.name}`}
                      accessibilityRole="button"
                      onPress={() => onEditService?.(service)}
                      style={({ pressed }) => [styles.editButton, pressed && styles.serviceCardPressed]}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Delete ${service.name}`}
                      accessibilityRole="button"
                      disabled={deletingServiceId === service.id}
                      onPress={() => setDeleteTarget(service)}
                      style={({ pressed }) => [styles.deleteButton, pressed && styles.serviceCardPressed]}
                    >
                      <Text style={styles.deleteButtonText}>
                        {deletingServiceId === service.id ? 'Deleting...' : 'Delete'}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Open ${service.name}`}
                      accessibilityRole="button"
                      onPress={() => onSelectService?.(service)}
                      style={({ pressed }) => [styles.viewButton, pressed && styles.serviceCardPressed]}
                    >
                      <Text style={styles.viewButtonText}>Details</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {!isWide ? (
        <MerchantBottomNavigation activeTab="services" onSelectTab={onSelectTab} />
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setDeleteTarget(undefined)}
        transparent
        visible={Boolean(deleteTarget)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>Delete this service?</Text>
            <Text style={styles.confirmationCopy}>
              {deleteTarget?.name} will be removed from your service list. Existing booking history will be preserved.
            </Text>
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDeleteTarget(undefined)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (deleteTarget) onDeleteService?.(deleteTarget)
                  setDeleteTarget(undefined)
                }}
                style={({ pressed }) => [styles.confirmDeleteButton, pressed && styles.pressed]}
              >
                <Text style={styles.confirmDeleteText}>Delete service</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setAvailabilityTarget(undefined)}
        transparent
        visible={Boolean(availabilityTarget)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>
              {availabilityTarget?.isAvailable
                ? 'Mark this service not available?'
                : 'Make this service live?'}
            </Text>
            <Text style={styles.confirmationCopy}>
              {availabilityTarget?.isAvailable
                ? `${availabilityTarget.name} will be hidden from the client marketplace and cannot receive new bookings. Existing bookings are not affected.`
                : `${availabilityTarget?.name} will be visible and bookable by clients again.`}
            </Text>
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAvailabilityTarget(undefined)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (availabilityTarget) {
                    onSetAvailability?.(availabilityTarget, !availabilityTarget.isAvailable)
                  }
                  setAvailabilityTarget(undefined)
                }}
                style={({ pressed }) => [
                  styles.confirmAvailabilityButton,
                  availabilityTarget?.isAvailable && styles.confirmUnavailableButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.confirmAvailabilityText}>
                  {availabilityTarget?.isAvailable ? 'Yes, mark N/A' : 'Yes, go live'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  muted: '#5D5F5F',
  primary: '#6B1E2E',
  surface: '#FFFFFF',
  surfaceLow: '#F5F3F3',
  text: '#1B1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    minHeight: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#DAC0C2',
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1024,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  widePadding: { paddingHorizontal: 32 },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  pressed: { backgroundColor: palette.surfaceLow, opacity: 0.72 },
  iconText: {
    color: palette.primary,
    fontSize: 34,
    lineHeight: 38,
  },
  accountIcon: {
    color: palette.primary,
    fontSize: 24,
    lineHeight: 28,
  },
  brand: {
    color: '#4E061A',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 28,
  },
  contentWide: { paddingHorizontal: 32, paddingTop: 28 },
  contentWithNav: { paddingBottom: 112 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 18,
  },
  headerCopy: { minWidth: 0, flex: 1 },
  title: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  addButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: palette.primary,
    paddingHorizontal: 14,
  },
  addButtonPressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
  addIcon: {
    color: palette.surface,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  addText: {
    color: palette.surface,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  draftBanner: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderWidth: 1,
    borderColor: '#D8B9BE',
    borderRadius: 8,
    backgroundColor: '#FFF8F9',
    padding: 16,
    marginBottom: 18,
  },
  draftBannerPressed: { opacity: 0.82 },
  draftCopy: { minWidth: 0, flex: 1 },
  draftTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  draftText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  draftAction: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  emptyState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.surface,
    padding: 24,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
  emptyCopy: {
    maxWidth: 320,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  serviceList: { gap: 12 },
  serviceCard: {
    minHeight: 118,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.surface,
  },
  serviceCardPressed: { opacity: 0.84 },
  serviceImage: { width: 104, minHeight: 118 },
  imagePlaceholder: {
    width: 104,
    minHeight: 118,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceLow,
  },
  imagePlaceholderText: {
    color: palette.primary,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  serviceBody: {
    minWidth: 0,
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },
  serviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  serviceName: {
    minWidth: 0,
    flex: 1,
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  statusPill: {
    borderRadius: 8,
    backgroundColor: palette.surfaceLow,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusApproved: { backgroundColor: '#EAF6EE' },
  statusText: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  statusApprovedText: { color: '#176339' },
  visibilityPill: {
    alignItems: 'center',
    backgroundColor: '#F5EDEE',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  visibilityLive: { backgroundColor: '#E8F5EC' },
  visibilityDot: { backgroundColor: '#9A6A72', borderRadius: 3, height: 6, width: 6 },
  visibilityDotLive: { backgroundColor: '#24814C' },
  visibilityText: { color: '#7D4F57', fontSize: 11, fontWeight: '700', lineHeight: 15 },
  visibilityTextLive: { color: '#176339' },
  serviceDescription: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  metaText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  metaDot: {
    color: '#B3A4A6',
    fontSize: 12,
    lineHeight: 17,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  availabilityButton: {
    minHeight: 34,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8B9BE',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  availabilityButtonText: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  toggleTrack: {
    backgroundColor: '#C8BEC0',
    borderRadius: 7,
    height: 14,
    padding: 2,
    width: 25,
  },
  toggleTrackOn: { backgroundColor: '#3B8C5E' },
  toggleThumb: { backgroundColor: palette.surface, borderRadius: 5, height: 10, width: 10 },
  toggleThumbOn: { transform: [{ translateX: 11 }] },
  editButton: {
    minHeight: 34,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8B9BE',
    borderRadius: 8,
    paddingHorizontal: 13,
  },
  editButtonText: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  deleteButton: {
    minHeight: 34,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7C9CD',
    borderRadius: 8,
    paddingHorizontal: 13,
  },
  deleteButtonText: { color: '#A33142', fontSize: 12, fontWeight: '700' },
  viewButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 8 },
  viewButtonText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(33, 17, 22, 0.54)',
    padding: 24,
  },
  confirmationCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: palette.surface,
    padding: 24,
  },
  confirmationTitle: { color: palette.text, fontSize: 20, fontWeight: '700' },
  confirmationCopy: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  confirmationActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 24 },
  cancelButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 16 },
  cancelButtonText: { color: palette.muted, fontSize: 14, fontWeight: '700' },
  confirmDeleteButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#A33142',
    paddingHorizontal: 16,
  },
  confirmDeleteText: { color: palette.surface, fontSize: 14, fontWeight: '700' },
  confirmAvailabilityButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#277647',
    paddingHorizontal: 16,
  },
  confirmUnavailableButton: { backgroundColor: palette.primary },
  confirmAvailabilityText: { color: palette.surface, fontSize: 14, fontWeight: '700' },
})
