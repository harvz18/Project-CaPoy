import { createContext, createElement, PropsWithChildren, useContext, useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

const ReducedMotionContext = createContext(true);

/**
 * Conservative by default: spatial motion stays disabled until the operating
 * system preference is known, and updates while the app remains open.
 */
export function MotionPreferenceProvider({ children }: PropsWithChildren) {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        // Keep the conservative no-spatial-motion fallback when unavailable.
      });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return createElement(ReducedMotionContext.Provider, { value: reduceMotion }, children);
}

export function useReducedMotion() {
  return useContext(ReducedMotionContext);
}
