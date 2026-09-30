import { Href, Stack, useRouter, useSegments } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp } from "../src/context/AppContext";
import { colors } from "../src/theme";
import { configureNotificationChannel } from "../src/services/pushNotificationService";
import { markNotificationOpened } from "../src/services/notificationService";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

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
  const { appLoading, authority, currentUser } = useApp();
  const route = segments[0] as string | undefined;
  const publicRoutes = ["index", "login", "register"];
  const clientOnlyRoutes = ["client-dashboard", "post-task"];
  const workerOnlyRoutes = ["worker-dashboard", "jobs"];
  const staffRoutes = ["admin", "superadmin"];

  useEffect(() => {
    void configureNotificationChannel().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!currentUser) return () => undefined;

    const openNotification = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      const taskId = typeof data.taskId === "string" ? data.taskId : undefined;
      const route = data.route === "chat" ? "chat" : "task";
      const senderId = typeof data.senderId === "string" ? data.senderId : undefined;
      const notificationId = typeof data.notificationId === "string" ? data.notificationId : undefined;
      if (notificationId) void markNotificationOpened(notificationId).catch(() => undefined);
      if (!taskId) return;
      if (route === "chat" && senderId) {
        router.push({ pathname: "/chat/[id]", params: { id: taskId, recipientId: senderId } });
      } else {
        router.push({ pathname: "/task/[id]", params: { id: taskId } });
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        openNotification(response);
        void Notifications.clearLastNotificationResponseAsync();
      }
    }).catch(() => undefined);
    return () => subscription.remove();
  }, [currentUser?.id, router]);

  useEffect(() => {
    if (appLoading || !route) {
      return;
    }

    if (!currentUser && !publicRoutes.includes(route)) {
      router.replace("/login");
      return;
    }

    if (currentUser && publicRoutes.includes(route)) {
      const homeRoute = (
        authority === "superadmin"
          ? "/superadmin"
          : authority === "admin"
            ? "/admin"
            : currentUser.role === "worker"
              ? "/worker-dashboard"
              : "/client-dashboard"
      ) as Href;
      router.replace(homeRoute);
      return;
    }

    if (route === "superadmin" && authority !== "superadmin") {
      router.replace(currentUser?.role === "worker" ? "/worker-dashboard" : "/client-dashboard");
      return;
    }

    if (route === "admin" && authority !== "admin" && authority !== "superadmin") {
      router.replace(currentUser?.role === "worker" ? "/worker-dashboard" : "/client-dashboard");
      return;
    }

    if (currentUser?.role === "admin" && !staffRoutes.includes(route)) {
      router.replace((authority === "superadmin" ? "/superadmin" : "/admin") as Href);
      return;
    }

    if (currentUser?.role === "worker" && clientOnlyRoutes.includes(route)) {
      router.replace("/worker-dashboard");
      return;
    }

    if (currentUser?.role === "client" && workerOnlyRoutes.includes(route)) {
      router.replace("/client-dashboard");
    }
  }, [appLoading, authority, currentUser, route, router]);

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
      <Stack.Screen name="report-user" options={{ title: "Report a User" }} />
      <Stack.Screen name="admin" options={{ title: "Administrator" }} />
      <Stack.Screen name="superadmin" options={{ title: "Superadministrator" }} />
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
