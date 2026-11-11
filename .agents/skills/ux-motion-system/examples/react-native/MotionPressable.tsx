import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { motion } from "./motion-tokens";

export interface MotionPressableProps
  extends Omit<PressableProps, "style" | "children"> {
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  pressableStyle?: PressableProps["style"];
}

/**
 * Built-in RN Animated example (no external animation dependencies).
 * Keeps onPress immediate and honors the device's Reduce Motion setting.
 * If used as an icon-only control, pass an accessibilityLabel.
 */
export function MotionPressable({
  children,
  containerStyle,
  pressableStyle,
  disabled = false,
  onPressIn,
  onPressOut,
  accessibilityRole,
  accessibilityState,
  ...props
}: MotionPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {
        /* Keep the component usable if preference lookup is unavailable. */
      });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      sub.remove();
      scale.stopAnimation();
    };
  }, [scale]);

  useEffect(() => {
    if (reduceMotion) {
      scale.stopAnimation();
      scale.setValue(1);
    }
  }, [reduceMotion, scale]);

  const toScale = (toValue: number) => {
    Animated.timing(scale, {
      toValue: reduceMotion ? 1 : toValue,
      duration: reduceMotion ? 0 : motion.duration.feedback,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[containerStyle, { transform: [{ scale }] }]}
    >
      <Pressable
        {...props}
        disabled={disabled}
        accessibilityRole={accessibilityRole ?? "button"}
        accessibilityState={{
          ...accessibilityState,
          disabled: Boolean(disabled || accessibilityState?.disabled),
        }}
        style={pressableStyle}
        onPressIn={(event) => {
          if (!disabled) toScale(motion.press.scale);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          toScale(1);
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
