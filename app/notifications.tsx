import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, Switch, View } from "react-native";
import { MotionPressable as Pressable } from "../src/components/MotionPressable";
import { AppCard } from "../src/components/AppCard";
import { EmptyState } from "../src/components/EmptyState";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { StatusBadge } from "../src/components/StatusBadge";
import { FREE_WEB_DEMO } from "../src/config/release";
import { useApp } from "../src/context/AppContext";
import { useTasklinkBack } from "../src/hooks/useTasklinkBack";
import { AppNotification, NotificationPreferences } from "../src/types";
import { typography } from "../src/typography";
import { AppText as Text } from "../src/components/AppText";


export default function NotificationsScreen() {
  const router = useRouter();
  const goBack = useTasklinkBack();
  const {
    currentUser,
    markEveryNotificationRead,
    markNotificationAsRead,
    markNotificationAsOpened,
    notificationPreferences,
    notifications,
    updateNotificationPreferences
  } = useApp();
  const [settingsError, setSettingsError] = useState("");
  const [saving, setSaving] = useState(false);
  const userNotifications = notifications.filter((item) => item.userId === currentUser?.id);
  const unreadCount = userNotifications.filter((item) => !item.readStatus).length;

  async function updatePreference(updates: Partial<NotificationPreferences>) {
    setSaving(true);
    setSettingsError("");
    try {
      await updateNotificationPreferences(updates);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Unable to update notification settings.");
    } finally {
      setSaving(false);
    }
  }

  async function openNotification(item: AppNotification) {
    await markNotificationAsOpened(item.id).catch(async () => {
      if (!item.readStatus) await markNotificationAsRead(item.id).catch(() => undefined);
    });
    if (!item.taskId) return;
    if (item.route === "chat" && item.senderId) {
      router.push({ pathname: "/chat/[id]", params: { id: item.taskId, recipientId: item.senderId } });
      return;
    }
    router.push({ pathname: "/task/[id]", params: { id: item.taskId } });
  }

  return (
    <ScreenContainer style={localStyles.screen}>
      <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={goBack} style={({ pressed }) => [localStyles.backButton, pressed && localStyles.pressed]}>
        <Feather accessibilityElementsHidden color="#00C9B3" name="arrow-left" size={22} />
      </Pressable>
      <View style={localStyles.headingRow}>
        <View>
          <Text style={localStyles.heading}>Notifications</Text>
          <Text style={localStyles.meta}>{unreadCount} unread</Text>
        </View>
        {unreadCount ? (
          <Pressable accessibilityLabel="Mark all notifications as read" accessibilityRole="button" onPress={() => {
            void markEveryNotificationRead().catch(() => setSettingsError("Unable to mark notifications as read."));
          }}>
            <Text style={localStyles.link}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      <AppCard>
        <Text style={localStyles.sectionTitle}>{FREE_WEB_DEMO ? "In-app notifications" : "Push settings"}</Text>
        {FREE_WEB_DEMO ? (
          <Text style={localStyles.message}>Task applications, hiring, status, payment, completion, review, and chat updates appear here. Remote Android push is paused in the free web demo.</Text>
        ) : (
          <>
            <PreferenceRow disabled={saving} label="Android push notifications" onValueChange={(value) => void updatePreference({ pushEnabled: value })} value={notificationPreferences.pushEnabled} />
            <PreferenceRow disabled={saving} label="Messages" onValueChange={(value) => void updatePreference({ messagesEnabled: value })} value={notificationPreferences.messagesEnabled} />
            <PreferenceRow disabled={saving} label="Task updates" onValueChange={(value) => void updatePreference({ taskUpdatesEnabled: value })} value={notificationPreferences.taskUpdatesEnabled} />
            <PreferenceRow disabled={saving} label="Matching jobs" onValueChange={(value) => void updatePreference({ matchingEnabled: value })} value={notificationPreferences.matchingEnabled} />
          </>
        )}
        {saving ? <Text accessibilityLiveRegion="polite" style={localStyles.meta}>Saving notification preferences...</Text> : null}
        {settingsError ? <Text accessibilityLiveRegion="assertive" style={localStyles.error}>{settingsError}</Text> : null}
      </AppCard>

      <FlatList
        style={localStyles.list}
        data={userNotifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={localStyles.listContent}
        ListEmptyComponent={<EmptyState title="No notifications yet" message="Task and message updates will appear here." />}
        renderItem={({ item }) => (
          <Pressable accessibilityLabel={`${item.readStatus ? "Read" : "Unread"} ${item.notificationType}: ${item.message}`} accessibilityRole="button" onPress={() => void openNotification(item)}>
            <AppCard>
              <View style={localStyles.rowBetween}>
                <Text style={localStyles.type}>{item.notificationType}</Text>
                <StatusBadge status={item.readStatus ? "Read" : "Unread"} />
              </View>
              <Text style={localStyles.message}>{item.message}</Text>
              <Text style={localStyles.time}>{formatTimestamp(item.createdAt)}</Text>
            </AppCard>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

function PreferenceRow({ disabled, label, onValueChange, value }: {
  disabled: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={localStyles.preferenceRow}>
      <Text style={localStyles.preferenceLabel}>{label}</Text>
      <Switch accessibilityLabel={label} accessibilityRole="switch" accessibilityState={{ checked: value, disabled }} disabled={disabled} onValueChange={onValueChange} value={value} />
    </View>
  );
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

const localStyles = StyleSheet.create({
  screen: { padding: 16 },
  backButton: { alignSelf: "flex-start", minHeight: 42, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, marginLeft: -8, marginBottom: 4, borderRadius: 8 },
  backArrow: { ...typography.heroNumber, color: "#00C9B3" },
  backText: { ...typography.button, color: "#00C9B3" },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  heading: { ...typography.sectionTitle, color: "#F5FCFF" },
  meta: { color: "#BBD5DE", marginTop: 2 },
  link: { ...typography.button, color: "#00C9B3" },
  sectionTitle: { ...typography.sectionTitleSmall, color: "#F5FCFF", marginBottom: 6 },
  preferenceRow: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  preferenceLabel: { ...typography.fieldLabel, flex: 1, color: "#F5FCFF" },
  listContent: { gap: 12, paddingBottom: 32 },
  list: { flex: 1 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  type: { ...typography.bodyMedium, flex: 1, color: "#00C9B3" },
  message: { ...typography.body, color: "#F5FCFF", marginTop: 8 },
  time: { ...typography.metadata, color: "#92B2C0", marginTop: 8 },
  error: { ...typography.metadata, color: "#FF7D8C", marginTop: 8 },
  pressed: { opacity: 0.72 }
});
