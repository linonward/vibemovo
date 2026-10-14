# AGENTS.md

Instructions for AI coding agents working in this repository.

## Rules

- Read the code before you change it. Match its style.
- Keep changes small and on-task. Don't touch unrelated code.
- Justify every new dependency in the PR.
- Never commit secrets or `.env` files.
- Put code where [`docs/architecture.md`](docs/architecture.md) says. Server logic goes in `src/server/<module>/` and imports only `src/server`. UI goes in `src/components/<area>/` and never imports `src/server` or `src/app`. ESLint enforces both.
- Change the database only through committed Drizzle migrations in `drizzle/`. Never use `drizzle-kit push` or edit applied migrations.
- Ask first if an ambiguity changes what you'd build.
- Keep doc references one-way. Never create a reference cycle.
- Report what you did and verified. Report failures and skipped steps with output.

## Workflow

Follow [`docs/workflow.md`](docs/workflow.md): slice → worktree `../starter-<topic>` → TDD → verify → rebase → PR from template → `gh pr merge --squash` → clean up and sync `main`.

## Commands

Setup, environment variables and troubleshooting: [`docs/runbook.md`](docs/runbook.md).

| Task        | Command                                                            |
| ----------- | ------------------------------------------------------------------ |
| Install     | `pnpm install && pnpm exec playwright install chromium`            |
| Env         | `cp .env.example .env`, then set `BETTER_AUTH_SECRET`              |
| Database    | `docker compose up -d --wait && pnpm db:migrate`                   |
| Dev         | `pnpm dev`                                                         |
| Build       | `pnpm build`                                                       |
| Lint        | `pnpm lint`                                                        |
| Typecheck   | `pnpm typecheck`                                                   |
| Unit        | `pnpm test` (`src/**/*.test.ts(x)`, jsdom)                         |
| Integration | `pnpm test:int` (`src/**/*.int.test.ts`, needs the database)       |
| E2E         | `pnpm test:e2e` (`e2e/`, builds and starts on a per-worktree port (3100-3899, or `E2E_PORT`), needs the database; emails go to `e2e/.outbox/`) |
| Migrations  | `pnpm db:generate --name <change>`, `pnpm db:migrate`, `pnpm db:studio` |
| Auth schema | `pnpm auth:generate`, then `pnpm db:generate --name <change>`      |

## Reply Style

Agent 回复用户时使用中文，并按 ASD-STE100（Simplified Technical English）的写作规则：

```text
一句话只说一件事；步骤句不超过 20 个字词，说明句不超过 25 个

指令用祈使句，一句一个动作；步骤用编号列表，按执行顺序排列

用主动语态，写清楚谁做什么

一个术语只表示一个意思，同一个东西始终用同一个词

不用成语、比喻、口语和模糊词（如“大概”“一些”）

一段不超过 6 句话

警告和前提条件写在对应步骤之前

代码、命令、文件名、标识符、错误信息保留原文
```

只约束 Agent 对用户的回复。文档、Commit、PR 的写法不变。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
