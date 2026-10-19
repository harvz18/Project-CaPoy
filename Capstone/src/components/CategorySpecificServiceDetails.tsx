import React from 'react'
import {
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native'
import { Text } from './AppText'
import { MultiSelectField } from './MultiSelectField'
import {
  normalizeCategoryDetails,
  serviceCategoryKind,
  type ServiceCategoryDetails,
} from '../lib/service-category-details'

type Props = {
  categoryName: string
  errors?: string[]
  onChange: (value: ServiceCategoryDetails) => void
  value: ServiceCategoryDetails
}

type Choice = string | { label: string; value: string }
type JsonRecord = Record<string, unknown>

const presets = {
  attireTypes: ['Wedding Gown', 'Formal Dress', 'Bridesmaid Dress', 'Suit', 'Tuxedo', 'Barong', 'Entourage Attire', 'Other'],
  attireServices: ['Rental', 'Purchase', 'Custom-made'],
  intendedFor: ['Bride', 'Groom', 'Bridesmaid', 'Groomsman', 'Entourage', 'Guest', 'Other'],
  attireSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Custom Size'],
  attireInclusions: ['Veil', 'Tie', 'Bow Tie', 'Belt', 'Accessories', 'Other'],
  floralTypes: ['Bouquet', 'Boutonniere', 'Corsage', 'Ceremony Flowers', 'Reception Flowers', 'Table Centerpieces', 'Stage Flowers', 'Full Event Floral Styling', 'Other'],
  flowers: ['Roses', 'Tulips', 'Sunflowers', 'Orchids', 'Mixed Flowers', 'Seasonal Flowers', 'Other'],
  floralCoverage: ['Bridal Bouquet', 'Bridesmaids', 'Groom', 'Entourage', 'Ceremony', 'Reception', 'Tables', 'Stage', 'Other'],
  cateringTypes: ['Buffet', 'Plated', 'Packed Meals', 'Food Stations', 'Cocktail', 'Family Style', 'Other'],
  cuisines: ['Filipino', 'Western', 'Chinese', 'Japanese', 'Korean', 'Italian', 'Mixed', 'Other'],
  dietary: ['Vegetarian', 'Vegan', 'Halal', 'Gluten-Free', 'Other'],
  venueTypes: ['Function Hall', 'Ballroom', 'Hotel', 'Resort', 'Garden', 'Estate', 'Restaurant', 'Rooftop', 'Outdoor Venue', 'Other'],
  specializations: ['Wedding', 'Birthday', 'Debut', 'Corporate', 'Anniversary', 'Other'],
  coordinationTypes: ['Full Event Coordination', 'Planning & Coordination', 'Partial Coordination', 'On-the-Day Coordination'],
  soundTypes: ['Sound System', 'Lighting', 'Sound + Lights', 'Stage Setup', 'LED Wall', 'Full Technical Package', 'Other'],
  microphoneTypes: ['Wired', 'Wireless', 'Lapel', 'Other'],
  lightingTypes: ['Stage Lighting', 'Moving Heads', 'Spotlights', 'Ambient Lighting', 'Uplighting', 'Other'],
  photoCoverage: ['Ceremony', 'Reception', 'Full Event', 'Pre-event', 'Pre-event + Event'],
  eventTypes: ['Wedding', 'Birthday', 'Debut', 'Corporate', 'Anniversary', 'Other'],
  hostEventTypes: ['Wedding', 'Birthday', 'Debut', 'Corporate', 'Anniversary', 'Seminar', 'Other'],
  hostingStyles: ['Formal', 'Casual', 'Energetic', 'Corporate', 'Interactive', 'Other'],
  languages: ['English', 'Filipino / Tagalog', 'Hiligaynon', 'Other'],
  hostEquipment: ['Microphone', 'Laptop', 'Presentation Clicker', 'Other'],
}

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
const asList = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string')
  : []
const textValue = (value: unknown) => typeof value === 'string' ? value : ''
const numberValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
  ? String(value)
  : typeof value === 'string' ? value : ''
const parseNumber = (value: string) => value.trim() === '' ? undefined : Number(value.replace(/[^\d.]/g, ''))
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const Section = ({ children, title, description }: React.PropsWithChildren<{ title: string; description?: string }>) => (
  <View style={styles.section}>
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    </View>
    {children}
  </View>
)

const Field = ({ children, label, helper }: React.PropsWithChildren<{ label: string; helper?: string }>) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    {children}
  </View>
)

