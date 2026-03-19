# Auto-Chest Routing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically route memories to the right chest using OpenViking semantic similarity with keyword-based seed category fallback.

**Architecture:** New `ChestRouter` service resolves which chest a memory belongs to before encryption. Server exposes `POST /v1/memory/auto-chest` (no chestGuard). MCP client calls it before auto-sort when no `--chest` flag is set. Seed chests (work, personal, health, finance, learning, tools) are created lazily on first match.

**Tech Stack:** Fastify, Prisma, OpenViking (ContextService), Zod, React + TailwindCSS.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/services/chest-router.ts` | ChestRouter — resolve logic, seed config, OpenViking scoring, keyword fallback |
| `src/tests/services/chest-router.test.ts` | Unit tests for routing logic |

### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `isAutoCreated` boolean to Chest model |
| `src/services/chest.ts` | Add `isAutoCreated` to CreateChestInput; include `_count` in list |
| `src/routes/memory.ts` | Add `POST /v1/memory/auto-chest` endpoint (no chestGuard) |
| `src/index.ts` | Create ChestRouter, inject into memory routes |
| `packages/mcp-server/src/client.ts` | Add `autoChest(l0, l1)` method |
| `packages/mcp-server/src/tools/remember.ts` | Call auto-chest when no `--chest` flag and no path |
| `packages/pwa/src/api/client.ts` | Add `isAutoCreated` + `memoryCount` to ChestItem |
| `packages/pwa/src/pages/Chests.tsx` | Show AUTO badge + memory count |

---

## Chunk 1: Schema + Services + API + MCP + PWA

### Task 1: Prisma Schema — add isAutoCreated

**Files:**
- Modify: `prisma/schema.prisma:184-198` (Chest model)

- [ ] **Step 1: Add isAutoCreated field to Chest model**

In the Chest model, after `isPublic`, add:

```prisma
  isAutoCreated Boolean @default(false) @map("is_auto_created")
```

- [ ] **Step 2: Run migration**

Run: `DATABASE_URL="postgresql://context_chest:context_chest_dev@localhost:5433/context_chest" npx prisma migrate dev --name add_is_auto_created`

- [ ] **Step 3: Commit**

```bash
git add prisma/ && git commit -m "feat: add isAutoCreated field to Chest model"
```

---

### Task 2: Update ChestService — isAutoCreated + _count

**Files:**
- Modify: `src/services/chest.ts`
- Modify: `src/tests/services/chest.test.ts`

- [ ] **Step 1: Add isAutoCreated to CreateChestInput**

In `src/services/chest.ts`, update the interface:

```typescript
interface CreateChestInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  isAutoCreated?: boolean;
}
```

Update the `create` method's data to include it:

```typescript
data: { userId, name: input.name, description: input.description, isPublic: input.isPublic ?? false, isAutoCreated: input.isAutoCreated ?? false },
```

- [ ] **Step 2: Update list to include memory count**

Change the `list` method:

```typescript
async list(userId: string): Promise<(Chest & { _count: { memories: number } })[]> {
  return this.prisma.chest.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { memories: true } } },
  });
}
```

- [ ] **Step 3: Add upsertByName method for concurrency-safe creation**

```typescript
async upsertByName(userId: string, input: CreateChestInput): Promise<Chest> {
  return this.prisma.chest.upsert({
    where: { userId_name: { userId, name: input.name } },
    create: { userId, name: input.name, description: input.description, isPublic: input.isPublic ?? false, isAutoCreated: input.isAutoCreated ?? false },
    update: {},
  });
}
```

- [ ] **Step 4: Update tests — add test for isAutoCreated and upsertByName**

In `src/tests/services/chest.test.ts`, add:

```typescript
it('should create a chest with isAutoCreated flag', async () => {
  mockPrisma.chest.create.mockResolvedValue({ id: 'c1', name: 'work', isAutoCreated: true });
  const result = await service.create('user-1', { name: 'work', isAutoCreated: true });
  expect(mockPrisma.chest.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ isAutoCreated: true }),
  });
});

