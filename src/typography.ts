import { StyleSheet } from "react-native";

export const interFonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold"
} as const;

export const typography = StyleSheet.create({
  screenTitle: { fontFamily: interFonts.bold, fontSize: 22, lineHeight: 28 },
  sectionTitle: { fontFamily: interFonts.bold, fontSize: 20, lineHeight: 26 },
  sectionTitleSmall: { fontFamily: interFonts.bold, fontSize: 18, lineHeight: 24 },
  cardTitle: { fontFamily: interFonts.semibold, fontSize: 16, lineHeight: 24 },
  cardTitleStrong: { fontFamily: interFonts.bold, fontSize: 16, lineHeight: 24 },
  inputText: { fontFamily: interFonts.regular, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: interFonts.regular, fontSize: 14, lineHeight: 20 },
  bodyMedium: { fontFamily: interFonts.medium, fontSize: 14, lineHeight: 20 },
  price: { fontFamily: interFonts.semibold, fontSize: 14, lineHeight: 20 },
  button: { fontFamily: interFonts.semibold, fontSize: 14, lineHeight: 20 },
  fieldLabel: { fontFamily: interFonts.medium, fontSize: 12, lineHeight: 16 },
  metadata: { fontFamily: interFonts.regular, fontSize: 12, lineHeight: 17 },
  caption: { fontFamily: interFonts.regular, fontSize: 12, lineHeight: 16 },
  badge: { fontFamily: interFonts.semibold, fontSize: 12, lineHeight: 16 },
  bottomNav: { fontFamily: interFonts.medium, fontSize: 11, lineHeight: 14 },
  overline: { fontFamily: interFonts.bold, fontSize: 10, lineHeight: 14 },
  heroNumber: { fontFamily: interFonts.extrabold, fontSize: 22, lineHeight: 28 }
});

export type TypographyRole = keyof typeof typography;
