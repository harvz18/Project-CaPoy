import { useFocusEffect } from "expo-router";
import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet } from "react-native";

const WEB_TRANSITION_DURATION_MS = 180;
const WEB_SLIDE_DISTANCE_PX = 14;

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

export function RouteTransition({ children, reduceMotion }: PropsWithChildren<{ reduceMotion: boolean }>) {
  const progress = useRef(new Animated.Value(1)).current;

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== "web" || reduceMotion) {
      progress.setValue(1);
      return () => undefined;
    }

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: WEB_TRANSITION_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    });
    animation.start();

    return () => animation.stop();
  }, [progress, reduceMotion]));

  if (Platform.OS !== "web") return children;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }),
          transform: [{
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [WEB_SLIDE_DISTANCE_PX, 0]
            })
          }]
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
