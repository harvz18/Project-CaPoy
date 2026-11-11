import { useEffect, useRef } from "react";
import { Animated, Platform, Text as NativeText, TextInput as NativeTextInput, TextInputProps, TextProps } from "react-native";
import { typography, TypographyRole } from "../typography";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { motionDuration, motionEasing } from "../motion";
import { motion } from "../theme";

export type AppTextProps = TextProps & {
  variant?: TypographyRole;
};

export function AppText({ allowFontScaling = true, style, variant = "body", ...props }: AppTextProps) {
  if (props.accessibilityRole === "alert" || props.accessibilityLiveRegion === "assertive" || props.accessibilityLiveRegion === "polite") {
    return <MotionFeedbackText {...props} allowFontScaling={allowFontScaling} style={style} variant={variant} />;
  }
  return <NativeText {...props} allowFontScaling={allowFontScaling} style={[typography[variant], style]} />;
}

function MotionFeedbackText({ allowFontScaling = true, style, variant = "body", ...props }: AppTextProps) {
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
      duration: motionDuration(motion.duration.quick, reduceMotion),
      easing: motionEasing.enter,
      useNativeDriver: Platform.OS !== "web"
    }).start();
    return () => progress.stopAnimation();
  }, [progress, reduceMotion]);

  return (
    <Animated.Text
      {...props}
      allowFontScaling={allowFontScaling}
      style={[
        typography[variant],
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [motion.distance.small / 2, 0] }) }]
        }
      ]}
    />
  );
}

export function AppTextInput({ allowFontScaling = true, style, ...props }: TextInputProps) {
  return <NativeTextInput {...props} allowFontScaling={allowFontScaling} style={[typography.inputText, style]} />;
}
