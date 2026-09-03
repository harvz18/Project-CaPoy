import React from 'react'
import {
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

export interface ChangePasswordValue {
  currentPassword: string
  newPassword: string
}

interface ChangePasswordScreenProps {
  errorMessage?: string
  isSaving?: boolean
  isSuccessful?: boolean
  onBack?: () => void
  onChangePassword?: (value: ChangePasswordValue) => void
  onDone?: () => void
  onForgotPassword?: () => void
}

interface PasswordRequirement {
  id: 'length' | 'uppercase' | 'lowercase' | 'number'
  label: string
  met: boolean
}

const getPasswordRequirements = (password: string): PasswordRequirement[] => [
  { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', met: /[A-Z]/.test(password) },
  { id: 'lowercase', label: 'One lowercase letter', met: /[a-z]/.test(password) },
  { id: 'number', label: 'One number', met: /\d/.test(password) },
]

const strengthLabels = ['Enter a password', 'Weak', 'Fair', 'Good', 'Strong'] as const

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

const LockIcon = ({ success = false }: { success?: boolean }) => (
  <View style={[styles.lockIcon, success && styles.lockIconSuccess]}>
    {success ? (
      <Text style={styles.successCheck}>{'\u2713'}</Text>
    ) : (
      <>
        <View style={styles.lockShackle} />
        <View style={styles.lockBody}>
          <View style={styles.lockKeyhole} />
        </View>
      </>
    )}
  </View>
)

export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({
  errorMessage,
  isSaving = false,
  isSuccessful = false,
  onBack,
  onChangePassword,
  onDone,
  onForgotPassword,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 720
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false)
  const [showNewPassword, setShowNewPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  const requirements = getPasswordRequirements(newPassword)
  const strength = requirements.filter((requirement) => requirement.met).length
  const currentPasswordIsValid = currentPassword.length > 0
  const newPasswordIsValid = requirements.every((requirement) => requirement.met)
  const passwordIsNew = newPassword.length > 0 && newPassword !== currentPassword
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === newPassword
  const canSubmit =
    currentPasswordIsValid && newPasswordIsValid && passwordIsNew && passwordsMatch

  const handleSubmit = () => {
    setSubmitted(true)
    if (!canSubmit || isSaving) return
    onChangePassword?.({ currentPassword, newPassword })
  }

  if (isSuccessful) {
    return (
      <View style={styles.screen}>
        <View style={styles.topAppBar}>
          <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
            <View style={styles.headerSpacer} />
            <Text numberOfLines={1} style={styles.headerTitle}>
              Change Password
            </Text>
            <View style={styles.headerSpacer} />
          </View>
        </View>
        <View style={styles.successScreen}>
          <LockIcon success />
          <Text style={styles.successEyebrow}>PASSWORD UPDATED</Text>
          <Text style={styles.successTitle}>Your password has been changed</Text>
          <Text style={styles.successDescription}>
            Your account is secured with your new password. Use it the next time you sign in.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onDone}
            style={({ pressed }) => [styles.doneButton, pressed && styles.primaryButtonPressed]}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Back to account security"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <BackIcon />
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>
            Change Password
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
        <View style={styles.hero}>
          <LockIcon />
          <Text style={styles.eyebrow}>ACCOUNT SECURITY</Text>
          <Text style={styles.title}>Create a new password</Text>
          <Text style={styles.subtitle}>
            Enter your current password, then choose a strong password you have not used before.
          </Text>
        </View>

        <View style={styles.formCard}>
          <PasswordField
            autoComplete="current-password"
            error={submitted && !currentPasswordIsValid}
            helperText={
              submitted && !currentPasswordIsValid ? 'Enter your current password.' : undefined
            }
            label="Current password"
            onChangeText={setCurrentPassword}
            onSubmitEditing={() => undefined}
            onToggleVisibility={() => setShowCurrentPassword((visible) => !visible)}
            placeholder="Enter your current password"
            returnKeyType="next"
            secure={!showCurrentPassword}
            value={currentPassword}
            visible={showCurrentPassword}
          />

          <Pressable
            accessibilityRole="button"
            onPress={onForgotPassword}
            style={({ pressed }) => [styles.forgotButton, pressed && styles.inlineButtonPressed]}
          >
            <Text style={styles.forgotButtonText}>Forgot current password?</Text>
          </Pressable>

          <View style={styles.formDivider} />

          <PasswordField
            autoComplete="new-password"
            error={submitted && (!newPasswordIsValid || !passwordIsNew)}
            helperText={
              submitted && !passwordIsNew
                ? 'Your new password must be different from your current password.'
                : submitted && !newPasswordIsValid
                  ? 'Meet all password requirements below.'
                  : undefined
            }
            label="New password"
            onChangeText={setNewPassword}
            onToggleVisibility={() => setShowNewPassword((visible) => !visible)}
            placeholder="Enter a new password"
            returnKeyType="next"
            secure={!showNewPassword}
            value={newPassword}
            visible={showNewPassword}
          />

          <View style={styles.strengthBlock}>
            <View style={styles.strengthHeader}>
              <Text style={styles.strengthLabel}>PASSWORD STRENGTH</Text>
              <Text
                style={[
                  styles.strengthValue,
                  strength === 4 && styles.strengthValueStrong,
                ]}
              >
                {strengthLabels[strength]}
              </Text>
            </View>
            <View style={styles.strengthMeter}>
              {[1, 2, 3, 4].map((segment) => (
                <View
                  key={segment}
                  style={[
                    styles.strengthSegment,
                    strength >= segment && styles.strengthSegmentActive,
                    strength === 4 && styles.strengthSegmentStrong,
                  ]}
                />
              ))}
            </View>
            <View style={styles.requirementGrid}>
              {requirements.map((requirement) => (
                <View key={requirement.id} style={styles.requirementRow}>
                  <View
                    style={[
                      styles.requirementIcon,
                      requirement.met && styles.requirementIconMet,
                    ]}
                  >
                    <Text
                      style={[
                        styles.requirementCheck,
                        requirement.met && styles.requirementCheckMet,
                      ]}
                    >
                      {requirement.met ? '\u2713' : '·'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.requirementText,
                      requirement.met && styles.requirementTextMet,
                    ]}
                  >
                    {requirement.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <PasswordField
            autoComplete="new-password"
            error={submitted && !passwordsMatch}
            helperText={submitted && !passwordsMatch ? 'Passwords do not match.' : undefined}
            label="Confirm new password"
            onChangeText={setConfirmPassword}
            onSubmitEditing={handleSubmit}
            onToggleVisibility={() => setShowConfirmPassword((visible) => !visible)}
            placeholder="Re-enter your new password"
            returnKeyType="done"
            secure={!showConfirmPassword}
            value={confirmPassword}
            visible={showConfirmPassword}
          />

          {errorMessage ? (
            <View accessibilityRole="alert" style={styles.errorNotice}>
              <Text style={styles.errorNoticeIcon}>!</Text>
              <Text style={styles.errorNoticeText}>{errorMessage}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: isSaving, disabled: isSaving }}
            disabled={isSaving}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              isSaving && styles.primaryButtonDisabled,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving ? 'Updating password...' : 'Update password'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onBack}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>

        <View style={styles.securityNotice}>
          <View style={styles.noticeIcon}>
            <Text style={styles.noticeIconText}>i</Text>
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Keep your account secure</Text>
            <Text style={styles.noticeText}>
              Never share your password. Changing it may sign your account out on other devices.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const PasswordField = ({
  autoComplete,
  error,
  helperText,
  label,
  onChangeText,
  onSubmitEditing,
  onToggleVisibility,
  placeholder,
  returnKeyType,
  secure,
  value,
  visible,
}: {
  autoComplete: 'current-password' | 'new-password'
  error: boolean
  helperText?: string
  label: string
  onChangeText: (value: string) => void
  onSubmitEditing?: () => void
  onToggleVisibility: () => void
  placeholder: string
  returnKeyType: 'done' | 'next'
  secure: boolean
  value: string
  visible: boolean
}) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={[styles.inputShell, error && styles.inputShellError]}>
      <TextInput
        autoCapitalize="none"
        autoComplete={autoComplete}
        autoCorrect={false}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={palette.placeholder}
        returnKeyType={returnKeyType}
        secureTextEntry={secure}
        style={styles.input}
        value={value}
      />
      <Pressable
        accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onToggleVisibility}
        style={({ pressed }) => [styles.visibilityButton, pressed && styles.inlineButtonPressed]}
      >
        <Text style={styles.visibilityButtonText}>{visible ? 'Hide' : 'Show'}</Text>
      </Pressable>
    </View>
    {helperText ? (
      <Text accessibilityRole={error ? 'alert' : undefined} style={styles.helperText}>
        {helperText}
      </Text>
    ) : null}
  </View>
)

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  error: '#BA1A1A',
  errorSoft: '#FCEDEB',
  muted: '#777879',
  onPrimary: '#FFFFFF',
  placeholder: '#A8A8A9',
  positive: '#2F6B46',
  positiveSoft: '#E7F3EB',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#5D5F5F',
  surfaceContainerLow: '#F5F3F3',
  text: '#1B1C1C',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 30,
    minHeight: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 720,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  wideHorizontalPadding: { paddingHorizontal: 32 },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backButtonPressed: { backgroundColor: palette.surfaceContainerLow, opacity: 0.74 },
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
  headerTitle: {
    minWidth: 0,
    flex: 1,
    color: palette.primary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 48 },
  contentWide: { paddingHorizontal: 32, paddingTop: 34, paddingBottom: 56 },
  hero: { alignItems: 'center', marginBottom: 22 },
  lockIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: palette.primarySoft,
    marginBottom: 14,
  },
  lockIconSuccess: { width: 72, height: 72, borderRadius: 36, backgroundColor: palette.positiveSoft },
  lockShackle: {
    position: 'absolute',
    width: 19,
    height: 18,
    top: 13,
    borderWidth: 2,
    borderColor: palette.primaryContainer,
    borderRadius: 10,
  },
  lockBody: {
    position: 'absolute',
    width: 27,
    height: 21,
    bottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    backgroundColor: palette.primaryContainer,
  },
  lockKeyhole: { width: 4, height: 7, borderRadius: 2, backgroundColor: palette.white },
  successCheck: { color: palette.positive, fontSize: 34, lineHeight: 39, fontWeight: '700' },
  eyebrow: { color: palette.primaryContainer, fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 1.1 },
  title: { color: palette.text, fontSize: 23, lineHeight: 30, fontWeight: '700', textAlign: 'center', marginTop: 5 },
  subtitle: { maxWidth: 500, color: palette.secondary, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  formCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 11, backgroundColor: palette.white, padding: 18, gap: 14 },
  field: { width: '100%' },
  fieldLabel: { color: palette.text, fontSize: 11, lineHeight: 16, fontWeight: '600', marginBottom: 7 },
  inputShell: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: palette.background },
  inputShellError: { borderColor: palette.error },
  input: { minWidth: 0, minHeight: 46, flex: 1, color: palette.text, fontSize: 12, lineHeight: 18, paddingHorizontal: 13, paddingVertical: 11 },
  visibilityButton: { minWidth: 50, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  visibilityButtonText: { color: palette.primaryContainer, fontSize: 9, lineHeight: 14, fontWeight: '700' },
  helperText: { color: palette.error, fontSize: 9, lineHeight: 14, marginTop: 4 },
  forgotButton: { alignSelf: 'flex-end', paddingVertical: 2 },
  forgotButtonText: { color: palette.primaryContainer, fontSize: 9, lineHeight: 14, fontWeight: '600' },
  inlineButtonPressed: { opacity: 0.58 },
  formDivider: { height: 1, backgroundColor: palette.border, marginVertical: 2 },
  strengthBlock: { borderRadius: 8, backgroundColor: palette.surfaceContainerLow, padding: 12 },
  strengthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  strengthLabel: { color: palette.muted, fontSize: 8, lineHeight: 12, fontWeight: '700', letterSpacing: 0.55 },
  strengthValue: { color: palette.primaryContainer, fontSize: 9, lineHeight: 13, fontWeight: '700' },
  strengthValueStrong: { color: palette.positive },
  strengthMeter: { flexDirection: 'row', gap: 5, marginTop: 7 },
  strengthSegment: { height: 3, flex: 1, borderRadius: 2, backgroundColor: palette.border },
  strengthSegmentActive: { backgroundColor: palette.primaryContainer },
  strengthSegmentStrong: { backgroundColor: palette.positive },
  requirementGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, marginTop: 11 },
  requirementRow: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6 },
  requirementIcon: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 7 },
  requirementIconMet: { borderColor: palette.positive, backgroundColor: palette.positiveSoft },
  requirementCheck: { color: palette.muted, fontSize: 10, lineHeight: 11, fontWeight: '700' },
  requirementCheckMet: { color: palette.positive },
  requirementText: { color: palette.muted, fontSize: 8, lineHeight: 12 },
  requirementTextMet: { color: palette.positive },
  errorNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 7, backgroundColor: palette.errorSoft, padding: 10 },
  errorNoticeIcon: { width: 17, height: 17, color: palette.white, borderRadius: 9, backgroundColor: palette.error, fontSize: 10, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  errorNoticeText: { minWidth: 0, flex: 1, color: palette.error, fontSize: 9, lineHeight: 15 },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: palette.primaryContainer, paddingHorizontal: 20, marginTop: 2 },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  primaryButtonText: { color: palette.onPrimary, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  cancelButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  cancelButtonPressed: { backgroundColor: palette.surfaceContainerLow },
  cancelButtonText: { color: palette.secondary, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  securityNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 9, backgroundColor: palette.primarySoft, padding: 14, marginTop: 14 },
  noticeIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.primaryContainer, borderRadius: 11 },
  noticeIconText: { color: palette.primaryContainer, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  noticeCopy: { minWidth: 0, flex: 1 },
  noticeTitle: { color: palette.primaryContainer, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  noticeText: { color: palette.secondary, fontSize: 9, lineHeight: 15, marginTop: 2 },
  successScreen: { width: '100%', maxWidth: 540, flex: 1, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 64 },
  successEyebrow: { color: palette.positive, fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 1.1 },
  successTitle: { color: palette.text, fontSize: 24, lineHeight: 31, fontWeight: '700', textAlign: 'center', marginTop: 7 },
  successDescription: { color: palette.secondary, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  doneButton: { width: '100%', maxWidth: 320, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: palette.primaryContainer, paddingHorizontal: 20, marginTop: 24 },
  doneButtonText: { color: palette.onPrimary, fontSize: 12, lineHeight: 18, fontWeight: '700' },
})
