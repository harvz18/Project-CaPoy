import { useCallback } from "react";
import { LayoutAnimation } from "react-native";
import { motion } from "../theme";
import { useReducedMotion } from "./useReducedMotion";

/** Prepare one bounded layout change such as an accordion or short disclosure. */
export function useMotionLayout() {
  const reduceMotion = useReducedMotion();
  return useCallback(() => {
    if (reduceMotion) return;
    LayoutAnimation.configureNext({
      duration: motion.duration.standard,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity }
    });
  }, [reduceMotion]);
}
