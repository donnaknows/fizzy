---
name: fizzy
description: Interact with Fizzy (Basecamp's task board app) via API. Use when managing cards, boards, comments, steps, tags, or notifications in Fizzy. Supports creating, updating, deleting, and querying cards; managing comments and reactions; organizing with columns and tags; handling user assignments; and uploading images and file attachments.
metadata:
  {"openclaw": {"primaryEnv": "FIZZY_TOKEN"}}
---

# Fizzy Skill

Interact with Fizzy task boards programmatically.

**Authentication:** see `README.md`.

## Quick Reference

```bash
# Shorthand alias (run from the skill directory)
FZ="node ./scripts/fizzy.js"
```

## All Available Commands

### Identity & Account

#### `identity`
Get current account identity and associated accounts.
```bash
$FZ identity
# Returns: id, accounts[] with name/slug/user details
```

---

### Boards

#### `boards:list`
List all boards in the account.
```bash
$FZ boards:list
# Returns: array of boards with id, name, creator, url
```

#### `board:create --name "Board Name"`
Create a new board.
```bash
$FZ board:create --name "Projects"
# Returns: "Board created successfully" + board details
```

#### `board:update --board-id ID --name "New Name"`
Rename a board.
```bash
$FZ board:update --board-id 03fpcw6y1piunqnruwqujojus --name "My Renamed Board"
# Returns: "Board updated successfully"
```

#### `board:delete --board-id ID`
Delete a board permanently.
```bash
$FZ board:delete --board-id 03fpcw6y1piunqnruwqujojus
# Returns: "Board deleted successfully"
```

#### `columns:list --board-id ID`
List custom columns on a specific board.
```bash
$FZ columns:list --board-id 03fp6lagn83u887kuek15jx68
# Returns: array of columns with id, name, color, created_at
```

**Important:** Fizzy has three built-in UI sections ("maybe", "not now", "done") that appear in the browser but are **not columns** — they are card states:

| UI Section | API State | How to move |
|------------|-----------|-------------|
| "maybe" | `closed: false, postponed: false` | Default for new cards |
| "not now" | `postponed: true` | Use `card:postpone` |
| "done" | `closed: true` | Use `card:close` |

The `columns:list` endpoint only returns **custom columns** you create. If it returns `[]`, that's normal — you haven't created any custom columns yet.

---

### Cards

#### `cards:list`
List all cards across the account.
```bash
$FZ cards:list
# Returns: full card objects with board, tags, assignees, comments_url, etc.
```

#### `card:get <card_number>`
Get a specific card by its number.
```bash
$FZ card:get 7
# Returns: full card object including steps[]
```

#### `card:create --board-id ID --title TITLE [--description HTML]`
Create a new card on a board. Returns `""` on success (API returns 201 with no body). Use `cards:list` or `card:get` to verify.
```bash
$FZ card:create --board-id 03fp6lagn83u887kuek15jx68 --title "New task" --description "<p>Details here</p>"
# Note: returns empty string; card is created. Check cards:list to find its number.
```

#### `card:update --card-number NUM [--title TITLE] [--description HTML]`
Update a card's title and/or description. Returns updated card JSON.
```bash
$FZ card:update --card-number 7 --title "Updated title"
$FZ card:update --card-number 7 --description "<p>New description</p>"
```

**Important:** This does **not** move a card between boards/projects. Cross-board moves were tested with both JSON `card.board_id` and form-style `card[board_id]` and returned `400 Bad Request`.

#### `card:delete --card-number NUM`
Permanently delete a card. **Irreversible.**
```bash
$FZ card:delete --card-number 22
# Returns: "Card deleted successfully"
```

#### `card:close --card-number NUM`
Mark a card as closed (archived).
```bash
$FZ card:close --card-number 7
# Returns: "Card closed successfully"
```

#### `card:reopen --card-number NUM`
Reopen a previously closed card.
```bash
$FZ card:reopen --card-number 7
# Returns: "Card reopened successfully"
```

#### `card:assign --card-number NUM --user-id USER_ID`
Toggle user assignment on a card. Call again to unassign.
```bash
$FZ card:assign --card-number 7 --user-id 03fp6piilrk1n6fp0tqpsbnvt
# Returns: "Assignment toggled successfully"
```

#### `card:tag --card-number NUM --tag "tag name"`
Toggle a tag on a card. If the tag doesn't exist, it's created. Call again to remove.
```bash
$FZ card:tag --card-number 7 --tag "design"
# Returns: "Tag toggled successfully"
```

#### `card:move --card-number NUM --column-id COLUMN_ID`
Move a card to a specific **custom column** on the board. This only works for columns you create via the API or UI — not the built-in "maybe"/"not now"/"done" sections.
```bash
$FZ card:move --card-number 7 --column-id 03fpbiuccvll7peqy9m288tb9
# Returns: "Card moved successfully"
```

**To move between built-in sections**, use state commands instead:
- `card:close` → moves to "done"
- `card:reopen` → moves back to "maybe"

**Note:** There is no direct "postpone" command in the CLI. Postponing (`postponed: true`) moves cards to "not now" — this can only be done via the Fizzy UI or by directly PATCHing the card via API.

#### `card:image --card-number NUM --file /path/to/image.jpg`
Upload a header image for a card. Supports jpg, jpeg, png, gif, webp.
```bash
$FZ card:image --card-number 7 --file /tmp/banner.jpg
# Returns: updated card JSON
```

#### `card:remove-image --card-number NUM`
Remove the header image from a card.
```bash
$FZ card:remove-image --card-number 7
# Returns: "Image removed successfully"
```

---

### Comments

#### `comments:list --card-number NUM`
List all comments on a card, including system audit entries (title changes, assignments, etc.).
```bash
$FZ comments:list --card-number 7
# Returns: array of comment objects with body.plain_text, body.html, creator, reactions_url
```

#### `comment:add --card-number NUM --body TEXT`
Add a comment to a card. Returns `""` on success (API returns 201 with no body).
```bash
$FZ comment:add --card-number 7 --body "This is done!"
# Note: returns empty string; comment is created.
```

---

### Tags

#### `tags:list`
List all tags in the account.
```bash
$FZ tags:list
# Returns: array with id, title, created_at, url (filtered cards view)
```

---

### Users

#### `users:list`
List all users in the account.
```bash
$FZ users:list
# Returns: array with id, name, role, active, email_address, avatar_url
```

#### `user:update --user-id ID [--name "New Name"] [--file /path/to/avatar.jpg]`
Update a user's name and/or avatar image.
```bash
# Update name only
$FZ user:update --user-id 03fp6piilrk1n6fp0tqpsbnvt --name "Jane Example"

# Update avatar only
$FZ user:update --user-id 03fp6piilrk1n6fp0tqpsbnvt --file /tmp/avatar.jpg

# Update both
$FZ user:update --user-id 03fp6piilrk1n6fp0tqpsbnvt --name "Test User" --file /tmp/avatar.jpg
# Returns: "User updated successfully"
```

---

### File Uploads

#### `upload --file /path/to/file`
Direct upload a file to Active Storage for embedding in card descriptions.
Returns a `signed_id` to use in description HTML.
```bash
$FZ upload --file /tmp/screenshot.png
# Output includes: Signed ID: <id>
# Use in description: <action-text-attachment sgid="<signed_id>"></action-text-attachment>
```

---

## Common Workflows

### Find a board ID
```bash
$FZ boards:list
# Copy the "id" field of the board you want
```

### Move a card to another board/project

There is **no confirmed API-supported in-place board/project move** in the current Fizzy skill/API path.

Use this workaround:
1. `card:get` the source card
2. `card:create` a new card on the target board with the copied title/description
3. Reapply tags/assignments/comments/steps if needed
4. Verify the new card
5. `card:delete` the original card

### Find a column ID
```bash
$FZ columns:list --board-id BOARD_ID
# Copy the "id" of the target column
```

### Find user IDs
```bash
$FZ users:list
# Copy the "id" field for assignment or update commands
```

### Create and populate a card
```bash
# 1. Create the card
$FZ card:create --board-id BOARD_ID --title "My Task"

# 2. Find its number (it'll be the highest number in the list)
$FZ cards:list | python3 -c "import json,sys; cards=json.load(sys.stdin); print(max(c['number'] for c in cards))"

# 3. Assign, tag, and move it
$FZ card:assign --card-number NUM --user-id USER_ID
$FZ card:tag --card-number NUM --tag "design"
$FZ card:move --card-number NUM --column-id COLUMN_ID
```

### Embed an uploaded image in a description
```bash
# 1. Upload the file
SGID=$($FZ upload --file /tmp/image.png | grep "Signed ID:" | awk '{print $3}')

# 2. Use signed_id in card description
$FZ card:update --card-number NUM \
  --description "<p>See attached:</p><action-text-attachment sgid=\"$SGID\"></action-text-attachment>"
```

## Notes

### Quote Escaping in Shell Commands
When passing HTML descriptions or text with special characters (quotes, parentheses, etc.), **use single quotes** for the outer shell string to avoid escaping hell:

```bash
# ❌ BAD - double quotes break on nested quotes
$FZ card:create --board-id ID --title "Title" --description "<p>It's "great"</p>"

# ✅ GOOD - single quotes preserve everything inside
$FZ card:create --board-id ID --title "Title" --description '<p>It is "great"</p>'
```

If you must use double quotes, escape inner quotes with `\"` — but single quotes are strongly recommended for HTML content.

- **`card:create` and `comment:add`** return `""` because the Fizzy API responds with HTTP 201 and an empty body. The operation succeeds — verify with `card:get` or `cards:list`.
- **`comments:list`** includes system-generated audit comments (e.g., "Jane Example changed title from X to Y"), not just user comments.
- **`card:tag` and `card:assign`** are **toggles** — calling the same command twice removes the tag/assignment.
- **Card numbers** (used in most commands) are small integers visible in the UI and API. Card IDs are long alphanumeric strings used internally.
- The CLI uses normal HTTPS validation. If your Fizzy instance uses a private or self-signed certificate, trust it at the OS or Node.js level rather than disabling TLS in the script.

## API Reference

For complete endpoint documentation, see [references/API.md](references/API.md).
