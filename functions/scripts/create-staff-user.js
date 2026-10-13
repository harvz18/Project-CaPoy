const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { resolveProjectId } = require("./resolve-project-id");

const [staffRole, identifier] = process.argv.slice(2).map((value) => value?.trim());
const password = process.env.TASKLINK_STAFF_PASSWORD;

if (!['admin', 'superadmin'].includes(staffRole) || !identifier || !password) {
  console.error("Usage: TASKLINK_STAFF_PASSWORD=<password> npm --prefix functions run create-staff -- <admin|superadmin> <mobile-number>");
  process.exitCode = 1;
  return;
}

if (password.length < 6) {
  console.error("The staff password must contain at least six characters.");
  process.exitCode = 1;
  return;
}

function normalizeMobileNumber(value) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("63") ? digits : digits.startsWith("0") ? `63${digits.slice(1)}` : `63${digits}`;
}

const mobileNumber = normalizeMobileNumber(identifier);
const email = `${mobileNumber}@tasklink.local`;
const projectId = resolveProjectId();
const displayName = staffRole === "superadmin" ? "TaskLink Superadmin" : "TaskLink Administrator";

initializeApp({ credential: applicationDefault(), projectId });

async function findOrCreateUser() {
  const auth = getAuth();
  try {
    const existing = await auth.getUserByEmail(email);
    return {
      user: await auth.updateUser(existing.uid, { password, displayName, disabled: false }),
      created: false
    };
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    return {
      user: await auth.createUser({ email, password, displayName, emailVerified: true, disabled: false }),
      created: true
    };
  }
}

async function main() {
  const { user, created } = await findOrCreateUser();
  const claims = {
    ...(user.customClaims ?? {}),
    admin: true,
    superadmin: staffRole === "superadmin"
  };
  await getAuth().setCustomUserClaims(user.uid, claims);

  const now = new Date().toISOString();
  await getFirestore().collection("users").doc(user.uid).set({
    id: user.uid,
    role: "admin",
    fullName: displayName,
    mobileNumber: identifier,
    address: "",
    rating: 0,
    accountStatus: "active",
    updatedAt: now,
    ...(created ? { createdAt: now } : {})
  }, { merge: true });

  console.log(`${created ? "Created" : "Updated"} ${staffRole} account for ${email}.`);
  console.log("Sign out and sign in again before opening the staff dashboard.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
