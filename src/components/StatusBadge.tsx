import { View } from "react-native";
import { styles } from "../styles";
import { TaskStatus } from "../types";
import { AppText as Text } from "./AppText";

type StatusBadgeProps = {
  status: TaskStatus | "Available" | "Busy" | "Unread" | "Read";
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone =
    status === "Finished" || status === "Available" || status === "Read"
      ? styles.badgeSuccess
      : status === "Archived" || status === "Busy"
        ? styles.badgeMuted
        : status === "In Progress" || status === "Pending Approval"
          ? styles.badgeWarning
          : status === "Accepted" || status === "Applied"
            ? styles.badgeInfo
            : status === "Unread" || status === "Cancelled" || status === "Disputed" || status === "Expired"
              ? styles.badgeDanger
              : styles.badgePrimary;

  return (
    <View accessible accessibilityLabel={`Status: ${status}`} style={[styles.badge, tone]}>
      <Text style={styles.badgeText}>{status}</Text>
    </View>
  );
}
