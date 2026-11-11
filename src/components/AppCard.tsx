import { PropsWithChildren } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { styles } from "../styles";
import { motion } from "../theme";
import { MotionPressable } from "./MotionPressable";

type AppCardProps = PropsWithChildren<{
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}>;

export function AppCard({ children, onPress, style }: AppCardProps) {
  if (onPress) {
    return (
      <MotionPressable accessibilityRole="button" motionScale={motion.scale.subtlePressed} style={({ pressed }) => [styles.card, pressed && styles.pressedOpacity, style]} onPress={onPress}>
        <View pointerEvents="none" style={styles.glassHighlight} />
        {children}
      </MotionPressable>
    );
  }

  return (
    <View style={[styles.card, style]}>
      <View pointerEvents="none" style={styles.glassHighlight} />
      {children}
    </View>
  );
}
