import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import {
  createFirestorePaymentProofPath,
  maxFirestorePaymentProofBytes,
  parseFirestorePaymentProofPath,
  PaymentProofParty,
  splitPaymentProofBase64
} from "../utils/paymentProof";
import {
  createFirestoreProfilePhotoPath,
  createFirestoreVerificationFilePath,
  FirestoreFilePointer,
  maxFirestoreProfilePhotoBytes,
  maxFirestoreVerificationFileBytes,
  parseFirestoreFilePath,
  splitFirestoreFileBase64,
  VerificationFileKind
} from "../utils/firestoreFiles";
import { auth, db, storage } from "./firebase";

const maxUploadBytes = 10 * 1024 * 1024;

type SelectedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

function inferredMimeType(name: string, mimeType?: string | null) {
  if (mimeType && (mimeType.startsWith("image/") || mimeType === "application/pdf")) return mimeType;
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic" || extension === "heif") return "image/heic";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return mimeType || "application/octet-stream";
}

function requireStorage() {
  if (!storage) throw new Error("Firebase Storage is not configured.");
  return storage;
}

function requireFirestoreReceiptServices() {
  const user = auth?.currentUser;
  if (!db || !user) throw new Error("Sign in again before uploading a payment receipt.");
  return { firestore: db, user };
}

function validateFile(file: SelectedFile, allowPdf: boolean) {
  const allowed = file.mimeType.startsWith("image/") || (allowPdf && file.mimeType === "application/pdf");
  if (!allowed) throw new Error(allowPdf ? "Choose an image or PDF file." : "Choose an image file.");
  if (file.size !== undefined && file.size > maxUploadBytes) throw new Error("Files must be smaller than 10 MB.");
}

function safeFileName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return cleaned.slice(-100) || "upload";
}

type FirestoreFileLocation = {
  pointer: string;
  record: ReturnType<typeof doc>;
  userId: string;
  kind?: VerificationFileKind;
};

async function uploadFirestoreFile(
  file: SelectedFile,
  location: FirestoreFileLocation,
  maxBytes: number,
  label: string
) {
  const { firestore, user } = requireFirestoreReceiptServices();
  if (user.uid !== location.userId) throw new Error("You can only upload files for your own account.");

  const response = await fetch(file.uri);
  if (!response.ok) throw new Error(`Unable to read the selected ${label}.`);
  const blob = await response.blob();
  if (blob.size === 0) throw new Error(`The selected ${label} is empty.`);
  if (blob.size > maxBytes) throw new Error(`${label[0].toUpperCase()}${label.slice(1)} must be smaller than ${maxBytes / (1024 * 1024)} MB.`);

  const base64 = await blobToBase64(blob);
  const chunks = splitFirestoreFileBase64(base64);
  const version = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = new Date().toISOString();
  const metadata = {
    userId: location.userId,
    uploaderId: user.uid,
    fileName: safeFileName(file.name),
    mimeType: file.mimeType,
    byteSize: blob.size,
    encodedSize: base64.length,
    chunkCount: chunks.length,
    version,
    status: "ready",
    createdAt,
    ...(location.kind ? { kind: location.kind } : {})
  };

  await setDoc(location.record, metadata);
  for (const [index, data] of chunks.entries()) {
    const chunkId = index.toString().padStart(3, "0");
    await setDoc(doc(location.record, "chunks", chunkId), {
      id: chunkId,
      userId: location.userId,
      uploaderId: user.uid,
      index,
      version,
      data,
      createdAt,
      ...(location.kind ? { kind: location.kind } : {})
    });
  }

  return { name: file.name, path: location.pointer };
}

export async function pickAndUploadProfilePhoto(userId: string) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file: SelectedFile = {
    uri: asset.uri,
    name: asset.fileName ?? "profile-photo.jpg",
    mimeType: inferredMimeType(asset.fileName ?? "profile-photo.jpg", asset.mimeType),
    size: asset.fileSize
  };
  validateFile(file, false);
  const firestore = requireFirestoreReceiptServices().firestore;
  return uploadFirestoreFile(file, {
    pointer: createFirestoreProfilePhotoPath(userId),
    record: doc(firestore, "profilePhotoFiles", userId),
    userId
  }, maxFirestoreProfilePhotoBytes, "profile photo");
}

