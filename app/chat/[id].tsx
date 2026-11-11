import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { MotionPressable as Pressable } from "../../src/components/MotionPressable";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedBottomNav } from "../../src/components/AnimatedBottomNav";
import { useApp } from "../../src/context/AppContext";
import { useTasklinkBack } from "../../src/hooks/useTasklinkBack";
import { screenPalette } from "../../src/theme";
import { ChatMessage } from "../../src/types";
import { typography } from "../../src/typography";
import { AppText as Text, AppTextInput as TextInput } from "../../src/components/AppText";

const palette = screenPalette;

const quickReplies = ["I'm on my way", "I've arrived", "Stuck in traffic"];

export default function ChatScreen() {
  const { id, recipientId } = useLocalSearchParams<{ id: string; recipientId?: string }>();
  const router = useRouter();
  const goBack = useTasklinkBack();
  const insets = useSafeAreaInsets();
  const { currentUser, getTaskMessages, getUserById, loadOlderChatMessages, markMessagesRead, sendMessage, tasks } = useApp();
  const [message, setMessage] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
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
  const unreadIds = useMemo(
    () => messages.filter((item) => item.receiverId === currentUser?.id && !item.readAt).map((item) => item.id).join(","),
    [currentUser?.id, messages]
  );

  useEffect(() => {
    if (id && participantId && unreadIds) {
      void markMessagesRead(id, participantId).catch(() => undefined);
    }
  }, [id, participantId, unreadIds]);

  async function handleSend(text = message) {
    if (!text.trim()) {
      return;
    }
    if (!participantId) {
      setSendError("Choose a tasker from the Chat inbox before sending a message.");
      return;
    }
    if (sending) return;
    setSending(true);
    try {
      await sendMessage(id, text.trim(), participantId);
      setMessage("");
      setSendError("");
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Unable to send this message.");
    } finally {
      setSending(false);
    }
  }

  async function handleLoadOlder() {
    setLoadingOlder(true);
    setSendError("");
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
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.iconButton}>
            <Feather accessibilityElementsHidden color={palette.primary} name="arrow-left" size={22} />
          </Pressable>
          <Text style={styles.brand}>TASKLINK</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.smallAvatar}>
            <Text style={styles.avatarText}>{currentUser?.fullName?.[0] ?? "U"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.contextBar}>
        <View style={styles.contactAvatar}>
          <Text style={styles.avatarText}>{participant?.fullName?.[0] ?? "U"}</Text>
        </View>
        <View style={styles.contextCopy}>
          <Text style={styles.contactName}>{participant?.fullName ?? "Task Chat"}</Text>
          <Text style={styles.contactMeta}>{task?.title ?? "Task conversation"}</Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messageList, { paddingBottom: 174 + insets.bottom }]}
        ListHeaderComponent={(
          <View>
            {!allMessagesLoaded && messages.length ? (
              <Pressable accessibilityRole="button" disabled={loadingOlder} onPress={() => void handleLoadOlder()}>
                <Text accessibilityLiveRegion="polite" style={styles.loadOlder}>{loadingOlder ? "Loading..." : "Load older messages"}</Text>
              </Pressable>
            ) : null}
            <Text style={styles.datePill}>Conversation</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <MessageBubble message={item} mine={item.senderId === currentUser?.id} />
        )}
      />

      <View style={[styles.composerWrap, { bottom: 72 + insets.bottom, paddingBottom: 12 }]}>
        {sendError ? <Text accessibilityLiveRegion="assertive" style={styles.sendError}>{sendError}</Text> : null}
        {chatUnavailable ? <Text accessibilityLiveRegion="polite" style={styles.sendError}>Choose a tasker from the Chat inbox before sending a message.</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickReplyRow}>
          {quickReplies.map((reply) => (
            <Pressable accessibilityLabel={`Send quick reply: ${reply}`} accessibilityRole="button" accessibilityState={{ busy: sending, disabled: chatUnavailable || sending }} disabled={chatUnavailable || sending} key={reply} onPress={() => handleSend(reply)} style={[styles.quickReply, (chatUnavailable || sending) && styles.disabled]}>
              <Text style={styles.quickReplyText}>{reply}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Message"
            accessibilityHint="Enter a message to the task participant."
            editable={!sending && !chatUnavailable}
            onChangeText={setMessage}
            placeholder="Type a message..."
            placeholderTextColor={palette.outline}
            style={styles.input}
            value={message}
          />
          <Pressable accessibilityLabel="Send message" accessibilityRole="button" accessibilityState={{ busy: sending, disabled: chatUnavailable || sending || !message.trim() }} disabled={chatUnavailable || sending || !message.trim()} onPress={() => handleSend()} style={({ pressed }) => [styles.sendButton, (chatUnavailable || sending || !message.trim()) && styles.sendButtonDisabled, pressed && !chatUnavailable && !sending && styles.pressed]}>
            <Text style={styles.sendButtonText}>{sending ? "Sending..." : "Send"}</Text>
          </Pressable>
        </View>
      </View>
      <AnimatedBottomNav active="chat" role={currentUser?.role} />
    </SafeAreaView>
  );
}

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
      <View style={[styles.messageBubble, mine ? styles.messageMine : styles.messageOther]}>
        <Text style={[styles.messageText, mine && styles.messageMineText]}>{message.message}</Text>
        <Text style={[styles.messageTime, mine && styles.messageMineText]}>{formatTime(message.timestamp)}</Text>
      </View>
      {mine ? <Text style={styles.doneMark}>{message.readAt ? "Read" : "Sent"}</Text> : null}
    </View>
  );
}

