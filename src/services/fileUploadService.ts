import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  createFirestorePaymentProofPath,
  maxFirestorePaymentProofBytes,
  parseFirestorePaymentProofPath,
  PaymentProofParty,
  splitPaymentProofBase64
} from "../utils/paymentProof";
import { auth, db, storage } from "./firebase";

const maxUploadBytes = 10 * 1024 * 1024;

type SelectedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

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

async function uploadSelectedFile(file: SelectedFile, path: string) {
  const response = await fetch(file.uri);
  if (!response.ok) throw new Error("Unable to read the selected file.");
  const blob = await response.blob();
  if (blob.size > maxUploadBytes) throw new Error("Files must be smaller than 10 MB.");
  const uploadRef = ref(requireStorage(), path);
  await uploadBytes(uploadRef, blob, { contentType: file.mimeType });
  return uploadRef;
}

export async function pickAndUploadProfilePhoto(userId: string) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file: SelectedFile = {
    uri: asset.uri,
    name: asset.fileName ?? "profile-photo.jpg",
    mimeType: asset.mimeType ?? "image/jpeg",
    size: asset.fileSize
  };
  validateFile(file, false);
  const uploadRef = await uploadSelectedFile(
    file,
    `profilePhotos/${userId}/${Date.now()}_${safeFileName(file.name)}`
  );
  return { name: file.name, url: await getDownloadURL(uploadRef) };
}

export async function pickAndUploadPrivateDocument(
  ownerId: string,
  kind: "valid-id" | "medical-certificate"
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
    mimeType: asset.mimeType ?? "application/octet-stream",
    size: asset.size
  };
  validateFile(file, true);
  const path = `verification/${ownerId}/${kind}_${Date.now()}_${safeFileName(file.name)}`;
  await uploadSelectedFile(file, path);
  return { name: file.name, path };
}

export async function pickAndUploadPaymentProof(taskId: string, party: PaymentProofParty) {
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
    mimeType: asset.mimeType ?? "application/octet-stream",
    size: asset.size
  };
  validateFile(file, true);
  const { firestore, user } = requireFirestoreReceiptServices();
  const response = await fetch(file.uri);
  if (!response.ok) throw new Error("Unable to read the selected receipt.");
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("The selected receipt is empty.");
  if (blob.size > maxFirestorePaymentProofBytes) {
    throw new Error("Receipt images and PDFs must be smaller than 5 MB.");
  }
  const base64 = await blobToBase64(blob);
  const chunks = splitPaymentProofBase64(base64);
  const version = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = new Date().toISOString();
  const proofRef = doc(firestore, "paymentProofFiles", taskId, "uploads", party);
  const batch = writeBatch(firestore);
  batch.set(proofRef, {
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
  chunks.forEach((data, index) => {
    const chunkId = index.toString().padStart(3, "0");
    batch.set(doc(proofRef, "chunks", chunkId), {
      id: chunkId,
      taskId,
      party,
      uploaderId: user.uid,
      index,
      version,
      data,
      createdAt
    });
  });
  await batch.commit();
  const path = createFirestorePaymentProofPath(taskId, party);
  return { name: file.name, path };
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
