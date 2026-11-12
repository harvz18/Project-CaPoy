import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
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
  createFirestoreVerificationDocumentPath,
  maxFirestoreVerificationDocumentBytes,
  splitVerificationDocumentBase64,
  VerificationDocumentKind
} from "../utils/verificationDocument";
import { auth, db, storage } from "./firebase";

const maxUploadBytes = 10 * 1024 * 1024;
// A profile picture is kept as a compact data URL in Firestore so it works on
// the project's no-Blaze deployment. This stays well under Firestore's 1 MiB
// document limit even after the URL prefix and the rest of the profile fields.
const maxProfilePhotoBase64Length = 700_000;

export type SelectedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  base64?: string;
};

export type UploadSource = "camera" | "library";

function requireStorage() {
  if (!storage) throw new Error("Firebase Storage is not configured.");
  return storage;
}

function requireFirestoreReceiptServices() {
  const user = auth?.currentUser;
  if (!db || !user) throw new Error("Sign in again before uploading a payment receipt.");
  return { firestore: db, user };
}

function requireFirestoreVerificationServices(ownerId: string) {
  const user = auth?.currentUser;
  if (!db || !user) throw new Error("Sign in again before uploading a verification document.");
  if (user.uid !== ownerId) throw new Error("You can upload verification documents only for your own account.");
  return { firestore: db, user };
}

function validateFile(file: SelectedFile, allowPdf: boolean) {
  const allowed = file.mimeType.startsWith("image/") || (allowPdf && file.mimeType === "application/pdf");
  if (!allowed) throw new Error(allowPdf ? "Choose an image or PDF file." : "Choose an image file.");
  const maximumBytes = allowPdf ? maxFirestoreVerificationDocumentBytes : maxUploadBytes;
  if (file.size !== undefined && file.size > maximumBytes) throw new Error(`Files must be smaller than ${allowPdf ? "5" : "10"} MB.`);
}

function safeFileName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return cleaned.slice(-100) || "upload";
}

async function pickImage(source: UploadSource, fallbackName: string, options: ImagePicker.ImagePickerOptions) {
  if (Platform.OS !== "web") {
    const permission = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error(source === "camera" ? "Camera access is needed to take a profile photo." : "Photo-library access is needed to choose a profile photo.");
    }
  }
  const result = source === "camera"
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file: SelectedFile = {
    uri: asset.uri,
    name: asset.fileName ?? fallbackName,
    mimeType: asset.mimeType ?? "image/jpeg",
    size: asset.fileSize,
    base64: asset.base64 ?? undefined
  };
  return file;
}

export async function pickProfilePhoto(source: UploadSource = "library") {
  const file = await pickImage(source, "profile-photo.jpg", {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    base64: true,
    quality: 0.3
  });
  if (!file) return null;
  validateFile(file, false);
  return file;
}

export async function uploadProfilePhoto(userId: string, file: SelectedFile) {
  if (!userId) throw new Error("Sign in again before uploading a profile photo.");
  const base64 = file.base64 ?? await readFileAsBase64(file.uri, "profile photo");
  if (!base64 || base64.length > maxProfilePhotoBase64Length) {
    throw new Error("Choose a smaller profile photo (up to about 500 KB after compression).");
  }
  return { name: file.name, url: `data:${file.mimeType};base64,${base64}` };
}

export async function pickAndUploadProfilePhoto(userId: string, source: UploadSource = "library") {
  const file = await pickProfilePhoto(source);
  return file ? uploadProfilePhoto(userId, file) : null;
}

async function pickPrivateFile(source: UploadSource, allowPdf: boolean, fallbackName: string) {
  if (source === "camera") {
    const file = await pickImage("camera", fallbackName, {
      mediaTypes: ["images"],
      quality: 0.7
    });
    if (!file) return null;
    validateFile(file, false);
    return file;
  }
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
    mimeType: asset.mimeType ?? "application/octet-stream",
    size: asset.size
  };
  validateFile(file, allowPdf);
  return file;
}

