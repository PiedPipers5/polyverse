# Media Upload Endpoints

> Covers **Epic 1** — Task 1.5.1 (Avatar upload) and **Epic 2** — Tasks 2.5.1, 2.5.3 (Media attachments).

Both endpoints upload files to **Vercel Blob** storage and return a public URL.

---

## POST `/api/media/upload`

**Epic Ref:** Task 2.5.1  
**File:** [`+server.ts`](file:///home/ks/Desktop/projects/polyverse/src/routes/api/media/upload/+server.ts)  
**Auth Required:** Yes

Generic media upload endpoint for post attachments. Validates file type and size, then uploads to Vercel Blob.

### Request

`Content-Type: multipart/form-data`

| Field  | Type | Required | Description        |
| ------ | ---- | -------- | ------------------ |
| `file` | File | Yes      | The file to upload |

### File Validation

| Check     | Constraint                                          |
| --------- | --------------------------------------------------- |
| Size      | Max **4.5 MB**                                      |
| MIME Type | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |

### 201 — Upload Successful

```json
{
  "url": "https://abcdef.public.blob.vercel-storage.com/1700000000-photo.jpg",
  "type": "Image",
  "mediaType": "image/jpeg"
}
```

> [!TIP]
> The returned object shape matches the ActivityPub `attachment` format. Pass it directly into the `media` array when creating a Note via `POST /users/{username}/outbox`.

### Errors

| Code | Condition                             |
| ---- | ------------------------------------- |
| 400  | No file, invalid format, or too large |
| 401  | Not authenticated                     |
| 500  | Blob storage upload failure           |

---

## POST `/api/upload/avatar`

**Epic Ref:** Task 1.5.2  
**File:** [`+server.ts`](file:///home/ks/Desktop/projects/polyverse/src/routes/api/upload/avatar/+server.ts)  
**Auth Required:** Yes

Uploads a user's avatar image. Replaces the previous avatar (old blob is deleted) and updates the user's `avatar_url` in the database.

### Request

`Content-Type: multipart/form-data`

| Field    | Type | Required | Description           |
| -------- | ---- | -------- | --------------------- |
| `avatar` | File | Yes      | The avatar image file |

### File Validation

| Check     | Constraint                                          |
| --------- | --------------------------------------------------- |
| Size      | Max **5 MB**                                        |
| MIME Type | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |

### Processing

1. Validate authentication
2. Validate file type and size
3. Fetch current user's avatar URL (for cleanup)
4. Upload to Vercel Blob at path `avatars/{userId}/{timestamp}.{ext}` (public access, no random suffix)
5. Update `users.avatar_url` in database
6. Delete old avatar blob if it exists (non-blocking, failure is logged but doesn't fail the request)

### 200 — Upload Successful

```json
{
  "success": true,
  "url": "https://abcdef.public.blob.vercel-storage.com/avatars/550e8400-.../1700000000.jpg"
}
```

### Errors

| Code | Condition                                       |
| ---- | ----------------------------------------------- |
| 400  | No file, invalid type, or file too large        |
| 401  | Not authenticated                               |
| 500  | Blob storage not configured or upload failure   |
