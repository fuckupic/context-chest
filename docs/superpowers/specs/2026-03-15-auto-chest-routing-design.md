# Auto-Chest Routing Design

## Overview

When a user stores a memory without specifying a chest, the system automatically determines which chest it belongs to using OpenViking semantic similarity, keyword-based seed categories, and dynamic chest creation. This runs before auto-sort (path assignment) — the flow is: auto-chest (which chest?) then auto-sort (which path within that chest?).

---

## Section 1: Auto-Chest Resolution

New `ChestRouter` service with a `resolve(userId, l0, l1)` method:

1. Fetch all user's chests
2. For each chest, query OpenViking for similarity between the new memory and that chest's memory index
3. Pick the highest-scoring chest above a threshold (0.4)
4. If no chest scores above threshold, check seed categories via keyword heuristic
5. If a matching seed chest doesn't exist yet, create it (with `isAutoCreated: true`, `isPublic: true`)
6. If nothing matches at all, create a new chest named from the dominant entity/topic in l0 (with `isAutoCreated: true`)
7. Return `{ chestName, chestId, isNew }`

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

Chest resolution happens client-side before encryption because the chest name is part of the HKDF salt.

### New Endpoint

`POST /v1/memory/auto-chest`
- Request: `{ l0: string, l1: string }`
- Response: `{ chestName: string, chestId: string, isNew: boolean }`
- Server calls `ChestRouter.resolve(userId, l0, l1)`

### Updated MCP Remember Flow

When user omits both `--chest` flag AND `path`:

1. MCP server generates l0/l1 summaries from content
2. Calls `POST /v1/memory/auto-chest` → gets `{ chestName, chestId }`
3. Calls `POST /v1/memory/auto-sort?chest=<chestName>` → gets `{ uri }`
4. Encrypts with `HKDF(masterKey, chestName + "/" + uri)`
5. Calls `POST /v1/memory/remember?chest=<chestName>` with encrypted content
6. Reports to user: `Remembered at acme-corp → entities/tech-stack`

When `--chest` flag IS set — skip step 2, use the flag value. Auto-sort still runs for path assignment.

---

## Section 4: PWA Changes

Minimal changes to existing v0.2 chest UI:

- Chest list renders auto-created chests the same as manual ones
- Memory count badge on each chest card (data available from API)
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

### New Files

| File | Responsibility |
|------|---------------|
| `src/services/chest-router.ts` | ChestRouter — resolve logic, seed config, OpenViking similarity scoring |
| `src/tests/services/chest-router.test.ts` | Unit tests for routing logic |

### Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `isAutoCreated` to Chest model |
| `src/routes/memory.ts` | Add `POST /v1/memory/auto-chest` endpoint |
| `src/index.ts` | Inject ChestRouter into memory routes |
| `packages/mcp-server/src/client.ts` | Add `autoChest(l0, l1)` method |
| `packages/mcp-server/src/tools/remember.ts` | Call auto-chest before auto-sort when no `--chest` flag |
| `packages/pwa/src/pages/Chests.tsx` | Show "AUTO" badge on auto-created chests |

### No Data Migration

Existing chests stay as-is (`isAutoCreated` defaults to `false`). Seed chests are created lazily on first match.

---

## Implementation Order

1. Prisma schema — add `isAutoCreated` field + migration
2. ChestRouter service + tests
3. API endpoint `POST /v1/memory/auto-chest`
4. MCP client `autoChest()` method + updated remember flow
5. PWA "AUTO" badge on chest cards
