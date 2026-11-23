import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import type { MatchResult } from "../domain/matching";
import { formatTaskDuration, formatTaskPrice } from "../domain/taskMarketplace";
import { colors, radii, spacing } from "../theme";
import type { Task } from "../types";
import { formatDistance } from "../utils/location";
import { formatRelativeTime } from "../utils/relativeTime";
import { AppText as Text } from "./AppText";
import { SmartMatchBadge } from "./SmartMatchBadge";

type CompactJobCardProps = {
  task: Task;
  match: MatchResult;
  isBestMatch?: boolean;
  showMatchBadge?: boolean;
  showPostedTime?: boolean;
  onOpen: () => void;
  onQuickApply: () => void;
  onApplicationStatus: () => void;
  applying: boolean;
  hasApplied: boolean;
  style?: StyleProp<ViewStyle>;
};

export function CompactJobCard({
  task,
  match,
  isBestMatch = false,
  showMatchBadge = true,
  showPostedTime = true,
  onOpen,
  onQuickApply,
  onApplicationStatus,
  applying,
  hasApplied,
  style
}: CompactJobCardProps) {
  const quickActionLabel = hasApplied
    ? "Already Applied"
    : applying
      ? "Applying..."
      : task.pricingMode === "bidding"
        ? "Make Offer"
        : "Quick Apply";

  return (
    <View style={[styles.card, style]}>
      {isBestMatch ? (
        <>
          <View style={styles.topRow}>
          <View style={styles.bestMatchBadge}>
            <Feather accessibilityElementsHidden color={colors.success} name="award" size={13} />
            <Text style={styles.bestMatchText}>Best Match</Text>
          </View>
            <Text numberOfLines={1} style={styles.price}>{formatTaskPrice(task)}</Text>
          </View>
          <Text ellipsizeMode="tail" numberOfLines={1} style={styles.title}>{task.title}</Text>
        </>
      ) : (
        <View style={styles.titlePriceRow}>
          <Text ellipsizeMode="tail" numberOfLines={1} style={styles.title}>{task.title}</Text>
          <Text numberOfLines={1} style={styles.price}>{formatTaskPrice(task)}</Text>
        </View>
      )}
      {showPostedTime ? <Text style={styles.postedTime}>{formatRelativeTime(task.createdAt)}</Text> : null}

      <View style={styles.locationRow}>
        <Feather accessibilityElementsHidden color={colors.muted} name="map-pin" size={14} />
        <Text ellipsizeMode="tail" numberOfLines={1} style={styles.locationText}>
          {formatDistance(match.distanceKm)} · {task.locationAddress ?? task.location}
        </Text>
      </View>

      <View style={styles.metadataRow}>
        {showMatchBadge ? <SmartMatchBadge eligible={match.eligible} reasons={match.reasons} score={match.score} /> : null}
        <Text numberOfLines={1} style={styles.durationMetadata}>{formatTaskDuration(task)}</Text>
        <Text accessibilityElementsHidden style={styles.metadataSeparator}>·</Text>
        <Text ellipsizeMode="tail" numberOfLines={1} style={styles.categoryMetadata}>{task.category || task.requiredCapability || "Other"}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`View details for ${task.title}`}
          accessibilityRole="button"
          onPress={onOpen}
          style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}
        >
          <Text style={styles.detailsButtonText}>Details</Text>
        </Pressable>
        <View style={[
          styles.quickButtonShadow,
          hasApplied && styles.appliedButtonShadow,
          applying && !hasApplied && styles.buttonShadowDisabled
        ]}>
          <Pressable
            accessibilityLabel={`${quickActionLabel}: ${task.title}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: applying && !hasApplied }}
            disabled={applying && !hasApplied}
            onPress={hasApplied ? onApplicationStatus : onQuickApply}
            style={({ pressed }) => [
              styles.quickButton,
              hasApplied && styles.appliedButton,
              pressed && styles.pressed
            ]}
          >
            <LinearGradient
              colors={hasApplied
                ? ["#FFE37B", "#FFC43D", "#FEA619", "#F58A07"]
                : ["#29CDBD", "#0A9185", "#006E66", "#005C55", "#003F3B"]}
              end={{ x: 1, y: 1 }}
              locations={hasApplied ? [0, 0.34, 0.68, 1] : [0, 0.24, 0.5, 0.74, 1]}
              pointerEvents="none"
              start={{ x: 0, y: 0 }}
              style={styles.quickButtonGradient}
            />
            <Text style={[styles.quickButtonText, hasApplied && styles.appliedButtonText]}>{quickActionLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 6,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2
  },
  topRow: { minHeight: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  titlePriceRow: { minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  bestMatchBadge: { flexDirection: "row", alignItems: "center", gap: spacing.xs, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.successLight },
  bestMatchText: { color: colors.success, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  price: { maxWidth: "48%", flexShrink: 0, color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: "700", textAlign: "right" },
  title: { flex: 1, minWidth: 0, color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: "700" },
  postedTime: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  locationRow: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  locationText: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 13, lineHeight: 18 },
  metadataRow: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  durationMetadata: { flexShrink: 0, color: colors.muted, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  categoryMetadata: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  metadataSeparator: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  actions: { marginTop: "auto", paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(189,201,198,0.45)", flexDirection: "row", gap: spacing.sm },
  detailsButton: { flex: 1, minHeight: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4, elevation: 3 },
  detailsButtonText: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  quickButtonShadow: { flex: 1, minHeight: 44, borderRadius: radii.md, shadowColor: "#005C55", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  quickButton: { flex: 1, minHeight: 44, borderRadius: radii.md, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  buttonShadowDisabled: { shadowOpacity: 0.1, elevation: 1 },
  appliedButtonShadow: {
    shadowColor: "#FEA619",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 7,
    elevation: 7
  },
  appliedButton: { backgroundColor: "#FEA619" },
  quickButtonGradient: { position: "absolute", inset: 0 },
  quickButtonText: { color: colors.white, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  appliedButtonText: { color: "#684000" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