export async function pickAndUploadPrivateDocument(
  ownerId: string,
  kind: VerificationDocumentKind,
  source: UploadSource = "library"
) {
  const file = await pickPrivateFile(source, true, `${kind}.jpg`);
  if (!file) return null;
  const { firestore, user } = requireFirestoreVerificationServices(ownerId);
  const base64 = await readFileAsBase64(file.uri, "verification document");
  const byteSize = base64ByteLength(base64);
  if (byteSize === 0) throw new Error("The selected verification document is empty.");
  if (byteSize > maxFirestoreVerificationDocumentBytes) {
    throw new Error("Verification files must be smaller than 5 MB.");
  }
  const chunks = splitVerificationDocumentBase64(base64);
  const version = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = new Date().toISOString();
  const fileRef = doc(firestore, "verificationFiles", ownerId, "uploads", kind);
  const metadata = {
    userId: ownerId,
    kind,
    uploaderId: user.uid,
    fileName: safeFileName(file.name),
    mimeType: file.mimeType,
    byteSize,
    encodedSize: base64.length,
    chunkCount: chunks.length,
    version,
    status: "uploading",
    createdAt
  };
  await setDoc(fileRef, metadata);
  for (const [index, data] of chunks.entries()) {
    const chunkId = index.toString().padStart(3, "0");
    await setDoc(doc(fileRef, "chunks", chunkId), {
      id: chunkId,
      userId: ownerId,
      kind,
      uploaderId: user.uid,
      index,
      version,
      data,
      createdAt
    });
  }
  await setDoc(fileRef, { ...metadata, status: "ready" });
  return { name: file.name, path: createFirestoreVerificationDocumentPath(ownerId, kind) };
}

async function pickAndUploadPrivatePaymentFile(
  taskId: string,
  party: PaymentProofParty,
  allowPdf: boolean,
  label: string,
  source: UploadSource
) {
  const file = await pickPrivateFile(source, allowPdf, `${party}-${label.replace(/\s+/g, "-")}.jpg`);
  if (!file) return null;
  const { firestore, user } = requireFirestoreReceiptServices();
  const base64 = await readFileAsBase64(file.uri, label);
  const byteSize = base64ByteLength(base64);
  if (byteSize === 0) throw new Error(`The selected ${label} is empty.`);
  if (byteSize > maxFirestorePaymentProofBytes) {
    throw new Error(`${allowPdf ? "Files" : "Images"} must be smaller than 5 MB.`);
  }
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
    byteSize,
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

export function pickAndUploadPaymentProof(taskId: string, party: Exclude<PaymentProofParty, "worker-gcash-qr">, source: UploadSource = "library") {
  return pickAndUploadPrivatePaymentFile(taskId, party, true, "payment receipt", source);
}

export function pickAndUploadGcashQr(taskId: string, source: UploadSource = "library") {
  return pickAndUploadPrivatePaymentFile(taskId, "worker-gcash-qr", false, "GCash QR image", source);
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
    return materializePaymentProof(base64, proof.mimeType, proof.fileName);
  }
  if (!path.startsWith(`paymentProofs/${taskId}/`)) {
    throw new Error("The payment proof path is invalid.");
  }
  return getDownloadURL(ref(requireStorage(), path));
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

function base64ByteLength(base64: string) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor(base64.length * 3 / 4) - padding;
}

async function readFileAsBase64(uri: string, label: string) {
  if (Platform.OS !== "web") {
    try {
      const base64 = await new File(uri).base64();
      if (base64) return base64;
    } catch {
      // Some Android providers expose gallery selections as content URIs. Fall
      // back to the legacy API and, if necessary, an explicit cache copy.
    }
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      if (base64) return base64;
    } catch {
      // Continue with an explicit cache copy below for Android content URIs.
    }
    try {
      const cacheDirectory = FileSystem.cacheDirectory;
      if (cacheDirectory) {
        const cachedUri = `${cacheDirectory}tasklink-upload-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`;
        await FileSystem.copyAsync({ from: uri, to: cachedUri });
        const base64 = await FileSystem.readAsStringAsync(cachedUri, {
          encoding: FileSystem.EncodingType.Base64
        });
        if (base64) return base64;
      }
    } catch {
      // Report one clear, actionable error below if every supported native
      // reader rejects the selected file.
    }
    throw new Error(`Unable to read the selected ${label}. Choose the file again and retry.`);
  }
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Unable to read the selected ${label}.`);
  return blobToBase64(await response.blob());
}

async function materializePaymentProof(base64: string, mimeType: string, fileName: string) {
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
