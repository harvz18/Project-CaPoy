import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { hasSupportEmail, supportContactLabel, supportEmail } from "../src/config/support";

const sections = [
  {
    title: "Beta limitations",
    body: "TaskLink is a beta coordination tool. It does not provide emergency response, insurance, escrow, guaranteed payment, guaranteed work, or continuous cross-user location tracking. SMS OTP and remote push require additional production setup."
  },
  {
    title: "Location and permissions",
    body: "Foreground location is requested only after a location action. Discovery may use a saved manual point. Starting and finishing work require a fresh, sufficiently accurate device reading inside the task radius. The foreground moving marker remains on the tasker's device and is not continuously shared with the client."
  },
  {
    title: "Payments",
    body: "TaskLink records participant-confirmed payment status. It does not transfer, hold, settle, or escrow money. The free web demo uses COD so both participants can complete the payment-confirmation flow without paid file storage."
  },
  {
    title: "Connectivity",
    body: "Authentication, tasks, chat, notifications, and status changes require Firebase connectivity. Document uploads are paused in the free web demo. Do not repeat a mutation immediately after an uncertain network failure; first refresh and check the current task state."
  },
  {
    title: "Privacy and retention",
    body: "Private profiles may contain phone number, address, location, and verification references. Public profiles omit those private fields. Identity, payment, notification, audit, and aggregate records follow the beta retention policy documented with the project; automated expiry is not active while trusted scheduled Functions remain undeployed."
  },
  {
    title: "Tester responsibility",
    body: "Use test accounts and non-sensitive evidence where possible. Verify the participant, task, amount, location radius, and status before acting. Report defects with the time, account role, task ID, device/API version, and steps to reproduce—never include passwords or service-account keys."
  }
];

export default function HelpScreen() {
  const router = useRouter();

  async function contactSupport() {
    if (!hasSupportEmail) return;
    await Linking.openURL(`mailto:${supportEmail}?subject=${encodeURIComponent("TaskLink beta support")}`);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.brand}>TASKLINK</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>BETA INFORMATION</Text>
        <Text style={styles.title}>Terms, privacy, and support</Text>
        <Text style={styles.intro}>This page states what the current beta does and does not do. It is operational guidance, not a substitute for a reviewed production privacy policy or legal terms.</Text>

        {sections.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.cardTitle}>{section.title}</Text>
            <Text style={styles.cardBody}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.supportCard}>
          <Text style={styles.cardTitle}>Beta support contact</Text>
          <Text selectable style={styles.contact}>{supportContactLabel()}</Text>
          <Text style={styles.cardBody}>{hasSupportEmail ? "Include your role and reproduction steps. Do not send passwords or private keys." : "For this controlled demo, report issues directly to the project coordinator who provided your test account."}</Text>
          {hasSupportEmail ? <Pressable accessibilityRole="link" onPress={() => void contactSupport()} style={styles.contactButton}>
            <Text style={styles.contactButtonText}>Email Beta Support</Text>
          </Pressable> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7FAF8" },
  header: { minHeight: 56, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", backgroundColor: "#FFFFFF" },
  backButton: { minWidth: 48, minHeight: 44, alignItems: "center", justifyContent: "center" },
  backText: { color: "#005C55", fontSize: 13, lineHeight: 18, fontWeight: "900" },
  brand: { color: "#005C55", fontSize: 20, lineHeight: 28, fontWeight: "900" },
  headerSpacer: { width: 48 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 16, paddingBottom: 40, gap: 12 },
  eyebrow: { color: "#005C55", fontSize: 12, lineHeight: 16, fontWeight: "900" },
  title: { color: "#111827", fontSize: 28, lineHeight: 36, fontWeight: "900" },
  intro: { color: "#3E4947", fontSize: 15, lineHeight: 22 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#BDC9C6", backgroundColor: "#FFFFFF", gap: 6 },
  supportCard: { padding: 18, borderRadius: 12, borderWidth: 1, borderColor: "#9CF2E8", backgroundColor: "#EAF8F1", gap: 8 },
  cardTitle: { color: "#181C1C", fontSize: 17, lineHeight: 24, fontWeight: "900" },
  cardBody: { color: "#3E4947", fontSize: 14, lineHeight: 21 },
  contact: { color: "#005C55", fontSize: 15, lineHeight: 22, fontWeight: "900" },
  contactButton: { minHeight: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#005C55", paddingHorizontal: 14, marginTop: 4 },
  contactButtonText: { color: "#FFFFFF", fontSize: 14, lineHeight: 20, fontWeight: "900", textAlign: "center" },
  disabled: { opacity: 0.5 }
});
