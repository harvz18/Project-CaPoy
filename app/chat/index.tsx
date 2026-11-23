import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text, AppTextInput as TextInput } from "../../src/components/AppText";
import { BOTTOM_NAV_MIN_HEIGHT } from "../../src/components/AnimatedBottomNav";
import { NotificationShortcut } from "../../src/components/NotificationShortcut";
import { useApp } from "../../src/context/AppContext";
import { usePullToRefresh } from "../../src/hooks/usePullToRefresh";
import type { ChatMessage, Task } from "../../src/types";

const palette = {
  background: "#F8FAFC",
  surface: "#FFFFFF",
  primary: "#0D9488",
  primaryDark: "#0F766E",
  primaryLight: "#CCFBF1",
  text: "#0F172A",
  muted: "#475569",
  subtle: "#64748B",
  border: "#E2E8F0"
};

type Conversation = {
  id: string;
  task: Task;
  participantId: string;
  participantName: string;
  initials: string;
  preview: string;
  timestamp: string;
  unreadCount: number;
};

export default function ChatInboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, messages, notifications, retryDataSync, tasks, users } = useApp();
  const { onRefresh, refreshing } = usePullToRefresh(retryDataSync);
  const [query, setQuery] = useState("");
  const conversations = useMemo(
    () => buildConversations(tasks, messages, users, currentUser?.id, currentUser?.role),
    [currentUser?.id, currentUser?.role, messages, tasks, users]
  );
  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return conversations
      .filter((conversation) => {
        if (!normalizedQuery) return true;
        const searchable = `${conversation.participantName} ${conversation.task.title} ${conversation.preview}`.toLocaleLowerCase();
        return searchable.includes(normalizedQuery);
      })
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
  }, [conversations, query]);
  const unreadNotificationCount = notifications.filter(
    (notification) => notification.userId === currentUser?.id && !notification.readStatus
  ).length;
  const bottomPadding = BOTTOM_NAV_MIN_HEIGHT + Math.max(insets.bottom, 8) + 28;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Text accessibilityRole="header" variant="screenTitle" style={styles.headerTitle}>Messages</Text>
        <NotificationShortcut
          compact
          onPress={() => router.push("/notifications")}
          unreadCount={unreadNotificationCount}
        />
      </View>

      <FlatList
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
        data={filteredConversations}
        initialNumToRender={12}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(conversation) => conversation.id}
        ListEmptyComponent={(
          <ConversationEmptyState hasConversations={conversations.length > 0} query={query} />
        )}
        ListHeaderComponent={(
          <View style={styles.listHeader}>
            <View style={styles.searchWrap}>
              <Feather accessibilityElementsHidden color={palette.subtle} name="search" size={18} />
              <TextInput
                accessibilityLabel="Search conversations by person or task"
                autoCapitalize="none"
                onChangeText={setQuery}
                placeholder="Search people or tasks"
                placeholderTextColor={palette.subtle}
                returnKeyType="search"
                style={styles.searchInput}
                value={query}
              />
              {query ? (
                <Pressable
                  accessibilityLabel="Clear conversation search"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setQuery("")}
                  style={styles.clearSearchButton}
                >
                  <Feather accessibilityElementsHidden color={palette.subtle} name="x" size={17} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.sectionHeader}>
              <Text variant="sectionTitleSmall" style={styles.sectionTitle}>Inbox</Text>
              <Text variant="metadata" style={styles.sectionMeta}>
                {formatConversationCount(filteredConversations.length)}
              </Text>
            </View>
          </View>
        )}
        refreshControl={(
          <RefreshControl
            colors={[palette.primary]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={palette.primary}
          />
        )}
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            onPress={() => router.push({
              pathname: "/chat/[id]",
              params: { id: item.task.id, recipientId: item.participantId }
            })}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
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
  return tasks.flatMap((task) => {
    const taskMessages = messages
      .filter((message) => message.taskId === task.id)
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
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

      if (!shouldShowConversation(task, role, currentUserId, participantId, userMessages.length > 0)) return [];

      const participantName = users.find((user) => user.id === participantId)?.fullName ?? "Task participant";
      return [{
        id: `${task.id}_${participantId}`,
        task,
        participantId,
        participantName,
        initials: getInitials(participantName),
        preview: latestUserMessage?.message ?? `${task.title} conversation is ready.`,
        timestamp: latestUserMessage?.timestamp ?? task.createdAt,
        unreadCount: userMessages.filter(
          (message) => message.receiverId === currentUserId && !message.readAt
        ).length
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
  if (!currentUserId) return false;
  if (hasUserMessages) return true;
  if (role === "client") return task.clientId === currentUserId && Boolean(participantId);
  return (task.workerId === currentUserId || task.applicantIds?.includes(currentUserId)) && Boolean(participantId);
}

function ConversationRow({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  const accessibilityLabel = [
    conversation.task.title,
    `Conversation with ${conversation.participantName}`,
    conversation.preview,
    conversation.unreadCount ? `${conversation.unreadCount} unread` : undefined
  ].filter(Boolean).join(". ");

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.conversationRow, pressed && styles.pressed]}
    >
      <View style={styles.contactAvatar}>
        <Text variant="badge" style={styles.contactAvatarText}>{conversation.initials}</Text>
      </View>
      <View style={styles.conversationCopy}>
        <View style={styles.titleRow}>
          <Text ellipsizeMode="tail" numberOfLines={1} variant="button" style={styles.taskTitle}>
            {conversation.task.title}
          </Text>
          <Text numberOfLines={1} variant="metadata" style={styles.timeText}>
            {formatInboxTime(conversation.timestamp)}
          </Text>
        </View>
        <Text ellipsizeMode="tail" numberOfLines={1} variant="metadata" style={styles.contactName}>
          {conversation.participantName}
        </Text>
        <View style={styles.previewRow}>
          <Text ellipsizeMode="tail" numberOfLines={1} variant="metadata" style={styles.previewText}>
            {conversation.preview}
          </Text>
          {conversation.unreadCount ? (
            <View accessibilityLabel={`${conversation.unreadCount} unread messages`} style={styles.unreadBadge}>
              <Text variant="overline" style={styles.unreadBadgeText}>
                {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function ConversationEmptyState({ hasConversations, query }: { hasConversations: boolean; query: string }) {
  const isSearchEmpty = hasConversations && Boolean(query.trim());
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Feather accessibilityElementsHidden color={palette.primaryDark} name={isSearchEmpty ? "search" : "message-circle"} size={22} />
      </View>
      <Text variant="cardTitleStrong" style={styles.emptyTitle}>
        {isSearchEmpty ? "No matching conversations" : "No conversations yet"}
      </Text>
      <Text variant="body" style={styles.emptyText}>
        {isSearchEmpty
          ? "Try searching with another task title or contact name."
          : "Your task conversations will appear here after you connect with a client or tasker."}
      </Text>
    </View>
  );
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "TL";
}

function formatConversationCount(count: number) {
  return `${count} ${count === 1 ? "conversation" : "conversations"}`;
}

function formatInboxTime(timestamp: string) {
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime())) return "";
  const today = new Date();
  if (parsed.toDateString() === today.toDateString()) {
    return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return parsed.toLocaleDateString([], { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface
  },
  headerTitle: { color: palette.text },
  list: { flex: 1 },
  listContent: { flexGrow: 1, paddingHorizontal: 16 },
  listHeader: { paddingTop: 12 },
  searchWrap: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.surface
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: palette.text },
  clearSearchButton: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
  sectionHeader: {
    minHeight: 52,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sectionTitle: { color: palette.text },
  sectionMeta: { color: palette.muted, textAlign: "right" },
  separator: { height: 1, marginLeft: 56, backgroundColor: palette.border },
  conversationRow: {
    minHeight: 84,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: palette.background
  },
  contactAvatar: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primaryLight
  },
  contactAvatarText: { color: palette.primaryDark },
  conversationCopy: { flex: 1, minWidth: 0, gap: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  taskTitle: { flex: 1, minWidth: 0, color: palette.text },
  timeText: { flexShrink: 0, color: palette.subtle },
  contactName: { color: palette.muted },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  previewText: { flex: 1, minWidth: 0, color: palette.subtle },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    flexShrink: 0,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primary
  },
  unreadBadgeText: { color: palette.surface },
  emptyState: {
    flex: 1,
    minHeight: 260,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  emptyIcon: {
    width: 44,
    height: 44,
    marginBottom: 4,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primaryLight
  },
  emptyTitle: { color: palette.text, textAlign: "center" },
  emptyText: { maxWidth: 320, color: palette.muted, textAlign: "center" },
  pressed: { opacity: 0.68 }
});
