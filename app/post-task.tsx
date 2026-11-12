import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedBottomNav } from "../src/components/AnimatedBottomNav";
import {
  DateTimePickerSheet,
  formatFriendlyDate,
  formatLocalDate,
  formatLocalDateTime,
  parseLocalDate,
  parseLocalDateTime
} from "../src/components/DateTimePickerSheet";
import LocationMap from "../src/components/LocationMap";
import { taskCategories, workerCapabilities } from "../src/constants/capabilities";
import { useApp } from "../src/context/AppContext";
import { useTasklinkBack } from "../src/hooks/useTasklinkBack";
import { captureForegroundLocation } from "../src/services/locationService";
import { DurationUnit, PaymentMethod, PricingMode, ScheduleMode } from "../src/types";
import { durationToMilliseconds, PAYMENT_METHOD_OPTIONS } from "../src/domain/taskMarketplace";
import { parseCoordinate } from "../src/utils/location";
import { sanitizeDurationInput, sanitizeMoneyInput } from "../src/utils/numericInput";
import { AddressDetails, formatTaskAddressDetails } from "../src/utils/address";
import { ReverseGeocodeResult, reverseGeocodeSelectedPin } from "../src/services/reverseGeocoding";
import { getTaskPostingErrors, TaskPostingField } from "../src/domain/taskPosting";

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

const categories = [...taskCategories];
const durationUnits: Array<{ label: string; value: DurationUnit }> = [
  { label: "Hours", value: "hour" },
  { label: "Days", value: "day" },
  { label: "Weeks", value: "week" },
  { label: "Months", value: "month" }
];
const radiusOptions = [
  { label: "Nearby", value: "300", helper: "Same street or nearby block" },
  { label: "Barangay", value: "500", helper: "Good for most local tasks" },
  { label: "Wide area", value: "1000", helper: "Allows workers a little farther away" }
];

