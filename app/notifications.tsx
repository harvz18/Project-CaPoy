import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { AppCard } from "../src/components/AppCard";
import { EmptyState } from "../src/components/EmptyState";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { StatusBadge } from "../src/components/StatusBadge";
import { useApp } from "../src/context/AppContext";
import { AppNotification, NotificationPreferences } from "../src/types";

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    currentUser,
    markEveryNotificationRead,
    markNotificationAsRead,
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
    if (!item.readStatus) await markNotificationAsRead(item.id).catch(() => undefined);
    if (!item.taskId) return;
    if (item.route === "chat" && item.senderId) {
      router.push({ pathname: "/chat/[id]", params: { id: item.taskId, recipientId: item.senderId } });
      return;
    }
    router.push({ pathname: "/task/[id]", params: { id: item.taskId } });
  }

  return (
    <ScreenContainer style={localStyles.screen}>
      <View style={localStyles.headingRow}>
        <View>
          <Text style={localStyles.heading}>Notifications</Text>
          <Text style={localStyles.meta}>{unreadCount} unread</Text>
        </View>
        {unreadCount ? (
          <Pressable accessibilityRole="button" onPress={() => {
            void markEveryNotificationRead().catch(() => setSettingsError("Unable to mark notifications as read."));
          }}>
            <Text style={localStyles.link}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      <AppCard>
        <Text style={localStyles.sectionTitle}>Push settings</Text>
        <PreferenceRow disabled={saving} label="Android push notifications" onValueChange={(value) => void updatePreference({ pushEnabled: value })} value={notificationPreferences.pushEnabled} />
        <PreferenceRow disabled={saving} label="Messages" onValueChange={(value) => void updatePreference({ messagesEnabled: value })} value={notificationPreferences.messagesEnabled} />
        <PreferenceRow disabled={saving} label="Task updates" onValueChange={(value) => void updatePreference({ taskUpdatesEnabled: value })} value={notificationPreferences.taskUpdatesEnabled} />
        <PreferenceRow disabled={saving} label="Matching jobs" onValueChange={(value) => void updatePreference({ matchingEnabled: value })} value={notificationPreferences.matchingEnabled} />
        {settingsError ? <Text style={localStyles.error}>{settingsError}</Text> : null}
      </AppCard>

      <FlatList
        style={localStyles.list}
        data={userNotifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={localStyles.listContent}
        ListEmptyComponent={<EmptyState title="No notifications yet" message="Task and message updates will appear here." />}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => void openNotification(item)}>
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
      <Switch disabled={disabled} onValueChange={onValueChange} value={value} />
    </View>
  );
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

const localStyles = StyleSheet.create({
  screen: { padding: 16 },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  heading: { fontSize: 28, lineHeight: 34, fontWeight: "900", color: "#181C1C" },
  meta: { color: "#596562", marginTop: 2 },
  link: { color: "#005C55", fontWeight: "900" },
  sectionTitle: { color: "#181C1C", fontSize: 17, fontWeight: "900", marginBottom: 6 },
  preferenceRow: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  preferenceLabel: { flex: 1, color: "#181C1C", fontSize: 15 },
  listContent: { gap: 12, paddingBottom: 32 },
  list: { flex: 1 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  type: { flex: 1, color: "#005C55", fontSize: 15, fontWeight: "900" },
  message: { color: "#181C1C", fontSize: 15, lineHeight: 21, marginTop: 8 },
  time: { color: "#6E7977", fontSize: 11, marginTop: 8 },
  error: { color: "#BA1A1A", marginTop: 8, fontWeight: "700" }
});
