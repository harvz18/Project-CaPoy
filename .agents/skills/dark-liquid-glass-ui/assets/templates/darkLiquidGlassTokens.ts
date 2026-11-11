import type { TextStyle, ViewStyle } from "react-native";

export type DarkGlassMaterialName =
  | "subtle"
  | "standard"
  | "elevated"
  | "highlighted"
  | "accessible";

export const darkLiquidGlassColors = {
  backgroundPrimary: "#042D40",
  backgroundSecondary: "#063A4E",
  backgroundDeep: "#032334",
  backgroundNavy: "#062A46",
  cyan: "#14D9E2",
  teal: "#00C9B3",
  emerald: "#00DFAC",
  blue: "#29ACD5",
  textPrimary: "#F5FCFF",
  textSecondary: "#BBD5DE",
  textMuted: "#92B2C0",
  focus: "#5DF7F2",
  success: "#26E5B2",
  warning: "#F4C95D",
  danger: "#FF7D8C",
  scrim: "rgba(1, 15, 25, 0.68)",
  glassBorder: "rgba(207, 249, 255, 0.32)",
  glassBorderBright: "rgba(181, 255, 249, 0.48)"
} as const;

export const darkLiquidGlassRadii = {
  control: 12,
  input: 14,
  card: 20,
  panel: 24,
  modal: 26,
  navigation: 28,
  pill: 999
} as const;

type MaterialStyle = Pick<
  ViewStyle,
  | "backgroundColor"
  | "borderColor"
  | "borderWidth"
  | "shadowColor"
  | "shadowOffset"
  | "shadowOpacity"
  | "shadowRadius"
  | "elevation"
>;

export const darkLiquidGlassMaterials: Record<DarkGlassMaterialName, MaterialStyle> = {
  subtle: {
    backgroundColor: "rgba(86, 159, 178, 0.12)",
    borderColor: "rgba(207, 249, 255, 0.20)",
    borderWidth: 1,
    shadowColor: "#001722",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 1
  },
  standard: {
    backgroundColor: "rgba(91, 169, 188, 0.18)",
    borderColor: darkLiquidGlassColors.glassBorder,
    borderWidth: 1,
    shadowColor: "#001722",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 20,
    elevation: 3
  },
  elevated: {
    backgroundColor: "rgba(55, 126, 151, 0.34)",
    borderColor: "rgba(207, 249, 255, 0.40)",
    borderWidth: 1,
    shadowColor: "#00131E",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.30,
    shadowRadius: 28,
    elevation: 7
  },
  highlighted: {
    backgroundColor: "rgba(75, 159, 178, 0.30)",
    borderColor: darkLiquidGlassColors.glassBorderBright,
    borderWidth: 1,
    shadowColor: darkLiquidGlassColors.cyan,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.20,
    shadowRadius: 26,
    elevation: 8
  },
  accessible: {
    backgroundColor: "rgba(3, 35, 52, 0.94)",
    borderColor: "rgba(207, 249, 255, 0.28)",
    borderWidth: 1,
    shadowColor: "#00131E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 5
  }
};

export const darkLiquidGlassType: Record<
  "display" | "heading" | "body" | "label" | "caption" | "numeric",
  TextStyle
> = {
  display: { color: darkLiquidGlassColors.textPrimary, fontSize: 36, fontWeight: "800", lineHeight: 43 },
  heading: { color: darkLiquidGlassColors.textPrimary, fontSize: 22, fontWeight: "700", lineHeight: 29 },
  body: { color: darkLiquidGlassColors.textPrimary, fontSize: 16, fontWeight: "400", lineHeight: 24 },
  label: { color: darkLiquidGlassColors.textPrimary, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  caption: { color: darkLiquidGlassColors.textSecondary, fontSize: 12, fontWeight: "500", lineHeight: 17 },
  numeric: { color: darkLiquidGlassColors.textPrimary, fontSize: 26, fontWeight: "700", lineHeight: 32 }
};
