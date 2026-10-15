# Architecture

Where code goes and which layer may import which.

## Layers

| Path                        | Contains                                                       | May import                          |
| --------------------------- | -------------------------------------------------------------- | ----------------------------------- |
| `src/app/`                  | Routes only: pages, layouts, route handlers, `sitemap.ts`, `robots.ts` | Everything                          |
| `src/server/<module>/`      | Server-only business logic, one directory per module           | `src/server`, `project.config`, npm packages |
| `src/components/<area>/`    | UI, one directory per area (`home`, `billing`, `chat`, ...). `ui/` is shadcn | `src/components`, `src/lib`, `src/hooks`, `src/i18n`, `project.config`; tests also `src/test` |
| `src/lib/`                  | Shared utilities and browser clients (`auth-client.ts`). `api.ts` is the API contract: error codes and response bodies | `src/lib`, `src/i18n`               |
| `src/hooks/`                | React hooks                                                    | `src/lib`, `src/hooks`              |
| `src/i18n/`                 | next-intl routing, locale-aware navigation, request config     | `src/i18n`, `messages/`, npm packages |
| `messages/<locale>.json`    | UI strings, one file per locale, same keys in every file       | —                                   |
| `src/test/`                 | Test helpers (`renderWithIntl`)                                | Everything                          |
| `content/`                  | MDX per locale (`legal/<locale>/*.mdx`, `blog/<locale>/*.mdx`), loaded by `src/lib/content.ts` | MDX components from `src/mdx-components.tsx` |
| `project.config.ts`         | Non-secret settings (name, support email). Client components bundle it, so keep server-only values out | — |
| `src/types/`                | Shared type declarations                                       | —                                   |
| `src/proxy.ts`              | Request-time redirects (Next.js 16 name for middleware)        | `src/i18n`, npm packages            |
| `src/instrumentation.ts`    | Runs `assertValidEnv` once at server start                     | `src/server`                        |

ESLint (`no-restricted-imports`) enforces the "May import" column, by alias and by relative path; `src/test/layers.test.ts` checks each rule. `src/server` stays self-contained so a module can move to a separate service. UI code calls the API instead of importing `src/server`.

A `"use client"` file in `src/app` could import `src/server`; the build then fails on Node-only packages such as `pg`. The `server-only` package isn't used: Better Auth's CLI (`pnpm auth:generate`) refuses a config that imports it.

Icons: `lucide-react` only, stroke width set in `globals.css`. Tests sit next to the code (`*.test.ts(x)`, `*.int.test.ts`); E2E specs live in `e2e/`.

## Routes

Every page sits under `src/app/[locale]/`. Locales are `en` (default) and `zh`; `/` redirects to `/en`. API routes have no locale prefix.

