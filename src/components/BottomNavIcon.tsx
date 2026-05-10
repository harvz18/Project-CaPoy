import { StyleSheet, View } from "react-native";

type BottomNavIconName = "home" | "jobs" | "chat" | "profile";

type BottomNavIconProps = {
  name: BottomNavIconName;
  color: string;
};

export function BottomNavIcon({ name, color }: BottomNavIconProps) {
  if (name === "home") {
    return (
      <View style={iconStyles.box}>
        <View style={[iconStyles.homeRoof, { borderBottomColor: color }]} />
        <View style={[iconStyles.homeBase, { borderColor: color }]} />
      </View>
    );
  }

  if (name === "jobs") {
    return (
      <View style={iconStyles.box}>
        <View style={[iconStyles.briefcaseHandle, { borderColor: color }]} />
        <View style={[iconStyles.briefcaseBody, { borderColor: color }]}>
          <View style={[iconStyles.briefcaseLatch, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }

  if (name === "chat") {
    return (
      <View style={iconStyles.box}>
        <View style={[iconStyles.chatBubble, { borderColor: color }]}>
          <View style={[iconStyles.chatTail, { borderTopColor: color }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={iconStyles.box}>
      <View style={[iconStyles.profileHead, { borderColor: color }]} />
      <View style={[iconStyles.profileBody, { borderColor: color }]} />
    </View>
  );
}

const iconStyles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  homeRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginBottom: -1
  },
  homeBase: {
    width: 15,
    height: 11,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3
  },
  briefcaseHandle: {
    width: 10,
    height: 5,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    marginBottom: -1
  },
  briefcaseBody: {
    width: 20,
    height: 14,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  briefcaseLatch: {
    width: 5,
    height: 2,
    borderRadius: 1
  },
  chatBubble: {
    width: 20,
    height: 15,
    borderWidth: 2,
    borderRadius: 6
  },
  chatTail: {
    position: "absolute",
    left: 4,
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 1,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent"
  },
  profileHead: {
    width: 9,
    height: 9,
    borderWidth: 2,
    borderRadius: 5,
    marginBottom: 2
  },
  profileBody: {
    width: 18,
    height: 9,
    borderWidth: 2,
    borderRadius: 9,
    borderBottomWidth: 0
  }
});
