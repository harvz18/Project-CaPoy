import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNavIcon } from "../../src/components/BottomNavIcon";
import { useApp } from "../../src/context/AppContext";
import { ChatMessage } from "../../src/types";

const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceLow: "#F1F4F3",
  surfaceContainer: "#EBEFED",
  surfaceHigh: "#E0E3E1",
  primary: "#005C55",
  secondaryContainer: "#FEA619",
  text: "#181C1C",
  textStrong: "#111827",
  muted: "#3E4947",
  outline: "#6E7977",
  outlineVariant: "#BDC9C6",
  success: "#10B981",
  white: "#FFFFFF"
};

const quickReplies = ["I'm on my way", "I've arrived", "Stuck in traffic"];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, getTaskMessages, sendMessage, tasks } = useApp();
  const [message, setMessage] = useState("");
  const messages = getTaskMessages(id);
  const task = tasks.find((item) => item.id === id);
  const listData = messages.length ? messages : fallbackMessages(currentUser?.id ?? "worker-1", id);

  async function handleSend(text = message) {
    if (!text.trim()) {
      return;
    }
    await sendMessage(id, text.trim());
    setMessage("");
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
            <Text style={styles.menuText}>‹</Text>
          </Pressable>
          <Text style={styles.brand}>TASKLINK</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable accessibilityRole="button" style={styles.callButton}>
            <Text style={styles.callText}>Call</Text>
          </Pressable>
          <View style={styles.smallAvatar}>
            <Text style={styles.avatarText}>{currentUser?.fullName?.[0] ?? "J"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.contextBar}>
        <View style={styles.contactAvatar}>
          <Text style={styles.avatarText}>{currentUser?.role === "worker" ? "M" : "J"}</Text>
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.contextCopy}>
          <Text style={styles.contactName}>{currentUser?.role === "worker" ? "Maria Santos" : "Juan Dela Cruz"}</Text>
          <Text style={styles.contactMeta}>Active now • {task?.title ?? "Task conversation"}</Text>
        </View>
        <Pressable accessibilityRole="button" style={styles.locationButton}>
          <Text style={styles.locationButtonText}>Pin</Text>
        </Pressable>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messageList, { paddingBottom: 174 + insets.bottom }]}
        ListHeaderComponent={<Text style={styles.datePill}>Today</Text>}
        renderItem={({ item }) => (
          <MessageBubble message={item} mine={item.senderId === currentUser?.id} />
        )}
      />

      <View style={[styles.composerWrap, { bottom: 72 + insets.bottom, paddingBottom: 12 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickReplyRow}>
          {quickReplies.map((reply) => (
            <Pressable key={reply} onPress={() => handleSend(reply)} style={styles.quickReply}>
              <Text style={styles.quickReplyText}>{reply}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <Pressable style={styles.addButton}>
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
          <TextInput
            onChangeText={setMessage}
            placeholder="Type a message..."
            placeholderTextColor={palette.outline}
            style={styles.input}
            value={message}
          />
          <Pressable onPress={() => handleSend()} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
            <Text style={styles.sendButtonText}>Send</Text>
          </Pressable>
        </View>
      </View>
      <BottomNav active="chat" router={router} bottom={insets.bottom} role={currentUser?.role} />
    </SafeAreaView>
  );
}

function fallbackMessages(currentUserId: string, taskId: string): ChatMessage[] {
  return [
    {
      id: "fallback-1",
      taskId,
      senderId: "client-1",
      receiverId: currentUserId,
      message: "Good morning! Are you still coming over for the task today at 2 PM?",
      timestamp: new Date().toISOString()
    },
    {
      id: "fallback-2",
      taskId,
      senderId: currentUserId,
      receiverId: "client-1",
      message: "Yes! I'm just finishing up my current task. I'll be there on time.",
      timestamp: new Date().toISOString()
    }
  ];
}

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
      <View style={[styles.messageBubble, mine ? styles.messageMine : styles.messageOther]}>
        <Text style={[styles.messageText, mine && styles.messageMineText]}>{message.message}</Text>
        <Text style={[styles.messageTime, mine && styles.messageMineText]}>{formatTime(message.timestamp)}</Text>
      </View>
      {mine ? <Text style={styles.doneMark}>OK</Text> : null}
    </View>
  );
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function BottomNav({
  active,
  router,
  bottom,
  role
}: {
  active: string;
  router: ReturnType<typeof useRouter>;
  bottom: number;
  role?: string;
}) {
  const homeRoute = role === "client" ? "/client-dashboard" : "/worker-dashboard";
  const items = [
    { key: "home", label: "Home", route: homeRoute },
    { key: "jobs", label: "Jobs", route: "/jobs" },
    { key: "chat", label: "Chat", route: "/chat" },
    { key: "profile", label: "Profile", route: "/profile" }
  ] as const;

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(bottom, 10) }]}>
      {items.map((item) => {
        const selected = item.key === active;
        const color = selected ? "#684000" : palette.muted;
        return (
          <Pressable key={item.key} onPress={() => router.push(item.route as never)} style={[styles.navItem, selected && styles.navItemActive]}>
            <BottomNavIcon name={item.key} color={color} />
            <Text style={[styles.navLabel, selected && styles.navTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1EF"
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  menuText: { color: palette.primary, fontSize: 32, lineHeight: 36 },
  brand: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  callButton: { paddingHorizontal: 10, minHeight: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  callText: { color: palette.muted, fontWeight: "800" },
  smallAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.secondaryContainer, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.outlineVariant },
  avatarText: { color: "#684000", fontWeight: "900" },
  contextBar: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(189,201,198,0.35)", backgroundColor: palette.surfaceLow, flexDirection: "row", alignItems: "center", gap: 12 },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surfaceHigh, alignItems: "center", justifyContent: "center" },
  onlineDot: { position: "absolute", right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: palette.success, borderWidth: 2, borderColor: palette.surfaceLow },
  contextCopy: { flex: 1 },
  contactName: { color: palette.textStrong, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  contactMeta: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  locationButton: { minHeight: 38, borderRadius: 8, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceHigh },
  locationButtonText: { color: palette.primary, fontWeight: "900" },
  messageList: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  datePill: { alignSelf: "center", overflow: "hidden", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12, backgroundColor: palette.surfaceContainer, color: palette.muted, fontSize: 12, lineHeight: 16 },
  messageRow: { marginBottom: 12, flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "86%" },
  messageRowMine: { alignSelf: "flex-end" },
  messageRowOther: { alignSelf: "flex-start" },
  messageBubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  messageMine: { backgroundColor: palette.primary, borderBottomRightRadius: 4 },
  messageOther: { backgroundColor: palette.surfaceHigh, borderBottomLeftRadius: 4 },
  messageText: { color: palette.text, fontSize: 16, lineHeight: 24 },
  messageMineText: { color: palette.white },
  messageTime: { color: palette.muted, fontSize: 10, lineHeight: 14, marginTop: 4, textAlign: "right" },
  doneMark: { color: palette.primary, fontSize: 10, fontWeight: "900" },
  composerWrap: { position: "absolute", left: 0, right: 0, bottom: 72, backgroundColor: palette.background, paddingTop: 8 },
  quickReplyRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  quickReply: { borderRadius: 999, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.surface, paddingHorizontal: 14, paddingVertical: 8 },
  quickReplyText: { color: palette.primary, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  inputRow: { padding: 12, borderTopWidth: 1, borderTopColor: palette.outlineVariant, backgroundColor: palette.surface, flexDirection: "row", alignItems: "center", gap: 10 },
  addButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  addButtonText: { color: palette.muted, fontSize: 24, fontWeight: "700" },
  input: { flex: 1, minHeight: 44, borderRadius: 22, backgroundColor: palette.surfaceLow, color: palette.text, paddingHorizontal: 16, fontSize: 16 },
  sendButton: { width: 52, height: 44, borderRadius: 22, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  sendButtonText: { color: palette.white, fontSize: 12, fontWeight: "900" },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 72, paddingHorizontal: 8, paddingTop: 8, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderTopWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, flexDirection: "row", justifyContent: "space-around", elevation: 10 },
  navItem: { minWidth: 66, borderRadius: 24, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  navItemActive: { backgroundColor: palette.secondaryContainer },
  navLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  navTextActive: { color: "#684000" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
