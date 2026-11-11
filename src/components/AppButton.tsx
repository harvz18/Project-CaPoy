import { ActivityIndicator, StyleProp, View, ViewStyle } from "react-native";
import { styles } from "../styles";
import { colors } from "../theme";
import { AppText as Text } from "./AppText";
import { MotionPressable } from "./MotionPressable";

type AppButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";

type AppButtonProps = {
  title: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  compact?: boolean;
  disabled?: boolean;
  selected?: boolean;
  loading?: boolean;
  loadingTitle?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  title,
  onPress,
  variant = "primary",
  compact,
  disabled,
  selected,
  loading = false,
  loadingTitle,
  accessibilityLabel,
  accessibilityHint,
  style
}: AppButtonProps) {
  const unavailable = Boolean(disabled || loading);
  const buttonStyle = [
    styles.appButton,
    compact && styles.appButtonCompact,
    variant === "secondary" && styles.appButtonSecondary,
    variant === "outline" && styles.appButtonOutline,
    variant === "danger" && styles.appButtonDanger,
    variant === "ghost" && styles.appButtonGhost,
    unavailable && styles.appButtonDisabled,
    style
  ];

  const textStyle = [
    styles.appButtonText,
    variant === "outline" && styles.appButtonOutlineText,
    variant === "ghost" && styles.appButtonGhostText
  ];

  return (
    <MotionPressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable, selected }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [buttonStyle, pressed && !unavailable && styles.pressedOpacity]}
    >
      {variant === "primary" ? <View pointerEvents="none" style={styles.glassHighlight} /> : null}
      <View style={styles.appButtonContent}>
        {loading ? <ActivityIndicator color={colors.white} size="small" /> : null}
        <Text style={textStyle}>{loading ? loadingTitle ?? title : title}</Text>
      </View>
    </MotionPressable>
  );
}
