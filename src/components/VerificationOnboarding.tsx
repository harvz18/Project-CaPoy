import Feather from "@expo/vector-icons/Feather";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { calculateVerificationProgress } from "../domain/verificationProgress";
import { colors, radii, spacing } from "../theme";
import type { UserProfile } from "../types";
import { AppText as Text } from "./AppText";

type VerificationOnboardingProps = {
  autoOpen: boolean;
  onContinue: () => void;
  onDismiss: () => void;
  user: UserProfile | null | undefined;
};

export function hasPriorityIdentityDocuments(user: Pick<UserProfile, "validIdUrl" | "selfieWithIdUrl"> | null | undefined) {
  return Boolean(user?.validIdUrl?.trim() && user?.selfieWithIdUrl?.trim());
}

export function isOfficiallyVerified(user: Pick<UserProfile, "verificationStatus" | "identityStatus"> | null | undefined) {
  return user?.verificationStatus === "Verified" || user?.identityStatus === "Approved";
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

function usePairedPulse(enabled: boolean) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!enabled) {
      scale.stopAnimation();
      scale.setValue(1);
      return;
    }

    let cancelled = false;
    let nextPulse: ReturnType<typeof setTimeout> | undefined;
    const pulseOnce = () => Animated.sequence([
      Animated.timing(scale, { toValue: 1.08, duration: 180, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 240, useNativeDriver: true })
    ]);
    const pulseTwice = () => {
      Animated.sequence([pulseOnce(), Animated.delay(120), pulseOnce()]).start(({ finished }) => {
        if (finished && !cancelled) nextPulse = setTimeout(pulseTwice, 4040);
      });
    };

    pulseTwice();
    return () => {
      cancelled = true;
      if (nextPulse) clearTimeout(nextPulse);
      scale.stopAnimation();
      scale.setValue(1);
    };
  }, [enabled, scale]);

  return scale;
}

export function VerificationOnboarding({ autoOpen, onContinue, onDismiss, user }: VerificationOnboardingProps) {
  const needsIdentityStep = !isOfficiallyVerified(user) && !hasPriorityIdentityDocuments(user);
  const visible = autoOpen && needsIdentityStep;

  function continueVerification() {
    onContinue();
  }

  return (
    <Modal animationType="fade" onRequestClose={onDismiss} statusBarTranslucent transparent visible={visible}>
      <View accessibilityViewIsModal style={styles.overlay}>
        <Pressable accessibilityLabel="Do identity verification later" accessibilityRole="button" onPress={onDismiss} style={styles.backdrop} />
        <View style={styles.surface}>
          <View style={styles.iconWrap}>
            <Feather accessibilityElementsHidden color={colors.primary} name="shield" size={25} />
          </View>
          <Text style={styles.title}>Secure your TaskLink account</Text>
          <Text style={styles.copy}>Your mobile number is verified. Next, upload your government ID and a matching selfie. You can add the remaining documents when ready.</Text>

          <View style={styles.requiredStep}>
            <View style={styles.stepIcon}>
              <Feather accessibilityElementsHidden color={colors.primary} name="credit-card" size={18} />
            </View>
            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>Government ID + matching selfie</Text>
              <Text style={styles.stepText}>Required first before final administrator review.</Text>
            </View>
            <Text style={styles.requiredLabel}>START HERE</Text>
          </View>

          <View style={styles.laterStep}>
            <Feather accessibilityElementsHidden color={colors.muted} name="clock" size={17} />
            <Text style={styles.laterText}>Medical certificate and police clearance can be uploaded later.</Text>
          </View>

          <Pressable accessibilityRole="button" onPress={continueVerification} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Upload ID & Selfie</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.laterButton, pressed && styles.pressed]}>
            <Text style={styles.laterButtonText}>Do this later</Text>
          </Pressable>
          <Text style={styles.note}>Add the remaining documents when ready; administrator approval is still required before an account becomes officially verified.</Text>
        </View>
      </View>
    </Modal>
  );
}

export function VerificationReminder({ onContinue, user }: Pick<VerificationOnboardingProps, "onContinue" | "user">) {
  const officiallyVerified = isOfficiallyVerified(user);
  const identitySubmitted = hasPriorityIdentityDocuments(user);
  const reducedMotion = useReducedMotion();
  const startPulse = usePairedPulse(!officiallyVerified && !identitySubmitted && !reducedMotion);
  const calculatedProgress = user ? calculateVerificationProgress(user).percentage : 0;
  const progressPercentage = typeof user?.verificationProgress === "number"
    ? Math.max(0, Math.min(100, Math.round(user.verificationProgress)))
    : calculatedProgress;
  if (officiallyVerified) return null;

  return (
    <View style={styles.reminder}>
      <View style={styles.reminderIcon}>
        <Feather accessibilityElementsHidden color={colors.primary} name={identitySubmitted ? "clock" : "shield"} size={20} />
      </View>
      <View style={styles.reminderCopy}>
        <Text style={styles.reminderTitle}>{identitySubmitted ? "Identity documents saved" : "Finish identity verification"}</Text>
        <Text style={styles.reminderText}>Verified accounts are more likely to be matched and accepted.</Text>
        <View style={styles.progressMeta}>
          <Text style={styles.progressLabel}>Verification progress</Text>
          <Text style={styles.progressValue}>{progressPercentage}%</Text>
        </View>
        <View accessibilityLabel={`Verification progress ${progressPercentage}%`} style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
        </View>
      </View>
      <Animated.View style={{ transform: [{ scale: startPulse }] }}>
        <Pressable accessibilityRole="button" onPress={onContinue} style={({ pressed }) => [styles.reminderButton, pressed && styles.pressed]}>
          <Text style={styles.reminderButtonText}>{progressPercentage > 0 ? "Continue" : "Start"}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  backdrop: { position: "absolute", inset: 0, backgroundColor: "rgba(24,28,28,0.38)" },
  surface: { width: "100%", maxWidth: 440, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: spacing.xl, gap: spacing.md, shadowColor: "#111827", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 12 },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.infoLight },
  title: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  requiredStep: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: "#8ED9CF", backgroundColor: "#F2FFFC", padding: spacing.md },
  stepIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.infoLight },
  stepCopy: { flex: 1, minWidth: 0, gap: 2 },
  stepTitle: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  stepText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  requiredLabel: { color: colors.primary, fontSize: 10, lineHeight: 14, fontWeight: "800" },
  laterStep: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingHorizontal: spacing.xs },
  laterText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
  primaryButton: { minHeight: 48, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  primaryButtonText: { color: colors.white, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  laterButton: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  laterButtonText: { color: colors.primary, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  note: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center" },
  reminder: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: "#8ED9CF", backgroundColor: "#F2FFFC", padding: spacing.md },
  reminderIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.infoLight },
  reminderCopy: { flex: 1, minWidth: 0, gap: 2 },
  reminderTitle: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  reminderText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  progressMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  progressLabel: { color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  progressValue: { color: colors.primary, fontSize: 11, lineHeight: 15, fontWeight: "800" },
  progressTrack: { height: 4, overflow: "hidden", borderRadius: 999, backgroundColor: "#CDECE7" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.primary },
  reminderButton: { minHeight: 36, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md, backgroundColor: colors.primary },
  reminderButtonText: { color: colors.white, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] }
});
