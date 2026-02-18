# Polyverse

A **federated social network** built on [ActivityPub](https://www.w3.org/TR/activitypub/), featuring decentralized identity (DID), cryptographic key management, and data autonomy.

**Live**: [polyverse-pp.vercel.app](https://polyverse-pp.vercel.app)

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

## Docker

```bash
# Build and run
docker compose up --build

# App runs at http://localhost:3000
```

Secrets are loaded from `.env` at runtime. See `.env.example` for required variables.

## CI/CD

Automated via GitHub Actions:

- **CI** — lint, type-check, build, unit tests, and migration check on every PR to `main`
- **CodeQL** — security vulnerability scanning on PRs and weekly
- **Smoke Tests** — manually triggered post-deploy health checks
- **Dependabot** — weekly dependency update PRs

Production deployment to Vercel is automatic on push to `main`.

## Environment Variables

See `.env.example` for all required variables. **Never commit `.env` files.**

| Where | Purpose |
|---|---|
| `.env` | Local development |
| Vercel Env Vars | Production & preview deployments |
| GitHub Secrets | CI workflows |
