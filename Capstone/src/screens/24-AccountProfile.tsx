import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import React from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '../components/AppText'
import { BrandIdentity } from '../components/BrandIdentity'
import { BusinessPoliciesEditor } from '../components/BusinessPolicies'
import type { EditableAccountProfile } from '../lib/profile'
import { colors } from '../theme/tokens'

type AccountProfileScreenProps = {
  error?: string
  hideBackButton?: boolean
  isLoading?: boolean
  isSaving?: boolean
  isSigningOut?: boolean
  isUploadingPhoto?: boolean
  onBack: () => void
  onChoosePhoto?: () => Promise<string | undefined>
  onOpenSupport?: () => void
  onSave: (value: EditableAccountProfile) => void
  onScrollDirectionChange?: (direction: 'down' | 'up') => void
  onSignOut?: () => void
  profile?: EditableAccountProfile
}

const fallbackProfile: EditableAccountProfile = {
  avatarUrl: '',
  businessCoverUrl: '',
  businessDescription: '',
  businessLocation: '',
  businessLogoUrl: '',
  businessName: '',
  contactEmail: '',
  contactPhone: '',
  email: '',
  firstName: '',
  fullName: '',
  hasStructuredName: false,
  lastName: '',
  phone: '',
  role: 'client',
}

export const AccountProfileScreen: React.FC<AccountProfileScreenProps> = ({
  error,
  hideBackButton = false,
  isLoading = false,
  isSaving = false,
  isSigningOut = false,
  isUploadingPhoto = false,
  onBack,
  onChoosePhoto,
  onOpenSupport,
  onSave,
  onScrollDirectionChange,
  onSignOut,
  profile,
}) => {
  const safeAreaInsets = useSafeAreaInsets()
  const [value, setValue] = React.useState(profile ?? fallbackProfile)
  const lastScrollY = React.useRef(0)

  React.useEffect(() => {
    if (profile) setValue(profile)
  }, [profile])

  const isProvider = value.role === 'service_provider'
  const isClient = value.role === 'client'
  const isCoordinator = value.role === 'event_coordinator'
  const isNeumorphicProfile = isClient || isCoordinator
  const shouldHideBackButton = hideBackButton || isCoordinator
  const initials = (isProvider ? value.businessName : value.fullName)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'MV'

  const update = (field: keyof EditableAccountProfile, text: string) => {
    setValue((current) => ({ ...current, [field]: text }))
  }

  const choosePhoto = async () => {
    if (!onChoosePhoto || isUploadingPhoto) return
    const avatarUrl = await onChoosePhoto()
    if (avatarUrl) setValue((current) => ({ ...current, avatarUrl }))
  }

  const avatarControl = (
    <Pressable
      accessibilityLabel={value.avatarUrl ? 'Change profile photo' : 'Add profile photo'}
      accessibilityRole="button"
      accessibilityState={{ busy: isUploadingPhoto, disabled: isUploadingPhoto }}
      disabled={!onChoosePhoto || isUploadingPhoto}
      onPress={() => void choosePhoto()}
      style={({ pressed }) => [
        styles.avatarButton,
        isNeumorphicProfile && styles.avatarButtonCompact,
        pressed && styles.avatarButtonPressed,
      ]}
    >
      <View style={[styles.avatar, isNeumorphicProfile && styles.avatarCompact]}>
        {value.avatarUrl ? (
          <Image
            accessibilityLabel="Your profile photo"
            resizeMode="cover"
            source={{ uri: value.avatarUrl }}
            style={[styles.avatarImage, isNeumorphicProfile && styles.avatarImageCompact]}
          />
        ) : (
          <Text style={[styles.avatarText, isNeumorphicProfile && styles.avatarTextCompact]}>{initials}</Text>
        )}
      </View>
      <View style={[styles.cameraBadge, isNeumorphicProfile && styles.cameraBadgeCompact]}>
        {isUploadingPhoto ? (
          <ActivityIndicator color={colors.textInverse} size="small" />
        ) : (
          <MaterialIcons color={colors.textInverse} name="photo-camera" size={16} />
        )}
      </View>
    </Pressable>
  )

  const supportAction = onOpenSupport ? (
    <Pressable
      accessibilityLabel="Contact MULTIVENT Support"
      accessibilityRole="button"
      onPress={onOpenSupport}
      style={({ pressed }) => [styles.supportButton, isNeumorphicProfile && styles.clientSupportButton, pressed && styles.secondaryButtonPressed]}
    >
      {isNeumorphicProfile ? <MaterialIcons color={colors.primaryDark} name="support-agent" size={20} /> : null}
      <Text style={styles.supportText}>Contact MULTIVENT Support</Text>
    </Pressable>
  ) : null

  const logoutAction = onSignOut ? (
    <Pressable
      accessibilityLabel="Log out of MULTIVENT"
      accessibilityRole="button"
      accessibilityState={{ busy: isSigningOut, disabled: isSigningOut }}
      disabled={isSigningOut}
      onPress={onSignOut}
      style={({ pressed }) => [
        styles.logoutButton,
        isNeumorphicProfile && styles.clientLogoutButton,
        pressed && styles.logoutButtonPressed,
        isSigningOut && styles.logoutButtonDisabled,
      ]}
    >
      {isSigningOut ? (
        <ActivityIndicator color={colors.error} size="small" />
      ) : (
        <MaterialIcons color={colors.error} name="logout" size={20} />
      )}
      <Text style={styles.logoutText}>
        {isSigningOut ? 'Logging out...' : 'Log out'}
      </Text>
    </Pressable>
  ) : null

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.screen, isNeumorphicProfile && styles.clientScreen]}
    >
      <View style={styles.header}>
        {shouldHideBackButton ? <View style={styles.headerSpacer} /> : (
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              isNeumorphicProfile && styles.clientBackButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <MaterialIcons color={colors.textInverse} name="arrow-back" size={22} />
          </Pressable>
        )}
        <View style={styles.headerCopy}>
          <BrandIdentity markSize={28} showName={false} variant="metallicWordmark" />
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.content,
          isNeumorphicProfile && styles.clientContent,
          { paddingBottom: 132 + safeAreaInsets.bottom },
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => {
          const scrollY = Math.max(0, event.nativeEvent.contentOffset.y)
          const delta = scrollY - lastScrollY.current
          if (Math.abs(delta) < 8) return
          lastScrollY.current = scrollY
          onScrollDirectionChange?.(delta > 0 ? 'down' : 'up')
        }}
        scrollEventThrottle={16}
      >
        {!isNeumorphicProfile ? (
          <>
            {avatarControl}
            <Text style={styles.photoActionText}>
              {isUploadingPhoto ? 'Uploading photo...' : value.avatarUrl ? 'Change profile photo' : 'Add profile photo'}
            </Text>
            <Text style={styles.introTitle}>Edit your profile</Text>
            <Text style={styles.introCopy}>
              Keep your contact details accurate. Account role and status can only be changed by authorized staff.
            </Text>
          </>
        ) : (
          <View style={styles.clientProfileHeader}>
            {avatarControl}
            <View style={styles.clientProfileHeaderCopy}>
              <Text style={styles.clientIntroTitle}>Edit Your Profile</Text>
              <Text style={styles.clientIntroCopy}>Manage your personal and contact information.</Text>
              <Text style={styles.clientPhotoActionText}>
                {isUploadingPhoto ? 'Uploading photo...' : value.avatarUrl ? 'Change profile photo' : 'Add profile photo'}
              </Text>
            </View>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Loading profile...</Text></View>
        ) : (
          <>
          <View style={[styles.card, isNeumorphicProfile && styles.clientCard]}>
            {value.hasStructuredName ? (
              <View style={[styles.nameRow, isNeumorphicProfile && styles.clientNameRow]}>
                <View style={styles.nameInput}>
                  <Field autoCapitalize="words" autoComplete="name-given" label="First name" neumorphic={isNeumorphicProfile} onChangeText={(text) => update('firstName', text)} value={value.firstName} />
                </View>
                <View style={styles.nameInput}>
                  <Field autoCapitalize="words" autoComplete="name-family" label="Last name" neumorphic={isNeumorphicProfile} onChangeText={(text) => update('lastName', text)} value={value.lastName} />
                </View>
              </View>
            ) : (
              <Field autoCapitalize="words" autoComplete="name" label="Full name" neumorphic={isNeumorphicProfile} onChangeText={(text) => update('fullName', text)} value={value.fullName} />
            )}
            <Field label="Email" editable={false} helper="Email changes require account verification." neumorphic={isNeumorphicProfile} value={value.email} />
            <Field keyboardType="phone-pad" label="Phone number" neumorphic={isNeumorphicProfile} onChangeText={(text) => update('phone', text)} placeholder="e.g. +63 917 123 4567" value={value.phone} />

            {isProvider ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Business details</Text>
                <Field label="Business name" onChangeText={(text) => update('businessName', text)} value={value.businessName} />
                <Field label="Business description" multiline onChangeText={(text) => update('businessDescription', text)} value={value.businessDescription} />
                <Field keyboardType="email-address" label="Public contact email" onChangeText={(text) => update('contactEmail', text)} value={value.contactEmail} />
                <Field keyboardType="phone-pad" label="Public contact phone" onChangeText={(text) => update('contactPhone', text)} value={value.contactPhone} />
                <Field label="Business location" onChangeText={(text) => update('businessLocation', text)} value={value.businessLocation} />
                <BusinessPoliciesEditor audience="provider" />
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSaving || isLoading}
              onPress={() => onSave(value)}
              style={({ pressed }) => [styles.saveButton, isNeumorphicProfile && styles.clientSaveButton, pressed && styles.saveButtonPressed, (isSaving || isLoading) && styles.saveButtonDisabled]}
            >
              {isSaving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.saveText}>Save changes</Text>}
            </Pressable>
            {!isNeumorphicProfile ? supportAction : null}
            {!isNeumorphicProfile ? logoutAction : null}
          </View>
          {isNeumorphicProfile ? (
            <View style={styles.clientAccountActions}>
              {supportAction}
              {logoutAction}
            </View>
          ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

type FieldProps = React.ComponentProps<typeof TextInput> & {
  helper?: string
  label: string
  neumorphic?: boolean
}

const Field: React.FC<FieldProps> = ({ helper, label, multiline, neumorphic = false, style, ...props }) => (
  <View style={[styles.field, neumorphic && styles.clientField]}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.primary}
      style={[
        styles.input,
        neumorphic && styles.clientInput,
        multiline && styles.textarea,
        props.editable === false && styles.inputDisabled,
        neumorphic && props.editable === false && styles.clientInputDisabled,
        style,
      ]}
      multiline={multiline}
      {...props}
    />
    {helper ? <Text style={styles.helper}>{helper}</Text> : null}
  </View>
)

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#F1E2E3', borderColor: '#E4C8CB', borderRadius: 44, borderWidth: 1, height: 88, justifyContent: 'center', width: 88 },
  avatarButton: { alignSelf: 'center', position: 'relative' },
  avatarButtonCompact: { flexShrink: 0, margin: 7 },
  avatarButtonPressed: { opacity: 0.72 },
  avatarImage: { borderRadius: 43, height: '100%', width: '100%' },
  avatarImageCompact: { borderRadius: 35 },
  avatarText: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 25 },
  avatarTextCompact: { fontSize: 21 },
  backButton: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  backButtonPressed: { boxShadow: 'inset 3px 3px 7px rgba(44, 3, 15, 0.66), inset -3px -3px 7px rgba(143, 48, 72, 0.46)', transform: [{ scale: 0.96 }] },
  card: { alignSelf: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 18, borderWidth: 1, maxWidth: 680, padding: 20, width: '100%' },
  cameraBadge: { alignItems: 'center', backgroundColor: colors.primary, borderColor: colors.surfaceElevated, borderRadius: 17, borderWidth: 3, bottom: -1, height: 34, justifyContent: 'center', position: 'absolute', right: -3, width: 34 },
  cameraBadgeCompact: { borderColor: '#E9EDF0', borderRadius: 15, borderWidth: 2, bottom: -2, height: 30, right: -4, width: 30 },
  content: { paddingBottom: 112, paddingHorizontal: 18, paddingTop: 28 },
  divider: { backgroundColor: colors.divider, height: 1, marginBottom: 20, marginTop: 5 },
  error: { backgroundColor: '#FFF0F0', borderRadius: 8, color: colors.error, fontFamily: 'Inter_500Medium', fontSize: 13, marginBottom: 14, padding: 11 },
  field: { marginBottom: 17 },
  header: { alignItems: 'center', backgroundColor: '#6B1E2E', borderBottomColor: '#4E061A', borderBottomWidth: 1, flexDirection: 'row', minHeight: 64, paddingHorizontal: 20, paddingVertical: 8 },
  headerCopy: { alignItems: 'center', flex: 1 },
  headerSpacer: { width: 40 },
  helper: { color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 5 },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.textPrimary, fontFamily: 'Inter_400Regular', fontSize: 15, minHeight: 48, paddingHorizontal: 13, paddingVertical: 11 },
  inputDisabled: { backgroundColor: colors.grey100, color: colors.textSecondary },
  introCopy: { alignSelf: 'center', color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginBottom: 22, maxWidth: 540, textAlign: 'center' },
  introTitle: { color: colors.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 23, marginBottom: 7, marginTop: 13, textAlign: 'center' },
  label: { color: colors.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 7 },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 50 },
  loadingText: { color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13 },
  nameInput: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', gap: 10 },
  logoutButton: { alignItems: 'center', borderColor: colors.error, borderRadius: 11, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 10, minHeight: 48 },
  logoutButtonDisabled: { opacity: 0.55 },
  logoutButtonPressed: { backgroundColor: '#FFF0F0' },
  logoutText: { color: colors.error, fontFamily: 'Inter_700Bold', fontSize: 14 },
  photoActionText: { alignSelf: 'center', color: colors.primaryDark, fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 9 },
  saveButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 11, justifyContent: 'center', minHeight: 50 },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonPressed: { backgroundColor: colors.primaryDark },
  saveText: { color: colors.textInverse, fontFamily: 'Inter_700Bold', fontSize: 15 },
  supportButton: { alignItems: 'center', borderColor: colors.primary, borderRadius: 11, borderWidth: 1, justifyContent: 'center', marginTop: 10, minHeight: 48 },
  supportText: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 14 },
  screen: { backgroundColor: colors.backgroundSecondary, flex: 1 },
  sectionTitle: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 16 },
  textarea: { minHeight: 112, textAlignVertical: 'top' },
  title: { color: colors.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 16, marginTop: 2 },
  clientScreen: { backgroundColor: '#E9EDF0' },
  clientBackButton: { borderColor: 'rgba(255, 255, 255, 0.16)', borderWidth: 1, backgroundColor: '#6B1E2E', boxShadow: '3px 3px 7px rgba(44, 3, 15, 0.58), -3px -3px 7px rgba(143, 48, 72, 0.46)' },
  clientContent: { paddingHorizontal: 16, paddingTop: 18 },
  clientProfileHeader: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 15, maxWidth: 680, paddingHorizontal: 6, width: '100%' },
  clientProfileHeaderCopy: { flex: 1, minWidth: 0 },
  clientIntroTitle: { color: '#57636C', fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28 },
  clientIntroCopy: { color: '#6F7B84', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 3 },
  clientPhotoActionText: { color: colors.primaryDark, fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16, marginTop: 6 },
  avatarCompact: { backgroundColor: '#E9EDF0', borderColor: 'rgba(255, 255, 255, 0.76)', borderRadius: 36, height: 72, width: 72, boxShadow: '5px 5px 11px rgba(161, 172, 180, 0.5), -5px -5px 11px rgba(255, 255, 255, 0.95)' },
  clientCard: { backgroundColor: '#E9EDF0', borderColor: 'rgba(255, 255, 255, 0.76)', borderRadius: 20, marginTop: 18, padding: 18, boxShadow: '7px 7px 15px rgba(160, 171, 180, 0.48), -7px -7px 15px rgba(255, 255, 255, 0.95)' },
  clientField: { marginBottom: 15 },
  clientInput: { backgroundColor: '#E9EDF0', borderColor: 'rgba(255, 255, 255, 0.62)', borderRadius: 14, color: '#57636C', minHeight: 50, paddingHorizontal: 15, boxShadow: 'inset 4px 4px 8px rgba(165, 174, 182, 0.56), inset -4px -4px 8px rgba(255, 255, 255, 0.94)' },
  clientInputDisabled: { backgroundColor: '#E2E6E9', color: '#6F7B84', boxShadow: 'inset 3px 3px 6px rgba(165, 174, 182, 0.48), inset -3px -3px 6px rgba(255, 255, 255, 0.84)' },
  clientNameRow: { flexDirection: 'column', gap: 0 },
  clientSaveButton: { borderRadius: 25, marginTop: 2, minHeight: 50 },
  clientAccountActions: { alignSelf: 'center', gap: 11, marginTop: 18, maxWidth: 680, width: '100%' },
  clientSupportButton: { backgroundColor: '#E9EDF0', borderColor: 'rgba(255, 255, 255, 0.76)', borderRadius: 23, flexDirection: 'row', gap: 9, marginTop: 0, minHeight: 46, boxShadow: '4px 4px 9px rgba(161, 172, 180, 0.46), -4px -4px 9px rgba(255, 255, 255, 0.94)' },
  clientLogoutButton: { backgroundColor: '#E9EDF0', borderColor: 'rgba(185, 28, 28, 0.42)', borderRadius: 23, marginTop: 0, minHeight: 46 },
  secondaryButtonPressed: { boxShadow: 'inset 3px 3px 7px rgba(161, 172, 180, 0.5), inset -3px -3px 7px rgba(255, 255, 255, 0.92)', transform: [{ scale: 0.98 }] },
})
