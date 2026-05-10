import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../src/context/AppContext";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceLow: "#F1F4F3",
  surfaceContainer: "#EBEFED",
  surfaceHigh: "#E0E3E1",
  primary: "#005C55",
  secondary: "#855300",
  text: "#181C1C",
  textStrong: "#111827",
  muted: "#3E4947",
  outline: "#6E7977",
  outlineVariant: "#BDC9C6",
  success: "#10B981",
  white: "#FFFFFF"
};

const barangays = ["Barangay Alijis", "Barangay Taculing", "Barangay Mandalagan", "Barangay 10"];
type LoginMethod = "otp" | "password";

function getRoleRoute(role?: "worker" | "client") {
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
  const { actionLoading, error, login, register, usingFirebase } = useApp();
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("otp");
  const [mobileNumber, setMobileNumber] = useState("9170000001");
  const [verificationCode, setVerificationCode] = useState("123456");
  const [password, setPassword] = useState("");
  const [otpVisible, setOtpVisible] = useState(false);
  const [registerVisible, setRegisterVisible] = useState(false);
  const [fullName, setFullName] = useState("Juana Dela Cruz");
  const [registerMobileNumber, setRegisterMobileNumber] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState(barangays[0]);
  const [barangayOpen, setBarangayOpen] = useState(false);

  const otpDigits = useMemo(() => {
    const padded = verificationCode.padEnd(6, "");
    return Array.from({ length: 6 }, (_, index) => padded[index] ?? "");
  }, [verificationCode]);

  function animateNext() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }

  function handleOtpChange(value: string, index: number) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = digit;
    setVerificationCode(nextDigits.join("").slice(0, 6));
  }

  function handleSendOtp() {
    animateNext();
    setOtpVisible(true);
    if (!verificationCode) {
      setVerificationCode("123456");
    }
  }

  async function handleLogin() {
    try {
      const user = await login("worker", {
        mobileNumber,
        password
      });
      router.replace(getRoleRoute(user.role));
    } catch {
      // AppContext exposes the readable error message.
    }
  }

  async function handleRegister() {
    try {
      await register({
        role: "worker",
        fullName: fullName || "Prototype User",
        mobileNumber: registerMobileNumber || mobileNumber || "9170000001",
        password: registerPassword,
        address: selectedBarangay
      });
      router.replace("/role-selection");
    } catch {
      // AppContext exposes the readable error message.
    }
  }

  function toggleRegister() {
    animateNext();
    setRegisterVisible((visible) => !visible);
  }

  function switchMethod(method: LoginMethod) {
    animateNext();
    setLoginMethod(method);
    if (method === "password") {
      setOtpVisible(false);
    }
  }

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={["top", "left", "right"]}>
      <View style={screenStyles.header}>
        <Text style={screenStyles.brand}>TASKLINK</Text>
        <Pressable accessibilityLabel="Help" accessibilityRole="button" style={screenStyles.helpButton}>
          <Text style={screenStyles.helpText}>?</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={screenStyles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={screenStyles.intro}>
          <Text style={screenStyles.welcome}>Welcome Neighbor</Text>
          <Text style={screenStyles.subtitle}>Quickly connect with local help in your community.</Text>
        </View>

        <View style={screenStyles.card}>
          <View style={screenStyles.tabRow}>
            <LoginTab label="OTP Login" method="otp" activeMethod={loginMethod} onSelect={switchMethod} />
            <LoginTab label="Password Login" method="password" activeMethod={loginMethod} onSelect={switchMethod} />
          </View>

          <View style={screenStyles.section}>
            <Text style={screenStyles.label}>Mobile Number</Text>
            <PhoneInput mobileNumber={mobileNumber} onChange={setMobileNumber} />
          </View>

          {error ? <Text style={screenStyles.errorText}>{error}</Text> : null}

          {loginMethod === "otp" ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={handleSendOtp}
                style={({ pressed }) => [screenStyles.primaryButton, pressed && screenStyles.pressed]}
              >
                <Text style={screenStyles.primaryButtonText}>Send OTP</Text>
              </Pressable>

              {otpVisible ? (
                <>
                  <View style={screenStyles.dividerRow}>
                    <View style={screenStyles.divider} />
                    <Text style={screenStyles.dividerText}>ENTER CODE</Text>
                    <View style={screenStyles.divider} />
                  </View>

                  <View style={screenStyles.section}>
                    <View style={screenStyles.codeHeader}>
                      <Text style={screenStyles.label}>Verification Code</Text>
                      <View style={screenStyles.sentRow}>
                        <Text style={screenStyles.sentIcon}>OK</Text>
                        <Text style={screenStyles.sentText}>SMS Sent</Text>
                      </View>
                    </View>
                    <View style={screenStyles.otpRow}>
                      {otpDigits.map((digit, index) => (
                        <TextInput
                          key={index}
                          keyboardType="number-pad"
                          maxLength={1}
                          onChangeText={(value) => handleOtpChange(value, index)}
                          placeholder="."
                          placeholderTextColor={palette.outlineVariant}
                          style={screenStyles.otpInput}
                          textAlign="center"
                          value={digit}
                        />
                      ))}
                    </View>
                    <Pressable accessibilityRole="button" onPress={handleSendOtp} style={screenStyles.resendButton}>
                      <Text style={screenStyles.resendText}>Resend code in 0:45</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleLogin}
                      style={({ pressed }) => [screenStyles.secondaryButton, pressed && screenStyles.pressed]}
                    >
                      <Text style={screenStyles.secondaryButtonText}>{actionLoading ? "Logging in..." : "Login"}</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </>
          ) : (
            <View style={screenStyles.section}>
              <Text style={screenStyles.label}>Password</Text>
              <TextInput
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={palette.outline}
                secureTextEntry
                style={screenStyles.textInput}
                value={password}
              />
              <Pressable
                accessibilityRole="button"
                onPress={handleLogin}
                style={({ pressed }) => [screenStyles.secondaryButton, pressed && screenStyles.pressed]}
              >
                <Text style={screenStyles.secondaryButtonText}>{actionLoading ? "Logging in..." : "Login"}</Text>
              </Pressable>
            </View>
          )}

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
                <Pressable accessibilityRole="button" style={screenStyles.avatarButton}>
                  <Text style={screenStyles.avatarIcon}>+</Text>
                </Pressable>
                <View style={screenStyles.nameField}>
                  <Text style={screenStyles.label}>Full Name</Text>
                  <TextInput
                    onChangeText={setFullName}
                    placeholder="Juana Dela Cruz"
                    placeholderTextColor={palette.outline}
                    style={screenStyles.textInput}
                    value={fullName}
                  />
                </View>
              </View>

              <Text style={screenStyles.label}>Mobile Number</Text>
              <PhoneInput mobileNumber={registerMobileNumber} onChange={setRegisterMobileNumber} />

              <Text style={screenStyles.label}>Select Barangay</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setBarangayOpen(true)}
                style={screenStyles.dropdownButton}
              >
                <Text style={screenStyles.dropdownText}>{selectedBarangay}</Text>
                <Text style={screenStyles.dropdownIcon}>v</Text>
              </Pressable>

              <Text style={screenStyles.label}>Password</Text>
              <TextInput
                onChangeText={setRegisterPassword}
                placeholder="Create password"
                placeholderTextColor={palette.outline}
                secureTextEntry
                style={screenStyles.textInput}
                value={registerPassword}
              />

              <Pressable
                accessibilityRole="button"
                onPress={handleRegister}
                style={({ pressed }) => [screenStyles.primaryButton, pressed && screenStyles.pressed]}
              >
                <Text style={screenStyles.primaryButtonText}>
                  {actionLoading ? "Creating Account..." : "Complete Registration"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Text style={screenStyles.terms}>
          By signing in, you agree to our <Text style={screenStyles.link}>Terms of Service</Text> and{" "}
          <Text style={screenStyles.link}>Privacy Policy</Text>.
        </Text>

        <View style={screenStyles.footer}>
          <View style={screenStyles.trustRow}>
            <View style={screenStyles.trustBadge}>
              <Text style={screenStyles.trustText}>PAY</Text>
            </View>
            <View style={screenStyles.trustBadge}>
              <Text style={screenStyles.trustText}>SECURE</Text>
            </View>
          </View>
          <Text style={screenStyles.modeText}>
            Data mode: {usingFirebase ? "Firebase backend" : "Firebase not configured"}
          </Text>
          <Text style={screenStyles.copyright}>(c) 2024 TASKLINK Philippines</Text>
        </View>
      </ScrollView>

      <Modal animationType="fade" transparent visible={barangayOpen} onRequestClose={() => setBarangayOpen(false)}>
        <Pressable style={screenStyles.modalBackdrop} onPress={() => setBarangayOpen(false)}>
          <View style={screenStyles.dropdownMenu}>
            <Text style={screenStyles.dropdownTitle}>Select Barangay</Text>
            {barangays.map((barangay) => (
              <Pressable
                accessibilityRole="button"
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
  mobileNumber: string;
  onChange: (value: string) => void;
};

function PhoneInput({ mobileNumber, onChange }: PhoneInputProps) {
  return (
    <View style={screenStyles.phoneInputWrap}>
      <Text style={screenStyles.prefix}>+63</Text>
      <TextInput
        keyboardType="phone-pad"
        maxLength={10}
        onChangeText={(value) => onChange(value.replace(/\D/g, ""))}
        placeholder="9XX XXX XXXX"
        placeholderTextColor={palette.outline}
        style={screenStyles.phoneInput}
        value={mobileNumber}
      />
    </View>
  );
}

type LoginTabProps = {
  label: string;
  method: LoginMethod;
  activeMethod: LoginMethod;
  onSelect: (method: LoginMethod) => void;
};

function LoginTab({ label, method, activeMethod, onSelect }: LoginTabProps) {
  const active = method === activeMethod;

  return (
    <Pressable
      accessibilityRole="tab"
      onPress={() => onSelect(method)}
      style={[screenStyles.tabButton, active && screenStyles.tabButtonActive]}
    >
      <Text style={[screenStyles.tabText, active && screenStyles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const screenStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.surface,
    borderBottomColor: "#EDF1EF",
    borderBottomWidth: 1
  },
  brand: {
    color: palette.primary,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800"
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
    color: palette.muted,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700"
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 28,
    alignItems: "center"
  },
  intro: {
    width: "100%",
    maxWidth: 448,
    alignItems: "center",
    marginBottom: 28
  },
  welcome: {
    color: palette.textStrong,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    textAlign: "center"
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    textAlign: "center"
  },
  card: {
    width: "100%",
    maxWidth: 448,
    padding: 24,
    borderRadius: 12,
    backgroundColor: palette.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    gap: 20
  },
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
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center"
  },
  tabTextActive: {
    color: palette.white
  },
  label: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
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
  prefix: {
    color: palette.muted,
    fontSize: 16,
    minWidth: 44,
    paddingLeft: 16,
    paddingRight: 8,
    textAlign: "center"
  },
  phoneInput: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
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
    color: palette.white,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
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
    color: palette.outline,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
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
    color: palette.success,
    fontSize: 12,
    fontWeight: "900"
  },
  sentText: {
    color: palette.success,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6
  },
  otpInput: {
    flex: 1,
    minWidth: 40,
    maxWidth: 52,
    height: 56,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceContainer,
    color: palette.text,
    fontSize: 20,
    fontWeight: "700"
  },
  resendButton: {
    alignSelf: "center",
    paddingVertical: 4
  },
  resendText: {
    color: palette.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
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
    color: palette.outline,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "500"
  },
  nameField: {
    flex: 1,
    gap: 6
  },
  textInput: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: palette.surfaceLow,
    color: palette.text,
    fontSize: 16
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
    color: palette.text,
    fontSize: 16,
    lineHeight: 24,
    flex: 1
  },
  dropdownIcon: {
    color: palette.muted,
    fontSize: 16,
    fontWeight: "800",
    paddingLeft: 12
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: palette.secondary,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    color: palette.white,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
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
    color: palette.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }]
  },
  terms: {
    width: "100%",
    maxWidth: 448,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 20
  },
  link: {
    color: palette.primary,
    fontWeight: "800"
  },
  errorText: {
    color: "#BA1A1A",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
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
    color: palette.outline,
    fontSize: 12,
    fontWeight: "800"
  },
  modeText: {
    color: palette.outline,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center"
  },
  copyright: {
    color: palette.outlineVariant,
    fontSize: 12,
    lineHeight: 16
  },
  modalBackdrop: {
    flex: 1,
    padding: 24,
    backgroundColor: "rgba(24, 28, 28, 0.32)",
    alignItems: "center",
    justifyContent: "center"
  },
  dropdownMenu: {
    width: "100%",
    maxWidth: 448,
    borderRadius: 12,
    padding: 12,
    backgroundColor: palette.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8
  },
  dropdownTitle: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
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
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600"
  },
  dropdownOptionSelected: {
    color: palette.primary,
    fontWeight: "900"
  }
});
