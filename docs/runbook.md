# Runbook

How to set up, run and operate the app, and how to fix common problems.

## First-time setup

1. Install dependencies and the Playwright browser:

   ```sh
   pnpm install
   pnpm exec playwright install chromium
   ```

2. Create `.env` and set a secret:

   ```sh
   cp .env.example .env
   openssl rand -base64 32   # paste into BETTER_AUTH_SECRET
   ```

3. Start Postgres and apply migrations:

   ```sh
   docker compose up -d --wait
   pnpm db:migrate
   ```

4. Start the app and check it:

   ```sh
   pnpm dev
   curl http://localhost:3000/api/health   # {"status":"ok","database":"ok"}
   ```

## Environment variables

The table lists every variable in `.env.example` and every `process.env` read in `src/`; `pnpm test` fails if they differ (`src/server/env-docs.test.ts`).

| Variable             | Required          | Purpose                                                       |
| -------------------- | ----------------- | ------------------------------------------------------------- |
| `DATABASE_URL`       | Yes               | Postgres connection string                                    |
| `BETTER_AUTH_SECRET` | Yes               | Signs sessions. 32+ characters. Rotating it signs everyone out |
| `BETTER_AUTH_URL`    | Yes               | Public base URL. Magic links point here. `https://` in production, except on localhost. Also set it when building: prerendered pages use it for canonical and `hreflang` links, which are relative paths without it |
| `CRON_SECRET`        | In production with images, videos or yearly plans | Bearer token for `/api/cron/sweep` (`GET` or `POST`). 32+ characters. Empty closes the route |
| `INDEXNOW_KEY`       | No                | IndexNow key, 8-128 letters, digits or hyphens. Served at `/indexnow.txt`; `POST /api/indexnow` needs it and `CRON_SECRET` ([IndexNow](#indexnow)). Empty turns IndexNow off |
| `CLIENT_IP_HEADER`   | No                | Request header with the client IP for sign-in rate limits. Default `x-forwarded-for` (Vercel and most proxies). Set `cf-connecting-ip` on Cloudflare. Only this header is trusted |
| `ADMIN_EMAILS`       | No                | Emails that can open `/admin`, separated by commas. Empty means no admins |
| `LOG_LEVEL`          | No                | `debug`, `info` (default), `warn` or `error`. Drops server log events below it |
| `LOG_FORMAT`         | No                | `json` (one object per line) or `pretty`. Default `json` in production, else `pretty` |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | No | Public PostHog project token (`phc_`). Set with host; empty disables analytics. Browser value is baked at build time |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | Ingestion origin: `https://us.i.posthog.com` or `https://eu.i.posthog.com`. Set with project token |
| `NEXT_PUBLIC_SENTRY_DSN` | No            | Sentry project DSN. Empty turns error tracking off. Read at build time for the browser |
| `SENTRY_AUTH_TOKEN`  | No                | Build time only. Sentry auth token; with it, the build uploads source maps |
| `SENTRY_ORG`         | With `SENTRY_AUTH_TOKEN` | Sentry organization slug                              |
| `SENTRY_PROJECT`     | With `SENTRY_AUTH_TOKEN` | Sentry project slug                                   |
| `NEXT_PUBLIC_VERCEL_ANALYTICS` | No      | `1` turns Vercel Web Analytics on. Empty turns it off. Read at build time |
| `NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS` | No | `1` turns Vercel Speed Insights on. Empty turns it off. Read at build time |
| `GOOGLE_CLIENT_ID`   | No                | Google OAuth client. Google sign-in is off unless both are set |
| `GOOGLE_CLIENT_SECRET` | No              | Google OAuth client secret                                     |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No    | Cloudflare Turnstile site key for magic-link sign-in. Read at build time. Turnstile is off unless both are set |
| `TURNSTILE_SECRET_KEY` | No              | Cloudflare Turnstile secret key                                |
| `RESEND_API_KEY`     | Yes in production | Without it, emails are logged; production throws               |
| `EMAIL_FROM`         | In production with `RESEND_API_KEY` | Sender, on a domain verified in Resend. Default `<project name> <onboarding@resend.dev>` |
| `EMAIL_OUTBOX_DIR`   | No                | Saves each email as `<to>.json`. Used by E2E only; refused in production unless `BETTER_AUTH_URL` is localhost |
| `PAYMENT_PROVIDER`   | No                | `stripe` or `waffo`. Empty turns buying off                    |
| `STRIPE_SECRET_KEY`  | With Stripe       | Secret API key (`sk_test_...` / `sk_live_...`) or restricted key (`rk_...`) |
| `STRIPE_WEBHOOK_SECRET` | With Stripe    | Signing secret of the webhook endpoint (`whsec_...`)           |
| `WAFFO_MERCHANT_ID`  | With Waffo        | Merchant ID (`MER_...`)                                        |
| `WAFFO_PRIVATE_KEY`  | With Waffo        | RSA private key, PEM on one line with `\n`                     |
| `WAFFO_PRODUCT_ID`   | With Waffo packs  | One-time product the packs are sold as (`PROD_...`)            |
| `WAFFO_SUBSCRIPTION_PRODUCT_ID` | With Waffo subscriptions | Monthly subscription product the plans are sold as (`PROD_...`) |
| `WAFFO_STORE_ID`     | With Waffo subscriptions | Store ID (`STO_...`) for customer portal links          |
| `WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID` | With Waffo yearly plans | Yearly subscription product the yearly plans are sold as (`PROD_...`). Empty hides the yearly plans |
| `WAFFO_ENVIRONMENT`  | No                | `test` or `prod` (default). Webhooks from the other environment are rejected |
| `DEEPSEEK_API_KEY`   | No                | DeepSeek API key (`sk-...`). Empty turns AI chat off           |
| `DEEPSEEK_MODEL`     | No                | DeepSeek model ID. Default `deepseek-flash`                    |
| `AI_MOCK`            | No                | Replies with an echo model when no DeepSeek key is set. Used by E2E only; refused in production unless `BETTER_AUTH_URL` is localhost |
| `DASHSCOPE_API_KEY`  | No                | Alibaba Cloud Model Studio (Bailian) API key. Empty turns image generation off |
| `DASHSCOPE_BASE_URL` | No                | API host for the key's region. Default `https://dashscope.aliyuncs.com` (Beijing) |
| `DASHSCOPE_IMAGE_MODEL` | No             | Text-to-image model. Default `wan2.6-t2i`                     |
| `DASHSCOPE_VIDEO_MODEL` | No             | Image-to-video model for `VIDEO_PROVIDER=dashscope`. Default `wan2.7-i2v-2026-04-25` |
| `VIDEO_PROVIDER`     | No                | `fal`, `seeapi` or `dashscope`. Empty turns video generation off |
| `FAL_KEY`            | With fal          | fal API key                                                   |
| `SEEAPI_API_KEY`     | With SeeAPI       | SeeAPI API key                                                |
| `PROMPT_MODERATION` | No | `waffo` screens image/video prompts before spending credits; empty uses only the local blocklist. Requires `WAFFO_MERCHANT_ID` and `WAFFO_PRIVATE_KEY` |
| `IMAGE_MODERATION`   | No                | `seeapi` checks video start images and the photos of rap duos and zombie couples with SeeAPI's NSFW filter. Empty turns the check off |
| `STORAGE_ENDPOINT`   | No                | S3-compatible endpoint. Empty means AWS S3                    |
| `STORAGE_REGION`     | No                | Region for request signing. Default `auto`                    |
| `STORAGE_BUCKET`     | With images or videos | Private bucket for generated images and videos            |
| `STORAGE_ACCESS_KEY_ID` | With images or videos | Access key for the bucket                                     |
| `STORAGE_SECRET_ACCESS_KEY` | With images or videos | Secret key for the bucket                                    |
| `STORAGE_FORCE_PATH_STYLE` | No          | `true` for MinIO. Leave empty for R2, OSS and S3              |

The server checks these variables when it starts (`src/server/env.ts`, run from `src/instrumentation.ts`). If any is missing or malformed, the log lists every problem as `- NAME: reason` (never the value), and every request returns 500 until you fix them and restart. Empty values count as unset. The check also enforces the pairs:

- Both Google variables or neither.
- The keys of the chosen `PAYMENT_PROVIDER`. Waffo needs `WAFFO_PRODUCT_ID`, or both subscription variables, or all three.
- Both `WAFFO_SUBSCRIPTION_PRODUCT_ID` and `WAFFO_STORE_ID`, or neither.
- `WAFFO_SUBSCRIPTION_PRODUCT_ID` with `WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID`.
- The three storage keys when `DASHSCOPE_API_KEY`, `VIDEO_PROVIDER` or any of them is set.
- The key of the chosen `VIDEO_PROVIDER`.
- `SEEAPI_API_KEY` with `IMAGE_MODERATION=seeapi`.
- `WAFFO_MERCHANT_ID` and `WAFFO_PRIVATE_KEY` with `PROMPT_MODERATION=waffo`.

In production it also requires:

- `RESEND_API_KEY`, and `EMAIL_FROM` with it, unless `EMAIL_OUTBOX_DIR` is set.
- `CRON_SECRET` with `DASHSCOPE_API_KEY` or `VIDEO_PROVIDER`, and with yearly plans on sale: `PAYMENT_PROVIDER=stripe`, or `waffo` with `WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID`.
- On a public URL (not localhost): `https://`, and no `AI_MOCK` or `EMAIL_OUTBOX_DIR`.

## Database

All worktrees share one Compose project (`starter`) and one database volume.

| Task                     | Command                                          |
| ------------------------ | ------------------------------------------------ |
| Start / stop             | `docker compose up -d --wait` / `docker compose stop`. Also starts MinIO on port 9000 (console on 9001, `starter` / `starter-secret`). Change the ports with `STORAGE_PORT` and `STORAGE_CONSOLE_PORT` |
| Open `psql`              | `docker compose exec db psql -U starter starter` |
| Browse data              | `pnpm db:studio`                                 |
| Apply migrations         | `pnpm db:migrate`                                |
| Reset (deletes all data) | `docker compose down -v`, then start and migrate |

### Change the schema

1. Edit the module's `src/server/<module>/schema.ts`. For auth tables, run `pnpm auth:generate` instead.
2. Make sure `src/server/db/schema.ts` re-exports the module's schema.
3. Run `pnpm db:generate --name <change>` and review the SQL in `drizzle/`.
4. Run `pnpm db:migrate`.
5. Commit the schema, the SQL file and `drizzle/meta/` together.

Never run `drizzle-kit push`. Never edit a migration that has been applied anywhere; add a new one.

## Email (Resend)

- Locally, leave `RESEND_API_KEY` empty. Emails (magic links, billing emails, finished-video emails) print to the `pnpm dev` console as `email.not_sent` log events ([Logs](#logs)).
- For production:
  1. Verify the sending domain in Resend.
  2. Create an API key with sending access.
  3. Set `RESEND_API_KEY` and `EMAIL_FROM` (for example `starter <hello@your-domain.com>`).
  4. Set `BETTER_AUTH_URL` to the public URL.

## Google sign-in

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Add the authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-domain>/api/auth/callback/google`
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. Restart the app.

## Bot protection (Turnstile)

Every new account gets the signup credits, so a script could sign up in bulk and spend them. Cloudflare Turnstile makes each magic-link request pass a challenge first. Google sign-in has no challenge: each account needs a Google account.

1. In the Cloudflare dashboard, open **Turnstile** and add a widget. Add your domain (and `localhost` to try it locally). Choose **Managed** mode.
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the site key and `TURNSTILE_SECRET_KEY` to the secret key.
3. Rebuild and restart the app. The site key is read at build time.

The sign-in form then shows the challenge, and the send button waits for it. The server rejects a magic-link request without a valid token (`POST /api/auth/sign-in/magic-link` answers 400). A token works once; after a failed send, the form runs the challenge again.

If visitors still sign up in bulk (watch new users in `/admin/metrics`), set `signupCredits` in `src/server/credits/config.ts` to 0.

## Feedback

Signed-in users submit feedback from the fixed bottom-right link in the signed-in layout at `/feedback`. Apply the committed migrations with `pnpm db:migrate` before deploying this feature. Users can select image files or paste images into the feedback box. They can send text, images, or both: up to 2,000 characters and three JPEG, PNG or WebP files totaling 4 MB, at most five requests per minute. Retries of the same submission create one record.

Set `ADMIN_EMAILS` to allow administrators to read `/admin/feedback`. The list includes account names, emails, full messages and timestamps, 20 per page. Configure `STORAGE_*` for image uploads; locally, `docker compose up -d --wait storage` starts MinIO. Without storage, text submissions still work. The list shows image thumbnails and full-size links. Deleting an account also deletes its feedback and stored attachments.

## Credits

Every new user gets `signupCredits` (30) credits once, when the account is created (`src/server/credits/config.ts`). Set it to `0` to turn the grant off. Images, videos and chat messages spend credits; packs and subscriptions add them.

## Payments

Users buy credit packs and subscribe on `/billing`. Packs live in `src/server/payment/packs.ts`, plans in `src/server/payment/plans.ts` (amounts in cents). `/pricing` lists the packs, then the plans, with what credits buy; its buttons open `/billing?pack=<id>` or `/billing?plan=<id>`, which signs visitors in first and focuses the chosen offer. Set `PAYMENT_PROVIDER` to switch providers, then restart. Orders and subscriptions from the old provider keep working while its webhook stays configured.

- Each plan bills monthly or yearly (`interval`). `credits` is per month either way; `amount` is per billing period. With both, `/pricing` and `/billing` show a Monthly / Yearly toggle.
- A yearly plan grants the first month with the charge. The sweep grants each later month as it begins, so yearly plans need `CRON_SECRET` and a schedule ([Pending sweep](#pending-sweep)). A past-due or ended subscription gets no more months; a canceling one keeps the months it paid for.
- A subscription checkout closes after 31 minutes (`CHECKOUT_MINUTES` in `src/server/payment/subscriptions.ts`). Until then, or until Stripe reports it expired, starting another answers `409 CHECKOUT_PENDING`, so two checkouts can't both be paid.
- Subscribers switch plans by canceling and subscribing again. They cancel and change cards in the provider's portal ("Manage subscription"). While a subscription is live, account deletion asks them to cancel first.
- Refund in the provider's dashboard. The webhook takes back the refunded share of the credits that charge bought, up to the user's balance; a lost chargeback counts as a refund. Credits already spent stay spent (`payment.refund_shortfall`). A refund doesn't cancel a subscription, and a yearly plan keeps getting months until it ends, so cancel it in the provider too. A won chargeback gives nothing back; add credits on `/admin/users/<id>`.
- The app notifies and emails the subscriber when a charge fails (once per billing period) and when a live subscription ends, with a link to `/billing`. Receipts come from the provider. A failed send logs `payment.email_failed`; the webhook still succeeds.

### Stripe

1. In the Stripe Dashboard, copy the secret key into `STRIPE_SECRET_KEY`.
2. Add a webhook endpoint `https://<your-domain>/api/webhooks/payment/stripe` with the events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `invoice.paid`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded` and `charge.dispute.funds_withdrawn`.
3. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Under Settings → Billing → Customer portal, save the portal settings once and allow cancellation. "Manage subscription" fails until you do.
5. Set `PAYMENT_PROVIDER=stripe`.

Locally, forward webhooks with the Stripe CLI and use the secret it prints:

```sh
stripe listen --forward-to localhost:3000/api/webhooks/payment/stripe
```

### Waffo Pancake

Waffo Pancake is a merchant of record: it charges tax and handles invoices. It requires an `https://` return URL, so locally open the app through an HTTPS tunnel and set `BETTER_AUTH_URL` to the tunnel URL.

1. In the Waffo dashboard, create a one-time product (for example "Credits"). Checkout overrides its price per pack. Copy its ID into `WAFFO_PRODUCT_ID`.
2. Under Settings → Developers, copy the merchant ID and API private key into `WAFFO_MERCHANT_ID` and `WAFFO_PRIVATE_KEY`.
3. For subscriptions, create a monthly subscription product (for example "Pro"). Copy its ID into `WAFFO_SUBSCRIPTION_PRODUCT_ID`, and the store ID into `WAFFO_STORE_ID`. Without them, packs still work and subscribing is off.
4. For yearly plans, create a second subscription product with a yearly billing period (for example "Pro yearly"). Copy its ID into `WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID`. Without it, the yearly plans are hidden. Waffo bills the period the product sets, so each product needs its own.
5. Add a webhook endpoint `https://<your-domain>/api/webhooks/payment/waffo` for `order.completed`, the `subscription.*` events and `refund.succeeded`.
6. Set `WAFFO_ENVIRONMENT` to `test` or `prod` to match the keys, and `PAYMENT_PROVIDER=waffo`.

Waffo sends no event when a checkout is abandoned, so those orders stay "Pending".

## AI chat (DeepSeek)

Signed-in users chat on `/chat`. Each message costs `CHAT_CREDIT_COST` (1) credit (`src/server/ai/chat.ts`); a failed reply refunds it.

1. In the [DeepSeek platform](https://platform.deepseek.com/api_keys), create an API key. Copy it into `DEEPSEEK_API_KEY`.
2. Optional: set `DEEPSEEK_MODEL` to another model ID. The default is `deepseek-flash`.
3. Restart the app.

Without a key, `/chat` says chat is off and `POST /api/chat` returns `503 CHAT_DISABLED`. Chats are deleted with the account.

## Image generation (Bailian)

Signed-in users generate images on `/images`. Each image costs `imageCost` credits (`src/server/images/config.ts`); a failed generation refunds them.

1. In the [Model Studio console](https://bailian.console.aliyun.com/), create an API key in the Beijing region. Copy it into `DASHSCOPE_API_KEY`.
2. For another region, set `DASHSCOPE_BASE_URL` to that region's host. Keys and hosts from different regions don't mix.
3. Set the `STORAGE_*` variables. Locally, copy them from `.env.example`; they match the MinIO in `compose.yaml`.
4. Restart the app.

For production storage, create a private bucket and an access key limited to it:

- Cloudflare R2: `STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `STORAGE_REGION=auto`.
- Alibaba Cloud OSS: `STORAGE_ENDPOINT=https://oss-cn-beijing.aliyuncs.com`, `STORAGE_REGION=cn-beijing`.

Leave `STORAGE_FORCE_PATH_STYLE` empty for both. Deleting an account deletes its `image` rows and its files under `images/<userId>/`. If storage fails then, the server logs `[storage] couldn't delete the files of deleted user <id>`; delete that folder by hand.

## Video generation (fal, SeeAPI or Bailian)

Signed-in users turn an image into a 5- or 10-second video on `/videos`. `VIDEO_PROVIDER` picks the provider. Credits per second depend on the provider and resolution (`VIDEO_RESOLUTIONS` in `src/server/videos/config.ts`); a failed generation refunds them. fal and SeeAPI generate silent video, which lowers the price. Bailian Wan 2.7 always adds audio.

| Provider | Model          | Resolutions (credits per second) |
| -------- | -------------- | -------------------------------- |
| `fal`    | Kling 2.6 Pro  | 1080p (4)                        |
| `seeapi` | Seedance 2.0   | 480p (4), 720p (8), 1080p (20)   |
| `dashscope` | Bailian Wan 2.7 | 720p (5), 1080p (8)          |

1. Create the provider's key:
   - fal: in the [fal dashboard](https://fal.ai/dashboard/keys). Copy it into `FAL_KEY`.
   - SeeAPI: in [SeeAPI → Keys](https://www.seeapi.com/keys/?tab=api-keys). Copy it into `SEEAPI_API_KEY`.
   - Bailian: set `DASHSCOPE_API_KEY` and, outside Beijing, `DASHSCOPE_BASE_URL`, as for [image generation](#image-generation-bailian). The model must be available in the key's region.
2. Set `VIDEO_PROVIDER` (`fal`, `seeapi` or `dashscope`) and the `STORAGE_*` variables.
3. Restart the app.

- Each provider accepts start images of certain pixel sizes (`VIDEO_IMAGE_LIMITS` in `src/server/videos/config.ts`): fal 300 to 8,000 a side, up to 2.5:1; SeeAPI 301 to 5,999, up to 2.5:1; Bailian 240 to 8,000, up to 8:1. Others are refused with 400 `INVALID_IMAGE_SIZE` before credits are spent. fal doesn't publish Kling's limits; these are Kling's own.
- `VIDEO_COST_PER_SECOND` holds what each provider charges. The Bailian prices follow resellers' prices; check the Bailian console and adjust them.
- `src/server/payment/margins.test.ts` fails if any pack or plan sells a second of video for less than 1.5 times that cost. When you change a price, a pack or a plan, run `pnpm test` and raise the credits per second if it fails.
- SeeAPI downloads the start image from a signed bucket URL, so it can't reach the local MinIO. Test it with a real bucket such as R2 or OSS. fal and Bailian get the image in the request and work with MinIO.
- Switching `VIDEO_PROVIDER` affects new videos only. Keep the old key until its pending videos finish.
- Videos finish while the page polls, so no public URL or webhook is needed. A video the sweep settles instead (the page was closed) also emails its owner, once: "ready" with a link to `/videos/<id>`, or "couldn't be made" with the refunded credits. A video the page collects sends no email. Emails are in English, like the billing emails. A failed send logs `video.email_failed`; the sweep goes on.
- Deleting an account deletes its `video` rows and its files under `videos/<userId>/`, start images included. A storage failure is logged as for images.

### Rap duo (Bailian Wan 3.0)

`/videos/rap` turns two photos and two names into a 15-second 720p rap video with sound: the left person raps one line, then the right person raps the next. It costs `RAP_CREDITS` (75) and is refunded on failure, like any video.

1. Set `DASHSCOPE_API_KEY` (and `DASHSCOPE_BASE_URL` outside Beijing) and the `STORAGE_*` variables. `VIDEO_PROVIDER` doesn't matter: the rap duo always uses Bailian `wan3.0-video`.
2. Optional: set `DEEPSEEK_API_KEY`. DeepSeek then writes two lines from the names, in the page's language. Without it, or if its reply is unusable or blocked, fixed lines name both people.
3. Restart the app.

- Each photo is at most 2 MB, so both fit under Vercel's 4.5 MB body cap, and 240 to 8,000 pixels a side (`RAP_IMAGE_LIMITS`). Wan 3.0 fails smaller photos (`InvalidParameter … resolution must be at least 240x240`), so the form and the server turn them away first.
- The price in `src/server/videos/config.ts` assumes about $0.10 a second. Check the Bailian console and adjust it.
- The prompt template is `rapPrompt` in `src/server/videos/rap.ts`. Wan 3.0 calls the photos 图1 and 图2.

### Zombie couple (Bailian Wan 3.0)

`/videos/zombie` turns two photos into a 15-second 720p vertical (9:16) video with sound, after the "zombie love story" trend: the survivor (first photo) finds their partner (second photo) turned zombie, drops the bat and hugs them, then it cuts to a happy memory. It needs the same setup as the [rap duo](#rap-duo-bailian-wan-30), without DeepSeek, and costs `ZOMBIE_CREDITS` (75, the rap duo's price).

- Photo limits are the rap duo's.
- The prompt template is `zombiePrompt` in `src/server/videos/zombie.ts`. It asks for film-makeup zombies with no blood or gore, so Bailian's moderation lets it through.
- Keep it `RAP_DURATION` long: the upload cleanup finds the second photo of a two-photo video by that length.

## API keys

Users call the image and video routes from scripts with an API key, and pay with their own credits as in the browser. They create, list and revoke keys on `/api-keys` (Account in the sidebar): a name, and an expiry of 30 days, 90 days (the default), 1 year or never. Scripts can also use Better Auth's endpoints (`POST /api/auth/api-key/create` with `{ name, expiresIn }` in seconds, or `null` for no expiry; `GET /api/auth/api-key/list`; `POST /api/auth/api-key/delete` with `{ keyId }`), signed in. The key (`sk_...`) is returned once; the database keeps a hash.

Send it in `x-api-key`. Only these routes accept it:

| Route | Does |
| ----- | ---- |
| `POST /api/images` | Queues an image: `{ prompt, aspect }` |
| `GET /api/images/<id>` | The image, `pending` until done |
| `GET /api/images/<id>/download` | 302 to the PNG |
| `POST /api/videos` | Queues a video: multipart `prompt`, `duration`, `resolution`, `image` |
| `GET /api/videos/<id>` | The video, `pending` until done |
| `GET /api/videos/<id>/download` | 302 to the MP4 |

```sh
curl -s -X POST "$APP/api/images" -H "x-api-key: $KEY" -H "content-type: application/json" \
  -d '{"prompt":"A flower shop with wooden windows","aspect":"1:1"}'
curl -s "$APP/api/images/<id>" -H "x-api-key: $KEY"           # repeat until "status" isn't "pending"
curl -sL "$APP/api/images/<id>/download" -H "x-api-key: $KEY" -o image.png
```

- Another route answers `403 API_KEY_NOT_ALLOWED`; an unknown, expired or revoked key `401 INVALID_API_KEY`.
- Each key allows 60 requests a minute (`429 RATE_LIMITED` with `Retry-After`), and the user's own limits apply on top.
- A user has at most 10 keys. Keys go with the account.
- Requests with a key skip the `Origin` check: they carry no cookie, so another site can't forge them.

## Content moderation

Image and video prompts are checked against a blocklist before they spend credits or reach a provider (`src/server/moderation/`). A match returns 422 `CONTENT_BLOCKED`, the form says the prompt was blocked, and the server logs `image.blocked` or `video.blocked` with the user ID and the term.

- Matching ignores case, full-width letters, extra spaces and zero-width characters. Latin terms match whole words (`csam` doesn't block `csamplitude`); Chinese terms match anywhere.
- The template's list covers only content that is illegal everywhere. Add the terms your content policy forbids to `BLOCKED_TERMS` in `src/server/moderation/blocklist.ts`, in every language your users write in, then deploy.
- With `IMAGE_MODERATION=seeapi`, each video start image (and both photos of a rap duo, before the lines are written, or a zombie couple) is stored, then checked with SeeAPI's [NSFW filter](https://www.seeapi.com/docs/nsfw-filter/image-moderation) before it spends credits. SeeAPI downloads it from a signed URL, so the bucket must be reachable from the internet (not the local MinIO). The check takes a few seconds and costs 0.01 SeeAPI credits.
  - A flagged image returns 422 `CONTENT_BLOCKED` and logs `video.blocked` with the labels.
  - No verdict within 30 seconds, or an error from SeeAPI, returns 503 `MODERATION_UNAVAILABLE` and logs `video.moderation_failed`. The upload is refused (fail closed); nothing is spent.
  - Either way the stored image is deleted.
- Without `IMAGE_MODERATION`, start images aren't checked. The providers' own moderation still blocks what they refuse at submission: Bailian for image prompts, fal and Bailian for videos (also 422 `CONTENT_BLOCKED`, with a refund). The app maps no SeeAPI refusal to `CONTENT_BLOCKED`, so turn `IMAGE_MODERATION` on with `VIDEO_PROVIDER=seeapi`.

### Waffo prompt screening

Set `PROMPT_MODERATION=waffo` and the existing `WAFFO_MERCHANT_ID` and `WAFFO_PRIVATE_KEY` signing credentials, then restart. This setting is independent of `PAYMENT_PROVIDER`. An empty value disables the remote check; the local blocklist still applies. Set it explicitly in production to enable this protection.

Text-to-image and image-to-video prompts pass the local blocklist and then Waffo's [Scan Prompt API](https://docs.waffo.ai/api-reference/endpoints/content-safety/scan-prompt), with `semantic: enforce`, before uploads, job creation or credit spending. Only `allow` continues. `block` returns 422 `CONTENT_BLOCKED`. `review`, an invalid reply, a non-2xx response, missing credentials or a 15-second timeout returns 503 `MODERATION_UNAVAILABLE`, without spending credits. The form retains the input for a manual retry; there is no queued generation or background retry.

A 429 response forwards Waffo's numeric `Retry-After` delay. Other failures use 60 seconds; a `review` verdict uses 3600 seconds. API callers must wait for that delay before resubmitting. Screening errors do not log the prompt or the provider response body. Rap duo names and AI chat keep their existing checks; this switch covers the two free-text generation forms only. No database migration is needed.

## Pending sweep

A crash during generation leaves an image or video `pending` with its credits spent, and an image or video finishes only while someone polls it. `POST /api/cron/sweep` settles them:

For images and for videos each:

- Never submitted after 15 minutes: fail and refund.
- Submitted more than 15 minutes ago: collect from the provider, 20 per run, least recently checked first (`checked_at`; never checked first), 4 at a time.
- Not finished after a day: fail and refund.

Each run fails at most 100 images and 100 videos, oldest first. A refund reuses the request's own idempotency key, so nothing is refunded twice.

Each run also grants yearly plans every month that has begun in the current period and wasn't granted yet ([Payments](#payments)), keyed `subscription:<id>:<period end>:m<month>`. A yearly subscription still without a period end a day after it started logs `subscription.no_period_end`.

Each run also deletes uploaded photos (video start images and both photos of a rap duo or zombie couple) more than a day old (`UPLOAD_RETENTION_MS` in `src/server/videos/config.ts`), 100 videos per run, oldest first, and clears the video's `image_key`. The video and its MP4 stay; the library shows it without a poster. An upload that can't be deleted logs `video.upload_not_deleted` and is retried next run. The privacy policy states this period: change both together.

Images, videos, yearly grants and uploads run independently. If one throws, the others finish and stay committed; the sweep logs `cron.task_failed` and returns 500. Check the error and retry; the idempotency keys make retries safe.

1. Generate a secret with `openssl rand -base64 32`. Set it as `CRON_SECRET`, then restart.
2. Schedule a call every 10 minutes. On Vercel Pro, `vercel.json` already does this ([Deploy to Vercel](#deploy-to-vercel)). Elsewhere, call `curl -X POST -H "Authorization: Bearer $CRON_SECRET" <BETTER_AUTH_URL>/api/cron/sweep` from any scheduler, such as a Cloudflare Cron Trigger.

Without `CRON_SECRET`, the route answers 404 to everyone.

## Landing page and visual system

- Copy lives under `Home` in `messages/en.json` and `messages/zh.json`. Replace it with what your product does; keep sentence case.
- `src/components/home/scene.tsx` draws the hero console's and the prompt ideas' images with CSS. Replace them with real work made with the product (`next/image`, explicit `width` and `height`).
- Colors, radius and fonts are tokens in `src/app/globals.css` (`:root` for the light theme, `.dark` for the default dark theme, `--font-display` for headings). Change them there, not per component.
- Dark is the default theme. Users pick light, dark or system (follows the OS, live) in the footer or the account menu; the choice is saved in `localStorage`. The logic is in `src/components/layout/theme.ts`.
- Icons come from `lucide-react` only; ESLint blocks other icon libraries. Stroke width is set once in `globals.css` (`svg.lucide`). Icons are `aria-hidden` by default; give icon-only buttons an `aria-label`.
- Icon motion uses `.icon-nudge` (arrow on hover), `.icon-turn` (plus in an open `<details>`) and `.icon-swap` (cross-fade). All turn off with reduced motion.

## Blog

Posts are MDX files in `content/blog/<locale>/<slug>.mdx`; the file name is the URL (`/en/blog/<slug>`). Each language has its own posts. Give two translations the same file name, so they share a URL.

1. Add the file. Use lowercase letters, digits and hyphens for the slug.
2. Start it with its metadata:

   ```mdx
   export const metadata = {
     title: "Writing a post",
     description: "One sentence for the list and search results.",
     date: "2026-10-12",
     tags: ["guides"], // optional
   };
   ```

3. Write the body in Markdown. Start headings at `##`; the title is the page's `#`.

- `/blog` lists posts newest first. A missing title, description or `YYYY-MM-DD` date fails the build, and so does a post called `tags`.
- Posts appear in the sitemap and `/llms.txt`. Each post's page names its canonical URL, links only the translations that exist, carries schema.org `BlogPosting` JSON-LD (`blogPosting` in `src/lib/seo.ts`) and has its own preview image.
- Tags are optional words in the post's language, such as `guides` or `公告`, without `/` or `%`. Each links to `/blog/tags/<tag>`, which lists the locale's posts with it and stays out of the sitemap.

## IndexNow

[IndexNow](https://www.indexnow.org) tells Bing, Yandex, Naver, Seznam and Yep which URLs changed, so they crawl them sooner. Google doesn't use it; submit the sitemap in Google Search Console instead.

1. Generate a key with `openssl rand -hex 16`. Set it as `INDEXNOW_KEY` in Production, next to `CRON_SECRET`.
2. Deploy. Check that `<BETTER_AUTH_URL>/indexnow.txt` shows the key.
3. After each deploy that adds or changes public pages, run `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" <BETTER_AUTH_URL>/api/indexnow`.

The route sends every sitemap URL (`src/app/sitemap.ts`) and answers `{ "submitted": <count>, "status": <engine status> }`: 200 when the engines accept, 502 when they refuse. A 403 status means the engines couldn't fetch the key at `/indexnow.txt`. Without `INDEXNOW_KEY` or `CRON_SECRET`, both routes answer 404.

## Languages

The app ships in English (`en`) and Chinese (`zh`). Language menus list every locale, so adding one needs no UI change. To add a locale, for example `ja`:

1. Add `"ja"` to `locales` in `src/i18n/routing.ts`, and its own name (`ja: "日本語"`) to `LOCALE_NAMES` there.
2. Copy `messages/en.json` to `messages/ja.json` and translate it. Keep the same keys.
3. Add `content/legal/ja/{privacy,terms,refund}.mdx`. Blog posts in `content/blog/ja/` are optional; without them `/ja/blog` says there are no posts yet.
4. Optional: map it to a Waffo cashier language in `src/server/payment/providers/waffo.ts`. Unmapped locales get the English cashier.

## Project settings and legal pages

- Change the project name or support email in `project.config.ts`. The header, footer, home page, legal pages and sign-in email read it. The browser tab title and description are `Metadata` in every `messages/*.json`; change them too. The preview image a shared link shows (Open Graph, 1200×630) uses both; change its layout in `src/app/_lib/og-image.tsx`.
- Set `ADMIN_EMAILS` (comma-separated), then restart. Admins see "Admin" in the sidebar; everyone else gets the 404 page on every admin page. E2E sets its own admin (`ADMIN_EMAIL` in `playwright.config.ts`).
  - `/admin` opens `/admin/users`: 50 users per page, newest first, searched by part of an email or name. An email opens `/admin/users/<id>`: profile, balance, subscription and credit history. On both, a row's + button adds 1 to 1,000,000 credits; the user sees "Added by an admin" on `/billing`, and the log records the admin.
  - `/admin/notifications` sends a notification (title up to 100 characters, message up to 1,000) to every user or to one email.
  - `/admin/orders` lists credit-pack orders, 50 per page, newest first, filtered by status and provider. Search matches part of the buyer's email, or an order or provider session ID exactly. It is read-only and lists no subscriptions.
  - `/admin/metrics` covers 24 hours, 7 days (default) or 30 days: new users; credits spent, refunded and bought; paid pack orders with revenue per currency. For images and videos: jobs by status, success rate (pending left out), median and p95 time to stored file of successes, and the 5 most common failure reasons. Jobs and credits count by creation time, orders by payment time.
- Legal texts are templates in `content/legal/<locale>/{privacy,terms,refund}.mdx`. Have a lawyer review them, then edit both locales and the "Last updated" line. Search results show each page's one-line summary, `Legal.descriptions.<doc>` in every `messages/*.json`; keep it true to the text.
- Inside the MDX, use `<ProjectName />` and `<SupportEmail />` instead of typing the values.
- To add a legal page:
  1. Add `content/legal/en/<doc>.mdx` and `content/legal/zh/<doc>.mdx`.
  2. Add `<doc>` to `LEGAL_DOCS` in `src/lib/content.ts`.
  3. Add its title under `Legal`, and a one-line summary under `Legal.descriptions`, in every `messages/*.json`.
  4. Add `src/app/[locale]/(marketing)/(legal)/<doc>/page.tsx`, copying an existing one.
  5. Add a Lucide icon for it to `ICONS` in `src/components/legal/legal-nav.tsx` (typecheck fails until you do).

  The sitemap and `/llms.txt` pick it up from `LEGAL_DOCS`. For any other public page, add its path to `PAGES` in `src/app/sitemap.ts` and a link in `src/app/llms.txt/route.ts`. `/llms.txt` reads the landing page's copy from `Home`, so replacing that copy updates it too.

## Translations

- Put every UI string in `messages/en.json` and `messages/zh.json` under the same key. `pnpm test` (`src/i18n/messages.test.ts`) checks every locale in `src/i18n/routing.ts`: it fails if a locale's file is missing, if its keys differ from `en.json`, or if any message, at any depth, is empty.
- Read strings with `useTranslations("<Namespace>")` (or `getTranslations` in `generateMetadata`).
- The browser gets only the namespaces in `CLIENT_NAMESPACES` (`src/i18n/client-messages.ts`). When a client component (a `"use client"` file, or a file one imports) reads a new namespace, add it there. `pnpm test` (`src/i18n/client-messages.test.ts`) fails until you do, and requires a string literal as the namespace.
- To add a language, follow [Languages](#languages).

## Logs

The server writes one line per event to stdout, and warnings and errors to stderr. In production each line is a JSON object with `time`, `level`, `event` and the event's fields, so a log drain can filter by field. Outside production the line reads `LEVEL event key=value`, with an error's stack below it. Set `LOG_FORMAT` and `LOG_LEVEL` to change this ([Environment variables](#environment-variables)).

| Event | Level | Fields |
| ----- | ----- | ------ |
| `image.submitted`, `video.submitted` | info | `id`, `userId`, `credits` |
| `image.succeeded`, `video.succeeded` | info | `id`, `userId`, `ms` (from the request to the stored file) |
| `video.rap_lyrics_failed`, `video.rap_lyrics_unusable` | warn | `error`, or the model's `reply`. The rap duo used the fixed lines |
| `image.failed`, `video.failed` | warn | `id`, `userId`, `credits` (refunded), `error` |
| `video.moderation_failed` | error | `userId`, `error`. SeeAPI's image check gave no verdict; the upload got 503 |
| `video.image_not_deleted` | error | `key`, `error`. An uploaded image that failed the check or couldn't be paid for stays in the bucket |
| `image.submit_failed`, `video.submit_failed`, `image.refresh_failed`, `video.refresh_failed`, `image.sweep_refresh_failed`, `video.sweep_refresh_failed` | error | `id` or `userId`, `error` |
| `credits.changed` | info | `userId`, `delta`, `reason`, `balance` |
| `chat.failed` | error | `userId`, `chatId`, `error` |
| `payment.checkout_failed`, `payment.subscribe_failed`, `payment.portal_failed` | error | `userId`, `error` |
| `video.email_failed` | error | `userId`, `error`. The notification is stored; only the email is lost |
| `payment.email_failed` | error | `userId`, `email` (`past_due` or `ended`), `error`. The notification is stored; only the email is lost |
| `payment.refund_unmatched` | warn | `provider`, `refundId`, `orderId` or `subscriptionId`. The refund names no paid order or subscription of this provider; nothing changes |
| `payment.refund_shortfall` | error | `provider`, `userId`, `orderId` or `subscriptionId`, `owed`, `taken`. The user had spent the rest of the refunded credits |
| `payment.unknown_order` | error | `provider`, `error` (names the order ID). The webhook answers 409, so the provider retries |
| `admin.credits_added`, `admin.broadcast_sent` | info | `admin` (email) and what changed |
| `cron.sweep` | info | the counts the route returns |
| `video.upload_not_deleted` | error | `id`, `error`. The sweep couldn't delete an upload past its retention; it keeps the key and retries next run |
| `cron.task_failed` | error | `task` (`images`, `videos`, `subscriptionMonths` or `uploads`), `error`. Other sweep tasks still finish; the route returns 500 |
| `notification.not_stored`, `storage.user_files_not_deleted` | error | `userId`, `error` |
| `email.not_sent` | info | `to`, `subject`, `text`. Only without `RESEND_API_KEY`; the text holds the magic link |

The startup check of the environment throws instead of logging, so its message is plain text.

## Deploy to Vercel

The production setup: Vercel runs the app and the sweep, Neon hosts Postgres and Cloudflare R2 stores the generated files.

> **Warning:** use the Vercel **Pro** plan. `vercel.json` runs the sweep every 10 minutes, and on Hobby any cron job that runs more than once a day fails the deployment. Hobby is also for non-commercial use only. To try the app on Hobby, delete `crons` from `vercel.json` and call the sweep from an external scheduler ([Pending sweep](#pending-sweep)).

### 1. Database (Neon)

1. Create a Neon project in the region closest to your Vercel functions.
2. Copy two connection strings from **Connect**: the pooled one (host contains `-pooler`) and the direct one. In both, change `sslmode=require` to `sslmode=verify-full`. `pg` 8 already treats `require` as `verify-full` and warns about it; `pg` 9 will make `require` skip the certificate check. Neon's certificates come from a public CA, so Node.js verifies them without extra setup.
3. Apply the migrations from your machine with the direct string:

   ```sh
   DATABASE_URL='<direct connection string>' pnpm db:migrate
   ```

4. Use the pooled string as `DATABASE_URL` in Vercel. Each serverless instance opens its own connections; the pooler keeps them under Neon's limit.

Run step 3 again before you deploy a change that adds a migration.

### 2. Storage (Cloudflare R2)

1. In Cloudflare, create a private R2 bucket. Keep public access off: the app serves files through signed URLs.
2. Create an R2 API token with **Object Read & Write** on that bucket.
3. Set `STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID` and `STORAGE_SECRET_ACCESS_KEY`. Leave `STORAGE_REGION` (default `auto`) and `STORAGE_FORCE_PATH_STYLE` empty.

The bucket needs no CORS rules: the server uploads the files, and browsers only open signed URLs in `<img>`, `<video>` and download links.

### 3. Vercel project

1. Import the repository in Vercel. It detects Next.js; keep the default build settings.
2. Add the environment variables for Production ([Environment variables](#environment-variables)). At minimum: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY` and `EMAIL_FROM`. With images or videos, also `CRON_SECRET` and the `STORAGE_*` variables; with payments, `CRON_SECRET` too, for yearly plans.
3. Set `BETTER_AUTH_URL` to the production URL, such as `https://your-domain.com`. The build reads it too, so set it before the first deploy.
4. Deploy. The app checks the variables at startup and lists every problem in the function logs.
5. Add your domain under **Settings → Domains**. If it changes `BETTER_AUTH_URL`, update the variable and redeploy.

Vercel sends `Authorization: Bearer $CRON_SECRET` with each cron call, and `/api/cron/sweep` accepts it. Check the runs under **Settings → Cron Jobs → View Logs**. A missed or doubled run is safe: each run settles whatever is still pending, and every refund and grant has an idempotency key.

### 4. Connect the services

Point each service at the production URL:

- Resend: verify the sending domain ([Email (Resend)](#email-resend)).
- Google sign-in: add `https://<your-domain>/api/auth/callback/google` ([Google sign-in](#google-sign-in)).
- Payments: add the webhook endpoint for your provider ([Stripe](#stripe) or [Waffo Pancake](#waffo-pancake)).
- Admins: set `ADMIN_EMAILS`.

Redeploy after you change a variable; Vercel applies variables to new deployments only.

## Self-host with Docker

The `Dockerfile` builds a single image that runs the app with Node.js on any host: a VPS, Fly.io, Railway, Kubernetes. Bring your own Postgres (Neon works) and S3-compatible storage (R2 works, [Deploy to Vercel § Storage](#2-storage-cloudflare-r2)).

> **Warning:** run one instance. Next.js keeps its cache on the container's disk, so several instances can serve different versions of a cached page. Running more needs a shared cache handler ([Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting#multi-server-deployments)).

1. Build the image. The build bakes `BETTER_AUTH_URL` and the `NEXT_PUBLIC_*` variables into the pages, so pass them as build arguments and build again when one changes:

   ```sh
   docker build -t starter \
     --build-arg BETTER_AUTH_URL=https://your-domain.com \
     --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY= \
     --build-arg NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN= \
     --build-arg NEXT_PUBLIC_POSTHOG_HOST= \
     --build-arg NEXT_PUBLIC_SENTRY_DSN= \
     .
   ```

   The build downloads the Chinese font for the preview images from Google Fonts, so it needs network access.

2. Apply the migrations. The `migrate` target holds the migrations and `drizzle-kit`, applies them to `DATABASE_URL` and exits. Use the direct (not pooled) connection string:

   ```sh
   docker build --target migrate -t starter-migrate .
   docker run --rm -e DATABASE_URL='<direct connection string>' starter-migrate
   ```

   Run it again before you start an image that adds a migration.

3. Put the run-time variables in a file, such as `.env.production`. The minimum is the same as on Vercel ([3. Vercel project](#3-vercel-project)).

4. Start the container. It listens on port 3000 and reports its health from `/api/health`:

   ```sh
   docker run -d --name starter --restart unless-stopped -p 3000:3000 --env-file .env.production starter
   ```

5. Put a reverse proxy with TLS in front, such as Caddy or nginx. It must set `X-Forwarded-For`, or set `CLIENT_IP_HEADER` to the header it sets ([Environment variables](#environment-variables)). Sign-in rate limits read the client IP from it.

6. Schedule the sweep every 10 minutes from the host's crontab ([Pending sweep](#pending-sweep)):

   ```sh
   */10 * * * * curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" https://your-domain.com/api/cron/sweep > /dev/null
   ```

7. Point Resend, Google sign-in and your payment provider at the domain ([Deploy to Vercel § Connect the services](#4-connect-the-services)).

Vercel Web Analytics and Speed Insights work only on Vercel: leave `NEXT_PUBLIC_VERCEL_ANALYTICS` and `NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS` empty. The build sets `BUILD_STANDALONE`, which makes `next build` write `.next/standalone`; other builds leave it unset.

## Error tracking (Sentry)

Sentry groups errors and alerts you. With a DSN set, it reports errors thrown while rendering or handling a request (`onRequestError`), every `log.error` event with its fields, tagged with the event name ([Logs](#logs)), and uncaught browser errors and rejections. It sends no performance traces or session replays.

1. In Sentry, create a Next.js project. Copy its DSN into `NEXT_PUBLIC_SENTRY_DSN`.
2. Rebuild and restart the app. The browser reads the DSN at build time.
3. Optional, for readable stack traces: in Sentry, create an organization auth token (**Settings → Auth Tokens**). Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` where the app builds (on Vercel, as environment variables). The build then uploads source maps.

Without a DSN, the app never loads the Sentry SDK, on the server or in the browser.

## Analytics (Vercel Web Analytics)

Counts page views and visitors without cookies, so it needs no consent banner. It works only on Vercel and is off by default:

1. In the Vercel project, open **Analytics** and select **Enable**.
2. Set `NEXT_PUBLIC_VERCEL_ANALYTICS=1` for Production.
3. Redeploy. The flag is read at build time.

Pages then load `/_vercel/insights/script.js`. The app sends no custom events.

## Performance (Vercel Speed Insights)

Measures Core Web Vitals from real visits. It works only on Vercel and is off by default:

1. In the Vercel project, open **Speed Insights** and select **Enable**.
2. Set `NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS=1` for Production.
3. Redeploy. The flag is read at build time.

Pages then load `/_vercel/speed-insights/script.js`.

## Troubleshooting

| Symptom                                                   | Fix                                                                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Every page returns 500; the log says `Invalid environment` | Fix the listed variables in `.env` (or the host's settings), then restart. The reasons are in [Environment variables](#environment-variables) |
| `/api/health` returns 503 `database: unreachable`         | Run `docker compose up -d --wait`. Check `DATABASE_URL`                                        |
| `relation "user" does not exist`                          | Run `pnpm db:migrate`                                                                          |
| `DATABASE_URL is not set`                                 | Create `.env` from `.env.example`                                                              |
| `SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'` | In `DATABASE_URL`, change `sslmode=require` to `sslmode=verify-full`, then redeploy ([Database (Neon)](#1-database-neon)) |
| Port 3000, 5432, 9000 or 9001 in use                      | Find the process with `lsof -nP -iTCP:<port> -sTCP:LISTEN`. For Postgres, set `POSTGRES_PORT` and update `DATABASE_URL`. For MinIO, set `STORAGE_PORT` (and update `STORAGE_ENDPOINT`) or `STORAGE_CONSOLE_PORT` |
| Magic link opens `?error=INVALID_TOKEN`                   | Links work once and expire after 5 minutes. Request a new one                                  |
| Magic link points to the wrong host                       | Set `BETTER_AUTH_URL` to the URL you open the app on                                           |
| "Google sign-in isn't available" / `PROVIDER_NOT_FOUND`   | Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart                                 |
| Google shows `redirect_uri_mismatch`                      | Register `<BETTER_AUTH_URL>/api/auth/callback/google` in the OAuth client                      |
| "For your security, sign in again before deleting your account." (`SESSION_EXPIRED`) | Account deletion needs a session younger than 1 day (`session.freshAge`). Sign out and sign in again |
| `429 Too many requests` on sign-in for everyone at once | Better Auth rate-limits per client IP (counters in the `rate_limit` table) and reads the IP from `CLIENT_IP_HEADER` (default `x-forwarded-for`). Set it to the header your host fills with the client address, such as `cf-connecting-ip` on Cloudflare; otherwise all users share one bucket |
| Startup log lists `RESEND_API_KEY: required in production` | Set `RESEND_API_KEY` and `EMAIL_FROM`, then restart                                           |
| `Resend: ...` error                                       | Check the key and that `EMAIL_FROM` uses a verified domain                                     |
| `MISSING_MESSAGE` in the console, or a key shows instead of text | Add the key to every `messages/*.json` file. In the browser only: add the namespace to `CLIENT_NAMESPACES` in `src/i18n/client-messages.ts` |
| A link drops the locale (`/sign-in` instead of `/en/sign-in`) | Import `Link` / `useRouter` / `redirect` from `@/i18n/navigation`                                |
| An API call answers `403 FORBIDDEN_ORIGIN`                 | Requests that change data must carry `Origin` equal to `BETTER_AUTH_URL`'s origin. Browsers send it from the app's pages; set `BETTER_AUTH_URL` to the URL you open the app on. Scripts and tests must send the header themselves |
| A script's call answers `401 INVALID_API_KEY`             | The key is wrong, expired or revoked. Create a new one; the full key is shown only when it's created |
| A script's call answers `403 API_KEY_NOT_ALLOWED`         | API keys reach only the image and video routes ([API keys](#api-keys)) |
| An API call answers `429 RATE_LIMITED`                     | The user passed a per-user limit in `src/app/api/_lib/limits.ts`. Wait `Retry-After` seconds, or raise the limit |
| `/admin` shows "Page not found" for you                    | Add your sign-in email to `ADMIN_EMAILS` and restart. Matching ignores case                       |
| E2E fails broadly, even `/api/health`, or uses a stale or another worktree's server | Each worktree has its own port (3100-3899, from its path), and Playwright reuses a server already on it. Find it with `lsof -nP -iTCP:<port> -sTCP:LISTEN`, stop it, or set `E2E_PORT`. Also check `BETTER_AUTH_SECRET` is set in `.env` |
| `pnpm typecheck` can't find `LayoutProps`                 | Use `pnpm typecheck`, not bare `tsc`; it runs `next typegen` first                             |
| Playwright: `Executable doesn't exist`                    | Run `pnpm exec playwright install chromium`                                                    |
| "Chat is not set up yet." on `/chat`                     | Set `DEEPSEEK_API_KEY`, then restart                                                           |
| "Image generation isn't set up yet." on `/images`        | Set `DASHSCOPE_API_KEY` and the `STORAGE_*` variables, then restart                             |
| Images or videos fail; the log says `Bailian 401 InvalidApiKey` | The key is wrong or from another region. Match `DASHSCOPE_BASE_URL` to the key's region |
| "Video generation isn't set up yet." on `/videos`        | Set `VIDEO_PROVIDER`, its key and the `STORAGE_*` variables, then restart                       |
| Videos fail; the log says `fal 401` or `fal 403`        | The key is wrong or the fal account has no balance                                              |
| Videos fail; the log says `SeeAPI 401` or `SeeAPI 402`  | The key is wrong or the SeeAPI account has no credits                                           |
| SeeAPI videos fail right after submission with the local MinIO | SeeAPI can't download from `localhost`. Use a bucket reachable from the internet          |
| Images fail; the log shows an S3 error (`NoSuchBucket`, `AccessDenied`, `ECONNREFUSED`) | Run `docker compose up -d --wait` locally. Elsewhere, check the bucket name, the key's permissions and `STORAGE_ENDPOINT` |
| "Payments aren't set up yet." on `/billing`               | Set `PAYMENT_PROVIDER` and that provider's keys, then restart                                   |
| "Couldn't open subscription management"                  | Stripe: save the Customer portal settings in the Dashboard. Waffo: set `WAFFO_STORE_ID`        |
| "You already started a subscription checkout"             | Expected for 31 minutes after a checkout opens. Finish it, or wait until it closes          |
| Account deletion says to cancel the subscription first    | Expected while the subscription is active, canceling or past due. Cancel it under Manage subscription; deletion works once the provider reports it canceled |
| Paid, but credits don't appear                            | Check the provider's webhook log. `400 INVALID_SIGNATURE`: wrong `STRIPE_WEBHOOK_SECRET`, or `WAFFO_ENVIRONMENT` doesn't match the event. `409 UNKNOWN_ORDER` (log `payment.unknown_order`): a payment names an order this database never recorded, such as an event from another app on the same Stripe account, or a database restored from an older backup. The provider retries for days; find the order ID in the log |
| Waffo checkout fails right away                           | Waffo needs an `https://` return URL. Set `BETTER_AUTH_URL` to an HTTPS URL                    |
| `ERR_PNPM_IGNORED_BUILDS`                                 | Add the package to `allowBuilds` in `pnpm-workspace.yaml` (`false` unless it needs its script) |
| `AGENTS.md` changes after `pnpm dev`                      | `next dev` re-adds its agent rules block. Commit it                                            |


## PostHog

Set `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` in the deployment environment, then rebuild. Use the public project token, never a personal API key. Leave both empty in local development and previews to keep test traffic out of production reporting. To disable collection, clear both and redeploy.

All events carry `app=vibemovo`; filter by it in a shared PostHog project. The implementation uses the capture HTTP API without an additional SDK dependency.

| Event | Source and meaning |
| --- | --- |
| `$pageview` | Initial page and client pathname changes; query, hash, referrer and resource IDs are excluded |
| `signup_completed` | Better Auth creates a new account, including accounts without signup credits |
| `generation_started` | An image or video job and its credit debit have committed |
| `generation_succeeded` | The result has been stored and the job changed to succeeded |
| `generation_failed` | A pending job failed and its refund committed |
| `payment_succeeded` | Verified payment webhook fulfills a pack or a subscription charge |

Generation properties include `kind` and `credits`. Rap duo uses the video lifecycle. Payment properties include `payment_kind`, `provider`, `product_id`, `credits`, `catalogue_amount_minor`, `currency` and subscription `interval`. The catalogue amount is not net revenue or the actual tax-adjusted charge. Refunds are not revenue adjustments in PostHog.

Browser identifiers exist only in memory and reset on reload. Server events use a namespaced account ID. These streams are not linked into a visitor-to-signup funnel. No analytics cookies, browser storage, autocapture, person profiles or session replay are enabled. Prompts, files, names, emails, raw errors, payment credentials and provider payment IDs are excluded. GeoIP enrichment is disabled; the ingestion service still receives browser network requests.

Delivery is best effort, not a financial ledger. Server calls wait at most 1.5 seconds, log a generic failure and let the business operation succeed. Committed state transitions and unique notification records suppress repeated completion/payment events. A crash, failed notification insert or capture failure can lose an event; there is no durable retry queue. Use the payment database for accounting.

Verify with PostHog Activity filtered by `app=vibemovo`: visit a page, then follow a normal signup/generation/payment flow. For ingestion-only tests use a separate `analytics_connection_test` event with `is_test=true`; do not fabricate business success events. Unit and integration tests exercise capture failures, private route redaction, lifecycle transitions and repeated webhooks without production charges.
