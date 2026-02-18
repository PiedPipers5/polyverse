# PolyVerse API Documentation

> **PolyVerse** is a federated, decentralized social media platform built on [ActivityPub](https://www.w3.org/TR/activitypub/) and [W3C DID](https://www.w3.org/TR/did-core/) standards. Users get cryptographic identities and can communicate across the Fediverse.

---

## Tech Stack

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| Runtime      | [Bun](https://bun.sh)                   |
| Framework    | SvelteKit (Svelte 5)                    |
| Database     | PostgreSQL (Neon DB)                    |
| ORM          | Drizzle ORM                             |
| Blob Storage | Vercel Blob                             |
| Auth         | JWT (HS256 via `jose`) + Argon2 hashing |
| Encryption   | AES-256-GCM (for private keys)          |
| Identity     | `did:web` + Ed25519 key pairs           |
| Email        | Resend                                  |

---

## Base URL

All endpoints are relative to the instance domain configured in the `DOMAIN` environment variable.

```
https://{DOMAIN}
```

---

## Authentication

Most mutating endpoints require authentication via a **JWT** stored in an `HttpOnly` cookie named `auth_token`.

- **Issued on login** — contains `userId`, `did`, and `username`.
- **Expires in 7 days**.
- **Verified automatically** by the server hook middleware (`hooks.server.ts`) on every request.
- Authenticated user is available via `locals.user` in all handlers.

See [Authentication Endpoints](./authentication.md) for registration, login, and logout details.

---

## Database Schema

| Table            | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `users`          | User profiles, credentials, DID documents                |
| `user_secrets`   | Encrypted private keys (cascade-deleted with user)       |
| `activities`     | All ActivityPub activities stored as JSONB                |
| `followers`      | Follow relationships (composite PK: userId + followerId) |
| `remote_actors`  | Cached remote Fediverse Actor objects (24h TTL)          |

---

## Endpoint Index

### Authentication & Identity (Epic 1)

| Method | Endpoint                                     | Auth | Description                               | Doc                                 |
| ------ | -------------------------------------------- | ---- | ----------------------------------------- | ----------------------------------- |
| POST   | `/register`                                  | No   | Create account + generate DID             | [auth](./authentication.md)         |
| POST   | `/login`                                     | No   | Login + issue JWT                         | [auth](./authentication.md)         |
| GET    | `/logout`                                    | No   | Clear session cookie                      | [auth](./authentication.md)         |
| GET    | `/webfinger?resource=acct:user@domain`       | No   | WebFinger discovery (RFC 7033)            | [identity](./identity.md)           |
| GET    | `/u/{username}/did.json`                     | No   | Serve DID Document                        | [identity](./identity.md)           |
| GET    | `/users/{username}`                          | No   | Actor profile (content negotiation)       | [identity](./identity.md)           |
| GET    | `/api/users/me`                              | Yes  | Get own profile                           | [profile](./profile.md)             |
| PATCH  | `/api/users/me`                              | Yes  | Update own profile                        | [profile](./profile.md)             |

### Content & Outbox (Epic 2)

| Method | Endpoint                                     | Auth | Description                               | Doc                                 |
| ------ | -------------------------------------------- | ---- | ----------------------------------------- | ----------------------------------- |
| POST   | `/users/{username}/outbox`                   | Yes  | Publish / Edit / Delete a Note            | [outbox](./outbox.md)               |
| GET    | `/users/{username}/outbox`                   | No   | View outbox (OrderedCollection)           | [outbox](./outbox.md)               |
| GET    | `/users/{username}/statuses/{uuid}`          | No   | Fetch a single Note / Tombstone           | [outbox](./outbox.md)               |
| POST   | `/api/media/upload`                          | Yes  | Upload media attachment                   | [media](./media.md)                 |
| POST   | `/api/upload/avatar`                         | Yes  | Upload avatar image                       | [media](./media.md)                 |

### Search & Federation (Epic 3)

| Method | Endpoint                                     | Auth | Description                               | Doc                                 |
| ------ | -------------------------------------------- | ---- | ----------------------------------------- | ----------------------------------- |
| GET    | `/api/search?q=@user@domain`                 | Yes  | Federated user search (US 3.1)            | [search](./search.md)               |

### Miscellaneous
| POST   | `/api/newsletter`                            | No   | Newsletter signup                         | (landing page utility)              |

---

## Content Types

| Context                | Content-Type                                  |
| ---------------------- | --------------------------------------------- |
| WebFinger responses    | `application/jrd+json`                        |
| DID Documents          | `application/did+ld+json`                     |
| ActivityPub objects    | `application/activity+json; charset=utf-8`    |
| Standard JSON          | `application/json`                            |

---

## Error Format

Errors follow SvelteKit's standard format:

```json
{
  "message": "Human-readable error description"
}
```

Common HTTP status codes used:

| Code | Meaning                                          |
| ---- | ------------------------------------------------ |
| 400  | Bad Request — invalid input or missing fields    |
| 401  | Unauthorized — missing or invalid JWT            |
| 403  | Forbidden — insufficient permissions             |
| 404  | Not Found — resource does not exist              |
| 409  | Conflict — duplicate resource (e.g., username)   |
| 410  | Gone — resource was deleted (Tombstone)          |
| 500  | Internal Server Error                            |

---

## Environment Variables

| Variable                        | Required | Purpose                           |
| ------------------------------- | -------- | --------------------------------- |
| `DOMAIN`                        | Yes      | Instance domain (e.g., `polyverse.social`) |
| `DATABASE_URL`                  | Yes      | Neon PostgreSQL connection string |
| `JWT_SECRET`                    | Yes      | Secret for signing JWTs           |
| `ENCRYPTION_KEY`                | Yes      | AES-256 hex key for private key encryption |
| `BLOB_READ_WRITE_TOKEN`         | Yes      | Vercel Blob storage token         |
| `RESEND_API_KEY`                | No       | Resend email service API key      |
| `POLYVERSE_NOTIFICATION_EMAIL`  | No       | Email for newsletter notifications|
