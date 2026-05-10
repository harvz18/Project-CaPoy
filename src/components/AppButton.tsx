import { Pressable, StyleProp, Text, ViewStyle } from "react-native";
import { styles } from "../styles";

type AppButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";

type AppButtonProps = {
  title: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  compact?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  title,
  onPress,
  variant = "primary",
  compact,
  disabled,
  style
}: AppButtonProps) {
  const buttonStyle = [
    styles.appButton,
    compact && styles.appButtonCompact,
    variant === "secondary" && styles.appButtonSecondary,
    variant === "outline" && styles.appButtonOutline,
    variant === "danger" && styles.appButtonDanger,
    variant === "ghost" && styles.appButtonGhost,
    disabled && styles.appButtonDisabled,
    style
  ];

  const textStyle = [
    styles.appButtonText,
    variant === "outline" && styles.appButtonOutlineText,
    variant === "ghost" && styles.appButtonGhostText
  ];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [buttonStyle, pressed && !disabled && styles.pressed]}
    >
      <Text style={textStyle}>{title}</Text>
    </Pressable>
  );
}
