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

export interface InstructionModuleService {
  category: string
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
  onSaveContinue?: (value: InstructionModuleValue) => Promise<void> | void
  services?: InstructionModuleService[]
}

const commonTags = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Nut Allergy', 'Dairy-Free']

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
  onBack,
  onSaveContinue,
  services = [],
}) => {
  const [expandedProviders, setExpandedProviders] = React.useState<string[]>(() =>
    services[0]?.id ? [services[0].id] : []
  )
  const [drafts, setDrafts] = React.useState<Record<string, InstructionDraft>>(() =>
    Object.fromEntries(services.map((service) => [service.id, emptyDraft()]))
  )
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    setDrafts((current) => {
      const next = { ...current }
      services.forEach((service) => {
        if (!next[service.id]) next[service.id] = emptyDraft()
      })
      return next
    })
    setExpandedProviders((current) =>
      current.length > 0 || !services[0]?.id ? current : [services[0].id]
    )
  }, [services])

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

  const handleSave = async () => {
    if (isSaving || !onSaveContinue) return

    setIsSaving(true)

    try {
      await onSaveContinue({
        requests: services.map((service) => ({
          category: service.category,
          ...(drafts[service.id] ?? emptyDraft()),
          providerId: service.providerId,
          serviceId: service.serviceId,
          serviceKey: service.id,
          serviceName: service.name,
        })),
      })
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
        currentStep={4}
        label="Provider Requests"
        nextAccessibilityLabel="Save requests and check the schedule"
        nextEnabled={services.length > 0 && !isSaving}
        onBack={onBack}
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
                              pressed && styles.tagPressed,
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
            accessibilityState={{ disabled: isSaving }}
            disabled={isSaving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              isSaving && styles.saveDisabled,
              pressed && styles.savePressed,
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
      placeholderTextColor={palette.secondaryFixedDim}
      style={[styles.textArea, numberOfLines >= 3 && styles.textAreaTall]}
      textAlignVertical="top"
      value={value}
    />
  </View>
)

const palette = {
  background: '#FFFFFF',
  surfaceLow: '#F3F3F4',
  surfaceDim: '#DADADA',
  surfaceHighest: '#E2E2E2',
  surfaceVariant: '#E2E2E2',
  surfaceLowest: '#FFFFFF',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  secondary: '#5E5E5E',
  secondaryFixedDim: '#C7C6C6',
  text: '#1A1C1C',
  textVariant: '#544244',
  white: '#FFFFFF',
  errorContainer: '#FFDAD6',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
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
    borderColor: palette.surfaceVariant,
    borderRadius: 12,
    backgroundColor: palette.surfaceHighest,
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
  providerHeaderPressed: { backgroundColor: palette.surfaceDim },
  providerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16 },
  providerImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.surfaceDim,
  },
  providerImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  providerImageInitial: { color: palette.primaryContainer, fontSize: 18, fontWeight: '700' },
  providerCopy: { flex: 1 },
  providerName: { color: palette.text, fontSize: 18, lineHeight: 25, fontWeight: '600' },
  providerBusiness: { color: palette.textVariant, fontSize: 12, lineHeight: 17, marginTop: 1 },
  providerCategory: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 15,
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
    borderTopColor: palette.surfaceVariant,
    backgroundColor: palette.surfaceLowest,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 12,
    padding: 24,
  },
  emptyTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  emptyText: { color: palette.secondary, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 4 },
  tagsCaption: {
    color: palette.secondary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    borderRadius: 16,
    backgroundColor: palette.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagSelected: { backgroundColor: palette.primaryContainer },
  tagText: { color: palette.textVariant, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  tagTextSelected: { color: palette.white },
  tagPressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  fieldGroup: { gap: 7 },
  fieldHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fieldLabel: {
    flex: 1,
    color: palette.textVariant,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  fieldBadge: {
    borderRadius: 4,
    backgroundColor: palette.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  requiredBadge: { backgroundColor: 'rgba(255, 218, 214, 0.45)' },
  fieldBadgeText: { color: palette.secondary, fontSize: 10, lineHeight: 13, fontWeight: '600' },
  requiredBadgeText: { color: palette.primaryContainer },
  textArea: {
    minHeight: 68,
    color: palette.text,
    fontSize: 14,
    lineHeight: 21,
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 8,
    backgroundColor: palette.surfaceLow,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    borderRadius: 12,
    padding: 14,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 3,
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
    borderTopColor: palette.surfaceVariant,
    backgroundColor: palette.surfaceLowest,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 8,
  },
  footerContent: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  saveButton: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  saveText: { color: palette.white, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  saveDisabled: { opacity: 0.65 },
  savePressed: { backgroundColor: palette.primary, transform: [{ scale: 0.985 }] },
  pressed: { opacity: 0.55, transform: [{ scale: 0.95 }] },
})
