import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNavIcon } from "./BottomNavIcon";
import { usePrefersReducedMotion } from "./RouteTransition";
import { colors, glass, motion, shadows } from "../theme";

export type BottomNavKey = "home" | "jobs" | "chat" | "profile";

const ACTIVE_COLOR = colors.white;
const INACTIVE_COLOR = colors.text;
const TAB_COUNT = 4;
const NAV_HORIZONTAL_PADDING = 8;
const MARKER_MARGIN = 6;
const NAV_TRANSITION_DURATION_MS = motion.standard;
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
    left: 12,
    right: 12,
    bottom: 8,
    minHeight: 72,
    paddingHorizontal: NAV_HORIZONTAL_PADDING,
    paddingTop: 8,
    borderRadius: 24,
    borderTopWidth: 1,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    backgroundColor: glass.elevated,
    flexDirection: "row",
    overflow: "hidden",
    ...shadows.floating
  },
  activeMarker: {
    position: "absolute",
    top: 8,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(181, 255, 249, 0.70)",
    backgroundColor: colors.primary,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 8
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
  navLabelActive: { color: ACTIVE_COLOR, fontWeight: "900" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] }
});
