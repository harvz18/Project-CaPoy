const { expo } = require("./app.json");

module.exports = () => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  return {
    ...expo,
    android: {
      ...expo.android,
      ...(googleMapsApiKey
        ? {
            config: {
              ...(expo.android?.config ?? {}),
              googleMaps: { apiKey: googleMapsApiKey }
            }
          }
        : {})
    }
  };
};
