import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNavIcon } from "./BottomNavIcon";
import { usePrefersReducedMotion } from "./RouteTransition";

export type BottomNavKey = "home" | "jobs" | "chat" | "profile";

const ACTIVE_COLOR = "#684000";
const INACTIVE_COLOR = "#3E4947";
const TAB_COUNT = 4;
const NAV_HORIZONTAL_PADDING = 8;
const MARKER_MARGIN = 6;
const NAV_TRANSITION_DURATION_MS = 220;
let lastActiveIndex: number | undefined;

export function AnimatedBottomNav({ active, role }: { active: BottomNavKey; role?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = usePrefersReducedMotion();
  const activeIndex = navItems.findIndex((item) => item.key === active);
  const markerPosition = useRef(new Animated.Value(lastActiveIndex ?? activeIndex)).current;
  const [navWidth, setNavWidth] = useState(0);
  const slotWidth = Math.max(0, (navWidth - NAV_HORIZONTAL_PADDING * 2) / TAB_COUNT);

  useEffect(() => {
    const animation = Animated.timing(markerPosition, {
      toValue: activeIndex,
      duration: reduceMotion ? 0 : NAV_TRANSITION_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    });
    animation.start();
    lastActiveIndex = activeIndex;
    return () => animation.stop();
  }, [activeIndex, markerPosition, reduceMotion]);

  function handleLayout(event: LayoutChangeEvent) {
    setNavWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      onLayout={handleLayout}
      style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      {slotWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeMarker,
            {
              left: NAV_HORIZONTAL_PADDING + MARKER_MARGIN,
              width: Math.max(0, slotWidth - MARKER_MARGIN * 2),
              transform: [{
                translateX: markerPosition.interpolate({
                  inputRange: [0, TAB_COUNT - 1],
                  outputRange: [0, slotWidth * (TAB_COUNT - 1)]
                })
              }]
            }
          ]}
        />
      ) : null}
      {navItems.map((item) => {
        const selected = item.key === active;
        const route = item.key === "home"
          ? role === "client" ? "/client-dashboard" : "/worker-dashboard"
          : item.key === "jobs"
            ? role === "client" ? "/post-task" : "/jobs"
            : item.route;
        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={item.key}
            onPress={() => {
              if (!selected) router.push(route as never);
            }}
            style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}
          >
            <BottomNavIcon name={item.key} color={selected ? ACTIVE_COLOR : INACTIVE_COLOR} />
            <Text style={[styles.navLabel, selected && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const navItems: Array<{ key: BottomNavKey; label: string; route: string }> = [
  { key: "home", label: "Home", route: "/worker-dashboard" },
  { key: "jobs", label: "Jobs", route: "/jobs" },
  { key: "chat", label: "Chat", route: "/chat" },
  { key: "profile", label: "Profile", route: "/profile" }
];

const styles = StyleSheet.create({
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 72,
    paddingHorizontal: NAV_HORIZONTAL_PADDING,
    paddingTop: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 1,
    borderColor: "#BDC9C6",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    elevation: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8
  },
  activeMarker: {
    position: "absolute",
    top: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FEA619"
  },
  navItem: {
    flex: 1,
    minHeight: 48,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4
  },
  navLabel: { color: INACTIVE_COLOR, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  navLabelActive: { color: ACTIVE_COLOR, fontWeight: "800" },
  pressed: { opacity: 0.72 }
});
