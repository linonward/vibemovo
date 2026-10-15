# starter

A minimal project template with a workflow for people and AI coding agents.

## Start a project from this template

1. Create the repository. Click **Use this template** on GitHub, or run:

   ```sh
   gh repo create my-app --template linonward/starter --private --clone
   cd my-app
   ```

   The new repository gets the files on `main`, without the history. CI needs no secrets, so it runs on the first push.

2. Install, configure and start it: [runbook § First-time setup](docs/runbook.md#first-time-setup).

3. Make it yours ([runbook § Project settings and legal pages](docs/runbook.md#project-settings-and-legal-pages)):
   - Name and support email in `project.config.ts`, and `name` in `package.json`.
   - Tab title, description and landing page copy: `Metadata` and `Home` in every `messages/*.json`.
   - Legal texts in `content/legal/`.
   - The worktree folder `../starter-<topic>` in `AGENTS.md` and `docs/workflow.md`.
   - `AGENTS.md` § Reply Style, which asks agents to answer in Chinese.

4. Deploy: [runbook § Deploy to Vercel](docs/runbook.md#deploy-to-vercel).

## Docs

- [`AGENTS.md`](AGENTS.md): rules and commands for AI agents (`CLAUDE.md` imports it)
- [`docs/workflow.md`](docs/workflow.md): slice → worktree → TDD → PR → squash merge
- [`docs/architecture.md`](docs/architecture.md): layers, import rules, routes, target structure
- [`docs/runbook.md`](docs/runbook.md): setup, environment, database, email, deploying to Vercel or with Docker, troubleshooting
- [`docs/DESIGN.md`](docs/DESIGN.md): visual design reference: color tokens, type, layout, components
- [`.github/pull_request_template.md`](.github/pull_request_template.md): PR template

## Stack

Next.js (App Router, TypeScript, `src/`), Tailwind CSS, shadcn/ui (Base UI), next-intl (en, zh), MDX, Better Auth (magic link, Google), Resend, Stripe or Waffo Pancake payments, AI chat with DeepSeek on Bailian through the Vercel AI SDK, PostgreSQL + Drizzle ORM (Docker Compose), Alibaba Cloud Model Studio (Bailian) image generation, image-to-video with fal (Kling), SeeAPI (Seedance) or Bailian (Wan), S3-compatible storage (MinIO locally), pnpm, Vitest, Playwright.

## Requirements

- Node.js 22.22.2+ or 24.15+ (CI uses 24), pnpm 12 (`packageManager` in `package.json`)
- Docker with Compose
- Git
- [GitHub CLI](https://cli.github.com/), logged in with `gh auth login`
