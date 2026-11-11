# Feedback and system states

For each data-dependent region, consider: initial, loading, loaded, empty, refreshing, offline, unauthorized, recoverable error, terminal error, and success.

- Scope loading feedback to the region or action whenever possible; avoid blocking unrelated controls.
- Use activity indicators or skeletons only while work is genuinely pending. Keep stable content visible during refresh.
- Empty states explain what is empty, why when known, and the next useful action.
- Error messages state what failed and offer Retry, Edit, Back, Help, or another real recovery path.
- Offline messaging distinguishes unavailable network work from cached/available actions. Do not discard drafts.
- Success feedback is perceivable, specific, and confirmed. Persistent outcomes should also appear in the destination state.
- Pending, completed, cancelled, failed, and unavailable must differ by text/icon/state—not color alone.
- Permission denial explains the affected feature and how to continue or open settings when applicable.