function formatTime(timestamp: string) {
  const parsed = new Date(timestamp);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Time unavailable";
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { minWidth: 48, minHeight: 44, alignItems: "center", justifyContent: "center" },
  menuText: { ...typography.bodyMedium, color: palette.primary },
  brand: { ...typography.screenTitle, color: palette.primary },
  callButton: { paddingHorizontal: 10, minHeight: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  callText: { ...typography.bodyMedium, color: palette.muted },
  smallAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.secondaryContainer, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.outlineVariant },
  avatarText: { ...typography.bodyMedium, color: "#F4C95D" },
  contextBar: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(207,249,255,0.28)", backgroundColor: palette.surfaceLow, flexDirection: "row", alignItems: "center", gap: 12 },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surfaceHigh, alignItems: "center", justifyContent: "center" },
  onlineDot: { position: "absolute", right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: palette.success, borderWidth: 2, borderColor: palette.surfaceLow },
  contextCopy: { flex: 1 },
  contactName: { ...typography.cardTitleStrong, color: palette.textStrong },
  contactMeta: { ...typography.metadata, color: palette.muted },
  locationButton: { minHeight: 38, borderRadius: 8, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceHigh },
  locationButtonText: { ...typography.button, color: palette.primary },
  messageList: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  datePill: { ...typography.badge, alignSelf: "center", overflow: "hidden", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12, backgroundColor: palette.surfaceContainer, color: palette.muted },
  loadOlder: { ...typography.badge, alignSelf: "center", color: palette.primary, marginBottom: 10 },
  messageRow: { marginBottom: 12, flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "86%" },
  messageRowMine: { alignSelf: "flex-end" },
  messageRowOther: { alignSelf: "flex-start" },
  messageBubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, shadowColor: "#001722", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  messageMine: { backgroundColor: palette.primary, borderBottomRightRadius: 4 },
  messageOther: { backgroundColor: palette.surfaceHigh, borderBottomLeftRadius: 4 },
  messageText: { ...typography.body, color: palette.text },
  messageMineText: { color: palette.white },
  messageTime: { ...typography.metadata, color: palette.muted, marginTop: 4, textAlign: "right" },
  doneMark: { ...typography.overline, color: palette.primary },
  composerWrap: { position: "absolute", left: 0, right: 0, bottom: 72, backgroundColor: palette.background, paddingTop: 8 },
  quickReplyRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  quickReply: { borderRadius: 999, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.surface, paddingHorizontal: 14, paddingVertical: 8 },
  quickReplyText: { ...typography.bodyMedium, color: palette.primary },
  inputRow: { padding: 12, borderTopWidth: 1, borderTopColor: palette.outlineVariant, backgroundColor: palette.surface, flexDirection: "row", alignItems: "center", gap: 10 },
  addButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  addButtonText: { ...typography.button, color: palette.muted },
  input: { ...typography.inputText, flex: 1, minHeight: 44, borderRadius: 22, backgroundColor: palette.surfaceLow, color: palette.text, paddingHorizontal: 16 },
  sendButton: { width: 52, height: 44, borderRadius: 22, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { backgroundColor: palette.outline },
  sendButtonText: { ...typography.button, color: palette.white },
  sendError: { ...typography.metadata, color: "#FF7D8C", paddingHorizontal: 16, paddingBottom: 8 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 }
});