export async function pickAndUploadPrivateDocument(
  ownerId: string,
  kind: "valid-id" | "medical-certificate" | "police-clearance"
) {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/*", "application/pdf"],
    copyToCacheDirectory: true,
    multiple: false
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file: SelectedFile = {
    uri: asset.uri,
    name: asset.name,
    mimeType: inferredMimeType(asset.name, asset.mimeType),
    size: asset.size
  };
  validateFile(file, true);
  const firestore = requireFirestoreReceiptServices().firestore;
  return uploadFirestoreFile(file, {
    pointer: createFirestoreVerificationFilePath(ownerId, kind),
    record: doc(firestore, "verificationFiles", ownerId, "uploads", kind),
    userId: ownerId,
    kind
  }, maxFirestoreVerificationFileBytes, "verification document");
}

async function pickAndUploadPrivatePaymentFile(
  taskId: string,
  party: PaymentProofParty,
  allowPdf: boolean,
  label: string
) {
  const result = await DocumentPicker.getDocumentAsync({
    type: allowPdf ? ["image/*", "application/pdf"] : ["image/*"],
    copyToCacheDirectory: true,
    multiple: false
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file: SelectedFile = {
    uri: asset.uri,
    name: asset.name,
    mimeType: inferredMimeType(asset.name, asset.mimeType),
    size: asset.size
  };
  validateFile(file, allowPdf);
  const { firestore, user } = requireFirestoreReceiptServices();
  const response = await fetch(file.uri);
  if (!response.ok) throw new Error(`Unable to read the selected ${label}.`);
  const blob = await response.blob();
  if (blob.size === 0) throw new Error(`The selected ${label} is empty.`);
  if (blob.size > maxFirestorePaymentProofBytes) {
    throw new Error(`${allowPdf ? "Files" : "Images"} must be smaller than 5 MB.`);
  }
  const base64 = await blobToBase64(blob);
  const chunks = splitPaymentProofBase64(base64);
  const version = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = new Date().toISOString();
  const proofRef = doc(firestore, "paymentProofFiles", taskId, "uploads", party);
  await setDoc(proofRef, {
    taskId,
    party,
    uploaderId: user.uid,
    fileName: safeFileName(file.name),
    mimeType: file.mimeType,
    byteSize: blob.size,
    encodedSize: base64.length,
    chunkCount: chunks.length,
    version,
    status: "ready",
    createdAt
  });
  for (const [index, data] of chunks.entries()) {
    const chunkId = index.toString().padStart(3, "0");
    await setDoc(doc(proofRef, "chunks", chunkId), {
      id: chunkId,
      taskId,
      party,
      uploaderId: user.uid,
      index,
      version,
      data,
      createdAt
    });
  }
  const path = createFirestorePaymentProofPath(taskId, party);
  return { name: file.name, path };
}

export function pickAndUploadPaymentProof(taskId: string, party: Exclude<PaymentProofParty, "worker-gcash-qr">) {
  return pickAndUploadPrivatePaymentFile(taskId, party, true, "payment receipt");
}

export function pickAndUploadGcashQr(taskId: string) {
  return pickAndUploadPrivatePaymentFile(taskId, "worker-gcash-qr", false, "GCash QR image");
}

export async function getPaymentProofDownloadUrl(taskId: string, path: string) {
  const firestoreProof = parseFirestorePaymentProofPath(path);
  if (firestoreProof) {
    if (firestoreProof.taskId !== taskId) throw new Error("The payment proof path is invalid.");
    if (!db) throw new Error("Firebase is not configured.");
    const proofRef = doc(db, "paymentProofFiles", taskId, "uploads", firestoreProof.party);
    const proofSnapshot = await getDoc(proofRef);
    if (!proofSnapshot.exists()) throw new Error("The payment receipt is no longer available.");
    const proof = proofSnapshot.data();
    if (
      proof.taskId !== taskId ||
      proof.party !== firestoreProof.party ||
      proof.status !== "ready" ||
      typeof proof.mimeType !== "string" ||
      typeof proof.fileName !== "string" ||
      typeof proof.version !== "string" ||
      typeof proof.chunkCount !== "number" ||
      typeof proof.encodedSize !== "number"
    ) {
      throw new Error("The payment receipt record is invalid.");
    }
    const chunkSnapshot = await getDocs(collection(proofRef, "chunks"));
    const chunks = chunkSnapshot.docs
      .map((item) => item.data())
      .filter((item) => item.version === proof.version && Number.isInteger(item.index) && typeof item.data === "string")
      .sort((left, right) => left.index - right.index);
    if (chunks.length !== proof.chunkCount || chunks.some((item, index) => item.index !== index)) {
      throw new Error("The payment receipt is incomplete. Upload it again.");
    }
    const base64 = chunks.map((item) => item.data).join("");
    if (base64.length !== proof.encodedSize) throw new Error("The payment receipt is incomplete. Upload it again.");
    return materializeFile(base64, proof.mimeType, proof.fileName);
  }
  if (!path.startsWith(`paymentProofs/${taskId}/`)) {
    throw new Error("The payment proof path is invalid.");
  }
  return getDownloadURL(ref(requireStorage(), path));
}

export async function getFirestoreFileDownloadUrl(path: string) {
  const pointer = parseFirestoreFilePath(path);
  if (!pointer) return null;
  if (!db) throw new Error("Firebase is not configured.");

  const record = getFirestoreFileRecord(db, pointer);
  const snapshot = await getDoc(record);
  if (!snapshot.exists()) throw new Error("The uploaded file is no longer available.");
  const file = snapshot.data();
  if (!isValidFirestoreFileRecord(file, pointer)) throw new Error("The uploaded file record is invalid.");

  const chunkSnapshot = await getDocs(collection(record, "chunks"));
  const chunks = chunkSnapshot.docs
    .map((item) => item.data())
    .filter((item) => item.version === file.version && Number.isInteger(item.index) && typeof item.data === "string")
    .sort((left, right) => left.index - right.index);
  if (chunks.length !== file.chunkCount || chunks.some((item, index) => item.index !== index)) {
    throw new Error("The uploaded file is incomplete. Upload it again.");
  }
  const base64 = chunks.map((item) => item.data).join("");
  if (base64.length !== file.encodedSize) throw new Error("The uploaded file is incomplete. Upload it again.");
  return materializeFile(base64, file.mimeType, file.fileName);
}

export async function resolveProfilePhotoUri(path?: string) {
  if (!path) return undefined;
  return await getFirestoreFileDownloadUrl(path) ?? path;
}

function getFirestoreFileRecord(firestore: NonNullable<typeof db>, pointer: FirestoreFilePointer) {
  return pointer.type === "profile-photo"
    ? doc(firestore, "profilePhotoFiles", pointer.userId)
    : doc(firestore, "verificationFiles", pointer.userId, "uploads", pointer.kind);
}

function isValidFirestoreFileRecord(file: Record<string, unknown>, pointer: FirestoreFilePointer) {
  const maxBytes = pointer.type === "profile-photo" ? maxFirestoreProfilePhotoBytes : maxFirestoreVerificationFileBytes;
  const byteSize = file.byteSize;
  const encodedSize = file.encodedSize;
  const chunkCount = file.chunkCount;
  return file.userId === pointer.userId
    && typeof file.uploaderId === "string"
    && typeof file.fileName === "string"
    && typeof file.mimeType === "string"
    && (file.mimeType.startsWith("image/") || (pointer.type === "verification" && file.mimeType === "application/pdf"))
    && typeof byteSize === "number"
    && Number.isInteger(byteSize)
    && byteSize > 0
    && byteSize <= maxBytes
    && typeof encodedSize === "number"
    && Number.isInteger(encodedSize)
    && encodedSize > 0
    && typeof chunkCount === "number"
    && Number.isInteger(chunkCount)
    && chunkCount > 0
    && typeof file.version === "string"
    && file.status === "ready"
    && typeof file.createdAt === "string"
    && (pointer.type === "profile-photo" || file.kind === pointer.kind);
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the selected receipt."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result.includes(",")) {
        reject(new Error("Unable to encode the selected receipt."));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

async function materializeFile(base64: string, mimeType: string, fileName: string) {
  if (Platform.OS === "web") {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  }
  const cacheRoot = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!cacheRoot) throw new Error("A local receipt cache is unavailable on this device.");
  const localPath = `${cacheRoot}tasklink-receipt-${Date.now()}-${safeFileName(fileName)}`;
  await FileSystem.writeAsStringAsync(localPath, base64, { encoding: FileSystem.EncodingType.Base64 });
  return Platform.OS === "android" ? FileSystem.getContentUriAsync(localPath) : localPath;
}
