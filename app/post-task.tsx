import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { workerCapabilities } from "../src/constants/capabilities";
import { useApp } from "../src/context/AppContext";
import { PaymentMethod } from "../src/types";
import { parseCoordinate } from "../src/utils/location";

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

const categories = ["Delivery assistance", "Basic repair", "Cleaning"];
const durations = ["1 Hour", "2 Hours", "Half Day", "Whole Day"];
const serviceAreaPresets = [
  { label: "Downtown", address: "Downtown Bacolod", latitude: "10.6765", longitude: "122.9509", left: "48%" as const, top: "44%" as const },
  { label: "Mandalagan", address: "Barangay Mandalagan, Bacolod City", latitude: "10.7012", longitude: "122.9663", left: "64%" as const, top: "26%" as const },
  { label: "Alijis", address: "Barangay Alijis, Bacolod City", latitude: "10.6426", longitude: "122.9338", left: "30%" as const, top: "68%" as const },
  { label: "Taculing", address: "Barangay Taculing, Bacolod City", latitude: "10.6556", longitude: "122.9557", left: "55%" as const, top: "62%" as const }
];
const radiusOptions = [
  { label: "Nearby", value: "300", helper: "Same street or nearby block" },
  { label: "Barangay", value: "500", helper: "Good for most local tasks" },
  { label: "Wide area", value: "1000", helper: "Allows workers a little farther away" }
];