const ChoiceField = ({ label, multiple = false, onChange, options, value }: {
  label: string
  multiple?: boolean
  onChange: (value: string | string[]) => void
  options: Choice[]
  value: string | string[]
}) => {
  const selected = Array.isArray(value) ? value : value ? [value] : []
  const normalizedOptions = options.map((raw) => typeof raw === 'string'
    ? { label: raw, value: raw }
    : raw)

  if (multiple) {
    return (
      <MultiSelectField
        label={label}
        onApply={onChange}
        options={normalizedOptions}
        selectedValues={selected}
      />
    )
  }

  return (
    <Field label={label}>
      <View style={styles.chips}>
        {normalizedOptions.map((option) => {
          const active = selected.includes(option.value)
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </Field>
  )
}

const TextField = ({ label, multiline = false, onChange, placeholder, value }: {
  label: string
  multiline?: boolean
  onChange: (value: string) => void
  placeholder?: string
  value: unknown
}) => (
  <Field label={label}>
    <TextInput
      multiline={multiline}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={palette.placeholder}
      style={[styles.input, multiline && styles.textArea]}
      textAlignVertical={multiline ? 'top' : 'center'}
      value={textValue(value)}
    />
  </Field>
)

const NumberField = ({ label, min = 0, onChange, suffix, value }: {
  label: string
  min?: number
  onChange: (value?: number) => void
  suffix?: string
  value: unknown
}) => (
  <Field label={label}>
    <View style={styles.inlineInput}>
      <TextInput
        inputMode="decimal"
        keyboardType="decimal-pad"
        onChangeText={(next) => {
          const parsed = parseNumber(next)
          onChange(parsed === undefined ? undefined : Math.max(min, parsed))
        }}
        placeholder="0"
        placeholderTextColor={palette.placeholder}
        style={[styles.input, styles.flexInput]}
        value={numberValue(value)}
      />
      {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
    </View>
  </Field>
)

const ToggleField = ({ label, onChange, value }: { label: string; onChange: (value: boolean) => void; value: unknown }) => (
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <Switch
      accessibilityLabel={label}
      onValueChange={onChange}
      thumbColor="#FFFFFF"
      trackColor={{ false: '#C9C7C8', true: palette.primary }}
      value={value === true}
    />
  </View>
)

const DurationField = ({ amount, amountLabel, onAmountChange, onUnitChange, unit, units }: {
  amount: unknown
  amountLabel: string
  onAmountChange: (value?: number) => void
  onUnitChange: (value: string) => void
  unit: unknown
  units: string[]
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{amountLabel}</Text>
    <View style={styles.durationRow}>
      <TextInput
        inputMode="decimal"
        keyboardType="decimal-pad"
        onChangeText={(next) => onAmountChange(parseNumber(next))}
        placeholder="0"
        placeholderTextColor={palette.placeholder}
        style={[styles.input, styles.durationAmount]}
        value={numberValue(amount)}
      />
      <View style={styles.durationUnits}>
        {units.map((option) => {
          const active = textValue(unit) === option
          return <Pressable key={option} onPress={() => onUnitChange(option)} style={[styles.unitButton, active && styles.unitButtonActive]}><Text style={[styles.unitText, active && styles.unitTextActive]}>{option}</Text></Pressable>
        })}
      </View>
    </View>
  </View>
)

const TagField = ({ label, onChange, options = [], value }: {
  label: string
  onChange: (value: string[]) => void
  options?: string[]
  value: unknown
}) => {
  const selected = asList(value)
  const customSelected = selected.filter((item) => !options.includes(item))
  const [draft, setDraft] = React.useState('')
  const add = () => {
    const item = draft.trim()
    if (item && !selected.some((entry) => entry.toLowerCase() === item.toLowerCase())) onChange([...selected, item])
    setDraft('')
  }
  return (
    <View style={styles.field}>
      {options.length ? (
        <MultiSelectField
          label={label}
          onApply={onChange}
          options={options.map((option) => ({ label: option, value: option }))}
          selectedValues={selected}
        />
      ) : <Text style={styles.label}>{label}</Text>}
      <View style={styles.tagInputRow}>
        <TextInput
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder="Add a custom value"
          placeholderTextColor={palette.placeholder}
          returnKeyType="done"
          style={[styles.input, styles.flexInput]}
          value={draft}
        />
        <Pressable onPress={add} style={styles.smallButton}><Text style={styles.smallButtonText}>Add</Text></Pressable>
      </View>
      {customSelected.length ? <View style={styles.selectedTags}>{customSelected.map((item) => <Pressable accessibilityLabel={`Remove ${item}`} key={item} onPress={() => onChange(selected.filter((value) => value !== item))} style={styles.selectedTag}><Text style={styles.selectedTagText}>{item}  ×</Text></Pressable>)}</View> : null}
    </View>
  )
}

const MenuBuilder = ({ onChange, value }: { onChange: (value: JsonRecord[]) => void; value: unknown }) => {
  const sections = Array.isArray(value) ? value.map(asRecord) : []
  const update = (index: number, patch: JsonRecord) => onChange(sections.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  return (
    <Section title="Menu" description="Create only the sections you offer.">
      {sections.map((section, index) => (
        <View key={textValue(section.id) || index} style={styles.repeatCard}>
          <TextField label="Section name" onChange={(name) => update(index, { name })} placeholder="e.g., Main Course" value={section.name} />
          <TagField label="Menu items" onChange={(items) => update(index, { items })} value={section.items} />
          <Pressable onPress={() => onChange(sections.filter((_, itemIndex) => itemIndex !== index))} style={styles.removeButton}><Text style={styles.removeText}>Remove section</Text></Pressable>
        </View>
      ))}
      <Pressable onPress={() => onChange([...sections, { id: newId('menu'), name: '', items: [] }])} style={styles.addButton}><Text style={styles.addButtonText}>+ Add menu section</Text></Pressable>
    </Section>
  )
}

const CustomCateringMenuBuilder = ({ details, set }: {
  details: ServiceCategoryDetails
  set: (key: string, value: unknown) => void
}) => {
  const sections = Array.isArray(details.customMenuSections)
    ? details.customMenuSections.map(asRecord)
    : []
  const updateSection = (index: number, patch: JsonRecord) => set(
    'customMenuSections',
    sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section)
  )
  const updateItem = (sectionIndex: number, itemIndex: number, patch: JsonRecord) => {
    const items = Array.isArray(sections[sectionIndex]?.items)
      ? sections[sectionIndex].items.map(asRecord)
      : []
    updateSection(sectionIndex, {
      items: items.map((item, index) => index === itemIndex ? { ...item, ...patch } : item),
    })
  }

  return (
    <Section
      title="Custom item-priced menu"
      description="Each selected food item is charged per guest. Required items are always included; inactive items remain in history but cannot be selected."
    >
      <View style={styles.twoColumns}>
        <NumberField label="Minimum Guests" min={1} onChange={(minimumGuests) => set('minimumGuests', minimumGuests)} value={details.minimumGuests} />
        <NumberField label="Maximum Guests" min={1} onChange={(maximumGuests) => set('maximumGuests', maximumGuests)} value={details.maximumGuests} />
      </View>
      {sections.map((section, sectionIndex) => {
        const items = Array.isArray(section.items) ? section.items.map(asRecord) : []
        return (
          <View key={textValue(section.id) || sectionIndex} style={styles.repeatCard}>
            <TextField label="Menu section" onChange={(name) => updateSection(sectionIndex, { name })} placeholder="e.g., Main course" value={section.name} />
            <View style={styles.twoColumns}>
              <NumberField label="Minimum selections" min={0} onChange={(minimumSelections) => updateSection(sectionIndex, { minimumSelections })} value={section.minimumSelections} />
              <NumberField label="Maximum selections (optional)" min={0} onChange={(maximumSelections) => updateSection(sectionIndex, { maximumSelections })} value={section.maximumSelections} />
            </View>
            {items.map((item, itemIndex) => (
              <View key={textValue(item.id) || itemIndex} style={styles.menuItemCard}>
                <TextField label="Food item" onChange={(name) => updateItem(sectionIndex, itemIndex, { name })} placeholder="e.g., Chicken Cordon Bleu" value={item.name} />
                <TextField label="Description (optional)" onChange={(description) => updateItem(sectionIndex, itemIndex, { description })} placeholder="Short description" value={item.description} />
                <NumberField label="Price per head" min={1} onChange={(pricePerHead) => updateItem(sectionIndex, itemIndex, { pricePerHead })} suffix="PHP / guest" value={item.pricePerHead} />
                <ToggleField label="Available to clients" onChange={(isActive) => updateItem(sectionIndex, itemIndex, { isActive })} value={item.isActive !== false} />
                <ToggleField label="Included by default" onChange={(isDefault) => updateItem(sectionIndex, itemIndex, { isDefault })} value={item.isDefault === true} />
                <ToggleField label="Required inclusion" onChange={(isRequired) => updateItem(sectionIndex, itemIndex, { isRequired, isDefault: isRequired ? true : item.isDefault })} value={item.isRequired === true} />
                <Pressable onPress={() => updateSection(sectionIndex, { items: items.filter((_, index) => index !== itemIndex) })} style={styles.removeButton}>
                  <Text style={styles.removeText}>Remove food item</Text>
                </Pressable>
              </View>
            ))}
            <Pressable onPress={() => updateSection(sectionIndex, { items: [...items, { id: newId('food'), name: '', description: '', pricePerHead: undefined, isActive: true, isDefault: false, isRequired: false }] })} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add food item</Text>
            </Pressable>
            <Pressable onPress={() => set('customMenuSections', sections.filter((_, index) => index !== sectionIndex))} style={styles.removeButton}>
              <Text style={styles.removeText}>Remove menu section</Text>
            </Pressable>
          </View>
        )
      })}
      <Pressable onPress={() => set('customMenuSections', [...sections, { id: newId('custom-menu'), name: '', minimumSelections: 0, maximumSelections: undefined, items: [] }])} style={styles.addButton}>
        <Text style={styles.addButtonText}>+ Add menu section</Text>
      </Pressable>
    </Section>
  )
}

const CateringTastingSettingsBuilder = ({ details, set }: {
  details: ServiceCategoryDetails
  set: (key: string, value: unknown) => void
}) => {
  const settings = asRecord(details.tastingSettings)
  const update = (patch: JsonRecord) => set('tastingSettings', { ...settings, ...patch })
  const enabled = settings.enabled === true

  return (
    <Section
      title="Optional food tasting"
      description="Food tastings become available only after you accept a catering booking. Slots are checked against your availability calendar and operating hours."
    >
      <ToggleField
        label="Offer optional food tastings"
        onChange={(next) => update({ enabled: next })}
        value={enabled}
      />
      {enabled ? (
        <>
          <TextField
            label="Tasting location"
            onChange={(location) => update({ location })}
            placeholder="e.g., Main tasting room, Bacolod City"
            value={settings.location}
          />
          <TagField
            label="Available tasting start times"
            onChange={(tastingTimeSlots) => update({ tastingTimeSlots })}
            options={[]}
            value={settings.tastingTimeSlots}
          />
          <Text style={styles.integrationNote}>
            Enter times in 24-hour HH:MM format, for example 10:00 or 14:00. We only show slots that also fit your availability calendar and operating hours.
          </Text>
          <View style={styles.twoColumns}>
            <NumberField
              label="Duration"
              min={15}
              onChange={(durationMinutes) => update({ durationMinutes })}
              suffix="minutes"
              value={settings.durationMinutes ?? 60}
            />
            <NumberField
              label="Minimum lead time"
              min={0}
              onChange={(minimumLeadDays) => update({ minimumLeadDays })}
              suffix="days"
              value={settings.minimumLeadDays ?? 1}
            />
          </View>
          <NumberField
            label="Latest booking window before the event"
            min={0}
            onChange={(latestDaysBeforeEvent) => update({ latestDaysBeforeEvent })}
            suffix="days before event (0 = any time before)"
            value={settings.latestDaysBeforeEvent ?? 0}
          />
        </>
      ) : null}
    </Section>
  )
}

const CateringOptionsBuilder = ({ details, set }: {
  details: ServiceCategoryDetails
  set: (key: string, value: unknown) => void
}) => {
  const configured = Array.isArray(details.pricingOptions)
    ? details.pricingOptions.map(asRecord)
    : []
  const legacyMenus = Array.isArray(details.menuSections) ? details.menuSections.map(asRecord) : []
  const options = configured.length > 0 ? configured : []
  const update = (index: number, patch: JsonRecord) => set(
    'pricingOptions',
    options.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
  )

  return (
    <>
      <CustomCateringMenuBuilder details={details} set={set} />
      <CateringTastingSettingsBuilder details={details} set={set} />
    <Section
      title="Fixed menu options"
      description="Configure preset packages alongside an item-priced custom menu. If both are configured, clients choose their preferred offering."
    >
      {options.map((option, index) => (
        <View key={textValue(option.id) || index} style={styles.repeatCard}>
          <TextField
            label="Option name"
            onChange={(name) => update(index, { name })}
            placeholder="e.g., Fine Dining Menu"
            value={option.name}
          />
          <NumberField
            label="Price per head"
            min={1}
            onChange={(pricePerHead) => update(index, { pricePerHead })}
            suffix="PHP / guest"
            value={option.pricePerHead}
          />
          <View style={styles.twoColumns}>
            <NumberField label="Minimum Guests" min={1} onChange={(minimumGuests) => update(index, { minimumGuests })} value={option.minimumGuests} />
            <NumberField label="Maximum Guests" min={1} onChange={(maximumGuests) => update(index, { maximumGuests })} value={option.maximumGuests} />
          </View>
          <MenuBuilder onChange={(menuSections) => update(index, { menuSections })} value={option.menuSections} />
          <Pressable
            onPress={() => set('pricingOptions', options.filter((_, itemIndex) => itemIndex !== index))}
            style={styles.removeButton}
          >
            <Text style={styles.removeText}>Remove catering option</Text>
          </Pressable>
        </View>
      ))}
      {options.length === 0 && legacyMenus.length > 0 ? (
        <Text style={styles.integrationNote}>
          This legacy listing has one shared menu. Add an option below to assign its per-head price and guest range.
        </Text>
      ) : null}
      <Pressable
        onPress={() => set('pricingOptions', [...options, {
          id: newId('catering-option'),
          maximumGuests: details.maximumGuests,
          menuSections: options.length === 0 ? legacyMenus : [],
          minimumGuests: details.minimumGuests,
          name: '',
          pricePerHead: undefined,
        }])}
        style={styles.addButton}
      >
        <Text style={styles.addButtonText}>+ Add catering option</Text>
      </Pressable>
    </Section>
    </>
  )
}

const VenueOptionFields = ({ option, optionChoices, onChange, supportsCombination }: {
  option: JsonRecord
  optionChoices: Choice[]
  onChange: (patch: JsonRecord) => void
  supportsCombination?: boolean
}) => {
  const optionId = textValue(option.id)
  const otherOptions = optionChoices.filter((choice) => {
    const value = typeof choice === 'string' ? choice : choice.value
    return value !== optionId
  })

  return (
    <View style={styles.optionDetails}>
      <TextField label="Description (optional)" multiline onChange={(description) => onChange({ description })} placeholder="What makes this space suitable for an event?" value={option.description} />
      <TagField label="Option photo URLs (optional)" onChange={(photoUrls) => onChange({ photoUrls })} value={option.photoUrls} />
      <View style={styles.twoColumns}>
        <ChoiceField label="Price Type" onChange={(pricingUnit) => onChange({ pricingUnit })} options={[
          { label: 'Per event', value: 'event' },
          { label: 'Per hour', value: 'hour' },
        ]} value={textValue(option.pricingUnit) || 'event'} />
        <NumberField label="Base Rate" min={1} onChange={(baseRate) => onChange({ baseRate })} suffix="PHP" value={option.baseRate} />
      </View>
      <Text style={styles.integrationNote}>This option&apos;s price is saved independently. The existing listing price remains in place for legacy bookings until the client-facing venue-pricing phase.</Text>
      <View style={styles.optionToggles}>
        <ToggleField label="Active and visible to clients" onChange={(isActive) => onChange({ isActive })} value={option.isActive !== false} />
        <ToggleField label="Can be booked on its own" onChange={(isBookableIndividually) => onChange({ isBookableIndividually })} value={option.isBookableIndividually !== false} />
        {supportsCombination ? <ToggleField label="Can be included in combinations" onChange={(allowsCombination) => onChange({ allowsCombination })} value={option.allowsCombination !== false} /> : null}
      </View>
      <View style={styles.twoColumns}>
        <NumberField label="Minimum rental duration (optional)" min={0} onChange={(minimumBookingHours) => onChange({ minimumBookingHours })} suffix="hours" value={option.minimumBookingHours} />
        <NumberField label="Maximum rental duration (optional)" min={0} onChange={(maximumBookingHours) => onChange({ maximumBookingHours })} suffix="hours" value={option.maximumBookingHours} />
      </View>
      <View style={styles.twoColumns}>
        <NumberField label="Included duration (optional)" min={0} onChange={(includedDurationHours) => onChange({ includedDurationHours })} suffix="hours" value={option.includedDurationHours} />
        <NumberField label="Setup allowance (optional)" min={0} onChange={(setupAllowanceHours) => onChange({ setupAllowanceHours })} suffix="hours" value={option.setupAllowanceHours} />
      </View>
      <NumberField label="Cleanup allowance (optional)" min={0} onChange={(cleanupAllowanceHours) => onChange({ cleanupAllowanceHours })} suffix="hours" value={option.cleanupAllowanceHours} />
      <View style={styles.twoColumns}>
        <TextField label="Access starts (optional)" onChange={(accessStartTime) => onChange({ accessStartTime })} placeholder="08:00" value={option.accessStartTime} />
        <TextField label="Access ends (optional)" onChange={(accessEndTime) => onChange({ accessEndTime })} placeholder="22:00" value={option.accessEndTime} />
      </View>
      <TextField label="Overtime policy (optional)" multiline onChange={(overtimePolicy) => onChange({ overtimePolicy })} placeholder="e.g., PHP 2,000 for each additional hour" value={option.overtimePolicy} />
      <TextField label="Availability notes (optional)" multiline onChange={(availabilityNotes) => onChange({ availabilityNotes })} placeholder="Use the Availability screen for calendar dates; add any option-specific notes here." value={option.availabilityNotes} />
      <TagField label="Amenities" onChange={(amenities) => onChange({ amenities })} value={option.amenities} />
      <TagField label="Inclusions" onChange={(inclusions) => onChange({ inclusions })} value={option.inclusions} />
      <TagField label="Restrictions" onChange={(restrictions) => onChange({ restrictions })} value={option.restrictions} />
      <ChoiceField label="Requires these options" multiple onChange={(requiredOptionIds) => onChange({ requiredOptionIds })} options={otherOptions} value={asList(option.requiredOptionIds)} />
      <ChoiceField label="Mutually exclusive with" multiple onChange={(mutuallyExclusiveOptionIds) => onChange({ mutuallyExclusiveOptionIds })} options={otherOptions} value={asList(option.mutuallyExclusiveOptionIds)} />
    </View>
  )
}

const VenueSpaces = ({ details, onChange }: {
  details: ServiceCategoryDetails
  onChange: (value: ServiceCategoryDetails) => void
}) => {
  const spaces = Array.isArray(details.spaces) ? details.spaces.map(asRecord) : []
  const combinations = Array.isArray(details.combinations) ? details.combinations.map(asRecord) : []
  const [expandedOptions, setExpandedOptions] = React.useState<Set<string>>(new Set())
  const commit = (patch: JsonRecord) => onChange({ ...details, ...patch })
  const updateSpace = (index: number, patch: JsonRecord) => commit({
    spaces: spaces.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
  })
  const updateCombination = (index: number, patch: JsonRecord) => commit({
    combinations: combinations.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
  })
  const toggleExpanded = (id: string) => setExpandedOptions((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const optionChoices = [...spaces, ...combinations]
    .filter((option) => textValue(option.id))
    .map((option) => ({ label: textValue(option.name) || 'Unnamed venue option', value: textValue(option.id) }))
  const removeOptionReferences = (options: JsonRecord[], removedId: string) => options.map((option) => ({
    ...option,
    mutuallyExclusiveOptionIds: asList(option.mutuallyExclusiveOptionIds).filter((id) => id !== removedId),
    requiredOptionIds: asList(option.requiredOptionIds).filter((id) => id !== removedId),
  }))
  const removeSpace = (index: number) => {
    const removedId = textValue(spaces[index]?.id)
    commit({
      combinations: removeOptionReferences(combinations.map((item) => ({
        ...item,
        spaceIds: asList(item.spaceIds).filter((id) => id !== removedId),
      })), removedId),
      spaces: removeOptionReferences(spaces.filter((_, itemIndex) => itemIndex !== index), removedId),
    })
  }
  const removeCombination = (index: number) => {
    const removedId = textValue(combinations[index]?.id)
    commit({
      combinations: removeOptionReferences(combinations.filter((_, itemIndex) => itemIndex !== index), removedId),
      spaces: removeOptionReferences(spaces, removedId),
    })
  }
  return (
    <>
      <Section title="Venue rental options" description="Manage each room, hall, or space with its own price and availability. Existing listings without option pricing keep their current single-price behavior.">
        {spaces.map((space, index) => {
          const optionId = textValue(space.id) || `space-${index}`
          const expanded = expandedOptions.has(optionId)
          return (
            <View key={optionId} style={styles.repeatCard}>
              <Pressable accessibilityRole="button" onPress={() => toggleExpanded(optionId)} style={styles.repeatCardHeader}>
                <View style={styles.repeatCardTitleBlock}>
                  <Text style={styles.repeatCardTitle}>{textValue(space.name) || `Space ${index + 1}`}</Text>
                  <Text style={styles.repeatCardMeta}>{space.isActive === false ? 'Inactive' : 'Active'} · {textValue(space.pricingUnit) === 'hour' ? 'Hourly' : 'Per event'} {numberValue(space.baseRate) ? `· PHP ${numberValue(space.baseRate)}` : '· Rate not set'}</Text>
                </View>
                <Text style={styles.expandIndicator}>{expanded ? 'Hide' : 'Configure'}</Text>
              </Pressable>
              {expanded ? <>
                <TextField label="Space / Hall Name" onChange={(name) => updateSpace(index, { name })} placeholder="Function Hall 1" value={space.name} />
                <View style={styles.twoColumns}>
                  <NumberField label="Area" onChange={(areaSqm) => updateSpace(index, { areaSqm })} suffix="sqm" value={space.areaSqm} />
                  <NumberField label="Guest Capacity" onChange={(capacity) => updateSpace(index, { capacity })} suffix="guests" value={space.capacity} />
                </View>
                <ChoiceField label="Space Type" onChange={(spaceType) => updateSpace(index, { spaceType })} options={['Indoor', 'Outdoor']} value={textValue(space.spaceType) || 'Indoor'} />
                <VenueOptionFields onChange={(patch) => updateSpace(index, patch)} option={space} optionChoices={optionChoices} supportsCombination />
                <Pressable onPress={() => removeSpace(index)} style={styles.removeButton}><Text style={styles.removeText}>Remove space</Text></Pressable>
              </> : null}
            </View>
          )
        })}
        <Pressable onPress={() => commit({ spaces: [...spaces, {
          allowsCombination: true,
          amenities: [],
          areaSqm: undefined,
          baseRate: undefined,
          capacity: undefined,
          id: newId('space'),
          inclusions: [],
          isActive: true,
          isBookableIndividually: true,
          mutuallyExclusiveOptionIds: [],
          name: '',
          photoUrls: [],
          pricingUnit: 'event',
          requiredOptionIds: [],
          restrictions: [],
          spaceType: 'Indoor',
        }] })} style={styles.addButton}><Text style={styles.addButtonText}>+ Add venue rental option</Text></Pressable>
      </Section>
      <Section title="Venue combinations" description="Combine two or more compatible spaces into a separately priced rental option.">
        {combinations.map((combination, index) => {
          const selectedIds = asList(combination.spaceIds)
          const optionId = textValue(combination.id) || `combination-${index}`
          const expanded = expandedOptions.has(optionId)
          return (
            <View key={optionId} style={styles.repeatCard}>
              <Pressable accessibilityRole="button" onPress={() => toggleExpanded(optionId)} style={styles.repeatCardHeader}>
                <View style={styles.repeatCardTitleBlock}>
                  <Text style={styles.repeatCardTitle}>{textValue(combination.name) || `Combination ${index + 1}`}</Text>
                  <Text style={styles.repeatCardMeta}>{combination.isActive === false ? 'Inactive' : 'Active'} · {selectedIds.length} spaces · {textValue(combination.pricingUnit) === 'hour' ? 'Hourly' : 'Per event'} {numberValue(combination.baseRate) ? `· PHP ${numberValue(combination.baseRate)}` : '· Rate not set'}</Text>
                </View>
                <Text style={styles.expandIndicator}>{expanded ? 'Hide' : 'Configure'}</Text>
              </Pressable>
              {expanded ? <>
                <TextField label="Combination Name" onChange={(name) => updateCombination(index, { name })} placeholder="Grand Hall" value={combination.name} />
                <ChoiceField
                  label="Connected Spaces"
                  multiple
                  onChange={(spaceIds) => updateCombination(index, { spaceIds })}
                  options={spaces.filter((space) => space.allowsCombination !== false).map((space) => ({ label: textValue(space.name) || 'Unnamed space', value: textValue(space.id) }))}
                  value={selectedIds}
                />
                <View style={styles.twoColumns}>
                  <NumberField label="Combined Capacity" onChange={(combinedCapacity) => updateCombination(index, { combinedCapacity })} suffix="guests" value={combination.combinedCapacity} />
                  <NumberField label="Combined Area" onChange={(combinedAreaSqm) => updateCombination(index, { combinedAreaSqm })} suffix="sqm" value={combination.combinedAreaSqm} />
                </View>
                <VenueOptionFields onChange={(patch) => updateCombination(index, patch)} option={combination} optionChoices={optionChoices} />
                <Pressable onPress={() => removeCombination(index)} style={styles.removeButton}><Text style={styles.removeText}>Remove combination</Text></Pressable>
              </> : null}
            </View>
          )
        })}
        <Pressable disabled={spaces.filter((space) => space.allowsCombination !== false).length < 2} onPress={() => commit({ combinations: [...combinations, {
          amenities: [],
          baseRate: undefined,
          id: newId('combination'),
          inclusions: [],
          isActive: true,
          isBookableIndividually: true,
          mutuallyExclusiveOptionIds: [],
          name: '',
          photoUrls: [],
          pricingUnit: 'event',
          requiredOptionIds: [],
          restrictions: [],
          spaceIds: [],
        }] })} style={[styles.addButton, spaces.filter((space) => space.allowsCombination !== false).length < 2 && styles.disabled]}><Text style={styles.addButtonText}>+ Add combination</Text></Pressable>
      </Section>
    </>
  )
}

export const CategorySpecificServiceDetails: React.FC<Props> = ({ categoryName, errors = [], onChange, value }) => {
  const details = normalizeCategoryDetails(categoryName, value)
  const kind = serviceCategoryKind(categoryName)
  const set = (key: string, next: unknown) => onChange({ ...details, [key]: next })

  return (
    <View style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{categoryName} Details</Text>
        <Text style={styles.subtitle}>Add structured details clients can use when comparing and booking this service.</Text>
      </View>
      {errors.length ? <View accessibilityRole="alert" style={styles.errorCard}>{errors.map((error) => <Text key={error} style={styles.errorText}>• {error}</Text>)}</View> : null}

      {kind === 'attire' ? <>
        <Section title="Offering">
          <ChoiceField label="Attire Type" onChange={(next) => set('attireType', next)} options={presets.attireTypes} value={textValue(details.attireType)} />
          {details.attireType === 'Other' ? <TextField label="Custom Attire Type" onChange={(next) => set('attireTypeOther', next)} value={details.attireTypeOther} /> : null}
          <ChoiceField label="Service Option" multiple onChange={(next) => set('serviceOptions', next)} options={presets.attireServices} value={asList(details.serviceOptions)} />
          <ChoiceField label="Intended For" multiple onChange={(next) => set('intendedFor', next)} options={presets.intendedFor} value={asList(details.intendedFor)} />
          {asList(details.intendedFor).includes('Other') ? <TextField label="Other Intended User" onChange={(next) => set('intendedForOther', next)} value={details.intendedForOther} /> : null}
          <TagField label="Available Sizes" onChange={(next) => set('availableSizes', next)} options={presets.attireSizes} value={details.availableSizes} />
          <TagField label="Available Colors" onChange={(next) => set('availableColors', next)} value={details.availableColors} />
          <NumberField label="Quantity Available" onChange={(next) => set('quantityAvailable', next)} value={details.quantityAvailable} />
          {asList(details.serviceOptions).includes('Rental') ? <DurationField amount={details.rentalDuration} amountLabel="Rental Duration" onAmountChange={(next) => set('rentalDuration', next)} onUnitChange={(next) => set('rentalDurationUnit', next)} unit={details.rentalDurationUnit || 'days'} units={['hours', 'days']} /> : null}
        </Section>
        <Section title="Preparation & Inclusions">
          <ToggleField label="Fitting Required" onChange={(next) => set('fittingRequired', next)} value={details.fittingRequired} />
          {details.fittingRequired === true ? <TextField label="Fitting Location" onChange={(next) => set('fittingLocation', next)} value={details.fittingLocation} /> : null}
          <DurationField amount={details.leadTime} amountLabel="Lead Time" onAmountChange={(next) => set('leadTime', next)} onUnitChange={(next) => set('leadTimeUnit', next)} unit={details.leadTimeUnit || 'weeks'} units={['days', 'weeks']} />
          <TagField label="Inclusions" onChange={(next) => set('inclusions', next)} options={presets.attireInclusions} value={details.inclusions} />
        </Section>
      </> : null}

      {kind === 'florists' ? <>
        <Section title="Floral Offering">
          <ChoiceField label="Floral Service Type" multiple onChange={(next) => set('serviceTypes', next)} options={presets.floralTypes} value={asList(details.serviceTypes)} />
          {asList(details.serviceTypes).includes('Other') ? <TextField label="Other Floral Service" onChange={(next) => set('serviceTypeOther', next)} value={details.serviceTypeOther} /> : null}
          <TagField label="Flower Options" onChange={(next) => set('flowerOptions', next)} options={presets.flowers} value={details.flowerOptions} />
          <TagField label="Color / Theme Options" onChange={(next) => set('themeOptions', next)} value={details.themeOptions} />
          <ChoiceField label="Coverage" multiple onChange={(next) => set('coverage', next)} options={presets.floralCoverage} value={asList(details.coverage)} />
        </Section>
        <Section title="Fulfillment">
          <ToggleField label="Customization Available" onChange={(next) => set('customizationAvailable', next)} value={details.customizationAvailable} />
          <ToggleField label="Setup Included" onChange={(next) => set('setupIncluded', next)} value={details.setupIncluded} />
          <ToggleField label="Delivery Included" onChange={(next) => set('deliveryIncluded', next)} value={details.deliveryIncluded} />
          {details.deliveryIncluded === true ? <TextField label="Delivery / Service Area" onChange={(next) => set('deliveryArea', next)} value={details.deliveryArea} /> : null}
          <DurationField amount={details.leadTime} amountLabel="Lead Time" onAmountChange={(next) => set('leadTime', next)} onUnitChange={(next) => set('leadTimeUnit', next)} unit={details.leadTimeUnit || 'days'} units={['days', 'weeks']} />
        </Section>
      </> : null}

      {kind === 'catering' ? <>
        <Section title="Catering Offering">
          <ChoiceField label="Catering Type" multiple onChange={(next) => set('cateringTypes', next)} options={presets.cateringTypes} value={asList(details.cateringTypes)} />
          {asList(details.cateringTypes).includes('Other') ? <TextField label="Other Catering Type" onChange={(next) => set('cateringTypeOther', next)} value={details.cateringTypeOther} /> : null}
          <TagField label="Cuisine" onChange={(next) => set('cuisines', next)} options={presets.cuisines} value={details.cuisines} />
          <Text style={styles.integrationNote}>Catering is priced per head using the event&apos;s Expected / Anticipated Guests.</Text>
        </Section>
        <CateringOptionsBuilder details={details} set={set} />
        <Section title="Service Inclusions">
          <ChoiceField label="Dietary Options" multiple onChange={(next) => set('dietaryOptions', next)} options={presets.dietary} value={asList(details.dietaryOptions)} />
          <ToggleField label="Drinks Included" onChange={(next) => set('drinksIncluded', next)} value={details.drinksIncluded} />
          <ToggleField label="Serving Staff Included" onChange={(next) => set('servingStaffIncluded', next)} value={details.servingStaffIncluded} />
          <ToggleField label="Tables / Chairs Included" onChange={(next) => set('tablesChairsIncluded', next)} value={details.tablesChairsIncluded} />
          <ToggleField label="Tableware Included" onChange={(next) => set('tablewareIncluded', next)} value={details.tablewareIncluded} />
          <ToggleField label="Setup / Cleanup Included" onChange={(next) => set('setupCleanupIncluded', next)} value={details.setupCleanupIncluded} />
          <TextField label="Service Area" onChange={(next) => set('serviceArea', next)} value={details.serviceArea} />
          <DurationField amount={details.preparationLeadTime} amountLabel="Preparation Lead Time" onAmountChange={(next) => set('preparationLeadTime', next)} onUnitChange={(next) => set('preparationLeadTimeUnit', next)} unit={details.preparationLeadTimeUnit || 'days'} units={['hours', 'days']} />
        </Section>
      </> : null}

      {kind === 'venues' ? <>
        <Section title="Venue">
          <ChoiceField label="Venue Type" onChange={(next) => set('venueType', next)} options={presets.venueTypes} value={textValue(details.venueType)} />
          {details.venueType === 'Other' ? <TextField label="Custom Venue Type" onChange={(next) => set('venueTypeOther', next)} value={details.venueTypeOther} /> : null}
          <TextField label="Complete Address" onChange={(next) => set('address', next)} placeholder="Search or enter the venue address" value={details.address} />
          <View style={styles.twoColumns}>
            <NumberField label="Latitude (optional)" min={-90} onChange={(next) => set('latitude', next)} value={details.latitude} />
            <NumberField label="Longitude (optional)" min={-180} onChange={(next) => set('longitude', next)} value={details.longitude} />
          </View>
        </Section>
        <VenueSpaces details={details} onChange={onChange} />
        <Section title="Amenities">
          {['airConditioning', 'chairs', 'tables', 'parking', 'restrooms', 'dressingRoom', 'kitchen', 'wifi', 'stage', 'pwdAccessibility'].map((key) => <React.Fragment key={key}><ToggleField label={({ airConditioning: 'Air Conditioning', chairs: 'Chairs', tables: 'Tables', parking: 'Parking', restrooms: 'Restrooms', dressingRoom: 'Dressing Room', kitchen: 'Kitchen', wifi: 'Wi-Fi', stage: 'Stage', pwdAccessibility: 'PWD Accessibility' } as Record<string, string>)[key]} onChange={(next) => set(key, next)} value={details[key]} />{details[key] === true && ['chairs', 'tables', 'parking', 'restrooms'].includes(key) ? <NumberField label={({ chairs: 'Chair Quantity', tables: 'Table Quantity', parking: 'Parking Capacity', restrooms: 'Number of Restrooms' } as Record<string, string>)[key]} onChange={(next) => set(`${key}Quantity`, next)} value={details[`${key}Quantity`]} /> : null}</React.Fragment>)}
          <TagField label="Other Inclusions" onChange={(next) => set('otherInclusions', next)} value={details.otherInclusions} />
        </Section>
        <Section title="Operations">
          <View style={styles.twoColumns}><TextField label="Opening Time" onChange={(next) => set('openingTime', next)} placeholder="08:00" value={details.openingTime} /><TextField label="Closing Time" onChange={(next) => set('closingTime', next)} placeholder="22:00" value={details.closingTime} /></View>
          <DurationField amount={details.setupAllowance} amountLabel="Setup / Ingress Allowance" onAmountChange={(next) => set('setupAllowance', next)} onUnitChange={(next) => set('setupAllowanceUnit', next)} unit={details.setupAllowanceUnit || 'hours'} units={['hours', 'days']} />
          <ToggleField label="Setup / Ingress Time Is Billable" onChange={(next) => set('setupAllowanceBillable', next)} value={details.setupAllowanceBillable} />
          <View style={styles.twoColumns}>
            <NumberField label="Minimum Booking" min={1} onChange={(next) => set('minimumBookingHours', next)} suffix="hours" value={details.minimumBookingHours} />
            <NumberField label="Maximum Booking (optional)" min={1} onChange={(next) => set('maximumBookingHours', next)} suffix="hours" value={details.maximumBookingHours} />
          </View>
          <NumberField label="Booking Duration Increment" min={0.25} onChange={(next) => set('bookingDurationIncrementHours', next)} suffix="hours" value={details.bookingDurationIncrementHours} />
        </Section>
      </> : null}

      {kind === 'event_organizer' ? <Section title="Coordinator Profile" description="This category is restricted to authorized MULTIVENT coordinator accounts.">
        <ChoiceField label="Specialization" multiple onChange={(next) => set('specializations', next)} options={presets.specializations} value={asList(details.specializations)} />
        {asList(details.specializations).includes('Other') ? <TextField label="Other Specialization" onChange={(next) => set('specializationOther', next)} value={details.specializationOther} /> : null}
        <ChoiceField label="Coordination Service Type" multiple onChange={(next) => set('coordinationTypes', next)} options={presets.coordinationTypes} value={asList(details.coordinationTypes)} />
        <NumberField label="Maximum Event Size" onChange={(next) => set('maximumEventSize', next)} suffix="guests" value={details.maximumEventSize} />
        <NumberField label="Coordinator Assignment Capacity" onChange={(next) => set('assignmentCapacity', next)} suffix="active events" value={details.assignmentCapacity} />
      </Section> : null}

      {kind === 'sound_lights' ? <>
        <Section title="Technical Coverage">
          <ChoiceField label="Service Type" multiple onChange={(next) => set('serviceTypes', next)} options={presets.soundTypes} value={asList(details.serviceTypes)} />
          {asList(details.serviceTypes).includes('Other') ? <TextField label="Other Service Type" onChange={(next) => set('serviceTypeOther', next)} value={details.serviceTypeOther} /> : null}
          <NumberField label="Recommended Guest Capacity" min={1} onChange={(next) => set('recommendedGuestCapacity', next)} suffix="guests" value={details.recommendedGuestCapacity} />
          <ChoiceField label="Venue Coverage" onChange={(next) => set('venueCoverage', next)} options={['Indoor', 'Outdoor', 'Both']} value={textValue(details.venueCoverage)} />
          <View style={styles.twoColumns}><NumberField label="Speakers" onChange={(next) => set('speakerCount', next)} value={details.speakerCount} /><NumberField label="Microphones" onChange={(next) => set('microphoneCount', next)} value={details.microphoneCount} /></View>
          <ChoiceField label="Microphone Type" multiple onChange={(next) => set('microphoneTypes', next)} options={presets.microphoneTypes} value={asList(details.microphoneTypes)} />
          {asList(details.microphoneTypes).includes('Other') ? <TextField label="Other Microphone Type" onChange={(next) => set('microphoneTypeOther', next)} value={details.microphoneTypeOther} /> : null}
          <TagField label="Lighting Types" onChange={(next) => set('lightingTypes', next)} options={presets.lightingTypes} value={details.lightingTypes} />
        </Section>
        <Section title="Equipment & Setup">
          {['mixerIncluded', 'stageIncluded', 'ledWallIncluded', 'projectorIncluded', 'technicianIncluded', 'setupIncluded', 'backupPower'].map((key) => <ToggleField key={key} label={({ mixerIncluded: 'Mixer Included', stageIncluded: 'Stage Included', ledWallIncluded: 'LED Wall Included', projectorIncluded: 'Projector Included', technicianIncluded: 'Technician Included', setupIncluded: 'Setup Included', backupPower: 'Generator / Backup Power' } as Record<string, string>)[key]} onChange={(next) => set(key, next)} value={details[key]} />)}
          {details.ledWallIncluded === true ? <><View style={styles.twoColumns}><NumberField label="LED Wall Width" onChange={(next) => set('ledWallWidth', next)} value={details.ledWallWidth} /><NumberField label="LED Wall Height" onChange={(next) => set('ledWallHeight', next)} value={details.ledWallHeight} /></View><ChoiceField label="LED Wall Unit" onChange={(next) => set('ledWallUnit', next)} options={['meters', 'feet']} value={textValue(details.ledWallUnit) || 'meters'} /></> : null}
          <DurationField amount={details.setupTimeHours} amountLabel="Setup Time Required" onAmountChange={(next) => set('setupTimeHours', next)} onUnitChange={() => undefined} unit="hours" units={['hours']} />
          <TextField label="Power Requirement (optional)" onChange={(next) => set('powerRequirement', next)} value={details.powerRequirement} />
          <TextField label="Service Area" onChange={(next) => set('serviceArea', next)} value={details.serviceArea} />
        </Section>
      </> : null}

      {kind === 'photography' ? <>
        <Section title="Coverage">
          <ChoiceField label="Coverage Type" multiple onChange={(next) => set('coverageTypes', next)} options={presets.photoCoverage} value={asList(details.coverageTypes)} />
          <ChoiceField label="Event Types" multiple onChange={(next) => set('eventTypes', next)} options={presets.eventTypes} value={asList(details.eventTypes)} />
          {asList(details.eventTypes).includes('Other') ? <TextField label="Other Event Type" onChange={(next) => set('eventTypeOther', next)} value={details.eventTypeOther} /> : null}
          <NumberField label="Coverage Duration" min={1} onChange={(next) => set('coverageDurationHours', next)} suffix="hours" value={details.coverageDurationHours} />
          <NumberField label="Number of Photographers" min={1} onChange={(next) => set('photographerCount', next)} value={details.photographerCount} />
          <ToggleField label="Photo Coverage" onChange={(next) => set('photoCoverage', next)} value={details.photoCoverage} />
          <ToggleField label="Video Coverage" onChange={(next) => set('videoCoverage', next)} value={details.videoCoverage} />
          {details.videoCoverage === true ? <NumberField label="Number of Videographers" min={1} onChange={(next) => set('videographerCount', next)} value={details.videographerCount} /> : null}
        </Section>
        <Section title="Deliverables">
          {['droneCoverage', 'sameDayEdit', 'preEventShoot', 'rawFilesIncluded', 'onlineGallery', 'physicalAlbum'].map((key) => <ToggleField key={key} label={({ droneCoverage: 'Drone Coverage', sameDayEdit: 'Same-Day Edit', preEventShoot: 'Pre-event Shoot', rawFilesIncluded: 'Raw Files Included', onlineGallery: 'Online Gallery', physicalAlbum: 'Physical Album' } as Record<string, string>)[key]} onChange={(next) => set(key, next)} value={details[key]} />)}
          <NumberField label="Minimum Edited Photos (optional)" onChange={(next) => set('minimumEditedPhotos', next)} value={details.minimumEditedPhotos} />
          {details.videoCoverage === true ? <><ToggleField label="Highlight Video" onChange={(next) => set('highlightVideo', next)} value={details.highlightVideo} /><ToggleField label="Full Event Video" onChange={(next) => set('fullEventVideo', next)} value={details.fullEventVideo} /></> : null}
          <DurationField amount={details.turnaroundTime} amountLabel="Turnaround Time" onAmountChange={(next) => set('turnaroundTime', next)} onUnitChange={(next) => set('turnaroundUnit', next)} unit={details.turnaroundUnit || 'weeks'} units={['days', 'weeks']} />
          <TextField label="Service Area" onChange={(next) => set('serviceArea', next)} value={details.serviceArea} />
        </Section>
      </> : null}

      {kind === 'host_emcee' ? <>
        <Section title="Hosting Coverage">
          <ChoiceField label="Event Types" multiple onChange={(next) => set('eventTypes', next)} options={presets.hostEventTypes} value={asList(details.eventTypes)} />
          {asList(details.eventTypes).includes('Other') ? <TextField label="Other Event Type" onChange={(next) => set('eventTypeOther', next)} value={details.eventTypeOther} /> : null}
          <ChoiceField label="Hosting Style" multiple onChange={(next) => set('hostingStyles', next)} options={presets.hostingStyles} value={asList(details.hostingStyles)} />
          {asList(details.hostingStyles).includes('Other') ? <TextField label="Other Hosting Style" onChange={(next) => set('hostingStyleOther', next)} value={details.hostingStyleOther} /> : null}
          <TagField label="Languages" onChange={(next) => set('languages', next)} options={presets.languages} value={details.languages} />
          <NumberField label="Coverage Duration" onChange={(next) => set('coverageDurationHours', next)} suffix="hours" value={details.coverageDurationHours} />
          <NumberField label="Maximum Event Duration (optional)" onChange={(next) => set('maximumDurationHours', next)} suffix="hours" value={details.maximumDurationHours} />
        </Section>
        <Section title="Preparation & Equipment">
          <ToggleField label="Script Preparation Included" onChange={(next) => set('scriptPreparationIncluded', next)} value={details.scriptPreparationIncluded} />
          <ToggleField label="Program Planning Assistance" onChange={(next) => set('programPlanningAssistance', next)} value={details.programPlanningAssistance} />
          <ToggleField label="Rehearsal Included" onChange={(next) => set('rehearsalIncluded', next)} value={details.rehearsalIncluded} />
          {details.rehearsalIncluded === true ? <NumberField label="Number of Rehearsals" onChange={(next) => set('rehearsalCount', next)} value={details.rehearsalCount} /> : null}
          <TagField label="Equipment Provided" onChange={(next) => set('equipmentProvided', next)} options={presets.hostEquipment} value={details.equipmentProvided} />
          <TextField label="Service Area" onChange={(next) => set('serviceArea', next)} value={details.serviceArea} />
        </Section>
      </> : null}

      <View style={styles.availabilityNote}><Text style={styles.availabilityTitle}>Availability</Text><Text style={styles.availabilityCopy}>Continue using the existing Availability screen for working dates and hours. These service details do not create a separate calendar.</Text></View>
    </View>
  )
}

const palette = {
  border: '#E6E1E2',
  error: '#BA1A1A',
  errorBackground: '#FFF1F2',
  input: '#FFFFFF',
  placeholder: '#929091',
  primary: '#6B1E2E',
  primarySoft: '#F8ECEF',
  secondary: '#666263',
  text: '#211F20',
} as const

const styles = StyleSheet.create({
  container: { gap: 18, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 24 },
  titleBlock: { gap: 5 },
  title: { color: palette.text, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  subtitle: { color: palette.secondary, fontSize: 13, lineHeight: 19 },
  section: { gap: 16, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: '#FCFBFB', padding: 16 },
  sectionHeading: { gap: 4 },
  sectionTitle: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1 },
  sectionDescription: { color: palette.secondary, fontSize: 12, lineHeight: 18 },
  field: { width: '100%', minWidth: 0, flexShrink: 0, gap: 7 },
  label: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  helper: { color: palette.secondary, fontSize: 11, lineHeight: 16 },
  input: { minHeight: 46, borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: palette.input, color: palette.text, fontSize: 14, paddingHorizontal: 13, paddingVertical: 10 },
  textArea: { minHeight: 84 },
  flexInput: { minWidth: 0, flex: 1 },
  inlineInput: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  suffix: { color: palette.secondary, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  chipText: { color: palette.secondary, fontSize: 12, lineHeight: 17 },
  chipTextActive: { color: palette.primary, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  toggleRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  toggleLabel: { minWidth: 0, flex: 1, color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  durationAmount: { width: 90 },
  durationUnits: { minWidth: 0, flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unitButton: { minHeight: 42, justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 12 },
  unitButtonActive: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  unitText: { color: palette.secondary, fontSize: 12 },
  unitTextActive: { color: palette.primary, fontWeight: '700' },
  tagInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallButton: { minHeight: 46, justifyContent: 'center', borderRadius: 8, backgroundColor: palette.primary, paddingHorizontal: 16 },
  smallButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  selectedTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  selectedTag: { borderRadius: 15, backgroundColor: palette.primarySoft, paddingHorizontal: 10, paddingVertical: 6 },
  selectedTagText: { color: palette.primary, fontSize: 11, fontWeight: '600' },
  repeatCard: { gap: 14, borderWidth: 1, borderColor: '#D8D1D3', borderRadius: 10, backgroundColor: '#FFFFFF', padding: 14 },
  repeatCardHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  repeatCardTitleBlock: { minWidth: 0, flex: 1, gap: 3 },
  repeatCardTitle: { color: palette.text, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  repeatCardMeta: { color: palette.secondary, fontSize: 11, lineHeight: 16 },
  expandIndicator: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  optionDetails: { gap: 14, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 14 },
  optionToggles: { gap: 4, borderRadius: 8, backgroundColor: '#FCFBFB', paddingHorizontal: 10 },
  menuItemCard: { gap: 12, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 14 },
  addButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.primary, borderRadius: 8, paddingHorizontal: 14 },
  addButtonText: { color: palette.primary, fontSize: 13, fontWeight: '700' },
  removeButton: { alignSelf: 'flex-start', paddingVertical: 5 },
  removeText: { color: palette.error, fontSize: 12, fontWeight: '700' },
  twoColumns: { width: '100%', gap: 12 },
  disabled: { opacity: 0.45 },
  integrationNote: { color: palette.secondary, fontSize: 12, lineHeight: 18, borderRadius: 8, backgroundColor: palette.primarySoft, padding: 12 },
  errorCard: { gap: 4, borderWidth: 1, borderColor: '#F2B8BE', borderRadius: 10, backgroundColor: palette.errorBackground, padding: 12 },
  errorText: { color: palette.error, fontSize: 12, lineHeight: 18 },
  availabilityNote: { gap: 4, borderRadius: 10, backgroundColor: '#F1F0F0', padding: 14 },
  availabilityTitle: { color: palette.text, fontSize: 13, fontWeight: '700' },
  availabilityCopy: { color: palette.secondary, fontSize: 12, lineHeight: 18 },
})
