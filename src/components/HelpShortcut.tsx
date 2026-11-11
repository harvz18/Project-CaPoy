import Feather from "@expo/vector-icons/Feather";
import { Pressable, StyleSheet } from "react-native";
import { colors, glass, shadows } from "../theme";

export function HelpShortcut({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Frequently asked questions and help"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Feather accessibilityElementsHidden color={colors.primary} name="help-circle" size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: glass.standard,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    ...shadows.resting
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] }
});
