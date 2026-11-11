import { ComponentType, useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  StyleProp,
  ViewStyle
} from "react-native";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { motionDuration, motionEasing } from "../motion";
import { motion } from "../theme";

type MotionPressableProps = PressableProps & {
  motionDisabled?: boolean;
  motionScale?: number;
};

type AnimatedPressableProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable) as ComponentType<AnimatedPressableProps>;

/** Smooth tactile feedback without delaying or owning the caller's action. */
export function MotionPressable({
  accessibilityRole,
  accessibilityState,
  disabled,
  motionDisabled = false,
  motionScale = motion.scale.pressed,
  onPressIn,
  onPressOut,
  style,
  ...props
}: MotionPressableProps) {
  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const shouldAnimate = !motionDisabled && accessibilityRole !== "none";

  useEffect(() => {
    if (reduceMotion || !shouldAnimate) {
      scale.stopAnimation();
      scale.setValue(1);
    }
    return () => scale.stopAnimation();
  }, [reduceMotion, scale, shouldAnimate]);

  function animateScale(toValue: number) {
    scale.stopAnimation();
    Animated.timing(scale, {
      toValue: reduceMotion || !shouldAnimate ? 1 : toValue,
      duration: motionDuration(motion.duration.feedback, reduceMotion),
      easing: motionEasing.standard,
      useNativeDriver: Platform.OS !== "web"
    }).start();
  }

  const resolveStyle = (state: PressableStateCallbackType): StyleProp<ViewStyle> => [
    typeof style === "function" ? style(state) : style,
    shouldAnimate ? { transform: [{ scale }] } : undefined
  ];

  return (
    <AnimatedPressable
      {...props}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled || accessibilityState?.disabled) }}
      disabled={disabled}
      onPressIn={(event) => {
        if (!disabled) animateScale(motionScale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateScale(1);
        onPressOut?.(event);
      }}
      style={resolveStyle}
    />
  );
}
