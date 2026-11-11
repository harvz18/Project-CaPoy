import { Easing } from "react-native";
import { motion } from "./theme";

export const motionEasing = {
  standard: Easing.bezier(...motion.easing.standard),
  enter: Easing.bezier(...motion.easing.enter),
  exit: Easing.bezier(...motion.easing.exit)
} as const;

export function motionDuration(duration: number, reduceMotion: boolean) {
  return reduceMotion ? motion.duration.instant : duration;
}

export function boundedStagger(index: number) {
  return Math.min(index * motion.stagger.step, motion.stagger.maxTotal);
}
