import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "./AppText";

type SmartMatchBadgeProps = {
  score?: number;
  eligible?: boolean;
  reasons?: string[];
};

/** Compact, explainable matching UI. The details stay on demand to keep cards clean. */
export function SmartMatchBadge({ score = 0, eligible = true, reasons = [] }: SmartMatchBadgeProps) {
  const [detailsVisible, setDetailsVisible] = useState(false);
  const displayScore = Math.max(0, Math.min(100, Math.round(score)));
  const visibleReasons = reasons.filter(Boolean).slice(0, 4);

  return (
    <>
      <View style={[styles.badge, eligible ? styles.badgeEligible : styles.badgeReview]}>
        <Text style={[styles.badgeText, eligible ? styles.badgeTextEligible : styles.badgeTextReview]}>
          {eligible ? `${displayScore}% Match` : "Match needs review"}
        </Text>
        <Pressable
          accessibilityLabel="Why this task is a smart match"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setDetailsVisible(true)}
          style={styles.infoButton}
        >
          <Feather accessibilityElementsHidden color={eligible ? "#005C55" : "#855300"} name="info" size={16} />
        </Pressable>
      </View>

      <Modal animationType="fade" onRequestClose={() => setDetailsVisible(false)} transparent visible={detailsVisible}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close smart match details" onPress={() => setDetailsVisible(false)} style={styles.backdrop}>
          <View onStartShouldSetResponder={() => true} style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <View>
                <Text style={styles.dialogTitle}>Why this is a Smart Match</Text>
                <Text style={styles.dialogScore}>{eligible ? `${displayScore}% Match` : "Needs review"}</Text>
              </View>
              <Feather accessibilityElementsHidden color="#005C55" name="zap" size={22} />
            </View>
            <Text style={styles.dialogIntro}>TaskLink compares the task requirements with the tasker profile and current service area.</Text>
            <View style={styles.reasonList}>
              {visibleReasons.length ? visibleReasons.map((reason) => (
                <View key={reason} style={styles.reasonRow}>
                  <View style={styles.reasonBullet} />
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              )) : <Text style={styles.reasonText}>Match details are still being prepared.</Text>}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setDetailsVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", minHeight: 30, borderRadius: 15, paddingLeft: 10, paddingRight: 6, flexDirection: "row", alignItems: "center", gap: 5 },
  badgeEligible: { backgroundColor: "#E2F5EF" },
  badgeReview: { backgroundColor: "#FFF3D7" },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: "900" },
  badgeTextEligible: { color: "#005C55" },
  badgeTextReview: { color: "#855300" },
  infoButton: { width: 26, minHeight: 26, alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.42)" },
  dialog: { width: "100%", maxWidth: 390, borderRadius: 16, padding: 20, gap: 14, backgroundColor: "#FFFFFF" },
  dialogHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  dialogTitle: { color: "#111827", fontSize: 18, lineHeight: 24, fontWeight: "900" },
  dialogScore: { color: "#005C55", fontSize: 14, lineHeight: 20, fontWeight: "900", marginTop: 2 },
  dialogIntro: { color: "#3E4947", fontSize: 13, lineHeight: 19 },
  reasonList: { gap: 9 },
  reasonRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  reasonBullet: { width: 7, height: 7, borderRadius: 4, marginTop: 6, backgroundColor: "#005C55" },
  reasonText: { flex: 1, color: "#181C1C", fontSize: 13, lineHeight: 19 },
  closeButton: { minHeight: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#005C55" },
  closeButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" }
});
