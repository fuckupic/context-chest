# Context Chest v0.2 — Multi-Chest + Auto-Sort Design

## Overview

Users get multiple isolated chests per project. OpenViking auto-categorizes memories. Agents only see chests they're granted access to. Existing v0.1 memories migrate into a "default" chest with re-encrypted content using the new per-chest key derivation scheme.

---

## Section 1: Database Schema

### New Models

**Chest** — an isolated memory namespace per user:
- `id` (UUID, PK)
- `userId` (FK → User)
- `name` (string, unique per user)
- `description` (optional string)
- `createdAt` (timestamp)
- Constraint: `@@unique([userId, name])`

**ChestPermission** — per-agent access control on a chest:
- `id` (UUID, PK)
- `chestId` (FK → Chest, cascade delete)
- `agentName` (string)
- `canRead` (boolean, default true)
- `canWrite` (boolean, default true)
- Constraint: `@@unique([chestId, agentName])`

### Modified Models

**MemoryEntry** gains:
- `chestId` (FK → Chest, required after migration)

### Migration Strategy

1. Create `chests` and `chest_permissions` tables
2. Insert a "default" chest for each distinct `user_id` in `memory_entries`
3. Backfill `chest_id` on all existing entries to their user's default chest
4. Alter `chest_id` to NOT NULL

---

## Section 2: API Changes

### New Chest Endpoints (`/v1/chests`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/chests` | Create a chest (name, description) |
| GET | `/v1/chests` | List user's chests |
| PUT | `/v1/chests/:id/permissions` | Set agent access (array of `{agentName, canRead, canWrite}`) |
| DELETE | `/v1/chests/:id` | Delete chest + cascade (blocked for "default") |

### Existing Endpoints Gain `?chest=` Query Param

All memory endpoints accept `?chest=<name>` (defaults to "default"):
- `POST /v1/memory/remember?chest=acme-corp`
- `POST /v1/memory/recall?chest=acme-corp`
- `GET /v1/memory/browse?chest=acme-corp`
- `GET /v1/memory/content/*?chest=acme-corp`
- `DELETE /v1/memory/forget/*?chest=acme-corp`
- `GET /v1/memory/list?chest=acme-corp`

Session endpoints also accept `?chest=` — sessions are scoped to a chest, and extracted memories go into that chest.

### Permission Enforcement (Fastify preHandler)

1. Read `X-Agent-Name` header (already sent by MCP client)
2. Read chest from `?chest=` param or `X-Chest` header (default: "default")
3. Look up `ChestPermission` for chest + agent
4. No permission row → deny (except "default" chest which allows all for backwards compat)
5. Write endpoints (remember, forget) check `canWrite`; read endpoints check `canRead`

### New Migration Endpoint

- `PUT /v1/memory/content/:uri` — update encrypted content in-place (for re-encryption migration only). Auth-guarded, validates SHA-256, updates S3 + DB.

---

## Section 3: Encryption

### Per-Chest Key Derivation

```
Current (v0.1):  HKDF(masterKey, uri,                    'context-chest-l2', 32)
New (v0.2):      HKDF(masterKey, chestName + "/" + uri,   'context-chest-l2', 32)
```

Different chest = different derived key = different ciphertext for identical content. Compromising one chest's keys reveals nothing about another.

Master key wrapping (`wrapMasterKey`/`unwrapMasterKey`) is unchanged.

### Re-Encryption Migration

All v0.1 memories must be re-encrypted with the new salt `"default/" + uri`.

**CLI command: `context-chest migrate-v2`**

1. Authenticate and unwrap master key (same as login flow)
2. Fetch all memories via `GET /v1/memory/list`
3. For each memory: download encrypted L2 via `GET /v1/memory/content/*`
4. Decrypt with old scheme: `HKDF(masterKey, uri, 'context-chest-l2', 32)`
5. Re-encrypt with new scheme: `HKDF(masterKey, "default/" + uri, 'context-chest-l2', 32)`
6. Upload via `PUT /v1/memory/content/*` with new SHA-256
7. Report progress and failures

---

## Section 4: MCP Server Changes

### `--chest` CLI Flag

```
npx context-chest-mcp --chest acme-corp
```

Parsed from `process.argv` in `main()`. No flag defaults to `"default"`.

### `X-Chest` Header

Added to every API request in `client.ts`, same pattern as `X-Agent-Name`. API server reads `X-Chest` header (header takes precedence over `?chest=` query param if both present).

### Crypto Changes

`deriveItemKey(masterKey, uri)` becomes `deriveItemKey(masterKey, chestName, uri)` with salt `chestName + "/" + uri`. All call sites in `index.ts` pass the chest name from the `--chest` flag.

### Migration CLI

New command `context-chest migrate-v2` added to `cli.ts` alongside existing `context-chest login`.

---

## Section 5: PWA Changes

### Chest Switcher (Sidebar)

- Dropdown above nav links showing current active chest
- Lists all chests from `GET /v1/chests`
- Selection stored in React context; all API calls include `?chest=` param
- Defaults to "default" on load

### Chest Management Page (`/chests`)

- Create chest form (name + optional description)
- List of chests with edit/delete actions
- "default" chest shown but delete disabled
- Nav link in sidebar between "Agents" and "Settings"

### Permission Editor (Per Chest)

- Table of agents (from `GET /v1/connect/agents`) with read/write toggles
- "default" chest defaults to all-access; others default to no-access
- Saves via `PUT /v1/chests/:id/permissions`

### Scoped Memories

- Tree view and search only show memories from selected chest
- `MemoryDetail` unchanged except crypto uses `chestName + "/" + uri` salt

### Browser-Side Crypto

PWA crypto utils gain `chestName` parameter, same derivation change as MCP server.

---

## Section 6: OpenViking Auto-Sort

### Trigger

`POST /v1/memory/remember` called with `autoSort: true` (or without a `uri`).

### Flow

1. MCP `context-chest_remember`: if user omits path, sets `autoSort: true`
2. API receives content with `l0`, `l1` summaries
3. Server calls new `ContextService.categorize()` method
4. OpenViking returns: category (`profile/preferences/entities/events/cases/patterns`) + suggested path based on semantic similarity to existing memories in the chest
5. Server uses suggested path as `uri`, stores memory normally
6. Response includes auto-generated path for MCP server to report

### `ContextService.categorize()`

- POST to OpenViking `/api/v1/search/find` with content against chest's index
- Uses top results' paths to infer category and naming
- Falls back to keyword heuristic from `l0` if OpenViking unavailable

### Per-Chest Vector Index

OpenViking user root becomes `viking://user/${userId}/chests/${chestName}/memories` (was `viking://user/${userId}/memories`). Isolates vector indexes per chest.

### MCP Tool Change

`context-chest_remember` tool's `path` parameter becomes optional. When omitted, response includes the auto-assigned path.

---

## Migration Path

- v0.1 memories go into a "default" chest
- All v0.1 encrypted content re-encrypted with new `"default/" + uri` salt via `context-chest migrate-v2` CLI
- No breaking changes to existing API (chest param optional, defaults to "default")
- Existing MCP configs work without `--chest` flag

## Implementation Order

1. Chest model + API endpoints
2. MCP server `--chest` flag + `X-Chest` header
3. PWA chest switcher + management
4. Per-chest encryption keys + migration CLI
5. Agent permission enforcement
6. OpenViking auto-sort integration
