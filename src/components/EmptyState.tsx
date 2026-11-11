import { MotionPressable as Pressable } from "./MotionPressable";
import { MotionReveal } from "./MotionReveal";
import { styles } from "../styles";
import { AppText as Text } from "./AppText";

type EmptyStateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ actionLabel, message, onAction, title }: EmptyStateProps) {
  return (
    <MotionReveal accessibilityLiveRegion="polite" style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable accessibilityLabel={actionLabel} accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </MotionReveal>
  );
}
