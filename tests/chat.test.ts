import assert from "node:assert/strict";
import test from "node:test";
import { getConversationParticipants } from "../src/services/chatService";

test("an employer reply preserves the participant order from the existing conversation", () => {
  assert.deepEqual(
    getConversationParticipants(["worker-1", "client-1"], "client-1", "worker-1"),
    ["worker-1", "client-1"]
  );
});

test("a new conversation uses deterministic participants and rejects a mismatched chat", () => {
  assert.deepEqual(getConversationParticipants(undefined, "worker-1", "client-1"), ["client-1", "worker-1"]);
  assert.throws(() => getConversationParticipants(["worker-2", "client-1"], "client-1", "worker-1"));
});
