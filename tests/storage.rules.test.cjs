const { after, before, beforeEach, test } = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} = require("@firebase/rules-unit-testing");
const { doc, setDoc } = require("firebase/firestore");
const { getBytes, ref, uploadBytes } = require("firebase/storage");

const PROJECT_ID = "demo-tasklink";
const CLIENT_ID = "storage-client";
const WORKER_ID = "storage-worker";
const APPLICANT_ID = "storage-applicant";
const TASK_ID = "storage-task";

let testEnvironment;

function storageFor(userId) {
  return testEnvironment.authenticatedContext(userId).storage();
}

async function seedTask() {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "users", CLIENT_ID), {
        id: CLIENT_ID,
        role: "client",
        accountStatus: "active"
      }),
      setDoc(doc(db, "users", WORKER_ID), {
        id: WORKER_ID,
        role: "worker",
        accountStatus: "active"
      }),
      setDoc(doc(db, "users", APPLICANT_ID), {
        id: APPLICANT_ID,
        role: "worker",
        accountStatus: "active"
      }),
      setDoc(doc(db, "tasks", TASK_ID), {
        clientId: CLIENT_ID,
        workerId: WORKER_ID,
        applicantIds: [WORKER_ID, APPLICANT_ID],
        status: "Accepted"
      })
    ]);
  });
}

before(async () => {
  testEnvironment = await initializeTestEnvironment({ projectId: PROJECT_ID });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.clearStorage();
  await seedTask();
});

after(async () => {
  await testEnvironment.cleanup();
});

test("verification documents are private to their owner", async () => {
  const path = `verification/${WORKER_ID}/valid-id.pdf`;
  const ownerReference = ref(storageFor(WORKER_ID), path);

  await assertSucceeds(
    uploadBytes(ownerReference, new Uint8Array([1, 2, 3]), {
      contentType: "application/pdf"
    })
  );
  await assertSucceeds(getBytes(ownerReference));
  await assertFails(getBytes(ref(storageFor(CLIENT_ID), path)));
});

test("uploads reject the wrong owner and unsupported content types", async () => {
  await assertFails(
    uploadBytes(
      ref(storageFor(CLIENT_ID), `verification/${WORKER_ID}/not-owned.pdf`),
      new Uint8Array([1]),
      { contentType: "application/pdf" }
    )
  );
  await assertFails(
    uploadBytes(
      ref(storageFor(WORKER_ID), `verification/${WORKER_ID}/script.js`),
      new Uint8Array([1]),
      { contentType: "application/javascript" }
    )
  );
});

test("authenticated users can read an owner-uploaded profile photo", async () => {
  const path = `profilePhotos/${WORKER_ID}/avatar.png`;
  await assertSucceeds(
    uploadBytes(ref(storageFor(WORKER_ID), path), new Uint8Array([1, 2]), {
      contentType: "image/png"
    })
  );
  await assertSucceeds(getBytes(ref(storageFor(CLIENT_ID), path)));
  await assertFails(getBytes(ref(testEnvironment.unauthenticatedContext().storage(), path)));
});

test("payment proof is limited to the client and assigned worker", async () => {
  const path = `paymentProofs/${TASK_ID}/proof.png`;
  await assertSucceeds(
    uploadBytes(ref(storageFor(CLIENT_ID), path), new Uint8Array([1, 2]), {
      contentType: "image/png"
    })
  );
  await assertSucceeds(getBytes(ref(storageFor(WORKER_ID), path)));
  await assertFails(getBytes(ref(storageFor(APPLICANT_ID), path)));
  await assertFails(
    uploadBytes(ref(storageFor(WORKER_ID), `paymentProofs/${TASK_ID}/worker.png`), new Uint8Array([1]), {
      contentType: "image/png"
    })
  );
});
