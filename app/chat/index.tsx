import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { MotionPressable as Pressable } from "../../src/components/MotionPressable";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedBottomNav } from "../../src/components/AnimatedBottomNav";
import { useApp } from "../../src/context/AppContext";
import { screenPalette } from "../../src/theme";
import { ChatMessage, Task } from "../../src/types";
import { typography } from "../../src/typography";
import { AppText as Text, AppTextInput as TextInput } from "../../src/components/AppText";

const palette = screenPalette;

type Conversation = {
  id: string;
  task: Task;
  participantId: string;
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
            accessibilityLabel="Search conversations"
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
          {filteredConversations.length ? filteredConversations.map((conversation) => (
            <ConversationRow
              conversation={conversation}
              key={conversation.id}
              onPress={() => router.push({
                pathname: "/chat/[id]",
                params: { id: conversation.task.id, recipientId: conversation.participantId }
              })}
            />
          )) : (
            <View style={styles.emptyConversation}>
              <Text style={styles.previewText}>{query.trim() ? "No conversations match your search." : "Task conversations will appear here."}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <AnimatedBottomNav active="chat" role={currentUser?.role} />
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

  return visibleTasks.flatMap((task) => {
    const taskMessages = messages
      .filter((message) => message.taskId === task.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const messageParticipants = taskMessages.flatMap((message) =>
      message.senderId === currentUserId ? [message.receiverId]
        : message.receiverId === currentUserId ? [message.senderId]
          : []
    );
    const participantIds = role === "client"
      ? [...new Set([task.workerId, ...(task.applicantIds ?? []), ...messageParticipants].filter(Boolean) as string[])]
      : task.clientId ? [task.clientId] : [];

    return participantIds.flatMap((participantId) => {
      const userMessages = taskMessages.filter((message) =>
        (message.senderId === currentUserId && message.receiverId === participantId)
        || (message.receiverId === currentUserId && message.senderId === participantId)
      );
      const latestUserMessage = userMessages[0];

      if (!shouldShowConversation(task, role, currentUserId, participantId, userMessages.length > 0)) {
        return [];
      }

      const participantName = users.find((user) => user.id === participantId)?.fullName
        ?? "Task participant";

      return [{
        id: `${task.id}_${participantId}`,
        task,
        participantId,
        participantName,
        initials: getInitials(participantName),
        preview: latestUserMessage?.message ?? `${task.title} conversation is ready.`,
        timestamp: latestUserMessage?.timestamp ?? task.createdAt,
        unread: userMessages.some((message) => message.receiverId === currentUserId && !message.readAt)
      }];
    });
  });
}

function shouldShowConversation(
  task: Task,
  role?: string,
  currentUserId?: string,
  participantId?: string,
  hasUserMessages?: boolean
) {
  if (!currentUserId) {
    return false;
  }

  if (hasUserMessages) {
    return true;
  }

  if (role === "client") {
    return task.clientId === currentUserId && Boolean(participantId);
  }

  return (task.workerId === currentUserId || task.applicantIds?.includes(currentUserId)) && Boolean(participantId);
}

function ConversationRow({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.conversationRow, pressed && styles.pressed]}>
      <View style={styles.contactAvatar}>
        <Text style={styles.contactAvatarText}>{conversation.initials}</Text>
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
    borderBottomColor: "rgba(207, 249, 255, 0.20)"
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  menuText: { ...typography.bodyMedium, color: palette.primary },
  brand: { ...typography.screenTitle, color: palette.primary },
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
  avatarText: { ...typography.bodyMedium, color: "#F4C95D" },
  content: { padding: 16, gap: 14 },
  heroPanel: { borderRadius: 12, padding: 20, backgroundColor: palette.primary, gap: 6 },
  heroKicker: { ...typography.overline, color: palette.primaryFixed },
  heroTitle: { ...typography.screenTitle, color: palette.white },
  heroText: { ...typography.body, color: palette.primaryFixed },
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
  searchIcon: { ...typography.badge, color: palette.primary },
  searchInput: { ...typography.inputText, flex: 1, color: palette.text },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { ...typography.sectionTitle, color: palette.textStrong },
  sectionMeta: { ...typography.metadata, color: palette.muted },
  conversationList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(207,249,255,0.28)",
    backgroundColor: palette.surface,
    overflow: "hidden"
  },
  emptyConversation: { minHeight: 100, padding: 20, alignItems: "center", justifyContent: "center" },
  conversationRow: {
    minHeight: 86,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(207,249,255,0.28)",
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
  contactAvatarText: { ...typography.cardTitleStrong, color: palette.primary },
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
  rowBetween: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  contactName: { ...typography.cardTitleStrong, color: palette.textStrong, flex: 1 },
  timeText: { ...typography.metadata, color: palette.outline, marginTop: 1 },
  taskTitle: { ...typography.cardTitleStrong, color: palette.primary },
  previewText: { ...typography.body, color: palette.muted },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.secondaryContainer },
  pressed: { opacity: 0.78 }
});
