# Profile Management Endpoints

> Covers **Epic 1** — User Story 1.5 (Profile Customization).

---

## GET `/api/users/me`

**Epic Ref:** Part of Task 1.5  
**File:** [`+server.ts`](file:///home/ks/Desktop/projects/polyverse/src/routes/api/users/me/+server.ts)  
**Auth Required:** Yes

Returns the authenticated user's profile information.

### 200 — User Profile

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "alice",
  "displayName": "Alice Smith",
  "bio": "Exploring the Fediverse ✨",
  "avatarUrl": "https://abcdef.public.blob.vercel-storage.com/avatars/...",
  "did": "did:web:polyverse.social:u:alice",
  "createdAt": "2026-01-15T10:30:00.000Z"
}
```

### Errors

| Code | Condition                              |
| ---- | -------------------------------------- |
| 401  | Not authenticated                      |
| 404  | User record not found (shouldn't occur)|

---

## PATCH `/api/users/me`

**Epic Ref:** Task 1.5.2  
**File:** [`+server.ts`](file:///home/ks/Desktop/projects/polyverse/src/routes/api/users/me/+server.ts)  
**Auth Required:** Yes

Updates the authenticated user's profile. Supports partial updates — only include the fields you want to change.

### Request Body

```json
{
  "displayName": "Alice S.",
  "bio": "New bio text",
  "avatarUrl": "https://blob.vercel-storage.com/avatars/..."
}
```

| Field         | Type        | Required | Constraints                   |
| ------------- | ----------- | -------- | ----------------------------- |
| `displayName` | string/null | No       | Max 50 chars, HTML stripped   |
| `bio`         | string/null | No       | Max 500 chars, HTML stripped  |
| `avatarUrl`   | string/null | No       | Must be a valid HTTP(S) URL   |

> [!NOTE]
> Passing `null` for a field clears it. Only include fields you want to update. Sending `{}` with no valid fields returns a `400` error.

### Sanitization

- **HTML stripping**: All `<tags>` are removed from `displayName` and `bio` to prevent Stored XSS (Task 1.5.4).
- **URL validation**: `avatarUrl` is verified to be a valid `http://` or `https://` URL.

### 200 — Updated Profile

```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "alice",
    "displayName": "Alice S.",
    "bio": "New bio text",
    "avatarUrl": "https://blob.vercel-storage.com/avatars/..."
  }
}
```

### Errors

| Code | Condition                               |
| ---- | --------------------------------------- |
| 400  | Invalid JSON body, invalid avatar URL, or no valid fields |
| 401  | Not authenticated                       |
