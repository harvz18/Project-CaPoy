import { StyleSheet, Text, View } from "react-native";
import { LocationMapProps } from "./LocationMap.types";

export type { LocationMapProps, LocationMarker, MapCoordinate } from "./LocationMap.types";

export default function LocationMap({ center, markers = [], radiusMeters, height = 220 }: LocationMapProps) {
  return (
    <View style={[styles.container, { minHeight: height }]}>
      <Text style={styles.title}>Map preview is unavailable on this platform</Text>
      <Text style={styles.copy}>{center ? "The task pin is set." : "Use device location on a supported device."}</Text>
      {radiusMeters ? <Text style={styles.meta}>Service radius: {radiusMeters} m</Text> : null}
      {markers.length > 1 ? <Text style={styles.meta}>{markers.length} task pins</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", backgroundColor: "#E4EFEC", borderRadius: 18, justifyContent: "center", padding: 20 },
  title: { color: "#005C55", fontSize: 15, fontWeight: "800", textAlign: "center" },
  copy: { color: "#3E4947", fontSize: 13, marginTop: 6, textAlign: "center" },
  meta: { color: "#3E4947", fontSize: 12, marginTop: 4 }
});
