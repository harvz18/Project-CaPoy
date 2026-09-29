import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  return {
    ...config,
    android: {
      ...config.android,
      ...(googleMapsApiKey
        ? {
            config: {
              ...config.android?.config,
              googleMaps: { apiKey: googleMapsApiKey }
            }
          }
        : {})
    },
    plugins: [
      ...(config.plugins ?? []),
      [
        "expo-location",
        {
          locationWhenInUsePermission: "TASKLINK uses your location to rank nearby jobs and verify task check-in."
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "TASKLINK lets you select a profile photo from your library."
        }
      ]
    ]
  };
};
