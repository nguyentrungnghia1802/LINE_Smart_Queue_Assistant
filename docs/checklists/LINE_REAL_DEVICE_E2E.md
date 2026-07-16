# LINE Real-Device E2E Checklist

Status: pending. Do not mark this checklist passed from mock tests or desktop browser tests.

## Test record

Record the environment, release commit, tester, timestamp, device model, OS version, LINE app version, Official Account, LINE Login channel, Messaging API channel, LIFF ID, and sanitized ticket/order IDs. Store screenshots outside the repository and remove personal data.

## Configuration

- [ ] The LINE Login channel and Messaging API channel belong to the intended provider and environment.
- [ ] The LIFF endpoint uses the deployed HTTPS origin and the frontend `VITE_LIFF_ID` matches it.
- [ ] Backend `LINE_CHANNEL_ID` is the LINE Login channel ID used for ID-token verification.
- [ ] `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` come from the intended Messaging API channel.
- [ ] Backend `LINE_LIFF_ID` and `WEB_ORIGIN` generate valid ticket deeplinks.
- [ ] The HTTPS webhook URL is reachable, signature verification passes, and an invalid signature is rejected.
- [ ] The customer follows the Official Account and device/LINE notification settings permit alerts.
- [ ] A production-valid Rich Menu image is synced explicitly with `npm run line:rich-menu:sync`.

## Customer flow

- [ ] Opening LIFF authenticates with LINE, exchanges the ID token server-side, and creates a system session without trusting a browser-supplied LINE user ID.
- [ ] LIFF Home shows the Japanese empty state when no active ticket exists.
- [ ] Rich Menu `ホーム`, `予約する`, `現在の受付`, and `利用案内` open the intended LIFF routes.
- [ ] A normal product can be selected and booked without payment.
- [ ] A required-prepayment item blocks booking until the server-verified demo/sandbox payment completes.
- [ ] Returning from payment preserves the draft, and the browser return alone never marks payment paid.
- [ ] Booking redirects to `/liff/tickets/:entryId` and shows ticket code, status, people ahead, and ETA in Japanese.
- [ ] LIFF Home resolves the active ticket without a fixed entry ID.
- [ ] Booking history is visible across two devices/sessions for the same verified LINE account.
- [ ] Public browser fallback booking still works and does not falsely promise LINE notifications.

## Messaging flow

- [ ] Booking-created message arrives in the Official Account chat with Japanese Flex content and a working ticket button.
- [ ] Approaching, called, serving, completed, cancelled, and no-show events each produce the correct message once.
- [ ] Every message opens the matching `/liff/tickets/:entryId`; web fallback works when LIFF configuration is intentionally absent in staging.
- [ ] Text fallback is readable when Flex sending is deliberately made to fail in a controlled test.
- [ ] Device notification sound/banner behavior is recorded separately because it depends on LINE and OS notification settings.
- [ ] Blocking/unfollowing or disabling a preference prevents only the applicable future messages and preserves delivery history.
- [ ] A provider failure leaves the queue/order transition committed and creates a sanitized retry/failed outbox state.
- [ ] Reprocessing the same domain event does not deliver a duplicate message.

## Webhook and privacy

- [ ] Follow and unfollow events update eligibility/preferences as designed.
- [ ] Basic supported message events are accepted without exposing secrets or personal identifiers in logs.
- [ ] Location consent is explicit; revocation and deletion work; no continuous tracking occurs.
- [ ] Logs, metrics, screenshots, and database evidence contain no access token, channel secret, full LINE user ID, or exact coordinates.

## Exit criteria

Pass only when all applicable boxes are checked on at least one supported iOS device and one supported Android device in staging, failures have linked issues, and the release owner approves the evidence. Mock Playwright results remain a separate automated gate.
