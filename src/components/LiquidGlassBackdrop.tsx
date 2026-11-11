import { StyleSheet, View } from "react-native";
import { colors, glass } from "../theme";

export function LiquidGlassBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.canvas} />
      <View style={[styles.field, styles.tealField]} />
      <View style={[styles.field, styles.violetField]} />
      <View style={[styles.field, styles.cyanField]} />
      <View style={styles.diagonalLight} />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.canvas
  },
  field: {
    position: "absolute",
    borderRadius: 999
  },
  tealField: {
    width: 500,
    height: 500,
    top: -260,
    right: -260,
    backgroundColor: glass.tealTint,
    transform: [{ scaleX: 1.25 }]
  },
  violetField: {
    width: 460,
    height: 460,
    left: -310,
    top: "30%",
    backgroundColor: glass.violetTint,
    transform: [{ scaleY: 1.45 }]
  },
  cyanField: {
    width: 480,
    height: 480,
    right: -300,
    bottom: -240,
    backgroundColor: glass.cyanTint,
    transform: [{ scaleX: 1.3 }]
  },
  diagonalLight: {
    position: "absolute",
    width: 150,
    height: "125%",
    top: -90,
    right: "18%",
    borderRadius: 999,
    backgroundColor: "rgba(20, 217, 226, 0.045)",
    transform: [{ rotate: "34deg" }, { scaleX: 1.8 }]
  }
});
