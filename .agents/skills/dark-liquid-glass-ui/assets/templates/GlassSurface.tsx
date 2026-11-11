import { PropsWithChildren } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import {
  DarkGlassMaterialName,
  darkLiquidGlassMaterials,
  darkLiquidGlassRadii
} from "./darkLiquidGlassTokens";

type GlassSurfaceProps = PropsWithChildren<{
  material?: DarkGlassMaterialName;
  reducedTransparency?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function GlassSurface({
  children,
  material = "standard",
  reducedTransparency = false,
  style
}: GlassSurfaceProps) {
  const resolvedMaterial = reducedTransparency ? "accessible" : material;

  return (
    <View style={[styles.surface, darkLiquidGlassMaterials[resolvedMaterial], style]}>
      <View pointerEvents="none" style={styles.highlight} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: darkLiquidGlassRadii.card,
    overflow: "hidden",
    padding: 16
  },
  highlight: {
    position: "absolute",
    top: 0,
    right: 18,
    left: 18,
    height: 1,
    backgroundColor: "rgba(221, 255, 255, 0.58)"
  }
});
