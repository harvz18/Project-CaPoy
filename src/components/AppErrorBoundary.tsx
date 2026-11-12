import React, { ErrorInfo, PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { supportContactLabel } from "../config/support";

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
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#F8FAFC" },
  title: { color: "#0F172A", fontSize: 22, lineHeight: 30, fontWeight: "900", textAlign: "center" },
  message: { maxWidth: 460, color: "#475569", fontSize: 15, lineHeight: 22, textAlign: "center" },
  support: { color: "#005C55", fontSize: 14, lineHeight: 20, fontWeight: "800", textAlign: "center" },
  button: { minHeight: 48, borderRadius: 10, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#005C55" },
  buttonText: { color: "#FFFFFF", fontSize: 14, lineHeight: 20, fontWeight: "900" }
});
