# Auto-Chest Routing Design

## Overview

When a user stores a memory without specifying a chest, the system automatically determines which chest it belongs to using OpenViking semantic similarity, keyword-based seed categories, and dynamic chest creation. This runs before auto-sort (path assignment) — the flow is: auto-chest (which chest?) then auto-sort (which path within that chest?).

---

## Section 1: Auto-Chest Resolution

New `ChestRouter` service with a `resolve(userId, l0, l1)` method:

1. Fetch all user's chests (capped at 50 — if more, skip OpenViking and use keyword-only)
2. For each chest, query OpenViking `ContextService.find(userId, l0 + " " + l1, 1, 0, chest.name)` to get the top match score. This is N queries for N chests — acceptable for typical usage (< 20 chests). For users with many chests, keyword fallback avoids the N+1 cost.
3. Pick the highest-scoring chest above a configurable threshold (default `CHEST_SIMILARITY_THRESHOLD = 0.4`, stored as a constant). OpenViking scores are 0–1 normalized.
4. If no chest scores above threshold, check seed categories via keyword heuristic
5. If a matching seed chest doesn't exist yet, create it using Prisma `upsert` on `{ userId_name }` to handle concurrent creation races (with `isAutoCreated: true`, `isPublic: true`)
6. If nothing matches seed keywords, create a new chest named from l0 using slug extraction: `l0.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)` (with `isAutoCreated: true`). Also uses `upsert` for concurrency safety.
7. Return `{ chestName, chestId, isNew }`

**Fallback when OpenViking is unreachable:** Skip step 2–3 entirely, fall through to keyword matching (step 4). If keywords also don't match, route to the `default` chest rather than creating a new one (avoids polluting chest list due to transient failures).

---

## Section 2: Seed Chest Configuration

Seed chests are defined in config, not hardcoded in the database:

```typescript
const SEED_CHESTS = [
  { name: 'work', keywords: ['project', 'client', 'meeting', 'deadline', 'team', 'sprint', 'deploy', 'prod'] },
  { name: 'personal', keywords: ['family', 'friend', 'hobby', 'vacation', 'home', 'birthday'] },
  { name: 'health', keywords: ['doctor', 'dentist', 'gym', 'workout', 'diet', 'sleep', 'medication'] },
  { name: 'finance', keywords: ['budget', 'invest', 'salary', 'tax', 'expense', 'payment', 'subscription'] },
  { name: 'learning', keywords: ['course', 'book', 'tutorial', 'study', 'skill', 'certificate', 'lecture'] },
  { name: 'tools', keywords: ['config', 'setup', 'editor', 'plugin', 'workflow', 'terminal', 'dotfiles'] },
];
```

Seed chests are created lazily — only when a memory first matches their keywords. Created with `isPublic: true` so all agents can access by default.

Keyword match is a fallback — OpenViking similarity is tried first. Keywords only trigger when OpenViking returns no strong match AND the memory doesn't clearly belong to an existing custom chest.

---

## Section 3: MCP Client Flow + API Endpoint

Chest resolution is determined via a server call that must complete before client-side encryption, because the chest name is part of the HKDF salt (`chestName + "/" + uri`).

### New Endpoint

`POST /v1/memory/auto-chest`
- Request: `{ l0: string, l1: string }` — validated with `z.object({ l0: z.string().min(1).max(500), l1: z.string().min(1).max(10000) })`
- Response: `{ chestName: string, chestId: string, isNew: boolean }`
- Server calls `ChestRouter.resolve(userId, l0, l1)`
- **Route registration:** Uses `{ preHandler: requirePermission('remember') }` only — NO `chestGuard`, because no chest is known yet. The endpoint resolves the chest itself.

### Updated MCP Remember Flow

When user omits both `--chest` flag AND `path`:

1. MCP server generates l0/l1 summaries from content
2. Calls `POST /v1/memory/auto-chest` → gets `{ chestName, chestId }`
3. Calls `POST /v1/memory/auto-sort?chest=<chestName>` → gets `{ uri }`
4. Encrypts with `HKDF(masterKey, chestName + "/" + uri)`
5. Calls `POST /v1/memory/remember?chest=<chestName>` with encrypted content
6. Reports to user: `Remembered at acme-corp → entities/tech-stack`

When `--chest` flag IS set — skip step 2, use the flag value. The existing auto-sort behavior (when path is omitted) already works correctly and needs no changes.

---

## Section 4: PWA Changes

Minimal changes to existing v0.2 chest UI:

- Chest list renders auto-created chests the same as manual ones
- Memory count badge on each chest card — `ChestService.list` updated to include `_count: { select: { memories: true } }` in the Prisma query
- Small "AUTO" label on chests where `isAutoCreated: true`
- Users can delete auto-created chests — future memories that would've matched will create a new one or fall to a different match

No new pages needed.

---

## Section 5: Database + Service Changes

### Chest Model

Add one field:
```prisma
isAutoCreated Boolean @default(false) @map("is_auto_created")
```

### ChestService Changes

- `create` input type gains optional `isAutoCreated?: boolean`
- `list` includes memory count via Prisma `_count`

### New Files

| File | Responsibility |
|------|---------------|
| `src/services/chest-router.ts` | ChestRouter — resolve logic, seed config, OpenViking similarity scoring |
| `src/tests/services/chest-router.test.ts` | Unit tests for routing logic |

### Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `isAutoCreated` to Chest model |
| `src/services/chest.ts` | Add `isAutoCreated` to CreateChestInput; include `_count` in list |
| `src/routes/memory.ts` | Add `POST /v1/memory/auto-chest` endpoint (no chestGuard) |
| `src/index.ts` | Inject ChestRouter into memory routes |
| `packages/mcp-server/src/client.ts` | Add `autoChest(l0, l1)` method |
| `packages/mcp-server/src/tools/remember.ts` | Call auto-chest before auto-sort when no `--chest` flag |
| `packages/pwa/src/api/client.ts` | Add `ChestItem.isAutoCreated` + `memoryCount` to interface |
| `packages/pwa/src/pages/Chests.tsx` | Show "AUTO" badge + memory count on chest cards |

### No Data Migration

Existing chests stay as-is (`isAutoCreated` defaults to `false`). Seed chests are created lazily on first match.

---

## Implementation Order

1. Prisma schema — add `isAutoCreated` field + migration
2. ChestService — add `isAutoCreated` to create input, `_count` to list
3. ChestRouter service + tests
4. API endpoint `POST /v1/memory/auto-chest` (no chestGuard)
5. MCP client `autoChest()` method + updated remember flow
6. PWA "AUTO" badge + memory count on chest cards
