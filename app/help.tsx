import Feather from "@expo/vector-icons/Feather";
import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { hasSupportEmail, supportContactLabel, supportEmail } from "../src/config/support";
import { useTasklinkBack } from "../src/hooks/useTasklinkBack";

const faqs = [
  ["What is TaskLink?", "TaskLink helps employers post local tasks and lets taskers find, apply for, and complete them through an agreed workflow."],
  ["How do I post a task?", "Employers can use Post Task from the home screen, enter the task details, schedule, location, price, and payment method, then publish it to the job board."],
  ["How do I apply for a task?", "Taskers can browse Jobs, open a task, and apply. For bidding tasks, enter a valid offer first. The employer chooses an applicant."],
  ["How does bidding work?", "For bidding tasks, taskers submit an offer. The employer reviews applicants and the selected offer becomes the agreed amount for that task."],
  ["How does a tasker get accepted?", "The employer selects an active applicant. The selected tasker is notified and the task becomes Accepted."],
  ["How do task schedules work?", "A task has a planned schedule and duration. These support planning and availability; they do not prevent a tasker from submitting completed work early after the task has started."],
  ["Can a tasker finish a task early?", "Yes. After starting and passing the required location check, the assigned tasker can submit the work for employer approval. The agreed amount is not automatically changed."],
  ["How do I view active tasks?", "Employers see ongoing jobs on their home screen. Taskers see active applications and assignments on Worker Home, and can open each task for its current status."],
  ["How do ratings and feedback work?", "After a task is finished, participants can open its rating screen and leave feedback. Ratings are available only after completion."],
  ["How does user verification work?", "TaskLink records verification documents and routes them for authorized administrator review. A verification state is shown on the related profile or workflow."],
  ["How do I cancel a task?", "Employers can cancel open tasks. Before TaskLink records a task start, either assigned participant can cancel with a reason. After work starts, contact the project coordinator for assistance."],
  ["How do payments work?", "TaskLink records payment evidence and confirmation; it does not transfer, hold, settle, or escrow money. Cash requires participant confirmation. GCash receipt evidence requires administrator review before completion can be confirmed."],
] as const;

export default function HelpScreen() {
  const goBack = useTasklinkBack();
  const [search, setSearch] = useState("");
  const [openQuestion, setOpenQuestion] = useState<string | null>(faqs[0][0]);
  const visibleFaqs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? faqs.filter(([question, answer]) => `${question} ${answer}`.toLowerCase().includes(term)) : faqs;
  }, [search]);
  async function contactSupport() {
    if (hasSupportEmail) await Linking.openURL(`mailto:${supportEmail}?subject=${encodeURIComponent("TaskLink beta support")}`);
  }
  return <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.backButton}><Feather accessibilityElementsHidden color="#00C9B3" name="arrow-left" size={22} /></Pressable>
      <Text style={styles.brand}>TASKLINK</Text><View style={styles.headerSpacer} />
    </View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>HELP CENTER</Text><Text style={styles.title}>Frequently asked questions</Text>
      <Text style={styles.intro}>Quick answers based on the features currently available in TaskLink.</Text>
      <TextInput accessibilityLabel="Search frequently asked questions" onChangeText={setSearch} placeholder="Search questions" placeholderTextColor="#92B2C0" style={styles.search} value={search} />
      <View style={styles.faqList}>{visibleFaqs.map(([question, answer]) => {
        const expanded = openQuestion === question;
        return <View key={question} style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setOpenQuestion(expanded ? null : question)} style={styles.question}>
            <Text style={styles.questionText}>{question}</Text><Feather accessibilityElementsHidden color="#00C9B3" name={expanded ? "chevron-up" : "chevron-down"} size={22} />
          </Pressable>
          {expanded ? <Text style={styles.answer}>{answer}</Text> : null}
        </View>;
      })}{!visibleFaqs.length ? <Text style={styles.empty}>No help topics match that search.</Text> : null}</View>
      <View style={styles.supportCard}>
        <Text style={styles.cardTitle}>Need more help?</Text><Text selectable style={styles.contact}>{supportContactLabel()}</Text>
        <Text style={styles.answer}>Do not send passwords, private keys, or sensitive documents in a support message.</Text>
        {hasSupportEmail ? <Pressable accessibilityRole="link" onPress={() => void contactSupport()} style={styles.contactButton}><Text style={styles.contactButtonText}>Email Beta Support</Text></Pressable> : null}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#042D40" }, header: { minHeight: 56, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(207, 249, 255, 0.24)", backgroundColor: "rgba(91, 169, 188, 0.18)" }, backButton: { minWidth: 48, minHeight: 44, alignItems: "center", justifyContent: "center" }, backText: { color: "#00C9B3", fontSize: 13, lineHeight: 18, fontWeight: "900" }, brand: { color: "#00C9B3", fontSize: 20, lineHeight: 28, fontWeight: "900" }, headerSpacer: { width: 48 }, content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 16, paddingBottom: 40, gap: 12 }, eyebrow: { color: "#00C9B3", fontSize: 12, lineHeight: 16, fontWeight: "900" }, title: { color: "#F5FCFF", fontSize: 28, lineHeight: 36, fontWeight: "900" }, intro: { color: "#BBD5DE", fontSize: 15, lineHeight: 22 }, search: { minHeight: 48, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: "rgba(207, 249, 255, 0.28)", backgroundColor: "rgba(91, 169, 188, 0.18)", color: "#F5FCFF", fontSize: 15 }, faqList: { gap: 10 }, card: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(207, 249, 255, 0.28)", backgroundColor: "rgba(91, 169, 188, 0.18)", overflow: "hidden" }, question: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }, questionText: { flex: 1, color: "#F5FCFF", fontSize: 16, lineHeight: 22, fontWeight: "800" }, chevron: { color: "#00C9B3", fontSize: 24, lineHeight: 26, fontWeight: "700" }, answer: { color: "#BBD5DE", fontSize: 14, lineHeight: 21, paddingHorizontal: 16, paddingBottom: 16 }, empty: { color: "#BBD5DE", textAlign: "center", paddingVertical: 18 }, supportCard: { padding: 18, borderRadius: 12, borderWidth: 1, borderColor: "#5DF7F2", backgroundColor: "rgba(38, 229, 178, 0.16)", gap: 8 }, cardTitle: { color: "#F5FCFF", fontSize: 17, lineHeight: 24, fontWeight: "900" }, contact: { color: "#00C9B3", fontSize: 15, lineHeight: 22, fontWeight: "900" }, contactButton: { minHeight: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#00C9B3", paddingHorizontal: 14, marginTop: 4 }, contactButtonText: { color: "#FFFFFF", fontSize: 14, lineHeight: 20, fontWeight: "900", textAlign: "center" }
});
