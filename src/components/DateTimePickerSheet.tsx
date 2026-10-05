import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PickerMode = "date" | "datetime";

type DateTimePickerSheetProps = {
  mode?: PickerMode;
  minimumDate?: Date;
  onClose: () => void;
  onConfirm: (value: Date) => void;
  title: string;
  value?: Date;
  visible: boolean;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MINUTE_STEP = 15;

export function DateTimePickerSheet({
  mode = "datetime",
  minimumDate,
  onClose,
  onConfirm,
  title,
  value,
  visible
}: DateTimePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const minimumTime = minimumDate?.getTime();
  const selectedTime = value?.getTime();
  const [draft, setDraft] = useState(() => initialDate(value, mode, minimumDate));
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(draft));

  useEffect(() => {
    if (!visible) return;
    const next = initialDate(value, mode, minimumDate);
    setDraft(next);
    setVisibleMonth(monthStart(next));
  }, [minimumTime, mode, selectedTime, visible]);

  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const beforeMinimum = minimumTime !== undefined && draft.getTime() < minimumTime;
  const previousMonthDisabled = minimumDate
    ? monthStart(addMonths(visibleMonth, -1)).getTime() < monthStart(minimumDate).getTime()
    : false;

  function selectDay(day: number) {
    const next = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      day,
      draft.getHours(),
      draft.getMinutes()
    );
    if (minimumDate && isSameDay(next, minimumDate) && next < minimumDate) {
      const safeTime = nextQuarterHour(minimumDate);
      next.setHours(safeTime.getHours(), safeTime.getMinutes(), 0, 0);
    }
    setDraft(next);
  }

  function updateTime(hour: number, minute: number) {
    const next = new Date(draft);
    next.setHours(hour, minute, 0, 0);
    setDraft(next);
  }

  function adjustMinutes(amount: number) {
    const minutesInDay = 24 * 60;
    const currentMinutes = draft.getHours() * 60 + draft.getMinutes();
    const nextMinutes = (currentMinutes + amount + minutesInDay) % minutesInDay;
    updateTime(Math.floor(nextMinutes / 60), nextMinutes % 60);
  }

  const hour12 = draft.getHours() % 12 || 12;
  const period = draft.getHours() >= 12 ? "PM" : "AM";

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close date picker" style={styles.backdrop} onPress={onClose}>
        <Pressable accessibilityRole="none" onPress={() => undefined} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>{mode === "datetime" ? "SCHEDULE" : "DATE RANGE"}</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
            <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Selected {mode === "datetime" ? "schedule" : "date"}</Text>
              <Text style={styles.summaryValue}>{formatFriendlyDate(draft, mode)}</Text>
            </View>

            <View style={styles.calendarCard}>
              <View style={styles.monthHeader}>
                <Pressable
                  accessibilityLabel="Previous month"
                  accessibilityRole="button"
                  disabled={previousMonthDisabled}
                  onPress={() => setVisibleMonth((current) => addMonths(current, -1))}
                  style={[styles.monthButton, previousMonthDisabled && styles.disabled]}
                >
                  <Text style={styles.monthButtonText}>‹</Text>
                </Pressable>
                <Text accessibilityRole="header" style={styles.monthTitle}>
                  {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </Text>
                <Pressable
                  accessibilityLabel="Next month"
                  accessibilityRole="button"
                  onPress={() => setVisibleMonth((current) => addMonths(current, 1))}
                  style={styles.monthButton}
                >
                  <Text style={styles.monthButtonText}>›</Text>
                </Pressable>
              </View>

              <View style={styles.calendarGrid}>
                {DAY_NAMES.map((dayName) => <Text key={dayName} style={styles.dayName}>{dayName.slice(0, 1)}</Text>)}
                {calendarDays.map((day, index) => {
                  if (day === null) return <View key={`blank-${index}`} style={styles.dayCell} />;
                  const candidate = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
                  const disabled = minimumDate ? endOfDay(candidate) < minimumDate : false;
                  const selected = isSameDay(candidate, draft);
                  const today = isSameDay(candidate, new Date());
                  return (
                    <View key={day} style={styles.dayCell}>
                      <Pressable
                        accessibilityLabel={candidate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                        accessibilityRole="button"
                        accessibilityState={{ disabled, selected }}
                        disabled={disabled}
                        onPress={() => selectDay(day)}
                        style={[styles.dayButton, today && styles.todayButton, selected && styles.selectedDay, disabled && styles.disabled]}
                      >
                        <Text style={[styles.dayText, selected && styles.selectedDayText]}>{day}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>

            {mode === "datetime" ? (
              <View style={styles.timeCard}>
                <View>
                  <Text style={styles.sectionTitle}>Start time</Text>
                  <Text style={styles.sectionHelper}>Use the controls to choose an exact time.</Text>
                </View>
                <View style={styles.timeControls}>
                  <TimeStepper
                    label="Hour"
                    value={String(hour12).padStart(2, "0")}
                    onDecrease={() => updateTime((draft.getHours() + 23) % 24, draft.getMinutes())}
                    onIncrease={() => updateTime((draft.getHours() + 1) % 24, draft.getMinutes())}
                  />
                  <Text style={styles.timeColon}>:</Text>
                  <TimeStepper
                    label="Minute"
                    value={String(draft.getMinutes()).padStart(2, "0")}
                    onDecrease={() => adjustMinutes(-MINUTE_STEP)}
                    onIncrease={() => adjustMinutes(MINUTE_STEP)}
                  />
                  <View style={styles.periodGroup}>
                    <Text style={styles.timeLabel}>Period</Text>
                    <Pressable
                      accessibilityLabel={`Switch from ${period}`}
                      accessibilityRole="button"
                      onPress={() => updateTime((draft.getHours() + 12) % 24, draft.getMinutes())}
                      style={styles.periodButton}
                    >
                      <Text style={styles.periodText}>{period}</Text>
                    </Pressable>
                  </View>
                </View>
                {beforeMinimum ? <Text accessibilityRole="alert" style={styles.validationText}>Choose a time that has not already passed.</Text> : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: beforeMinimum }}
              disabled={beforeMinimum}
              onPress={() => {
                onConfirm(draft);
                onClose();
              }}
              style={[styles.confirmButton, beforeMinimum && styles.disabled]}
            >
              <Text style={styles.confirmText}>Use this {mode === "datetime" ? "schedule" : "date"}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TimeStepper({ label, onDecrease, onIncrease, value }: {
  label: string;
  onDecrease: () => void;
  onIncrease: () => void;
  value: string;
}) {
  return (
    <View style={styles.timeGroup}>
      <Text style={styles.timeLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable accessibilityLabel={`Decrease ${label.toLowerCase()}`} accessibilityRole="button" onPress={onDecrease} style={styles.stepButton}>
          <Text style={styles.stepButtonText}>−</Text>
        </Pressable>
        <Text accessibilityLabel={`${label} ${value}`} style={styles.timeValue}>{value}</Text>
        <Pressable accessibilityLabel={`Increase ${label.toLowerCase()}`} accessibilityRole="button" onPress={onIncrease} style={styles.stepButton}>
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function parseLocalDateTime(value?: string) {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  return isValidDateParts(date, match) ? date : undefined;
}

export function parseLocalDate(value?: string) {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3]) ? date : undefined;
}

export function formatLocalDateTime(value: Date) {
  return `${formatLocalDate(value)} ${twoDigits(value.getHours())}:${twoDigits(value.getMinutes())}`;
}

export function formatLocalDate(value: Date) {
  return `${value.getFullYear()}-${twoDigits(value.getMonth() + 1)}-${twoDigits(value.getDate())}`;
}

export function formatFriendlyDate(value: Date, mode: PickerMode = "datetime") {
  return value.toLocaleString(undefined, mode === "date"
    ? { weekday: "short", month: "short", day: "numeric", year: "numeric" }
    : { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function initialDate(value: Date | undefined, mode: PickerMode, minimumDate?: Date) {
  let next = value && Number.isFinite(value.getTime()) ? new Date(value) : nextQuarterHour(new Date(Date.now() + (mode === "datetime" ? 60 * 60 * 1000 : 0)));
  if (minimumDate && next < minimumDate) next = nextQuarterHour(minimumDate);
  if (mode === "date") next.setHours(0, 0, 0, 0);
  else next.setSeconds(0, 0);
  return next;
}

function getCalendarDays(month: Date) {
  const blanks = Array<null>(new Date(month.getFullYear(), month.getMonth(), 1).getDay()).fill(null);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [...blanks, ...Array.from({ length: count }, (_, index) => index + 1)];
}

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function endOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function nextQuarterHour(value: Date) {
  const next = new Date(value);
  const hadPartialMinute = next.getSeconds() > 0 || next.getMilliseconds() > 0;
  next.setSeconds(0, 0);
  const remainder = next.getMinutes() % MINUTE_STEP;
  if (remainder || hadPartialMinute) next.setMinutes(next.getMinutes() + (remainder ? MINUTE_STEP - remainder : MINUTE_STEP));
  return next;
}

function isValidDateParts(value: Date, match: RegExpMatchArray) {
  return Number.isFinite(value.getTime())
    && value.getFullYear() === Number(match[1])
    && value.getMonth() === Number(match[2]) - 1
    && value.getDate() === Number(match[3])
    && value.getHours() === Number(match[4])
    && value.getMinutes() === Number(match[5]);
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(24,28,28,0.42)" },
  sheet: { width: "100%", maxHeight: "94%", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8, backgroundColor: "#F7FAF8", shadowColor: "#000000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 24 },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", backgroundColor: "#BDC9C6", marginBottom: 10 },
  header: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { color: "#855300", fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 1.1 },
  title: { color: "#111827", fontSize: 21, lineHeight: 28, fontWeight: "900" },
  closeButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  closeText: { color: "#005C55", fontSize: 13, fontWeight: "900" },
  content: { gap: 12, paddingVertical: 12 },
  summaryCard: { borderRadius: 14, padding: 14, backgroundColor: "#005C55" },
  summaryLabel: { color: "#BDEBE5", fontSize: 11, lineHeight: 15, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  summaryValue: { color: "#FFFFFF", fontSize: 18, lineHeight: 25, fontWeight: "900", marginTop: 3 },
  calendarCard: { padding: 10, borderRadius: 16, borderWidth: 1, borderColor: "#D8E1DF", backgroundColor: "#FFFFFF" },
  monthHeader: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#E5F1EE" },
  monthButtonText: { color: "#005C55", fontSize: 28, lineHeight: 30, fontWeight: "700" },
  monthTitle: { color: "#181C1C", fontSize: 16, lineHeight: 22, fontWeight: "900" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", paddingTop: 5 },
  dayName: { width: "14.2857%", paddingVertical: 7, color: "#6E7977", fontSize: 11, lineHeight: 14, fontWeight: "900", textAlign: "center" },
  dayCell: { width: "14.2857%", aspectRatio: 1, padding: 2 },
  dayButton: { flex: 1, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  todayButton: { borderWidth: 1, borderColor: "#005C55" },
  selectedDay: { borderColor: "#FEA619", backgroundColor: "#FEA619" },
  dayText: { color: "#181C1C", fontSize: 13, fontWeight: "800" },
  selectedDayText: { color: "#2A1700", fontWeight: "900" },
  timeCard: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#D8E1DF", backgroundColor: "#FFFFFF", gap: 12 },
  sectionTitle: { color: "#181C1C", fontSize: 15, lineHeight: 21, fontWeight: "900" },
  sectionHelper: { color: "#3E4947", fontSize: 12, lineHeight: 16, marginTop: 2 },
  timeControls: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 7 },
  timeGroup: { flex: 1, gap: 5 },
  timeLabel: { color: "#6E7977", fontSize: 10, lineHeight: 14, fontWeight: "900", textAlign: "center", textTransform: "uppercase" },
  stepper: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 10, borderWidth: 1, borderColor: "#BDC9C6", overflow: "hidden" },
  stepButton: { width: 34, alignSelf: "stretch", alignItems: "center", justifyContent: "center", backgroundColor: "#E5F1EE" },
  stepButtonText: { color: "#005C55", fontSize: 20, lineHeight: 24, fontWeight: "900" },
  timeValue: { minWidth: 34, color: "#181C1C", fontSize: 17, fontWeight: "900", textAlign: "center" },
  timeColon: { color: "#181C1C", fontSize: 22, lineHeight: 44, fontWeight: "900" },
  periodGroup: { width: 70, gap: 5 },
  periodButton: { minHeight: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#005C55" },
  periodText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  validationText: { color: "#BA1A1A", fontSize: 12, lineHeight: 16, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#D8E1DF" },
  cancelButton: { minHeight: 48, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: "#005C55", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  cancelText: { color: "#005C55", fontSize: 14, fontWeight: "900" },
  confirmButton: { minHeight: 48, flex: 1, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#005C55" },
  confirmText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.38 }
});
