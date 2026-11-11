import { useFocusEffect } from "expo-router";
import { PropsWithChildren, useCallback, useRef } from "react";
import { Animated, Platform, StyleSheet } from "react-native";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { motionDuration, motionEasing } from "../motion";
import { motion } from "../theme";

let lastTabIndex: number | undefined;

export function usePrefersReducedMotion() {
  return useReducedMotion();
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
    opacity.setValue(0.94);
    // Only peer tabs have a known direction here. Other web routes crossfade
    // rather than implying an incorrect forward/back relationship.
    translateX.setValue(tabIndex === undefined ? 0 : direction * motion.distance.small);
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motionDuration(motion.duration.standard, reduceMotion),
        easing: motionEasing.enter,
        useNativeDriver: false
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: motionDuration(motion.duration.standard, reduceMotion),
        easing: motionEasing.enter,
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
