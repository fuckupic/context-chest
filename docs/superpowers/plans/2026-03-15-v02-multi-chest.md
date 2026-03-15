# v0.2 Multi-Chest + Auto-Sort Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-chest isolation with per-chest encryption, agent permissions, and OpenViking auto-sort to Context Chest.

**Architecture:** Each user can own multiple chests (isolated memory namespaces). Every memory belongs to exactly one chest. Per-chest HKDF key derivation ensures cryptographic isolation. Agent access is controlled per-chest via ChestPermission. OpenViking categorizes memories automatically when no path is provided — categorization runs client-side (MCP server) to ensure the URI is known before encryption.

**Tech Stack:** Fastify, Prisma/PostgreSQL, Node.js crypto (HKDF + AES-256-GCM), Web Crypto API (PWA), React + TailwindCSS, OpenViking vector search, MCP SDK.

**Review fixes applied:** Auto-sort is client-side (C1), schema + service updates are atomic (B1), ContextService uses default params (B2), all MCP tool handlers updated (B3), encryptionVersion-aware decryption (T4), chest-guard tests added (T2).

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/services/chest.ts` | ChestService — CRUD, permission checks, chest resolution from name |
| `src/routes/chests.ts` | REST endpoints for chest management |
| `src/plugins/chest-guard.ts` | Fastify preHandler resolving chest + enforcing agent permissions |
| `src/tests/services/chest.test.ts` | ChestService unit tests |
| `src/tests/plugins/chest-guard.test.ts` | Chest-guard plugin tests |
| `packages/mcp-server/src/migrate.ts` | `context-chest migrate-v2` CLI command |
| `packages/mcp-server/src/__tests__/crypto.test.ts` | Per-chest crypto unit tests |
| `packages/pwa/src/context/chest-context.tsx` | React context for active chest selection |
| `packages/pwa/src/pages/Chests.tsx` | Chest management page |
| `packages/pwa/src/components/ChestSwitcher.tsx` | Sidebar chest dropdown |
| `packages/pwa/src/components/PermissionEditor.tsx` | Per-chest agent permission editor |

### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add Chest, ChestPermission; add chestId + encryptionVersion to MemoryEntry; add chestId to Session |
| `src/index.ts` | Register chest routes + chest-guard plugin, inject ChestService, add X-Chest to CORS |
| `src/routes/memory.ts` | Read chestId/chestName from request, pass to services; add auto-sort endpoint |
| `src/routes/sessions.ts` | Read chestId from request, pass to SessionService |
| `src/services/memory.ts` | Accept chestId + chestName; new S3 key format; updateContent method |
| `src/services/session.ts` | Accept chestId; pass to memory.remember on close |
| `src/services/context.ts` | Per-chest userRoot (default param); new `categorize()` method |
| `packages/mcp-server/src/index.ts` | Parse `--chest` flag; pass chestName to all tool handlers |
| `packages/mcp-server/src/client.ts` | Add `X-Chest` header; chestName param; listMemories + updateContent methods |
| `packages/mcp-server/src/crypto.ts` | deriveItemKey gains chestName; encryptL2/decryptL2 gain chestName; legacy decrypt |
| `packages/mcp-server/src/cli.ts` | Add migrate-v2 command routing |
| `packages/mcp-server/src/tools/remember.ts` | Pass chestName to encryptL2; client-side auto-sort flow |
| `packages/mcp-server/src/tools/read.ts` | Pass chestName to decryptL2; encryptionVersion-aware |
| `packages/mcp-server/src/tools/session-save.ts` | Pass chestName to encryptL2 |
| `packages/mcp-server/src/tools/session-append.ts` | Pass chestName to encrypt calls |
| `packages/pwa/src/api/client.ts` | Add chest API methods; append ?chest= to memory/session calls |
| `packages/pwa/src/crypto/index.ts` | deriveItemKey gains chestName param |
| `packages/pwa/src/components/Layout.tsx` | Add ChestSwitcher + CHESTS nav link |
| `packages/pwa/src/lib/router.tsx` | Add /chests route; wrap with ChestProvider |
| `packages/pwa/src/pages/Memories.tsx` | Re-fetch on active chest change |
| `packages/pwa/src/pages/Sessions.tsx` | Re-fetch on active chest change |
| `packages/pwa/src/components/MemoryDetail.tsx` | Pass chestName to decryptL2 |

---

## Chunk 1: Database Schema + Services (Atomic)

> **B1 Fix:** Schema migration and all service updates happen in a single atomic chunk to avoid intermediate build breaks from the Prisma unique constraint change.

### Task 1.1: Prisma Schema + Data Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Chest and ChestPermission models**

After the `AgentConnection` model (line 175), add:

```prisma
model Chest {
  id          String            @id @default(uuid())
  userId      String            @map("user_id")
  name        String
  description String?
  isPublic    Boolean           @default(false) @map("is_public")
  createdAt   DateTime          @default(now()) @map("created_at")
  user        User              @relation(fields: [userId], references: [id])
  memories    MemoryEntry[]
  sessions    Session[]
  permissions ChestPermission[]

  @@unique([userId, name])
  @@map("chests")
}