it('should upsert chest by name for concurrency safety', async () => {
  mockPrisma.chest.upsert.mockResolvedValue({ id: 'c1', name: 'work' });
  await service.upsertByName('user-1', { name: 'work', isPublic: true, isAutoCreated: true });
  expect(mockPrisma.chest.upsert).toHaveBeenCalledWith({
    where: { userId_name: { userId: 'user-1', name: 'work' } },
    create: expect.objectContaining({ name: 'work', isAutoCreated: true }),
    update: {},
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npx jest src/tests/services/chest.test.ts --no-coverage`

- [ ] **Step 6: Commit**

```bash
git add src/services/chest.ts src/tests/services/chest.test.ts
git commit -m "feat: ChestService — isAutoCreated flag, memory count in list, upsertByName"
```

---

### Task 3: ChestRouter Service + Tests

**Files:**
- Create: `src/services/chest-router.ts`
- Create: `src/tests/services/chest-router.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/services/chest-router.test.ts`:

```typescript
import { ChestRouter } from '../../services/chest-router';

const mockChestService = {
  list: jest.fn(),
  upsertByName: jest.fn(),
  getOrCreateDefault: jest.fn(),
};

const mockContextService = {
  find: jest.fn(),
};

describe('ChestRouter', () => {
  let router: ChestRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    router = new ChestRouter(mockChestService as never, mockContextService as never);
  });

  describe('resolve', () => {
    it('should route to existing chest when OpenViking similarity is high', async () => {
      mockChestService.list.mockResolvedValue([
        { id: 'c1', name: 'acme-corp', isPublic: false },
      ]);
      mockContextService.find.mockResolvedValue({
        results: [{ uri: 'entities/db', score: 0.8 }],
        total: 1,
      });

      const result = await router.resolve('user-1', 'Acme uses PostgreSQL', 'Database info');
      expect(result.chestName).toBe('acme-corp');
      expect(result.isNew).toBe(false);
    });

    it('should fall back to seed keyword match when no OpenViking match', async () => {
      mockChestService.list.mockResolvedValue([]);
      mockContextService.find.mockResolvedValue({ results: [], total: 0 });
      mockChestService.upsertByName.mockResolvedValue({ id: 'c2', name: 'health' });

      const result = await router.resolve('user-1', 'dentist appointment tuesday', 'Medical');
      expect(result.chestName).toBe('health');
      expect(result.isNew).toBe(true);
    });

    it('should create slug chest when nothing matches', async () => {
      mockChestService.list.mockResolvedValue([]);
      mockContextService.find.mockResolvedValue({ results: [], total: 0 });
      mockChestService.upsertByName.mockResolvedValue({ id: 'c3', name: 'random-topic-here' });

      const result = await router.resolve('user-1', 'Random topic here', 'Details');
      expect(result.chestName).toBe('random-topic-here');
      expect(result.isNew).toBe(true);
    });

    it('should fall back to default chest when OpenViking is unreachable and no keyword match', async () => {
      mockChestService.list.mockResolvedValue([{ id: 'c1', name: 'acme-corp' }]);
      mockContextService.find.mockRejectedValue(new Error('OV down'));
      mockChestService.getOrCreateDefault.mockResolvedValue({ id: 'c-def', name: 'default' });

      const result = await router.resolve('user-1', 'Something vague', 'No keywords');
      expect(result.chestName).toBe('default');
    });

    it('should skip OpenViking when more than 50 chests', async () => {
      const manyChests = Array.from({ length: 51 }, (_, i) => ({ id: `c${i}`, name: `chest-${i}` }));
      mockChestService.list.mockResolvedValue(manyChests);
      mockChestService.getOrCreateDefault.mockResolvedValue({ id: 'c-def', name: 'default' });

      const result = await router.resolve('user-1', 'Something', 'Details');
      expect(mockContextService.find).not.toHaveBeenCalled();
    });

    it('should match existing seed chest instead of creating duplicate', async () => {
      mockChestService.list.mockResolvedValue([
        { id: 'c1', name: 'health', isPublic: true },
      ]);
      mockContextService.find.mockResolvedValue({ results: [], total: 0 });

      const result = await router.resolve('user-1', 'doctor appointment', 'Medical visit');
      expect(result.chestName).toBe('health');
      expect(result.isNew).toBe(false);
      expect(mockChestService.upsertByName).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx jest src/tests/services/chest-router.test.ts --no-coverage`

- [ ] **Step 3: Implement ChestRouter**

Create `src/services/chest-router.ts`:

```typescript
import { Chest } from '@prisma/client';
import { ChestService } from './chest';
import { ContextService } from './context';

const CHEST_SIMILARITY_THRESHOLD = 0.4;
const MAX_CHESTS_FOR_OV_SCAN = 50;

const SEED_CHESTS = [
  { name: 'work', keywords: ['project', 'client', 'meeting', 'deadline', 'team', 'sprint', 'deploy', 'prod'] },
  { name: 'personal', keywords: ['family', 'friend', 'hobby', 'vacation', 'home', 'birthday'] },
  { name: 'health', keywords: ['doctor', 'dentist', 'gym', 'workout', 'diet', 'sleep', 'medication'] },
  { name: 'finance', keywords: ['budget', 'invest', 'salary', 'tax', 'expense', 'payment', 'subscription'] },
  { name: 'learning', keywords: ['course', 'book', 'tutorial', 'study', 'skill', 'certificate', 'lecture'] },
  { name: 'tools', keywords: ['config', 'setup', 'editor', 'plugin', 'workflow', 'terminal', 'dotfiles'] },
];

interface ResolveResult {
  chestName: string;
  chestId: string;
  isNew: boolean;
}

export class ChestRouter {
  constructor(
    private readonly chestService: ChestService,
    private readonly contextService: ContextService
  ) {}

  async resolve(userId: string, l0: string, l1: string): Promise<ResolveResult> {
    const chests = await this.chestService.list(userId);

    // Step 1: Try OpenViking similarity (skip if too many chests)
    if (chests.length > 0 && chests.length <= MAX_CHESTS_FOR_OV_SCAN) {
      const ovMatch = await this.findBestChestByOV(userId, chests, l0, l1);
      if (ovMatch) {
        return { chestName: ovMatch.name, chestId: ovMatch.id, isNew: false };
      }
    }

    // Step 2: Try seed keyword match
    const seedMatch = this.findSeedMatch(l0, l1);
    if (seedMatch) {
      const existing = chests.find((c) => c.name === seedMatch);
      if (existing) {
        return { chestName: existing.name, chestId: existing.id, isNew: false };
      }
      const created = await this.chestService.upsertByName(userId, {
        name: seedMatch,
        isPublic: true,
        isAutoCreated: true,
      });
      return { chestName: created.name, chestId: created.id, isNew: true };
    }

    // Step 3: Create new chest from l0 slug, or fall back to default
    const slug = l0.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
    if (slug.length >= 2) {
      const existing = chests.find((c) => c.name === slug);
      if (existing) {
        return { chestName: existing.name, chestId: existing.id, isNew: false };
      }
      const created = await this.chestService.upsertByName(userId, {
        name: slug,
        isAutoCreated: true,
      });
      return { chestName: created.name, chestId: created.id, isNew: true };
    }

    // Final fallback: default chest
    const defaultChest = await this.chestService.getOrCreateDefault(userId);
    return { chestName: defaultChest.name, chestId: defaultChest.id, isNew: false };
  }

  private async findBestChestByOV(
    userId: string,
    chests: Chest[],
    l0: string,
    l1: string
  ): Promise<Chest | null> {
    const query = `${l0} ${l1}`;
    let bestChest: Chest | null = null;
    let bestScore = 0;

    for (const chest of chests) {
      try {
        const { results } = await this.contextService.find(userId, query, 1, 0, chest.name);
        const topScore = results[0]?.score ?? 0;
        if (topScore > bestScore && topScore >= CHEST_SIMILARITY_THRESHOLD) {
          bestScore = topScore;
          bestChest = chest;
        }
      } catch {
        // OpenViking unreachable — skip OV entirely, fall through to keywords
        return null;
      }
    }

    return bestChest;
  }

  private findSeedMatch(l0: string, l1: string): string | null {
    const text = `${l0} ${l1}`.toLowerCase();
    let bestSeed: string | null = null;
    let bestCount = 0;

    for (const seed of SEED_CHESTS) {
      const count = seed.keywords.filter((kw) => text.includes(kw)).length;
      if (count > bestCount) {
        bestCount = count;
        bestSeed = seed.name;
      }
    }

    return bestCount > 0 ? bestSeed : null;
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest src/tests/services/chest-router.test.ts --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add src/services/chest-router.ts src/tests/services/chest-router.test.ts
git commit -m "feat: ChestRouter service — OpenViking similarity, seed keywords, slug fallback"
```

---

### Task 4: API Endpoint + Wiring

**Files:**
- Modify: `src/routes/memory.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add ChestRouter to memory routes factory**

In `src/routes/memory.ts`, update the imports and function signature:

```typescript
import { ChestRouter } from '../services/chest-router';
```

Update the function signature to accept `chestRouter`:

```typescript
export function memoryRoutes(
  memoryService: MemoryService,
  usageService: UsageService,
  chestService: ChestService,
  chestRouter: ChestRouter
): FastifyPluginAsync {
```

- [ ] **Step 2: Add POST /auto-chest endpoint**

Inside the routes function, add (NO chestGuard — only requirePermission):

```typescript
// Auto-chest — resolve which chest a memory belongs to
fastify.post(
  '/auto-chest',
  { preHandler: requirePermission('remember') },
  async (request) => {
    const userId = (request as unknown as Record<string, unknown>).userId as string;
    const body = z.object({
      l0: z.string().min(1).max(500),
      l1: z.string().min(1).max(10000),
    }).parse(request.body);
    const result = await chestRouter.resolve(userId, body.l0, body.l1);
    return { success: true, data: result };
  }
);
```

- [ ] **Step 3: Update src/index.ts to create and inject ChestRouter**

Add import:

```typescript
import { ChestRouter } from './services/chest-router';
```

After `const chestService = new ChestService(prisma);`, add:

```typescript
const chestRouter = new ChestRouter(chestService, contextService);
```

Update route registration:

```typescript
app.register(memoryRoutes(memoryService, usageService, chestService, chestRouter), { prefix: '/v1/memory' });
```

- [ ] **Step 4: Run typecheck + tests**

Run: `npx tsc --noEmit && npx jest --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add src/routes/memory.ts src/index.ts
git commit -m "feat: POST /v1/memory/auto-chest endpoint + ChestRouter wiring"
```

---

### Task 5: MCP Client + Remember Flow

**Files:**
- Modify: `packages/mcp-server/src/client.ts`
- Modify: `packages/mcp-server/src/tools/remember.ts`

- [ ] **Step 1: Add autoChest method to MCP client**

In `packages/mcp-server/src/client.ts`, add after `autoSort`:

```typescript
async autoChest(l0: string, l1: string) {
  return this.request<{ success: boolean; data: { chestName: string; chestId: string; isNew: boolean } }>(
    'POST', '/v1/memory/auto-chest', { l0, l1 }
  );
}
```

- [ ] **Step 2: Update remember tool for auto-chest flow**

In `packages/mcp-server/src/tools/remember.ts`, update `handleRemember`:

The current flow is:
1. If path → use it
2. If no path → call autoSort → get URI → encrypt

The new flow adds auto-chest before auto-sort when `--chest` is `default` (meaning no explicit `--chest` flag was set):

```typescript
export async function handleRemember(
  input: RememberInput,
  client: ContextChestClient,
  masterKey: Buffer,
  chestName: string,
  generateSummaries: (content: string, uri?: string) => Promise<{ l0: string; l1: string }>
): Promise<string> {
  let activeChest = chestName;

  // Auto-chest: resolve which chest when using default (no --chest flag)
  if (activeChest === 'default' && !input.path) {
    const { l0: tempL0, l1: tempL1 } = await generateSummaries(input.content);
    try {
      const chestResult = await client.autoChest(tempL0, tempL1);
      activeChest = chestResult.data.chestName;
    } catch {
      // Fall back to default chest
    }
  }

  // Auto-sort: resolve path within the chest
  let uri: string;
  if (input.path) {
    uri = input.path;
  } else {
    const { l0: tempL0, l1: tempL1 } = await generateSummaries(input.content);
    try {
      const sortResult = await client.autoSort(tempL0, tempL1);
      uri = sortResult.data.uri;
    } catch {
      uri = `auto/${Date.now()}`;
    }
  }

  const { l0, l1 } = await generateSummaries(input.content, uri);
  const plaintext = Buffer.from(input.content, 'utf-8');
  const encryptedL2 = encryptL2(masterKey, activeChest, uri, plaintext);
  const hash = sha256(Buffer.from(encryptedL2, 'base64'));

  const result = await client.remember({ uri, l0, l1, encryptedL2, sha256: hash });
  const chestLabel = activeChest !== 'default' ? `${activeChest} → ` : '';
  return `Remembered at ${chestLabel}${result.data.uri}`;
}
```

**Note:** The `encryptL2` call uses `activeChest` (the resolved chest, not necessarily `chestName` from the flag). The `client.remember()` call sends the request with the `X-Chest` header still set to the original `chestName` from the flag — but since auto-chest already created the chest server-side, and the `autoSort` + `remember` calls go through the default chest's API... Actually, the MCP client's `X-Chest` header is fixed at construction time. When auto-chest resolves to a different chest name, the subsequent `autoSort` and `remember` calls need to target that chest.

**Fix:** The `autoSort` and `remember` calls must include `?chest=<activeChest>` in the URL. Update:

The simplest approach — add optional `chest` param to `autoSort` and `remember` in client.ts:

```typescript
async autoSort(l0: string, l1: string, chest?: string) {
  const qs = chest ? `?chest=${encodeURIComponent(chest)}` : '';
  return this.request<{ success: boolean; data: { uri: string } }>('POST', `/v1/memory/auto-sort${qs}`, { l0, l1 });
}

async remember(input: RememberInput & { chest?: string }) {
  const qs = input.chest ? `?chest=${encodeURIComponent(input.chest)}` : '';
  return this.request<{ success: boolean; data: { uri: string; createdAt: string } }>(
    'POST', `/v1/memory/remember${qs}`, { uri: input.uri, l0: input.l0, l1: input.l1, encryptedL2: input.encryptedL2, sha256: input.sha256 }
  );
}
```

Then in remember.ts, pass `chest: activeChest` to `autoSort` and `remember`:

```typescript
const sortResult = await client.autoSort(tempL0, tempL1, activeChest);
// ...
const result = await client.remember({ uri, l0, l1, encryptedL2, sha256: hash, chest: activeChest });
```

- [ ] **Step 3: Run MCP typecheck**

Run: `cd packages/mcp-server && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-server/src/client.ts packages/mcp-server/src/tools/remember.ts
git commit -m "feat: MCP auto-chest — resolve chest before auto-sort in remember flow"
```

---

### Task 6: PWA — AUTO Badge + Memory Count

**Files:**
- Modify: `packages/pwa/src/api/client.ts`
- Modify: `packages/pwa/src/pages/Chests.tsx`

- [ ] **Step 1: Update ChestItem interface in PWA client**

In `packages/pwa/src/api/client.ts`, update `ChestItem`:

```typescript
interface ChestItem {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isAutoCreated: boolean;
  createdAt: string;
  _count?: { memories: number };
}
```

- [ ] **Step 2: Update Chests page with AUTO badge + count**

In `packages/pwa/src/pages/Chests.tsx`, update the chest list rendering. After the chest name span:

```typescript
{chest.isAutoCreated && (
  <span className="ml-2 font-pixel text-[9px] text-cc-pink tracking-wider border border-cc-pink px-1">AUTO</span>
)}
{chest.isPublic && (
  <span className="ml-2 font-pixel text-[9px] text-cc-muted tracking-wider">PUBLIC</span>
)}
```

Add memory count to the description area:

```typescript
<p className="text-xs text-cc-muted font-mono mt-0.5">
  {chest._count?.memories ?? 0} memories{chest.description ? ` — ${chest.description}` : ''}
</p>
```

Also update `ChestItem` interface in `packages/pwa/src/context/chest-context.tsx` to include `isAutoCreated` and `_count`.

- [ ] **Step 3: Commit**

```bash
git add packages/pwa/src/api/client.ts packages/pwa/src/pages/Chests.tsx packages/pwa/src/context/chest-context.tsx
git commit -m "feat: PWA — AUTO badge and memory count on chest cards"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx jest --no-coverage`

- [ ] **Step 2: Run MCP tests**

Run: `cd packages/mcp-server && npx jest --no-coverage`

- [ ] **Step 3: E2E test via curl**

```bash
# Login
RESP=$(curl -s -X POST http://localhost:3002/v1/auth/login -H "Content-Type: application/json" -d '{"email":"test-v02@example.com","password":"testpass123"}')
TOKEN=$(echo $RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Auto-chest with health keywords
curl -s -X POST http://localhost:3002/v1/memory/auto-chest \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"l0":"dentist appointment tuesday","l1":"Need to schedule dental checkup"}' | python3 -m json.tool

# Auto-chest with work keywords
curl -s -X POST http://localhost:3002/v1/memory/auto-chest \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"l0":"sprint deadline friday","l1":"Team needs to finish by end of week"}' | python3 -m json.tool

# List chests (should show auto-created ones)
curl -s http://localhost:3002/v1/chests -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

- [ ] **Step 4: Commit final**

```bash
git add -A && git commit -m "feat: auto-chest routing — OpenViking similarity + seed keywords + slug fallback"
```
