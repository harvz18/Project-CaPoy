const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Firebase Auth v10 does not resolve correctly through Metro's package-exports
// support in Expo SDK 54. Use Firebase's established React Native entry point.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
