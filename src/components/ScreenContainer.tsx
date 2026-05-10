import { PropsWithChildren } from "react";
import { ScrollView, StyleProp, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { styles } from "../styles";

type ScreenContainerProps = PropsWithChildren<{
  scroll?: boolean;
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function ScreenContainer({ children, scroll, centered, style }: ScreenContainerProps) {
  if (scroll) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.screenContent, centered && styles.centeredContent, style]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, centered && styles.centeredContent, style]} edges={["top", "left", "right"]}>
      {children}
    </SafeAreaView>
  );
}