model ChestPermission {
  id        String  @id @default(uuid())
  chestId   String  @map("chest_id")
  agentName String  @map("agent_name")
  canRead   Boolean @default(true) @map("can_read")
  canWrite  Boolean @default(true) @map("can_write")
  chest     Chest   @relation(fields: [chestId], references: [id], onDelete: Cascade)

  @@unique([chestId, agentName])
  @@map("chest_permissions")
}
```

Add `chests Chest[]` relation to User model.

- [ ] **Step 2: Add chestId + encryptionVersion to MemoryEntry**

Add fields:
```prisma
  chestId           String?  @map("chest_id")
  encryptionVersion Int      @default(1) @map("encryption_version")
  chest             Chest?   @relation(fields: [chestId], references: [id])
```

**Keep the existing `@@unique([userId, uri])` for now.** Add a NEW index alongside it:
```prisma
  @@unique([userId, chestId, uri], map: "memory_entries_user_chest_uri")
```

This avoids breaking existing code that references `userId_uri`.

- [ ] **Step 3: Add chestId to Session**

```prisma
  chestId   String?  @map("chest_id")
  chest     Chest?   @relation(fields: [chestId], references: [id])
```

- [ ] **Step 4: Run first migration**

Run: `cd /Users/tadytudy/Desktop/context-chest && npx prisma migrate dev --name add_chests`

- [ ] **Step 5: Create and run data backfill script**

Create `prisma/migrate-default-chests.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true } });

  for (const user of users) {
    const chest = await prisma.chest.upsert({
      where: { userId_name: { userId: user.id, name: 'default' } },
      create: { userId: user.id, name: 'default', description: 'Default chest', isPublic: true },
      update: {},
    });

    await prisma.memoryEntry.updateMany({
      where: { userId: user.id, chestId: null },
      data: { chestId: chest.id },
    });

    await prisma.session.updateMany({
      where: { userId: user.id, chestId: null },
      data: { chestId: chest.id },
    });
  }

  console.log(`Migrated ${users.length} users to default chests`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

Run: `npx ts-node prisma/migrate-default-chests.ts`

- [ ] **Step 6: Make chestId NOT NULL + drop old unique**

Update schema: change `chestId String?` to `chestId String` on both models. Remove `@@unique([userId, uri])` (keep only `@@unique([userId, chestId, uri])`).

Run: `npx prisma migrate dev --name make_chest_id_required`

- [ ] **Step 7: Commit**

```bash
git add prisma/ && git commit -m "feat: add Chest + ChestPermission models, migrate data to default chest"
```

---

### Task 1.2: ChestService + Tests

**Files:**
- Create: `src/services/chest.ts`
- Create: `src/tests/services/chest.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/services/chest.test.ts` with tests for: create, list, resolveByName (found + not found), delete (default blocked + success), checkAgentPermission (public, no-row, canWrite false), setPermissions (uses transaction).

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx jest src/tests/services/chest.test.ts --no-coverage`

- [ ] **Step 3: Implement ChestService**

Create `src/services/chest.ts`:

```typescript
import { PrismaClient, Chest } from '@prisma/client';

interface CreateChestInput {
  name: string;
  description?: string;
  isPublic?: boolean;
}

interface PermissionInput {
  agentName: string;
  canRead: boolean;
  canWrite: boolean;
}

export class ChestService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(userId: string, input: CreateChestInput): Promise<Chest> {
    return this.prisma.chest.create({
      data: { userId, name: input.name, description: input.description, isPublic: input.isPublic ?? false },
    });
  }

  async list(userId: string): Promise<Chest[]> {
    return this.prisma.chest.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async resolveByName(userId: string, name: string): Promise<Chest> {
    const chest = await this.prisma.chest.findFirst({ where: { userId, name } });
    if (!chest) throw new Error('Chest not found');
    return chest;
  }

  async getOrCreateDefault(userId: string): Promise<Chest> {
    const existing = await this.prisma.chest.findFirst({ where: { userId, name: 'default' } });
    if (existing) return existing;
    return this.prisma.chest.create({
      data: { userId, name: 'default', description: 'Default chest', isPublic: true },
    });
  }

  async delete(userId: string, chestId: string): Promise<void> {
    const chest = await this.prisma.chest.findUnique({ where: { id: chestId } });
    if (!chest || chest.userId !== userId) throw new Error('Chest not found');
    if (chest.name === 'default') throw new Error('Cannot delete the default chest');
    await this.prisma.chest.delete({ where: { id: chestId } });
  }

  async checkAgentPermission(
    chest: Pick<Chest, 'id' | 'isPublic' | 'name'>,
    agentName: string,
    operation: 'read' | 'write'
  ): Promise<boolean> {
    if (chest.isPublic) return true;

    const permission = await this.prisma.chestPermission.findUnique({
      where: { chestId_agentName: { chestId: chest.id, agentName } },
    });
    if (!permission) return false;
    return operation === 'write' ? permission.canWrite : permission.canRead;
  }

  async setPermissions(userId: string, chestId: string, permissions: PermissionInput[]): Promise<void> {
    const chest = await this.prisma.chest.findUnique({ where: { id: chestId } });
    if (!chest || chest.userId !== userId) throw new Error('Chest not found');

    await this.prisma.$transaction(
      permissions.map((perm) =>
        this.prisma.chestPermission.upsert({
          where: { chestId_agentName: { chestId, agentName: perm.agentName } },
          create: { chestId, agentName: perm.agentName, canRead: perm.canRead, canWrite: perm.canWrite },
          update: { canRead: perm.canRead, canWrite: perm.canWrite },
        })
      )
    );
  }

  async getPermissions(userId: string, chestId: string) {
    const chest = await this.prisma.chest.findUnique({ where: { id: chestId } });
    if (!chest || chest.userId !== userId) throw new Error('Chest not found');
    return this.prisma.chestPermission.findMany({ where: { chestId } });
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/services/chest.ts src/tests/services/chest.test.ts
git commit -m "feat: add ChestService with CRUD, permissions, and tests"
```

---

### Task 1.3: Update ContextService (Default Params)

> **B2 Fix:** Make `chestName` an optional parameter defaulting to `'default'` so existing callers compile while new code passes it explicitly.

**Files:**
- Modify: `src/services/context.ts`

- [ ] **Step 1: Update userRoot and fullUri to accept optional chestName**

```typescript
private userRoot(userId: string, chestName: string = 'default'): string {
  return `viking://user/${userId}/chests/${chestName}/memories`;
}

private fullUri(userId: string, relativePath: string, chestName: string = 'default'): string {
  return `${this.userRoot(userId, chestName)}/${relativePath}`;
}
```

- [ ] **Step 2: Add chestName as optional param (default 'default') to write, find, read, delete, list**

For each method, add `chestName: string = 'default'` as the second parameter, and pass it through to `fullUri`/`userRoot`. Example:

```typescript
async write(userId: string, chestName: string = 'default', relativePath: string, payload: WritePayload): Promise<void> {
  const uri = this.fullUri(userId, relativePath, chestName);
  // ...
}
```

**Important:** For `write`, `find`, `read`, `delete`, `list` — the old callers pass `(userId, relativePath, ...)`. Adding `chestName` as the second param would break them. Instead, restructure:

```typescript
async write(userId: string, relativePath: string, payload: WritePayload, chestName: string = 'default'): Promise<void> {
```

Put `chestName` as the LAST parameter with a default. This way all existing callers still compile.

- [ ] **Step 3: Add categorize method**

```typescript
async categorize(userId: string, chestName: string, l0: string, l1: string): Promise<string> {
  const categories = ['profile', 'preferences', 'entities', 'events', 'cases', 'patterns'];

  try {
    const { results } = await this.find(userId, `${l0} ${l1}`, 5, 0, chestName);
    if (results.length > 0) {
      const topCategory = results[0].uri.split('/')[0];
      if (categories.includes(topCategory)) {
        const slug = l0.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
        return `${topCategory}/${slug}`;
      }
    }
  } catch {
    // OpenViking unavailable
  }

  // Fallback: keyword heuristic
  const lower = l0.toLowerCase();
  let category = 'entities';
  if (lower.includes('prefer') || lower.includes('setting')) category = 'preferences';
  else if (lower.includes('profile') || lower.includes('role')) category = 'profile';
  else if (lower.includes('event') || lower.includes('meeting')) category = 'events';
  else if (lower.includes('pattern') || lower.includes('rule')) category = 'patterns';
  else if (lower.includes('bug') || lower.includes('issue')) category = 'cases';

  const slug = l0.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
  return `${category}/${slug}`;
}
```

- [ ] **Step 4: Update existing tests, run them**

Run: `npx jest src/tests/services/context.test.ts --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add src/services/context.ts src/tests/services/context.test.ts
git commit -m "feat: ContextService per-chest paths with backwards-compatible default params + categorize"
```

---

### Task 1.4: Update MemoryService for Multi-Chest

**Files:**
- Modify: `src/services/memory.ts`
- Modify: `src/tests/services/memory.test.ts`

- [ ] **Step 1: Update s3Key to include chestId**

```typescript
private s3Key(userId: string, chestId: string, uri: string): string {
  return `${userId}/chests/${chestId}/memories/${uri}.enc`;
}
```

- [ ] **Step 2: Add chestId and chestName to RememberInput**

```typescript
interface RememberInput {
  uri: string;
  chestId: string;
  chestName: string;
  l0: string;
  l1: string;
  encryptedL2: Buffer;
  sha256: string;
}
```

- [ ] **Step 3: Update remember method**

Use new compound unique `userId_chestId_uri`, pass `chestName` to context.write:

```typescript
async remember(userId: string, input: RememberInput): Promise<{ uri: string; createdAt: Date }> {
  const key = this.s3Key(userId, input.chestId, input.uri);

  if (this.storage) {
    await this.storage.upload(key, input.encryptedL2, input.sha256);
  }

  await this.context.write(userId, input.uri, { l0: input.l0, l1: input.l1 }, input.chestName).catch(() => {});

  try {
    const entry = await this.prisma.memoryEntry.upsert({
      where: { userId_chestId_uri: { userId, chestId: input.chestId, uri: input.uri } },
      create: {
        userId, chestId: input.chestId, uri: input.uri, s3Key: key,
        sha256: input.sha256, sizeBytes: input.encryptedL2.length,
        l0: input.l0, l1: input.l1, content: input.encryptedL2,
      },
      update: {
        s3Key: key, sha256: input.sha256, sizeBytes: input.encryptedL2.length,
        l0: input.l0, l1: input.l1, content: input.encryptedL2,
      },
    });
    return { uri: entry.uri, createdAt: entry.createdAt };
  } catch (error) {
    if (this.storage) await this.storage.delete(key).catch(() => {});
    throw error;
  }
}
```

- [ ] **Step 4: Update recall, getContent, forget, browse, list**

Add `chestId: string` parameter to each. Add `chestName: string` where ContextService is called. Update all Prisma `where` clauses to include `chestId`. For `getContent` and `forget`, use `userId_chestId_uri` compound unique.

- [ ] **Step 5: Add updateContent method (for migration)**

```typescript
async updateContent(
  userId: string, chestId: string, uri: string,
  encryptedL2: Buffer, sha256: string, encryptionVersion: number
): Promise<void> {
  const entry = await this.prisma.memoryEntry.findUnique({
    where: { userId_chestId_uri: { userId, chestId, uri } },
  });
  if (!entry) throw new Error('Memory not found');

  const key = this.s3Key(userId, chestId, uri);
  if (this.storage) await this.storage.upload(key, encryptedL2, sha256);

  await this.prisma.memoryEntry.update({
    where: { id: entry.id },
    data: { s3Key: key, sha256, sizeBytes: encryptedL2.length, content: encryptedL2, encryptionVersion },
  });
}
```

- [ ] **Step 6: Update tests — add chestId to all mock calls**

Update `mockPrisma.memoryEntry.upsert` calls to expect `userId_chestId_uri`. Pass `chestId: 'chest-1'` and `chestName: 'default'` in all test inputs.

- [ ] **Step 7: Run tests — expect PASS**

Run: `npx jest src/tests/services/memory.test.ts --no-coverage`

- [ ] **Step 8: Commit**

```bash
git add src/services/memory.ts src/tests/services/memory.test.ts
git commit -m "feat: MemoryService multi-chest — chestId in queries, per-chest S3 keys, updateContent"
```

---

### Task 1.5: Update SessionService for Multi-Chest

**Files:**
- Modify: `src/services/session.ts`
- Modify: `src/tests/services/session.test.ts`

- [ ] **Step 1: Add chestId + chestName to create and close**

`create(userId, chestId, clientId?)` — pass `chestId` to `prisma.session.create`.

`close(userId, sessionId, chestId, chestName, extractedMemories)` — pass `chestId` and `chestName` to `this.memory.remember`.

- [ ] **Step 2: Update tests and run**

Run: `npx jest src/tests/services/session.test.ts --no-coverage`

- [ ] **Step 3: Commit**

```bash
git add src/services/session.ts src/tests/services/session.test.ts
git commit -m "feat: SessionService multi-chest — chestId on create and close"
```

---

### Task 1.6: Chest Routes + Chest-Guard Plugin

**Files:**
- Create: `src/routes/chests.ts`
- Create: `src/plugins/chest-guard.ts`
- Create: `src/tests/plugins/chest-guard.test.ts`
- Modify: `src/index.ts`
- Modify: `src/routes/memory.ts`
- Modify: `src/routes/sessions.ts`

- [ ] **Step 1: Create chest routes**

Create `src/routes/chests.ts` with endpoints:
- `POST /` — create chest (validate name: `^[a-z0-9][a-z0-9-]*$`)
- `GET /` — list user's chests
- `GET /:id/permissions` — get permissions (verify user ownership)
- `PUT /:id/permissions` — set permissions
- `DELETE /:id` — delete (block "default")

- [ ] **Step 2: Create chest-guard plugin**

Create `src/plugins/chest-guard.ts`:

```typescript
import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { ChestService } from '../services/chest';

export function createChestGuard(chestService: ChestService) {
  const plugin: FastifyPluginAsync = async (fastify) => {
    fastify.decorateRequest('chestId', null);
    fastify.decorateRequest('chestName', null);

    fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.url.startsWith('/v1/memory') && !request.url.startsWith('/v1/sessions')) return;

      const userId = (request as unknown as Record<string, unknown>).userId as string | undefined;
      if (!userId) return;

      const chestHeader = request.headers['x-chest'] as string | undefined;
      const chestQuery = (request.query as Record<string, string>)?.chest;
      const chestName = chestHeader ?? chestQuery ?? 'default';

      try {
        const chest = chestName === 'default'
          ? await chestService.getOrCreateDefault(userId)
          : await chestService.resolveByName(userId, chestName);

        const agentName = request.headers['x-agent-name'] as string | undefined;
        if (agentName) {
          const isWrite = ['POST', 'PUT', 'DELETE'].includes(request.method);
          const allowed = await chestService.checkAgentPermission(chest, agentName, isWrite ? 'write' : 'read');
          if (!allowed) {
            reply.code(403).send({
              code: 'CHEST_ACCESS_DENIED',
              message: `Agent '${agentName}' does not have access to chest '${chestName}'`,
            });
            return;
          }
        }

        (request as unknown as Record<string, unknown>).chestId = chest.id;
        (request as unknown as Record<string, unknown>).chestName = chest.name;
      } catch {
        reply.code(404).send({ code: 'CHEST_NOT_FOUND', message: `Chest '${chestName}' not found` });
      }
    });
  };

  return fp(plugin);
}
```

- [ ] **Step 3: Write chest-guard tests**

Create `src/tests/plugins/chest-guard.test.ts` with tests for:
- Default chest auto-creation when none exists
- X-Chest header parsing
- ?chest= query param fallback
- Agent permission denial (403)
- Unknown chest returns 404

- [ ] **Step 4: Register in src/index.ts**

Add imports for `chestRoutes`, `ChestService`, `createChestGuard`.
Create `chestService`. Register plugin and routes. Add `'X-Chest'` to CORS allowedHeaders.

- [ ] **Step 5: Update memory routes to extract chestId/chestName**

In `src/routes/memory.ts`, in each handler extract:
```typescript
const chestId = (request as unknown as Record<string, unknown>).chestId as string;
const chestName = (request as unknown as Record<string, unknown>).chestName as string;
```

Pass to all MemoryService calls. Add the auto-sort endpoint:

```typescript
// Auto-sort — returns suggested URI without storing
fastify.post(
  '/auto-sort',
  { preHandler: requirePermission('remember') },
  async (request) => {
    const userId = (request as unknown as Record<string, unknown>).userId as string;
    const chestName = (request as unknown as Record<string, unknown>).chestName as string;
    const body = z.object({ l0: z.string().min(1), l1: z.string().min(1) }).parse(request.body);
    const uri = await memoryService.autoSortUri(userId, chestName, body.l0, body.l1);
    return { success: true, data: { uri } };
  }
);
```

Add to MemoryService:
```typescript
async autoSortUri(userId: string, chestName: string, l0: string, l1: string): Promise<string> {
  return this.context.categorize(userId, chestName, l0, l1);
}
```

Also add `PUT /content/*` for migration:
```typescript
fastify.put(
  '/content/*',
  { preHandler: requirePermission('remember') },
  async (request, reply) => {
    const userId = (request as unknown as Record<string, unknown>).userId as string;
    const chestId = (request as unknown as Record<string, unknown>).chestId as string;
    const uri = (request.params as Record<string, string>)['*'];
    const body = z.object({
      encryptedL2: z.string().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      encryptionVersion: z.number().int().min(1).max(2),
    }).parse(request.body);

    try {
      await memoryService.updateContent(userId, chestId, uri, Buffer.from(body.encryptedL2, 'base64'), body.sha256, body.encryptionVersion);
      return { success: true };
    } catch {
      reply.code(404).send({ code: 'MEMORY_NOT_FOUND', message: 'Memory not found' });
    }
  }
);
```

Make `rememberSchema.uri` optional and add `autoSort` flag (though the MCP client resolves URI before sending — the optional URI is for the auto-sort two-step flow fallback).

- [ ] **Step 6: Update session routes to extract chestId/chestName**

Same pattern in `src/routes/sessions.ts`.

- [ ] **Step 7: Run full test suite**

Run: `npx jest --no-coverage`

- [ ] **Step 8: Run typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 9: Commit**

```bash
git add src/routes/chests.ts src/plugins/chest-guard.ts src/tests/plugins/chest-guard.test.ts src/index.ts src/routes/memory.ts src/routes/sessions.ts src/services/memory.ts
git commit -m "feat: chest CRUD routes, chest-guard plugin, multi-chest memory/session routes"
```

---

## Chunk 2: MCP Server — `--chest` Flag + Per-Chest Crypto

### Task 2.1: MCP Client X-Chest Header

**Files:**
- Modify: `packages/mcp-server/src/client.ts`

- [ ] **Step 1: Add chestName to ClientConfig and constructor**

```typescript
interface ClientConfig {
  baseUrl: string;
  token: string;
  refreshToken?: string;
  chestName?: string;
}
// In class:
private readonly chestName: string;
// In constructor:
this.chestName = config.chestName ?? 'default';
```

- [ ] **Step 2: Add X-Chest to headers() and requestBinary()**

```typescript
private headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${this.token}`,
    'X-Agent-Name': 'Claude Code',
    'X-Chest': this.chestName,
  };
}
```

Same for `requestBinary`.

- [ ] **Step 3: Add getter and new methods**

```typescript
getChestName(): string { return this.chestName; }

async listMemories(page: number = 1, limit: number = 100) {
  return this.request<{ success: boolean; data: Array<{ uri: string; sha256: string; sizeBytes: number; createdAt: string; encryptionVersion?: number }>; meta: { total: number } }>(
    'GET', `/v1/memory/list?page=${page}&limit=${limit}`
  );
}

async updateContent(uri: string, encryptedL2: string, sha256: string, encryptionVersion: number) {
  return this.request<{ success: boolean }>('PUT', `/v1/memory/content/${uri}`, { encryptedL2, sha256, encryptionVersion });
}

async autoSort(l0: string, l1: string) {
  return this.request<{ success: boolean; data: { uri: string } }>('POST', '/v1/memory/auto-sort', { l0, l1 });
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-server/src/client.ts
git commit -m "feat: MCP client sends X-Chest header, adds listMemories/updateContent/autoSort methods"
```

---

### Task 2.2: MCP Per-Chest Crypto + Tests

**Files:**
- Modify: `packages/mcp-server/src/crypto.ts`
- Create: `packages/mcp-server/src/__tests__/crypto.test.ts`

- [ ] **Step 1: Write crypto tests**

Create `packages/mcp-server/src/__tests__/crypto.test.ts`:

```typescript
import { deriveItemKey, encryptL2, decryptL2, decryptL2Legacy, sha256 } from '../crypto';
import { randomBytes } from 'crypto';

describe('per-chest crypto', () => {
  const masterKey = randomBytes(32);
  const plaintext = Buffer.from('test content');

  it('deriveItemKey produces different keys for different chests', () => {
    const key1 = deriveItemKey(masterKey, 'chest-a', 'path/file');
    const key2 = deriveItemKey(masterKey, 'chest-b', 'path/file');
    expect(key1.equals(key2)).toBe(false);
  });

  it('encryptL2 + decryptL2 round-trip with chestName', () => {
    const encrypted = encryptL2(masterKey, 'default', 'test/uri', plaintext);
    const decrypted = decryptL2(masterKey, 'default', 'test/uri', encrypted);
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it('decrypting with wrong chestName fails', () => {
    const encrypted = encryptL2(masterKey, 'chest-a', 'test/uri', plaintext);
    expect(() => decryptL2(masterKey, 'chest-b', 'test/uri', encrypted)).toThrow();
  });

  it('decryptL2Legacy decrypts v0.1 format (no chestName in salt)', () => {
    // Simulate v0.1 encryption: salt = uri only
    const encrypted = encryptL2Legacy(masterKey, 'test/uri', plaintext);
    const decrypted = decryptL2Legacy(masterKey, 'test/uri', encrypted);
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it('v0.1 encrypted content cannot be decrypted with v0.2 scheme', () => {
    const encrypted = encryptL2Legacy(masterKey, 'test/uri', plaintext);
    expect(() => decryptL2(masterKey, 'default', 'test/uri', encrypted)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Update crypto.ts**

```typescript
export function deriveItemKey(masterKey: Buffer, chestName: string, uri: string): Buffer {
  const salt = `${chestName}/${uri}`;
  return Buffer.from(hkdfSync(HKDF_HASH, masterKey, salt, 'context-chest-l2', KEY_LENGTH));
}

export function encryptL2(masterKey: Buffer, chestName: string, uri: string, plaintext: Buffer): string {
  const itemKey = deriveItemKey(masterKey, chestName, uri);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', itemKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

export function decryptL2(masterKey: Buffer, chestName: string, uri: string, encryptedBase64: string): Buffer {
  const itemKey = deriveItemKey(masterKey, chestName, uri);
  const data = Buffer.from(encryptedBase64, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', itemKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// Legacy v0.1 functions (for migration + encryptionVersion=1 reads)
function deriveItemKeyLegacy(masterKey: Buffer, uri: string): Buffer {
  return Buffer.from(hkdfSync(HKDF_HASH, masterKey, uri, 'context-chest-l2', KEY_LENGTH));
}

export function encryptL2Legacy(masterKey: Buffer, uri: string, plaintext: Buffer): string {
  const itemKey = deriveItemKeyLegacy(masterKey, uri);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', itemKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

export function decryptL2Legacy(masterKey: Buffer, uri: string, encryptedBase64: string): Buffer {
  const itemKey = deriveItemKeyLegacy(masterKey, uri);
  const data = Buffer.from(encryptedBase64, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', itemKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/crypto.ts packages/mcp-server/src/__tests__/crypto.test.ts
git commit -m "feat: per-chest HKDF key derivation + legacy v0.1 decrypt + tests"
```

---

### Task 2.3: Parse --chest Flag + Update ALL Tool Handlers

> **B3 Fix:** Update ALL tool handlers (remember, read, session-save, session-append) in a single task.

**Files:**
- Modify: `packages/mcp-server/src/index.ts`
- Modify: `packages/mcp-server/src/tools/remember.ts`
- Modify: `packages/mcp-server/src/tools/read.ts`
- Modify: `packages/mcp-server/src/tools/session-save.ts`
- Modify: `packages/mcp-server/src/tools/session-append.ts`

- [ ] **Step 1: Parse --chest in main()**

At top of `main()`:
```typescript
const chestFlag = process.argv.find(arg => arg.startsWith('--chest='));
const chestName = chestFlag ? chestFlag.split('=')[1] : 'default';
process.stderr.write(`[context-chest] Chest: ${chestName}\n`);
```

Pass `chestName` to all `new ContextChestClient({...})` calls.

- [ ] **Step 2: Update ensureInitialized**

```typescript
function ensureInitialized(): { client: ContextChestClient; masterKey: Buffer; chestName: string } {
  if (!client || !masterKey) throw new Error('Not authenticated.');
  return { client, masterKey, chestName: client.getChestName() };
}
```

- [ ] **Step 3: Update remember tool — client-side auto-sort**

In `packages/mcp-server/src/tools/remember.ts`:

```typescript
export async function handleRemember(
  input: RememberInput,
  client: ContextChestClient,
  masterKey: Buffer,
  chestName: string,
  generateSummaries: (content: string, uri?: string) => Promise<{ l0: string; l1: string }>
): Promise<string> {
  let uri: string;

  if (input.path) {
    uri = input.path;
  } else {
    // Client-side auto-sort: ask server for URI, then encrypt locally
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
  const encryptedL2 = encryptL2(masterKey, chestName, uri, plaintext);
  const hash = sha256(Buffer.from(encryptedL2, 'base64'));

  const result = await client.remember({ uri, l0, l1, encryptedL2, sha256: hash });
  return `Remembered at ${result.data.uri}`;
}
```

- [ ] **Step 4: Update read tool — encryptionVersion-aware**

In `packages/mcp-server/src/tools/read.ts`:

```typescript
export async function handleRead(
  input: ReadInput,
  client: ContextChestClient,
  masterKey: Buffer,
  chestName: string
): Promise<string> {
  const uri = input.path;
  const encryptedBuf = await client.getContent(uri);
  const encryptedBase64 = encryptedBuf.toString('base64');

  // Try v0.2 decryption first, fall back to legacy v0.1
  let plaintext: Buffer;
  try {
    plaintext = decryptL2(masterKey, chestName, uri, encryptedBase64);
  } catch {
    try {
      plaintext = decryptL2Legacy(masterKey, uri, encryptedBase64);
    } catch {
      throw new Error('Failed to decrypt memory — wrong key or corrupted data');
    }
  }

  return plaintext.toString('utf-8');
}
```

Import `decryptL2Legacy` from crypto.

- [ ] **Step 5: Update session-save.ts**

Add `chestName: string` parameter to `handleSessionSave`. Update the `encryptL2` call to pass `chestName`:

```typescript
const encrypted = encryptL2(masterKey, chestName, m.path, plaintext);
```

- [ ] **Step 6: Update session-append.ts**

Add `chestName: string` parameter. Update any encrypt calls.

- [ ] **Step 7: Update tool registrations in index.ts**

Pass `ctx.chestName` to all tool handlers:
```typescript
const result = await handleRemember(params, ctx.client, ctx.masterKey, ctx.chestName, generateSummaries);
const result = await handleRead(params, ctx.client, ctx.masterKey, ctx.chestName);
const result = await handleSessionSave(params, ctx.client, ctx.masterKey, ctx.chestName, generateSummaries);
const result = await handleSessionAppend(params, ctx.client, ctx.masterKey, ctx.chestName, generateL0);
```

- [ ] **Step 8: Run typecheck**

Run: `cd /Users/tadytudy/Desktop/context-chest/packages/mcp-server && npx tsc --noEmit`

- [ ] **Step 9: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat: MCP --chest flag, all tools use per-chest crypto, encryptionVersion-aware read"
```

---

## Chunk 3: PWA — Chest Switcher + Management

### Task 3.1: PWA Client + Chest Context

**Files:**
- Modify: `packages/pwa/src/api/client.ts`
- Create: `packages/pwa/src/context/chest-context.tsx`
- Modify: `packages/pwa/src/lib/router.tsx`

- [ ] **Step 1: Add chest methods + ?chest= param to PWA client**

Add interfaces `ChestItem`, `ChestPermissionItem`. Add `chestName` field + setter. Add methods: `listChests`, `createChest`, `deleteChest`, `getChestPermissions`, `setChestPermissions`. Append `&chest=${encodeURIComponent(this.chestName)}` to browse, recall, listMemories, getContent, listSessions.

- [ ] **Step 2: Create chest context**

Create `packages/pwa/src/context/chest-context.tsx` with `ChestProvider` + `useChest` hook. Loads chests on mount, persists active chest to localStorage, syncs to `client.setChestName()`.

- [ ] **Step 3: Wrap Layout with ChestProvider in router.tsx**

- [ ] **Step 4: Commit**

```bash
git add packages/pwa/src/api/client.ts packages/pwa/src/context/chest-context.tsx packages/pwa/src/lib/router.tsx
git commit -m "feat: PWA chest API client, ChestProvider context"
```

---

### Task 3.2: ChestSwitcher + Layout + Chests Page

**Files:**
- Create: `packages/pwa/src/components/ChestSwitcher.tsx`
- Create: `packages/pwa/src/pages/Chests.tsx`
- Create: `packages/pwa/src/components/PermissionEditor.tsx`
- Modify: `packages/pwa/src/components/Layout.tsx`
- Modify: `packages/pwa/src/lib/router.tsx`

- [ ] **Step 1: Create ChestSwitcher dropdown component**

- [ ] **Step 2: Create Chests management page with create form + list + delete**

- [ ] **Step 3: Create PermissionEditor component with agent read/write toggles**

- [ ] **Step 4: Add ChestSwitcher to Layout sidebar (after logo, before nav)**

Add `{ to: '/chests', label: 'CHESTS' }` to navItems. Update version to `V0.2.0`.

- [ ] **Step 5: Add /chests route in router.tsx**

- [ ] **Step 6: Commit**

```bash
git add packages/pwa/src/components/ChestSwitcher.tsx packages/pwa/src/pages/Chests.tsx packages/pwa/src/components/PermissionEditor.tsx packages/pwa/src/components/Layout.tsx packages/pwa/src/lib/router.tsx
git commit -m "feat: chest switcher, management page, permission editor in PWA"
```

---

### Task 3.3: PWA Crypto + Scoped Pages

**Files:**
- Modify: `packages/pwa/src/crypto/index.ts`
- Modify: `packages/pwa/src/components/MemoryDetail.tsx`
- Modify: `packages/pwa/src/pages/Memories.tsx`
- Modify: `packages/pwa/src/pages/Sessions.tsx`

- [ ] **Step 1: Update PWA crypto deriveItemKey to accept chestName**

```typescript
export async function deriveItemKey(masterKey: Uint8Array, chestName: string, uri: string): Promise<CryptoKey> {
  const salt = new TextEncoder().encode(`${chestName}/${uri}`);
  const info = new TextEncoder().encode('context-chest-l2');
  return deriveAesKey(masterKey, salt, info);
}
```

Update `encryptL2` and `decryptL2FromBytes` to accept and pass `chestName`.

- [ ] **Step 2: Update MemoryDetail to pass chestName**

Import `useChest`, pass `activeChest.name` to `decryptL2FromBytes`.

- [ ] **Step 3: Memories page — re-fetch on chest change**

Add `activeChest` from `useChest()` as dependency in the browse useEffect.

- [ ] **Step 4: Sessions page — same pattern**

- [ ] **Step 5: Commit**

```bash
git add packages/pwa/src/crypto/index.ts packages/pwa/src/components/MemoryDetail.tsx packages/pwa/src/pages/Memories.tsx packages/pwa/src/pages/Sessions.tsx
git commit -m "feat: PWA per-chest crypto, scoped memories and sessions pages"
```

---

## Chunk 4: Migration CLI

### Task 4.1: Migration CLI

**Files:**
- Create: `packages/mcp-server/src/migrate.ts`
- Modify: `packages/mcp-server/src/cli.ts`
- Modify: `packages/mcp-server/src/index.ts` (routing)

- [ ] **Step 1: Create migrate.ts**

Implements `migrateV2()`:
1. Authenticate + unwrap master key
2. Paginate through ALL memories (loop pages until total reached — fixes B5)
3. For each: download encrypted L2, decrypt with `decryptL2Legacy`, re-encrypt with `encryptL2(masterKey, 'default', uri, ...)`, upload via `updateContent` with `encryptionVersion: 2`
4. Report progress

Key: handle pagination:
```typescript
let page = 1;
let allMemories: MemoryListItem[] = [];
while (true) {
  const result = await client.listMemories(page, 100);
  allMemories = [...allMemories, ...result.data];
  if (allMemories.length >= result.meta.total) break;
  page++;
}
```

- [ ] **Step 2: Add migrate-v2 to cli.ts**

Use dynamic import (fixes I1):
```typescript
if (command === 'migrate-v2') {
  import('./migrate').then(({ migrateV2 }) => migrateV2()).catch(console.error);
}
```

- [ ] **Step 3: Route migrate-v2 in index.ts**

```typescript
if (process.argv.includes('login') || process.argv.includes('migrate-v2')) {
  import('./cli').catch(console.error);
} else {
  main().catch(console.error);
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-server/src/migrate.ts packages/mcp-server/src/cli.ts packages/mcp-server/src/index.ts
git commit -m "feat: context-chest migrate-v2 CLI — re-encrypts v0.1 memories with per-chest salt"
```

---

## Chunk 5: Final — Version Bump + Verification

### Task 5.1: Version Bump and Full Verification

- [ ] **Step 1: Update MCP server version to 0.2.0**

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/tadytudy/Desktop/context-chest && npx jest --no-coverage`

- [ ] **Step 3: Run typecheck on all packages**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Context Chest v0.2 — multi-chest, per-chest encryption, agent permissions, auto-sort"
```
