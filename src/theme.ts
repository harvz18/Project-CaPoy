export const colors = {
  primary: "#00C9B3",
  primaryDark: "#009E95",
  primarySoft: "rgba(38, 229, 178, 0.18)",
  secondary: "#29ACD5",
  accent: "#14D9E2",
  canvas: "#032334",
  background: "#042D40",
  card: "rgba(91, 169, 188, 0.18)",
  cardSolid: "rgba(3, 35, 52, 0.94)",
  cardSubtle: "rgba(86, 159, 178, 0.12)",
  text: "#F5FCFF",
  muted: "#BBD5DE",
  border: "rgba(207, 249, 255, 0.32)",
  borderHighlight: "rgba(181, 255, 249, 0.48)",
  focus: "#5DF7F2",
  success: "#26E5B2",
  danger: "#FF7D8C",
  warning: "#F4C95D",
  infoLight: "rgba(20, 217, 226, 0.16)",
  successLight: "rgba(38, 229, 178, 0.16)",
  warningLight: "rgba(244, 201, 93, 0.16)",
  dangerLight: "rgba(255, 125, 140, 0.16)",
  mutedLight: "rgba(86, 159, 178, 0.16)",
  white: "#FFFFFF"
};

export const screenPalette = {
  background: colors.background,
  surface: colors.card,
  surfaceLow: colors.cardSubtle,
  surfaceContainer: "rgba(55, 126, 151, 0.24)",
  surfaceHigh: colors.cardSolid,
  primary: colors.primary,
  primaryFixed: "#7FF6E6",
  primaryContainer: "#087F78",
  secondary: colors.secondary,
  secondaryFixed: "#A8EDFF",
  secondaryContainer: "#137FA0",
  tertiaryContainer: "#8D5260",
  text: colors.text,
  textStrong: "#FFFFFF",
  muted: colors.muted,
  outline: "#83A9B6",
  outlineVariant: colors.border,
  success: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  urgent: colors.danger,
  pending: colors.warning,
  line: colors.border,
  white: colors.white
} as const;

export const glass = {
  subtle: "rgba(86, 159, 178, 0.12)",
  standard: "rgba(91, 169, 188, 0.18)",
  elevated: "rgba(55, 126, 151, 0.34)",
  solid: "rgba(3, 35, 52, 0.94)",
  highlight: "rgba(221, 255, 255, 0.58)",
  tealTint: "rgba(0, 223, 172, 0.14)",
  violetTint: "rgba(41, 172, 213, 0.11)",
  cyanTint: "rgba(20, 217, 226, 0.15)",
  scrim: "rgba(1, 15, 25, 0.68)"
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999
};

export const typography = {
  title: 30,
  heading: 22,
  subheading: 17,
  body: 16,
  small: 14,
  tiny: 12
};

export const shadows = {
  resting: {
    shadowColor: "#001722",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 2
  },
  raised: {
    shadowColor: "#001722",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 5
  },
  floating: {
    shadowColor: "#00131E",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.32,
    shadowRadius: 30,
    elevation: 9
  }
} as const;

export const motion = {
  fast: 140,
  standard: 220,
  deliberate: 320,
  pressedScale: 0.985
} as const;
