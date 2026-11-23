import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text, AppTextInput as TextInput } from "../../src/components/AppText";
import { useApp } from "../../src/context/AppContext";
import { useTasklinkBack } from "../../src/hooks/useTasklinkBack";
import type { ChatMessage } from "../../src/types";

const palette = {
  background: "#F8FAFC",
  surface: "#FFFFFF",
  received: "#F1F5F9",
  primary: "#0D9488",
  primaryDark: "#0F766E",
  primaryLight: "#CCFBF1",
  text: "#0F172A",
  muted: "#475569",
  subtle: "#64748B",
  border: "#E2E8F0",
  error: "#B91C1C"
};

const quickReplies = ["I'm on my way", "I've arrived", "Stuck in traffic"];

export default function ChatScreen() {
  const { id, recipientId } = useLocalSearchParams<{ id: string; recipientId?: string }>();
  const goBack = useTasklinkBack();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const lastMessageIdRef = useRef<string | undefined>(undefined);
  const shouldScrollToEndRef = useRef(true);
  const {
    actionLoading,
    currentUser,
    getTaskMessages,
    getUserById,
    loadOlderChatMessages,
    markMessagesRead,
    sendMessage,
    tasks
  } = useApp();
  const [message, setMessage] = useState("");
  const [sendError, setSendError] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [allMessagesLoaded, setAllMessagesLoaded] = useState(false);
  const task = tasks.find((item) => item.id === id);
  const workerCandidates = [...new Set([task?.workerId, ...(task?.applicantIds ?? [])].filter(Boolean) as string[])];
  const requestedWorkerId = typeof recipientId === "string" && workerCandidates.includes(recipientId)
    ? recipientId
    : undefined;
  const singleApplicantId = workerCandidates.length === 1 ? workerCandidates[0] : undefined;
  const participantId = currentUser?.role === "worker"
    ? task?.clientId
    : requestedWorkerId ?? task?.workerId ?? singleApplicantId;
  const chatUnavailable = !participantId;
  const participant = getUserById(participantId);
  const messages = getTaskMessages(id, participantId);
  const latestMessageId = messages[messages.length - 1]?.id;
  const unreadIds = useMemo(
    () => messages.filter((item) => item.receiverId === currentUser?.id && !item.readAt).map((item) => item.id).join(","),
    [currentUser?.id, messages]
  );
  const sendDisabled = chatUnavailable || actionLoading || !message.trim();

  useEffect(() => {
    if (id && participantId && unreadIds) {
      void markMessagesRead(id, participantId).catch(() => undefined);
    }
  }, [id, markMessagesRead, participantId, unreadIds]);

  useEffect(() => {
    if (!latestMessageId || latestMessageId === lastMessageIdRef.current) return;
    shouldScrollToEndRef.current = true;
    lastMessageIdRef.current = latestMessageId;
  }, [latestMessageId]);

  async function handleSend(text = message) {
    const trimmedText = text.trim();
    if (!trimmedText || actionLoading) return;
    if (!participantId) {
      setSendError("Choose a tasker from the Chat inbox before sending a message.");
      return;
    }
    try {
      await sendMessage(id, trimmedText, participantId);
      setMessage("");
      setSendError("");
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Unable to send this message.");
    }
  }

  async function handleLoadOlder() {
    if (loadingOlder || allMessagesLoaded) return;
    setLoadingOlder(true);
    setSendError("");
    shouldScrollToEndRef.current = false;
    try {
      const count = await loadOlderChatMessages();
      if (count === 0) setAllMessagesLoaded(true);
    } catch (loadError) {
      setSendError(loadError instanceof Error ? loadError.message : "Unable to load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ConversationHeader
        contactName={participant?.fullName ?? "Task participant"}
        onBack={goBack}
        taskTitle={task?.title ?? "Task conversation"}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={styles.keyboardArea}
      >
        <FlatList
          contentContainerStyle={[styles.messageList, !messages.length && styles.messageListEmpty]}
          data={messages}
          keyExtractor={(item) => item.id}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={(
            <MessageEmptyState unavailable={chatUnavailable} />
          )}
          ListHeaderComponent={(
            !allMessagesLoaded && messages.length ? (
              <Pressable
                accessibilityLabel={loadingOlder ? "Loading older messages" : "Load older messages"}
                accessibilityRole="button"
                disabled={loadingOlder}
                onPress={() => void handleLoadOlder()}
                style={styles.loadOlderButton}
              >
                {loadingOlder ? <ActivityIndicator color={palette.primary} size="small" /> : null}
                <Text variant="button" style={styles.loadOlderText}>
                  {loadingOlder ? "Loading" : "Load older messages"}
                </Text>
              </Pressable>
            ) : undefined
          )}
          onContentSizeChange={() => {
            if (!shouldScrollToEndRef.current) return;
            shouldScrollToEndRef.current = false;
            listRef.current?.scrollToEnd({ animated: Boolean(lastMessageIdRef.current) });
          }}
          ref={listRef}
          renderItem={({ item }) => (
            <MessageBubble message={item} mine={item.senderId === currentUser?.id} />
          )}
          showsVerticalScrollIndicator={false}
          style={styles.messageListView}
        />

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {sendError ? <Text accessibilityRole="alert" variant="metadata" style={styles.sendError}>{sendError}</Text> : null}
          {chatUnavailable && !sendError ? (
            <Text accessibilityRole="alert" variant="metadata" style={styles.sendError}>
              Choose a tasker from the Chat inbox before sending a message.
            </Text>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.quickReplyRow}
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            style={styles.quickReplyScroller}
          >
            {quickReplies.map((reply) => (
              <Pressable
                accessibilityRole="button"
                disabled={chatUnavailable || actionLoading}
                key={reply}
                onPress={() => void handleSend(reply)}
                style={({ pressed }) => [
                  styles.quickReply,
                  (chatUnavailable || actionLoading) && styles.disabled,
                  pressed && !chatUnavailable && !actionLoading && styles.pressed
                ]}
              >
                <Text numberOfLines={1} variant="badge" style={styles.quickReplyText}>{reply}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel="Message"
              maxLength={2000}
              multiline
              onChangeText={setMessage}
              placeholder="Type a message"
              placeholderTextColor={palette.subtle}
              style={styles.input}
              textAlignVertical="top"
              value={message}
            />
            <Pressable
              accessibilityLabel={actionLoading ? "Sending message" : "Send message"}
              accessibilityRole="button"
              accessibilityState={{ busy: actionLoading, disabled: sendDisabled }}
              disabled={sendDisabled}
              onPress={() => void handleSend()}
              style={({ pressed }) => [
                styles.sendButton,
                sendDisabled && styles.sendButtonDisabled,
                pressed && !sendDisabled && styles.pressed
              ]}
            >
              {actionLoading
                ? <ActivityIndicator color={palette.surface} size="small" />
                : <Feather accessibilityElementsHidden color={palette.surface} name="send" size={18} />}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ConversationHeader({ contactName, onBack, taskTitle }: {
  contactName: string;
  onBack: () => void;
  taskTitle: string;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Back to messages"
        accessibilityRole="button"
        hitSlop={4}
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Feather accessibilityElementsHidden color={palette.primaryDark} name="arrow-left" size={22} />
      </Pressable>
      <View style={styles.contactAvatar}>
        <Text variant="badge" style={styles.avatarText}>{getInitials(contactName)}</Text>
      </View>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" ellipsizeMode="tail" numberOfLines={1} variant="button" style={styles.contactName}>
          {contactName}
        </Text>
        <Text ellipsizeMode="tail" numberOfLines={1} variant="metadata" style={styles.taskTitle}>
          {taskTitle}
        </Text>
      </View>
    </View>
  );
}

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
      <View style={[styles.messageBubble, mine ? styles.messageMine : styles.messageOther]}>
        <Text variant="body" style={styles.messageText}>{message.message}</Text>
        <Text variant="overline" style={[styles.messageTime, mine && styles.messageTimeMine]}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
      {mine ? <Text variant="overline" style={styles.deliveryState}>{message.readAt ? "Read" : "Sent"}</Text> : null}
    </View>
  );
}

function MessageEmptyState({ unavailable }: { unavailable: boolean }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Feather accessibilityElementsHidden color={palette.primaryDark} name="message-circle" size={22} />
      </View>
      <Text variant="cardTitleStrong" style={styles.emptyTitle}>
        {unavailable ? "Conversation unavailable" : "No messages yet"}
      </Text>
      <Text variant="body" style={styles.emptyText}>
        {unavailable
          ? "Return to Messages and choose an available task conversation."
          : "Send a message when you are ready to coordinate this task."}
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

function formatTime(timestamp: string) {
  const parsed = new Date(timestamp);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  keyboardArea: { flex: 1 },
  header: {
    minHeight: 60,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface
  },
  backButton: { width: 44, height: 48, alignItems: "center", justifyContent: "center" },
  contactAvatar: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primaryLight
  },
  avatarText: { color: palette.primaryDark },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
  contactName: { color: palette.text },
  taskTitle: { color: palette.muted },
  messageListView: { flex: 1 },
  messageList: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  messageListEmpty: { justifyContent: "center" },
  loadOlderButton: {
    minHeight: 44,
    marginBottom: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  loadOlderText: { color: palette.primaryDark },
  messageRow: { maxWidth: "84%", marginBottom: 12 },
  messageRowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  messageRowOther: { alignSelf: "flex-start", alignItems: "flex-start" },
  messageBubble: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  messageMine: { borderBottomRightRadius: 4, backgroundColor: palette.primaryLight },
  messageOther: { borderBottomLeftRadius: 4, backgroundColor: palette.received },
  messageText: { color: palette.text },
  messageTime: { marginTop: 3, color: palette.subtle, textAlign: "right" },
  messageTimeMine: { color: palette.primaryDark },
  deliveryState: { marginTop: 2, color: palette.primaryDark },
  emptyState: { paddingHorizontal: 28, alignItems: "center", gap: 8 },
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
  emptyText: { maxWidth: 300, color: palette.muted, textAlign: "center" },
  composer: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface
  },
  sendError: { paddingHorizontal: 16, paddingBottom: 8, color: palette.error },
  quickReplyScroller: { flexGrow: 0 },
  quickReplyRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  quickReply: {
    minHeight: 36,
    paddingHorizontal: 13,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: 18,
    backgroundColor: palette.surface
  },
  quickReplyText: { color: palette.primaryDark },
  inputRow: { paddingHorizontal: 12, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 112,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 22,
    color: palette.text,
    backgroundColor: palette.background
  },
  sendButton: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primary
  },
  sendButtonDisabled: { backgroundColor: "#94A3B8" },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.48 }
});
