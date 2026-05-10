import { FlatList, Text } from "react-native";
import { AppCard } from "../src/components/AppCard";
import { EmptyState } from "../src/components/EmptyState";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { StatusBadge } from "../src/components/StatusBadge";
import { useApp } from "../src/context/AppContext";
import { styles } from "../src/styles";

export default function NotificationsScreen() {
  const { currentUser, notifications } = useApp();
  const userNotifications = notifications.filter((item) => item.userId === currentUser?.id);

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Basic Notifications</Text>
      <FlatList
        data={userNotifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState title="No notifications yet" message="Nearby task alerts will appear here." />}
        renderItem={({ item }) => (
          <AppCard>
            <Text style={styles.linkText}>{item.notificationType}</Text>
            <Text style={styles.text}>{item.message}</Text>
            <StatusBadge status={item.readStatus ? "Read" : "Unread"} />
          </AppCard>
        )}
      />
    </ScreenContainer>
  );
}
