import { StyleSheet, View } from "react-native";
import { LocationMapProps } from "./LocationMap.types";
import { typography } from "../typography";
import { AppText as Text } from "./AppText";

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
  container: { alignItems: "center", backgroundColor: "rgba(86, 159, 178, 0.16)", borderRadius: 18, justifyContent: "center", padding: 20 },
  title: { ...typography.bodyMedium, color: "#00C9B3", textAlign: "center" },
  copy: { ...typography.body, color: "#BBD5DE", marginTop: 6, textAlign: "center" },
  meta: { ...typography.metadata, color: "#BBD5DE", marginTop: 4 }
});
