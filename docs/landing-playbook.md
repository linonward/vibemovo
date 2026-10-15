# Landing Playbook

How to turn one search query into a page that ranks and converts. Use it for every new video effect. Code layout is in [`architecture.md`](architecture.md); the PR flow is in [`workflow.md`](workflow.md).

## Principles

1. **One query, one page.** Each effect gets its own landing page for one search query, a blog guide for the same query, and links from the rest of the site.
2. **Show only real results.** Every image and video on the page comes from a real generation. The copy describes what that result shows. If copy and result disagree, change the copy. Don't pair frames and a video from different results.
3. **Let visitors use the page.** The form sits in the hero. Visitors pick photos before they sign in. Sign-in happens in a dialog on the same page, and the job sends itself on return. No button leads away to `/sign-in`.
4. **The free credits buy one result.** `signupCredits` must cover the price of every landing page's video, so a new visitor sees a result before paying. A unit test enforces it (`src/server/credits/config.test.ts`).
5. **Measure before tuning.** Pageviews, business events, checkout conversion and model cost are tracked. Check `/admin/metrics` and PostHog after each change.
6. **Guard the spend.** Prompts are screened before credits are spent. When free credits rise, write down the cost per signup and how to spot mass signups.

## Checklist for a new effect

### Query and copy

- [ ] Pick one query. The page path is the query (`/ai-vampire-transformation-video`).
- [ ] Title: `<Query>: <benefit> | vibemovo`, 50–60 characters. Description: 120–155 characters. Chinese follows the same shape.
- [ ] One H1 that holds the query. The FAQ H2 names the query (`AI vampire transformation video questions`). Leave the other H2s natural.
- [ ] Copy in `messages/en.json` and `messages/zh.json`, under the effect's own namespace with the same keys as the other landings.

### Real result

- [ ] Generate a real result from photos of AI-generated people.
- [ ] Add `public/landing/<kind>/`: `frames.jpg` (four frames, 1440×640), `preview.jpg`, `sample.mp4` and `poster.jpg`.
- [ ] Compress the video: H.264 + AAC, `-movflags +faststart`, 540×960 (portrait) or 960×540 (landscape), under 2 MB:

  ```sh
  ffmpeg -i in.mp4 -vf scale=540:-2 -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p \
    -c:a aac -b:a 96k -movflags +faststart public/landing/<kind>/sample.mp4
  ffmpeg -ss 1.5 -i public/landing/<kind>/sample.mp4 -frames:v 1 -q:v 4 public/landing/<kind>/poster.jpg
  ```

- [ ] Compare `frames.jpg` with frames cut from `sample.mp4`. Write the caption, alt text and video label from what they show, with timings.

### Page

- [ ] Route `src/app/[locale]/(marketing)/<path>/page.tsx` and `opengraph-image.tsx`.
- [ ] Add the kind to `EffectLanding` (`src/components/landing/effect-landing.tsx`) and `LandingTryout`, so the hero holds the form.
- [ ] Unit tests: the H1, the form, the real video and frames, the cost, the FAQ heading, en and zh.
- [ ] E2E: the signed-out flow (pick photos, sign in in the dialog, the job starts on return) if the form differs from the existing ones.

### Links

- [ ] `src/app/sitemap.ts`, `src/app/llms.txt/route.ts` and the footer.
- [ ] The home page templates (`src/components/home/templates.tsx`).
- [ ] `EFFECTS` in `src/components/landing/more-effects.tsx` and its copy under `MoreEffects`, so every landing page links the new one.
- [ ] A blog guide for the same query in `content/blog/<locale>/`, linking to the landing page and back from its `guide` link.
- [ ] Two related guides in the page's `RELATED`, and the new guide in the `RELATED` of a related page.

### Check

- [ ] Open the production build on desktop and mobile. The video plays muted, the form works, and the layout holds.
- [ ] Check the heading outline: one H1, no skipped levels.
- [ ] After deploy, generate one real video from the live page with a new account.
- [ ] A week later, compare the page's visits, signups, generations and payments in PostHog.

## Production data

- Query first. List what a change will touch, including rows linked without a foreign key (`apikey.reference_id`).
- Get explicit approval, then run the change in one transaction and count the result.
- Test accounts (`user-<uuid>@example.com`) in production mean a test ran against the production database. Find that `DATABASE_URL` before deleting the rows.
