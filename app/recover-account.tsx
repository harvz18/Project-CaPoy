import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText as Text, AppTextInput as TextInput } from "../src/components/AppText";
import { requestPasswordResetForEmail } from "../src/services/authService";

export default function RecoverAccountScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function requestReset() {
    setBusy(true); setError(""); setMessage("");
    try { await requestPasswordResetForEmail(email); setMessage("If an account uses this email, Firebase sent a password-reset link. Check your inbox and spam folder."); }
    catch (resetError) { setError(resetError instanceof Error ? resetError.message : "Unable to request a reset link."); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}><View style={styles.card}><Text style={styles.title}>Recover account</Text><Text style={styles.body}>Enter the real email address used by an email-based TaskLink account. Mobile-password accounts do not have a deliverable email reset address.</Text><TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="you@example.com" style={styles.input} value={email} /><Pressable accessibilityRole="button" disabled={busy} onPress={() => void requestReset()} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? "Sending..." : "Send reset link"}</Text></Pressable>{message ? <Text accessibilityRole="status" style={styles.message}>{message}</Text> : null}{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>Back to login</Text></Pressable></View></SafeAreaView>;
}
const styles = StyleSheet.create({ safeArea: { flex: 1, alignItems: "center", backgroundColor: "#F7FAF8", justifyContent: "center", padding: 20 }, card: { backgroundColor: "#FFFFFF", borderColor: "#BDC9C6", borderRadius: 14, borderWidth: 1, gap: 14, maxWidth: 520, padding: 22, width: "100%" }, title: { color: "#181C1C", fontSize: 24, fontWeight: "900" }, body: { color: "#3E4947", fontSize: 15, lineHeight: 22 }, input: { backgroundColor: "#F1F4F3", borderColor: "#BDC9C6", borderRadius: 8, borderWidth: 1, color: "#181C1C", minHeight: 48, paddingHorizontal: 12 }, primary: { alignItems: "center", backgroundColor: "#005C55", borderRadius: 8, justifyContent: "center", minHeight: 48 }, primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" }, message: { color: "#157347", fontSize: 13, fontWeight: "700", lineHeight: 19 }, error: { color: "#B42318", fontSize: 13, fontWeight: "700", lineHeight: 19 }, back: { alignItems: "center", minHeight: 42, justifyContent: "center" }, backText: { color: "#005C55", fontSize: 14, fontWeight: "900" }, disabled: { opacity: 0.55 } });
