import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "./AppText";
import { fetchBacolodBarangays } from "../services/bacolodBarangayService";

type Props = { value: string; onChange: (barangay: string) => void; label?: string };

export function BacolodBarangayPicker({ value, onChange, label = "Barangay" }: Props) {
  const [visible, setVisible] = useState(false);
  const [barangays, setBarangays] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const filtered = useMemo(() => barangays.filter((barangay) => barangay.toLowerCase().includes(query.trim().toLowerCase())), [barangays, query]);

  useEffect(() => {
    if (visible && !barangays.length && !loading) void loadBarangays();
  }, [visible]);

  async function loadBarangays() {
    setLoading(true); setError("");
    try { setBarangays(await fetchBacolodBarangays()); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load barangays."); }
    finally { setLoading(false); }
  }

  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" onPress={() => setVisible(true)} style={styles.trigger}><Text style={[styles.triggerText, !value && styles.placeholder]}>{value || "Choose a Bacolod barangay"}</Text><Text style={styles.chevron}>⌄</Text></Pressable>
    <Modal animationType="slide" onRequestClose={() => setVisible(false)} presentationStyle="pageSheet" visible={visible}>
      <View style={styles.modal}><View style={styles.header}><View><Text style={styles.title}>Choose Barangay</Text><Text style={styles.subtitle}>Live administrative-boundary data for Bacolod City</Text></View><Pressable accessibilityRole="button" onPress={() => setVisible(false)} style={styles.close}><Text style={styles.closeText}>Done</Text></Pressable></View>
        <TextInput autoFocus onChangeText={setQuery} placeholder="Search barangay" placeholderTextColor="#6E7977" style={styles.search} value={query} />
        {loading ? <View style={styles.center}><ActivityIndicator color="#005C55" /><Text style={styles.meta}>Loading Bacolod barangays…</Text></View> : error ? <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void loadBarangays()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : <FlatList data={filtered} keyExtractor={(item) => item} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Text style={styles.meta}>No matching barangay.</Text>} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: item === value }} onPress={() => { onChange(item); setVisible(false); }} style={[styles.option, item === value && styles.optionSelected]}><Text style={[styles.optionText, item === value && styles.optionTextSelected]}>{item}</Text>{item === value ? <Text style={styles.check}>Selected</Text> : null}</Pressable>} />}
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({ field: { gap: 6 }, label: { color: "#181C1C", fontSize: 14, fontWeight: "800" }, trigger: { alignItems: "center", backgroundColor: "#F1F4F3", borderColor: "#BDC9C6", borderRadius: 8, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 14 }, triggerText: { color: "#181C1C", flex: 1, fontSize: 16, fontWeight: "700" }, placeholder: { color: "#6E7977", fontWeight: "500" }, chevron: { color: "#005C55", fontSize: 20, fontWeight: "900" }, modal: { backgroundColor: "#F7FAF8", flex: 1, gap: 12, padding: 16 }, header: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between", paddingTop: 12 }, title: { color: "#181C1C", fontSize: 20, fontWeight: "900" }, subtitle: { color: "#3E4947", fontSize: 12, lineHeight: 17, marginTop: 2 }, close: { alignItems: "center", backgroundColor: "#005C55", borderRadius: 8, justifyContent: "center", minHeight: 40, paddingHorizontal: 13 }, closeText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, search: { backgroundColor: "#FFFFFF", borderColor: "#BDC9C6", borderRadius: 8, borderWidth: 1, color: "#181C1C", minHeight: 48, paddingHorizontal: 13 }, option: { alignItems: "center", backgroundColor: "#FFFFFF", borderBottomColor: "#E5E9E7", borderBottomWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", minHeight: 52, paddingHorizontal: 14 }, optionSelected: { backgroundColor: "#E5F1EE" }, optionText: { color: "#181C1C", flex: 1, fontSize: 15, fontWeight: "700" }, optionTextSelected: { color: "#005C55", fontWeight: "900" }, check: { color: "#005C55", fontSize: 11, fontWeight: "900" }, center: { alignItems: "center", flex: 1, gap: 12, justifyContent: "center", padding: 24 }, meta: { color: "#3E4947", fontSize: 13, lineHeight: 19, textAlign: "center" }, error: { color: "#B42318", fontSize: 14, fontWeight: "700", textAlign: "center" }, retry: { alignItems: "center", borderColor: "#005C55", borderRadius: 8, borderWidth: 1, justifyContent: "center", minHeight: 42, paddingHorizontal: 14 }, retryText: { color: "#005C55", fontWeight: "900" } });
