import React from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { PlanningStepIndicator } from '../components/PlanningStepIndicator'

export type InstructionProviderId = 'catering' | 'venue' | 'photography'

export interface InstructionModuleValue {
  catering: {
    dietaryRestrictions: string
    selectedTags: string[]
    specialMenuRequests: string
  }
  generalNotes: string
  photography: {
    mustHaveShots: string
  }
  venue: {
    setupRequirements: string
  }
}

interface InstructionModuleScreenProps {
  onBack?: () => void
  onSaveContinue?: (value: InstructionModuleValue) => void
}

const providers = {
  catering: {
    name: 'Gourmet Affairs',
    category: 'CATERING',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDFs3ndPnsu71-0oiIUAeDqiGwrzcPRqjAC3Xwx7Vo4Wq2QM9vDKcRlcpq0mtwIZguE5aO9z2TUZxFuEg9ss-wZETOp2QCGzgq2oXDphHsL5pcorkyLbG7tNfm_jnrqR3wHP6znQ3ztc4RA7EL7j0Noo-oR-bbzq3oqEvGPAA-mtWOtdj3bf5G1XX-xi9KijsZbZuH-p1IvTsvTUktxRTQMuEzK8e-xgS38VxoVxnLIXOVjPnw_cpT0iw',
    imageLabel: 'Gourmet Affairs plated wedding meal',
  },
  venue: {
    name: 'The Glasshouse',
    category: 'VENUE',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCDhQAnlYD_ipRoNaZuN3L8WdiSOkrERg_ohdzCs0WCWaDpM3ubD6ox5ImEKtuMJyf_HTE7m2j8Hc0h0ipKMYnDjMvuN5c-b8OqkgExotLpRMBShnTPyhhpFUwKpEim2e-vr4YO5na2xunN9TFUFtXNPCXSj6DHb3HnHoMQZyutf7t3V0XBDg25lONPROLA0Y_I1ABUt0J90Ky4uqRq-MVkTmQnJLiRw3RRRz8UKLTHaX1YvhY_sK8KoA',
    imageLabel: 'The Glasshouse botanical venue',
  },
  photography: {
    name: 'Lumina Studios',
    category: 'PHOTOGRAPHY',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDZpl1b7ka_8tBALSRBEPjqZNe3P25ykpXCouecxi8l30dkhfJoh3YKUJmzOXznFiNF7gJ97NHXB0dtE5VjkpqtoqejHpYhAO4vCuxbBrdgyDxzQTUyt-Igfz7XxPMIrpsyCW9W7nhl-6DD7lLrWBomHti4-HRk0H6DfFzzhGb4OIB3DBxD5RE9p9zs3YUFl4LJUV6ixWs00dhGA3gnl1MJMqtrS_pr5MSl56PlB51wpATPHUlIwtie9Q',
    imageLabel: 'Lumina Studios camera equipment',
  },
} as const

const commonTags = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Nut Allergy', 'Dairy-Free']

