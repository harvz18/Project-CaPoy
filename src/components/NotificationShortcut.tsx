import { Pressable, StyleSheet, Text, View } from "react-native";

export function NotificationShortcut({ onPress, unreadCount }: { onPress: () => void; unreadCount: number }) {
  const label = unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications";
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <View pointerEvents="none" style={styles.bell}>
        <View style={styles.bellDome} />
        <View style={styles.bellRim} />
        <View style={styles.bellClapper} />
      </View>
      {unreadCount ? (
        <View accessibilityLabel={`${unreadCount} unread notifications`} style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F3F0",
    borderWidth: 1,
    borderColor: "#BDC9C6"
  },
  bell: { width: 24, height: 24, alignItems: "center", justifyContent: "flex-start" },
  bellDome: {
    position: "absolute",
    top: 3,
    width: 15,
    height: 15,
    borderWidth: 2,
    borderColor: "#005C55",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 0
  },
  bellRim: {
    position: "absolute",
    top: 17,
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#005C55"
  },
  bellClapper: {
    position: "absolute",
    top: 20,
    width: 5,
    height: 3,
    borderRadius: 3,
    backgroundColor: "#005C55"
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -5,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#BA1A1A",
    borderWidth: 1,
    borderColor: "#FFFFFF"
  },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  pressed: { opacity: 0.72 }
});
