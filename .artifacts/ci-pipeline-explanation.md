# 🔄 Polyverse CI Pipeline — Complete Explanation

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Architecture Diagram](#pipeline-architecture-diagram)
3. [Workflow 1: CI (`ci.yml`)](#workflow-1-ci-ciyml)
4. [Workflow 2: CodeQL Security Analysis (`codeql.yml`)](#workflow-2-codeql-security-analysis-codeqlyml)
5. [Workflow 3: Post-Deploy Smoke Tests (`smoke-tests.yml`)](#workflow-3-post-deploy-smoke-tests-smoke-testsyml)
6. [Supporting: Dependabot (`dependabot.yml`)](#supporting-dependabot-dependabotyml)
7. [How It All Fits Together](#how-it-all-fits-together)

---

## Overview

The Polyverse project uses **GitHub Actions** to automate its CI/CD pipeline. The pipeline consists of **3 workflow files** and **1 dependency management config**, each serving a distinct purpose:

| File | Purpose | Trigger |
|------|---------|---------|
| `ci.yml` | Core quality gates (lint, types, build, tests, migrations) | Push/PR to `main` |
| `codeql.yml` | Deep security vulnerability scanning | Push/PR to `main` + weekly schedule |
| `smoke-tests.yml` | Post-deployment health checks | Manual / webhook trigger |
| `dependabot.yml` | Automated dependency updates | Weekly (Monday) |

---

## Pipeline Architecture Diagram

```
┌─────────────────────────── ci.yml ───────────────────────────┐
│                                                              │
│   ┌─────────────┐     ┌──────────────┐                       │
│   │  Lint &      │     │  Type Check  │    (run in parallel)  │
│   │  Format      │     │  (svelte)    │                       │
│   └──────┬───────┘     └──────┬───────┘                       │
│          │                    │                                │
│          └────────┬───────────┘                                │
│                   │  (both must pass)                          │
│          ┌────────┼────────────────┐                           │
│          ▼        ▼                ▼                           │
│   ┌──────────┐ ┌───────────┐ ┌──────────────┐                │
│   │  Build   │ │ Unit Tests│ │ DB Migration │  (parallel)     │
│   │          │ │           │ │   Check      │                 │
│   └──────────┘ └───────────┘ └──────────────┘                │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌── codeql.yml ──┐       ┌── smoke-tests.yml ──┐
│  Security Scan │       │  Post-Deploy Health  │
│  (scheduled +  │       │  Checks (manual)     │
│   PR/push)     │       │                      │
└────────────────┘       └──────────────────────┘
```

---

## Workflow 1: CI (`ci.yml`)

> **File:** `.github/workflows/ci.yml`
> **Triggers:** On every `push` or `pull_request` targeting the `main` branch.

This is the **core CI pipeline** and the primary quality gate. It consists of **5 jobs** arranged in two tiers:

---

### Job 1: `lint` — Lint & Format Check

```yaml
- name: Lint & format check
  run: bun run lint
```

**What it does:**
- Runs ESLint and Prettier (or equivalent) to check all source code for:
  - **Code style violations** (inconsistent formatting, spacing, etc.)
  - **Code quality issues** (unused variables, missing imports, potential bugs)
  - **Best practice enforcement** (no `any` types, consistent naming, etc.)

**Why it matters:**
- Ensures **consistent code style** across all contributors
- Catches common bugs and anti-patterns *before* code review
- Reduces noise in pull request diffs (no formatting-only changes)
- Enforces team coding standards automatically

**Uses `--frozen-lockfile`** to ensure the build is **reproducible** — no unexpected dependency changes during CI.

---

### Job 2: `type-check` — TypeScript/Svelte Type Checking

```yaml
- name: Svelte check
  run: bun run check
```

**What it does:**
- Runs `svelte-check` which performs **full TypeScript type-checking** across:
  - All `.svelte` components
  - All `.ts` / `.js` server and client files
  - Cross-file type compatibility

**Why it matters:**
- Catches **type errors at compile time** rather than at runtime
- Validates that component props, API responses, and function signatures are all consistent
- SvelteKit has unique type requirements (e.g., `PageData`, `LayoutData`); this ensures those are correct
- Prevents entire categories of runtime bugs (null access, wrong argument types, etc.)

---

### Job 3: `build` — Production Build

```yaml
needs: [lint, type-check]    # ← Only runs after lint + type-check pass
```

```yaml
env:
  DATABASE_URL: postgresql://dummy:dummy@localhost/dummy
  DOMAIN: localhost
  ENCRYPTION_KEY: 0000...0000
  JWT_SECRET: 0000...0000
```

```yaml
- name: Build
  run: bun run build
```

**What it does:**
- Runs a **full SvelteKit production build** (`vite build`)
- Compiles all Svelte components, server routes, and API endpoints
- Tree-shakes and bundles the application

**Why the dummy environment variables?**
- SvelteKit compiles server-side code during build, which *imports* modules that reference `DATABASE_URL`, `ENCRYPTION_KEY`, etc.
- Without these env vars, the build would **fail with "missing env var" errors** even though the values are never actually *used* during the build step
- The real values are injected at runtime by Vercel

**Why it matters:**
- Catches **import errors, missing modules, and build-time failures**
- Validates that the project can be deployed — if it can't build, it can't ship
- Catches issues that linting/type-checking alone might miss (e.g., Vite-specific import issues, SSR compatibility)

---

### Job 4: `test-unit` — Unit Tests

```yaml
needs: [lint, type-check]    # ← Only runs after lint + type-check pass
```

```yaml
- name: Run server unit tests
  run: bun run test:unit -- --run --project server
```

**What it does:**
- Runs the **server-side unit test suite** using Vitest
- `--run` flag makes Vitest run once and exit (non-watch mode)
- `--project server` targets only the server test project (as defined in Vitest config)
- Tests cover things like:
  - Redis cache service logic
  - Database query functions
  - Authentication/JWT utilities
  - API route handlers
  - Business logic modules

**Why it matters:**
- Validates that individual units of code **behave correctly**
- Catches logic regressions before they reach production
- Provides confidence that refactoring hasn't broken existing functionality
- Runs only server tests in CI (client tests may require a browser environment)

---

### Job 5: `migration-check` — Database Migration Check

```yaml
needs: [lint, type-check]    # ← Only runs after lint + type-check pass
```

```yaml
- name: Generate migrations
  run: bun run db:generate

- name: Check for uncommitted migrations
  run: |
    if [ -n "$(git status --porcelain drizzle/)" ]; then
      echo "❌ Uncommitted migration files detected!"
      echo "Run 'bun run db:generate' locally and commit the migration files."
      git diff drizzle/
      exit 1
    fi
    echo "✅ All migrations are committed"
```

**What it does:**
1. Runs `drizzle-kit generate` to create migration files from the current schema
2. Checks if any files in the `drizzle/` directory changed (using `git status --porcelain`)
3. If there are uncommitted changes → **FAIL** with a helpful message
4. If everything is clean → **PASS**

**Why it matters:**
- Ensures that **schema changes are always accompanied by migration files**
- Prevents a scenario where a developer changes the Drizzle schema but forgets to generate + commit the migration SQL
- Without this, deployments could fail or the database schema could drift from what the code expects
- Acts as a safety net for the **database schema ↔ migration file** consistency

---

### Job Dependency Graph

```
Tier 1 (parallel):   lint ──────────────┐
                                         ├──→ Tier 2 (parallel): build
                     type-check ────────┤                        test-unit
                                         │                        migration-check
                                         └──→ (all three run in parallel)
```

**Why this structure?**
- Lint and type-check are **fast, cheap checks** that catch the most common issues
- Build, tests, and migration checks are **more expensive** — no point running them if basic quality gates fail
- Tier 2 jobs run **in parallel** to minimize total pipeline time

---

## Workflow 2: CodeQL Security Analysis (`codeql.yml`)

> **File:** `.github/workflows/codeql.yml`
> **Triggers:** Push/PR to `main` **+ weekly scheduled run** (Monday 6:00 UTC)

```yaml
strategy:
  matrix:
    language: ["javascript-typescript"]
```

**What it does:**
- Uses GitHub's **CodeQL** engine to perform **deep semantic code analysis**
- Scans all JavaScript and TypeScript code for:
  - **SQL injection** vulnerabilities
  - **Cross-site scripting (XSS)** issues
  - **Path traversal** attacks
  - **Insecure cryptographic** usage
  - **Hard-coded credentials**
  - **Prototype pollution**
  - **ReDoS** (Regular Expression Denial of Service)
  - And many more [CWE categories](https://cwe.mitre.org/)

**How it works:**
1. **Initialize** — Sets up the CodeQL database for JS/TS
2. **Autobuild** — Automatically detects and builds the project
3. **Analyze** — Runs hundreds of security queries against the codebase
4. Results appear in the **Security tab** of the GitHub repository

**Why the weekly schedule?**
- New vulnerability patterns are added to CodeQL regularly
- Running weekly catches vulnerabilities that may not have been detectable when the code was first pushed
- Acts as a **continuous security audit**

**Why it matters:**
- Catches security vulnerabilities that **no linter or type-checker can find**
- Provides GitHub Security Alerts directly in the repository
- Required for many compliance frameworks and security audits
- Runs with `fail-fast: false` so all languages are analyzed even if one fails

---

## Workflow 3: Post-Deploy Smoke Tests (`smoke-tests.yml`)

> **File:** `.github/workflows/smoke-tests.yml`
> **Triggers:** `workflow_dispatch` (manual trigger or webhook from Vercel)

```yaml
inputs:
  deployment_url:
    description: "Deployed URL to test"
    required: true
```

**What it does:**
After a deployment to Vercel, it performs **HTTP health checks** against 4 critical endpoints:

| Check | Endpoint | Expected | Failure Condition |
|-------|----------|----------|-------------------|
| Landing page | `/` | `200 OK` | Any non-200 status |
| WebFinger | `/.well-known/webfinger?resource=acct:test@localhost` | Not `500` | `500` (server error) |
| Login page | `/login` | `200 OK` | Any non-200 status |
| Register page | `/register` | `200 OK` | Any non-200 status |

**Step-by-step flow:**
1. **Wait 10 seconds** for the deployment to stabilize (cold start, edge propagation)
2. **Check landing page** — Verifies the app loads at all
3. **Check WebFinger** — Verifies the ActivityPub/Federation endpoint isn't crashing (400/404 is OK since there's no real user, but 500 = broken)
4. **Check login page** — Verifies authentication UI is accessible
5. **Check register page** — Verifies registration UI is accessible

**Why it matters:**
- **Build success ≠ deployment success** — code might build fine but crash at runtime due to missing env vars, database connectivity, etc.
- Catches deployment-specific issues like:
  - Vercel misconfiguration
  - Missing environment variables in production
  - Database connection failures
  - Server-side rendering crashes
- Provides **immediate feedback** after every deployment
- The WebFinger check is specific to Polyverse's **ActivityPub federation** features

---

## Supporting: Dependabot (`dependabot.yml`)

> **File:** `.github/dependabot.yml`

While not a CI pipeline per se, Dependabot is a critical part of the automated DevOps strategy:

**What it does:**
- Automatically creates **pull requests** to update outdated dependencies
- Monitors two ecosystems:
  1. **npm** — JavaScript/TypeScript packages
  2. **github-actions** — CI workflow action versions

**Configuration highlights:**

| Setting | Value | Why |
|---------|-------|-----|
| Schedule | Weekly (Monday) | Keeps deps current without daily noise |
| PR limit | 10 | Prevents PR flood |
| Grouping | Minor+patch by dev/prod | Reduces PR count by batching safe updates |
| Labels | `dependencies` / `ci` | Makes PRs easy to filter and review |
| Commit prefix | `deps` / `ci` | Clean, parseable commit history |

**Why it matters:**
- **Security patches** land automatically — no manual checking for CVEs
- Dependencies stay current, reducing technical debt
- Grouped updates mean fewer PRs to review (e.g., all dev dependency patches in one PR)
- CI pipeline runs on each Dependabot PR, so you know updates don't break anything

---

## How It All Fits Together

Here's the full lifecycle of a code change in Polyverse:

```
Developer pushes code / opens PR
          │
          ▼
    ┌─── ci.yml ────────────────────────────────────┐
    │                                                │
    │  1. Lint & Format  ──┐                         │
    │  2. Type Check     ──┤  (parallel, fast)       │
    │                      │                         │
    │                      ▼                         │
    │  3. Build          ──┐                         │
    │  4. Unit Tests     ──┤  (parallel, thorough)   │
    │  5. Migration Check──┘                         │
    │                                                │
    └──── All must pass to merge ────────────────────┘
          │
          ▼
    ┌─── codeql.yml ─────────────────────────────────┐
    │  Security vulnerability scanning (parallel)     │
    └────────────────────────────────────────────────┘
          │
          ▼
    PR is merged → Vercel auto-deploys
          │
          ▼
    ┌─── smoke-tests.yml ───────────────────────────┐
    │  Health checks against live deployment          │
    │  (/, /login, /register, WebFinger)             │
    └────────────────────────────────────────────────┘
          │
          ▼
    ┌─── dependabot.yml ────────────────────────────┐
    │  Weekly: auto-PRs for dependency updates       │
    │  Each PR triggers ci.yml again ↺               │
    └────────────────────────────────────────────────┘
```

### Summary of All Checks

| # | Check | Category | What it Catches |
|---|-------|----------|-----------------|
| 1 | Lint & Format | Code Quality | Style issues, anti-patterns, unused code |
| 2 | Type Check | Correctness | Type mismatches, null safety, prop errors |
| 3 | Build | Deployability | Import errors, SSR issues, build failures |
| 4 | Unit Tests | Correctness | Logic bugs, regressions, edge cases |
| 5 | Migration Check | Data Integrity | Schema/migration drift, forgotten migrations |
| 6 | CodeQL | Security | XSS, SQL injection, crypto issues, etc. |
| 7 | Smoke Tests | Availability | Deployment failures, runtime crashes |
| 8 | Dependabot | Maintenance | Outdated/vulnerable dependencies |

### Key Design Decisions

1. **Bun over npm/yarn** — Faster installs and script execution in CI
2. **`--frozen-lockfile`** — Guarantees reproducible builds; CI fails if lockfile is out of sync
3. **Dummy env vars for build** — Clever workaround for SvelteKit's compile-time server code imports
4. **Tiered job execution** — Cheap checks first, expensive checks only if basics pass
5. **Parallel execution** — Minimizes total pipeline time
6. **CodeQL on a schedule** — Catches newly-discovered vulnerability patterns retroactively
7. **WebFinger in smoke tests** — Specific to Polyverse's ActivityPub/federation functionality
