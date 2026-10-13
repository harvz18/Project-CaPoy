const fs = require("node:fs");
const path = require("node:path");

function resolveProjectId() {
  const configured = process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCLOUD_PROJECT
    || process.env.FIREBASE_PROJECT_ID;
  if (configured?.trim()) return configured.trim();

  try {
    const firebaseRcPath = path.resolve(__dirname, "..", "..", ".firebaserc");
    const firebaseRc = JSON.parse(fs.readFileSync(firebaseRcPath, "utf8"));
    const betaProject = firebaseRc?.projects?.beta;
    if (typeof betaProject === "string" && betaProject.trim()) return betaProject.trim();
  } catch {
    // The command below reports a direct, safe recovery step when no alias exists.
  }

  throw new Error(
    "Firebase project ID is unavailable. Set GOOGLE_CLOUD_PROJECT or configure a beta project in .firebaserc."
  );
}

module.exports = { resolveProjectId };
