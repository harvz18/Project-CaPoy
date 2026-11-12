import { StyleSheet } from "react-native";
import { colors, radii, spacing } from "./theme";
import { typography } from "./typography";

export const interactiveCardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.22,
  shadowRadius: 7,
  elevation: 5
};

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
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
    backgroundColor: colors.background
  },
  centeredContent: {
    flexGrow: 1,
    alignItems: "stretch",
    justifyContent: "center",
    padding: spacing.lg
  },
  title: {
    ...typography.screenTitle,
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
    color: colors.primary,
    textAlign: "center",
    marginBottom: spacing.sm
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.muted,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.md
  },
  subheading: {
    ...typography.sectionTitleSmall,
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
    ...typography.bodyMedium,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  statNumber: {
    ...typography.heroNumber,
    color: colors.primary
  },
  statLabel: {
    ...typography.metadata,
    color: colors.muted,
    marginTop: spacing.xs
  },
  inputGroup: {
    marginBottom: spacing.md
  },
  inputLabel: {
    ...typography.fieldLabel,
    color: colors.text,
    marginBottom: spacing.xs
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.inputText,
    color: colors.text,
    backgroundColor: colors.white
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
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card
  },
  cardInteractive: interactiveCardShadow,
  heroCard: {
    borderColor: colors.infoLight,
    backgroundColor: colors.white
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
    backgroundColor: colors.white
  },
  linkText: {
    ...typography.bodyMedium,
    color: colors.text
  },
  appButton: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  appButtonCompact: {
    minHeight: 40,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  appButtonSecondary: {
    backgroundColor: colors.secondary
  },
  appButtonDanger: {
    backgroundColor: colors.danger
  },
  appButtonOutline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary
  },
  appButtonGhost: {
    backgroundColor: colors.mutedLight
  },
  appButtonDisabled: {
    opacity: 0.55
  },
  appButtonText: {
    color: colors.white,
    ...typography.button,
    textAlign: "center"
  },
  appButtonOutlineText: {
    color: colors.primary
  },
  appButtonGhostText: {
    color: colors.text
  },
  pressed: {
    opacity: 0.78
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
    backgroundColor: colors.white,
    marginVertical: spacing.md
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: "center"
  },
  emptyMessage: {
    ...typography.metadata,
    color: colors.muted,
    textAlign: "center",
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
    color: colors.muted,
  },
  messageMine: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.infoLight,
    marginBottom: spacing.sm
  },
  messageOther: {
    alignSelf: "flex-start",
    maxWidth: "85%",
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm
  },
  messageText: {
    ...typography.body,
    color: colors.text,
  },
  listContent: {
    paddingBottom: spacing.xl
  },
  footerNote: {
    marginTop: spacing.md,
    color: colors.muted,
    ...typography.metadata
  }
});
