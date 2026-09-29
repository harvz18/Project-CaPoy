import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp } from "../src/context/AppContext";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <ProtectedNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}

function ProtectedNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { appLoading, currentUser } = useApp();
  const route = segments[0] as string | undefined;
  const publicRoutes = ["index", "login", "register"];
  const clientOnlyRoutes = ["client-dashboard", "post-task"];
  const workerOnlyRoutes = ["worker-dashboard", "jobs"];

  useEffect(() => {
    if (appLoading || !route) {
      return;
    }

    if (!currentUser && !publicRoutes.includes(route)) {
      router.replace("/login");
      return;
    }

    if (currentUser && publicRoutes.includes(route)) {
      router.replace(currentUser.role === "worker" ? "/worker-dashboard" : "/client-dashboard");
      return;
    }

    if (currentUser?.role === "worker" && clientOnlyRoutes.includes(route)) {
      router.replace("/worker-dashboard");
      return;
    }

    if (currentUser?.role === "client" && workerOnlyRoutes.includes(route)) {
      router.replace("/client-dashboard");
    }
  }, [appLoading, currentUser, route, router]);

  if (appLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "800" },
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: "Login" }} />
      <Stack.Screen name="register" options={{ title: "Registration" }} />
      <Stack.Screen name="role-selection" options={{ title: "Role Selection" }} />
      <Stack.Screen name="worker-dashboard" options={{ title: "Worker Dashboard" }} />
      <Stack.Screen name="client-dashboard" options={{ title: "Client Dashboard" }} />
      <Stack.Screen name="post-task" options={{ title: "Post Task" }} />
      <Stack.Screen name="jobs" options={{ title: "Nearby Jobs" }} />
      <Stack.Screen name="task/[id]" options={{ title: "Job Details" }} />
      <Stack.Screen name="task-status/[id]" options={{ title: "Task Status" }} />
      <Stack.Screen name="chat/[id]" options={{ title: "Chat" }} />
      <Stack.Screen name="rating/[id]" options={{ title: "Rating and Feedback" }} />
      <Stack.Screen name="profile" options={{ title: "Profile" }} />
      <Stack.Screen name="worker-profile/[id]" options={{ title: "Worker Profile" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  }
});
