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
  useWindowDimensions,
  View,
} from 'react-native'

export interface ServiceInformationValue {
  category: string
  description: string
  photos: string[]
  serviceName: string
}

interface Step1ServiceListingScreenProps {
  category?: string
  initialValue?: Partial<Omit<ServiceInformationValue, 'category'>>
  maxPhotos?: number
  onAddPhoto?: () =>
    | Promise<string | string[] | null | undefined>
    | string
    | string[]
    | null
    | undefined
  onBack?: () => void
  onNext?: (value: ServiceInformationValue) => void
  onRemovePhoto?: (photoUri: string, index: number) => void
}

const DEFAULT_MAX_PHOTOS = 5

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

const CameraIcon = ({ muted = false }: { muted?: boolean }) => {
  const color = muted ? palette.photoPlaceholder : palette.primaryContainer

  return (
    <View style={styles.cameraIcon}>
      <View style={[styles.cameraTop, { backgroundColor: color }]} />
      <View style={[styles.cameraBody, { borderColor: color }]}>
        <View style={[styles.cameraLens, { borderColor: color }]} />
      </View>
    </View>
  )
}

const ImagePlaceholderIcon = () => (
  <View style={styles.placeholderIcon}>
    <View style={styles.placeholderSun} />
    <View style={styles.placeholderMountainLeft} />
    <View style={styles.placeholderMountainRight} />
  </View>
)

