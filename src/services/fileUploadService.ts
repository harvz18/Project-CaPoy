import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

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

export async function pickAndUploadPaymentProof(taskId: string) {
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
  const path = `paymentProofs/${taskId}/${Date.now()}_${safeFileName(file.name)}`;
  await uploadSelectedFile(file, path);
  return { name: file.name, path };
}
