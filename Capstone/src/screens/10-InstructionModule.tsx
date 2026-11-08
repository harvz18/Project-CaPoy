import { Text } from '../components/AppText'
import React from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  
  TextInput,
  View,
} from 'react-native'
import { PlanningScreenHeader } from '../components/PlanningScreenHeader'
import { neutralSelection } from '../theme/neumorphism'

export interface InstructionModuleService {
  category: string
  coordinatorId?: string
  id: string
  imageLabel: string
  imageUrl: string
  name: string
  providerId?: string
  providerName: string
  serviceId?: string
}

export interface InstructionModuleValue {
  requests: Array<{
    category: string
    dietaryRestrictions: string
    mustHaveShots: string
    notes: string
    coordinatorId?: string
    providerId?: string
    selectedTags: string[]
    serviceId?: string
    serviceKey: string
    serviceName: string
    setupRequirements: string
    specialMenuRequests: string
  }>
}

interface InstructionModuleScreenProps {
  onBack?: () => void
  onBrandPress?: () => void
  onDraftChange?: (value: InstructionModuleValue) => void
  onSaveContinue?: (value: InstructionModuleValue) => Promise<void> | void
  initialValue?: InstructionModuleValue
  services?: InstructionModuleService[]
}

const commonTags = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Nut Allergy', 'Dairy-Free']
const emptyInstructionServices: InstructionModuleService[] = []

type InstructionDraft = {
  dietaryRestrictions: string
  mustHaveShots: string
  notes: string
  selectedTags: string[]
  setupRequirements: string
  specialMenuRequests: string
}

const emptyDraft = (): InstructionDraft => ({
  dietaryRestrictions: '',
  mustHaveShots: '',
  notes: '',
  selectedTags: [],
  setupRequirements: '',
  specialMenuRequests: '',
})

const draftsForServices = (
  services: InstructionModuleService[],
  initialValue?: InstructionModuleValue
) => Object.fromEntries(services.map((service) => {
  const saved = initialValue?.requests.find((request) => (
    request.serviceKey === service.id || request.serviceId === service.serviceId
  ))

  return [
    service.id,
    {
      dietaryRestrictions: saved?.dietaryRestrictions ?? '',
      mustHaveShots: saved?.mustHaveShots ?? '',
      notes: saved?.notes ?? '',
      selectedTags: saved?.selectedTags ?? [],
      setupRequirements: saved?.setupRequirements ?? '',
      specialMenuRequests: saved?.specialMenuRequests ?? '',
    } satisfies InstructionDraft,
  ]
}))

const instructionKind = (category: string) => {
  const normalized = category.toLowerCase()
  if (normalized.includes('cater')) return 'catering'
  if (normalized.includes('venue') || normalized.includes('estate')) return 'venue'
  if (normalized.includes('photo')) return 'photography'
  return 'general'
}

const generalRequestCopy = (category: string): [string, string] => {
  const normalized = category.toLowerCase()
  if (normalized.includes('flor')) return ['FLORAL & STYLING REQUESTS', 'Colors, flowers, bouquet, or styling details...']
  if (normalized.includes('attire')) return ['FITTING & ATTIRE REQUESTS', 'Sizes, fitting schedule, style, or alteration notes...']
  if (normalized.includes('sound') || normalized.includes('light')) return ['TECHNICAL REQUIREMENTS', 'Stage, microphones, lighting cues, or equipment needs...']
  if (normalized.includes('host') || normalized.includes('emcee')) return ['PROGRAM & HOSTING NOTES', 'Program flow, tone, language, games, or announcements...']
  if (normalized.includes('organizer') || normalized.includes('coordinator')) return ['PLANNING & COORDINATION NOTES', 'Program flow, family arrangements, timelines, or supplier notes...']
  return ['SPECIAL REQUESTS', `Add any requests for this ${category.toLowerCase()} service...`]
}

