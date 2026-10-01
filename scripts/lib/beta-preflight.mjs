export const firebaseClientKeys = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID"
];

export function parseEnv(source) {
  return Object.fromEntries(source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      const name = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return [name, value];
    }));
}

function result(level, id, message) {
  return { level, id, message };
}

export function evaluateBetaPreflight({ env, app, eas, firebaseRc, hasDynamicConfig }) {
  const results = [];
  const betaProject = firebaseRc?.projects?.beta?.trim();

  for (const key of firebaseClientKeys) {
    results.push(env[key]?.trim()
      ? result("pass", `env:${key}`, `${key} is configured.`)
      : result("fail", `env:${key}`, `${key} is missing.`));
  }

  results.push(betaProject
    ? result("pass", "firebase:beta-alias", "A Firebase beta alias is configured.")
    : result("fail", "firebase:beta-alias", "The Firebase beta alias is missing."));

  if (betaProject && env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim()) {
    results.push(betaProject === env.EXPO_PUBLIC_FIREBASE_PROJECT_ID.trim()
      ? result("pass", "firebase:target-match", "The client project matches the Firebase beta alias.")
      : result("fail", "firebase:target-match", "The client project does not match the Firebase beta alias."));
  }

  results.push(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() ?? "")
    ? result("pass", "support:email", "A public beta support mailbox is configured.")
    : result("warn", "support:email", "EXPO_PUBLIC_SUPPORT_EMAIL is missing or invalid."));

  results.push(env.GOOGLE_MAPS_API_KEY?.trim()
    ? result("pass", "maps:android-key", "An Android map key is configured for build-time injection.")
    : result("warn", "maps:android-key", "GOOGLE_MAPS_API_KEY is missing; standalone Android maps are not release-ready."));

  results.push(hasDynamicConfig
    ? result("pass", "maps:dynamic-config", "Dynamic Expo configuration is present.")
    : result("fail", "maps:dynamic-config", "app.config.js is missing."));

  const easProjectId = app?.expo?.extra?.eas?.projectId?.trim();
  results.push(easProjectId
    ? result("pass", "eas:project", "An EAS project ID is configured.")
    : result("fail", "eas:project", "The EAS project ID is missing."));

  const preview = eas?.build?.preview;
  results.push(preview?.environment === "preview" && preview?.distribution === "internal" && preview?.android?.buildType === "apk"
    ? result("pass", "eas:preview-profile", "The preview profile uses the preview environment and an internal APK.")
    : result("fail", "eas:preview-profile", "The EAS preview profile is not an internal preview APK."));

  return results;
}
