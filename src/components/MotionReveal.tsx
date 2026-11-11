import { PropsWithChildren, useEffect, useRef } from "react";
import { Animated, Platform, ViewProps } from "react-native";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { motionDuration, motionEasing } from "../motion";
import { motion } from "../theme";

type MotionRevealProps = PropsWithChildren<ViewProps & {
  distance?: number;
  duration?: number;
}>;

/** One-time reveal for newly available feedback or bounded state surfaces. */
export function MotionReveal({
  children,
  distance = motion.distance.small,
  duration = motion.duration.standard,
  style,
  ...props
}: MotionRevealProps) {
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    progress.stopAnimation();
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: motionDuration(duration, reduceMotion),
      easing: motionEasing.enter,
      useNativeDriver: Platform.OS !== "web"
    }).start();
    return () => progress.stopAnimation();
  }, [duration, progress, reduceMotion]);

  return (
    <Animated.View
      {...props}
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }]
        }
      ]}
    >
      {children}
    </Animated.View>
  );
}
