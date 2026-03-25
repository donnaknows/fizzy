# Fizzy Skill

Interact with Fizzy (Basecamp's task board app) via API — boards, cards, columns, comments, tags, assignments, and file uploads.

## Authentication

Three env vars are required. Inject them via OpenClaw SecretRefs or your shell environment:

| Variable | Description |
|---|---|
| `FIZZY_TOKEN` | Personal access token |
| `FIZZY_BASE_URL` | Base URL of your Fizzy instance (e.g. `https://fizzy.example.com`) |
| `FIZZY_ACCOUNT` | Account slug (e.g. `/897362094`); auto-discovered from `/my/identity` if unset |

**Do not hardcode tokens or hostnames in this repo.** Keep machine-specific values in your local config.

### OpenClaw config example

```json
{
  "skills": {
    "entries": {
      "fizzy": {
        "enabled": true,
        "apiKey": {
          "source": "env",
          "provider": "default",
          "id": "FIZZY_TOKEN"
        },
        "env": {
          "FIZZY_BASE_URL": "https://fizzy.example.com",
          "FIZZY_ACCOUNT": "/897362094"
        }
      }
    }
  }
}
```

## CLI Quick Reference

```bash
FZ="node ./scripts/fizzy.js"
```

### Boards
```bash
$FZ boards:list
$FZ board:create --name "Board Name"
$FZ board:update --board-id ID --name "New Name"
$FZ board:delete --board-id ID
$FZ columns:list --board-id ID
```

### Cards
```bash
$FZ cards:list
$FZ card:get <card_number>
$FZ card:create --board-id ID --title TITLE [--description HTML]
$FZ card:update --card-number NUM [--title TITLE] [--description HTML]
$FZ card:delete --card-number NUM
$FZ card:close --card-number NUM     # → "done"
$FZ card:reopen --card-number NUM    # → "maybe"
$FZ card:assign --card-number NUM --user-id USER_ID   # toggle assignment
$FZ card:tag --card-number NUM --tag "tag name"       # toggle tag
$FZ card:move --card-number NUM --column-id COLUMN_ID  # custom columns only
$FZ card:image --card-number NUM --file /path/to/image.jpg
$FZ card:remove-image --card-number NUM
```

### Comments
```bash
$FZ comments:list --card-number NUM
$FZ comment:add --card-number NUM --body TEXT
```

### Other
```bash
$FZ tags:list
$FZ users:list
$FZ user:update --user-id ID [--name "New Name"] [--file /path/to/avatar.jpg]
$FZ upload --file /path/to/file   # returns signed_id for embedding in descriptions
$FZ identity
```

## Important Notes

- **Built-in sections** (maybe / not now / done) are **card states**, not columns. Move between them with `card:close`, `card:reopen`, or by PATCHing `postponed: true` directly.
- **`columns:list`** only returns custom columns — returns `[]` if none exist.
- **`card:create` and `comment:add`** return empty string on success (API 201 with no body). Verify with `cards:list` or `card:get`.
- **`card:tag` and `card:assign`** are toggles — call again to remove.
- **Quote HTML carefully** — use single quotes for shell strings containing HTML. Example:
  ```bash
  $FZ card:create --board-id ID --title "Task" --description '<p>It is "great"</p>'
  ```

## File Embedding

```bash
SGID=$($FZ upload --file /tmp/image.png | grep "Signed ID:" | awk '{print $3}')
$FZ card:update --card-number NUM \
  --description '<p>See attached:</p><action-text-attachment sgid="'"$SGID"'"></action-text-attachment>'
```

## Finding IDs

```bash
$FZ boards:list          # board IDs
$FZ columns:list --board-id ID   # column IDs
$FZ users:list           # user IDs
```

## Releases

This repo uses **Release Please** for semver releases.

Use conventional commits:

- `fix:` → patch release
- `feat:` → minor release
- `feat!:` or `BREAKING CHANGE:` → major release
- `docs:`, `chore:`, `test:` → usually no release by themselves

Current baseline tag: `v1.0.0`.