export const InstructionModuleScreen: React.FC<InstructionModuleScreenProps> = ({
  initialValue,
  onBack,
  onBrandPress,
  onDraftChange,
  onSaveContinue,
  services = emptyInstructionServices,
}) => {
  const [expandedProviders, setExpandedProviders] = React.useState<string[]>(() =>
    services[0]?.id ? [services[0].id] : []
  )
  const [drafts, setDrafts] = React.useState<Record<string, InstructionDraft>>(() =>
    draftsForServices(services, initialValue)
  )
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    setDrafts((current) => {
      const next = { ...current }
      const initialDrafts = draftsForServices(services, initialValue)
      let changed = false

      services.forEach((service) => {
        if (next[service.id]) return

        next[service.id] = initialDrafts[service.id] ?? emptyDraft()
        changed = true
      })

      return changed ? next : current
    })
    setExpandedProviders((current) =>
      current.length > 0 || !services[0]?.id ? current : [services[0].id]
    )
  }, [initialValue, services])

  const toggleProvider = (provider: string) => {
    setExpandedProviders((current) =>
      current.includes(provider)
        ? current.filter((item) => item !== provider)
        : [...current, provider]
    )
  }

  const updateDraft = (serviceId: string, patch: Partial<InstructionDraft>) => {
    setDrafts((current) => ({
      ...current,
      [serviceId]: { ...(current[serviceId] ?? emptyDraft()), ...patch },
    }))
  }

  const toggleTag = (serviceId: string, tag: string) => {
    const selectedTags = drafts[serviceId]?.selectedTags ?? []
    updateDraft(serviceId, {
      selectedTags: selectedTags.includes(tag)
        ? selectedTags.filter((item) => item !== tag)
        : [...selectedTags, tag],
    })
  }

  const value = React.useMemo<InstructionModuleValue>(() => ({
    requests: services.map((service) => ({
      category: service.category,
      ...(drafts[service.id] ?? emptyDraft()),
      coordinatorId: service.coordinatorId,
      providerId: service.providerId,
      serviceId: service.serviceId,
      serviceKey: service.id,
      serviceName: service.name,
    })),
  }), [drafts, services])

  React.useEffect(() => {
    onDraftChange?.(value)
  }, [onDraftChange, value])

  const handleSave = async () => {
    if (isSaving || !onSaveContinue) return

    setIsSaving(true)

    try {
      await onSaveContinue(value)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <PlanningScreenHeader
        brandTitle
        currentStep={4}
        label="Provider Requests"
        neumorphicNavigation
        nextAccessibilityLabel="Save provider requests and continue to payment"
        nextEnabled={services.length > 0 && !isSaving}
        onBack={onBack}
        onBrandPress={onBrandPress}
        onNext={handleSave}
        title="Provider Requests"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introSection}>
          <Text style={styles.title}>Any Special Requests?</Text>
          <Text style={styles.subtitle}>
            Let your providers know exactly what you need — this step is optional but helpful.
          </Text>
        </View>

        <View style={styles.providerList}>
          {services.map((service) => {
            const draft = drafts[service.id] ?? emptyDraft()
            const kind = instructionKind(service.category)
            const [generalLabel, generalPlaceholder] = generalRequestCopy(service.category)

            return (
              <ProviderAccordion
                key={service.id}
                expanded={expandedProviders.includes(service.id)}
                onToggle={toggleProvider}
                service={service}
              >
                {kind === 'catering' ? (
                  <>
                    <Text style={styles.tagsCaption}>COMMON DIETARY TAGS</Text>
                    <View style={styles.tagsRow}>
                      {commonTags.map((tag) => {
                        const isSelected = draft.selectedTags.includes(tag)

                        return (
                          <Pressable
                            key={tag}
                            accessibilityLabel={`${tag}${isSelected ? ', selected' : ''}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            onPress={() => toggleTag(service.id, tag)}
                            style={({ pressed }) => [
                              styles.tag,
                              isSelected && styles.tagSelected,
                              pressed && (isSelected
                                ? styles.tagSelectedPressed
                                : styles.neumorphicPressed),
                            ]}
                          >
                            <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                              {tag}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                    <RequestField
                      badge="Optional"
                      label="DIETARY RESTRICTIONS / ALLERGIES"
                      onChangeText={(dietaryRestrictions) =>
                        updateDraft(service.id, { dietaryRestrictions })
                      }
                      placeholder="e.g. 2 vegan guests, 1 peanut allergy"
                      value={draft.dietaryRestrictions}
                    />
                    <RequestField
                      badge="Optional"
                      label="SPECIAL MENU REQUESTS"
                      onChangeText={(specialMenuRequests) =>
                        updateDraft(service.id, { specialMenuRequests })
                      }
                      placeholder="Specific dishes, serving style, or late-night snacks..."
                      value={draft.specialMenuRequests}
                    />
                  </>
                ) : kind === 'venue' ? (
                  <RequestField
                    badge="Optional"
                    label="SETUP REQUIREMENTS"
                    numberOfLines={4}
                    onChangeText={(setupRequirements) =>
                      updateDraft(service.id, { setupRequirements })
                    }
                    placeholder="Layout, access time, decorations, parking, or setup requirements..."
                    value={draft.setupRequirements}
                  />
                ) : kind === 'photography' ? (
                  <RequestField
                    badge="Optional"
                    label="MUST-HAVE SHOTS"
                    numberOfLines={4}
                    onChangeText={(mustHaveShots) =>
                      updateDraft(service.id, { mustHaveShots })
                    }
                    placeholder="Important people, moments, locations, or preferred photo style..."
                    value={draft.mustHaveShots}
                  />
                ) : (
                  <RequestField
                    badge="Optional"
                    label={generalLabel}
                    numberOfLines={4}
                    onChangeText={(notes) => updateDraft(service.id, { notes })}
                    placeholder={generalPlaceholder}
                    value={draft.notes}
                  />
                )}
              </ProviderAccordion>
            )
          })}

          {services.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No selected services</Text>
              <Text style={styles.emptyText}>Go back and select a service before adding instructions.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Pressable
            accessibilityLabel="Save requests and continue"
            accessibilityRole="button"
            accessibilityState={{ busy: isSaving, disabled: isSaving }}
            disabled={isSaving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              isSaving && styles.saveDisabled,
              pressed && styles.neumorphicBurgundyPressed,
            ]}
          >
            <Text style={styles.saveText}>{isSaving ? 'Saving...' : 'Save & Continue'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

interface ProviderAccordionProps {
  children: React.ReactNode
  expanded: boolean
  onToggle: (id: string) => void
  service: InstructionModuleService
}

const ProviderAccordion: React.FC<ProviderAccordionProps> = ({
  children,
  expanded,
  onToggle,
  service,
}) => {
  return (
    <View style={styles.providerCard}>
      <Pressable
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${service.name} requests`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => onToggle(service.id)}
        style={({ pressed }) => [styles.providerHeader, pressed && styles.providerHeaderPressed]}
      >
        <View style={styles.providerIdentity}>
          {service.imageUrl ? (
            <Image
              accessibilityLabel={service.imageLabel}
              source={{ uri: service.imageUrl }}
              style={styles.providerImage}
            />
          ) : (
            <View style={[styles.providerImage, styles.providerImagePlaceholder]}>
              <Text style={styles.providerImageInitial}>{service.name.charAt(0)}</Text>
            </View>
          )}
          <View style={styles.providerCopy}>
            <Text style={styles.providerName}>{service.name}</Text>
            <Text style={styles.providerBusiness}>{service.providerName}</Text>
            <Text style={styles.providerCategory}>{service.category.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={[styles.chevron, expanded && styles.chevronExpanded]}>⌄</Text>
      </Pressable>

      {expanded ? <View style={styles.providerContent}>{children}</View> : null}
    </View>
  )
}

interface RequestFieldProps {
  badge: 'Required' | 'Optional'
  label: string
  numberOfLines?: number
  onChangeText: (value: string) => void
  placeholder: string
  value: string
}

const RequestField: React.FC<RequestFieldProps> = ({
  badge,
  label,
  numberOfLines = 2,
  onChangeText,
  placeholder,
  value,
}) => (
  <View style={styles.fieldGroup}>
    <View style={styles.fieldHeading}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldBadge, badge === 'Required' && styles.requiredBadge]}>
        <Text style={[styles.fieldBadgeText, badge === 'Required' && styles.requiredBadgeText]}>
          {badge}
        </Text>
      </View>
    </View>
    <TextInput
      accessibilityLabel={label.toLowerCase()}
      multiline
      numberOfLines={numberOfLines}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={palette.inputPlaceholder}
      style={[styles.textArea, numberOfLines >= 3 && styles.textAreaTall]}
      textAlignVertical="top"
      value={value}
    />
  </View>
)

const palette = {
  background: '#E9EDF0',
  surfaceLow: '#E9EDF0',
  surfaceDim: '#D8DEE2',
  surfaceHighest: '#E9EDF0',
  surfaceVariant: '#D8DEE2',
  surfaceLowest: '#E9EDF0',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  secondary: '#5E5E5E',
  inputPlaceholder: '#68747D',
  text: '#1A1C1C',
  textVariant: '#544244',
  white: '#FFFFFF',
  errorContainer: '#FFDAD6',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  neumorphicPressed: {
    boxShadow: 'inset 3px 3px 7px rgba(160, 171, 180, 0.54), inset -3px -3px 7px rgba(255, 255, 255, 0.96)',
    transform: [{ scale: 0.98 }],
  },
  neumorphicBurgundyPressed: {
    boxShadow: 'inset 3px 3px 7px rgba(44, 3, 15, 0.66), inset -3px -3px 7px rgba(146, 48, 72, 0.56)',
    transform: [{ scale: 0.99 }],
  },
  topAppBar: {
    zIndex: 40,
    height: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#4E061A',
    backgroundColor: '#6B1E2E',
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backIcon: { color: '#FFFFFF', fontSize: 27, lineHeight: 29 },
  brand: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headerSpacer: { width: 40, height: 40 },
  stepWrapper: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 128,
  },
  introSection: { paddingTop: 32, paddingBottom: 24 },
  title: {
    color: palette.primaryContainer,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: { color: palette.secondary, fontSize: 14, lineHeight: 22 },
  providerList: { gap: 16 },
  providerCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 18,
    backgroundColor: palette.surfaceHighest,
    boxShadow: '7px 7px 15px rgba(156, 169, 180, 0.46), -7px -7px 15px rgba(255, 255, 255, 0.96)',
  },
  providerHeader: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: palette.surfaceHighest,
    padding: 16,
  },
  providerHeaderPressed: {
    boxShadow: 'inset 4px 4px 9px rgba(160, 171, 180, 0.52), inset -4px -4px 9px rgba(255, 255, 255, 0.94)',
  },
  providerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16 },
  providerImage: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 24,
    backgroundColor: palette.surfaceDim,
    boxShadow: '3px 3px 7px rgba(156, 169, 180, 0.42), -3px -3px 7px rgba(255, 255, 255, 0.94)',
  },
  providerImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  providerImageInitial: { color: palette.primaryContainer, fontSize: 18, fontWeight: '700' },
  providerCopy: { flex: 1 },
  providerName: { color: palette.text, fontSize: 18, lineHeight: 25, fontWeight: '600' },
  providerBusiness: { color: palette.textVariant, fontSize: 12, lineHeight: 17, marginTop: 1 },
  providerCategory: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 2,
  },
  chevron: {
    color: palette.primaryContainer,
    fontSize: 21,
    lineHeight: 23,
    fontWeight: '700',
  },
  chevronExpanded: { transform: [{ rotate: '180deg' }] },
  providerContent: {
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.72)',
    backgroundColor: palette.surfaceLowest,
    padding: 16,
    boxShadow: 'inset 4px 4px 9px rgba(160, 171, 180, 0.42), inset -4px -4px 9px rgba(255, 255, 255, 0.92)',
  },
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 18,
    backgroundColor: palette.background,
    padding: 24,
    boxShadow: '6px 6px 13px rgba(156, 169, 180, 0.44), -6px -6px 13px rgba(255, 255, 255, 0.96)',
  },
  emptyTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  emptyText: { color: palette.secondary, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 4 },
  tagsCaption: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 16,
    backgroundColor: neutralSelection.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    boxShadow: neutralSelection.sunkenShadow,
  },
  tagSelected: {
    borderColor: neutralSelection.selectedEdge,
    backgroundColor: neutralSelection.selectedSurface,
    boxShadow: neutralSelection.selectedRaisedShadow,
  },
  tagText: { color: palette.textVariant, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  tagTextSelected: { color: neutralSelection.selectedText, fontWeight: '800' },
  tagSelectedPressed: {
    boxShadow: neutralSelection.sunkenShadow,
    transform: [{ scale: 0.98 }],
  },
  fieldGroup: { gap: 12 },
  fieldHeading: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 14,
    backgroundColor: palette.background,
    paddingHorizontal: 12,
    paddingVertical: 9,
    boxShadow: '4px 4px 9px rgba(156, 169, 180, 0.44), -4px -4px 9px rgba(255, 255, 255, 0.96)',
  },
  fieldLabel: {
    flex: 1,
    color: palette.textVariant,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  fieldBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 10,
    backgroundColor: palette.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    boxShadow: 'inset 2px 2px 5px rgba(160, 171, 180, 0.42), inset -2px -2px 5px rgba(255, 255, 255, 0.92)',
  },
  requiredBadge: { backgroundColor: 'rgba(255, 218, 214, 0.45)' },
  fieldBadgeText: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  requiredBadgeText: { color: palette.primaryContainer },
  textArea: {
    minHeight: 68,
    color: '#36424A',
    fontSize: 14,
    lineHeight: 21,
    borderWidth: 1,
    borderColor: 'rgba(132, 146, 156, 0.26)',
    borderRadius: 14,
    backgroundColor: '#E1E6E9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    boxShadow: 'inset 5px 5px 11px rgba(139, 151, 161, 0.58), inset -5px -5px 11px rgba(255, 255, 255, 0.96)',
  },
  textAreaTall: { minHeight: 88 },
  generalNotesSection: { marginTop: 32, marginBottom: 32 },
  generalNotesHeading: {
    color: palette.primaryContainer,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
    marginBottom: 12,
  },
  generalNotesInput: {
    minHeight: 128,
    backgroundColor: palette.surfaceLowest,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 14,
    padding: 14,
    boxShadow: 'inset 4px 4px 9px rgba(160, 171, 180, 0.52), inset -4px -4px 9px rgba(255, 255, 255, 0.94)',
  },
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    minHeight: 88,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.72)',
    backgroundColor: palette.surfaceLowest,
    paddingHorizontal: 20,
    paddingVertical: 16,
    boxShadow: '0px -5px 12px rgba(62, 75, 84, 0.18)',
  },
  footerContent: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  saveButton: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 26,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  saveText: { color: palette.white, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  saveDisabled: { opacity: 0.65 },
  pressed: { opacity: 0.55, transform: [{ scale: 0.95 }] },
})
