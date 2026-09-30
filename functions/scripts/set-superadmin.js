const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const identifier = process.argv[2]?.trim();
if (!identifier) {
  console.error("Usage: npm --prefix functions run set-superadmin -- 09171234567");
  process.exitCode = 1;
  return;
}

function toTasklinkEmail(value) {
  if (value.includes("@")) return value;
  const digits = value.replace(/\D/g, "");
  const normalized = digits.startsWith("63") ? digits : digits.startsWith("0") ? `63${digits.slice(1)}` : `63${digits}`;
  return `${normalized}@tasklink.local`;
}

const email = toTasklinkEmail(identifier);

initializeApp({ credential: applicationDefault() });

async function main() {
  const user = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid, {
    ...(user.customClaims ?? {}),
    admin: true,
    superadmin: true
  });
  const now = new Date().toISOString();
  await getFirestore().collection("users").doc(user.uid).set({
    id: user.uid,
    role: "admin",
    fullName: user.displayName || email.split("@")[0],
    mobileNumber: user.phoneNumber || "",
    address: "",
    rating: 0,
    accountStatus: "active",
    createdAt: now,
    updatedAt: now
  }, { merge: true });
  console.log(`Superadministrator claims and profile configured for ${email}.`);
  console.log("The account must sign out and sign in again to refresh its ID token.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