export const InstructionModuleScreen: React.FC<InstructionModuleScreenProps> = ({
  onBack,
  onSaveContinue,
}) => {
  const [expandedProviders, setExpandedProviders] = React.useState<InstructionProviderId[]>([
    'catering',
  ])
  const [selectedTags, setSelectedTags] = React.useState(['Vegan'])
  const [dietaryRestrictions, setDietaryRestrictions] = React.useState('')
  const [specialMenuRequests, setSpecialMenuRequests] = React.useState('')
  const [setupRequirements, setSetupRequirements] = React.useState('')
  const [mustHaveShots, setMustHaveShots] = React.useState('')
  const [generalNotes, setGeneralNotes] = React.useState('')

  const toggleProvider = (provider: InstructionProviderId) => {
    setExpandedProviders((current) =>
      current.includes(provider)
        ? current.filter((item) => item !== provider)
        : [...current, provider]
    )
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    )
  }

  const handleSave = () => {
    onSaveContinue?.({
      catering: {
        dietaryRestrictions,
        selectedTags,
        specialMenuRequests,
      },
      generalNotes,
      photography: { mustHaveShots },
      venue: { setupRequirements },
    })
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarContent}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.brand}>MULTIVENT</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <View style={styles.stepWrapper}>
        <PlanningStepIndicator currentStep={4} label="Provider Requests" />
      </View>

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
          <ProviderAccordion
            expanded={expandedProviders.includes('catering')}
            id="catering"
            onToggle={toggleProvider}
          >
            <Text style={styles.tagsCaption}>COMMON TAGS</Text>
            <View style={styles.tagsRow}>
              {commonTags.map((tag) => {
                const isSelected = selectedTags.includes(tag)

                return (
                  <Pressable
                    key={tag}
                    accessibilityLabel={`${tag}${isSelected ? ', selected' : ''}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => toggleTag(tag)}
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
              badge="Required"
              label="DIETARY RESTRICTIONS / ALLERGIES"
              onChangeText={setDietaryRestrictions}
              placeholder="e.g. 2 Vegan, 1 Peanut Allergy"
              value={dietaryRestrictions}
            />
            <RequestField
              badge="Optional"
              label="SPECIAL MENU REQUESTS"
              onChangeText={setSpecialMenuRequests}
              placeholder="Any specific dishes or late-night snacks?"
              value={specialMenuRequests}
            />
          </ProviderAccordion>

          <ProviderAccordion
            expanded={expandedProviders.includes('venue')}
            id="venue"
            onToggle={toggleProvider}
          >
            <RequestField
              badge="Optional"
              label="SETUP REQUIREMENTS"
              numberOfLines={3}
              onChangeText={setSetupRequirements}
              placeholder="e.g. Need extra space for a photobooth near the entrance."
              value={setupRequirements}
            />
          </ProviderAccordion>

          <ProviderAccordion
            expanded={expandedProviders.includes('photography')}
            id="photography"
            onToggle={toggleProvider}
          >
            <RequestField
              badge="Optional"
              label="MUST-HAVE SHOTS"
              numberOfLines={3}
              onChangeText={setMustHaveShots}
              placeholder="e.g. First look with grandparents, candid dance floor moments."
              value={mustHaveShots}
            />
          </ProviderAccordion>
        </View>

        <View style={styles.generalNotesSection}>
          <Text style={styles.generalNotesHeading}>General Notes for Your Organizer</Text>
          <TextInput
            accessibilityLabel="General notes for your organizer"
            multiline
            numberOfLines={5}
            onChangeText={setGeneralNotes}
            placeholder="e.g. program flow, family arrangements..."
            placeholderTextColor={palette.secondaryFixedDim}
            style={[styles.textArea, styles.generalNotesInput]}
            textAlignVertical="top"
            value={generalNotes}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Pressable
            accessibilityLabel="Save requests and continue"
            accessibilityRole="button"
            onPress={handleSave}
            style={({ pressed }) => [styles.saveButton, pressed && styles.savePressed]}
          >
            <Text style={styles.saveText}>Save &amp; Continue</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

interface ProviderAccordionProps {
  children: React.ReactNode
  expanded: boolean
  id: InstructionProviderId
  onToggle: (id: InstructionProviderId) => void
}

const ProviderAccordion: React.FC<ProviderAccordionProps> = ({
  children,
  expanded,
  id,
  onToggle,
}) => {
  const provider = providers[id]

  return (
    <View style={styles.providerCard}>
      <Pressable
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${provider.name} requests`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => onToggle(id)}
        style={({ pressed }) => [styles.providerHeader, pressed && styles.providerHeaderPressed]}
      >
        <View style={styles.providerIdentity}>
          <Image
            accessibilityLabel={provider.imageLabel}
            source={{ uri: provider.image }}
            style={styles.providerImage}
          />
          <View style={styles.providerCopy}>
            <Text style={styles.providerName}>{provider.name}</Text>
            <Text style={styles.providerCategory}>{provider.category}</Text>
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
    borderBottomColor: palette.surfaceVariant,
    backgroundColor: palette.surfaceLowest,
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
  backIcon: { color: palette.secondary, fontSize: 27, lineHeight: 29 },
  brand: {
    color: palette.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.4,
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
  providerCopy: { flex: 1 },
  providerName: { color: palette.text, fontSize: 18, lineHeight: 25, fontWeight: '600' },
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
  savePressed: { backgroundColor: palette.primary, transform: [{ scale: 0.985 }] },
  pressed: { opacity: 0.55, transform: [{ scale: 0.95 }] },
})
