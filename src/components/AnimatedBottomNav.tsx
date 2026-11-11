import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNavIcon } from "./BottomNavIcon";
import { usePrefersReducedMotion } from "./RouteTransition";
import { motionDuration, motionEasing } from "../motion";
import { colors, glass, motion, shadows } from "../theme";
import { typography } from "../typography";
import { AppText as Text } from "./AppText";
import { MotionPressable } from "./MotionPressable";

export type BottomNavKey = "home" | "jobs" | "chat" | "profile";

const ACTIVE_COLOR = colors.white;
const INACTIVE_COLOR = colors.text;
const TAB_COUNT = 4;
const NAV_HORIZONTAL_PADDING = 8;
const MARKER_MARGIN = 6;
const NAV_TRANSITION_DURATION_MS = motion.duration.quick;
let lastActiveIndex: number | undefined;

export function AnimatedBottomNav({ active, role }: { active: BottomNavKey; role?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = usePrefersReducedMotion();
  const navItems = getNavItems(role);
  const activeIndex = navItems.findIndex((item) => item.key === active);
  const markerPosition = useRef(new Animated.Value(lastActiveIndex ?? activeIndex)).current;
  const [navWidth, setNavWidth] = useState(0);
  const [focusedKey, setFocusedKey] = useState<BottomNavKey>();
  const slotWidth = Math.max(0, (navWidth - NAV_HORIZONTAL_PADDING * 2) / TAB_COUNT);
  const bottomPadding = Math.max(insets.bottom, 10);

  useEffect(() => {
    const animation = Animated.timing(markerPosition, {
      toValue: activeIndex,
      duration: motionDuration(NAV_TRANSITION_DURATION_MS, reduceMotion),
      easing: motionEasing.standard,
      useNativeDriver: Platform.OS !== "web"
    });
    animation.start();
    lastActiveIndex = activeIndex;
    return () => animation.stop();
  }, [activeIndex, markerPosition, reduceMotion]);

  function handleLayout(event: LayoutChangeEvent) {
    setNavWidth(event.nativeEvent.layout.width);
  }

  return (
    <View pointerEvents="box-none" style={styles.bottomNavFrame}>
      <View
        accessibilityRole="tablist"
        onLayout={handleLayout}
        style={[styles.bottomNav, { paddingBottom: bottomPadding }]}
      >
        {slotWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeMarker,
              {
                left: NAV_HORIZONTAL_PADDING + MARKER_MARGIN,
                bottom: Math.max(bottomPadding - 2, 8),
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
          return (
            <MotionPressable
              accessibilityLabel={item.accessibilityLabel}
              accessibilityHint={selected ? `${item.accessibilityLabel} tab, currently selected` : `Open ${item.accessibilityLabel}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.key}
              onFocus={() => setFocusedKey(item.key)}
              onBlur={() => setFocusedKey((key) => key === item.key ? undefined : key)}
              onPress={() => {
                if (!selected) router.push(item.route as never);
              }}
              motionScale={motion.scale.subtlePressed}
              style={({ hovered, pressed }) => [
                styles.navItem,
                (focusedKey === item.key || hovered) && styles.navItemInteractive,
                focusedKey === item.key && styles.navItemFocused,
                pressed && styles.pressed
              ]}
            >
              <BottomNavIcon name={item.key} color={selected ? ACTIVE_COLOR : INACTIVE_COLOR} />
              <Text style={[styles.navLabel, selected && styles.navLabelActive]}>{item.label}</Text>
            </MotionPressable>
          );
        })}
      </View>
    </View>
  );
}

function getNavItems(role?: string): Array<{ key: BottomNavKey; label: string; accessibilityLabel: string; route: string }> {
  const isClient = role === "client";

  return [
    { key: "home", label: "Home", accessibilityLabel: "Home", route: isClient ? "/client-dashboard" : "/worker-dashboard" },
    { key: "jobs", label: isClient ? "Post" : "Jobs", accessibilityLabel: isClient ? "Post task" : "Jobs", route: isClient ? "/post-task" : "/jobs" },
    { key: "chat", label: "Chat", accessibilityLabel: "Chat", route: "/chat" },
    { key: "profile", label: "Profile", accessibilityLabel: "Profile", route: "/profile" }
  ];
}

const styles = StyleSheet.create({
  bottomNavFrame: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: 12
  },
  bottomNav: {
    width: "100%",
    maxWidth: 680,
    minHeight: 70,
    marginBottom: 8,
    paddingHorizontal: NAV_HORIZONTAL_PADDING,
    paddingTop: 8,
    borderRadius: 24,
    borderTopWidth: 1,
    borderWidth: 1,
    borderColor: colors.borderHighlight,
    // A near-opaque elevated material keeps scrolling content from competing
    // with the tab labels on small Android screens.
    backgroundColor: glass.solid,
    flexDirection: "row",
    overflow: "hidden",
    ...shadows.floating
  },
  activeMarker: {
    position: "absolute",
    top: 6,
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
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 52,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 22
  },
  navItemInteractive: { backgroundColor: colors.infoLight },
  navItemFocused: { borderWidth: 1, borderColor: colors.focus },
  navLabel: { ...typography.bottomNav, minWidth: 0, color: INACTIVE_COLOR, textAlign: "center" },
  navLabelActive: { ...typography.bottomNav, color: ACTIVE_COLOR },
  pressed: { opacity: 0.82 }
});