export default function PostTaskScreen() {
  const router = useRouter();
  const goBack = useTasklinkBack();
  const insets = useSafeAreaInsets();
  const { actionLoading, createTask, currentUser, error } = useApp();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [addressDetails, setAddressDetails] = useState<AddressDetails>({ city: "Bacolod City" });
  const [addressSuggestion, setAddressSuggestion] = useState<ReverseGeocodeResult>();
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationSource, setLocationSource] = useState<"device" | "manual" | "map">();
  const [locationCapturedAt, setLocationCapturedAt] = useState<string>();
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState<number>();
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [geofenceRadius, setGeofenceRadius] = useState("500");
  const [requiredCapabilities, setRequiredCapabilities] = useState<string[]>([]);
  const [capabilityDraft, setCapabilityDraft] = useState<string[]>([]);
  const [capabilityPickerOpen, setCapabilityPickerOpen] = useState(false);
  const [capabilityMessage, setCapabilityMessage] = useState("");
  const [wage, setWage] = useState("");
  const [pricingMode, setPricingMode] = useState<PricingMode>("fixed");
  const [durationValue, setDurationValue] = useState("1");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("day");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("fixed");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [perksText, setPerksText] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [mapOpen, setMapOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const [schedulePickerOpen, setSchedulePickerOpen] = useState(false);
  const [scheduleMinimum, setScheduleMinimum] = useState(() => new Date());
  const [formErrors, setFormErrors] = useState<Partial<Record<TaskPostingField, string>>>({});
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const formScrollRef = useRef<ScrollViewInstance>(null);
  const mapCenter = parseCoordinate(latitude) !== undefined && parseCoordinate(longitude) !== undefined
    ? { latitude: parseCoordinate(latitude) as number, longitude: parseCoordinate(longitude) as number }
    : undefined;

  async function useDeviceLocation() {
    setLocating(true);
    setLocationMessage("");
    try {
      const captured = await captureForegroundLocation();
      setLatitude(String(captured.latitude));
      setLongitude(String(captured.longitude));
      setLocationSource(captured.source);
      setLocationCapturedAt(captured.capturedAt);
      setLocationAccuracyMeters(captured.accuracyMeters);
      setLocationMessage(`Device location captured${captured.accuracyMeters ? ` (about ${Math.round(captured.accuracyMeters)} m accuracy)` : ""}.`);
      void populateAddressFromCoordinate(captured);
    } catch (locationError) {
      setLocationMessage(locationError instanceof Error ? locationError.message : "Unable to capture location.");
    } finally {
      setLocating(false);
    }
  }

  function selectMapCoordinate(coordinate: { latitude: number; longitude: number }) {
    setLatitude(String(coordinate.latitude));
    setLongitude(String(coordinate.longitude));
    setLocationSource("map");
    setLocationCapturedAt(new Date().toISOString());
    setLocationAccuracyMeters(undefined);
    setLocationMessage("Task pin selected on the map.");
    void populateAddressFromCoordinate(coordinate);
  }

  async function lookUpSelectedPinAddress() {
    if (!mapCenter) {
      setLocationMessage("Place a task pin before looking up an address.");
      return;
    }
    setAddressLookupLoading(true);
    setLocationMessage("");
    try {
      applyAddressSuggestionValues(await reverseGeocodeSelectedPin(mapCenter));
    } catch (lookupError) {
      setLocationMessage(lookupError instanceof Error ? lookupError.message : "Address lookup is unavailable. Enter the address manually.");
    } finally {
      setAddressLookupLoading(false);
    }
  }

  async function populateAddressFromCoordinate(coordinate: { latitude: number; longitude: number }) {
    setAddressLookupLoading(true);
    try {
      const suggestion = await reverseGeocodeSelectedPin(coordinate);
      const fullAddress = suggestion.formattedAddress;
      if (!/\bbacolod(?:\s+city)?\b/i.test(fullAddress)) {
        setLocationMessage("This pin appears outside Bacolod City. Choose a location within the service area.");
        return;
      }
      applyAddressSuggestionValues(suggestion);
      setLocationMessage("Address filled from the selected location. Review it before posting.");
    } catch {
      setLocationMessage("Address lookup is unavailable. Your pin was kept; enter the address manually.");
    } finally {
      setAddressLookupLoading(false);
    }
  }

  function applyAddressSuggestion() {
    if (!addressSuggestion) return;
    applyAddressSuggestionValues(addressSuggestion);
    setLocationMessage("Suggested address applied. Review and correct it before posting.");
  }

  function applyAddressSuggestionValues(suggestion: ReverseGeocodeResult) {
    const details = { ...suggestion.details, city: "Bacolod City" };
    setAddressSuggestion(suggestion);
    setAddressDetails(details);
    setLocationAddress(formatTaskAddressDetails(details));
  }

  function updateAddressDetail(field: keyof AddressDetails, value: string) {
    setAddressDetails((current) => ({ ...current, [field]: value }));
  }

  function selectCategory(nextCategory: string) {
    setCategory(nextCategory);
    setFormErrors((current) => ({ ...current, category: undefined }));
    setCategoryOpen(false);
  }

  function openCapabilityPicker() {
    setCapabilityDraft(requiredCapabilities);
    setCapabilityMessage("");
    setCapabilityPickerOpen(true);
  }

  function toggleCapability(capability: string) {
    setCapabilityMessage("");
    setCapabilityDraft((current) => {
      if (current.includes(capability)) return current.filter((item) => item !== capability);
      if (current.length >= 3) {
        setCapabilityMessage("You can select up to three required capabilities.");
        return current;
      }
      return [...current, capability];
    });
  }

  function saveCapabilities() {
    if (!capabilityDraft.length) {
      setCapabilityMessage("Select at least one required capability.");
      return;
    }
    setRequiredCapabilities(capabilityDraft);
    setFormErrors((current) => ({ ...current, capabilities: undefined }));
    setCapabilityPickerOpen(false);
  }

  function updateDuration(value: string) {
    setDurationValue(sanitizeDurationInput(value));
  }

  function changeDuration(step: number) {
    const current = Number(durationValue) || 1;
    setDurationValue(String(Math.min(365, Math.max(1, current + step))));
  }

  function buildTaskInput() {
    const durationNumber = Number(durationValue);
    const parsedStart = scheduleMode === "fixed" ? parseLocalDateTime(scheduleStart) : undefined;
    const scheduleEnd = parsedStart && Number.isFinite(durationNumber)
      ? new Date(parsedStart.getTime() + durationToMilliseconds(durationNumber, durationUnit)).toISOString()
      : undefined;
    const exactAddress = locationAddress.trim() || formatTaskAddressDetails(addressDetails);
    return {
      title, description, category, location, locationAddress: exactAddress,
      latitude: parseCoordinate(latitude), longitude: parseCoordinate(longitude),
      geofenceRadius: Number(geofenceRadius) || 500, locationCapturedAt, locationAccuracyMeters, locationSource,
      requiredCapability: requiredCapabilities[0], requiredCapabilities,
      wage: pricingMode === "fixed" ? wage : "", estimatedDuration: `${durationValue} ${durationValue === "1" ? durationUnit : `${durationUnit}s`}`,
      durationValue: durationNumber, durationUnit, scheduleMode,
      scheduleDate: scheduleMode === "anytime" ? scheduleDate : undefined,
      scheduleStart: parsedStart?.toISOString(), scheduleEnd, pricingMode,
      perks: perksText.split(",").map((perk) => perk.trim()).filter(Boolean), paymentMethod
    };
  }

  function openOverview() {
    const errors = getTaskPostingErrors(buildTaskInput());
    setFormErrors(errors);
    if (Object.keys(errors).length) {
      formScrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setOverviewOpen(true);
  }

  async function handlePostTask() {
    try {
      const input = buildTaskInput();
      const errors = getTaskPostingErrors(input);
      setFormErrors(errors);
      if (Object.keys(errors).length) {
        setOverviewOpen(false);
        formScrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
      await createTask(input);
      setOverviewOpen(false);
      setSuccessOpen(true);
    } catch {
      // AppContext exposes the readable error message.
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.closeButton}>
            <Feather accessibilityElementsHidden color={palette.muted} name="x" size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Post a Task</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{currentUser?.fullName?.trim().charAt(0).toUpperCase() || "T"}</Text>
        </View>
      </View>

      <ScrollView ref={formScrollRef} contentContainerStyle={[styles.content, { paddingBottom: 202 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.heroTitle}>Need a hand?</Text>
          <Text style={styles.heroText}>Describe what you need help with and find a neighbor to help you today.</Text>
        </View>

        <View style={styles.formCard}>
          <Field label="Task Category *">
            <Pressable
              accessibilityRole="button"
              onPress={() => setCategoryOpen(true)}
              style={({ pressed }) => [styles.selectButton, formErrors.category && styles.inputError, pressed && styles.pressed]}
            >
              <Text style={[styles.selectValue, !category && styles.placeholderValue]}>{category || "Select a task category"}</Text>
              <Feather accessibilityElementsHidden color={palette.primary} name="chevron-down" size={20} />
            </Pressable>
            {formErrors.category ? <Text accessibilityRole="alert" style={styles.fieldError}>{formErrors.category}</Text> : null}
          </Field>

          <Field label="Task Title *">
            <TextInput
              onChangeText={(value) => { setTitle(value); setFormErrors((current) => ({ ...current, title: value.trim() ? undefined : current.title })); }}
              placeholder="e.g. Move furniture to 2nd floor"
              placeholderTextColor={palette.outline}
              style={[styles.input, formErrors.title && styles.inputError]}
              value={title}
            />
            {formErrors.title ? <Text accessibilityRole="alert" style={styles.fieldError}>{formErrors.title}</Text> : null}
          </Field>

          <Field label="Landmark *">
            <View style={styles.locationInputWrap}>
              <TextInput
                accessibilityLabel="Task landmark"
                onChangeText={(value) => { setLocation(value); setFormErrors((current) => ({ ...current, landmark: value.trim() ? undefined : current.landmark })); }}
                placeholder="e.g. Near Barangay Hall"
                placeholderTextColor={palette.outline}
                style={[styles.locationInput, formErrors.landmark && styles.inputError]}
                value={location}
              />
            </View>
            {formErrors.landmark ? <Text accessibilityRole="alert" style={styles.fieldError}>{formErrors.landmark}</Text> : null}
            <View style={styles.serviceAreaCard}>
              <View style={styles.serviceAreaHeader}>
                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>Task location and worker radius</Text>
                  <Text style={styles.helperText}>Use a recognizable landmark. The pin and address remain the exact task location for worker check-in.</Text>
                </View>
              </View>

              <LocationMap
                center={mapCenter}
                interactive
                markers={mapCenter ? [{ id: "selected", ...mapCenter, title: "Task pin" }] : []}
                onSelectCoordinate={selectMapCoordinate}
                radiusMeters={Number(geofenceRadius) || 500}
                height={260}
              />
              <Text style={styles.helperText}>Move or zoom the map, then tap or click to place the task pin. Drag the pin to adjust it.</Text>
              <View style={styles.locationActionRow}>
                <Pressable accessibilityRole="button" disabled={locating} onPress={useDeviceLocation} style={styles.locationButton}>
                  <Text style={styles.locationButtonText}>{locating ? "Getting location..." : "Use device location"}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setMapOpen(true)} style={styles.locationOutlineButton}>
                  <Text style={styles.locationOutlineText}>Choose on map</Text>
                </Pressable>
              </View>
              {locationMessage ? <Text style={styles.locationMessage}>{locationMessage}</Text> : null}

              <View style={styles.addressCard}>
                <View style={styles.addressCardHeader}>
                  <View style={styles.flex}>
                    <Text style={styles.fieldLabel}>Address *</Text>
                    <Text style={styles.helperText}>Add details that help the tasker find the pin. A house number is never required.</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !mapCenter || addressLookupLoading }}
                    disabled={!mapCenter || addressLookupLoading}
                    onPress={lookUpSelectedPinAddress}
                    style={[styles.addressLookupButton, (!mapCenter || addressLookupLoading) && styles.disabled]}
                  >
                    <Feather accessibilityElementsHidden color={palette.primary} name="map-pin" size={16} />
                    <Text style={styles.addressLookupText}>{addressLookupLoading ? "Looking up..." : "Find from pin"}</Text>
                  </Pressable>
                </View>
                <TextInput
                  accessibilityLabel="Exact task address"
                  multiline
                  onChangeText={(value) => { setLocationAddress(value); setFormErrors((current) => ({ ...current, address: value.trim() ? undefined : current.address })); }}
                  placeholder="Building, street, barangay, Bacolod City"
                  placeholderTextColor={palette.outline}
                  style={[styles.input, styles.addressInput, formErrors.address && styles.inputError]}
                  textAlignVertical="top"
                  value={locationAddress}
                />
                <View style={styles.twoColumn}>
                  <Field label="House / building" style={styles.flex}>
                    <TextInput onChangeText={(value) => updateAddressDetail("houseNumber", value)} placeholder="Optional" placeholderTextColor={palette.outline} style={styles.input} value={addressDetails.houseNumber ?? ""} />
                  </Field>
                  <Field label="Street" style={styles.flex}>
                    <TextInput onChangeText={(value) => updateAddressDetail("street", value)} placeholder="Optional" placeholderTextColor={palette.outline} style={styles.input} value={addressDetails.street ?? ""} />
                  </Field>
                </View>
                <View style={styles.twoColumn}>
                  <Field label="Barangay" style={styles.flex}>
                    <TextInput onChangeText={(value) => updateAddressDetail("barangay", value)} placeholder="Barangay" placeholderTextColor={palette.outline} style={styles.input} value={addressDetails.barangay ?? ""} />
                  </Field>
                  <Field label="City" style={styles.flex}>
                    <TextInput editable={false} placeholderTextColor={palette.outline} style={[styles.input, styles.readOnlyInput]} value="Bacolod City" />
                  </Field>
                </View>
                {addressSuggestion ? <View style={styles.addressSuggestion}>
                  <Text style={styles.addressSuggestionLabel}>Map suggestion · {addressSuggestion.provider}</Text>
                  <Text style={styles.addressSuggestionText}>{formatTaskAddressDetails({ ...addressSuggestion.details, city: "Bacolod City" })}</Text>
                  <Text style={styles.helperText}>The task address keeps only the building, street, barangay, and city. You can still correct every field before posting.</Text>
                  <Pressable accessibilityRole="button" onPress={applyAddressSuggestion} style={styles.addressApplyButton}>
                    <Text style={styles.addressApplyText}>Use suggested address</Text>
                  </Pressable>
                </View> : null}
                <Text style={styles.addressPrivacyText}>Address lookup sends only the selected coordinates to OpenStreetMap Nominatim when you tap “Find from pin.”</Text>
              </View>

              {formErrors.address ? <Text accessibilityRole="alert" style={styles.fieldError}>{formErrors.address}</Text> : null}
              <View style={styles.radiusGrid}>
                {radiusOptions.map((option) => {
                  const selected = geofenceRadius === option.value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
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
                  <Text style={styles.coordinateAddress}>{location || "Landmark not entered"}</Text>
                </View>
                <Text style={[styles.coordinateValue, mapCenter && styles.coordinateValueSelected]}>{mapCenter ? "Pin selected" : "Pin not set"}</Text>
              </View>
              {formErrors.pin ? <Text accessibilityRole="alert" style={styles.fieldError}>{formErrors.pin}</Text> : null}
            </View>
          </Field>

          <Field label="Required Capabilities *">
            <Pressable
              accessibilityLabel="Select required capabilities"
              accessibilityRole="button"
              onPress={openCapabilityPicker}
              style={({ pressed }) => [styles.selectButton, formErrors.capabilities && styles.inputError, pressed && styles.pressed]}
            >
              <Text numberOfLines={1} style={styles.selectValue}>{requiredCapabilities.join(", ") || "Select capabilities"}</Text>
              <Feather accessibilityElementsHidden color={palette.primary} name="chevron-down" size={20} />
            </Pressable>
            <Text style={styles.helperText}>{requiredCapabilities.length}/3 selected. Taskers must have every selected capability.</Text>
            {formErrors.capabilities ? <Text accessibilityRole="alert" style={styles.fieldError}>{formErrors.capabilities}</Text> : null}
          </Field>

          <Field label="Pricing">
            <View style={styles.paymentRow}>
              {(["fixed", "bidding"] as PricingMode[]).map((mode) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: pricingMode === mode }}
                  key={mode}
                  onPress={() => setPricingMode(mode)}
                  style={[styles.paymentChip, pricingMode === mode && styles.paymentChipSelected]}
                >
                  <Text style={[styles.paymentText, pricingMode === mode && styles.paymentTextSelected]}>
                    {mode === "fixed" ? "Fixed Price" : "Open to Offers"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          {pricingMode === "fixed" ? <Field label="Budget (₱)">
              <TextInput
                accessibilityLabel="Task budget in pesos"
                keyboardType="decimal-pad"
                onChangeText={(value) => { const next = sanitizeMoneyInput(value); setWage(next); setFormErrors((current) => ({ ...current, budget: Number(next) >= 150 ? undefined : current.budget })); }}
                placeholder=""
                placeholderTextColor={palette.outline}
                style={[styles.input, formErrors.budget && styles.inputError]}
                value={wage}
              />
              {formErrors.budget ? <Text accessibilityRole="alert" style={styles.fieldError}>{formErrors.budget}</Text> : null}
            </Field> : <Text style={styles.helperText}>Taskers will submit an offer amount when they apply.</Text>}

          <View style={styles.twoColumn}>
            <Field label="Duration value *" style={styles.flex}>
              <View style={styles.durationControl}>
                <Pressable
                  accessibilityLabel="Decrease task duration"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: Number(durationValue) <= 1 }}
                  disabled={Number(durationValue) <= 1}
                  onPress={() => changeDuration(-1)}
                  style={[styles.durationStepButton, Number(durationValue) <= 1 && styles.durationStepButtonDisabled]}
                >
                  <Feather accessibilityElementsHidden color={palette.primary} name="minus" size={18} />
                </Pressable>
                <TextInput
                  accessibilityLabel="Task duration value"
                  keyboardType="number-pad"
                  onChangeText={updateDuration}
                  placeholder="1"
                  placeholderTextColor={palette.outline}
                  style={[styles.input, styles.durationInput]}
                  value={durationValue}
                />
                <Pressable
                  accessibilityLabel="Increase task duration"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: Number(durationValue) >= 365 }}
                  disabled={Number(durationValue) >= 365}
                  onPress={() => changeDuration(1)}
                  style={[styles.durationStepButton, Number(durationValue) >= 365 && styles.durationStepButtonDisabled]}
                >
                  <Feather accessibilityElementsHidden color={palette.primary} name="plus" size={18} />
                </Pressable>
              </View>
            </Field>
            <Field label="Duration unit *" style={styles.flex}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: durationOpen }}
                onPress={() => setDurationOpen((open) => !open)}
                style={({ pressed }) => [styles.selectButton, pressed && styles.pressed]}
              >
                <Text style={styles.selectValue}>{durationUnits.find((item) => item.value === durationUnit)?.label}</Text>
                <Feather accessibilityElementsHidden color={palette.primary} name="chevron-down" size={20} />
              </Pressable>
              {durationOpen ? <View style={styles.durationDropdown}>
                {durationUnits.map((item) => {
                  const selected = item.value === durationUnit;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={item.value}
                      onPress={() => {
                        setDurationUnit(item.value);
                        setDurationOpen(false);
                      }}
                      style={[styles.durationDropdownOption, selected && styles.durationDropdownOptionSelected]}
                    >
                      <Text style={[styles.durationDropdownText, selected && styles.durationDropdownTextSelected]}>{item.label}</Text>
                      {selected ? <Feather accessibilityElementsHidden color={palette.primary} name="check" size={18} /> : null}
                    </Pressable>
                  );
                })}
              </View> : null}
            </Field>
          </View>
          {formErrors.duration ? <Text accessibilityRole="alert" style={styles.fieldError}>{formErrors.duration}</Text> : null}

          <Field label="When should the task start? *">
            <View style={styles.scheduleModeRow}>
              {(["fixed", "anytime"] as ScheduleMode[]).map((mode) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: scheduleMode === mode }}
                  key={mode}
                  onPress={() => setScheduleMode(mode)}
                  style={[styles.scheduleModeButton, scheduleMode === mode && styles.scheduleModeButtonSelected]}
                >
                  <Text style={[styles.scheduleModeText, scheduleMode === mode && styles.scheduleModeTextSelected]}>{mode === "fixed" ? "Specific time" : "Anytime"}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityLabel={scheduleMode === "anytime"
                ? scheduleDate ? `Task is flexible on ${formatFriendlyDate(parseLocalDate(scheduleDate) ?? new Date(), "date")}` : "Choose flexible task date"
                : scheduleStart ? `Task starts ${formatFriendlyDate(parseLocalDateTime(scheduleStart) ?? new Date())}` : "Choose task start date and time"}
              accessibilityRole="button"
              onPress={() => {
                setScheduleMinimum(new Date());
                setSchedulePickerOpen(true);
              }}
              style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
            >
              <View style={styles.dateIcon}><Feather accessibilityElementsHidden color={palette.primary} name="calendar" size={20} /></View>
              <View style={styles.dateCopy}>
                <Text style={[styles.dateValue, !(scheduleMode === "anytime" ? scheduleDate : scheduleStart) && styles.datePlaceholder]}>
                  {scheduleMode === "anytime"
                    ? scheduleDate ? `Anytime — ${formatFriendlyDate(parseLocalDate(scheduleDate) ?? new Date(), "date")}` : "Choose a flexible date"
                    : scheduleStart ? formatFriendlyDate(parseLocalDateTime(scheduleStart) ?? new Date()) : "Choose date and time"}
                </Text>
                <Text style={styles.dateHint}>{scheduleMode === "anytime" ? "Choose a date; agree the exact start with the tasker before work begins." : "A calendar and time picker will open."}</Text>
              </View>
              <Feather accessibilityElementsHidden color={palette.primary} name="chevron-right" size={22} />
            </Pressable>
            {formErrors.schedule ? <Text accessibilityRole="alert" style={styles.fieldError}>{formErrors.schedule}</Text> : null}
          </Field>

          <Field label="Perks (Optional)">
            <TextInput onChangeText={setPerksText} placeholder="Free lunch, transportation allowance" placeholderTextColor={palette.outline} style={styles.input} value={perksText} />
            <Text style={styles.helperText}>Separate multiple perks with commas. Perks do not change the monetary payment.</Text>
          </Field>

          <Field label="Payment Method *">
            <View style={styles.paymentRow}>
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: paymentMethod === option.value }}
                  key={option.value}
                  onPress={() => setPaymentMethod(option.value)}
                  style={[styles.paymentChip, paymentMethod === option.value && styles.paymentChipSelected]}
                >
                  <Text style={[styles.paymentText, paymentMethod === option.value && styles.paymentTextSelected]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.helperText}>
              Cash is confirmed by both participants. GCash requires a receipt for administrator review.
            </Text>
            {formErrors.payment ? <Text accessibilityRole="alert" style={styles.fieldError}>{formErrors.payment}</Text> : null}
          </Field>

          <Field label="Task Description *">
            <TextInput
              multiline
              onChangeText={(value) => { setDescription(value); setFormErrors((current) => ({ ...current, description: value.trim() ? undefined : current.description })); }}
              placeholder="Provide more details for your neighbor..."
              placeholderTextColor={palette.outline}
              style={[styles.input, styles.textArea, formErrors.description && styles.inputError]}
              textAlignVertical="top"
              value={description}
            />
            {formErrors.description ? <Text accessibilityRole="alert" style={styles.fieldError}>{formErrors.description}</Text> : null}
          </Field>
        </View>

        <View style={styles.tipCard}>
          <Feather accessibilityElementsHidden color={palette.secondary} name="info" size={19} />
          <View style={styles.flex}>
            <Text style={styles.tipTitle}>Reliability Tip</Text>
            <Text style={styles.tipText}>Providing clear details and a fair wage helps you find a helper faster.</Text>
          </View>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.bottomAction, { bottom: 58 + Math.max(insets.bottom, 10), paddingBottom: 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: actionLoading }}
          disabled={actionLoading}
          onPress={openOverview}
          style={({ pressed }) => [styles.postButton, actionLoading && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.postButtonText}>{actionLoading ? "Posting..." : "Review Task"}</Text>
        </Pressable>
      </View>

      <AnimatedBottomNav active="jobs" role={currentUser?.role} />

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
            <LocationMap
              center={mapCenter}
              interactive
              markers={mapCenter ? [{ id: "selected", ...mapCenter, title: "Task pin" }] : []}
              onSelectCoordinate={selectMapCoordinate}
              radiusMeters={Number(geofenceRadius) || 500}
              showUserLocation
              height={360}
            />
            <Text style={styles.helperText}>Move or zoom the map, then tap or click to place the task pin. Drag the pin to adjust it.</Text>

            <View style={styles.modalPanel}>
              <Text style={styles.fieldLabel}>Worker check radius</Text>
              <View style={styles.radiusGrid}>
                {radiusOptions.map((option) => {
                  const selected = geofenceRadius === option.value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
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

      <Modal animationType="slide" transparent visible={capabilityPickerOpen} onRequestClose={() => setCapabilityPickerOpen(false)}>
        <Pressable accessibilityLabel="Close required capabilities" accessibilityRole="button" onPress={() => setCapabilityPickerOpen(false)} style={styles.pickerBackdrop}>
          <Pressable accessibilityRole="none" onPress={() => undefined} style={styles.capabilitySheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <View style={styles.flex}>
                <Text style={styles.pickerTitle}>Select Required Capabilities</Text>
                <Text style={styles.capabilityCount}>{capabilityDraft.length}/3 selected</Text>
              </View>
              <Pressable accessibilityLabel="Cancel required capabilities" accessibilityRole="button" onPress={() => setCapabilityPickerOpen(false)} style={styles.pickerCloseButton}>
                <Text style={styles.pickerCloseText}>Cancel</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.capabilityList} showsVerticalScrollIndicator={false}>
              {workerCapabilities.map((capability) => {
                const selected = capabilityDraft.includes(capability);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={capability}
                    onPress={() => toggleCapability(capability)}
                    style={[styles.capabilityOption, selected && styles.capabilityOptionSelected]}
                  >
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected ? <Feather accessibilityElementsHidden color={palette.white} name="check" size={16} /> : null}
                    </View>
                    <Text style={[styles.capabilityOptionText, selected && styles.capabilityOptionTextSelected]}>{capability}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {capabilityMessage ? <Text accessibilityRole="alert" style={styles.capabilityValidation}>{capabilityMessage}</Text> : null}
            <View style={styles.capabilityActions}>
              <Pressable accessibilityRole="button" onPress={() => setCapabilityPickerOpen(false)} style={styles.capabilityCancelButton}>
                <Text style={styles.capabilityCancelText}>Cancel</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={saveCapabilities} style={styles.capabilitySaveButton}>
                <Text style={styles.capabilitySaveText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="slide" visible={overviewOpen} onRequestClose={() => setOverviewOpen(false)}>
        <SafeAreaView style={styles.mapModalSafeArea} edges={["top", "left", "right"]}>
          <View style={styles.mapModalHeader}>
            <View>
              <Text style={styles.mapModalTitle}>Task Overview</Text>
              <Text style={styles.mapModalSubtitle}>Review the details before posting. Use Back to make changes.</Text>
            </View>
            <Pressable accessibilityLabel="Return to task form" accessibilityRole="button" onPress={() => setOverviewOpen(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>Back</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.overviewContent} showsVerticalScrollIndicator={false}>
            <OverviewRow label="Task title" value={title} />
            <OverviewRow label="Description" value={description || "No additional notes"} />
            <OverviewRow label="Category" value={category} />
            <OverviewRow label="Required capabilities" value={requiredCapabilities.join(", ")} />
            <OverviewRow label="Address" value={buildTaskInput().locationAddress || ""} />
            <OverviewRow label="Landmark" value={location} />
            <OverviewRow label="City" value="Bacolod City" />
            <OverviewRow label="Map location" value={mapCenter ? `${mapCenter.latitude.toFixed(5)}, ${mapCenter.longitude.toFixed(5)} · ${geofenceRadius} m check-in radius` : "No pin selected"} />
            <OverviewRow label="Pricing" value={pricingMode === "fixed" ? `Fixed price · ₱${wage}` : "Open to offers"} />
            <OverviewRow label="Duration" value={`${durationValue} ${durationValue === "1" ? durationUnit : `${durationUnit}s`}`} />
            <OverviewRow label="Schedule" value={scheduleMode === "anytime" ? `Anytime on ${scheduleDate}` : formatFriendlyDate(parseLocalDateTime(scheduleStart) ?? new Date())} />
            {perksText.trim() ? <OverviewRow label="Perks" value={perksText} /> : null}
            <OverviewRow label="Payment method" value={paymentMethod} />
            {error ? <Text accessibilityRole="alert" style={styles.fieldError}>{error}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: actionLoading }} disabled={actionLoading} onPress={handlePostTask} style={[styles.postButton, actionLoading && styles.disabled]}>
              <Text style={styles.postButtonText}>{actionLoading ? "Posting..." : "Confirm & Post Task"}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal animationType="fade" transparent visible={successOpen} onRequestClose={() => router.replace("/client-dashboard")}>
        <View style={styles.successBackdrop}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}><Feather accessibilityElementsHidden color={palette.white} name="check" size={28} /></View>
            <Text style={styles.successTitle}>Task Posted Successfully!</Text>
            <Text style={styles.successText}>Your task is now available for eligible workers.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace("/client-dashboard")} style={styles.postButton}>
              <Text style={styles.postButtonText}>Go to Dashboard</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <DateTimePickerSheet
        mode={scheduleMode === "anytime" ? "date" : "datetime"}
        minimumDate={scheduleMinimum}
        onClose={() => setSchedulePickerOpen(false)}
        onConfirm={(value) => {
          if (scheduleMode === "anytime") setScheduleDate(formatLocalDate(value));
          else setScheduleStart(formatLocalDateTime(value));
        }}
        title={scheduleMode === "anytime" ? "Choose flexible task date" : "Choose task start"}
        value={scheduleMode === "anytime" ? parseLocalDate(scheduleDate) : parseLocalDateTime(scheduleStart)}
        visible={schedulePickerOpen}
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
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable onPress={() => undefined} style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <Pressable accessibilityLabel="Close picker" accessibilityRole="button" onPress={onClose} style={styles.pickerCloseButton}>
              <Text style={styles.pickerCloseText}>Close</Text>
            </Pressable>
          </View>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.overviewRow}><Text style={styles.overviewLabel}>{label}</Text><Text style={styles.overviewValue}>{value}</Text></View>;
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
  inputError: { borderColor: "#BA1A1A", borderWidth: 2 },
  fieldError: { color: "#BA1A1A", fontSize: 12, lineHeight: 16, fontWeight: "800", marginTop: 4 },
  placeholderValue: { color: palette.outline, fontWeight: "700" },
  readOnlyInput: { backgroundColor: palette.surfaceContainer, color: palette.muted },
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
  locationInput: { flex: 1, minHeight: 48, color: palette.text, fontSize: 16, paddingHorizontal: 12 },
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
  durationControl: { flexDirection: "row", alignItems: "center", gap: 6 },
  durationInput: { flex: 1, textAlign: "center", paddingHorizontal: 6 },
  durationStepButton: { width: 40, minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" },
  durationStepButtonDisabled: { opacity: 0.45 },
  durationDropdown: { borderWidth: 1, borderColor: palette.outlineVariant, borderRadius: 8, backgroundColor: palette.surface, overflow: "hidden", marginTop: 2 },
  durationDropdownOption: { minHeight: 42, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  durationDropdownOptionSelected: { backgroundColor: "#E5F1EE" },
  durationDropdownText: { color: palette.text, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  durationDropdownTextSelected: { color: palette.primary, fontWeight: "900" },
  paymentRow: { flexDirection: "row", gap: 8 },
  scheduleModeRow: { flexDirection: "row", gap: 8 },
  scheduleModeButton: { flex: 1, minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" },
  scheduleModeButtonSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  scheduleModeText: { color: palette.muted, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  scheduleModeTextSelected: { color: palette.white },
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
  locationActionRow: { flexDirection: "row", gap: 8 },
  locationButton: { flex: 1, minHeight: 44, borderRadius: 8, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  locationButtonText: { color: palette.white, fontSize: 12, fontWeight: "900" },
  locationOutlineButton: { flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: palette.primary, alignItems: "center", justifyContent: "center" },
  locationOutlineText: { color: palette.primary, fontSize: 12, fontWeight: "900" },
  locationMessage: { color: palette.primary, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  addressCard: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, gap: 8 },
  addressCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  addressLookupButton: { minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: palette.primary, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: palette.surface },
  addressLookupText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  addressInput: { minHeight: 70, paddingTop: 10 },
  addressSuggestion: { padding: 10, borderRadius: 8, backgroundColor: "#E5F1EE", gap: 4 },
  addressSuggestionLabel: { color: palette.primary, fontSize: 11, lineHeight: 15, fontWeight: "900" },
  addressSuggestionText: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  addressApplyButton: { alignSelf: "flex-start", minHeight: 34, borderRadius: 7, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary, marginTop: 2 },
  addressApplyText: { color: palette.white, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  addressPrivacyText: { color: palette.muted, fontSize: 11, lineHeight: 15 },
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
  coordinateValueSelected: { color: palette.primary },
  paymentChip: { flex: 1, minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" },
  paymentChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  paymentText: { color: palette.muted, fontSize: 14, fontWeight: "800" },
  paymentTextSelected: { color: palette.white },
  dateButton: { minHeight: 70, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, padding: 10, flexDirection: "row", alignItems: "center", gap: 11 },
  dateIcon: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#E5F1EE" },
  dateIconText: { color: palette.primary, fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 0.6 },
  dateCopy: { flex: 1 },
  dateValue: { color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: "900" },
  datePlaceholder: { color: palette.outline, fontWeight: "700" },
  dateHint: { color: palette.muted, fontSize: 11, lineHeight: 15, marginTop: 2 },
  dateChevron: { color: palette.primary, fontSize: 24, lineHeight: 28, fontWeight: "900" },
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
  overviewContent: { padding: 16, gap: 10 },
  overviewRow: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, gap: 3 },
  overviewLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  overviewValue: { color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: "800" },
  successBackdrop: { flex: 1, padding: 24, backgroundColor: "rgba(24,28,28,0.48)", alignItems: "center", justifyContent: "center" },
  successCard: { width: "100%", maxWidth: 420, padding: 24, borderRadius: 20, backgroundColor: palette.surface, alignItems: "center", gap: 12 },
  successIcon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  successTitle: { color: palette.textStrong, fontSize: 21, lineHeight: 28, fontWeight: "900", textAlign: "center" },
  successText: { color: palette.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 4 },
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
  pickerBackdrop: { flex: 1, paddingHorizontal: 16, paddingTop: 24, backgroundColor: "rgba(24,28,28,0.42)", alignItems: "center", justifyContent: "flex-end" },
  pickerSheet: { width: "100%", maxWidth: 520, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 12, paddingBottom: 20, backgroundColor: palette.surface, gap: 4 },
  pickerHandle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", backgroundColor: palette.outlineVariant, marginBottom: 8 },
  pickerHeader: { minHeight: 48, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pickerTitle: { color: palette.textStrong, fontSize: 18, lineHeight: 24, fontWeight: "900", flex: 1 },
  pickerCloseButton: { minHeight: 40, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  pickerCloseText: { color: palette.primary, fontSize: 13, fontWeight: "900" },
  pickerOption: { minHeight: 48, borderRadius: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pickerOptionSelected: { backgroundColor: "#E5F1EE" },
  pickerOptionText: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: "700", flex: 1 },
  pickerOptionTextSelected: { color: palette.primary, fontWeight: "900" },
  pickerCheck: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  capabilitySheet: { width: "100%", maxWidth: 520, maxHeight: "82%", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 12, paddingBottom: 20, backgroundColor: palette.surface, gap: 8 },
  capabilityCount: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "800", marginTop: 2 },
  capabilityList: { gap: 6, paddingHorizontal: 4, paddingVertical: 4 },
  capabilityOption: { minHeight: 48, borderRadius: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow },
  capabilityOptionSelected: { borderColor: palette.primary, backgroundColor: "#E5F1EE" },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: palette.outline, alignItems: "center", justifyContent: "center" },
  checkboxSelected: { borderColor: palette.primary, backgroundColor: palette.primary },
  capabilityOptionText: { color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: "700", flex: 1 },
  capabilityOptionTextSelected: { color: palette.primary, fontWeight: "900" },
  capabilityValidation: { color: "#BA1A1A", fontSize: 12, lineHeight: 16, fontWeight: "800", paddingHorizontal: 8 },
  capabilityActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.outlineVariant },
  capabilityCancelButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: palette.primary, alignItems: "center", justifyContent: "center" },
  capabilityCancelText: { color: palette.primary, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  capabilitySaveButton: { minHeight: 44, paddingHorizontal: 20, borderRadius: 8, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  capabilitySaveText: { color: palette.white, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
