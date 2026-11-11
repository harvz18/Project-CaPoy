import { StyleSheet } from "react-native";
import { colors, glass, radii, shadows, spacing } from "./theme";
import { typography } from "./typography";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent"
  },
  screenContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "transparent"
  },
  centeredContent: {
    flexGrow: 1,
    alignItems: "stretch",
    justifyContent: "center",
    padding: spacing.lg
  },
  title: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm
  },
  heading: {
    ...typography.sectionTitle,
    color: colors.text,
    marginBottom: spacing.md
  },
  heroTitle: {
    ...typography.screenTitle,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.muted,
    textAlign: "center"
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.md
  },
  subheading: {
    ...typography.sectionTitle,
    color: colors.text
  },
  text: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.sm
  },
  muted: {
    ...typography.metadata,
    color: colors.muted,
    marginBottom: spacing.sm
  },
  errorText: {
    ...typography.metadata,
    color: colors.danger,
    marginBottom: spacing.sm
  },
  statNumber: {
    ...typography.heroNumber,
    color: colors.primary
  },
  statLabel: {
    ...typography.fieldLabel,
    color: colors.muted,
    marginTop: spacing.xs
  },
  inputGroup: {
    marginBottom: spacing.md
  },
  inputLabel: {
    ...typography.inputText,
    color: colors.text,
    marginBottom: spacing.xs
  },
  input: {
    ...typography.inputText,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    backgroundColor: "rgba(3, 35, 52, 0.62)",
    ...shadows.resting
  },
  inputFocused: {
    borderColor: colors.focus,
    borderWidth: 2,
    shadowColor: colors.focus,
    shadowOpacity: 0.10
  },
  inputError: {
    borderColor: colors.danger
  },
  inputErrorText: {
    ...typography.metadata,
    color: colors.danger,
    marginTop: spacing.xs
  },
  inputHelperText: {
    ...typography.metadata,
    color: colors.muted,
    marginTop: spacing.xs
  },
  requiredMark: {
    ...typography.inputText,
    color: colors.danger
  },
  inputMultiline: {
    minHeight: 94,
    textAlignVertical: "top"
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    marginBottom: spacing.sm
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  twoColumn: {
    flexDirection: "row",
    gap: spacing.md
  },
  flex: {
    flex: 1
  },
  buttonGap: {
    height: spacing.sm
  },
  actionGroup: {
    gap: spacing.sm,
    marginVertical: spacing.md
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    overflow: "hidden",
    ...shadows.raised
  },
  glassHighlight: {
    position: "absolute",
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: glass.highlight
  },
  heroCard: {
    borderColor: colors.borderHighlight,
    backgroundColor: "rgba(55, 126, 151, 0.34)"
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: spacing.md
  },
  linkButton: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    backgroundColor: glass.standard
  },
  linkText: {
    ...typography.button,
    color: colors.text
  },
  appButton: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: "rgba(181, 255, 249, 0.54)",
    overflow: "hidden",
    ...shadows.raised
  },
  appButtonCompact: {
    minHeight: 40,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  appButtonSecondary: {
    backgroundColor: "rgba(41, 172, 213, 0.72)"
  },
  appButtonDanger: {
    backgroundColor: colors.danger
  },
  appButtonOutline: {
    backgroundColor: "rgba(3, 35, 52, 0.42)",
    borderWidth: 1,
    borderColor: colors.primary
  },
  appButtonGhost: {
    backgroundColor: glass.subtle,
    borderColor: colors.border
  },
  appButtonDisabled: {
    opacity: 0.55
  },
  appButtonText: {
    ...typography.button,
    color: colors.white,
    textAlign: "center"
  },
  appButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  appButtonOutlineText: {
    color: colors.text
  },
  appButtonGhostText: {
    color: colors.text
  },
  pressed: {
    opacity: 0.88
  },
  pressedOpacity: {
    opacity: 0.88
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.mutedLight,
    marginBottom: spacing.sm
  },
  badgePrimary: {
    backgroundColor: colors.infoLight
  },
  badgeInfo: {
    backgroundColor: colors.infoLight
  },
  badgeWarning: {
    backgroundColor: colors.warningLight
  },
  badgeSuccess: {
    backgroundColor: colors.successLight
  },
  badgeDanger: {
    backgroundColor: colors.dangerLight
  },
  badgeMuted: {
    backgroundColor: colors.mutedLight
  },
  badgeText: {
    ...typography.badge,
    color: colors.text
  },
  emptyState: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: "center",
    backgroundColor: glass.standard,
    marginVertical: spacing.md,
    ...shadows.resting
  },
  emptyTitle: {
    ...typography.cardTitleStrong,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: "center"
  },
  emptyMessage: {
    ...typography.metadata,
    color: colors.muted,
    textAlign: "center"
  },
  emptyAction: {
    minHeight: 48,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  emptyActionText: {
    ...typography.button,
    color: colors.white
  },
  pill: {
    borderRadius: radii.pill,
    backgroundColor: colors.mutedLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: "flex-start"
  },
  pillText: {
    ...typography.badge,
    color: colors.muted
  },
  messageMine: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(0, 201, 179, 0.26)",
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    marginBottom: spacing.sm
  },
  messageOther: {
    alignSelf: "flex-start",
    maxWidth: "85%",
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: glass.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm
  },
  messageText: {
    ...typography.metadata,
    color: colors.text
  },
  listContent: {
    paddingBottom: spacing.xl
  },
  footerNote: {
    ...typography.metadata,
    marginTop: spacing.md,
    color: colors.muted
  }
});
