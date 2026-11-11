import { PropsWithChildren } from "react";
import { Pressable, StyleProp, View, ViewStyle } from "react-native";
import { styles } from "../styles";

type AppCardProps = PropsWithChildren<{
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}>;

export function AppCard({ children, onPress, style }: AppCardProps) {
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.card, pressed && styles.pressed, style]} onPress={onPress}>
        <View pointerEvents="none" style={styles.glassHighlight} />
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, style]}>
      <View pointerEvents="none" style={styles.glassHighlight} />
      {children}
    </View>
  );
}
