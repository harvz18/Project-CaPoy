import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText as Text } from "../src/components/AppText";
import { getEmailVerificationState, refreshCurrentEmailVerification, sendCurrentEmailVerification, type EmailVerificationState } from "../src/services/authService";
import { getOtpResendRemainingSeconds } from "../src/utils/otp";

const palette = { background: "#F7FAF8", surface: "#FFFFFF", primary: "#005C55", text: "#181C1C", muted: "#3E4947", outline: "#BDC9C6", white: "#FFFFFF", success: "#157347", danger: "#B42318" };

export default function VerifyEmailScreen() {
  const router = useRouter();
  const [state, setState] = useState<EmailVerificationState>(() => getEmailVerificationState());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestedAt, setRequestedAt] = useState<number>();
  const [now, setNow] = useState(Date.now());
  const remainingSeconds = getOtpResendRemainingSeconds(requestedAt, now);

  useEffect(() => {
    void checkStatus();
  }, []);

  useEffect(() => {
    if (!remainingSeconds) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [remainingSeconds]);

  async function checkStatus() {
    setBusy(true);
    setError("");
    try {
      const nextState = await refreshCurrentEmailVerification();
      setState(nextState);
      setMessage(nextState.verified ? "Email verified by Firebase. You can continue using TaskLink." : "Not verified yet. Open the Firebase verification email, then return here and check again.");
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "Unable to check email verification.");
    } finally {
      setBusy(false);
    }
  }

  async function sendVerification() {
    if (remainingSeconds > 0) return;
    setBusy(true);
    setError("");
    try {
      await sendCurrentEmailVerification();
      setRequestedAt(Date.now());
      setNow(Date.now());
      setMessage("Verification email sent. Check your inbox and spam folder, open the link, then return here.");
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "Unable to send verification email.");
    } finally {
      setBusy(false);
    }
  }

  const unsupported = !state.available;
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Email verification</Text>
          {unsupported ? (
            <>
              <Text style={styles.body}>This account uses a mobile number and password. TaskLink has not configured real SMS verification, and its generated sign-in alias cannot receive email.</Text>
              <Text style={styles.body}>Your phone number remains unverified. We will not display a fake code field or mark this account verified.</Text>
            </>
          ) : (
            <>
              <Text style={styles.body}>Firebase will send a verification link to {state.email}. This is an email link, not a six-digit OTP.</Text>
              <Text style={[styles.status, state.verified && styles.statusVerified]}>{state.verified ? "Verified" : "Awaiting verification"}</Text>
              {!state.verified ? <Pressable accessibilityRole="button" disabled={busy || remainingSeconds > 0} onPress={() => void sendVerification()} style={[styles.primaryButton, (busy || remainingSeconds > 0) && styles.disabled]}><Text style={styles.primaryText}>{busy ? "Working..." : remainingSeconds ? `Resend in ${remainingSeconds}s` : requestedAt ? "Resend verification email" : "Send verification email"}</Text></Pressable> : null}
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void checkStatus()} style={[styles.secondaryButton, busy && styles.disabled]}><Text style={styles.secondaryText}>{busy ? "Checking..." : "I've verified my email"}</Text></Pressable>
            </>
          )}
          {message ? <Text accessibilityRole="status" style={styles.message}>{message}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Back</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background }, content: { flexGrow: 1, justifyContent: "center", padding: 20 }, card: { backgroundColor: palette.surface, borderColor: palette.outline, borderRadius: 14, borderWidth: 1, gap: 14, maxWidth: 520, padding: 22, width: "100%", alignSelf: "center" }, title: { color: palette.text, fontSize: 24, fontWeight: "900", lineHeight: 32 }, body: { color: palette.muted, fontSize: 15, lineHeight: 22 }, status: { alignSelf: "flex-start", backgroundColor: "#FFF4E5", borderRadius: 999, color: "#8A4B00", fontSize: 12, fontWeight: "900", paddingHorizontal: 12, paddingVertical: 7 }, statusVerified: { backgroundColor: "#E8F7EE", color: palette.success }, primaryButton: { alignItems: "center", backgroundColor: palette.primary, borderRadius: 9, justifyContent: "center", minHeight: 48, paddingHorizontal: 14 }, primaryText: { color: palette.white, fontSize: 14, fontWeight: "900" }, secondaryButton: { alignItems: "center", borderColor: palette.primary, borderRadius: 9, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 14 }, secondaryText: { color: palette.primary, fontSize: 14, fontWeight: "900" }, backButton: { alignItems: "center", minHeight: 42, justifyContent: "center" }, backText: { color: palette.primary, fontSize: 14, fontWeight: "900" }, message: { color: palette.success, fontSize: 13, fontWeight: "700", lineHeight: 19 }, error: { color: palette.danger, fontSize: 13, fontWeight: "700", lineHeight: 19 }, disabled: { opacity: 0.55 }
});
