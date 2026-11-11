/**
 * Example ONLY — adapt to the project's actual Expo Router version and route
 * structure. Keep system/native-stack defaults unless a clear UX reason exists.
 * This is not a replacement for the app's existing _layout.tsx.
 */
import { Stack } from "expo-router";

export default function ExampleStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "default", // preserves platform conventions
      }}
    />
  );
}
