import Feather from "@expo/vector-icons/Feather";
import { Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  UIManager,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText as Text, AppTextInput as TextInput } from "../src/components/AppText";
import { BacolodBarangayPicker } from "../src/components/BacolodBarangayPicker";
import { workerCapabilities } from "../src/constants/capabilities";
import { useApp } from "../src/context/AppContext";
import { normalizePhilippineMobileNumber, phoneVerificationErrorMessage } from "../src/domain/phoneVerification";
import { pickProfilePhoto, SelectedFile, uploadProfilePhoto } from "../src/services/fileUploadService";
import { phoneLoginRecaptchaContainerId, resetPhoneLogin, startPhoneLogin } from "../src/services/phoneLoginService";
import { checkSmsRegistrationVerification, startSmsRegistrationVerification } from "../src/services/trustedApi";
import { updateUserProfile } from "../src/services/userService";
import { PublicRole, Role } from "../src/types";
import { canResendOtp, getOtpResendRemainingSeconds, isValidOtpCode, sanitizeOtpInput } from "../src/utils/otp";

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
  secondaryContainer: "#FEA619",
  text: "#181C1C",
  textStrong: "#111827",
  muted: "#3E4947",
  outline: "#6E7977",
  outlineVariant: "#BDC9C6",
  success: "#10B981",
  white: "#FFFFFF"
};

