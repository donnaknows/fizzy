# Fizzy API Reference

Complete endpoint documentation for Fizzy's REST API.

## Authentication

All requests require Bearer token authentication:

```bash
curl -H "Authorization: Bearer $FIZZY_TOKEN" \
     -H "Accept: application/json" \
     "$FIZZY_BASE_URL/my/identity"
```

## Account Slug

Most endpoints require an account slug (e.g., `/897362094`). Get it from `/my/identity`:

```bash
curl -s -H "Authorization: Bearer $FIZZY_TOKEN" \
     -H "Accept: application/json" \
     "$FIZZY_BASE_URL/my/identity" | jq '.accounts[0].slug'
```

## Endpoints

### Identity & Accounts

```
GET /my/identity              # List accounts you have access to
GET /my/pins                  # List pinned cards (max 100)
```

### Boards

```
GET    /:account_slug/boards              # List boards
GET    /:account_slug/boards/:board_id    # Get board
POST   /:account_slug/boards              # Create board
PUT    /:account_slug/boards/:board_id    # Update board
DELETE /:account_slug/boards/:board_id    # Delete board
```

### Cards

```
GET    /:account_slug/cards                           # List cards (paginated, filterable)
GET    /:account_slug/cards/:card_number              # Get card
POST   /:account_slug/boards/:board_id/cards          # Create card
PUT    /:account_slug/cards/:card_number              # Update card
DELETE /:account_slug/cards/:card_number              # Delete card
POST   /:account_slug/cards/:card_number/closure      # Close card
DELETE /:account_slug/cards/:card_number/closure      # Reopen card
POST   /:account_slug/cards/:card_number/not_now      # Move to "Not Now"
POST   /:account_slug/cards/:card_number/triage       # Move to column (requires column_id)
DELETE /:account_slug/cards/:card_number/triage       # Send back to triage
```

### Card Actions

```
POST   /:account_slug/cards/:card_number/taggings     # Toggle tag (param: tag_title)
POST   /:account_slug/cards/:card_number/assignments  # Toggle assignee (param: assignee_id)
POST   /:account_slug/cards/:card_number/watch        # Subscribe to notifications
DELETE /:account_slug/cards/:card_number/watch        # Unsubscribe
POST   /:account_slug/cards/:card_number/goldness     # Mark as golden
DELETE /:account_slug/cards/:card_number/goldness     # Remove golden
POST   /:account_slug/cards/:card_number/pin          # Pin card
DELETE /:account_slug/cards/:card_number/pin          # Unpin card
```

### Comments

```
GET    /:account_slug/cards/:card_number/comments                # List comments
GET    /:account_slug/cards/:card_number/comments/:comment_id    # Get comment
POST   /:account_slug/cards/:card_number/comments                # Create comment
PUT    /:account_slug/cards/:card_number/comments/:comment_id    # Update comment
DELETE /:account_slug/cards/:card_number/comments/:comment_id    # Delete comment
```

### Steps (Checklist Items)

```
GET    /:account_slug/cards/:card_number/steps/:step_id    # Get step
POST   /:account_slug/cards/:card_number/steps             # Create step
PUT    /:account_slug/cards/:card_number/steps/:step_id    # Update step
DELETE /:account_slug/cards/:card_number/steps/:step_id    # Delete step
```

### Tags & Columns

```
GET /:account_slug/tags                        # List all tags
GET /:account_slug/boards/:board_id/columns    # List columns
GET /:account_slug/boards/:board_id/columns/:column_id    # Get column
```

### Users & Notifications

```
GET  /:account_slug/users                      # List users
GET  /:account_slug/users/:user_id             # Get user
GET  /:account_slug/notifications              # List notifications
POST /:account_slug/notifications/:id/reading  # Mark as read
POST /:account_slug/notifications/bulk_reading # Mark all as read
```

## Query Parameters

### Cards List Filters

```
board_ids[]       - Filter by board ID(s)
tag_ids[]         - Filter by tag ID(s)
assignee_ids[]    - Filter by assignee user ID(s)
creator_ids[]     - Filter by card creator ID(s)
card_ids[]        - Filter to specific card ID(s)
indexed_by        - all (default), closed, not_now, stalled, postponing_soon, golden
sorted_by         - latest (default), newest, oldest
assignment_status - unassigned
creation          - today, yesterday, thisweek, lastweek, thismonth, lastmonth
closure           - today, yesterday, thisweek, lastweek, thismonth, lastmonth
terms[]           - Search terms
```

