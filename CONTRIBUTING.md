# Contributing Guide

## Table of Contents

- [Development Setup](#development-setup)
- [Branch Naming Convention](#branch-naming-convention)
- [Commit Message Convention](#commit-message-convention)
- [Code Quality Workflow](#code-quality-workflow)
- [Pull Request Checklist](#pull-request-checklist)

---

## Development Setup

```bash
# 1. Install Node.js 20 via nvm
nvm install && nvm use      # reads .nvmrc → Node 20

# 2. Install all workspace dependencies (also runs Husky + builds shared)
npm install

# 3. Copy environment template
cp .env.example .env        # fill in DB, JWT_SECRET, LINE keys

# 4. Start all apps in dev mode
npm run dev
# API  → http://localhost:4000
# Web  → http://localhost:5173
```

---

## Branch Naming Convention

All feature branches **must** follow this pattern:

```
<type>/<short-description>
```

| Type        | When to use                            | Example                        |
|-------------|----------------------------------------|--------------------------------|
| `feat`      | A new feature                          | `feat/add-queue-management`    |
| `fix`       | A bug fix                              | `fix/ticket-status-transition` |
| `hotfix`    | Urgent production fix                  | `hotfix/cors-header-missing`   |
| `chore`     | Maintenance (deps, config, tooling)    | `chore/update-deps`            |
| `refactor`  | Code restructure without behavior change | `refactor/extract-service`   |
| `test`      | Adding or updating tests               | `test/queue-service-unit`      |
| `docs`      | Documentation only                     | `docs/api-endpoints`           |
| `ci`        | CI/CD pipeline changes                 | `ci/add-docker-publish`        |
| `release`   | Release preparation                    | `release/1.2.0`                |
| `perf`      | Performance improvement                | `perf/reduce-db-queries`       |

> The `pre-push` hook enforces this convention automatically.
> Protected branches (`main`, `master`, `develop`) are exempt.

---

## Commit Message Convention

This project uses **Conventional Commits** enforced by `commitlint`.

### Format

```
<type>(<optional-scope>): <subject>

[optional body]

[optional footer(s)]
```

### Rules

| Field     | Rule                                                             |
|-----------|------------------------------------------------------------------|
| `type`    | Required. One of the types listed below. Lowercase.              |
| `scope`   | Optional. Lowercase. E.g. `api`, `web`, `shared`, `docker`.     |
| `subject` | Required. Lowercase start. No period. Max 100 chars.             |
| `body`    | Optional. Wrap at 200 chars. Separate from subject with blank line. |

### Allowed types

| Type       | Description                                         |
|------------|-----------------------------------------------------|
| `feat`     | A new feature (triggers MINOR bump in semver)       |
| `fix`      | A bug fix (triggers PATCH bump)                     |
| `chore`    | Maintenance — no production code change             |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test`     | Adding or updating tests                            |
| `docs`     | Documentation only                                  |
| `ci`       | CI/CD configuration                                 |
| `perf`     | Performance improvement                             |
| `style`    | Formatting, whitespace (no logic change)            |
| `build`    | Build system or external dependencies               |
| `revert`   | Reverts a previous commit                           |

### Examples

```bash
# Good ✅
git commit -m "feat(api): add POST /queues endpoint"
git commit -m "fix(web): correct ticket number padding to 3 digits"
git commit -m "chore: upgrade vite to 5.3.1"
git commit -m "test(shared): add unit tests for estimateWaitMinutes"
git commit -m "docs: add branch naming guide to CONTRIBUTING.md"

# Bad ❌
git commit -m "Added new feature"         # no type
git commit -m "FEAT: something"           # uppercase type
git commit -m "fix: fixed the bug."       # trailing period
```

---

## Code Quality Workflow

### Automatic (via Git hooks)

| Hook          | Trigger            | Action                                  |
|---------------|--------------------|-----------------------------------------|
| `pre-commit`  | `git commit`       | Runs `lint-staged` on staged files      |
| `commit-msg`  | `git commit`       | Validates commit message with commitlint |
| `pre-push`    | `git push`         | Validates branch name convention        |

**`lint-staged` runs per file type:**
- `*.ts` / `*.tsx` → ESLint (`--fix`) + Prettier
- `*.js` / `*.mjs` → ESLint (`--fix`) + Prettier
- `*.json` / `*.md` / `*.yml` → Prettier

### Manual scripts

```bash
# Lint all workspaces
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format all files
npm run format

# Check formatting (CI use)
npm run format:check

# TypeScript type checking
npm run typecheck

# Spell checking
npm run spell:check
```

### Bypassing hooks (use sparingly)

```bash
# Skip pre-commit (e.g. WIP commit)
git commit --no-verify -m "chore: wip"

# Skip pre-push
git push --no-verify
```

> ⚠️ Never bypass hooks in commits destined for `main`.

---

## Pull Request Checklist

Before opening a PR, ensure:

- [ ] Branch name follows convention (e.g. `feat/my-feature`)
- [ ] All commits follow Conventional Commits format
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] `npm run format:check` passes
- [ ] New features include unit tests
- [ ] `.env.example` updated if new env vars were added
