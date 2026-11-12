import { useFocusEffect } from "expo-router";
import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet } from "react-native";

const WEB_TRANSITION_DURATION_MS = 180;
const WEB_SLIDE_DISTANCE_PX = 14;
let lastTabIndex: number | undefined;

export function usePrefersReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

export function RouteTransition({ children, reduceMotion, routeName }: PropsWithChildren<{
  reduceMotion: boolean;
  routeName: string;
}>) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== "web" || reduceMotion) {
      opacity.setValue(1);
      translateX.setValue(0);
      return () => undefined;
    }

    const tabIndex = getTabIndex(routeName);
    const direction = tabIndex !== undefined && lastTabIndex !== undefined && tabIndex < lastTabIndex ? -1 : 1;
    if (tabIndex !== undefined) lastTabIndex = tabIndex;
    opacity.setValue(0.97);
    translateX.setValue(direction * WEB_SLIDE_DISTANCE_PX);
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: WEB_TRANSITION_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: WEB_TRANSITION_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false
      })
    ]);
    animation.start();

    return () => animation.stop();
  }, [opacity, reduceMotion, routeName, translateX]));

  if (Platform.OS !== "web") return children;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateX }]
        }
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }
});

function getTabIndex(routeName: string) {
  if (routeName === "worker-dashboard" || routeName === "client-dashboard") return 0;
  if (routeName === "jobs" || routeName === "post-task") return 1;
  if (routeName === "chat/index" || routeName === "chat/[id]") return 2;
  if (routeName === "profile") return 3;
  return undefined;
}