export const Step1ServiceListingScreen: React.FC<Step1ServiceListingScreenProps> = ({
  category = 'Catering',
  initialValue,
  maxPhotos = DEFAULT_MAX_PHOTOS,
  onAddPhoto,
  onBack,
  onNext,
  onRemovePhoto,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const photoLimit = Math.max(1, Math.floor(maxPhotos))
  const [serviceName, setServiceName] = React.useState(initialValue?.serviceName ?? '')
  const [description, setDescription] = React.useState(initialValue?.description ?? '')
  const [photos, setPhotos] = React.useState(
    () => initialValue?.photos?.filter(Boolean).slice(0, photoLimit) ?? []
  )
  const [submitted, setSubmitted] = React.useState(false)
  const [isAddingPhoto, setIsAddingPhoto] = React.useState(false)

  const normalizedName = serviceName.trim()
  const normalizedDescription = description.trim()
  const serviceNameMissing = submitted && normalizedName.length === 0
  const descriptionMissing = submitted && normalizedDescription.length === 0
  const canAddPhoto = photos.length < photoLimit && !isAddingPhoto

  const handleAddPhoto = async () => {
    if (!canAddPhoto || !onAddPhoto) return

    setIsAddingPhoto(true)
    try {
      const result = await onAddPhoto()
      const selected = (Array.isArray(result) ? result : [result]).filter(
        (photo): photo is string => typeof photo === 'string' && photo.length > 0
      )

      setPhotos((current) => {
        const unique = selected.filter((photo) => !current.includes(photo))
        return [...current, ...unique].slice(0, photoLimit)
      })
    } finally {
      setIsAddingPhoto(false)
    }
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos((current) => {
      const removedPhoto = current[index]
      if (removedPhoto) onRemovePhoto?.(removedPhoto, index)
      return current.filter((_, photoIndex) => photoIndex !== index)
    })
  }

  const handleNext = () => {
    setSubmitted(true)
    if (!normalizedName || !normalizedDescription) return

    onNext?.({
      category,
      description: normalizedDescription,
      photos,
      serviceName: normalizedName,
    })
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <View style={styles.headerSide}>
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.iconButtonPressed]}
            >
              <BackIcon />
            </Pressable>

            <View style={styles.progressBlock}>
              <Text style={styles.stepCaption}>Step 1 of 3</Text>
              <View
                accessibilityLabel="Step 1 of 3"
                accessibilityRole="progressbar"
                accessibilityValue={{ max: 3, min: 1, now: 1 }}
                style={styles.progressRow}
              >
                {[0, 1, 2].map((step) => (
                  <View
                    key={step}
                    style={[
                      styles.progressSegment,
                      step === 0 ? styles.progressSegmentActive : styles.progressSegmentInactive,
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>

          <Text numberOfLines={1} style={styles.headerTitle}>
            Tell Us About Your Service
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.contentWide : styles.contentMobile,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Tell Us About Your Service</Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{category}</Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Service Name</Text>
            <TextInput
              accessibilityLabel="Service name"
              autoCapitalize="words"
              onChangeText={setServiceName}
              placeholder="e.g., Premium Wedding Buffet"
              placeholderTextColor={palette.placeholder}
              returnKeyType="next"
              style={[styles.input, serviceNameMissing && styles.inputError]}
              value={serviceName}
            />
            {serviceNameMissing ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                Enter a service name.
              </Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              accessibilityLabel="Service description"
              multiline
              onChangeText={setDescription}
              placeholder="Describe your service..."
              placeholderTextColor={palette.placeholder}
              style={[
                styles.input,
                styles.descriptionInput,
                descriptionMissing && styles.inputError,
              ]}
              textAlignVertical="top"
              value={description}
            />
            {descriptionMissing ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                Add a short description of your service.
              </Text>
            ) : null}
          </View>

          <View style={styles.photosSection}>
            <View style={styles.photosHeader}>
              <Text style={styles.label}>Photos</Text>
              <Text style={styles.photoCount}>
                {photos.length} / {photoLimit} added
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={styles.photoList}
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
            >
              {Array.from({ length: photoLimit }).map((_, index) => {
                const photoUri = photos[index]
                const isNextSlot = index === photos.length
                const canSelectSlot = isNextSlot && canAddPhoto && Boolean(onAddPhoto)

                if (photoUri) {
                  return (
                    <View key={`${photoUri}-${index}`} style={styles.photoSlot}>
                      <Image
                        accessibilityLabel={
                          index === 0 ? 'Cover photo preview' : `Service photo ${index + 1}`
                        }
                        resizeMode="cover"
                        source={{ uri: photoUri }}
                        style={styles.photoPreview}
                      />
                      {index === 0 ? <CoverBadge /> : null}
                      <Pressable
                        accessibilityLabel={`Remove photo ${index + 1}`}
                        accessibilityRole="button"
                        hitSlop={6}
                        onPress={() => handleRemovePhoto(index)}
                        style={({ pressed }) => [
                          styles.removePhotoButton,
                          pressed && styles.removePhotoButtonPressed,
                        ]}
                      >
                        <Text style={styles.removePhotoText}>{'\u00D7'}</Text>
                      </Pressable>
                    </View>
                  )
                }

                return (
                  <Pressable
                    key={index}
                    accessibilityLabel={
                      canSelectSlot
                        ? index === 0
                          ? 'Add cover photo'
                          : 'Add another service photo'
                        : `Empty photo slot ${index + 1}`
                    }
                    accessibilityRole={canSelectSlot ? 'button' : undefined}
                    disabled={!canSelectSlot}
                    onPress={handleAddPhoto}
                    style={({ pressed }) => [
                      styles.photoSlot,
                      canSelectSlot && styles.addPhotoSlot,
                      pressed && styles.addPhotoSlotPressed,
                    ]}
                  >
                    {index === 0 ? <CoverBadge /> : null}
                    {canSelectSlot ? (
                      <View style={styles.addPhotoIconGroup}>
                        <CameraIcon />
                        <View style={styles.addBadge}>
                          <View style={styles.addBadgeHorizontal} />
                          <View style={styles.addBadgeVertical} />
                        </View>
                      </View>
                    ) : index === 0 && !onAddPhoto ? (
                      <CameraIcon muted />
                    ) : (
                      <ImagePlaceholderIcon />
                    )}
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, isWide && styles.wideHorizontalPadding]}>
        <Pressable
          accessibilityLabel="Continue to pricing"
          accessibilityRole="button"
          onPress={handleNext}
          style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const CoverBadge = () => (
  <View style={styles.coverBadge}>
    <Text style={styles.coverBadgeText}>Cover Photo</Text>
  </View>
)

const palette = {
  background: '#FAF9F9',
  border: '#EFEDED',
  error: '#BA1A1A',
  inputBackground: '#FFFFFF',
  onPrimary: '#FFFFFF',
  photoPlaceholder: '#C6C6C7',
  placeholder: '#A8A8A9',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primaryPill: '#F5EDEF',
  secondary: '#5D5F5F',
  surfaceContainerHigh: '#E9E8E8',
  text: '#1B1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 20,
    minHeight: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1024,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  wideHorizontalPadding: { paddingHorizontal: 32 },
  headerSide: {
    minWidth: 128,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginLeft: -8,
  },
  backIcon: { width: 24, height: 24, justifyContent: 'center' },
  backIconHead: {
    position: 'absolute',
    left: 4,
    width: 10,
    height: 10,
    borderBottomWidth: 1.8,
    borderLeftWidth: 1.8,
    borderColor: palette.primary,
    transform: [{ rotate: '45deg' }],
  },
  backIconShaft: {
    width: 16,
    height: 1.8,
    marginLeft: 4,
    borderRadius: 1,
    backgroundColor: palette.primary,
  },
  progressBlock: { gap: 4 },
  stepCaption: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  progressRow: { flexDirection: 'row', gap: 4 },
  progressSegment: { width: 32, height: 4, borderRadius: 2 },
  progressSegmentActive: { backgroundColor: palette.primaryContainer },
  progressSegmentInactive: { backgroundColor: palette.surfaceContainerHigh },
  headerTitle: {
    minWidth: 0,
    flex: 1,
    color: palette.primary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  headerSpacer: { width: 128 },
  content: { width: '100%', maxWidth: 768, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 40 },
  title: {
    color: palette.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    marginBottom: 32,
  },
  form: { gap: 24 },
  fieldGroup: { gap: 4 },
  label: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  categoryPill: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7CDD2',
    borderRadius: 999,
    backgroundColor: palette.primaryPill,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  categoryText: {
    color: palette.primaryContainer,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: palette.surfaceContainerHigh,
    borderRadius: 8,
    backgroundColor: palette.inputBackground,
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  descriptionInput: { minHeight: 104 },
  inputError: { borderColor: palette.error },
  errorText: { color: palette.error, fontSize: 12, lineHeight: 16 },
  photosSection: { gap: 8 },
  photosHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  photoCount: { color: palette.placeholder, fontSize: 12, lineHeight: 16 },
  photoList: { gap: 16, paddingTop: 8, paddingBottom: 2 },
  photoSlot: {
    position: 'relative',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.surfaceContainerHigh,
    borderRadius: 8,
    backgroundColor: palette.inputBackground,
  },
  addPhotoSlot: { borderColor: '#D1CBCD' },
  addPhotoSlotPressed: {
    borderColor: palette.primaryContainer,
    backgroundColor: palette.primaryPill,
    transform: [{ scale: 0.98 }],
  },
  photoPreview: { width: '100%', height: '100%', borderRadius: 6 },
  coverBadge: {
    position: 'absolute',
    top: -12,
    left: 11,
    zIndex: 3,
    borderRadius: 4,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  coverBadgeText: { color: palette.onPrimary, fontSize: 10, lineHeight: 14 },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 4,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(27, 28, 28, 0.72)',
  },
  removePhotoButtonPressed: { opacity: 0.6, transform: [{ scale: 0.92 }] },
  removePhotoText: {
    color: palette.onPrimary,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '400',
  },
  addPhotoIconGroup: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: palette.primaryContainer,
  },
  addBadgeHorizontal: {
    position: 'absolute',
    width: 7,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: palette.onPrimary,
  },
  addBadgeVertical: {
    position: 'absolute',
    width: 1.5,
    height: 7,
    borderRadius: 1,
    backgroundColor: palette.onPrimary,
  },
  cameraIcon: {
    width: 27,
    height: 23,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  cameraTop: {
    position: 'absolute',
    top: 1,
    left: 6,
    width: 10,
    height: 5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  cameraBody: {
    width: 25,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.8,
    borderRadius: 3,
  },
  cameraLens: { width: 8, height: 8, borderWidth: 1.6, borderRadius: 4 },
  placeholderIcon: {
    width: 26,
    height: 23,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: palette.surfaceContainerHigh,
    borderRadius: 2,
  },
  placeholderSun: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.surfaceContainerHigh,
  },
  placeholderMountainLeft: {
    position: 'absolute',
    bottom: -8,
    left: 1,
    width: 19,
    height: 19,
    borderLeftWidth: 1.5,
    borderTopWidth: 1.5,
    borderColor: palette.surfaceContainerHigh,
    transform: [{ rotate: '45deg' }],
  },
  placeholderMountainRight: {
    position: 'absolute',
    right: -2,
    bottom: -7,
    width: 14,
    height: 14,
    borderLeftWidth: 1.5,
    borderTopWidth: 1.5,
    borderColor: palette.surfaceContainerHigh,
    transform: [{ rotate: '45deg' }],
  },
  footer: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  nextButton: {
    width: '100%',
    maxWidth: 728,
    minHeight: 52,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  nextButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  nextButtonText: {
    color: palette.onPrimary,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  iconButtonPressed: { backgroundColor: palette.border, opacity: 0.72 },
})
