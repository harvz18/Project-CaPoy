function isExpoPushToken(token) {
  return typeof token === "string"
    && (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));
}

function isNotificationCategoryEnabled(notification, preferences) {
  if (notification.route === "chat" || notification.notificationType === "New message") {
    return preferences.messagesEnabled !== false;
  }
  if (notification.notificationType === "Matching task") {
    return preferences.matchingEnabled !== false;
  }
  return preferences.taskUpdatesEnabled !== false;
}

function buildExpoPushMessage(token, notification, notificationId) {
  return {
    to: token,
    title: notification.notificationType ?? "TASKLINK",
    body: notification.message,
    sound: "default",
    channelId: "tasklink-updates",
    data: {
      notificationId,
      taskId: notification.taskId ?? "",
      route: notification.route ?? "task",
      senderId: notification.senderId ?? ""
    }
  };
}

module.exports = { buildExpoPushMessage, isExpoPushToken, isNotificationCategoryEnabled };
