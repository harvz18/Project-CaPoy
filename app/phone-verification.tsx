import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton } from "../src/components/AppButton";
import { AppCard } from "../src/components/AppCard";
import { AppInput } from "../src/components/AppInput";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { AppText as Text } from "../src/components/AppText";
import { useApp } from "../src/context/AppContext";
import { formatPhilippineMobileForInput, normalizePhilippineMobileNumber, normalizeStoredPhilippineMobileNumber, phoneVerificationErrorMessage, removePhilippineMobileLeadingZero } from "../src/domain/phoneVerification";
import {
  completePhoneVerification,
  phoneVerificationRecaptchaContainerId,
  resetPhoneVerification,
  startPhoneVerification
} from "../src/services/phoneVerificationService";
import { canResendOtp, getOtpResendRemainingSeconds, isValidOtpCode, sanitizeOtpInput } from "../src/utils/otp";
import { styles } from "../src/styles";

export function PhoneVerificationContent({
  closeLabel = "Back to Profile",
  onBusyChange,
  onClose
}: {
  closeLabel?: string;
  onBusyChange?: (busy: boolean) => void;
  onClose: () => void;
}) {
  const { currentUser } = useApp();
  const [mobileNumber, setMobileNumber] = useState(() => formatPhilippineMobileForInput(currentUser?.mobileNumber ?? ""));
  const [code, setCode] = useState("");
  const [requestedAt, setRequestedAt] = useState<number>();
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState<"send" | "verify">();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(Boolean(currentUser?.phoneVerified));

  const normalizedProfileNumber = useMemo(
    () => normalizeStoredPhilippineMobileNumber(currentUser?.mobileNumber ?? ""),
    [currentUser?.mobileNumber]
  );
  const resendRemaining = getOtpResendRemainingSeconds(requestedAt, now);
  const canResend = canResendOtp(requestedAt, now);

  useEffect(() => {
    if (!requestedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [requestedAt]);

  useEffect(() => () => resetPhoneVerification(), []);

  useEffect(() => {
    onBusyChange?.(Boolean(loading));
    return () => onBusyChange?.(false);
  }, [loading, onBusyChange]);

  async function requestCode(resend = false) {
    const normalizedNumber = normalizePhilippineMobileNumber(mobileNumber);
    if (!normalizedNumber) {
      setError("Enter a Philippine mobile number as 09XXXXXXXXX or +639XXXXXXXXX.");
      return;
    }
    if (!normalizedProfileNumber || normalizedNumber !== normalizedProfileNumber) {
      setError("For account safety, verify the same mobile number saved on your TaskLink profile.");
      return;
    }

    setLoading("send");
    setError("");
    setMessage("");
    try {
      const result = await startPhoneVerification(normalizedNumber, resend);
      setRequestedAt(Date.now());
      if (result.automaticallyVerifiedCode) setCode(sanitizeOtpInput(result.automaticallyVerifiedCode));
      setMessage(result.automaticallyVerifiedCode
        ? "Your device confirmed the number. Review the code and tap Verify Mobile Number."
        : "Verification code sent. Enter the six-digit code to continue.");
    } catch (requestError) {
      setError(phoneVerificationErrorMessage(requestError));
    } finally {
      setLoading(undefined);
    }
  }

  async function verifyCode() {
    if (!isValidOtpCode(code)) {
      setError("Enter the complete six-digit verification code.");
      return;
    }
    setLoading("verify");
    setError("");
    setMessage("");
    try {
      await completePhoneVerification(code);
      setComplete(true);
      setMessage("Your mobile number has been verified successfully.");
    } catch (verificationError) {
      setError(phoneVerificationErrorMessage(verificationError));
    } finally {
      setLoading(undefined);
    }
  }

  return (
      <AppCard>
        <Text style={styles.subheading}>Secure your TaskLink account</Text>
        <Text style={styles.muted}>Verify the mobile number already saved on your profile. This does not replace your password login or identity-document review.</Text>
        <AppInput
          label="Mobile number"
          value={mobileNumber}
          onChangeText={setMobileNumber}
          onBlur={() => setMobileNumber(removePhilippineMobileLeadingZero(mobileNumber))}
          keyboardType="phone-pad"
          maxLength={18}
          placeholder="0917 123 4567"
          editable={!complete && !loading}
        />
        {typeof phoneVerificationRecaptchaContainerId === "string" ? <View nativeID={phoneVerificationRecaptchaContainerId} style={localStyles.recaptchaContainer} /> : null}
        {complete ? (
          <View style={localStyles.successBox}>
            <Text style={localStyles.successTitle}>Mobile number verified</Text>
            <Text style={localStyles.successText}>This number is confirmed for your existing account.</Text>
            <AppButton title={closeLabel} onPress={onClose} />
          </View>
        ) : (
          <>
            <AppButton
              title={loading === "send" ? "Requesting code..." : requestedAt ? "Send a new code" : "Send OTP"}
              onPress={() => void requestCode(Boolean(requestedAt))}
              disabled={Boolean(loading) || Boolean(requestedAt && !canResend)}
            />
            {requestedAt && !canResend ? <Text style={styles.muted}>You can request another code in {resendRemaining}s.</Text> : null}
            <AppInput
              label="Six-digit verification code"
              value={code}
              onChangeText={(value) => setCode(sanitizeOtpInput(value))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              editable={!loading}
            />
            <AppButton title={loading === "verify" ? "Verifying..." : "Verify Mobile Number"} onPress={() => void verifyCode()} disabled={Boolean(loading) || !requestedAt} />
          </>
        )}
        {message ? <Text accessibilityRole="status" style={localStyles.message}>{message}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
        <Text style={styles.muted}>For account safety, only the mobile number saved on your TaskLink profile can be verified.</Text>
      </AppCard>
  );
}

export default function PhoneVerificationScreen() {
  const router = useRouter();
  return (
    <ScreenContainer scroll>
      <Text style={styles.heading}>Verify Mobile Number</Text>
      <PhoneVerificationContent onClose={() => router.back()} />
    </ScreenContainer>
  );
}

const localStyles = StyleSheet.create({
  recaptchaContainer: { minHeight: 1 },
  successBox: { gap: 12, paddingTop: 4 },
  successTitle: { color: "#059669", fontSize: 16, fontWeight: "900" },
  successText: { color: "#3E4947", fontSize: 14, lineHeight: 20 },
  message: { color: "#005C55", fontSize: 13, lineHeight: 19, fontWeight: "700" }
});
