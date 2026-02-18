# Outbox & Notes Endpoints

> Covers **Epic 2** — User Stories 2.1 (Publishing), 2.2 (Viewing Outbox), 2.3 (Audience Scoping), and 2.4 (Editing/Deleting).

---

## POST `/users/{username}/outbox`

**Epic Ref:** Tasks 2.1.2, 2.1.3, 2.3.2, 2.4.2, 2.4.3  
**File:** [`+server.ts`](file:///home/ks/Desktop/projects/polyverse/src/routes/users/[username]/outbox/+server.ts)  
**Auth Required:** Yes

Multi-action endpoint for creating, editing, and deleting Notes. The `action` field in the request body determines the operation.

### Path Parameters

| Parameter  | Type   | Description                      |
| ---------- | ------ | -------------------------------- |
| `username` | string | Must match the authenticated user |

### Authorization

- User must be authenticated (`401` if not)
- User can only post to **their own** outbox (`403` if `username` doesn't match)

---

### Action: `create` (default)

Creates a new Note wrapped in a `Create` activity.

#### Request Body

```json
{
  "action": "create",
  "content": "Hello, Fediverse! 🌐",
  "privacy": "public",
  "media": [
    {
      "url": "https://blob.vercel-storage.com/image.jpg",
      "type": "Image",
      "mediaType": "image/jpeg"
    }
  ]
}
```

| Field     | Type     | Required | Default    | Description                                   |
| --------- | -------- | -------- | ---------- | --------------------------------------------- |
| `action`  | string   | No       | `"create"` | Operation type                                |
| `content` | string   | Yes*     | —          | Post text content (* or media must be present)|
| `privacy` | string   | No       | `"public"` | `"public"`, `"unlisted"`, or `"followers"`    |
| `media`   | array    | No       | `[]`       | Media attachments (from media upload endpoint)|

#### Privacy Mapping (Task 2.3.2)

| Privacy      | `to`                                    | `cc`                                    |
| ------------ | --------------------------------------- | --------------------------------------- |
| `public`     | `[as:Public]`                           | `[{actorUri}/followers]`                |
| `unlisted`   | `[{actorUri}/followers]`                | `[as:Public]`                           |
| `followers`  | `[{actorUri}/followers]`                | `[]`                                    |

> `as:Public` = `https://www.w3.org/ns/activitystreams#Public`

#### 201 — Created Activity

```json
{
  "id": "https://polyverse.social/users/alice/statuses/a1b2c3d4-...",
  "type": "Create",
  "actor": "https://polyverse.social/users/alice",
  "published": "2026-02-18T00:00:00.000Z",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": ["https://polyverse.social/users/alice/followers"],
  "object": {
    "id": "https://polyverse.social/users/alice/statuses/e5f6g7h8-...",
    "type": "Note",
    "published": "2026-02-18T00:00:00.000Z",
    "attributedTo": "https://polyverse.social/users/alice",
    "content": "Hello, Fediverse! 🌐",
    "to": ["https://www.w3.org/ns/activitystreams#Public"],
    "cc": ["https://polyverse.social/users/alice/followers"],
    "attachment": []
  }
}
```

**Response Header:** `Location: {activity.id}`

---

### Action: `edit`

Updates an existing Note with new content. Creates an `Update` activity and modifies the original `Create` record.

#### Request Body

```json
{
  "action": "edit",
  "objectId": "https://polyverse.social/users/alice/statuses/e5f6g7h8-...",
  "content": "Updated content!",
  "media": []
}
```

| Field      | Type   | Required | Description                          |
| ---------- | ------ | -------- | ------------------------------------ |
| `action`   | string | Yes      | Must be `"edit"`                     |
| `objectId` | string | Yes      | The `id` of the Note to edit         |
| `content`  | string | Yes*     | New text content                     |
| `media`    | array  | No       | Replacement media attachments        |

#### Processing

1. Find the original `Create` activity for the given `objectId`
2. Preserve the original audience (`to`/`cc`)
3. Create an `Update` activity with the modified Note (adds `updated` timestamp)
4. Update the original `Create` record's embedded object in the database

#### 201 — Update Activity

```json
{
  "id": "https://polyverse.social/users/alice/statuses/...",
  "type": "Update",
  "actor": "https://polyverse.social/users/alice",
  "published": "2026-02-18T01:00:00.000Z",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": ["https://polyverse.social/users/alice/followers"],
  "object": {
    "id": "https://polyverse.social/users/alice/statuses/e5f6g7h8-...",
    "type": "Note",
    "content": "Updated content!",
    "updated": "2026-02-18T01:00:00.000Z",
    "..."
  }
}
```

---

### Action: `delete`

Deletes a Note by replacing it with a `Tombstone` object.

#### Request Body

```json
{
  "action": "delete",
  "objectId": "https://polyverse.social/users/alice/statuses/e5f6g7h8-..."
}
```

| Field      | Type   | Required | Description                     |
| ---------- | ------ | -------- | ------------------------------- |
| `action`   | string | Yes      | Must be `"delete"`              |
| `objectId` | string | Yes      | The `id` of the Note to delete  |

#### Processing

1. Find the original `Create` activity for the given `objectId`
2. Create a `Tombstone` object with `formerType: "Note"` and `deleted` timestamp
3. Insert a new `Delete` activity
4. Update the original `Create` record to contain the `Tombstone` instead of the Note

#### 200 — Delete Activity

```json
{
  "id": "https://polyverse.social/users/alice/statuses/...",
  "type": "Delete",
  "actor": "https://polyverse.social/users/alice",
  "published": "2026-02-18T02:00:00.000Z",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": ["https://polyverse.social/users/alice/followers"],
  "object": {
    "id": "https://polyverse.social/users/alice/statuses/e5f6g7h8-...",
    "type": "Tombstone",
    "formerType": "Note",
    "deleted": "2026-02-18T02:00:00.000Z"
  }
}
```

### POST Errors

| Code | Condition                                          |
| ---- | -------------------------------------------------- |
| 400  | Missing content/media, missing objectId, or invalid action |
| 401  | Not authenticated                                  |
| 403  | Posting to another user's outbox                   |
| 404  | Post not found (for edit/delete)                   |

---

## GET `/users/{username}/outbox`

**Epic Ref:** Tasks 2.2.1, 2.2.2, 2.3.3  
**File:** [`+server.ts`](file:///home/ks/Desktop/projects/polyverse/src/routes/users/[username]/outbox/+server.ts)  
**Auth Required:** No (but auth affects visibility)

Returns the user's outbox as an ActivityPub `OrderedCollection` with pagination and privacy filtering.

### Path Parameters

| Parameter  | Type   | Description      |
| ---------- | ------ | ---------------- |
| `username` | string | Target user      |

### Query Parameters

| Parameter | Type   | Default | Description                            |
| --------- | ------ | ------- | -------------------------------------- |
| `page`    | number | —       | Page number (if omitted, returns root collection) |
| `limit`   | number | `5`     | Items per page                         |

### Response: Root Collection (no `page` param)

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://polyverse.social/users/alice/outbox",
  "type": "OrderedCollection",
  "totalItems": 42,
  "first": "https://polyverse.social/users/alice/outbox?page=1"
}
```

### Response: Paginated Page (`page=N`)

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://polyverse.social/users/alice/outbox?page=1",
  "type": "OrderedCollectionPage",
  "partOf": "https://polyverse.social/users/alice/outbox",
  "orderedItems": [ /* ... activities ... */ ],
  "next": "https://polyverse.social/users/alice/outbox?page=2",
  "prev": "https://polyverse.social/users/alice/outbox?page=0"
}
```

### Privacy Filtering (Task 2.3.3)

The response is filtered based on who is requesting:

| Requestor        | Can See                                      |
| ---------------- | -------------------------------------------- |
| Owner            | All posts (public, unlisted, followers-only) |
| Follower         | Public + unlisted + followers-only           |
| Other / Anonymous| Public + unlisted only                       |

The follower check queries the `followers` table to verify the relationship.

### Errors

| Code | Condition              |
| ---- | ---------------------- |
| 400  | Invalid page number    |
| 404  | User not found         |

---

## GET `/users/{username}/statuses/{uuid}`

**Epic Ref:** Task 2.4.4  
**File:** [`+server.ts`](file:///home/ks/Desktop/projects/polyverse/src/routes/users/[username]/statuses/[uuid]/+server.ts)  
**Auth Required:** No (but auth affects access)

Retrieves a single Note by its ID. Handles Tombstone detection for deleted posts.

### Path Parameters

| Parameter  | Type   | Description           |
| ---------- | ------ | --------------------- |
| `username` | string | Author's username     |
| `uuid`     | string | Status UUID           |

### Response Headers

```
Content-Type: application/activity+json
```

### 200 — Note Object

```json
{
  "id": "https://polyverse.social/users/alice/statuses/e5f6g7h8-...",
  "type": "Note",
  "published": "2026-02-18T00:00:00.000Z",
  "attributedTo": "https://polyverse.social/users/alice",
  "content": "Hello, Fediverse!",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": ["https://polyverse.social/users/alice/followers"],
  "attachment": []
}
```

### Visibility Rules

Access is evaluated in this order:

1. **Tombstone** → `410 Gone` (always, regardless of auth)
2. **Owner** or **Public** post → `200 OK`
3. **Directly addressed** to requestor (`to`/`cc` includes requestor's Actor URI) → `200 OK`
4. **Followers-only** + requestor is a verified follower → `200 OK`
5. Otherwise → `403 Forbidden`

### Errors

| Code | Condition                                                |
| ---- | -------------------------------------------------------- |
| 403  | Requestor not authorized to view this post               |
| 404  | No activity found with this Note ID                      |
| 410  | Post has been deleted (Tombstone)                        |