| Group         | Pages                         | Notes                                                                 |
| ------------- | ----------------------------- | --------------------------------------------------------------------- |
| `(marketing)` | home, `pricing`, `ai-rap-video-generator`, `blog`, `blog/[slug]`, `blog/tags/[tag]` | Site header and footer, shared by `(auth)` and `(legal)` inside it. The header's account button (`SiteAccount`, `src/app/_lib/site-account.tsx`) reads the session cookie behind its own `<Suspense>`, so the pages stay prerendered. An unlisted post or tag renders on first request and can answer 404, because `partialPrefetching` is off (`next.config.ts`) |
| `(marketing)/(auth)` | `sign-in`              | Magic link and Google. First sign-in creates the account. `noindex` |
| `(marketing)/(legal)` | `privacy`, `terms`, `refund` | MDX from `content/legal/`. Linked from the footer |
| `(dashboard)` | `dashboard`, `chat/[[...id]]`, `images`, `images/library`, `images/[id]`, `videos`, `videos/library`, `videos/[id]`, `notifications`, `feedback`, `billing`, `api-keys`, `profile`, `admin`, `admin/users`, `admin/users/[id]`, `admin/orders`, `admin/notifications`, `admin/metrics`, `admin/feedback` | Signed-in area with a shadcn Sidebar shell, `noindex`. `src/proxy.ts` checks the cookie; `(dashboard)/layout.tsx` verifies the session. Read it with `currentSession()` (`src/app/_lib/session.ts`, React `cache`), so a render looks it up once; ESLint keeps `getSession` out of `src/app/[locale]`. `userBalance` and `userSubscription` (`src/app/_lib/account.ts`) work the same way. Admin pages call `notFound()` unless the email is in `ADMIN_EMAILS`. `/credits` redirects (308) to `/billing` |
| —             | `[...rest]`                   | Calls `notFound()` for the localized 404 (`[locale]/not-found.tsx`). `src/app/not-found.tsx` covers paths outside a locale |
| —             | `/indexnow.txt` | The IndexNow key, `INDEXNOW_KEY`, as plain text; 404 without it. `POST /api/indexnow` names it as `keyLocation` |
| —             | `/sitemap.xml`, `/robots.txt`, `/llms.txt` | The sitemap lists home, legal, pricing, the rap video page, blog and each locale's posts, with `hreflang` alternates (a post links only its locales). The home pages share a domain-root `WebSite` identity and name the brand in Open Graph metadata. Pages name the same canonical URL and alternates (`languageAlternates`, `src/lib/seo.ts`); next-intl's `hreflang` Link header is off (`alternateLinks: false`). `robots.txt` allows all but `/api/`. `llms.txt` ([llmstxt.org](https://llmstxt.org)) gives the name, description, landing copy and links to public pages and posts. All three read `BETTER_AUTH_URL` per request |
| —             | `opengraph-image`, `blog/[slug]/opengraph-image-<hash>`, `ai-rap-video-generator/opengraph-image-<hash>/preview` | 1200×630 PNGs rendered by `next/og` from `src/app/_lib/og-image.tsx`, at build time except the rap video page's: its `generateImageMetadata` (per-locale alt text) adds an id segment that renders on request, so it reads its photo through `"use cache"`. Chinese text loads Noto Sans SC from Google Fonts when the image renders |
| `api/`        | `auth/[...all]`, `chat`, `chat/[id]`, `health`, `admin/credits`, `admin/broadcasts`, `images`, `images/[id]`, `images/[id]/download`, `videos`, `videos/[id]`, `videos/[id]/download`, `notifications`, `notifications/read`, `feedback`, `cron/sweep`, `indexnow`, `payment/{checkout,subscribe,portal}`, `webhooks/payment/[provider]` | Handlers call `src/server`. Signed-in routes use `withSession` (`api/_lib/with-session.ts`): 401 without a session; 403 `FORBIDDEN_ORIGIN` for a cookie POST, PUT, PATCH or DELETE whose `Origin` is missing or not `BETTER_AUTH_URL`; 403 `API_KEY_NOT_ALLOWED` for `x-api-key` on a route without `apiKey: true` (only the six image and video routes; `src/test/api-key-routes.test.ts` pins them); 401 `INVALID_API_KEY`; 429 `RATE_LIMITED` with `Retry-After` past a per-user limit (`api/_lib/limits.ts`). Webhooks, cron, `indexnow` (the `CRON_SECRET` bearer; sends the sitemap URLs to IndexNow), health and `/api/auth` check their own callers |

`next.config.ts` sends `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=63072000` (without `includeSubDomains` or `preload`) and `Referrer-Policy: strict-origin-when-cross-origin` with every response. To embed a page elsewhere, relax the frame headers for that path only.

`src/proxy.ts` runs locale routing and the cookie check. A signed-out visitor goes to `/<locale>/sign-in?next=<path>`; sign-in returns to `next` if it is a path on this site (`signInReturnPath`, `src/lib/sign-in.ts`), else to the dashboard. To add a `(dashboard)` page:

1. Add its path to `PROTECTED` in `src/proxy.ts`.
2. Add a sidebar item to `CREATE` or `ACCOUNT` in `src/components/dashboard/app-sidebar.tsx`.
3. Start the page with `<PageHeader title description />`.
4. Read the request (`headers()`, the session, `searchParams`) in a child inside the page's own `<Suspense>`, with static content outside it. The layout stays mounted on client navigation, so without that boundary navigation blocks and `next dev` reports `uncached data during prerendering or a navigation`. Use `<PageSkeleton />` (`<PageSkeleton header />` if the header waits too) as the fallback, `ListSkeleton` on admin lists. See `dashboard/page.tsx` and `billing/page.tsx`.

The layout reads the credit balance once for the sidebar's account menu. Generation forms and billing read `useCreditBalance(initialBalance)` so prefetched or preserved page props cannot restore an old balance. A page that spends or refunds credits calls `useCredits()?.adjust(delta)` (`src/components/dashboard/credits.tsx`) to keep it current; `router.refresh()` also re-reads it.

API routes answer errors with `apiError(code, status)` and type success bodies with `satisfies` against `src/lib/api.ts`. Components read them as `ApiBody<...>` and key messages by `ApiErrorCode`, so a renamed field or code fails `pnpm typecheck`. Add a new code to `ApiErrorCode` first.

Use `Link`, `redirect` and `useRouter` from `@/i18n/navigation`, not `next/*`, so URLs keep the locale.

## Server modules

A module that owns tables keeps them in its `schema.ts`; `db/schema.ts` re-exports them all.

| Module   | Files                                                    |
| -------- | -------------------------------------------------------- |
| `db`     | `index.ts` (client), `schema.ts` |
| `auth`   | `index.ts` (Better Auth; production rate limits per IP in `rate_limit`), `client-ip.ts` (the one trusted IP header, `CLIENT_IP_HEADER`), `schema.ts`, `session.ts`, `social-providers.ts`, `api-keys.ts` (hashed `sk_` keys sent as `x-api-key`; `getSession` returns the owner's session; 60 requests a minute per key; at most `MAX_API_KEYS` (10) per user) |
| `account` | `index.ts`: `beforeDeleteUser` throws `LiveSubscriptionError` while a subscription is live; `afterDeleteUser` deletes the user's API keys (no foreign key) and stored files. A new module that stores a user's files adds itself here, not to `auth` |
| `admin`  | `access.ts` (`isAdmin`, `ADMIN_EMAILS`), `users.ts`, `credits.ts` (`addCredits`, idempotent per request ID), `orders.ts`, `metrics.ts` (users, credits, orders, revenue, and per generation kind the outcomes, median and p95 time and top failures, over a window) |
| `ai`     | `chat.ts`, `config.ts` (`CHAT_CREDIT_COST`, model, limits), `chats.ts`, `schema.ts` (`chat`, `chat_message`): DeepSeek through the Vercel AI SDK. `dashscope.ts`: Bailian text-to-image (async task). `video/`: image-to-video providers behind `VideoProvider` (`types.ts`): `fal.ts` (Kling 2.6 Pro), `seeapi.ts` (Seedance 2.0), `dashscope.ts` (Wan 2.7); `video/index.ts` registers them and reads `VIDEO_PROVIDER` |
| `credits` | `index.ts` (`getBalance`, `listTransactions`, `usedIdempotencyKeys`, `grantCredits`, `spendCredits`, `spendUpTo` (spends at most the balance); the last three take an optional `tx`), `schema.ts` (balance + ledger), `config.ts` (`signupCredits`) |
| `feedback` | `index.ts` (validate, submit idempotently, paginate for admins), `schema.ts`, `config.ts` |
| `email`  | `client.ts` (Resend or console), `templates/` (magic link; failed charge and ended subscription, linking to `/billing`; video ready or failed, sent only when the sweep settles it) |
| `health` | `index.ts`                                               |
| `ratelimit` | `index.ts` (`hitLimit`): fixed-window counter per key in `rate_limit`, one upsert per hit. Keys start with `api:` |
| `indexnow` | `index.ts` (`submitUrls`: posts one host's URLs to `api.indexnow.org` in batches of 10,000 with `INDEXNOW_KEY`) |
| `log`    | `index.ts` (`log.debug/info/warn/error`): one line per event, `<area>.<what happened>`, JSON in production. Server code never uses `console.*`. `onErrorLogged` lets a tracker see errors. [runbook § Logs](runbook.md#logs) |
| `monitoring` | `index.ts`: Sentry, off unless `NEXT_PUBLIC_SENTRY_DSN` is set. `src/instrumentation.ts` starts it; the browser starts its own in `src/instrumentation-client.ts` |
| `cron`   | `index.ts` (`isCronRequest`, `sweepPending`): settles pending images and videos, grants yearly months and deletes uploads past `UPLOAD_RETENTION_MS` (`expireUploads`), for `/api/cron/*` (`GET` from Vercel Cron per `vercel.json`, or `POST`). The tasks run independently; any failure is logged and the route returns 500 without skipping the others |
| `generations` | `columns.ts` (`generationColumns`, shared by every kind's table), `index.ts` (`lifecycle`, typed on those columns only). `start` inserts the pending row and spends credits in one transaction, then fails and refunds if submitting throws. Failing sets the status and refunds in one transaction; only the call that changed the status refunds. `refresh` polls the provider, stores the result and notifies. `sweep` fails at most 100 lost jobs per run, oldest first, then polls a batch, least recently checked first, 4 at a time. A kind (`GenerationKind`) supplies its name, table, job ID column, cost, poll, output type and notifications. The credit keys (`<kind>:<id>`, `<kind>-refund:<id>`) and reasons are fixed: jobs in flight during a deploy rely on them `unwatched` (optional) runs once when the sweep settles a job, as no page was open: videos email the owner |
| `images`, `videos` | `index.ts` (create, refresh, get, download URL, list, page, count, metrics, sweep, delete), `schema.ts`, `config.ts` (cost; image sizes or `VIDEO_RESOLUTIONS` credits per second and `VIDEO_COST_PER_SECOND` dollars per second by provider; page sizes) |
| `notifications` | `index.ts` (`notify`, `pageNotifications`, `unreadCount`, `markRead`), `broadcasts.ts`, `schema.ts` (`notification`, `broadcast`), `types.ts` (`NotificationContent`), `config.ts` |
| `env.ts` | `validateEnv` / `assertValidEnv` check every variable in [runbook § Environment variables](runbook.md#environment-variables) at server start. `requireEnv(name)` reads a checked variable |
| `payment` | `orders.ts`, `subscriptions.ts` (`offeredPlans`, events, portal, `grantYearlyMonths`), `refunds.ts` (`applyRefund`), `emails.ts` (logs a failure instead of failing the webhook), `webhook.ts`, `packs.ts`, `plans.ts`, `periods.ts`, `schema.ts` (`order`, `subscription`), `providers/` (one file per `PaymentProvider`, IDs in `PROVIDER_IDS`) |
| `moderation` | `index.ts` (`checkPrompt`, `ContentBlockedError`), `blocklist.ts` (`BLOCKED_TERMS`): checks prompts before they spend credits. `prompt.ts` (`screenPrompt`): optionally screens image/video prompts with Waffo before uploads or credits; only `allow` continues. `image.ts` (`checkImage`, `ModerationUnavailableError`): with `IMAGE_MODERATION=seeapi`, checks a video's stored start image (both rap duo photos) with SeeAPI before it spends credits; fails closed |
| `storage` | `index.ts` (`putObject`, `signedUrl`, `deletePrefix`): S3-compatible client for a private bucket |

Credits are whole numbers and don't expire. Every change needs an idempotency key, so a retry never applies twice. `spendCredits` throws `InsufficientCreditsError` instead of going below zero. Auth grants `signupCredits` once per new user. `/billing` shows the balance, the newest 50 ledger rows, packs, subscription and orders; give a new `reason` a label under `Credits.reasons` in `messages/*.json`.

### Images and videos

Both run on the `generations` lifecycle.

1. `POST /api/images` (`{ prompt, aspect }`) or `POST /api/videos` (multipart: `prompt`, `duration` 5 or 10, `resolution`, `image`) validates the input. A video's image must be JPEG, PNG or WebP by its first bytes, at most 4 MB (Vercel caps bodies at 4.5 MB), and its resolution one the active provider has in `VIDEO_RESOLUTIONS`. Its pixel size, read from the header (`image-size.ts`), must fit the provider's `VIDEO_IMAGE_LIMITS` (shortest side, longest side, ratio), or the route answers 400 `INVALID_IMAGE_SIZE` before anything is stored or spent; a header that can't be read is 400 `INVALID_REQUEST`. The forms check the same limits in the browser with `createImageBitmap` when a photo is picked (`src/lib/image-limits.ts`).
2. A prompt on the blocklist returns 422 `CONTENT_BLOCKED`. With `PROMPT_MODERATION=waffo`, Waffo screens it next: `block` returns 422; `review` or an unavailable check returns 503 `MODERATION_UNAVAILABLE` with `Retry-After`. Only `allow` continues. Missing credits return 402. Both record nothing.
3. It spends the cost (`imageCost`, or `duration × credits per second`) with the key `image:<id>` or `video:<id>`, inserts a `pending` row and submits the job. A video's image is stored as `videos/<userId>/<id>.<ext>`; fal gets it as a data URI, Bailian and SeeAPI as a one-hour signed URL, so the bucket must be reachable from the internet. It returns at once.
4. The page polls `GET /api/<kind>/<id>` (images every 3 s, videos every 5 s) with `usePendingPoll`, which stops on 401, drops the item on 404, backs off up to a minute on server errors and pauses in hidden tabs. When the job finishes, the server copies the result to `images/<userId>/<id>.png` or `videos/<userId>/<id>.mp4` (Bailian deletes results after 24 hours) and marks the row `succeeded`.
5. A failed submission or job marks the row `failed` and refunds with `<kind>-refund:<id>`. Provider moderation (Bailian `DataInspectionFailed`, `IPInfringementSuspect`; fal `content_policy_violation`) returns 422 `CONTENT_BLOCKED`, other submission failures 502. If the provider or storage can't answer during a poll, the row stays `pending`.

`VIDEO_PROVIDER` (`fal`, `seeapi` or `dashscope`) picks the provider for new videos. Each row records its provider, resolution and credits spent, so it finishes and refunds after a switch. To add a provider, implement `VideoProvider` in `src/server/ai/video/<id>.ts`, add its ID to `VIDEO_PROVIDER_IDS`, register it in `PROVIDERS`, price it in `VIDEO_RESOLUTIONS` and `VIDEO_COST_PER_SECOND` and require its key in `crossChecks` in `src/server/env.ts`.

The rap duo (`POST /api/videos/rap`, multipart: `name1`, `name2`, `image1` left, `image2` right, `language`) is a video too. Names are 1-30 characters and checked against the blocklist; each photo is JPEG, PNG or WebP up to 2 MB and fits `RAP_IMAGE_LIMITS` (at least 240 pixels a side, as Wan 3.0 requires). `writeLyrics` (`src/server/videos/rap.ts`) gets one line per name from DeepSeek, or fixed lines, before any credits are spent. It then spends `RAP_CREDITS` and stores the photos as `videos/<userId>/<id>.<ext>` and `<id>-2.<ext>`. It submits one Bailian Wan 3.0 reference-to-video job (15 s, 720p, 16:9, with sound) through `getReferenceVideoProvider`, whatever `VIDEO_PROVIDER` says. The row's provider is `dashscope`, so polling, the sweep, the library and refunds treat it like any video.

The zombie couple (`POST /api/videos/zombie`, multipart: `image1` left, `image2` right) shares that path (`createDuoVideo`) without names or lines: same photo checks, storage keys, Wan 3.0 job and price (`ZOMBIE_CREDITS`). Its prompt is the fixed `zombiePrompt` (`src/server/videos/zombie.ts`), and its row's prompt column holds `ZOMBIE_TITLE`. Both two-photo videos are `RAP_DURATION` long, which is how `expireUploads` knows to delete `<id>-2.<ext>`.

`/images` and `/videos` show the form and recent items. `/videos/rap` shows the rap duo form, `/videos/zombie` the zombie couple form. `/<kind>/library` pages them 24 at a time (`?page=N`); a page past the last is 404. `/<kind>/<id>` shows one item and calls `refresh` once, so opening it collects a finished job; if the provider or storage fails, it shows the stored row. Another user's item or an unknown ID is 404. A stored image opens full screen in `ImageViewer`.

`GET /api/<kind>/<id>/download` redirects to a signed URL with `Content-Disposition: attachment`; a missing or foreign item returns 404 `IMAGE_NOT_FOUND` or `VIDEO_NOT_FOUND`. The bucket is private: pages get one-hour signed URLs. Jobs nobody polls, or that a crash left unsubmitted, wait for the [pending sweep](runbook.md#pending-sweep), which settles them and gives up on videos after a day.

### Notifications

Modules call `notify(userId, key, { type, data })` for events outside the user's view. The key column is unique, so a retry or race stores one row. `notify` logs errors instead of throwing, and returns `true` only for a new row, so a caller that also emails sends once.

| Type | Sent by |
| ---- | ------- |
| `image_succeeded`, `video_succeeded` | The lifecycle's `refresh`, from the call that marks the row `succeeded` |
| `image_failed`, `video_failed` | The lifecycle, from the call that marks the row `failed`. `data.credits` is the refund |
| `order_paid` | `fulfillOrder`, after granting a pack. Key `order:<id>` |
| `subscription_paid` | `applySubscriptionEvent`, per charge. Key `subscription:<provider>:<payment id>` |
| `subscription_past_due` | `applySubscriptionEvent`, once per period: `subscription:<id>:past_due:<period end>` |
| `subscription_ended` | `applySubscriptionEvent`, when a live subscription becomes `canceled` or `expired`. An abandoned checkout sends nothing |
| `credits_added` | `addCredits` (key `admin:<request id>`) and `grantYearlyMonths` (key `subscription:<id>:<period end>:m<month>`) |
| `broadcast` | `sendBroadcast`, per recipient. Key `broadcast:<id>:<user id>` |

Rows store type and data, not text. `NotificationBody` (`src/components/notifications/notification-item.tsx`) renders text from `Notifications.types` in the reader's locale, and `notificationLink` picks the target page. A broadcast shows the admin's text as written and opens `/notifications`. To add a type, update `NOTIFICATION_TYPES` and `NotificationContent` (`types.ts`), `AppNotification` (`src/lib/api.ts`), `ICONS`, `notificationLink` and the messages.

The dashboard layout reads the unread count once; `NotificationsProvider` then polls `GET /api/notifications` every 60 seconds. The bell (sidebar header and phone bar) fetches the newest on open. Choosing one posts `{ id }` to `/api/notifications/read` and opens it; Mark all as read posts `{}`. `/notifications` pages them 20 at a time.

Admins send broadcasts from `/admin/notifications`: a title (≤ 100 characters) and message (≤ 1,000), to every current user or one user by email (case-insensitive). The form confirms, then posts to `/api/admin/broadcasts` with a request ID. The `broadcast` row is unique per request ID, and all recipients are inserted in one statement; a repeat returns the first broadcast and finishes a cut-short fan-out. Non-admins get 404; an unknown email gets 404 `UNKNOWN_USER`.

### Feedback

Signed-in users open `/feedback` from the fixed bottom-right link in the signed-in layout and submit text, images, or both. Images can be selected or pasted into the feedback form; both share preview, removal and validation. Text is at most 2,000 characters; images are at most three JPEG, PNG or WebP files totaling 4 MB, checked by their first bytes. `POST /api/feedback` accepts multipart `message`, `requestId` and repeated `images` fields (JSON text submissions still work); `withSession` checks the session and Origin and limits each user to five requests a minute. A transaction advisory lock and unique `(user_id, request_id)` index make concurrent retries return the saved feedback without uploading twice. Each attempt uses unique object keys; failed attempts delete their uploads. The form retains text, images and the request ID after a failed request.

`src/server/feedback/` owns validation, storage and pagination. Feedback rows and the private `feedback/<userId>/` storage prefix are deleted with the account. Only admins can read `/admin/feedback`, which shows the full message, account name, email and submission time, newest first, 20 per page. Thumbnails and full-size links use `/api/admin/feedback/[id]/images/[index]`, which checks admin access before issuing a one-hour signed URL with a non-cacheable redirect. Without storage, text feedback still works and image submissions return `FEEDBACK_STORAGE_DISABLED`.

### Payments

`PAYMENT_PROVIDER` (`stripe` or `waffo`) picks the provider for new checkouts. Each order and subscription records its provider, and every provider's webhook stays on, so only the provider that took it can change it.

Credit packs:

1. `POST /api/payment/checkout` records a pending `order` and returns the provider's checkout URL. A refusal fails the order.
2. The provider calls `/api/webhooks/payment/<provider>`, which verifies the signature and maps the event to `paid`, `expired` or `failed`.
3. `paid` grants credits with `order:<id>`, then marks the order paid, so repeats and crash retries grant once. A payment for a failed or expired order still completes. An unknown order answers `409 UNKNOWN_ORDER`, so the provider retries.

Subscriptions bill monthly or yearly (`interval`) and grant the plan's credits every paid month; unused credits carry over.

1. `POST /api/payment/subscribe` records a pending `subscription` and opens a checkout. Under a per-user advisory lock, a user has at most one live subscription (`active`, `canceling`, `past_due`) and one open checkout. A refusal expires the row.
2. Each charge (Stripe `invoice.paid`, Waffo `subscription.payment_succeeded`) grants credits with `subscription:<provider>:<payment id>`; for a yearly plan, that is the first month.
3. The sweep's `grantYearlyMonths` grants each later month of an `active` or `canceling` yearly plan as it begins: month `k` starts `k` calendar months after `currentPeriodEnd` minus a year. The key `subscription:<id>:<period end>:m<k>` makes it idempotent. Stripe prices intervals inline; Waffo needs `WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID`, or `offeredPlans` hides yearly plans.
4. Status events update `status` and `currentPeriodEnd` on the row locked `FOR UPDATE`. `canceled` and `expired` are final; an event for an earlier period changes nothing.
5. Users cancel, change cards and get invoices in the provider's portal (`POST /api/payment/portal`).
6. Account deletion fails with `ACTIVE_SUBSCRIPTION` while a subscription is live.

Refunds and chargebacks (Stripe `charge.refunded` and `charge.dispute.funds_withdrawn`, Waffo `refund.succeeded`) become a `RefundEvent` for the order or subscription the charge paid. Stripe charges carry neither ID, so `parseWebhook` (async) looks up the payment intent's Checkout Session, then its invoice. `applyRefund` takes back the refunded share of the charge's credits (a yearly charge counts twelve months) with `spendUpTo`, keyed `refund:<provider>:<refund id>` and reason `refunded payment`. It takes at most the balance and logs the rest as `payment.refund_shortfall`. A refund that matches no paid order or subscription logs `payment.refund_unmatched` and answers 200.

To add a provider, implement `PaymentProvider` in `src/server/payment/providers/<id>.ts`, add its ID to `PROVIDER_IDS`, register it in `providers/index.ts` and require its keys in `crossChecks` in `src/server/env.ts`.

### AI chat

`/chat` starts a chat and `/chat/<id>` opens a saved one, with recent chats beside it. Replies stream with `useChat` (`@ai-sdk/react`). Chats live in `chat` and `chat_message` (`UIMessage` format) and are deleted with the account.

1. The browser picks the chat ID (UUID) and sends only the new message: `POST /api/chat` with `{ id, message }`. The server loads the history, so a client can't rewrite it. Another user's chat returns `404 CHAT_NOT_FOUND`.
2. The message must be the user's, text only, ≤ 4,000 characters and not already saved; otherwise `400 INVALID_CHAT`, no charge.
3. It spends `CHAT_CREDIT_COST` (1) with a server key `chat:<id>` in one transaction with the user's message. No credits returns `402 INSUFFICIENT_CREDITS` and saves nothing.
4. The first message creates the chat, titled with its first 60 characters. The model sees the newest messages that fit in 20,000 characters.
5. The reply is saved before the response ends, or on disconnect. If the model fails, `onError` refunds with `chat-refund:<id>`; the question stays.
6. After the first reply, `history.replaceState` switches the URL to `/chat/<id>` without a reload.

`DELETE /api/chat/<id>` deletes a chat. `DEEPSEEK_API_KEY` turns chat on and `DEEPSEEK_MODEL` picks the model (default `deepseek-flash`); without a key the API returns `503 CHAT_DISABLED`. E2E sets `AI_MOCK=1` for an echo model.

## Target structure

Planned directories, merged with what exists. Create each planned one in the slice that first needs it.

```
content/                   # Git-managed content: templates/, prompts/, blog/, legal/
public/                    # og/, posters/, samples/
scripts/                   # seed-templates.ts, generate-posters.ts
src/
  app/
    [locale]/              # every page under a locale prefix
      (marketing)/         # SSG pages: templates, create/[slug], prompts, blog, what-is, pricing, about, contact
        (legal)/           # more pages: safety, copyright, delete-my-data
        (auth)/            # sign-in
      (dashboard)/         # signed-in area: dashboard, chat, images, videos, billing, notifications, profile, admin; later projects
    api/                   # auth, chat, images, videos, notifications, cron, admin, payment, webhooks/payment
    sitemap.ts, robots.ts, llms.txt/, indexnow.txt/
  components/              # ui, layout, home, auth, account, api-keys, dashboard, chat, images, videos, credits, billing, notifications, admin, legal; later templates, pricing, projects, seo
  server/                  # env.ts, db, auth, account, admin, credits, ai, generations, images, videos, cron, notifications, storage, payment, email, health, indexnow, log, monitoring, moderation, ratelimit
  lib/                     # api, auth-client, content, utils; later seo, watermark
  i18n/                    # routing, request, navigation
  hooks/
  test/
  types/
  proxy.ts
```

### Product analytics

`src/server/analytics` sends explicit signup, generation and verified payment events to PostHog with bounded, best-effort HTTP calls. `src/components/layout/posthog.tsx` records sanitized page routes with in-memory anonymous IDs. Both attach `app=vibemovo`. See [PostHog operations](runbook.md#posthog) for the event contract and delivery limits.
