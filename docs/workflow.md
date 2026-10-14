# Workflow

How a change goes from idea to `main`.

## 1. Slice

- Split the task into vertical slices before coding. Number them `S01`, `S02`, ...
- Each slice is end-to-end, ships on its own, and leaves `main` working.
- Start with the thinnest slice that proves the idea.
- One slice = one worktree = one branch = one PR. If a slice grows, split it.

## 2. Worktree

Never commit to `main`. Create a worktree per slice:

```sh
git switch main && git pull --ff-only
git worktree add ../starter-<topic> -b <type>/<topic>   # e.g. feat/login-form
cd ../starter-<topic>
```

## 3. TDD

Repeat per behavior until the slice is done:

1. **Red**: write one failing test. Confirm it fails for the expected reason.
2. **Green**: write the least code to pass.
3. **Refactor**: clean up with all tests green.

Test through public interfaces. Start bug fixes with a test that reproduces the bug.

## 4. Verify and commit

- Run build, lint, typecheck and tests.
- Update docs in the same PR when behavior or commands change.
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.

## 5. Pull request

Rebase on `main`, rerun the checks, then open the PR:

```sh
git fetch origin && git rebase origin/main
git push --force-with-lease -u origin <type>/<topic>
gh pr create --base main --template pull_request_template.md
```

Fill in every section of the [PR template](../.github/pull_request_template.md). Write `N/A` if a section doesn't apply. If `main` moves, rebase again.

CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs lint, typecheck, unit, integration and E2E on every PR and on `main`. A change that touches only Markdown (`*.md`) skips CI, except `docs/DESIGN.md` and `docs/runbook.md`, which unit tests check against the code. Otherwise, merge only when it passes.

## 6. Merge and clean up

Run from the main checkout (`starter/`), after the PR is approved and checks pass:

```sh
gh pr merge <PR> --squash
git worktree remove ../starter-<topic>
git branch -D <type>/<topic>              # squash merges need -D
git push origin --delete <type>/<topic>   # skip if already deleted
git switch main && git pull --ff-only
git worktree prune
```

Run `git branch -D` only after `gh pr merge` succeeds.
