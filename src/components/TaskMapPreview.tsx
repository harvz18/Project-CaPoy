import Feather from "@expo/vector-icons/Feather";
import { useEffect, useState } from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { formatTaskPrice } from "../domain/taskMarketplace";
import { Task } from "../types";
import { AppText as Text } from "./AppText";

type TaskMapPreviewProps = {
  task?: Task;
  onDismiss: () => void;
  onViewTask: (task: Task) => void;
  style?: StyleProp<ViewStyle>;
};

/** A compact, on-map task preview that keeps full job details one tap away. */
export function TaskMapPreview({ task, onDismiss, onViewTask, style }: TaskMapPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [task?.id]);

  if (!task) return null;

  return (
    <View accessibilityLabel={`Task preview for ${task.title}`} style={[styles.card, style]}>
      <View style={styles.compactRow}>
        <Pressable
          accessibilityLabel={`${expanded ? "Hide" : "Show"} details for ${task.title}`}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((current) => !current)}
          style={({ pressed }) => [styles.titleButton, pressed && styles.pressed]}
        >
          <Text numberOfLines={1} style={styles.title}>{task.title}</Text>
          <Feather accessibilityElementsHidden color="#005C55" name={expanded ? "chevron-up" : "chevron-down"} size={20} />
        </Pressable>
        <Pressable accessibilityLabel="Close task preview" accessibilityRole="button" hitSlop={8} onPress={onDismiss} style={styles.closeButton}>
          <Feather accessibilityElementsHidden color="#3E4947" name="x" size={17} />
        </Pressable>
      </View>
      {expanded ? (
        <View style={styles.details}>
          <Text numberOfLines={1} style={styles.meta}>{formatTaskPrice(task)} · {task.locationAddress ?? task.location}</Text>
          <Pressable accessibilityRole="button" onPress={() => onViewTask(task)} style={({ pressed }) => [styles.viewButton, pressed && styles.pressed]}>
            <Text style={styles.viewButtonText}>View Task</Text>
            <Feather accessibilityElementsHidden color="#FFFFFF" name="arrow-up-right" size={16} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: "#BDC9C6", borderRadius: 12, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.97)", elevation: 6, overflow: "hidden", shadowColor: "#17211F", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
  compactRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 2, paddingLeft: 12, paddingRight: 4 },
  titleButton: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 },
  title: { flex: 1, color: "#111827", fontSize: 13, lineHeight: 18, fontWeight: "900" },
  closeButton: { width: 34, minHeight: 34, alignItems: "center", justifyContent: "center" },
  details: { gap: 10, borderTopColor: "#E1E7E5", borderTopWidth: 1, padding: 12 },
  meta: { color: "#3E4947", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  viewButton: { minHeight: 38, borderRadius: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, backgroundColor: "#005C55" },
  viewButtonText: { color: "#FFFFFF", fontSize: 13, lineHeight: 18, fontWeight: "900" },
  pressed: { opacity: 0.78 }
});
