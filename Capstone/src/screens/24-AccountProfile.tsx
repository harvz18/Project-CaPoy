import { MaterialIcons } from '@expo/vector-icons'
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
import { Text } from '../components/AppText'
import type { EditableAccountProfile } from '../lib/profile'
import { colors } from '../theme/tokens'

type AccountProfileScreenProps = {
  error?: string
  isLoading?: boolean
  isSaving?: boolean
  isSigningOut?: boolean
  isUploadingPhoto?: boolean
  onBack: () => void
  onChoosePhoto?: () => Promise<string | undefined>
  onOpenSupport?: () => void
  onSave: (value: EditableAccountProfile) => void
  onSignOut?: () => void
  profile?: EditableAccountProfile
}

const fallbackProfile: EditableAccountProfile = {
  avatarUrl: '',
  businessDescription: '',
  businessLocation: '',
  businessName: '',
  contactEmail: '',
  contactPhone: '',
  email: '',
  fullName: '',
  phone: '',
  role: 'client',
}

export const AccountProfileScreen: React.FC<AccountProfileScreenProps> = ({
  error,
  isLoading = false,
  isSaving = false,
  isSigningOut = false,
  isUploadingPhoto = false,
  onBack,
  onChoosePhoto,
  onOpenSupport,
  onSave,
  onSignOut,
  profile,
}) => {
  const [value, setValue] = React.useState(profile ?? fallbackProfile)

  React.useEffect(() => {
    if (profile) setValue(profile)
  }, [profile])

  const isProvider = value.role === 'service_provider'
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backGlyph}>{'\u2039'}</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.brand}>MULTIVENT</Text>
          <Text style={styles.title}>{isProvider ? 'Business profile' : 'My account'}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityLabel={value.avatarUrl ? 'Change profile photo' : 'Add profile photo'}
          accessibilityRole="button"
          accessibilityState={{ busy: isUploadingPhoto, disabled: isUploadingPhoto }}
          disabled={!onChoosePhoto || isUploadingPhoto}
          onPress={() => void choosePhoto()}
          style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarButtonPressed]}
        >
          <View style={styles.avatar}>
            {value.avatarUrl ? (
              <Image
                accessibilityLabel="Your profile photo"
                resizeMode="cover"
                source={{ uri: value.avatarUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <View style={styles.cameraBadge}>
            {isUploadingPhoto ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <MaterialIcons color={colors.textInverse} name="photo-camera" size={17} />
            )}
          </View>
        </Pressable>
        <Text style={styles.photoActionText}>
          {isUploadingPhoto ? 'Uploading photo...' : value.avatarUrl ? 'Change profile photo' : 'Add profile photo'}
        </Text>
        <Text style={styles.introTitle}>Edit your profile</Text>
        <Text style={styles.introCopy}>
          Keep your contact details accurate. Account role and status can only be changed by authorized staff.
        </Text>

        {isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Loading profile...</Text></View>
        ) : (
          <View style={styles.card}>
            <Field label="Full name" onChangeText={(text) => update('fullName', text)} value={value.fullName} />
            <Field label="Email" editable={false} helper="Email changes require account verification." value={value.email} />
            <Field keyboardType="phone-pad" label="Phone number" onChangeText={(text) => update('phone', text)} placeholder="e.g. +63 917 123 4567" value={value.phone} />

            {isProvider ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Business details</Text>
                <Field label="Business name" onChangeText={(text) => update('businessName', text)} value={value.businessName} />
                <Field label="Business description" multiline onChangeText={(text) => update('businessDescription', text)} value={value.businessDescription} />
                <Field keyboardType="email-address" label="Public contact email" onChangeText={(text) => update('contactEmail', text)} value={value.contactEmail} />
                <Field keyboardType="phone-pad" label="Public contact phone" onChangeText={(text) => update('contactPhone', text)} value={value.contactPhone} />
                <Field label="Business location" onChangeText={(text) => update('businessLocation', text)} value={value.businessLocation} />
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSaving || isLoading}
              onPress={() => onSave(value)}
              style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed, (isSaving || isLoading) && styles.saveButtonDisabled]}
            >
              {isSaving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.saveText}>Save changes</Text>}
            </Pressable>
            {onOpenSupport ? (
              <Pressable accessibilityRole="button" onPress={onOpenSupport} style={styles.supportButton}>
                <Text style={styles.supportText}>Contact MULTIVENT Support</Text>
              </Pressable>
            ) : null}
            {onSignOut ? (
              <Pressable
                accessibilityLabel="Log out of MULTIVENT"
                accessibilityRole="button"
                accessibilityState={{ busy: isSigningOut, disabled: isSigningOut }}
                disabled={isSigningOut}
                onPress={onSignOut}
                style={({ pressed }) => [
                  styles.logoutButton,
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
            ) : null}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

type FieldProps = React.ComponentProps<typeof TextInput> & {
  helper?: string
  label: string
}

const Field: React.FC<FieldProps> = ({ helper, label, multiline, style, ...props }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.primary}
      style={[styles.input, multiline && styles.textarea, props.editable === false && styles.inputDisabled, style]}
      multiline={multiline}
      {...props}
    />
    {helper ? <Text style={styles.helper}>{helper}</Text> : null}
  </View>
)

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#F1E2E3', borderColor: '#E4C8CB', borderRadius: 44, borderWidth: 1, height: 88, justifyContent: 'center', width: 88 },
  avatarButton: { alignSelf: 'center', position: 'relative' },
  avatarButtonPressed: { opacity: 0.72 },
  avatarImage: { borderRadius: 43, height: '100%', width: '100%' },
  avatarText: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 25 },
  backButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 10, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  backGlyph: { color: colors.primaryDark, fontFamily: 'Inter_400Regular', fontSize: 34, lineHeight: 36, marginTop: -3 },
  brand: { color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5 },
  card: { alignSelf: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 18, borderWidth: 1, maxWidth: 680, padding: 20, width: '100%' },
  cameraBadge: { alignItems: 'center', backgroundColor: colors.primary, borderColor: colors.surfaceElevated, borderRadius: 17, borderWidth: 3, bottom: -1, height: 34, justifyContent: 'center', position: 'absolute', right: -3, width: 34 },
  content: { paddingBottom: 56, paddingHorizontal: 18, paddingTop: 28 },
  divider: { backgroundColor: colors.divider, height: 1, marginBottom: 20, marginTop: 5 },
  error: { backgroundColor: '#FFF0F0', borderRadius: 8, color: colors.error, fontFamily: 'Inter_500Medium', fontSize: 13, marginBottom: 14, padding: 11 },
  field: { marginBottom: 17 },
  header: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 13 },
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
})
