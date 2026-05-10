import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "../src/context/AppContext";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
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
      </AppProvider>
    </SafeAreaProvider>
  );
}
