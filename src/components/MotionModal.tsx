import { Modal, ModalProps } from "react-native";
import { useReducedMotion } from "../hooks/useReducedMotion";

/** Keeps native modal behavior while removing spatial motion when requested. */
export function MotionModal({ animationType = "fade", ...props }: ModalProps) {
  const reduceMotion = useReducedMotion();
  return <Modal {...props} animationType={reduceMotion ? "none" : animationType} />;
}
