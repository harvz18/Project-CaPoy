import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { screenPalette } from "../src/theme";
import { motion } from "../src/theme";
import { useReducedMotion } from "../src/hooks/useReducedMotion";
import { motionDuration, motionEasing } from "../src/motion";
import { typography } from "../src/typography";
import { AppText as Text } from "../src/components/AppText";

const palette = screenPalette;

export default function SplashScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = motionDuration(motion.duration.emphasis, reduceMotion);
    const timer = setTimeout(() => router.replace("/login"), motion.duration.emphasis);
    progress.setValue(reduceMotion ? 1 : 0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: motionEasing.enter,
      useNativeDriver: Platform.OS !== "web"
    });

    animation.start();

    return () => {
      clearTimeout(timer);
      animation.stop();
    };
  }, [progress, reduceMotion, router]);

  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-56, 56, 140]
  });

  const scaleX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.75, 1.25, 0.75]
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.content}>
        <View style={styles.illustrationWrap}>
          <View style={styles.glow} />
          <View accessibilityLabel="TaskLink logo" style={styles.illustration}>
            <View style={styles.linkCircleLeft}><Text style={styles.linkCircleText}>T</Text></View>
            <View style={styles.linkBar} />
            <View style={styles.linkCircleRight}><Text style={styles.linkCircleText}>L</Text></View>
          </View>
        </View>

        <View style={styles.brandBlock}>
          <Text style={styles.brand}>TASKLINK</Text>
          <Text style={styles.tagline}>Find Work. Find Help. Instantly.</Text>
        </View>

        <View style={styles.loadingBlock}>
          <View style={styles.loadingBar}>
            <Animated.View style={[styles.loadingProgress, { transform: [{ translateX }, { scaleX }] }]} />
          </View>
          <Text style={styles.loadingText}>Starting up</Text>
        </View>
      </View>

      <Text style={styles.footer}>Built for the Filipino Community</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  illustrationWrap: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 48
  },
  glow: {
    position: "absolute",
    width: "82%",
    height: "82%",
    borderRadius: 999,
    backgroundColor: "rgba(0, 201, 179, 0.10)",
    transform: [{ scale: 0.92 }]
  },
  illustration: {
    width: 240,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row"
  },
  linkCircleLeft: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary, zIndex: 2 },
  linkCircleRight: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", backgroundColor: "#00C9B3", zIndex: 2 },
  linkBar: { width: 58, height: 22, marginHorizontal: -8, borderRadius: 11, backgroundColor: "#5DF7F2" },
  linkCircleText: { ...typography.heroNumber, color: "#FFFFFF" },
  brandBlock: {
    alignItems: "center",
    marginBottom: 48
  },
  brand: {
    ...typography.screenTitle,
    color: palette.primary,
    textAlign: "center"
  },
  tagline: {
    ...typography.badge,
    maxWidth: 280,
    color: palette.muted,
    textAlign: "center",
    marginTop: 16
  },
  loadingBlock: {
    alignItems: "center"
  },
  loadingBar: {
    width: 140,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: palette.surfaceContainer
  },
  loadingProgress: {
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.primary
  },
  loadingText: {
    ...typography.badge,
    color: palette.outline,
    marginTop: 16
  },
  footer: {
    ...typography.metadata,
    width: "100%",
    color: palette.outline,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 20
  }
});
