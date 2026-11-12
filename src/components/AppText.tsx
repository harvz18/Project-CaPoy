import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, TextInputProps, TextProps } from "react-native";
import { interFonts, typography, TypographyRole } from "../typography";

export type AppTextProps = TextProps & {
  variant?: TypographyRole;
};

export function AppText({ allowFontScaling = true, style, variant = "body", ...props }: AppTextProps) {
  return <NativeText {...props} allowFontScaling={allowFontScaling} style={resolveTextStyle(style, variant)} />;
}

export function AppTextInput({ allowFontScaling = true, style, ...props }: TextInputProps) {
  return <NativeTextInput {...props} allowFontScaling={allowFontScaling} style={resolveTextStyle(style, "inputText")} />;
}

function resolveTextStyle(style: TextProps["style"], variant: TypographyRole) {
  const flattened = StyleSheet.flatten(style) ?? {};
  const { fontFamily: _fontFamily, fontSize, fontWeight, lineHeight, ...layoutAndColor } = flattened;
  const resolvedVariant = fontSize === undefined && fontWeight === undefined ? variant : getVariant(fontSize, fontWeight, variant);
  return [typography[resolvedVariant], layoutAndColor];
}

function getVariant(fontSize: number | undefined, fontWeight: string | number | undefined, fallback: TypographyRole): TypographyRole {
  const weight = Number(fontWeight ?? 400);
  const size = Number(fontSize ?? typography[fallback].fontSize);
  if (size >= 22 && weight >= 800) return "heroNumber";
  if (size >= 22) return "screenTitle";
  if (size >= 20) return "sectionTitle";
  if (size >= 18) return "sectionTitleSmall";
  if (size >= 16) return weight >= 700 ? "cardTitleStrong" : fallback === "inputText" ? "inputText" : "cardTitle";
  if (size <= 10 && weight >= 700) return "overline";
  if (size <= 12) return weight >= 600 ? "badge" : "metadata";
  if (weight >= 600) return fallback === "inputText" ? "inputText" : "button";
  if (weight >= 500) return "bodyMedium";
  return fallback;
}
