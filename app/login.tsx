import Feather from "@expo/vector-icons/Feather";
import { Href, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { MotionPressable as Pressable } from "../src/components/MotionPressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { workerCapabilities } from "../src/constants/capabilities";
import { useApp } from "../src/context/AppContext";
import { screenPalette } from "../src/theme";
import { PublicRole, Role } from "../src/types";
import { typography } from "../src/typography";
import { AppText as Text, AppTextInput as TextInput } from "../src/components/AppText";
import { MotionModal as Modal } from "../src/components/MotionModal";
import { useMotionLayout } from "../src/hooks/useMotionLayout";

const palette = screenPalette;

const barangays = ["Barangay Alijis", "Barangay Taculing", "Barangay Mandalagan", "Barangay 10"];

function getRoleRoute(role?: Role): Href {
  if (role === "admin") {
    return "/admin" as Href;
  }
  if (role === "worker") {
    return "/worker-dashboard";
  }

  if (role === "client") {
    return "/client-dashboard";
  }

  return "/role-selection";
}

export default function LoginScreen() {
  const router = useRouter();
  const prepareLayout = useMotionLayout();
  const { width: viewportWidth } = useWindowDimensions();
  const formWidth = Math.max(0, Math.min(viewportWidth - 32, 448));
  const formWidthStyle = { width: formWidth };
  const { actionLoading, error, login, register, usingFirebase } = useApp();
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [registerVisible, setRegisterVisible] = useState(false);
  const [fullName, setFullName] = useState("");
  const [registerMobileNumber, setRegisterMobileNumber] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerRole, setRegisterRole] = useState<PublicRole>("client");
  const [registerCapabilities, setRegisterCapabilities] = useState(["Cleaning"]);
  const [selectedBarangay, setSelectedBarangay] = useState(barangays[0]);
  const [barangayOpen, setBarangayOpen] = useState(false);
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [registrationAttempted, setRegistrationAttempted] = useState(false);
  const loginMobileError = loginAttempted && !/^\d{10}$/.test(mobileNumber) ? "Enter a 10-digit Philippine mobile number." : "";
  const loginPasswordError = loginAttempted && !password ? "Enter your password." : "";
  const registerNameError = registrationAttempted && fullName.trim().length < 2 ? "Enter your full name." : "";
  const registerMobileError = registrationAttempted && !/^\d{10}$/.test(registerMobileNumber) ? "Enter a 10-digit Philippine mobile number." : "";
  const registerPasswordError = registrationAttempted && registerPassword.length < 6 ? "Password must contain at least 6 characters." : "";

  function animateNext() {
    prepareLayout();
  }

  async function handleLogin() {
    setLoginAttempted(true);
    if (!/^\d{10}$/.test(mobileNumber) || !password) return;
    try {
      const user = await login({
        mobileNumber: mobileNumber.trim(),
        password
      });
      router.replace(getRoleRoute(user.role));
    } catch {
      // AppContext exposes the readable error message.
    }
  }

  async function handleRegister() {
    setRegistrationAttempted(true);
    if (fullName.trim().length < 2 || !/^\d{10}$/.test(registerMobileNumber) || registerPassword.length < 6) return;
    try {
      await register({
        role: registerRole,
        fullName,
        mobileNumber: registerMobileNumber,
        password: registerPassword,
        address: selectedBarangay,
        skills: registerRole === "worker" ? registerCapabilities : [],
        capabilities: registerRole === "worker" ? registerCapabilities : [],
        businessName: registerRole === "client" ? fullName : undefined
      });
      router.replace(getRoleRoute(registerRole));
    } catch {
      // AppContext exposes the readable error message.
    }
  }

  function toggleRegister() {
    animateNext();
    setRegisterVisible((visible) => !visible);
  }

  function toggleCapability(capability: string) {
    setRegisterCapabilities((items) =>
      items.includes(capability) ? items.filter((item) => item !== capability) : [...items, capability]
    );
  }

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={["top", "left", "right"]}>
      <View pointerEvents="none" style={screenStyles.backgroundArt}>
        <View style={[screenStyles.backgroundOrb, screenStyles.backgroundOrbOne]} />
        <View style={[screenStyles.backgroundOrb, screenStyles.backgroundOrbTwo]} />
        <View style={screenStyles.backgroundLink}>
          <View style={screenStyles.backgroundLinkCircle} />
          <View style={screenStyles.backgroundLinkBar} />
          <View style={[screenStyles.backgroundLinkCircle, screenStyles.backgroundLinkCircleGold]} />
        </View>
      </View>
      <View style={screenStyles.header}>
        <Text style={screenStyles.brand}>TASKLINK</Text>
        <Pressable accessibilityLabel="Help, privacy, and support" accessibilityRole="button" onPress={() => router.push("/help" as Href)} style={screenStyles.helpButton}>
          <Feather accessibilityElementsHidden color={palette.primary} name="help-circle" size={22} />
        </Pressable>
      </View>

      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={screenStyles.content}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={screenStyles.scroll}
      >
        <View style={[screenStyles.intro, formWidthStyle]}>
          <Text style={screenStyles.welcome}>Welcome Neighbor</Text>
          <Text style={screenStyles.subtitle}>Quickly connect with local help in your community.</Text>
        </View>

        <View style={[screenStyles.card, formWidthStyle]}>
          <Text style={screenStyles.authTitle}>Password Login</Text>
          <Text style={screenStyles.authNotice}>
            SMS OTP is not enabled yet. Use the password created with your account.
          </Text>
          <Text style={screenStyles.authNotice}>Employers and taskers use this same login. Your saved account type opens the correct dashboard.</Text>

          <View style={screenStyles.section}>
            <Text style={screenStyles.label}>Mobile Number</Text>
            <PhoneInput error={loginMobileError} mobileNumber={mobileNumber} onChange={setMobileNumber} />
          </View>

          {error ? <Text style={screenStyles.errorText}>{error}</Text> : null}

          <View style={screenStyles.section}>
            <Text style={screenStyles.label}>Password</Text>
            <TextInput
              accessibilityLabel="Password"
              accessibilityHint={loginPasswordError || undefined}
              autoComplete="current-password"
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={palette.outline}
              secureTextEntry
              style={screenStyles.textInput}
              value={password}
            />
            {loginPasswordError ? <Text accessibilityLiveRegion="polite" style={screenStyles.errorText}>{loginPasswordError}</Text> : null}
            <Pressable
              accessibilityLabel="Login"
              accessibilityRole="button"
              accessibilityState={{ busy: actionLoading, disabled: actionLoading }}
              disabled={actionLoading}
              onPress={handleLogin}
              style={({ pressed }) => [screenStyles.secondaryButton, pressed && screenStyles.pressed]}
            >
              <Text style={screenStyles.secondaryButtonText}>{actionLoading ? "Logging in..." : "Login"}</Text>
            </Pressable>
          </View>

          <View style={screenStyles.dividerRow}>
            <View style={screenStyles.divider} />
            <Text style={screenStyles.dividerText}>OR REGISTER</Text>
            <View style={screenStyles.divider} />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={toggleRegister}
            style={({ pressed }) => [screenStyles.createAccountButton, pressed && screenStyles.pressed]}
          >
            <Text style={screenStyles.createAccountText}>{registerVisible ? "Hide Registration" : "Create Account"}</Text>
          </Pressable>

          {registerVisible ? (
            <View style={screenStyles.registerPanel}>
              <View style={screenStyles.profileRow}>
                <View accessibilityLabel="Registration profile initial" style={screenStyles.avatarButton}>
                  <Text style={screenStyles.avatarIcon}>{fullName.trim()[0]?.toUpperCase() ?? "U"}</Text>
                </View>
                <View style={screenStyles.nameField}>
                  <Text style={screenStyles.label}>Full Name</Text>
                  <TextInput
                    accessibilityLabel="Full name"
                    accessibilityHint={registerNameError || undefined}
                    autoComplete="name"
                    onChangeText={setFullName}
                    placeholder="Juana Dela Cruz"
                    placeholderTextColor={palette.outline}
                    style={screenStyles.textInput}
                    value={fullName}
                  />
                  {registerNameError ? <Text accessibilityLiveRegion="polite" style={screenStyles.errorText}>{registerNameError}</Text> : null}
                </View>
              </View>

              <Text style={screenStyles.label}>Create Account As</Text>
              <View style={screenStyles.tabRow}>
                {([
                  { label: "Employer", role: "client" },
                  { label: "Tasker", role: "worker" }
                ] as const).map((option) => {
                  const selected = registerRole === option.role;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={option.role}
                      onPress={() => setRegisterRole(option.role)}
                      style={[screenStyles.tabButton, selected && screenStyles.tabButtonActive]}
                    >
                      <Text style={[screenStyles.tabText, selected && screenStyles.tabTextActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={screenStyles.label}>Mobile Number</Text>
              <PhoneInput error={registerMobileError} mobileNumber={registerMobileNumber} onChange={setRegisterMobileNumber} />

              <Text style={screenStyles.label}>Select Barangay</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setBarangayOpen(true)}
                style={screenStyles.dropdownButton}
              >
                <Text style={screenStyles.dropdownText}>{selectedBarangay}</Text>
                <Feather accessibilityElementsHidden color={palette.primary} name="chevron-down" size={20} />
              </Pressable>

              <Text style={screenStyles.label}>Password</Text>
              <TextInput
                accessibilityLabel="Create password"
                accessibilityHint={registerPasswordError || "Use at least 6 characters."}
                autoComplete="new-password"
                onChangeText={setRegisterPassword}
                placeholder="Create password"
                placeholderTextColor={palette.outline}
                secureTextEntry
                style={screenStyles.textInput}
                value={registerPassword}
              />
              {registerPasswordError ? <Text accessibilityLiveRegion="polite" style={screenStyles.errorText}>{registerPasswordError}</Text> : null}

              {registerRole === "worker" ? (
                <>
                  <Text style={screenStyles.label}>Worker Capabilities</Text>
                  <View style={screenStyles.capabilityGrid}>
                    {workerCapabilities.map((capability) => {
                      const selected = registerCapabilities.includes(capability);
                      return (
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          key={capability}
                          onPress={() => toggleCapability(capability)}
                          style={[screenStyles.capabilityChip, selected && screenStyles.capabilityChipSelected]}
                        >
                          <Text style={[screenStyles.capabilityText, selected && screenStyles.capabilityTextSelected]}>
                            {capability}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Pressable
                accessibilityLabel={`Create ${registerRole === "client" ? "employer" : "tasker"} account`}
                accessibilityRole="button"
                accessibilityState={{ busy: actionLoading, disabled: actionLoading }}
                disabled={actionLoading}
                onPress={handleRegister}
                style={({ pressed }) => [screenStyles.primaryButton, pressed && screenStyles.pressed]}
              >
                <Text style={screenStyles.primaryButtonText}>
                  {actionLoading ? "Creating Account..." : `Create ${registerRole === "client" ? "Employer" : "Tasker"} Account`}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={[screenStyles.termsBlock, formWidthStyle]}>
          <Text style={screenStyles.terms}>By signing in, you agree to the beta terms and privacy notice.</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push("/help" as Href)}>
            <Text style={screenStyles.link}>Read terms, privacy, limitations, and support</Text>
          </Pressable>
        </View>

        <View style={[screenStyles.footer, formWidthStyle]}>
          <Text style={screenStyles.modeText}>TaskLink records payment evidence but does not process or escrow funds.</Text>
          <Text style={screenStyles.modeText}>
            Data mode: {usingFirebase ? "Firebase backend" : "Firebase not configured"}
          </Text>
          <Text style={screenStyles.copyright}>(c) 2026 TASKLINK Philippines</Text>
        </View>
      </ScrollView>

      <Modal animationType="fade" transparent visible={barangayOpen} onRequestClose={() => setBarangayOpen(false)}>
        <Pressable accessibilityLabel="Close barangay picker" accessibilityRole="button" motionDisabled style={screenStyles.modalBackdrop} onPress={() => setBarangayOpen(false)}>
          <View accessibilityViewIsModal style={screenStyles.dropdownMenu}>
            <Text style={screenStyles.dropdownTitle}>Select Barangay</Text>
            {barangays.map((barangay) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: selectedBarangay === barangay }}
                key={barangay}
                onPress={() => {
                  setSelectedBarangay(barangay);
                  setBarangayOpen(false);
                }}
                style={screenStyles.dropdownOption}
              >
                <Text
                  style={[
                    screenStyles.dropdownOptionText,
                    selectedBarangay === barangay && screenStyles.dropdownOptionSelected
                  ]}
                >
                  {barangay}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

type PhoneInputProps = {
  error?: string;
  mobileNumber: string;
  onChange: (value: string) => void;
};

function PhoneInput({ error, mobileNumber, onChange }: PhoneInputProps) {
  return (
    <View>
      <View style={screenStyles.phoneInputWrap}>
        <View style={screenStyles.prefixWrap}>
          <Text allowFontScaling={false} style={screenStyles.prefix}>
            +63
          </Text>
        </View>
        <TextInput
          accessibilityLabel="Philippine mobile number"
          accessibilityHint={error || "Enter the 10 digits after country code plus 63."}
          autoComplete="tel"
          inputMode="tel"
          keyboardType="phone-pad"
          maxLength={10}
          onChangeText={(value) => onChange(value.replace(/\D/g, ""))}
          placeholder="917 000 0001"
          placeholderTextColor={palette.outline}
          style={screenStyles.phoneInput}
          value={mobileNumber}
        />
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={screenStyles.phoneError}>{error}</Text> : null}
    </View>
  );
}

const screenStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
    overflow: "hidden"
  },
  backgroundArt: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.12 },
  backgroundOrb: { position: "absolute", borderRadius: 999, backgroundColor: palette.primary },
  backgroundOrbOne: { width: 300, height: 300, top: 76, right: -174 },
  backgroundOrbTwo: { width: 230, height: 230, bottom: -96, left: -126, backgroundColor: palette.secondaryContainer },
  backgroundLink: { position: "absolute", right: -22, top: "39%", flexDirection: "row", alignItems: "center", transform: [{ rotate: "-16deg" }] },
  backgroundLinkCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: palette.primary },
  backgroundLinkCircleGold: { backgroundColor: palette.secondaryContainer },
  backgroundLinkBar: { width: 80, height: 28, marginHorizontal: -10, borderRadius: 14, backgroundColor: "#5DF7F2" },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.surface,
    borderBottomColor: "rgba(207, 249, 255, 0.20)",
    borderBottomWidth: 1
  },
  brand: {
    ...typography.screenTitle,
    color: palette.primary
  },
  helpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceContainer
  },
  helpText: {
    ...typography.sectionTitle,
    color: palette.muted
  },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: "100%",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 28,
    alignItems: "center"
  },
  scroll: {
    flex: 1,
    width: "100%"
  },
  intro: {
    width: "100%",
    maxWidth: 448,
    alignItems: "center",
    marginBottom: 28
  },
  welcome: {
    ...typography.sectionTitle,
    color: palette.textStrong,
    textAlign: "center"
  },
  subtitle: {
    ...typography.cardTitle,
    color: palette.muted,
    marginTop: 8,
    textAlign: "center"
  },
  card: {
    width: "100%",
    maxWidth: 448,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(55, 126, 151, 0.34)",
    backgroundColor: palette.surface,
    shadowColor: "#001722",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.11,
    shadowRadius: 20,
    elevation: 5,
    gap: 20
  },
  authTitle: { ...typography.cardTitleStrong, color: palette.textStrong },
  authNotice: { ...typography.body, color: palette.muted },
  section: {
    gap: 14
  },
  registerPanel: {
    gap: 14,
    paddingTop: 4
  },
  tabRow: {
    minHeight: 48,
    padding: 4,
    borderRadius: 10,
    backgroundColor: palette.surfaceLow,
    flexDirection: "row",
    gap: 4
  },
  tabButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  tabButtonActive: {
    backgroundColor: palette.primary
  },
  tabText: {
    ...typography.bodyMedium,
    color: palette.muted,
    textAlign: "center"
  },
  tabTextActive: {
    color: palette.white
  },
  label: {
    ...typography.fieldLabel,
    color: palette.text
  },
  phoneInputWrap: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: palette.surfaceLow,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent"
  },
  phoneError: {
    ...typography.metadata,
    marginTop: 6,
    color: "#FF7D8C"
  },
  prefixWrap: {
    width: 56,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  prefix: {
    ...typography.bodyMedium,
    color: palette.muted,
    includeFontPadding: false,
    textAlign: "center"
  },
  phoneInput: {
    ...typography.inputText,
    flex: 1,
    color: palette.text,
    minHeight: 52,
    paddingRight: 16
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primaryButtonText: {
    ...typography.button,
    color: palette.white
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  divider: {
    height: 1,
    flex: 1,
    backgroundColor: palette.outlineVariant
  },
  dividerText: {
    ...typography.badge,
    color: palette.outline
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  sentIcon: {
    ...typography.badge,
    color: palette.success
  },
  sentText: {
    ...typography.badge,
    color: palette.success
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6
  },
  otpInput: {
    ...typography.inputText,
    flex: 1,
    minWidth: 40,
    maxWidth: 52,
    height: 56,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceContainer,
    color: palette.text
  },
  resendButton: {
    alignSelf: "center",
    paddingVertical: 4
  },
  resendText: {
    ...typography.bodyMedium,
    color: palette.primary
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  avatarButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceHigh
  },
  avatarIcon: {
    ...typography.heroNumber,
    color: palette.outline
  },
  nameField: {
    flex: 1,
    gap: 6
  },
  textInput: {
    ...typography.inputText,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: palette.surfaceLow,
    color: palette.text
  },
  dropdownButton: {
    minHeight: 52,
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: palette.surfaceLow,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  dropdownText: {
    ...typography.cardTitle,
    color: palette.text,
    flex: 1
  },
  dropdownIcon: {
    ...typography.cardTitleStrong,
    color: palette.muted,
    paddingLeft: 12
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    ...typography.button,
    color: palette.white
  },
  createAccountButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  createAccountText: {
    ...typography.heroNumber,
    color: palette.primary
  },
  googleButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  googleButtonText: {
    ...typography.button,
    color: palette.text,
    textAlign: "center"
  },
  capabilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  capabilityChip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  capabilityChipSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  capabilityText: {
    ...typography.badge,
    color: palette.muted
  },
  capabilityTextSelected: {
    color: palette.white
  },
  pressed: {
    opacity: 0.78
  },
  termsBlock: { alignItems: "center", gap: 6 },
  terms: {
    ...typography.metadata,
    width: "100%",
    maxWidth: 448,
    color: palette.muted,
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 20
  },
  link: {
    ...typography.button,
    color: palette.primary
  },
  errorText: {
    ...typography.metadata,
    color: "#FF7D8C"
  },
  footer: {
    alignItems: "center",
    gap: 10,
    paddingTop: 24
  },
  trustRow: {
    flexDirection: "row",
    gap: 16
  },
  trustBadge: {
    height: 32,
    minWidth: 72,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceContainer
  },
  trustText: {
    ...typography.badge,
    color: palette.outline
  },
  modeText: {
    ...typography.metadata,
    color: palette.outline,
    textAlign: "center"
  },
  copyright: {
    ...typography.metadata,
    color: palette.outlineVariant
  },
  modalBackdrop: {
    flex: 1,
    padding: 24,
    backgroundColor: "rgba(1, 15, 25, 0.56)",
    alignItems: "center",
    justifyContent: "center"
  },
  dropdownMenu: {
    width: "100%",
    maxWidth: 448,
    borderRadius: 12,
    padding: 12,
    backgroundColor: palette.surface,
    shadowColor: "#001722",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8
  },
  dropdownTitle: {
    ...typography.cardTitleStrong,
    color: palette.text,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  dropdownOption: {
    minHeight: 48,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  dropdownOptionText: {
    ...typography.bodyMedium,
    color: palette.muted
  },
  dropdownOptionSelected: {
    ...typography.bodyMedium,
    color: palette.primary
  }
});
