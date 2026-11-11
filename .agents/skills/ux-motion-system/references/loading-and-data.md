# Loading, refreshing, data continuity, and honest progress

## Loading state hierarchy
1. If data is immediately available, show it; don't force loading animation.
2. For very brief async actions, avoid flashing a spinner; use a suitable pending state when necessary to prevent duplicate actions.
3. For list/content loads, use skeletons only when layout shape is predictable and real work is pending. Skeleton dimensions should approximate eventual content to avoid layout shift.
4. If progress is measurable, use a determinate indicator based on actual progress. Otherwise show an indeterminate state; never invent 37%, 80%, or 100% for decorative effect.
5. If request fails, replace loading with a readable error and retry path. No infinite shimmer.

## Skeletons
- Prefer calm opacity breathing if needed; avoid high-contrast traveling shimmer, particularly on glass surfaces.
- Use reduced-motion/static placeholders when motion preference says so.
- Do not create dozens of independent repeating animation loops; keep one simple pattern per loading region.
- Preserve vertical size and scroll anchoring when loaded content replaces placeholders.
- Show true empty states after successful empty response rather than endlessly showing placeholders.

## Refreshing
- Native pull-to-refresh animation follows the gesture and stops when the request completes, errors, or is canceled.
- Background refreshing should be unobtrusive and should not reset scroll or fire a full-screen entrance animation.
- A changed list can gently insert/remove entries once; unchanged data should not flicker or retrigger.

## Confirmation and failure
- Indicate pending right after user action.
- Confirm success only when transaction/server reports success (or explicitly label optimistic status as pending).
- Show actionable failure and retry; keep draft inputs, selections, and context.
- Never use animations to conceal cancellation, failed uploads, unsaved changes, or charge attempts.

## Notifications
- Toasts must not stack to obscurity. Batch/queue politely or use persistent messages for critical errors.
- Time-limited toasts need sufficient reading time; users who need more time should have a way to access important results later.
- Animations should not repeatedly move the same content when notifications arrive in bursts.

## Examples by product workflow
- **Delivery/booking/order:** confirm submission, show accurate pending/confirmed phases, preserve cart/address until server returns. Move only the status indicator or relevant content.
- **Payment:** keep confirmation explicit and avoid celebratory success before gateway acknowledgement; never visually imply payment happened when it is still processing.
- **Messaging:** append a message once, subtle insertion; preserve scroll behavior, distinguish sent/delivered/failed based on actual state.
- **Dashboard:** stat numbers update without spinning/slot-machine effects; do not replay card entrance animation on every data refresh.
