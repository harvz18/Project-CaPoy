import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNavIcon } from "../../src/components/BottomNavIcon";
import { useApp } from "../../src/context/AppContext";
import { ChatMessage, Task } from "../../src/types";

const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceLow: "#F1F4F3",
  surfaceContainer: "#EBEFED",
  surfaceHigh: "#E0E3E1",
  primary: "#005C55",
  primaryFixed: "#9CF2E8",
  secondaryContainer: "#FEA619",
  text: "#181C1C",
  textStrong: "#111827",
  muted: "#3E4947",
  outline: "#6E7977",
  outlineVariant: "#BDC9C6",
  success: "#10B981",
  white: "#FFFFFF"
};

type Conversation = {
  task: Task;
  participantName: string;
  initials: string;
  preview: string;
  timestamp: string;
  unread: boolean;
};

export default function ChatInboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, tasks, messages, users } = useApp();
  const [query, setQuery] = useState("");
  const conversations = useMemo(
    () => buildConversations(tasks, messages, users, currentUser?.id, currentUser?.role),
    [currentUser?.id, currentUser?.role, messages, tasks, users]
  );
  const filteredConversations = conversations
    .filter((conversation) => {
    const searchable = `${conversation.participantName} ${conversation.task.title}`.toLowerCase();
    return searchable.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>TASKLINK</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{currentUser?.fullName?.[0] ?? "U"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 104 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroPanel}>
          <Text style={styles.heroKicker}>Messages</Text>
          <Text style={styles.heroTitle}>Choose a conversation.</Text>
          <Text style={styles.heroText}>Open a task chat with a client or worker before sending updates.</Text>
        </View>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>Search</Text>
          <TextInput
            onChangeText={setQuery}
            placeholder="Search people or tasks"
            placeholderTextColor={palette.outline}
            style={styles.searchInput}
            value={query}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inbox</Text>
          <Text style={styles.sectionMeta}>{filteredConversations.length} chats</Text>
        </View>

        <View style={styles.conversationList}>
          {filteredConversations.map((conversation) => (
            <ConversationRow
              conversation={conversation}
              key={conversation.task.id}
              onPress={() => router.push(`/chat/${conversation.task.id}`)}
            />
          ))}
        </View>
      </ScrollView>

      <BottomNav active="chat" router={router} bottom={insets.bottom} role={currentUser?.role} />
    </SafeAreaView>
  );
}

function buildConversations(
  tasks: Task[],
  messages: ChatMessage[],
  users: { id: string; fullName: string }[],
  currentUserId?: string,
  role?: string
): Conversation[] {
  const visibleTasks = tasks.length ? tasks : [];

  return visibleTasks.map((task, index) => {
    const taskMessages = messages
      .filter((message) => message.taskId === task.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const latest = taskMessages[0];
    const participantId = role === "client" ? task.workerId : task.clientId;
    const participantName = users.find((user) => user.id === participantId)?.fullName ?? getFallbackName(role, index);

    return {
      task,
      participantName,
      initials: getInitials(participantName),
      preview: latest?.message ?? `${task.title} conversation is ready.`,
      timestamp: latest?.timestamp ?? task.createdAt,
      unread: Boolean(latest && latest.receiverId === currentUserId)
    };
  });
}

function ConversationRow({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.conversationRow, pressed && styles.pressed]}>
      <View style={styles.contactAvatar}>
        <Text style={styles.contactAvatarText}>{conversation.initials}</Text>
        <View style={styles.onlineDot} />
      </View>
      <View style={styles.conversationCopy}>
        <View style={styles.rowBetween}>
          <Text style={styles.contactName}>{conversation.participantName}</Text>
          <Text style={styles.timeText}>{formatInboxTime(conversation.timestamp)}</Text>
        </View>
        <Text style={styles.taskTitle} numberOfLines={1}>{conversation.task.title}</Text>
        <Text style={styles.previewText} numberOfLines={1}>{conversation.preview}</Text>
      </View>
      {conversation.unread ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
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

function getFallbackName(role?: string, index = 0) {
  const workerNames = ["Worker Applicant", "Local Worker", "Task Helper"];

  return role === "client" ? workerNames[index % workerNames.length] : "Client";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatInboxTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  menuText: { color: palette.primary, fontSize: 24, fontWeight: "800" },
  brand: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.secondaryContainer,
    borderWidth: 1,
    borderColor: palette.outlineVariant
  },
  avatarText: { color: "#684000", fontWeight: "900" },
  content: { padding: 16, gap: 14 },
  heroPanel: { borderRadius: 12, padding: 20, backgroundColor: palette.primary, gap: 6 },
  heroKicker: { color: palette.primaryFixed, fontSize: 12, lineHeight: 16, fontWeight: "900", textTransform: "uppercase" },
  heroTitle: { color: palette.white, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  heroText: { color: "#DDF8F4", fontSize: 14, lineHeight: 20 },
  searchWrap: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10
  },
  searchIcon: { color: palette.primary, fontSize: 12, fontWeight: "900" },
  searchInput: { flex: 1, color: palette.text, fontSize: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  sectionMeta: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  conversationList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(189,201,198,0.35)",
    backgroundColor: palette.surface,
    overflow: "hidden"
  },
  conversationRow: {
    minHeight: 86,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(189,201,198,0.35)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  contactAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceHigh
  },
  contactAvatarText: { color: palette.primary, fontSize: 16, fontWeight: "900" },
  onlineDot: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: palette.surface,
    backgroundColor: palette.success
  },
  conversationCopy: { flex: 1, gap: 2 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  contactName: { color: palette.textStrong, fontSize: 16, lineHeight: 22, fontWeight: "900", flex: 1 },
  timeText: { color: palette.outline, fontSize: 11, lineHeight: 14, fontWeight: "700", marginTop: 1 },
  taskTitle: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  previewText: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.secondaryContainer },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 72,
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surface,
    flexDirection: "row",
    justifyContent: "space-around",
    elevation: 10
  },
  navItem: { minWidth: 66, borderRadius: 24, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  navItemActive: { backgroundColor: palette.secondaryContainer },
  navLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  navTextActive: { color: "#684000" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
