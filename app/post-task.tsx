import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../src/context/AppContext";
import { PaymentMethod } from "../src/types";

const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceLow: "#F1F4F3",
  surfaceContainer: "#EBEFED",
  primary: "#005C55",
  secondary: "#855300",
  secondaryFixed: "#FFDDB8",
  text: "#181C1C",
  textStrong: "#111827",
  muted: "#3E4947",
  outline: "#6E7977",
  outlineVariant: "#BDC9C6",
  white: "#FFFFFF"
};

const categories = ["Delivery", "Repair", "Cleaning"];
const durations = ["1 Hour", "2 Hours", "Half Day", "Whole Day"];

export default function PostTaskScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { actionLoading, createTask, error } = useApp();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Delivery");
  const [location, setLocation] = useState("Bacolod City");
  const [wage, setWage] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("2 Hours");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");

  async function handlePostTask() {
    try {
      const task = await createTask({
        title: title || "Manual labor task",
        description: description || "Short-term task in Bacolod City.",
        category,
        location,
        wage: wage || "300",
        estimatedDuration,
        paymentMethod
      });
      router.replace(`/task/${task.id}`);
    } catch {
      // AppContext exposes the readable error message.
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
            <Text style={styles.closeText}>x</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Post a Task</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>M</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 116 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.heroTitle}>Need a hand?</Text>
          <Text style={styles.heroText}>Describe what you need help with and find a neighbor to help you today.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Task Category</Text>
          <View style={styles.categoryGrid}>
            {categories.map((item) => {
              const selected = category === item;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[styles.categoryCard, selected && styles.categoryCardSelected]}
                >
                  <Text style={[styles.categoryIcon, selected && styles.categorySelectedText]}>{item[0]}</Text>
                  <Text style={[styles.categoryText, selected && styles.categorySelectedText]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.formCard}>
          <Field label="Task Title">
            <TextInput
              onChangeText={setTitle}
              placeholder="e.g. Move furniture to 2nd floor"
              placeholderTextColor={palette.outline}
              style={styles.input}
              value={title}
            />
          </Field>

          <Field label="Location">
            <View style={styles.locationInputWrap}>
              <Text style={styles.locationIcon}>•</Text>
              <TextInput
                onChangeText={setLocation}
                placeholder="Enter your address"
                placeholderTextColor={palette.outline}
                style={styles.locationInput}
                value={location}
              />
            </View>
            <View style={styles.mapPreview}>
              <View style={styles.mapRoadOne} />
              <View style={styles.mapRoadTwo} />
              <View style={styles.mapPin} />
            </View>
          </Field>

          <View style={styles.twoColumn}>
            <Field label="Wage Offer (P)" style={styles.flex}>
              <TextInput
                keyboardType="numeric"
                onChangeText={setWage}
                placeholder="500"
                placeholderTextColor={palette.outline}
                style={styles.input}
                value={wage}
              />
            </Field>

            <Field label="Duration" style={styles.flex}>
              <View style={styles.durationGrid}>
                {durations.map((duration) => (
                  <Pressable
                    key={duration}
                    onPress={() => setEstimatedDuration(duration)}
                    style={[styles.durationChip, estimatedDuration === duration && styles.durationChipSelected]}
                  >
                    <Text style={[styles.durationText, estimatedDuration === duration && styles.durationTextSelected]}>
                      {duration}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>
          </View>

          <Field label="Payment Method">
            <View style={styles.paymentRow}>
              {(["COD", "GCash link"] as PaymentMethod[]).map((method) => (
                <Pressable
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  style={[styles.paymentChip, paymentMethod === method && styles.paymentChipSelected]}
                >
                  <Text style={[styles.paymentText, paymentMethod === method && styles.paymentTextSelected]}>{method}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Additional Notes (Optional)">
            <TextInput
              multiline
              onChangeText={setDescription}
              placeholder="Provide more details for your neighbor..."
              placeholderTextColor={palette.outline}
              style={[styles.input, styles.textArea]}
              textAlignVertical="top"
              value={description}
            />
          </Field>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipIcon}>i</Text>
          <View style={styles.flex}>
            <Text style={styles.tipTitle}>Reliability Tip</Text>
            <Text style={styles.tipText}>Providing clear details and a fair wage helps you find a helper faster.</Text>
          </View>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.bottomAction, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          accessibilityRole="button"
          onPress={handlePostTask}
          style={({ pressed }) => [styles.postButton, pressed && styles.pressed]}
        >
          <Text style={styles.postButtonText}>{actionLoading ? "Posting..." : "Post Job Now"}</Text>
          <Text style={styles.postButtonText}>Send</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1EF"
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  closeButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  closeText: { color: palette.muted, fontSize: 22, fontWeight: "800" },
  headerTitle: { color: palette.primary, fontSize: 20, lineHeight: 28, fontWeight: "800" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceContainer,
    borderWidth: 1,
    borderColor: palette.outlineVariant
  },
  avatarText: { color: palette.secondary, fontWeight: "900" },
  content: { padding: 16, paddingTop: 24, gap: 12 },
  heroTitle: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  heroText: { color: palette.muted, fontSize: 16, lineHeight: 24, marginTop: 4 },
  section: { paddingTop: 8 },
  sectionLabel: { color: palette.muted, fontSize: 14, lineHeight: 20, fontWeight: "800", marginBottom: 12 },
  categoryGrid: { flexDirection: "row", gap: 8 },
  categoryCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  categoryCardSelected: { borderWidth: 2, borderColor: palette.primary },
  categoryIcon: { color: palette.muted, fontSize: 20, fontWeight: "900" },
  categoryText: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  categorySelectedText: { color: palette.primary },
  formCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(189,201,198,0.35)",
    backgroundColor: palette.surfaceLow,
    gap: 12
  },
  field: { gap: 6 },
  fieldLabel: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surface,
    color: palette.text,
    fontSize: 16,
    paddingHorizontal: 14
  },
  locationInputWrap: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surface,
    flexDirection: "row",
    alignItems: "center"
  },
  locationIcon: { color: palette.primary, fontSize: 24, paddingLeft: 12 },
  locationInput: { flex: 1, minHeight: 48, color: palette.text, fontSize: 16, paddingHorizontal: 8 },
  mapPreview: {
    height: 128,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: "#E5F1EE",
    overflow: "hidden",
    marginTop: 8
  },
  mapRoadOne: { position: "absolute", left: -18, right: -18, top: 58, height: 14, backgroundColor: "#C8DBD7", transform: [{ rotate: "-12deg" }] },
  mapRoadTwo: { position: "absolute", top: -12, bottom: -12, left: "58%", width: 16, backgroundColor: "#D6C29E", transform: [{ rotate: "18deg" }] },
  mapPin: { position: "absolute", left: "48%", top: 50, width: 20, height: 20, borderRadius: 10, backgroundColor: palette.primary, borderWidth: 4, borderColor: palette.white },
  twoColumn: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  durationGrid: { gap: 6 },
  durationChip: { minHeight: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.surface },
  durationChipSelected: { backgroundColor: palette.primary },
  durationText: { color: palette.muted, fontSize: 12, fontWeight: "800" },
  durationTextSelected: { color: palette.white },
  paymentRow: { flexDirection: "row", gap: 8 },
  paymentChip: { flex: 1, minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" },
  paymentChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  paymentText: { color: palette.muted, fontSize: 14, fontWeight: "800" },
  paymentTextSelected: { color: palette.white },
  textArea: { minHeight: 96, paddingTop: 12 },
  tipCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.secondaryFixed, backgroundColor: "#FFF8EE", flexDirection: "row", gap: 8 },
  tipIcon: { color: palette.secondary, fontSize: 18, fontWeight: "900" },
  tipTitle: { color: "#2A1700", fontSize: 14, fontWeight: "900" },
  tipText: { color: "#653E00", fontSize: 12, lineHeight: 16 },
  errorText: { color: "#BA1A1A", fontSize: 12, lineHeight: 16, fontWeight: "700" },
  bottomAction: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: palette.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 12
  },
  postButton: { minHeight: 48, borderRadius: 8, backgroundColor: palette.primary, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  postButtonText: { color: palette.white, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
