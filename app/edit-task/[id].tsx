import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../../src/components/AppText";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { DateTimePickerSheet, formatFriendlyDate, formatLocalDate, formatLocalDateTime, parseLocalDate, parseLocalDateTime } from "../../src/components/DateTimePickerSheet";
import LocationMap from "../../src/components/LocationMap";
import { getDefaultCapabilityForCategory, taskCategories, workerCapabilities } from "../../src/constants/capabilities";
import { useApp } from "../../src/context/AppContext";
import { durationToMilliseconds } from "../../src/domain/taskMarketplace";
import { canEditTaskTerms, getTaskTerms, hasPendingTaskChange } from "../../src/domain/taskTerms";
import { useTasklinkBack } from "../../src/hooks/useTasklinkBack";
import { DurationUnit, PricingMode, ScheduleMode, TaskTerms } from "../../src/types";
import { sanitizeDurationInput, sanitizeMoneyInput } from "../../src/utils/numericInput";

const palette = { background: "#F7FAF8", surface: "#FFFFFF", primary: "#005C55", text: "#181C1C", muted: "#3E4947", outline: "#6E7977", line: "#D9E2DF", white: "#FFFFFF", warning: "#855300" };
const units: DurationUnit[] = ["hour", "day", "week", "month"];

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useTasklinkBack();
  const insets = useSafeAreaInsets();
  const { actionLoading, currentUser, tasks, updateTaskTerms } = useApp();
  const task = tasks.find((item) => item.id === id);
  const initial = useMemo(() => task ? getTaskTerms(task) : undefined, [task]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Other");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [locationAddress, setLocationAddress] = useState(initial?.locationAddress ?? "");
  const [latitude, setLatitude] = useState(initial?.latitude);
  const [longitude, setLongitude] = useState(initial?.longitude);
  const [geofenceRadius, setGeofenceRadius] = useState(String(initial?.geofenceRadius ?? 500));
  const [requiredCapabilities, setRequiredCapabilities] = useState(initial?.requiredCapabilities?.length ? initial.requiredCapabilities : [initial?.requiredCapability ?? category]);
  const [wage, setWage] = useState(initial?.wage ?? "");
  const [pricingMode, setPricingMode] = useState<PricingMode>(initial?.pricingMode ?? "fixed");
  const [durationValue, setDurationValue] = useState(String(initial?.durationValue ?? 1));
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(initial?.durationUnit ?? "day");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(initial?.scheduleMode ?? "fixed");
  const [scheduleStart, setScheduleStart] = useState(initial?.scheduleStart ? formatLocalDateTime(new Date(initial.scheduleStart)) : "");
  const [scheduleDate, setScheduleDate] = useState(initial?.scheduleDate ?? "");
  const [perksText, setPerksText] = useState((initial?.perks ?? []).join(", "));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const initializedTaskId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!task || !initial || initializedTaskId.current === task.id) return;
    initializedTaskId.current = task.id;
    setTitle(initial.title); setDescription(initial.description); setCategory(initial.category); setLocation(initial.location);
    setLocationAddress(initial.locationAddress ?? ""); setLatitude(initial.latitude); setLongitude(initial.longitude);
    setGeofenceRadius(String(initial.geofenceRadius ?? 500));
    setRequiredCapabilities(initial.requiredCapabilities?.length ? initial.requiredCapabilities : [initial.requiredCapability ?? initial.category]);
    setWage(initial.wage); setPricingMode(initial.pricingMode ?? "fixed"); setDurationValue(String(initial.durationValue ?? 1));
    setDurationUnit(initial.durationUnit ?? "day"); setScheduleMode(initial.scheduleMode ?? "fixed");
    setScheduleStart(initial.scheduleStart ? formatLocalDateTime(new Date(initial.scheduleStart)) : ""); setScheduleDate(initial.scheduleDate ?? "");
    setPerksText((initial.perks ?? []).join(", "));
  }, [initial, task]);

  if (!task || !initial || !currentUser || currentUser.role !== "client" || !canEditTaskTerms(task, currentUser.id)) {
    return <SafeAreaView style={styles.safe}><TopBar onBack={goBack} /><View style={styles.empty}><Text style={styles.title}>This task cannot be edited</Text><Text style={styles.helper}>Only its employer may edit an open task or propose changes before an assigned tasker begins work.</Text></View></SafeAreaView>;
  }
  if (hasPendingTaskChange(task)) {
    return <SafeAreaView style={styles.safe}><TopBar onBack={goBack} /><View style={styles.empty}><Text style={styles.title}>Changes awaiting review</Text><Text style={styles.helper}>Wait for the assigned tasker to accept or decline the current request before proposing another one.</Text></View></SafeAreaView>;
  }

  const editableTaskId = task.id;
  const mapCenter = latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined;
  const assigned = Boolean(task.workerId);
  function toggleCapability(capability: string) {
    setRequiredCapabilities((current) => current.includes(capability)
      ? current.length === 1 ? current : current.filter((item) => item !== capability)
      : current.length >= 3 ? current : [...current, capability]);
  }
  function selectCategory(value: string) {
    setCategory(value);
    setRequiredCapabilities((current) => current.length <= 1 ? [getDefaultCapabilityForCategory(value)] : current);
  }
  function selectPin(point: { latitude: number; longitude: number }) {
    setLatitude(point.latitude); setLongitude(point.longitude);
  }
  async function save() {
    try {
      setError("");
      const value = Number(durationValue);
      const start = scheduleMode === "fixed" ? parseLocalDateTime(scheduleStart) : undefined;
      const terms: TaskTerms = {
        ...initial, title: title.trim(), description: description.trim(), category, location: location.trim(),
        locationAddress: locationAddress.trim() || location.trim(), latitude, longitude, geofenceRadius: Number(geofenceRadius),
        locationCapturedAt: new Date().toISOString(), locationSource: "map", requiredCapability: requiredCapabilities[0], requiredCapabilities,
        wage: pricingMode === "fixed" ? wage.trim() : "", pricingMode, durationValue: value, durationUnit,
        estimatedDuration: `${value} ${value === 1 ? durationUnit : `${durationUnit}s`}`,
        scheduleMode, scheduleDate: scheduleMode === "anytime" ? scheduleDate : undefined,
        scheduleStart: start?.toISOString(), scheduleEnd: start ? new Date(start.getTime() + durationToMilliseconds(value, durationUnit)).toISOString() : undefined,
        perks: perksText.split(",").map((item) => item.trim()).filter(Boolean)
      };
      await updateTaskTerms(editableTaskId, terms);
      router.replace(`/task/${editableTaskId}`);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save task changes."); }
  }

  return <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
    <TopBar onBack={goBack} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 110 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <View style={styles.notice}><Feather color={palette.warning} name={assigned ? "shield" : "edit-3"} size={20} /><View style={styles.flex}><Text style={styles.noticeTitle}>{assigned ? "Changes need tasker approval" : "Update your posted task"}</Text><Text style={styles.noticeText}>{assigned ? "The current agreement stays active until the assigned tasker accepts these proposed terms." : "Active applicants will receive one notification with the details that changed."}</Text></View></View>
      <Field label="Task title"><TextInput accessibilityLabel="Task title" onChangeText={setTitle} style={styles.input} value={title} /></Field>
      <Field label="Description"><TextInput accessibilityLabel="Task description" multiline onChangeText={setDescription} style={[styles.input, styles.textArea]} textAlignVertical="top" value={description} /></Field>
      <Field label="Category"><View style={styles.chips}>{taskCategories.map((item) => <Choice key={item} selected={category === item} text={item} onPress={() => selectCategory(item)} />)}</View></Field>
      <Field label="Landmark"><TextInput accessibilityLabel="Task landmark" onChangeText={setLocation} style={styles.input} value={location} /></Field>
      <Field label="Exact address"><TextInput accessibilityLabel="Exact task address" multiline onChangeText={setLocationAddress} placeholder="Street, barangay, city" placeholderTextColor={palette.outline} style={[styles.input, styles.textArea]} textAlignVertical="top" value={locationAddress} /></Field>
      <Field label="Task pin and worker radius"><LocationMap center={mapCenter} height={250} interactive markers={mapCenter ? [{ id: "task-pin", ...mapCenter, title: "Task pin" }] : []} onSelectCoordinate={selectPin} radiusMeters={Number(geofenceRadius) || 500} /><Text style={styles.helper}>Tap or drag the marker to correct the task pin.</Text><View style={styles.chips}>{[300, 500, 1000].map((value) => <Choice key={value} selected={geofenceRadius === String(value)} text={`${value} m`} onPress={() => setGeofenceRadius(String(value))} />)}</View></Field>
      <Field label="Required capabilities (1–3)"><View style={styles.chips}>{workerCapabilities.map((item) => <Choice key={item} selected={requiredCapabilities.includes(item)} text={item} onPress={() => toggleCapability(item)} />)}</View></Field>
      <Field label="Pricing"><View style={styles.chips}>{(["fixed", "bidding"] as PricingMode[]).map((item) => <Choice key={item} selected={pricingMode === item} text={item === "fixed" ? "Fixed price" : "Open to offers"} onPress={() => setPricingMode(item)} />)}</View>{pricingMode === "fixed" ? <TextInput accessibilityLabel="Task budget" keyboardType="decimal-pad" onChangeText={(value) => setWage(sanitizeMoneyInput(value))} placeholder="Budget in pesos" placeholderTextColor={palette.outline} style={styles.input} value={wage} /> : <Text style={styles.helper}>Changing pricing does not change an already accepted amount unless the tasker approves this request.</Text>}</Field>
      <Field label="Duration"><View style={styles.chips}>{units.map((item) => <Choice key={item} selected={durationUnit === item} text={item} onPress={() => setDurationUnit(item)} />)}</View><TextInput accessibilityLabel="Task duration" keyboardType="number-pad" onChangeText={(value) => setDurationValue(sanitizeDurationInput(value))} style={styles.input} value={durationValue} /></Field>
      <Field label="Schedule"><View style={styles.chips}>{(["fixed", "anytime"] as ScheduleMode[]).map((item) => <Choice key={item} selected={scheduleMode === item} text={item === "fixed" ? "Specific time" : "Anytime"} onPress={() => setScheduleMode(item)} />)}</View><Pressable accessibilityRole="button" onPress={() => setPickerOpen(true)} style={styles.dateButton}><Feather color={palette.primary} name="calendar" size={19} /><Text style={styles.dateText}>{scheduleMode === "anytime" ? (scheduleDate ? formatFriendlyDate(parseLocalDate(scheduleDate) ?? new Date(), "date") : "Choose a date") : (scheduleStart ? formatFriendlyDate(parseLocalDateTime(scheduleStart) ?? new Date()) : "Choose date and time")}</Text></Pressable></Field>
      <Field label="Special offers"><TextInput accessibilityLabel="Special offers" onChangeText={setPerksText} placeholder="Lunch, transportation allowance" placeholderTextColor={palette.outline} style={styles.input} value={perksText} /><Text style={styles.helper}>Separate offers with commas; these do not change the payment method.</Text></Field>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}><Pressable accessibilityRole="button" disabled={actionLoading} onPress={save} style={[styles.save, actionLoading && styles.disabled]}><Text style={styles.saveText}>{actionLoading ? "Saving..." : assigned ? "Send for tasker review" : "Save task changes"}</Text></Pressable></View>
    <DateTimePickerSheet visible={pickerOpen} title={scheduleMode === "anytime" ? "Choose flexible date" : "Choose task start"} mode={scheduleMode === "anytime" ? "date" : "datetime"} minimumDate={new Date()} value={scheduleMode === "anytime" ? parseLocalDate(scheduleDate) : parseLocalDateTime(scheduleStart)} onClose={() => setPickerOpen(false)} onConfirm={(value) => { if (scheduleMode === "anytime") setScheduleDate(formatLocalDate(value)); else setScheduleStart(formatLocalDateTime(value)); setPickerOpen(false); }} />
  </SafeAreaView>;
}