export default function PostTaskScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { actionLoading, createTask, error } = useApp();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Delivery assistance");
  const [location, setLocation] = useState("Bacolod City");
  const [latitude, setLatitude] = useState("10.6765");
  const [longitude, setLongitude] = useState("122.9509");
  const [geofenceRadius, setGeofenceRadius] = useState("500");
  const [requiredCapability, setRequiredCapability] = useState("Delivery assistance");
  const [wage, setWage] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("2 Hours");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [mapOpen, setMapOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const selectedServiceArea =
    serviceAreaPresets.find((preset) => preset.latitude === latitude && preset.longitude === longitude) ??
    serviceAreaPresets[0];
  const radiusScale = getRadiusScale(geofenceRadius);

  function selectServiceArea(preset: (typeof serviceAreaPresets)[number]) {
    setLocation(preset.address);
    setLatitude(preset.latitude);
    setLongitude(preset.longitude);
    if (preset.label === "Downtown") {
      setGeofenceRadius("1000");
    }
  }

  function selectCategory(nextCategory: string) {
    setCategory(nextCategory);
    setRequiredCapability(nextCategory);
    setCategoryOpen(false);
  }

  async function handlePostTask() {
    try {
      const task = await createTask({
        title: title || "Manual labor task",
        description: description || "Short-term task in Bacolod City.",
        category,
        location,
        locationAddress: location,
        latitude: parseCoordinate(latitude),
        longitude: parseCoordinate(longitude),
        geofenceRadius: Number(geofenceRadius) || 500,
        requiredCapability,
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

        <View style={styles.formCard}>
          <Field label="Task Category">
            <Pressable
              accessibilityRole="button"
              onPress={() => setCategoryOpen(true)}
              style={({ pressed }) => [styles.selectButton, pressed && styles.pressed]}
            >
              <Text style={styles.selectValue}>{category}</Text>
              <Text style={styles.selectChevron}>v</Text>
            </Pressable>
          </Field>

          <Field label="Task Title">
            <TextInput
              onChangeText={setTitle}
              placeholder="e.g. Move furniture to 2nd floor"
              placeholderTextColor={palette.outline}
              style={styles.input}
              value={title}
            />
          </Field>

          <Field label="Location & Service Area">
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
            <View style={styles.serviceAreaCard}>
              <View style={styles.serviceAreaHeader}>
                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>Client-centered worker radius</Text>
                  <Text style={styles.helperText}>This location is the center of the service area check before workers start or finish.</Text>
                </View>
              </View>

              <Pressable
                accessibilityLabel="Open map pin setter"
                accessibilityRole="button"
                onPress={() => setMapOpen(true)}
                style={styles.pinMap}
              >
                <View style={styles.pinMapRoadOne} />
                <View style={styles.pinMapRoadTwo} />
                <View style={styles.pinMapRoadThree} />
                <View style={styles.pinMapPark} />
                <View style={[styles.radiusRing, getRadiusRingStyle(radiusScale, 120)]} />
                <View style={styles.centerPin}>
                  <Text style={styles.centerPinText}>Client</Text>
                </View>
                <View style={styles.mapCallout}>
                  <Text style={styles.mapCalloutLabel}>Radius center</Text>
                  <Text style={styles.mapCalloutTitle}>{selectedServiceArea.label}</Text>
                </View>
                <View style={styles.openMapBadge}>
                  <Text style={styles.openMapBadgeText}>Open map</Text>
                </View>
              </Pressable>

              <View style={styles.areaPresetGrid}>
                {serviceAreaPresets.map((preset) => {
                  const selected = latitude === preset.latitude && longitude === preset.longitude;
                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() => selectServiceArea(preset)}
                      style={[styles.areaPresetChip, selected && styles.areaPresetChipSelected]}
                    >
                      <Text style={[styles.areaPresetText, selected && styles.areaPresetTextSelected]}>{preset.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.radiusGrid}>
                {radiusOptions.map((option) => {
                  const selected = geofenceRadius === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setGeofenceRadius(option.value)}
                      style={[styles.radiusCard, selected && styles.radiusCardSelected]}
                    >
                      <Text style={[styles.radiusTitle, selected && styles.radiusTitleSelected]}>{option.label}</Text>
                      <Text style={[styles.radiusValue, selected && styles.radiusValueSelected]}>{option.value} m</Text>
                      <Text style={[styles.radiusHelper, selected && styles.radiusHelperSelected]}>{option.helper}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.coordinateSummary}>
                <View style={styles.flex}>
                  <Text style={styles.coordinateLabel}>Pinned task area</Text>
                  <Text style={styles.coordinateAddress}>{selectedServiceArea.address}</Text>
                </View>
                <Text style={styles.coordinateValue}>{latitude}, {longitude}</Text>
              </View>
            </View>
          </Field>

          <Field label="Required Capability">
            <View style={styles.capabilityGrid}>
              {workerCapabilities.map((capability) => {
                const selected = requiredCapability === capability;
                return (
                  <Pressable
                    key={capability}
                    onPress={() => {
                      setRequiredCapability(capability);
                      setCategory(capability);
                    }}
                    style={[styles.capabilityChip, selected && styles.capabilityChipSelected]}
                  >
                    <Text style={[styles.capabilityText, selected && styles.capabilityTextSelected]}>{capability}</Text>
                  </Pressable>
                );
              })}
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
              <Pressable
                accessibilityRole="button"
                onPress={() => setDurationOpen(true)}
                style={({ pressed }) => [styles.selectButton, pressed && styles.pressed]}
              >
                <Text style={styles.selectValue}>{estimatedDuration}</Text>
                <Text style={styles.selectChevron}>v</Text>
              </Pressable>
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

      <Modal animationType="slide" visible={mapOpen} onRequestClose={() => setMapOpen(false)}>
        <SafeAreaView style={styles.mapModalSafeArea} edges={["top", "left", "right"]}>
          <View style={styles.mapModalHeader}>
            <View>
              <Text style={styles.mapModalTitle}>Set Task Pin</Text>
              <Text style={styles.mapModalSubtitle}>The client location is the center of the worker radius.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setMapOpen(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.mapModalBody}>
            <View style={styles.largePinMap}>
              <View style={styles.largeRoadOne} />
              <View style={styles.largeRoadTwo} />
              <View style={styles.largeRoadThree} />
              <View style={styles.largePark} />
              <View style={[styles.largeRadiusRing, getRadiusRingStyle(radiusScale, 220)]} />
              <View style={styles.largeCenterPin}>
                <Text style={styles.largeCenterPinText}>Client</Text>
              </View>
              <View style={styles.largeMapCallout}>
                <Text style={styles.mapCalloutLabel}>Radius center</Text>
                <Text style={styles.mapCalloutTitle}>{selectedServiceArea.label}</Text>
                <Text style={styles.largeMapMeta}>{geofenceRadius} meters</Text>
              </View>
            </View>

            <View style={styles.modalPanel}>
              <Text style={styles.fieldLabel}>Choose pin location</Text>
              <View style={styles.areaPresetGrid}>
                {serviceAreaPresets.map((preset) => {
                  const selected = latitude === preset.latitude && longitude === preset.longitude;
                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() => selectServiceArea(preset)}
                      style={[styles.areaPresetChip, selected && styles.areaPresetChipSelected]}
                    >
                      <Text style={[styles.areaPresetText, selected && styles.areaPresetTextSelected]}>{preset.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.modalPanel}>
              <Text style={styles.fieldLabel}>Worker check radius</Text>
              <View style={styles.radiusGrid}>
                {radiusOptions.map((option) => {
                  const selected = geofenceRadius === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setGeofenceRadius(option.value)}
                      style={[styles.radiusCard, selected && styles.radiusCardSelected]}
                    >
                      <Text style={[styles.radiusTitle, selected && styles.radiusTitleSelected]}>{option.label}</Text>
                      <Text style={[styles.radiusValue, selected && styles.radiusValueSelected]}>{option.value} m</Text>
                      <Text style={[styles.radiusHelper, selected && styles.radiusHelperSelected]}>{option.helper}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <PickerModal
        options={categories}
        selectedValue={category}
        title="Task Category"
        visible={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        onSelect={selectCategory}
      />

      <PickerModal
        options={durations}
        selectedValue={estimatedDuration}
        title="Duration"
        visible={durationOpen}
        onClose={() => setDurationOpen(false)}
        onSelect={(duration) => {
          setEstimatedDuration(duration);
          setDurationOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function PickerModal({
  options,
  selectedValue,
  title,
  visible,
  onClose,
  onSelect
}: {
  options: string[];
  selectedValue: string;
  title: string;
  visible: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>{title}</Text>
          {options.map((option) => {
            const selected = selectedValue === option;
            return (
              <Pressable
                accessibilityRole="button"
                key={option}
                onPress={() => onSelect(option)}
                style={[styles.pickerOption, selected && styles.pickerOptionSelected]}
              >
                <Text style={[styles.pickerOptionText, selected && styles.pickerOptionTextSelected]}>{option}</Text>
                {selected ? <Text style={styles.pickerCheck}>OK</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

function getRadiusScale(radius: string) {
  switch (radius) {
    case "300":
      return 0.75;
    case "1000":
      return 1.25;
    default:
      return 1;
  }
}

function getRadiusRingStyle(scale: number, baseSize: number) {
  const size = baseSize * scale;

  return {
    width: size,
    height: size,
    marginLeft: -size / 2,
    marginTop: -size / 2,
    borderRadius: size / 2
  };
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
  selectButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  selectValue: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: "800", flex: 1 },
  selectChevron: { color: palette.primary, fontSize: 14, lineHeight: 20, fontWeight: "900" },
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
  paymentRow: { flexDirection: "row", gap: 8 },
  capabilityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  capabilityChip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  capabilityChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  capabilityText: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  capabilityTextSelected: { color: palette.white },
  serviceAreaCard: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, gap: 12 },
  serviceAreaHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  pinMap: {
    height: 184,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: "#E5F1EE",
    overflow: "hidden"
  },
  pinMapRoadOne: { position: "absolute", left: -28, right: -28, top: 84, height: 18, backgroundColor: "#C8DBD7", transform: [{ rotate: "-12deg" }] },
  pinMapRoadTwo: { position: "absolute", top: -24, bottom: -24, left: "58%", width: 18, backgroundColor: "#D6C29E", transform: [{ rotate: "18deg" }] },
  pinMapRoadThree: { position: "absolute", left: "18%", top: -20, bottom: -20, width: 12, backgroundColor: "#D9E5E2", transform: [{ rotate: "-28deg" }] },
  pinMapPark: { position: "absolute", right: 18, top: 18, width: 82, height: 54, borderRadius: 18, backgroundColor: "#CDE7CE" },
  radiusRing: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 120,
    height: 120,
    marginLeft: -60,
    marginTop: -60,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "rgba(0,92,85,0.22)",
    backgroundColor: "rgba(0,92,85,0.06)"
  },
  centerPin: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 52,
    height: 52,
    marginLeft: -26,
    marginTop: -26,
    borderRadius: 26,
    borderWidth: 4,
    borderColor: palette.white,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5
  },
  centerPinText: { color: palette.white, fontSize: 10, lineHeight: 14, fontWeight: "900" },
  mapPinButton: {
    position: "absolute",
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: palette.white,
    backgroundColor: palette.secondary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4
  },
  mapPinButtonSelected: {
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    borderRadius: 22,
    backgroundColor: palette.primary
  },
  mapPinButtonText: { color: palette.white, fontSize: 9, lineHeight: 12, fontWeight: "900" },
  mapPinButtonTextSelected: { color: palette.white },
  openMapBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: palette.primary
  },
  openMapBadgeText: { color: palette.white, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  mapCallout: {
    position: "absolute",
    left: 12,
    bottom: 12,
    maxWidth: "72%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(189,201,198,0.75)",
    backgroundColor: "rgba(255,255,255,0.94)",
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  mapCalloutLabel: { color: palette.muted, fontSize: 10, lineHeight: 14, fontWeight: "800", textTransform: "uppercase" },
  mapCalloutTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  areaPresetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  areaPresetChip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  areaPresetChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  areaPresetText: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  areaPresetTextSelected: { color: palette.white },
  radiusGrid: { gap: 8 },
  radiusCard: { minHeight: 68, borderRadius: 10, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, padding: 12 },
  radiusCardSelected: { borderColor: palette.primary, backgroundColor: "#E5F1EE" },
  radiusTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  radiusTitleSelected: { color: palette.primary },
  radiusValue: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: "900", marginTop: 2 },
  radiusValueSelected: { color: palette.primary },
  radiusHelper: { color: palette.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  radiusHelperSelected: { color: palette.text },
  coordinateSummary: { borderRadius: 8, padding: 10, backgroundColor: palette.surfaceLow, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  coordinateLabel: { color: palette.muted, fontSize: 11, lineHeight: 14, fontWeight: "800" },
  coordinateAddress: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: "900", marginTop: 2 },
  coordinateValue: { color: palette.text, fontSize: 11, lineHeight: 14, fontWeight: "900", flexShrink: 0 },
  paymentChip: { flex: 1, minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" },
  paymentChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  paymentText: { color: palette.muted, fontSize: 14, fontWeight: "800" },
  paymentTextSelected: { color: palette.white },
  textArea: { minHeight: 96, paddingTop: 12 },
  helperText: { color: palette.muted, fontSize: 12, lineHeight: 16 },
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
  mapModalSafeArea: { flex: 1, backgroundColor: palette.background },
  mapModalHeader: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1EF",
    backgroundColor: palette.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  mapModalTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  mapModalSubtitle: { color: palette.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  modalCloseButton: { minHeight: 40, borderRadius: 20, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  modalCloseText: { color: palette.white, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  mapModalBody: { flex: 1, padding: 16, gap: 12 },
  largePinMap: {
    flex: 1,
    minHeight: 300,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: "#E5F1EE",
    overflow: "hidden"
  },
  largeRoadOne: { position: "absolute", left: -40, right: -40, top: "48%", height: 24, backgroundColor: "#C8DBD7", transform: [{ rotate: "-12deg" }] },
  largeRoadTwo: { position: "absolute", top: -40, bottom: -40, left: "58%", width: 24, backgroundColor: "#D6C29E", transform: [{ rotate: "18deg" }] },
  largeRoadThree: { position: "absolute", top: -24, bottom: -24, left: "22%", width: 16, backgroundColor: "#D9E5E2", transform: [{ rotate: "-28deg" }] },
  largePark: { position: "absolute", right: 24, top: 24, width: 108, height: 76, borderRadius: 24, backgroundColor: "#CDE7CE" },
  largeRadiusRing: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 220,
    height: 220,
    marginLeft: -110,
    marginTop: -110,
    borderRadius: 110,
    borderWidth: 3,
    borderColor: "rgba(0,92,85,0.25)",
    backgroundColor: "rgba(0,92,85,0.08)"
  },
  largeCenterPin: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 68,
    height: 68,
    marginLeft: -34,
    marginTop: -34,
    borderRadius: 34,
    borderWidth: 5,
    borderColor: palette.white,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8
  },
  largeCenterPinText: { color: palette.white, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  largeMapCallout: {
    position: "absolute",
    left: 16,
    bottom: 16,
    maxWidth: "76%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(189,201,198,0.75)",
    backgroundColor: "rgba(255,255,255,0.94)",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  largeMapMeta: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: "900", marginTop: 2 },
  modalPanel: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, gap: 10 },
  pickerBackdrop: { flex: 1, padding: 24, backgroundColor: "rgba(24,28,28,0.32)", alignItems: "center", justifyContent: "center" },
  pickerSheet: { width: "100%", maxWidth: 420, borderRadius: 12, padding: 12, backgroundColor: palette.surface, gap: 4 },
  pickerTitle: { color: palette.textStrong, fontSize: 16, lineHeight: 24, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 8 },
  pickerOption: { minHeight: 48, borderRadius: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pickerOptionSelected: { backgroundColor: "#E5F1EE" },
  pickerOptionText: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: "700", flex: 1 },
  pickerOptionTextSelected: { color: palette.primary, fontWeight: "900" },
  pickerCheck: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
