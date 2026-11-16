import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText as Text, AppTextInput as TextInput } from "../../src/components/AppText";
import { useApp } from "../../src/context/AppContext";
import { pickAndUploadPlatformFeeProof } from "../../src/services/fileUploadService";
import { ensurePlatformFee, submitPlatformFeePayment, subscribeToPlatformFee } from "../../src/services/platformRevenueService";
import { PlatformFee } from "../../src/types";

export default function PlatformFeeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter(); const { currentUser } = useApp();
  const [fee, setFee] = useState<PlatformFee>(); const [reference, setReference] = useState(""); const [receiptPath, setReceiptPath] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!id) return () => undefined;
    void ensurePlatformFee(id).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to prepare the service fee."));
    return subscribeToPlatformFee(id, setFee, (error) => setMessage(error.message));
  }, [id]);
  async function upload() { if (!id) return; setBusy(true); setMessage(""); try { const uploaded = await pickAndUploadPlatformFeeProof(id); if (uploaded) { setReceiptPath(uploaded.path); setMessage("Receipt uploaded privately. Enter the GCash reference and submit it for review."); } } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to upload receipt."); } finally { setBusy(false); } }
  async function submit() { if (!receiptPath) { setMessage("Upload the GCash receipt first."); return; } setBusy(true); try { await submitPlatformFeePayment(id, receiptPath, reference); setMessage("Service-fee payment submitted for administrator review."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to submit service-fee payment."); } finally { setBusy(false); } }
  if (currentUser?.role !== "client") return <SafeAreaView style={styles.safe}><Text style={styles.message}>Only the employer can view this payment.</Text></SafeAreaView>;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back to task</Text></Pressable>{!fee ? <Text style={styles.message}>No platform fee is available for this task yet.</Text> : <View style={styles.card}>
    <Text style={styles.title}>Pay TASKLINK Service Fee</Text><Text style={styles.sub}>{fee.taskTitle}</Text>
    <Row label="Worker pay" value={`₱${fee.workerWage}`} /><Row label={`TASKLINK service fee (${(fee.rateBasisPoints / 100).toFixed(2)}%)`} value={`₱${fee.feeAmount}`} /><Row label="Total employer obligation" value={`₱${fee.totalEmployerObligation}`} strong />
    <Text style={styles.note}>The worker receives the full agreed wage separately. This payment is only TASKLINK's platform service fee.</Text>
    <Text style={styles.destination}>Send ₱{fee.feeAmount} to {fee.destination.gcashAccountName} · {fee.destination.gcashNumber}</Text><Text style={styles.note}>{fee.destination.instructions}</Text>
    <Text style={styles.status}>Status: {fee.status.replaceAll("_", " ")}</Text>{fee.rejectionReason ? <Text style={styles.error}>Reason: {fee.rejectionReason}</Text> : null}
    {['pending_payment', 'rejected', 'overdue'].includes(fee.status) ? <><Pressable disabled={busy} onPress={() => void upload()} style={styles.outline}><Text style={styles.outlineText}>{receiptPath ? "Receipt uploaded" : "Upload GCash receipt"}</Text></Pressable><TextInput value={reference} onChangeText={setReference} placeholder="GCash transaction reference" style={styles.input} /><Pressable disabled={busy} onPress={() => void submit()} style={styles.button}><Text style={styles.buttonText}>{busy ? "Please wait..." : "Submit for Verification"}</Text></Pressable></> : null}
  </View>}{message ? <Text style={styles.message}>{message}</Text> : null}</ScrollView></SafeAreaView>;
}
function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <View style={styles.row}><Text style={strong ? styles.strong : styles.label}>{label}</Text><Text style={strong ? styles.strong : styles.label}>{value}</Text></View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F7FAF8" }, content: { gap: 14, padding: 18 }, back: { color: "#005C55", fontWeight: "900" }, card: { backgroundColor: "#FFF", borderColor: "#BDC9C6", borderRadius: 14, borderWidth: 1, gap: 12, padding: 16 }, title: { color: "#181C1C", fontSize: 22, fontWeight: "900" }, sub: { color: "#3E4947" }, row: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, label: { color: "#3E4947" }, strong: { color: "#181C1C", fontWeight: "900" }, note: { color: "#3E4947", fontSize: 13, lineHeight: 18 }, destination: { color: "#005C55", fontWeight: "900" }, status: { color: "#181C1C", fontWeight: "800", textTransform: "capitalize" }, input: { borderColor: "#BDC9C6", borderRadius: 8, borderWidth: 1, minHeight: 48, paddingHorizontal: 12 }, button: { alignItems: "center", backgroundColor: "#005C55", borderRadius: 8, minHeight: 48, justifyContent: "center" }, buttonText: { color: "#FFF", fontWeight: "900" }, outline: { alignItems: "center", borderColor: "#005C55", borderRadius: 8, borderWidth: 1, minHeight: 48, justifyContent: "center" }, outlineText: { color: "#005C55", fontWeight: "900" }, message: { color: "#3E4947", lineHeight: 20 }, error: { color: "#BA1A1A", fontWeight: "800" } });
