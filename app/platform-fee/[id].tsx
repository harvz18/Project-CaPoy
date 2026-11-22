import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText as Text, AppTextInput as TextInput } from "../../src/components/AppText";
import { useApp } from "../../src/context/AppContext";
import { pickAndUploadPlatformFeeProof } from "../../src/services/fileUploadService";
import { submitPlatformFeePayment, subscribeToPlatformFee } from "../../src/services/platformRevenueService";
import { PlatformFee } from "../../src/types";

const actionableStatuses: PlatformFee["status"][] = ["pending_payment", "rejected", "overdue"];

export default function PlatformFeeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser, getUserById } = useApp();
  const [fee, setFee] = useState<PlatformFee>();
  const [reference, setReference] = useState("");
  const [receiptPath, setReceiptPath] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return () => undefined;
    return subscribeToPlatformFee(id, setFee, (error) => setMessage(error.message));
  }, [id]);

  const worker = fee?.workerId ? getUserById(fee.workerId) : undefined;
  const canSubmit = Boolean(fee && actionableStatuses.includes(fee.status));

  async function upload() {
    if (!id) return;
    setBusy(true);
    setMessage("");
    try {
      const uploaded = await pickAndUploadPlatformFeeProof(id);
      if (uploaded) {
        setReceiptPath(uploaded.path);
        setMessage("Receipt uploaded privately. Enter the GCash reference and submit it for review.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload receipt.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!receiptPath) {
      setMessage("Upload the GCash receipt first.");
      return;
    }
    setBusy(true);
    try {
      await submitPlatformFeePayment(id, receiptPath, reference);
      setMessage("Service-fee payment submitted for administrator review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit service-fee payment.");
    } finally {
      setBusy(false);
    }
  }

  async function copyGcashNumber() {
    if (!fee?.destination.gcashNumber) return;
    await Clipboard.setStringAsync(fee.destination.gcashNumber);
    setMessage("GCash number copied.");
  }

  if (currentUser?.role !== "client") {
    return <SafeAreaView style={styles.safe}><Text style={styles.message}>Only the employer can view this payment.</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back to task</Text>
        </Pressable>
        {!fee ? <Text style={styles.message}>No platform fee is available for this task yet.</Text> : (
          <View style={styles.card}>
            <Text style={styles.title}>Pay TASKLINK Service Fee</Text>
            <Text style={styles.sub}>{fee.taskTitle}</Text>
            <Row label="Selected tasker" value={worker?.fullName ?? "Assigned tasker"} />
            <Row label="Final agreed wage" value={`₱${fee.workerWage}`} />
            <Row label={`TASKLINK service fee (${(fee.rateBasisPoints / 100).toFixed(2)}%)`} value={`₱${fee.feeAmount}`} />
            <Row label="Total employer obligation" value={`₱${fee.totalEmployerObligation}`} strong />
            <Text style={styles.note}>The worker receives the full agreed wage separately. This payment is only TASKLINK's platform service fee.</Text>

            <View style={styles.destinationCard}>
              <Text style={styles.destinationLabel}>Send exactly ₱{fee.feeAmount} to TASKLINK</Text>
              <Text style={styles.destinationName}>{fee.destination.gcashAccountName}</Text>
              <Pressable accessibilityRole="button" onPress={() => void copyGcashNumber()} style={styles.gcashNumberButton}>
                <Text style={styles.gcashNumber}>{fee.destination.gcashNumber}</Text>
                <Text style={styles.copyText}>Copy GCash number</Text>
              </Pressable>
              {fee.destination.gcashQrImageUrl ? (
                <Image accessibilityLabel="TASKLINK GCash QR code" resizeMode="contain" source={{ uri: fee.destination.gcashQrImageUrl }} style={styles.qrImage} />
              ) : null}
              {fee.destination.instructions ? <Text style={styles.note}>{fee.destination.instructions}</Text> : null}
            </View>

            <Text style={styles.status}>Status: {formatFeeStatus(fee.status)}</Text>
            {fee.rejectionReason ? <Text style={styles.error}>Reason: {fee.rejectionReason}</Text> : null}
            {canSubmit ? (
              <>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void upload()} style={[styles.outline, busy && styles.disabled]}>
                  <Text style={styles.outlineText}>{receiptPath ? "Receipt uploaded" : "Upload GCash receipt"}</Text>
                </Pressable>
                <TextInput
                  accessibilityLabel="GCash transaction reference"
                  autoCapitalize="characters"
                  maxLength={100}
                  onChangeText={setReference}
                  placeholder="GCash transaction reference"
                  placeholderTextColor="#6E7977"
                  style={styles.input}
                  value={reference}
                />
                <Pressable accessibilityRole="button" disabled={busy || !receiptPath || reference.trim().length < 4} onPress={() => void submit()} style={[styles.button, (busy || !receiptPath || reference.trim().length < 4) && styles.disabled]}>
                  <Text style={styles.buttonText}>{busy ? "Please wait..." : "Submit for Verification"}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        )}
        {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View style={styles.row}><Text style={strong ? styles.strong : styles.label}>{label}</Text><Text style={strong ? styles.strong : styles.label}>{value}</Text></View>;
}

function formatFeeStatus(status: PlatformFee["status"]) {
  return ({
    not_due: "Not due",
    pending_payment: "Payment required",
    submitted_for_review: "Submitted for review",
    verified: "Verified",
    rejected: "Resubmission required",
    overdue: "Overdue",
    waived: "Waived",
    cancelled: "Cancelled",
    refund_pending: "Refund pending",
    credited: "Credited"
  } as Record<PlatformFee["status"], string>)[status];
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7FAF8" },
  content: { gap: 14, padding: 18 },
  back: { color: "#005C55", fontWeight: "900" },
  card: { backgroundColor: "#FFF", borderColor: "#BDC9C6", borderRadius: 14, borderWidth: 1, gap: 12, padding: 16 },
  title: { color: "#181C1C", fontSize: 22, fontWeight: "900" },
  sub: { color: "#3E4947" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  label: { color: "#3E4947", flex: 1 },
  strong: { color: "#181C1C", flex: 1, fontWeight: "900" },
  note: { color: "#3E4947", fontSize: 13, lineHeight: 18 },
  destinationCard: { backgroundColor: "#EAF8F1", borderColor: "#75B798", borderRadius: 10, borderWidth: 1, gap: 8, padding: 12 },
  destinationLabel: { color: "#005C55", fontSize: 12, fontWeight: "900" },
  destinationName: { color: "#181C1C", fontSize: 16, fontWeight: "900" },
  gcashNumberButton: { backgroundColor: "#FFF", borderColor: "#005C55", borderRadius: 8, borderWidth: 1, gap: 2, padding: 12 },
  gcashNumber: { color: "#181C1C", fontSize: 18, fontWeight: "900" },
  copyText: { color: "#005C55", fontSize: 12, fontWeight: "900" },
  qrImage: { alignSelf: "center", backgroundColor: "#FFF", borderRadius: 8, height: 220, width: "100%" },
  status: { color: "#181C1C", fontWeight: "800" },
  input: { backgroundColor: "#FFF", borderColor: "#BDC9C6", borderRadius: 8, borderWidth: 1, color: "#181C1C", minHeight: 48, paddingHorizontal: 12 },
  button: { alignItems: "center", backgroundColor: "#005C55", borderRadius: 8, justifyContent: "center", minHeight: 48 },
  buttonText: { color: "#FFF", fontWeight: "900" },
  outline: { alignItems: "center", borderColor: "#005C55", borderRadius: 8, borderWidth: 1, justifyContent: "center", minHeight: 48 },
  outlineText: { color: "#005C55", fontWeight: "900" },
  message: { color: "#3E4947", lineHeight: 20 },
  error: { color: "#BA1A1A", fontWeight: "800" },
  disabled: { opacity: 0.55 }
});
