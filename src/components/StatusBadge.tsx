import { Text, View } from "react-native";
import { styles } from "../styles";
import { TaskStatus } from "../types";

type StatusBadgeProps = {
  status: TaskStatus | "Available" | "Busy" | "Unread" | "Read";
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone =
    status === "Finished" || status === "Available" || status === "Read"
      ? styles.badgeSuccess
      : status === "Archived" || status === "Busy"
        ? styles.badgeMuted
        : status === "In Progress"
          ? styles.badgeWarning
          : status === "Accepted"
            ? styles.badgeInfo
            : status === "Unread"
              ? styles.badgeDanger
              : styles.badgePrimary;

  return (
    <View style={[styles.badge, tone]}>
      <Text style={styles.badgeText}>{status}</Text>
    </View>
  );
}
