/**
 * React Native / Expo motion tokens. Durations are in milliseconds.
 * Never assume browser CSS animation tokens work in native components.
 */
export const motion = {
  duration: {
    instant: 0,
    feedback: 120,
    quick: 160,
    standard: 220,
    navigation: 280,
    overlay: 280,
    emphasis: 340,
  },
  press: { scale: 0.98 },
  distance: { small: 8, medium: 16 },
  stagger: { step: 30, maxTotal: 150 },
} as const;
