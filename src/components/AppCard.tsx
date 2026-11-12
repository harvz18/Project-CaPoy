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
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed, style]} onPress={onPress}>
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
}
