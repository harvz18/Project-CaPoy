import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const mapTilerApiKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY?.trim();
  return {
    ...config,
    extra: {
      ...config.extra,
      mapProvider: "maplibre",
      mapTilerApiKey,
      mapTilerConfigured: Boolean(mapTilerApiKey)
    },
    plugins: [
      ...(config.plugins ?? []),
      "@maplibre/maplibre-react-native",
      "expo-font",
      [
        "expo-location",
        {
          locationWhenInUsePermission: "TASKLINK uses your location to rank nearby jobs and verify task check-in."
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "TASKLINK lets you select a profile photo from your library.",
          microphonePermission: false
        }
      ]
    ]
  };
};