function TopBar({ onBack }: { onBack: () => void }) { return <View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={onBack} style={styles.back}><Feather color={palette.primary} name="arrow-left" size={22} /></Pressable><Text style={styles.headerTitle}>Edit Task</Text></View>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }
function Choice({ text, selected, onPress }: { text: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{text}</Text></Pressable>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background }, content: { padding: 16, gap: 16 }, header: { minHeight: 60, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.line }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 }, headerTitle: { color: palette.text, fontSize: 19, fontWeight: "900" }, empty: { flex: 1, padding: 24, justifyContent: "center", gap: 8 }, title: { color: palette.text, fontSize: 22, fontWeight: "900" }, notice: { padding: 14, borderRadius: 14, gap: 10, flexDirection: "row", backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FED7AA" }, flex: { flex: 1 }, noticeTitle: { color: "#7C2D12", fontWeight: "900", fontSize: 15 }, noticeText: { color: "#7C2D12", marginTop: 3, fontSize: 13, lineHeight: 18 }, field: { gap: 8, padding: 14, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }, label: { color: palette.text, fontWeight: "900", fontSize: 14 }, input: { minHeight: 48, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.line, color: palette.text, fontSize: 15, backgroundColor: palette.white }, textArea: { minHeight: 92, paddingTop: 12 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { minHeight: 36, paddingHorizontal: 11, justifyContent: "center", borderRadius: 18, backgroundColor: "#EEF2F0", borderWidth: 1, borderColor: palette.line }, choiceSelected: { backgroundColor: palette.primary, borderColor: palette.primary }, choiceText: { color: palette.muted, fontSize: 12, fontWeight: "800" }, choiceTextSelected: { color: palette.white }, helper: { color: palette.muted, fontSize: 12, lineHeight: 17 }, dateButton: { minHeight: 50, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, backgroundColor: "#F1F7F5" }, dateText: { color: palette.primary, fontWeight: "800" }, error: { color: "#BA1A1A", fontWeight: "800" }, footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.line }, save: { minHeight: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary }, disabled: { opacity: 0.55 }, saveText: { color: palette.white, fontWeight: "900", fontSize: 15 }
});
