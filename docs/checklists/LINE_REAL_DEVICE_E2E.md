# LINE Real-Device E2E Checklist

Status: pending. Do not mark this checklist passed from mock tests or desktop browser tests.

Last reviewed: 2026-07-29.

## Test record

Record the environment, release commit, tester, timestamp, device model, OS version, LINE app version, Official Account, LINE Login channel, Messaging API channel, LIFF ID, and sanitized ticket/order IDs. Store screenshots outside the repository and remove personal data.

## Configuration

- [ ] The LINE Login channel and Messaging API channel belong to the intended provider and environment.
- [ ] The LIFF endpoint is the deployed HTTPS `/liff` base path, for example `https://<web-origin>/liff`, and the frontend `VITE_LIFF_ID` matches it.
- [ ] The LIFF app uses the `Full` view size, enables **Scan QR**, includes the `profile` scope, links the intended Official Account, and has the Add Friend option enabled.
- [ ] Backend `LINE_LOGIN_CHANNEL_ID` is the LINE Login channel ID used for ID-token verification.
- [ ] `LINE_MESSAGING_CHANNEL_SECRET` and `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` come from the intended Messaging API channel.
- [ ] Backend `LINE_LOGIN_LIFF_ID`, frontend `VITE_LIFF_ID`, and `WEB_ORIGIN` generate valid ticket deeplinks.
- [ ] The HTTPS webhook URL is reachable, signature verification passes, and an invalid signature is rejected.
- [ ] The customer follows the Official Account and device/LINE notification settings permit alerts.
- [ ] A production-valid Rich Menu image is synced explicitly with `npm run line:rich-menu:sync`.
- [ ] Manager branch QR links are permanent LIFF links such as `https://liff.line.me/{LIFF_ID}/qr/:token` and never resolve to `/liff/liff/...`.

## Customer flow

- [ ] Opening LIFF authenticates with LINE, exchanges the ID token server-side, and creates a system session without trusting a browser-supplied LINE user ID.
- [ ] A customer who is not following the linked Official Account sees the localized Add Friend guidance; the native Add/Unblock action opens, friendship is rechecked, and the guidance disappears after success.
- [ ] LIFF Home shows the Japanese empty state when no active ticket exists.
- [ ] LIFF Home opens LINE `scanCodeV2`, recognizes a valid branch QR, and the browser-camera fallback remains usable when the native API is unavailable.
- [ ] Rich Menu `ホーム`, `予約する`, `現在の受付`, and `利用案内` open the intended LIFF routes.
- [ ] Scanning a branch QR opens the branch booking flow, requires a verified LINE customer session, and blocks staff/manager/admin sessions from creating customer bookings.
- [ ] A branch with multiple active queues shows queue selection first, then updates waiting count, ETA, and product catalog for the selected queue.
- [ ] A normal product can be selected and booked without payment.
- [ ] A required-prepayment item blocks booking until the server-verified demo/sandbox payment completes.
- [ ] Returning from payment preserves the draft, the browser return alone never marks payment paid, and the booking is created automatically after verified payment succeeds.
- [ ] Booking redirects to `/liff/tickets/:entryId` and shows ticket code, status, people ahead, and ETA in Japanese.
- [ ] Reopening the same QR/LIFF entry after booking starts a clean booking attempt while booking history remains available.
- [ ] LIFF Home resolves the active ticket without a fixed entry ID.
- [ ] Booking history is visible across two devices/sessions for the same verified LINE account.
- [ ] Public browser fallback redirects or guides the user into LIFF/LINE authentication before payment intent or booking creation.

## Messaging flow

- [ ] Booking-created message arrives in the Official Account chat with Japanese Flex content and a working ticket button.
- [ ] The exactly-five-people-ahead notification arrives once when the ticket reaches that position.
- [ ] Called and completed messages each arrive once with the correct current ticket state.
- [ ] Deferred/late-arrival, cancelled, and no-show exceptional events each produce the correct message once when applicable.
- [ ] Every message opens the matching `/liff/tickets/:entryId`; web fallback works when LIFF configuration is intentionally absent in staging.
- [ ] Text fallback is readable when Flex sending is deliberately made to fail in a controlled test.
- [ ] Device notification sound/banner behavior is recorded separately because it depends on LINE and OS notification settings.
- [ ] Blocking/unfollowing or disabling a preference prevents only the applicable future messages and preserves delivery history.
- [ ] A provider failure leaves the queue/order transition committed and creates a sanitized retry/failed outbox state.
- [ ] Reprocessing the same domain event does not deliver a duplicate message.
- [ ] Completing a ticket auto-calls the next eligible waiting customer without a staff pressing a separate call-next button.
- [ ] Deferring a late called ticket moves it back three waiting slots, notifies the customer, and the third absence cancels/refunds according to policy.

## Webhook and privacy

- [ ] Follow and unfollow events update eligibility/preferences as designed.
- [ ] Basic supported message events are accepted without exposing secrets or personal identifiers in logs.
- [ ] Location consent is explicit; revocation and deletion work; no continuous tracking occurs.
- [ ] Logs, metrics, screenshots, and database evidence contain no access token, channel secret, full LINE user ID, or exact coordinates.
- [ ] SMTP-delivered account activation and password reset links are tested separately from LINE customer authentication; customers do not use email/password login.

## Exit criteria

Pass only when all applicable boxes are checked on at least one supported iOS device and one supported Android device in staging, failures have linked issues, and the release owner approves the evidence. Mock Playwright results remain a separate automated gate.

# Current implementation readiness

- Webhook verification uses the unmodified raw request body, HMAC-SHA256, and constant-time signature comparison.
- Queue notifications are committed to PostgreSQL before a worker calls LINE; queue/order transactions do not call LINE directly.
- Push delivery uses a stable `X-Line-Retry-Key` per outbox delivery payload, with a separate deterministic key for text fallback.
- Flex messages, Japanese/English/Vietnamese fallback text, LIFF ticket deep links, notification preferences, bounded retry, and delivery metrics are implemented.
- The standard notification journey is booking-created, exactly five people ahead, called, and completed; deferred, cancelled, and no-show remain exceptional messages.
- Console configuration and a real-device follow/login/push test remain deployment responsibilities.