### Pagination

List endpoints return paginated results. Check the `Link` header for `rel="next"`:

```bash
curl -I "$FIZZY_BASE_URL/$ACCOUNT/cards"
# Link: <http://.../cards?page=2>; rel="next"
```

## File Uploads

Fizzy supports file uploads via ActiveStorage direct uploads. This is a 3-step process:

### 1. Request Direct Upload URL

```bash
curl -X POST \
  -H "Authorization: Bearer $FIZZY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "blob": {
      "filename": "screenshot.png",
      "byte_size": 12345,
      "checksum": "GQ5SqLsM7ylnji0Wgd9wNA==",
      "content_type": "image/png"
    }
  }' \
  "${FIZZY_BASE_URL}/${ACCOUNT}/rails/active_storage/direct_uploads"
```

Response includes `signed_id` and direct upload URL:
```json
{
  "id": "abc123",
  "key": "abc123def456",
  "filename": "screenshot.png",
  "content_type": "image/png",
  "byte_size": 12345,
  "checksum": "GQ5SqLsM7ylnji0Wgd9wNA==",
  "direct_upload": {
    "url": "https://storage.example.com/...",
    "headers": {
      "Content-Type": "image/png",
      "Content-MD5": "GQ5SqLsM7ylnji0Wgd9wNA=="
    }
  },
  "signed_id": "eyJfcmFpbHMi..."
}
```

### 2. Upload File to Storage

```bash
curl -X PUT \
  -H "Content-Type: image/png" \
  -H "Content-MD5: GQ5SqLsM7ylnji0Wgd9wNA==" \
  --data-binary @screenshot.png \
  "https://storage.example.com/..."
```

### 3. Attach to Card or Comment

Use the `signed_id` in rich text with `<action-text-attachment>`:

```json
{
  "card": {
    "title": "Card with image",
    "description": "<p>Here's a screenshot:</p><action-text-attachment sgid=\"eyJfcmFpbHMi..."></action-text-attachment>"
  }
}
```

### Card Header Image

Cards can have a header image (separate from attachments in description):

```bash
# Upload card header image (multipart/form-data)
curl -X POST \
  -H "Authorization: Bearer $FIZZY_TOKEN" \
  -F "card[title]=My Card" \
  -F "card[image]=@/path/to/image.jpg" \
  "${FIZZY_BASE_URL}/${ACCOUNT}/boards/${BOARD_ID}/cards"
```

Or update existing card:
```bash
curl -X PUT \
  -H "Authorization: Bearer $FIZZY_TOKEN" \
  -F "card[image]=@/path/to/image.jpg" \
  "${FIZZY_BASE_URL}/${ACCOUNT}/cards/${CARD_NUMBER}"
```

Remove header image:
```bash
curl -X DELETE \
  -H "Authorization: Bearer $FIZZY_TOKEN" \
  "${FIZZY_BASE_URL}/${ACCOUNT}/cards/${CARD_NUMBER}/image"
```

## Rich Text

Description and comment fields accept HTML (sanitized):

```json
{
  "card": {
    "title": "My card",
    "description": "<p>Bold: <strong>text</strong></p><ul><li>Item</li></ul>"
  }
}
```

## Error Handling

| Status | Meaning |
|--------|---------|
| 400    | Malformed request |
| 401    | Invalid/missing token |
| 403    | No permission |
| 404    | Resource not found or no access |
| 422    | Validation error (check response body) |

## Examples

### Create a card

```bash
curl -X POST \
  -H "Authorization: Bearer $FIZZY_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"card":{"title":"New task","description":"<p>Details here</p>"}}' \
  "$FIZZY_BASE_URL/$ACCOUNT/boards/$BOARD_ID/cards"
```

### Add comment to card

```bash
curl -X POST \
  -H "Authorization: Bearer $FIZZY_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"comment":{"body":"Done!"}}' \
  "$FIZZY_BASE_URL/$ACCOUNT/cards/$CARD_NUMBER/comments"
```

### Toggle tag on card

```bash
curl -X POST \
  -H "Authorization: Bearer $FIZZY_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"tag_title":"bug"}' \
  "$FIZZY_BASE_URL/$ACCOUNT/cards/$CARD_NUMBER/taggings"
```

### Assign user to card

```bash
curl -X POST \
  -H "Authorization: Bearer $FIZZY_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"assignee_id":"USER_ID"}' \
  "$FIZZY_BASE_URL/$ACCOUNT/cards/$CARD_NUMBER/assignments"
```
