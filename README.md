# Polyverse

A **federated social network** built on [ActivityPub](https://www.w3.org/TR/activitypub/), featuring decentralized identity (DID), cryptographic key management, and data autonomy.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | SvelteKit 5, TailwindCSS 4 |
| Backend | SvelteKit server routes, Fedify |
| Database | Neon PostgreSQL, Drizzle ORM |
| Auth | Argon2, JWT (jose) |
| Storage | Vercel Blob |
| Email | Resend |
| Runtime | Bun |
| Deployment | Vercel |

## Getting Started

```bash
# Clone and install
git clone https://github.com/PiedPipers5/polyverse.git
cd polyverse
bun install

# Set up environment variables
cp .env.example .env
# Fill in your values — see .env.example for details

# Push DB schema
bun run db:push

# Start dev server
bun run dev
```

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start dev server at localhost:5173 |
| `bun run build` | Production build |
| `bun run preview` | Preview production build |
| `bun run check` | Type-check with svelte-check |
| `bun run lint` | Lint with Prettier + ESLint |
| `bun run format` | Auto-format code |
| `bun run test:unit` | Run unit tests (Vitest) |
| `bun run test:e2e` | Run E2E tests (Playwright) |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:push` | Push schema directly (dev only) |
| `bun run db:studio` | Open Drizzle Studio |

## CI/CD

Automated via GitHub Actions:

- **CI** (`.github/workflows/ci.yml`) — runs on every PR to `main`:
  - Lint & format check
  - Type checking (svelte-check)
  - Production build verification
  - Unit tests (Vitest)
  - DB migration consistency check

- **CodeQL** (`.github/workflows/codeql.yml`) — security scanning on PRs and weekly

- **Smoke Tests** (`.github/workflows/smoke-tests.yml`) — manually triggered post-deploy health checks

- **Dependabot** (`.github/dependabot.yml`) — weekly dependency update PRs

Deployment to Vercel is automatic on push to `main`.

## Environment Variables

See `.env.example` for required variables. **Never commit `.env` files.**

Store secrets in:
- **Local dev**: `.env` file
- **Vercel**: Settings → Environment Variables
- **CI**: GitHub Repository Secrets

## Project Structure

```
src/
├── lib/
│   ├── components/     # Svelte components
│   ├── server/
│   │   ├── db/         # Drizzle schema & connection
│   │   ├── auth.ts     # JWT auth
│   │   ├── encryption.ts # AES-256-GCM encryption
│   │   └── didServer.ts  # DID document generation
│   └── utils/          # Shared utilities
├── routes/             # SvelteKit pages & API routes
└── tests/              # Unit tests
e2e/                    # Playwright E2E tests
drizzle/                # Generated DB migrations
```
