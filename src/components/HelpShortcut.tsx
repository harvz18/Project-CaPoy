import Feather from "@expo/vector-icons/Feather";
import { Pressable, StyleSheet } from "react-native";

export function HelpShortcut({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Frequently asked questions and help"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Feather accessibilityElementsHidden color="#005C55" name="help-circle" size={22} />
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
    backgroundColor: "#E7F3F0",
    borderWidth: 1,
    borderColor: "#BDC9C6"
  },
  pressed: { opacity: 0.72 }
});
