# Merchant Booking Requests Grouped by Event

Date completed: September 23, 2026

## Outcome

The service-provider booking list now displays one card per event instead of one card per booked
service. The card's primary title is the event name, not the client's name.

For example, if the same provider owns a catering service and an equipment-rental service booked for
one event, the booking list shows one event card with **2 services** and the combined provider total.
Opening that card shows both service bookings separately.

## Booking-list behavior

[`src/screens/19-BookingRequest.tsx`](../src/screens/19-BookingRequest.tsx) now displays:

- event title;
- event date;
- number of services booked from that provider;
- combined value of those services;
- a short list of the provider's service names; and
- the event's current provider-facing status.

The booker's name is intentionally omitted from the list card. It appears inside the event details,
where the additional context is useful.

Events are assigned to one status tab using the most actionable underlying service state:

1. **New** when at least one provider service still needs a response.
2. **Confirmed** when no service is new and at least one is confirmed.
3. **Completed** when no service needs action and at least one was completed.
4. **Cancelled** when every provider service in the event was declined or cancelled.

## Event-detail behavior

[`src/screens/19.1-BookingRequest.tsx`](../src/screens/19.1-BookingRequest.tsx) was rebuilt as an
event-level workspace. It shows:

- complete event name, type, date, time, venue, expected guests, client, and provider total;
- every service belonging to the signed-in provider for that event;
- service category and service name;
- selected package, description, price, and inclusions;
- the client's booking note for each individual service;
- saved instructions and tags matched to each individual service;
- separate status badges for each service; and
- separate accept, decline, response-note, and completion controls per service.

Actions remain service-specific. Accepting or finishing one service does not automatically change the
other services from the same provider. After an action, the event remains open so the provider can
continue working through the remaining services.

## Data mapping

[`src/lib/merchant.ts`](../src/lib/merchant.ts) still loads real paid or verified booking rows that
belong to the signed-in provider. It now:

- loads each service's category;
- attaches service-specific client notes and provider instructions;
- groups the rows by `provider_id + event_id` in the authenticated provider context;
- de-duplicates booking rows if a payment join returns the same booking more than once;
- calculates a combined provider amount; and
- retains the original booking UUID for every service action.

No database records were merged. Grouping is a presentation/data-mapping change, while acceptance,
decline, notifications, availability blocking, and completion still target the correct individual
`bookings.id`.

## Home dashboard

The provider-home schedule now uses event titles and event venues. Its request and active-event
counts are event counts rather than duplicated service counts.

## Verification

The linked database currently contains:

- 13 provider/event groups;
- 4 provider/event groups with more than one booked service; and
- up to 2 services from one provider in a single event.

The implementation was validated with:

- `npm run typecheck`;
- `npm run lint`;
- `npm run build:web`; and
- `git diff --check`.

## Test in the app

1. Reload the Expo app and sign in as a service provider.
2. Open **Bookings**.
3. Open an event card that says **2 services**.
4. Confirm the details page shows both provider services.
5. Verify each service has its own client note and instructions section.
6. Accept or decline one pending service and confirm the other service keeps its original status.
7. On or after the event date, mark one confirmed service finished and confirm the other remains
   unchanged until it is separately completed.
