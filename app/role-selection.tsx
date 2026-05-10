import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../src/context/AppContext";
import { Role } from "../src/types";

const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceLow: "#F1F4F3",
  surfaceHigh: "#E0E3E1",
  primary: "#005C55",
  primaryFixed: "#9CF2E8",
  secondary: "#855300",
  secondaryFixed: "#FFDDB8",
  secondaryContainer: "#FEA619",
  text: "#181C1C",
  textStrong: "#111827",
  muted: "#3E4947",
  outline: "#6E7977",
  outlineVariant: "#BDC9C6",
  white: "#FFFFFF"
};

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { setRole } = useApp();

  function chooseRole(role: Role) {
    setRole(role);
    router.replace(role === "worker" ? "/worker-dashboard" : "/client-dashboard");
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={styles.title}>Welcome to TaskLink</Text>
          <Text style={styles.subtitle}>Choose how you want to use the platform today. You can always switch later.</Text>
        </View>

        <View style={styles.optionStack}>
          <RoleCard
            accent="primary"
            icon="W"
            title="Find Work"
            description="Browse local jobs, offer your skills, and earn money on your own schedule."
            buttonText="I want to work"
            onPress={() => chooseRole("worker")}
          />
          <RoleCard
            accent="secondary"
            icon="H"
            title="Hire Workers"
            description="Post a task and find reliable help for home, office, or personal errands quickly."
            buttonText="I want to hire"
            onPress={() => chooseRole("client")}
          />
        </View>

        <View style={styles.termsBlock}>
          <Text style={styles.termsText}>By continuing, you agree to our Terms of Service</Text>
          <View style={styles.linkRow}>
            <Text style={styles.linkText}>Terms</Text>
            <Text style={styles.linkText}>Privacy</Text>
            <Text style={styles.linkText}>Help Center</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AppHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Pressable accessibilityRole="button" style={styles.iconButton}>
          <Text style={styles.iconButtonText}>≡</Text>
        </Pressable>
        <Text style={styles.brand}>TASKLINK</Text>
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>U</Text>
      </View>
    </View>
  );
}

type RoleCardProps = {
  accent: "primary" | "secondary";
  icon: string;
  title: string;
  description: string;
  buttonText: string;
  onPress: () => void;
};

function RoleCard({ accent, icon, title, description, buttonText, onPress }: RoleCardProps) {
  const isPrimary = accent === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roleCard, pressed && styles.pressed]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.cardTextBlock}>
          <View style={[styles.roleIcon, { backgroundColor: isPrimary ? palette.primaryFixed : palette.secondaryFixed }]}>
            <Text style={[styles.roleIconText, { color: isPrimary ? palette.primary : palette.secondary }]}>{icon}</Text>
          </View>
          <Text style={[styles.roleTitle, { color: isPrimary ? palette.primary : palette.secondary }]}>{title}</Text>
          <Text style={styles.roleDescription}>{description}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
      <View style={[styles.roleButton, { backgroundColor: isPrimary ? palette.primary : palette.secondary }]}>
        <Text style={styles.roleButtonText}>{buttonText}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1EF"
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  iconButtonText: {
    color: palette.primary,
    fontSize: 24,
    fontWeight: "800"
  },
  brand: {
    color: palette.primary,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800"
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceHigh,
    borderWidth: 1,
    borderColor: palette.outlineVariant
  },
  avatarText: {
    color: palette.muted,
    fontWeight: "900"
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 36,
    alignItems: "center"
  },
  intro: {
    width: "100%",
    maxWidth: 672,
    alignItems: "center",
    marginBottom: 36
  },
  title: {
    color: palette.textStrong,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    textAlign: "center"
  },
  subtitle: {
    color: "#4B5563",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 8
  },
  optionStack: {
    width: "100%",
    maxWidth: 672,
    gap: 12
  },
  roleCard: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16
  },
  cardTextBlock: {
    flex: 1
  },
  roleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  roleIconText: {
    fontSize: 24,
    fontWeight: "900"
  },
  roleTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    marginBottom: 4
  },
  roleDescription: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24
  },
  chevron: {
    color: palette.outline,
    fontSize: 32,
    lineHeight: 40
  },
  roleButton: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24
  },
  roleButtonText: {
    color: palette.white,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
  },
  termsBlock: {
    marginTop: 44,
    alignItems: "center"
  },
  termsText: {
    color: palette.outline,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
    textAlign: "center"
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 24
  },
  linkText: {
    color: palette.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    textDecorationLine: "underline"
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }]
  }
});
