import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Text } from "react-native";
import { AppCard } from "../src/components/AppCard";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { styles } from "../src/styles";

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace("/login"), 1200);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <ScreenContainer centered>
      <AppCard style={styles.heroCard}>
        <Text style={styles.heroTitle}>TASKLINK</Text>
        <Text style={styles.heroSubtitle}>Mobile job matching for informal workers in Bacolod City</Text>
      </AppCard>
    </ScreenContainer>
  );
}
