import { Href, usePathname, useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { useApp } from "../context/AppContext";
import { NotificationShortcut } from "./NotificationShortcut";

export function AppHeader({ onHomeRefresh }: { onHomeRefresh?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, notifications } = useApp();
  const homePath = currentUser?.role === "client" ? "/client-dashboard" : "/worker-dashboard";
  const homeRoute: Href = homePath;
  const unreadCount = notifications.filter(
    (notification) => notification.userId === currentUser?.id && !notification.readStatus
  ).length;

  function handleLogoPress() {
    if (pathname === homePath) {
      onHomeRefresh?.();
      return;
    }
    router.replace(homeRoute);
  }

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel={pathname === homePath ? "Refresh Home" : "Go to Home"}
        accessibilityRole="button"
        hitSlop={4}
        onPress={handleLogoPress}
        style={({ pressed }) => [styles.logoButton, pressed && styles.pressed]}
      >
        <Image accessibilityIgnoresInvertColors resizeMode="contain" source={require("../../assets/tasklink-logo.jpg")} style={styles.logo} />
      </Pressable>
      <NotificationShortcut onPress={() => router.push("/notifications")} unreadCount={unreadCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1EF"
  },
  logoButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  logo: { width: 44, height: 44 },
  pressed: { opacity: 0.68 }
});
