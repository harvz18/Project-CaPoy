import React from 'react'
import {
  ActivityIndicator,
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
  onBack: () => void
  onOpenSupport?: () => void
  onSave: (value: EditableAccountProfile) => void
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
  onBack,
  onOpenSupport,
  onSave,
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
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
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
  avatarText: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 25 },
  backButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 10, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  backGlyph: { color: colors.primaryDark, fontFamily: 'Inter_400Regular', fontSize: 34, lineHeight: 36, marginTop: -3 },
  brand: { color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5 },
  card: { alignSelf: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 18, borderWidth: 1, maxWidth: 680, padding: 20, width: '100%' },
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
