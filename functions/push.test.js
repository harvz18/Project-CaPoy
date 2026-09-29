const assert = require("node:assert/strict");
const test = require("node:test");
const { buildExpoPushMessage, isExpoPushToken, isNotificationCategoryEnabled } = require("./push");

test("accepts only Expo push-token formats", () => {
  assert.equal(isExpoPushToken("ExponentPushToken[device]"), true);
  assert.equal(isExpoPushToken("ExpoPushToken[device]"), true);
  assert.equal(isExpoPushToken("not-a-push-token"), false);
});

test("respects notification category preferences", () => {
  const preferences = { messagesEnabled: false, matchingEnabled: true, taskUpdatesEnabled: false };
  assert.equal(isNotificationCategoryEnabled({ route: "chat" }, preferences), false);
  assert.equal(isNotificationCategoryEnabled({ notificationType: "Matching task" }, preferences), true);
  assert.equal(isNotificationCategoryEnabled({ notificationType: "Task completed" }, preferences), false);
});

test("builds a deep-linkable Expo push payload", () => {
  const payload = buildExpoPushMessage("ExpoPushToken[device]", {
    notificationType: "New message",
    message: "A worker sent a message.",
    taskId: "task-1",
    route: "chat",
    senderId: "worker-1"
  }, "notification-1");
  assert.equal(payload.channelId, "tasklink-updates");
  assert.deepEqual(payload.data, {
    notificationId: "notification-1",
    taskId: "task-1",
    route: "chat",
    senderId: "worker-1"
  });
});
