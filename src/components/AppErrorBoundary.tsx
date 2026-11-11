import React, { ErrorInfo, PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { MotionPressable as Pressable } from "./MotionPressable";
import { supportContactLabel } from "../config/support";
import { colors, glass, shadows } from "../theme";
import { typography } from "../typography";
import { AppText as Text } from "./AppText";

type State = { failed: boolean };

export class AppErrorBoundary extends React.Component<PropsWithChildren, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // This is intentionally local until the project owner approves a remote crash processor.
    console.error("TaskLink unrecoverable render error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View accessibilityRole="alert" style={styles.screen}>
        <Text style={styles.title}>TaskLink could not display this screen</Text>
        <Text style={styles.message}>Try restoring the screen once. If it fails again, record the steps and contact beta support.</Text>
        <Text selectable style={styles.support}>{supportContactLabel()}</Text>
        <Pressable accessibilityRole="button" onPress={() => this.setState({ failed: false })} style={styles.button}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: glass.solid, ...shadows.floating },
  title: { ...typography.screenTitle, color: colors.text, textAlign: "center" },
  message: { ...typography.body, maxWidth: 460, color: colors.muted, textAlign: "center" },
  support: { ...typography.body, color: colors.primary, textAlign: "center" },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, ...shadows.raised },
  buttonText: { ...typography.button, color: "#FFFFFF" }
});
