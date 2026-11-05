const { expo } = require("./app.json");

module.exports = () => {
  const mapTilerApiKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY?.trim();

  return {
    ...expo,
    extra: {
      ...expo.extra,
      mapProvider: "maplibre",
      mapTilerApiKey,
      mapTilerConfigured: Boolean(mapTilerApiKey)
    },
    plugins: [
      ...(expo.plugins ?? []),
      "@maplibre/maplibre-react-native"
    ]
  };
};