type LoginMethod = "verification-code" | "password";

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
  const { actionLoading, clearError, error, login, loginWithVerificationCode, register, usingFirebase } = useApp();
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("verification-code");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpRequestedAt, setOtpRequestedAt] = useState<number>();
  const [otpNow, setOtpNow] = useState(Date.now());
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [registerVisible, setRegisterVisible] = useState(false);
  const [fullName, setFullName] = useState("");
  const [registerMobileNumber, setRegisterMobileNumber] = useState("");
  const [registrationVerificationId, setRegistrationVerificationId] = useState<string>();
  const [registrationOtpCode, setRegistrationOtpCode] = useState("");
  const [registrationOtpRequestedAt, setRegistrationOtpRequestedAt] = useState<number>();
  const [registrationOtpNow, setRegistrationOtpNow] = useState(Date.now());
  const [registrationOtpLoading, setRegistrationOtpLoading] = useState<"send" | "verify">();
  const [registrationNumberVerified, setRegistrationNumberVerified] = useState(false);
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerRole, setRegisterRole] = useState<PublicRole>("client");
  const [registerCapabilities, setRegisterCapabilities] = useState(["Cleaning"]);
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [registerPhoto, setRegisterPhoto] = useState<SelectedFile>();
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [capabilityPickerOpen, setCapabilityPickerOpen] = useState(false);
  const [registerError, setRegisterError] = useState("");

  const resendRemaining = getOtpResendRemainingSeconds(otpRequestedAt, otpNow);
  const canResend = canResendOtp(otpRequestedAt, otpNow);
  const registrationResendRemaining = getOtpResendRemainingSeconds(registrationOtpRequestedAt, registrationOtpNow);
  const canResendRegistrationOtp = canResendOtp(registrationOtpRequestedAt, registrationOtpNow);

  useEffect(() => {
    if (!otpRequestedAt) return;
    const timer = setInterval(() => setOtpNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [otpRequestedAt]);

  useEffect(() => {
    if (!registrationOtpRequestedAt) return;
    const timer = setInterval(() => setRegistrationOtpNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [registrationOtpRequestedAt]);

  useEffect(() => () => resetPhoneLogin(), []);

  function animateNext() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }

  async function handleLogin() {
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

  function changeLoginMethod(method: LoginMethod) {
    clearError();
    setOtpError("");
    setLoginMethod(method);
  }

  async function requestOtp() {
    const normalizedNumber = normalizePhilippineMobileNumber(mobileNumber);
    if (!normalizedNumber) {
      setOtpError("Enter a Philippine mobile number as 09XXXXXXXXX or +639XXXXXXXXX.");
      return;
    }
    if (otpRequestedAt && !canResend) return;

    setOtpLoading(true);
    setOtpError("");
    setOtpMessage("");
    clearError();
    try {
      await startPhoneLogin(normalizedNumber);
      setOtpRequestedAt(Date.now());
      setOtpNow(Date.now());
      setOtpMessage("Verification code sent. Enter the six-digit code to continue.");
    } catch (requestError) {
      setOtpError(phoneVerificationErrorMessage(requestError));
    } finally {
      setOtpLoading(false);
    }
  }

  async function verifyOtpAndLogin() {
    if (!isValidOtpCode(otpCode)) {
      setOtpError("Enter the complete six-digit verification code.");
      return;
    }
    setOtpError("");
    setOtpMessage("");
    try {
      const user = await loginWithVerificationCode(otpCode);
      router.replace(getRoleRoute(user.role));
    } catch {
      // AppContext displays the readable verification error.
    }
  }

  async function handleRegister() {
    if (registerPassword !== confirmPassword) {
      setRegisterError("Passwords do not match.");
      return;
    }
    if (!registrationVerificationId || !registrationNumberVerified) {
      setRegisterError("Verify your mobile number before creating an account.");
      return;
    }
    setRegisterError("");
    try {
      const user = await register({
        role: registerRole,
        fullName,
        mobileNumber: registrationPhoneNumber(registerMobileNumber),
        mobileVerificationId: registrationVerificationId,
        password: registerPassword,
        address: selectedBarangay,
        skills: registerRole === "worker" ? registerCapabilities : [],
        capabilities: registerRole === "worker" ? registerCapabilities : [],
        businessName: registerRole === "client" ? fullName : undefined
      });
      if (registerPhoto) {
        try {
          const uploaded = await uploadProfilePhoto(user.id, registerPhoto);
          await updateUserProfile(user.id, { profilePhotoUrl: uploaded.url });
        } catch (photoError) {
          setRegisterError(photoError instanceof Error ? photoError.message : "Your account was created, but the profile photo could not be uploaded.");
        }
      }
      router.replace(getRoleRoute(registerRole));
    } catch {
      // AppContext exposes the readable error message.
    }
  }

  function changeRegistrationMobileNumber(value: string) {
    setRegisterMobileNumber(value);
    setRegistrationVerificationId(undefined);
    setRegistrationOtpCode("");
    setRegistrationOtpRequestedAt(undefined);
    setRegistrationNumberVerified(false);
    setRegisterError("");
  }

  async function requestRegistrationOtp() {
    const normalizedNumber = normalizePhilippineMobileNumber(registrationPhoneNumber(registerMobileNumber));
    if (!normalizedNumber) {
      setRegisterError("Enter a valid 10-digit Philippine mobile number before requesting a code.");
      return;
    }
    if (registrationOtpRequestedAt && !canResendRegistrationOtp) return;
    setRegistrationOtpLoading("send");
    setRegisterError("");
    try {
      const result = await startSmsRegistrationVerification<{ requestId: string }>(normalizedNumber);
      if (!result.requestId) throw new Error("Unable to request a verification code. Please try again.");
      setRegistrationVerificationId(result.requestId);
      setRegistrationOtpRequestedAt(Date.now());
      setRegistrationOtpNow(Date.now());
      setRegistrationOtpCode("");
      setRegistrationNumberVerified(false);
    } catch (requestError) {
      setRegisterError(phoneVerificationErrorMessage(requestError));
    } finally {
      setRegistrationOtpLoading(undefined);
    }
  }

  async function verifyRegistrationOtp() {
    if (!registrationVerificationId || !isValidOtpCode(registrationOtpCode)) {
      setRegisterError("Enter the complete six-digit verification code.");
      return;
    }
    setRegistrationOtpLoading("verify");
    setRegisterError("");
    try {
      await checkSmsRegistrationVerification<{ requestId: string }>(registrationVerificationId, registrationOtpCode);
      setRegisterError("");
      setRegistrationNumberVerified(true);
    } catch (verificationError) {
      setRegisterError(phoneVerificationErrorMessage(verificationError));
      setRegistrationVerificationId(undefined);
    } finally {
      setRegistrationOtpLoading(undefined);
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

  async function chooseProfilePhoto(source: "camera" | "library") {
    setPhotoPickerOpen(false);
    try {
      const photo = await pickProfilePhoto(source);
      if (photo) setRegisterPhoto(photo);
    } catch (photoError) {
      setRegisterError(photoError instanceof Error ? photoError.message : "Unable to select a profile photo.");
    }
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
        contentContainerStyle={screenStyles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={screenStyles.intro}>
          <Text style={screenStyles.welcome}>Welcome Neighbor</Text>
          <Text style={screenStyles.subtitle}>Quickly connect with local help in your community.</Text>
        </View>

        <View style={screenStyles.card}>
          <Text style={screenStyles.authTitle}>Login</Text>
          <Text style={screenStyles.authNotice}>Employers and taskers use this same login. Your saved account type opens the correct dashboard.</Text>

          <View style={screenStyles.loginMethodTabs}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: loginMethod === "verification-code" }}
              onPress={() => changeLoginMethod("verification-code")}
              style={[screenStyles.loginMethodTab, loginMethod === "verification-code" && screenStyles.loginMethodTabActive]}
            >
              <Text style={[screenStyles.loginMethodTabText, loginMethod === "verification-code" && screenStyles.loginMethodTabTextActive]}>Verification Code Login</Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: loginMethod === "password" }}
              onPress={() => changeLoginMethod("password")}
              style={[screenStyles.loginMethodTab, loginMethod === "password" && screenStyles.loginMethodTabActive]}
            >
              <Text style={[screenStyles.loginMethodTabText, loginMethod === "password" && screenStyles.loginMethodTabTextActive]}>Password Login</Text>
            </Pressable>
          </View>

          <View style={screenStyles.section}>
            <Text style={screenStyles.label}>Mobile Number</Text>
            <LoginMobileNumberInput mobileNumber={mobileNumber} onChange={setMobileNumber} />
          </View>

          {loginMethod === "verification-code" ? (
            <View style={screenStyles.section}>
              {typeof phoneLoginRecaptchaContainerId === "string" ? <View nativeID={phoneLoginRecaptchaContainerId} style={screenStyles.recaptchaContainer} /> : null}
              <Pressable
                accessibilityRole="button"
                disabled={otpLoading || Boolean(otpRequestedAt && !canResend)}
                onPress={() => void requestOtp()}
                style={({ pressed }) => [screenStyles.secondaryButton, (otpLoading || Boolean(otpRequestedAt && !canResend)) && screenStyles.disabledButton, pressed && screenStyles.pressed]}
              >
                <Text style={screenStyles.secondaryButtonText}>{otpLoading ? "Requesting code..." : "Get Code"}</Text>
              </Pressable>
              {otpRequestedAt ? (
                <View style={screenStyles.otpResendRow}>
                  <Text style={screenStyles.otpHint}>Didn't receive the code?</Text>
                  <Pressable accessibilityRole="button" disabled={otpLoading || !canResend} onPress={() => void requestOtp()} style={screenStyles.resendButton}>
                    <Text style={[screenStyles.resendText, (otpLoading || !canResend) && screenStyles.resendTextDisabled]}>{canResend ? "Resend" : `Resend in ${resendRemaining}s`}</Text>
                  </Pressable>
                </View>
              ) : null}
              <Text style={screenStyles.label}>Verification Code</Text>
              <TextInput
                editable={Boolean(otpRequestedAt) && !otpLoading && !actionLoading}
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(value) => setOtpCode(sanitizeOtpInput(value))}
                placeholder="Enter 6-digit code"
                placeholderTextColor={palette.outline}
                style={screenStyles.textInput}
                value={otpCode}
              />
              <Pressable
                accessibilityRole="button"
                disabled={!otpRequestedAt || otpLoading || actionLoading}
                onPress={() => void verifyOtpAndLogin()}
                style={({ pressed }) => [screenStyles.primaryButton, (!otpRequestedAt || otpLoading || actionLoading) && screenStyles.disabledButton, pressed && screenStyles.pressed]}
              >
                <Text style={screenStyles.primaryButtonText}>{actionLoading ? "Verifying..." : "Verify & Continue"}</Text>
              </Pressable>
              {otpMessage ? <Text accessibilityRole="status" style={screenStyles.otpMessage}>{otpMessage}</Text> : null}
              {otpError ? <Text accessibilityRole="alert" style={screenStyles.errorText}>{otpError}</Text> : null}
              {error ? <Text accessibilityRole="alert" style={screenStyles.errorText}>{error}</Text> : null}
              <Text style={screenStyles.otpHint}>Use Password Login first if this mobile number has not yet been verified from your profile.</Text>
            </View>
          ) : (
            <View style={screenStyles.section}>
              <PasswordField label="Password" onChangeText={setPassword} placeholder="Enter your password" value={password} />
              <Pressable
                accessibilityRole="button"
                disabled={actionLoading}
                onPress={handleLogin}
                style={({ pressed }) => [screenStyles.secondaryButton, actionLoading && screenStyles.disabledButton, pressed && screenStyles.pressed]}
              >
                <Text style={screenStyles.secondaryButtonText}>{actionLoading ? "Logging in..." : "Login"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push("/recover-account" as Href)} style={screenStyles.resendButton}>
                <Text style={screenStyles.resendText}>Forgot password? Use an email reset link</Text>
              </Pressable>
              {error ? <Text accessibilityRole="alert" style={screenStyles.errorText}>{error}</Text> : null}
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
                <Pressable accessibilityLabel="Choose profile photo" accessibilityRole="button" onPress={() => setPhotoPickerOpen(true)} style={screenStyles.avatarButton}>
                  {registerPhoto ? <Image source={{ uri: registerPhoto.uri }} style={screenStyles.avatarImage} /> : <Text style={screenStyles.avatarIcon}>{fullName.trim()[0]?.toUpperCase() ?? "U"}</Text>}
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

              <Text style={screenStyles.label}>Create Account As</Text>
              <View style={screenStyles.tabRow}>
                {([
                  { label: "Employer", role: "client" },
                  { label: "Tasker", role: "worker" }
                ] as const).map((option) => {
                  const selected = registerRole === option.role;
                  return (
                    <Pressable
                      accessibilityRole="button"
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
              <View style={screenStyles.registrationPhoneRow}>
                <View style={screenStyles.registrationPhoneField}>
                  <PhoneInput
                    editable={!registrationNumberVerified && !registrationOtpLoading}
                    mobileNumber={registerMobileNumber}
                    onChange={changeRegistrationMobileNumber}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(registrationOtpLoading) || registrationNumberVerified || Boolean(registrationOtpRequestedAt && !canResendRegistrationOtp)}
                  onPress={() => void requestRegistrationOtp()}
                  style={({ pressed }) => [
                    screenStyles.verifyNumberButton,
                    (registrationOtpLoading || registrationNumberVerified || Boolean(registrationOtpRequestedAt && !canResendRegistrationOtp)) && screenStyles.disabledButton,
                    pressed && screenStyles.pressed
                  ]}
                >
                  <Text style={screenStyles.verifyNumberButtonText}>
                    {registrationNumberVerified ? "Verified" : registrationOtpLoading === "send" ? "Sending..." : registrationOtpRequestedAt ? "Send again" : "Verify"}
                  </Text>
                </Pressable>
              </View>
              {registrationNumberVerified ? (
                <Text accessibilityRole="status" style={screenStyles.registrationVerifiedText}>✓ Mobile number verified</Text>
              ) : registrationVerificationId ? (
                <View style={screenStyles.registrationOtpBlock}>
                  <Text style={screenStyles.label}>Enter six-digit code</Text>
                  <View style={screenStyles.registrationOtpRow}>
                    <TextInput
                      editable={!registrationOtpLoading}
                      keyboardType="number-pad"
                      maxLength={6}
                      onChangeText={(value) => setRegistrationOtpCode(sanitizeOtpInput(value))}
                      placeholder="123456"
                      placeholderTextColor={palette.outline}
                      style={screenStyles.registrationOtpInput}
                      value={registrationOtpCode}
                    />
                    <Pressable
                      accessibilityRole="button"
                      disabled={registrationOtpLoading === "verify" || !isValidOtpCode(registrationOtpCode)}
                      onPress={() => void verifyRegistrationOtp()}
                      style={({ pressed }) => [
                        screenStyles.verifyCodeButton,
                        (registrationOtpLoading === "verify" || !isValidOtpCode(registrationOtpCode)) && screenStyles.disabledButton,
                        pressed && screenStyles.pressed
                      ]}
                    >
                      <Text style={screenStyles.verifyCodeButtonText}>{registrationOtpLoading === "verify" ? "Checking..." : "Confirm"}</Text>
                    </Pressable>
                  </View>
                  {!canResendRegistrationOtp ? <Text style={screenStyles.otpHint}>You can request another code in {registrationResendRemaining}s.</Text> : null}
                </View>
              ) : <Text style={screenStyles.otpHint}>Verification is required before creating an account.</Text>}

              <BacolodBarangayPicker label="Barangay" value={selectedBarangay} onChange={setSelectedBarangay} />

              <PasswordField label="Create Password" onChangeText={setRegisterPassword} placeholder="Create password" value={registerPassword} />
              <PasswordField label="Confirm Password" onChangeText={setConfirmPassword} placeholder="Re-enter password" value={confirmPassword} />

              {registerRole === "worker" ? (
                <>
                  <Text style={screenStyles.label}>Capabilities</Text>
                  <Pressable accessibilityRole="button" onPress={() => setCapabilityPickerOpen(true)} style={screenStyles.dropdownButton}><Text style={screenStyles.dropdownText}>{registerCapabilities.length ? `${registerCapabilities.length} selected` : "Choose capabilities"}</Text><Feather accessibilityElementsHidden color={palette.primary} name="chevron-right" size={20} /></Pressable>
                </>
              ) : null}

              {registerError ? <Text accessibilityRole="alert" style={screenStyles.errorText}>{registerError}</Text> : null}

              <Pressable
                accessibilityRole="button"
                disabled={actionLoading || !registrationNumberVerified}
                onPress={handleRegister}
                style={({ pressed }) => [screenStyles.primaryButton, (actionLoading || !registrationNumberVerified) && screenStyles.disabledButton, pressed && screenStyles.pressed]}
              >
                <Text style={screenStyles.primaryButtonText}>
                  {actionLoading ? "Creating Account..." : `Create ${registerRole === "client" ? "Employer" : "Tasker"} Account`}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={screenStyles.termsBlock}>
          <Text style={screenStyles.terms}>By signing in, you agree to the beta terms and privacy notice.</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push("/help" as Href)}>
            <Text style={screenStyles.link}>Read terms, privacy, limitations, and support</Text>
          </Pressable>
        </View>

        <View style={screenStyles.footer}>
          <Text style={screenStyles.modeText}>TaskLink records payment evidence but does not process or escrow funds.</Text>
          <Text style={screenStyles.modeText}>
            Data mode: {usingFirebase ? "Firebase backend" : "Firebase not configured"}
          </Text>
          <Text style={screenStyles.copyright}>(c) 2026 TASKLINK Philippines</Text>
        </View>
      </ScrollView>

      <Modal animationType="slide" transparent visible={photoPickerOpen} onRequestClose={() => setPhotoPickerOpen(false)}><Pressable style={screenStyles.modalBackdrop} onPress={() => setPhotoPickerOpen(false)}><View style={screenStyles.actionSheet}><Text style={screenStyles.dropdownTitle}>Profile Photo</Text><Pressable accessibilityRole="button" onPress={() => void chooseProfilePhoto("camera")} style={screenStyles.dropdownOption}><Text style={screenStyles.dropdownOptionText}>Take a photo</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void chooseProfilePhoto("library")} style={screenStyles.dropdownOption}><Text style={screenStyles.dropdownOptionText}>Choose from gallery</Text></Pressable></View></Pressable></Modal>
      <Modal animationType="slide" transparent visible={capabilityPickerOpen} onRequestClose={() => setCapabilityPickerOpen(false)}><View style={screenStyles.modalBackdrop}><View style={screenStyles.capabilitySheet}><View style={screenStyles.codeHeader}><Text style={screenStyles.dropdownTitle}>Capabilities</Text><Pressable accessibilityRole="button" onPress={() => setCapabilityPickerOpen(false)} style={screenStyles.resendButton}><Text style={screenStyles.resendText}>Done</Text></Pressable></View>{workerCapabilities.map((capability) => { const selected = registerCapabilities.includes(capability); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} key={capability} onPress={() => toggleCapability(capability)} style={screenStyles.capabilityOption}><View style={[screenStyles.checkbox, selected && screenStyles.checkboxSelected]}>{selected ? <Text style={screenStyles.checkboxMark}>✓</Text> : null}</View><Text style={screenStyles.capabilityOptionText}>{capability}</Text></Pressable>; })}</View></View></Modal>
    </SafeAreaView>
  );
}

type PhoneInputProps = {
  mobileNumber: string;
  onChange: (value: string) => void;
  editable?: boolean;
};

/** Login accepts both canonical Philippine formats without changing the legacy registration control. */
function LoginMobileNumberInput({ mobileNumber, onChange }: PhoneInputProps) {
  return (
    <TextInput
      keyboardType="phone-pad"
      maxLength={18}
      onChangeText={(value) => onChange(value.replace(/[^\d+\s()-]/g, ""))}
      placeholder="09XX XXX XXXX"
      placeholderTextColor={palette.outline}
      style={screenStyles.textInput}
      value={mobileNumber}
    />
  );
}

function PhoneInput({ mobileNumber, onChange, editable = true }: PhoneInputProps) {
  return (
    <View style={screenStyles.phoneInputWrap}>
      <View style={screenStyles.prefixWrap}>
        <Text allowFontScaling={false} style={screenStyles.prefix}>
          +63
        </Text>
      </View>
      <TextInput
        editable={editable}
        keyboardType="phone-pad"
        maxLength={11}
        onBlur={() => onChange(mobileNumber.replace(/^0(?=9\d{9}$)/, ""))}
        onChangeText={(value) => onChange(value.replace(/\D/g, ""))}
        placeholder="917 000 0001"
        placeholderTextColor={palette.outline}
        style={screenStyles.phoneInput}
        value={mobileNumber}
      />
    </View>
  );
}

/** The registration field sits after a visible +63 prefix, but accepts the familiar 09XXXXXXXXX entry form. */
function registrationPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return `+63${digits.startsWith("0") ? digits.slice(1) : digits}`;
}

type PasswordFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
};

function PasswordField({ label, value, onChangeText, placeholder }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={screenStyles.passwordField}>
      <Text style={screenStyles.label}>{label}</Text>
      <View style={screenStyles.passwordInputWrap}>
        <TextInput
          accessibilityLabel={label}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.outline}
          secureTextEntry={!visible}
          style={screenStyles.passwordInput}
          value={value}
        />
        <Pressable
          accessibilityLabel={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          accessibilityRole="button"
          onPress={() => setVisible((current) => !current)}
          style={screenStyles.passwordVisibilityButton}
        >
          <Feather accessibilityElementsHidden color={palette.muted} name={visible ? "eye-off" : "eye"} size={20} />
        </Pressable>
      </View>
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
  backgroundLinkBar: { width: 80, height: 28, marginHorizontal: -10, borderRadius: 14, backgroundColor: "#9CF2E8" },
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
  authTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  authNotice: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  loginMethodTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: palette.outlineVariant
  },
  loginMethodTab: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
    paddingHorizontal: 4
  },
  loginMethodTabActive: { borderBottomColor: palette.primary },
  loginMethodTabText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "center"
  },
  loginMethodTabTextActive: { color: palette.primary },
  section: {
    gap: 14
  },
  recaptchaContainer: { minHeight: 1 },
  otpResendRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  otpHint: { color: palette.muted, fontSize: 12, lineHeight: 17, textAlign: "center" },
  otpMessage: { color: palette.primary, fontSize: 13, lineHeight: 18, fontWeight: "700" },
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
  prefixWrap: {
    width: 56,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  prefix: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: "700",
    includeFontPadding: false,
    textAlign: "center"
  },
  phoneInput: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
    minHeight: 52,
    paddingRight: 16
  },
  registrationPhoneRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  registrationPhoneField: { flex: 1, minWidth: 0 },
  verifyNumberButton: {
    minWidth: 116,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: palette.primary
  },
  verifyNumberButtonText: { color: palette.white, fontSize: 12, lineHeight: 16, fontWeight: "800", textAlign: "center" },
  registrationOtpBlock: { gap: 8, paddingTop: 2 },
  registrationOtpRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  registrationOtpInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: palette.surfaceLow,
    color: palette.text,
    fontSize: 16,
    letterSpacing: 2
  },
  verifyCodeButton: {
    minWidth: 94,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: palette.primary
  },
  verifyCodeButtonText: { color: palette.white, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  registrationVerifiedText: { color: palette.success, fontSize: 13, lineHeight: 18, fontWeight: "800" },
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
  resendTextDisabled: { color: palette.outline },
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
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30
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
  passwordField: {
    gap: 6
  },
  passwordInputWrap: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: palette.surfaceLow,
    flexDirection: "row",
    alignItems: "center"
  },
  passwordInput: {
    flex: 1,
    minHeight: 48,
    paddingLeft: 16,
    paddingRight: 4,
    color: palette.text,
    fontSize: 16
  },
  passwordVisibilityButton: {
    width: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center"
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
  disabledButton: { opacity: 0.5 },
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
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
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
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  },
  capabilityTextSelected: {
    color: palette.white
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }]
  },
  termsBlock: { alignItems: "center", gap: 6 },
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
  actionSheet: {
    width: "100%",
    maxWidth: 448,
    borderRadius: 12,
    padding: 12,
    backgroundColor: palette.surface
  },
  capabilitySheet: {
    width: "100%",
    maxWidth: 448,
    maxHeight: "80%",
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: palette.surface
  },
  capabilityOption: {
    minHeight: 48,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  capabilityOptionText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700"
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: palette.outline,
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  checkboxMark: {
    color: palette.white,
    fontSize: 15,
    fontWeight: "900"
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
