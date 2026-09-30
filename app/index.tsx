import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const palette = {
  background: "#F7FAF8",
  primary: "#005C55",
  surfaceContainer: "#EBEFED",
  text: "#181C1C",
  muted: "#3E4947",
  outline: "#6E7977"
};

export default function SplashScreen() {
  const router = useRouter();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => router.replace("/login"), 1400);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true
        })
      ])
    );

    animation.start();

    return () => {
      clearTimeout(timer);
      animation.stop();
    };
  }, [progress, router]);

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
    backgroundColor: "rgba(0, 92, 85, 0.06)",
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
  linkCircleRight: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", backgroundColor: "#FEA619", zIndex: 2 },
  linkBar: { width: 58, height: 22, marginHorizontal: -8, borderRadius: 11, backgroundColor: "#9CF2E8" },
  linkCircleText: { color: "#FFFFFF", fontSize: 34, lineHeight: 42, fontWeight: "900" },
  brandBlock: {
    alignItems: "center",
    marginBottom: 48
  },
  brand: {
    color: palette.primary,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "900",
    textAlign: "center"
  },
  tagline: {
    maxWidth: 280,
    color: palette.muted,
    fontSize: 18,
    lineHeight: 26,
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
    color: palette.outline,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 16
  },
  footer: {
    width: "100%",
    color: palette.outline,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 20
  }
});
