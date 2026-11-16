import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "./AppText";
import {
  loadBarangays,
  loadCitiesMunicipalities,
  loadIndependentCities,
  loadPhilippineRegions,
  loadProvinces,
  PhilippineAddressOption
} from "../services/philippineAddressService";
import { AddressDetails } from "../utils/address";

type Props = { value: AddressDetails; onChange: (next: AddressDetails) => void; disabled?: boolean };
type Level = "region" | "province" | "city" | "barangay";
const noProvince = "__independent_city__";

/** A cascading PSGC selector. Changing a parent clears only its dependent fields. */
export function PhilippineAddressPicker({ value, onChange, disabled = false }: Props) {
  const [regions, setRegions] = useState<PhilippineAddressOption[]>([]);
  const [provinces, setProvinces] = useState<PhilippineAddressOption[]>([]);
  const [cities, setCities] = useState<PhilippineAddressOption[]>([]);
  const [barangays, setBarangays] = useState<PhilippineAddressOption[]>([]);
  const [loading, setLoading] = useState<Level | undefined>();
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Level>();
  const [query, setQuery] = useState("");

  useEffect(() => { void loadRegions(); }, []);

  async function safely(level: Level, operation: () => Promise<PhilippineAddressOption[]>, save: (items: PhilippineAddressOption[]) => void) {
    setLoading(level); setError("");
    try { save(await operation()); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Address data could not be loaded."); }
    finally { setLoading(undefined); }
  }
  function loadRegions() { return safely("region", loadPhilippineRegions, setRegions); }
  function selectRegion(option: PhilippineAddressOption) {
    onChange({ ...value, region: option.name, regionCode: option.code, province: "", provinceCode: "", city: "", cityMunicipality: "", cityMunicipalityCode: "", barangay: "", barangayCode: "" });
    setCities([]); setBarangays([]); setOpen(undefined);
    void (async () => {
      setLoading("province"); setError("");
      try {
        const nextProvinces = await loadProvinces(option.code);
        setProvinces(nextProvinces);
        // NCR and regions with only independent cities intentionally skip the
        // province value, but still load a valid city list.
        if (!nextProvinces.length) {
          setLoading("city");
          setCities(await loadIndependentCities(option.code));
        }
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Address data could not be loaded."); }
      finally { setLoading(undefined); }
    })();
  }
  function selectProvince(option: PhilippineAddressOption | undefined) {
    if (!value.regionCode) return;
    onChange({ ...value, province: option?.name ?? "", provinceCode: option?.code ?? noProvince, city: "", cityMunicipality: "", cityMunicipalityCode: "", barangay: "", barangayCode: "" });
    setBarangays([]); setOpen(undefined);
    void safely("city", () => option ? loadCitiesMunicipalities(option.code) : loadIndependentCities(value.regionCode as string), setCities);
  }
  function selectCity(option: PhilippineAddressOption) {
    onChange({ ...value, city: option.name, cityMunicipality: option.name, cityMunicipalityCode: option.code, barangay: "", barangayCode: "" });
    setOpen(undefined); void safely("barangay", () => loadBarangays(option.code), setBarangays);
  }
  function selectBarangay(option: PhilippineAddressOption) {
    onChange({ ...value, barangay: option.name, barangayCode: option.code }); setOpen(undefined);
  }
  const options = open === "region" ? regions : open === "province" ? provinces : open === "city" ? cities : barangays;
  const filtered = useMemo(() => options.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())), [options, query]);
  const loadingLabel = loading ? `Loading ${loading === "city" ? "cities and municipalities" : `${loading}s`}…` : "";
  const canOpen = (level: Level) => !disabled && !loading && (
    level === "region" || (level === "province" && Boolean(value.regionCode)) ||
    (level === "city" && Boolean(value.regionCode) && (Boolean(value.provinceCode) || provinces.length === 0)) ||
    (level === "barangay" && Boolean(value.cityMunicipalityCode))
  );
  const label = (level: Level) => level === "city" ? "City / Municipality" : level[0].toUpperCase() + level.slice(1);
  const display = (level: Level) => level === "region" ? value.region : level === "province" ? (value.provinceCode === noProvince ? "Independent city / municipality" : value.province) : level === "city" ? (value.cityMunicipality || value.city) : value.barangay;
  return <View style={styles.group}>
    <Text style={styles.helper}>Residential address. Task service locations remain limited to Bacolod City.</Text>
    {(["region", "province", "city", "barangay"] as Level[]).map((level) => <View key={level} style={styles.field}>
      <Text style={styles.label}>{label(level)}</Text>
      <Pressable accessibilityRole="button" disabled={!canOpen(level)} onPress={() => { setQuery(""); setOpen(level); }} style={[styles.trigger, !canOpen(level) && styles.disabled]}>
        <Text numberOfLines={1} style={[styles.triggerText, !display(level) && styles.placeholder]}>{display(level) || `Choose ${label(level).toLowerCase()}`}</Text><Text style={styles.chevron}>⌄</Text>
      </Pressable>
      {level === "province" && value.regionCode && provinces.length > 0 ? <Pressable accessibilityRole="button" disabled={disabled || Boolean(loading)} onPress={() => selectProvince(undefined)} style={styles.independent}><Text style={styles.independentText}>My city is not under a province (HUC / NCR)</Text></Pressable> : null}
    </View>)}
    {loadingLabel ? <View style={styles.loading}><ActivityIndicator color="#005C55" /><Text style={styles.helper}>{loadingLabel}</Text></View> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Modal transparent animationType="fade" visible={Boolean(open)} onRequestClose={() => setOpen(undefined)}><View style={styles.backdrop}><View style={styles.modal}>
      <View style={styles.header}><Text style={styles.title}>Choose {open ? label(open) : "address"}</Text><Pressable accessibilityRole="button" onPress={() => setOpen(undefined)}><Text style={styles.close}>Done</Text></Pressable></View>
      <TextInput autoFocus value={query} onChangeText={setQuery} placeholder={`Search ${open ? label(open).toLowerCase() : ""}`} style={styles.search} />
      <FlatList data={filtered} keyExtractor={(item) => item.code} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Text style={styles.helper}>No matching option.</Text>} renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => open === "region" ? selectRegion(item) : open === "province" ? selectProvince(item) : open === "city" ? selectCity(item) : selectBarangay(item)} style={styles.option}><Text style={styles.optionText}>{item.name}</Text></Pressable>} />
    </View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 10 }, field: { gap: 5 }, label: { color: "#181C1C", fontSize: 14, fontWeight: "800" }, helper: { color: "#3E4947", fontSize: 12, lineHeight: 17 }, trigger: { alignItems: "center", backgroundColor: "#F1F4F3", borderColor: "#BDC9C6", borderRadius: 8, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 14 }, disabled: { opacity: .58 }, triggerText: { color: "#181C1C", flex: 1, fontSize: 15, fontWeight: "700" }, placeholder: { color: "#6E7977", fontWeight: "500" }, chevron: { color: "#005C55", fontSize: 20, fontWeight: "900" }, independent: { alignSelf: "flex-start", paddingVertical: 3 }, independentText: { color: "#005C55", fontSize: 12, fontWeight: "800" }, loading: { alignItems: "center", flexDirection: "row", gap: 8 }, error: { color: "#B42318", fontSize: 12, fontWeight: "700" }, backdrop: { alignItems: "center", backgroundColor: "rgba(24,28,28,.32)", flex: 1, justifyContent: "center", padding: 20 }, modal: { backgroundColor: "#F7FAF8", borderRadius: 12, gap: 12, maxHeight: "78%", maxWidth: 448, padding: 16, width: "100%" }, header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, title: { color: "#181C1C", fontSize: 19, fontWeight: "900" }, close: { color: "#005C55", fontSize: 14, fontWeight: "900" }, search: { backgroundColor: "#FFFFFF", borderColor: "#BDC9C6", borderRadius: 8, borderWidth: 1, minHeight: 48, paddingHorizontal: 13 }, option: { backgroundColor: "#FFFFFF", borderBottomColor: "#E5E9E7", borderBottomWidth: 1, minHeight: 50, justifyContent: "center", paddingHorizontal: 12 }, optionText: { color: "#181C1C", fontSize: 15, fontWeight: "700" }
});
