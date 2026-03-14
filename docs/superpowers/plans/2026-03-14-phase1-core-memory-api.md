# Phase 1: Core Memory API — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add encrypted agent memory and session management to Context Chest, backed by OpenViking as sidecar context engine.

**Architecture:** Orchestration layer pattern — Context Chest owns the public API (`/v1/memory/*`, `/v1/sessions/*`), routes call service classes that coordinate between OpenViking (metadata search), S3 (encrypted content), and Prisma (relational state). OpenViking is an implementation detail.

**Tech Stack:** TypeScript, Fastify, Prisma, OpenViking (Python sidecar via HTTP), AWS S3/MinIO, Zod, Jest

**Spec:** `docs/superpowers/specs/2026-03-14-encrypted-agent-memory-design.md`

---

## File Map

### New Files
| File | Responsibility |
|---|---|
| `src/services/storage.ts` | S3 upload/download/delete wrapper |
| `src/services/audit.ts` | AuditLog insertion with context fields |
| `src/services/usage.ts` | Usage counter tracking + free tier enforcement |
| `src/services/context.ts` | OpenViking HTTP client wrapper (only OV-aware file) |
| `src/services/grant.ts` | Role-based permission checking + grant CRUD |
| `src/services/memory.ts` | Orchestrates remember/recall/forget across S3 + OV + Prisma |
| `src/services/session.ts` | Session lifecycle (create/append/close) |
| `src/plugins/role-guard.ts` | Fastify plugin: extracts role from JWT/grant, checks permissions |
| `src/routes/memory.ts` | Memory route handlers |
| `src/routes/sessions.ts` | Session route handlers |
| `src/tests/services/storage.test.ts` | StorageService unit tests |
| `src/tests/services/audit.test.ts` | AuditService unit tests |
| `src/tests/services/usage.test.ts` | UsageService unit tests |
| `src/tests/services/context.test.ts` | ContextService integration tests |
| `src/tests/services/grant.test.ts` | GrantService unit tests |
| `src/tests/services/memory.test.ts` | MemoryService unit tests |
| `src/tests/services/session.test.ts` | SessionService unit tests |
| `src/tests/plugins/role-guard.test.ts` | Role guard plugin tests |

### Modified Files
| File | Changes |
|---|---|
| `prisma/schema.prisma` | Add Role/SessionStatus/UsageAction enums, MemoryEntry/Session/UsageRecord models, modify User/Grant/AuditLog |
| `src/plugins/opaque.ts` | Remove OpaqueClient, keep only OpaqueServer methods |
| `src/routes/auth.ts` | Refactor to server-only OPAQUE, add master-key endpoints |
| `src/routes/connect.ts` | Replace scopes with role, add grant list/revoke, update introspect response |
| `src/plugins/audit.ts` | Delegate to AuditService |
| `src/index.ts` | Register new routes, add OV health check, update body limit |
| `docker-compose.yml` | Add OpenViking sidecar service |

---

## Chunk 1: Schema Migration + Infrastructure

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and new models to schema**

Replace the full contents of `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  tool
  assistant
  admin
}

enum SessionStatus {
  active
  closed
}

enum UsageAction {
  remember
  recall
  content_fetch
  session_create
  session_close
  browse
}

model User {
  id                  String        @id @default(uuid())
  email               String        @unique
  opaqueRecord        Bytes
  encryptedMasterKey  Bytes?        @map("encrypted_master_key")
  createdAt           DateTime      @default(now()) @map("created_at")
  blobs               Blob[]
  grants              Grant[]
  auditLogs           AuditLog[]
  memories            MemoryEntry[]
  sessions            Session[]
  usageRecords        UsageRecord[]

  @@map("users")
}

model Blob {
  userId      String   @map("user_id")
  s3Key       String   @map("s3_key")
  sha256      String
  uploadedAt  DateTime @default(now()) @map("uploaded_at")
  user        User     @relation(fields: [userId], references: [id])

  @@id([userId])
  @@map("blobs")
}

model Client {
  clientId         String   @id @map("client_id")
  name             String
  redirectUri      String   @map("redirect_uri")
  clientSecretHash String   @map("client_secret_hash")
  grants           Grant[]

  @@map("clients")
}

model Grant {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  clientId   String   @map("client_id")
  role       Role     @default(tool)
  createdAt  DateTime @default(now()) @map("created_at")
  expiresAt  DateTime @map("expires_at")
  jwtId      String   @unique @map("jwt_id")
  user       User     @relation(fields: [userId], references: [id])
  client     Client   @relation(fields: [clientId], references: [clientId])

  @@map("grants")
}

model AuditLog {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  route     String
  method    String
  action    String?
  uri       String?
  clientId  String?  @map("client_id")
  ip        String
  status    Int
  bytes     Int?
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id])

  @@index([createdAt])
  @@map("audit_logs")
}

model MemoryEntry {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  uri       String
  s3Key     String   @map("s3_key")
  sha256    String
  sizeBytes Int      @map("size_bytes")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  user      User     @relation(fields: [userId], references: [id])

  @@unique([userId, uri])
  @@index([userId, createdAt])
  @@map("memory_entries")
}

model Session {
  id           String        @id @default(uuid())
  userId       String        @map("user_id")
  clientId     String?       @map("client_id")
  status       SessionStatus @default(active)
  messageCount Int           @default(0) @map("message_count")
  createdAt    DateTime      @default(now()) @map("created_at")
  closedAt     DateTime?     @map("closed_at")
  user         User          @relation(fields: [userId], references: [id])

  @@index([userId, status])
  @@map("sessions")
}

model UsageRecord {
  id        String      @id @default(uuid())
  userId    String      @map("user_id")
  action    UsageAction
  count     Int         @default(1)
  period    String
  createdAt DateTime    @default(now()) @map("created_at")
  user      User        @relation(fields: [userId], references: [id])

  @@unique([userId, action, period])
  @@index([userId, period])
  @@map("usage_records")
}
```

- [ ] **Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_memory_sessions_roles`
Expected: Migration created successfully, Prisma Client regenerated.

Note: This is a breaking change for `Grant.scopes` → `Grant.role`. Since this is pre-launch, we drop and recreate. If there were production data, we'd need a multi-step migration.

- [ ] **Step 3: Verify Prisma Client types**

Run: `npx prisma generate && npm run typecheck`
Expected: Type errors in `src/routes/connect.ts` (references `scopes` which is now `role`). These will be fixed in Task 10.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add memory, session, usage schemas and role-based grants"
```

---

### Task 2: Add OpenViking to Docker Compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add OpenViking service and volume**

Append the `openviking` service before the `volumes:` section and add the new volume:

```yaml
  openviking:
    image: openviking/openviking-server:latest
    ports:
      - "8000:8000"
    volumes:
      - openviking_data:/data
    environment:
      OV_STORAGE_BACKEND: local
      OV_ROOT_API_KEY: ${OV_API_KEY:-dev-openviking-key}
      OV_EMBEDDING_PROVIDER: openai
      OV_EMBEDDING_MODEL: text-embedding-3-small
      OV_EMBEDDING_API_KEY: ${OPENAI_API_KEY:-}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
```

Add `openviking_data:` to the volumes section.

- [ ] **Step 2: Verify compose config is valid**

Run: `docker compose config --quiet`
Expected: No output (valid config).

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add OpenViking sidecar to docker-compose"
```

---

### Task 3: Refactor OPAQUE to Server-Only

**Files:**
- Modify: `src/plugins/opaque.ts`
- Modify: `src/routes/auth.ts`

- [ ] **Step 1: Remove OpaqueClient from opaque.ts**

Replace `src/plugins/opaque.ts` with server-only methods. Remove the `OpaqueClient` import and `client` instance. Keep only `OpaqueServer` operations:

```typescript
import { OpaqueServer } from '@cloudflare/opaque-ts';

const server = new OpaqueServer();

export async function opaqueRegisterStart(
  email: string,
  registrationRequest: Uint8Array
) {
  const { registrationResponse, serverState } =
    await server.createRegistrationResponse({
      registrationRequest,
      serverIdentity: email,
    });
  return { registrationResponse, serverState };
}

export async function opaqueRegisterFinish(
  _email: string,
  record: Uint8Array
) {
  return { record };
}

export async function opaqueLoginStart(
  email: string,
  credentialRequest: Uint8Array,
  record: Uint8Array
) {
  const { credentialResponse, serverState } =
    await server.createCredentialResponse({
      credentialRequest,
      serverIdentity: email,
      record,
    });
  return { credentialResponse, serverState };
}

export async function opaqueLoginFinish(
  serverState: Uint8Array,
  credentialFinalization: Uint8Array
) {
  const { sessionKey, clientIdentity } = await server.finalize({
    serverState,
    credentialFinalization,
  });
  return { sessionKey, clientIdentity };
}
```

- [ ] **Step 2: Rewrite auth.ts to use server-only OPAQUE and add master-key endpoints**

The existing `auth.ts` imports `Opaque` from `node-opaque` and runs both client and server OPAQUE operations on the server side. This must be completely rewritten to:
1. Import from `./plugins/opaque` (which uses `@cloudflare/opaque-ts`)
2. Accept raw OPAQUE message bytes from clients (base64-encoded)
3. Return raw OPAQUE response bytes for clients to process with `OpaqueClient` locally
4. Remove the `node-opaque` dependency

Replace the full contents of `src/routes/auth.ts` with:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import {
  opaqueRegisterStart,
  opaqueRegisterFinish,
  opaqueLoginStart,
  opaqueLoginFinish,
} from '../plugins/opaque';

const prisma = new PrismaClient();

// In-memory state store for OPAQUE multi-step flows (production: use Redis)
const opaqueState = new Map<string, Uint8Array>();

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Start registration — client sends registrationRequest bytes
  fastify.post('/register', async (request, reply) => {
    const { email, registrationRequest } = request.body as {
      email: string;
      registrationRequest: string; // base64
    };

    const reqBytes = new Uint8Array(Buffer.from(registrationRequest, 'base64'));
    const { registrationResponse, serverState } = await opaqueRegisterStart(
      email,
      reqBytes
    );

    opaqueState.set(`reg:${email}`, serverState);

    return {
      registrationResponse: Buffer.from(registrationResponse).toString('base64'),
    };
  });

  // Complete registration — client sends record bytes
  fastify.post('/register/finish', async (request, reply) => {
    const { email, record } = request.body as {
      email: string;
      record: string; // base64
    };

    const recordBytes = new Uint8Array(Buffer.from(record, 'base64'));
    opaqueState.delete(`reg:${email}`);

    const user = await prisma.user.create({
      data: {
        email,
        opaqueRecord: Buffer.from(recordBytes),
      },
    });

    const token = fastify.jwt.sign({ sub: user.id });
    return { token };
  });

  // Start login — client sends credentialRequest bytes
  fastify.post('/login', async (request, reply) => {
    const { email, credentialRequest } = request.body as {
      email: string;
      credentialRequest: string; // base64
    };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      reply.code(401).send({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      return;
    }

    const reqBytes = new Uint8Array(Buffer.from(credentialRequest, 'base64'));
    const record = new Uint8Array(user.opaqueRecord);

    const { credentialResponse, serverState } = await opaqueLoginStart(
      email,
      reqBytes,
      record
    );

    opaqueState.set(`login:${email}`, serverState);

    return {
      credentialResponse: Buffer.from(credentialResponse).toString('base64'),
    };
  });

  // Complete login — client sends credentialFinalization bytes
  // Client has already derived export_key locally from OpaqueClient.authFinish()
  fastify.post('/login/finish', async (request, reply) => {
    const { email, credentialFinalization } = request.body as {
      email: string;
      credentialFinalization: string; // base64
    };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      reply.code(401).send({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      return;
    }

    const serverState = opaqueState.get(`login:${email}`);
    if (!serverState) {
      reply.code(400).send({
        code: 'INVALID_STATE',
        message: 'No pending login for this email',
      });
      return;
    }

    try {
      const finBytes = new Uint8Array(
        Buffer.from(credentialFinalization, 'base64')
      );
      await opaqueLoginFinish(serverState, finBytes);
      opaqueState.delete(`login:${email}`);

      const token = fastify.jwt.sign({ sub: user.id });
      return { token };
    } catch {
      reply.code(401).send({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
  });

  // Store wrapped master key (first time only — returns 409 if already set)
  fastify.put('/master-key', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid token' });
      return;
    }

    const userId = (request.user as Record<string, unknown>).sub as string;
    const { encryptedMasterKey } = request.body as { encryptedMasterKey: string };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      reply.code(404).send({ code: 'USER_NOT_FOUND', message: 'User not found' });
      return;
    }

    if (user.encryptedMasterKey) {
      reply.code(409).send({
        code: 'MASTER_KEY_EXISTS',
        message: 'Master key already set. Use /master-key/rotate to change it.',
      });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { encryptedMasterKey: Buffer.from(encryptedMasterKey, 'base64') },
    });

    return { success: true };
  });

  // Retrieve wrapped master key
  fastify.get('/master-key', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid token' });
      return;
    }

    const userId = (request.user as Record<string, unknown>).sub as string;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.encryptedMasterKey) {
      reply.code(404).send({
        code: 'MASTER_KEY_NOT_FOUND',
        message: 'No master key found.',
      });
      return;
    }

    return {
      encryptedMasterKey: Buffer.from(user.encryptedMasterKey).toString('base64'),
    };
  });

  // Rotate master key (replace wrapped MK — client re-encrypts all L2 content)
  fastify.post('/master-key/rotate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid token' });
      return;
    }

    const userId = (request.user as Record<string, unknown>).sub as string;
    const { encryptedMasterKey } = request.body as { encryptedMasterKey: string };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.encryptedMasterKey) {
      reply.code(404).send({
        code: 'MASTER_KEY_NOT_FOUND',
        message: 'No master key to rotate.',
      });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { encryptedMasterKey: Buffer.from(encryptedMasterKey, 'base64') },
    });

    return { success: true };
  });
};
```

Also run: `npm uninstall node-opaque` to remove the old OPAQUE library.

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: Errors only in `src/routes/connect.ts` (scopes → role, fixed later).

- [ ] **Step 4: Commit**

```bash
git add src/plugins/opaque.ts src/routes/auth.ts
git commit -m "refactor: split OPAQUE to server-only, add master-key endpoints"
```

---

## Chunk 2: Service Layer Foundation

### Task 4: StorageService

**Files:**
- Create: `src/services/storage.ts`
- Create: `src/tests/services/storage.test.ts`

- [ ] **Step 1: Write failing test for StorageService**

```typescript
// src/tests/services/storage.test.ts
import { StorageService } from '../../services/storage';

// Mock S3Client
jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn();
  return {
    S3Client: jest.fn(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn((params) => ({ ...params, _type: 'Put' })),
    GetObjectCommand: jest.fn((params) => ({ ...params, _type: 'Get' })),
    DeleteObjectCommand: jest.fn((params) => ({
      ...params,
      _type: 'Delete',
    })),
    __mockSend: mockSend,
  };
});

const { __mockSend: mockSend } = jest.requireMock('@aws-sdk/client-s3');

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StorageService({
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      accessKeyId: 'test',
      secretAccessKey: 'test',
      bucket: 'test-bucket',
    });
  });

  describe('upload', () => {
    it('should upload buffer to S3 with correct key', async () => {
      mockSend.mockResolvedValueOnce({});
      const buffer = Buffer.from('test data');

      await service.upload('user1/memories/test.enc', buffer, 'abc123');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.Key).toBe('user1/memories/test.enc');
      expect(cmd.Bucket).toBe('test-bucket');
    });
  });

  describe('download', () => {
    it('should fetch buffer from S3', async () => {
      const bodyStream = {
        transformToByteArray: jest
          .fn()
          .mockResolvedValue(new Uint8Array([1, 2, 3])),
      };
      mockSend.mockResolvedValueOnce({ Body: bodyStream });

      const result = await service.download('user1/memories/test.enc');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(3);
    });

    it('should throw if key not found', async () => {
      mockSend.mockResolvedValueOnce({ Body: undefined });

      await expect(
        service.download('nonexistent')
      ).rejects.toThrow('Object not found');
    });
  });

  describe('delete', () => {
    it('should delete object from S3', async () => {
      mockSend.mockResolvedValueOnce({});

      await service.delete('user1/memories/test.enc');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.Key).toBe('user1/memories/test.enc');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/services/storage.test.ts --no-coverage`
Expected: FAIL — cannot find module `../../services/storage`

- [ ] **Step 3: Implement StorageService**

```typescript
// src/services/storage.ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(config: StorageConfig) {
    this.s3 = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
    this.bucket = config.bucket;
  }

  async upload(key: string, body: Buffer, sha256: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'application/octet-stream',
        Metadata: { sha256 },
      })
    );
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error('Object not found');
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/tests/services/storage.test.ts --no-coverage`
Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/services/storage.ts src/tests/services/storage.test.ts
git commit -m "feat: add StorageService wrapping S3 operations"
```

---

### Task 5: AuditService

**Files:**
- Create: `src/services/audit.ts`
- Create: `src/tests/services/audit.test.ts`
- Modify: `src/plugins/audit.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/tests/services/audit.test.ts
import { AuditService } from '../../services/audit';

const mockCreate = jest.fn();
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    auditLog: { create: mockCreate },
  })),
}));

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService();
  });

  it('should create audit log with required fields', async () => {
    mockCreate.mockResolvedValueOnce({});

    await service.log('user-1', {
      route: '/v1/memory/remember',
      method: 'POST',
      ip: '127.0.0.1',
      status: 200,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        route: '/v1/memory/remember',
        method: 'POST',
        ip: '127.0.0.1',
        status: 200,
        action: undefined,
        uri: undefined,
        clientId: undefined,
        bytes: undefined,
      }),
    });
  });

  it('should include optional context fields', async () => {
    mockCreate.mockResolvedValueOnce({});

    await service.log('user-1', {
      route: '/v1/memory/remember',
      method: 'POST',
      ip: '127.0.0.1',
      status: 200,
      action: 'remember',
      uri: 'preferences/theme',
      clientId: 'agent-x',
      bytes: 1024,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'remember',
        uri: 'preferences/theme',
        clientId: 'agent-x',
        bytes: 1024,
      }),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/services/audit.test.ts --no-coverage`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement AuditService**

```typescript
// src/services/audit.ts
import { PrismaClient } from '@prisma/client';

interface AuditEntry {
  route: string;
  method: string;
  ip: string;
  status: number;
  action?: string;
  uri?: string;
  clientId?: string;
  bytes?: number;
}

export class AuditService {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
  }

  async log(userId: string, entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        route: entry.route,
        method: entry.method,
        ip: entry.ip,
        status: entry.status,
        action: entry.action,
        uri: entry.uri,
        clientId: entry.clientId,
        bytes: entry.bytes,
      },
    });
  }
}
```

- [ ] **Step 4: Update audit plugin to delegate to AuditService**

Replace `src/plugins/audit.ts`:

```typescript
import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { AuditService } from '../services/audit';

const auditService = new AuditService();

const audit: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onResponse', async (request, reply) => {
    if (request.url === '/health' || request.url === '/ready') {
      return;
    }

    let userId: string | undefined;
    try {
      const decoded = request.user;
      if (decoded && decoded.sub) {
        userId = decoded.sub;
      }
    } catch {
      // Not authenticated
    }

    if (userId) {
      const contentLength = request.headers['content-length'];
      const bytes = contentLength ? parseInt(contentLength) : undefined;

      await auditService.log(userId, {
        route: request.url,
        method: request.method,
        ip: request.ip,
        status: reply.statusCode,
        bytes,
      });
    }
  });
};

export default fp(audit);
```

- [ ] **Step 5: Run test and typecheck**

Run: `npx jest src/tests/services/audit.test.ts --no-coverage && npm run typecheck`
Expected: Tests PASS, typecheck passes (except connect.ts scopes issue).

- [ ] **Step 6: Commit**

```bash
git add src/services/audit.ts src/tests/services/audit.test.ts src/plugins/audit.ts
git commit -m "feat: extract AuditService from audit plugin, add context fields"
```

---

### Task 6: UsageService

**Files:**
- Create: `src/services/usage.ts`
- Create: `src/tests/services/usage.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/tests/services/usage.test.ts
import { UsageService } from '../../services/usage';

const mockUpsert = jest.fn();
const mockFindUnique = jest.fn();
const mockCount = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    usageRecord: { upsert: mockUpsert, findUnique: mockFindUnique },
    memoryEntry: { count: mockCount },
  })),
}));

describe('UsageService', () => {
  let service: UsageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsageService();
  });

  describe('increment', () => {
    it('should upsert usage record for current period', async () => {
      mockUpsert.mockResolvedValueOnce({});

      await service.increment('user-1', 'remember');

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_action_period: {
              userId: 'user-1',
              action: 'remember',
              period: expect.stringMatching(/^\d{4}-\d{2}$/),
            },
          },
        })
      );
    });
  });

  describe('checkMemoryLimit', () => {
    it('should not throw when under limit', async () => {
      mockCount.mockResolvedValueOnce(50);

      await expect(
        service.checkMemoryLimit('user-1', 1000)
      ).resolves.not.toThrow();
    });

    it('should throw when at limit', async () => {
      mockCount.mockResolvedValueOnce(1000);

      await expect(
        service.checkMemoryLimit('user-1', 1000)
      ).rejects.toThrow('USAGE_LIMIT_REACHED');
    });
  });

  describe('checkOperationLimit', () => {
    it('should not throw when under limit', async () => {
      mockFindUnique.mockResolvedValueOnce({ count: 50 });

      await expect(
        service.checkOperationLimit('user-1', 'recall', 5000)
      ).resolves.not.toThrow();
    });

    it('should not throw when no record exists', async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      await expect(
        service.checkOperationLimit('user-1', 'recall', 5000)
      ).resolves.not.toThrow();
    });

    it('should throw when at limit', async () => {
      mockFindUnique.mockResolvedValueOnce({ count: 5000 });

      await expect(
        service.checkOperationLimit('user-1', 'recall', 5000)
      ).rejects.toThrow('USAGE_LIMIT_REACHED');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/services/usage.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement UsageService**

```typescript
// src/services/usage.ts
import { PrismaClient, UsageAction } from '@prisma/client';

export class UsageLimitError extends Error {
  readonly code = 'USAGE_LIMIT_REACHED';

  constructor(action: string) {
    super(`USAGE_LIMIT_REACHED: ${action} limit exceeded`);
    this.name = 'UsageLimitError';
  }
}

export class UsageService {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
  }

  private currentPeriod(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  async increment(userId: string, action: UsageAction): Promise<void> {
    const period = this.currentPeriod();

    await this.prisma.usageRecord.upsert({
      where: {
        userId_action_period: { userId, action, period },
      },
      create: { userId, action, period, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  async checkMemoryLimit(userId: string, limit: number): Promise<void> {
    const count = await this.prisma.memoryEntry.count({
      where: { userId },
    });

    if (count >= limit) {
      throw new UsageLimitError('memory_count');
    }
  }

  async checkOperationLimit(
    userId: string,
    action: UsageAction,
    limit: number
  ): Promise<void> {
    const period = this.currentPeriod();

    const record = await this.prisma.usageRecord.findUnique({
      where: {
        userId_action_period: { userId, action, period },
      },
    });

    if (record && record.count >= limit) {
      throw new UsageLimitError(action);
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/tests/services/usage.test.ts --no-coverage`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/services/usage.ts src/tests/services/usage.test.ts
git commit -m "feat: add UsageService with counter tracking and limit enforcement"
```

---

### Task 7: ContextService (OpenViking Wrapper)

**Files:**
- Create: `src/services/context.ts`
- Create: `src/tests/services/context.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/tests/services/context.test.ts
import { ContextService } from '../../services/context';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ContextService', () => {
  let service: ContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContextService({
      baseUrl: 'http://openviking:8000',
      apiKey: 'test-key',
    });
  });

  describe('write', () => {
    it('should POST to OpenViking with user namespace', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await service.write('user-1', 'preferences/theme', {
        l0: 'Dark mode preference',
        l1: '## Theme\n- Dark mode enabled',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://openviking:8000/api/v1/write',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
          body: expect.stringContaining('user-1'),
        })
      );
    });
  });

  describe('find', () => {
    it('should search within user namespace and return total', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              { uri: 'preferences/theme', l0: 'Dark mode', l1: '', score: 0.9 },
            ],
            total: 42,
          }),
      });

      const { results, total } = await service.find('user-1', 'dark mode', 10, 0);

      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(0.9);
      expect(total).toBe(42);
    });
  });

  describe('delete', () => {
    it('should delete from user namespace', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await service.delete('user-1', 'preferences/theme');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/delete'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('list', () => {
    it('should list directory contents', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            entries: [{ uri: 'preferences/', type: 'directory', l0: '' }],
          }),
      });

      const entries = await service.list('user-1', 'preferences/', 2);

      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('directory');
    });
  });

  describe('error handling', () => {
    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        service.write('user-1', 'test', { l0: '', l1: '' })
      ).rejects.toThrow('OpenViking error: 500');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/services/context.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement ContextService**

```typescript
// src/services/context.ts

interface ContextConfig {
  baseUrl: string;
  apiKey: string;
}

interface WritePayload {
  l0: string;
  l1: string;
}

interface SearchResult {
  uri: string;
  l0: string;
  l1: string;
  score: number;
}

interface DirectoryEntry {
  uri: string;
  l0: string;
  type: 'file' | 'directory';
  children?: DirectoryEntry[];
}

export class ContextService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ContextConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  private userRoot(userId: string): string {
    return `viking://user/${userId}/memories`;
  }

  private fullUri(userId: string, relativePath: string): string {
    return `${this.userRoot(userId)}/${relativePath}`;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private async request(
    path: string,
    body: Record<string, unknown>
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`OpenViking error: ${response.status}`);
    }

    return response.json();
  }

  async write(
    userId: string,
    relativePath: string,
    payload: WritePayload
  ): Promise<void> {
    await this.request('/api/v1/write', {
      uri: this.fullUri(userId, relativePath),
      owner_space: userId,
      l0: payload.l0,
      l1: payload.l1,
    });
  }

  async find(
    userId: string,
    query: string,
    limit: number,
    offset: number = 0
  ): Promise<{ results: SearchResult[]; total: number }> {
    const data = (await this.request('/api/v1/find', {
      query,
      scope: this.userRoot(userId),
      owner_space: userId,
      limit,
      offset,
    })) as { results: SearchResult[]; total: number };

    return { results: data.results, total: data.total };
  }

  async read(
    userId: string,
    relativePath: string
  ): Promise<{ l0: string; l1: string }> {
    const data = (await this.request('/api/v1/read', {
      uri: this.fullUri(userId, relativePath),
      owner_space: userId,
    })) as { l0: string; l1: string };

    return data;
  }

  async delete(userId: string, relativePath: string): Promise<void> {
    await this.request('/api/v1/delete', {
      uri: this.fullUri(userId, relativePath),
      owner_space: userId,
    });
  }

  async list(
    userId: string,
    path: string,
    depth: number
  ): Promise<DirectoryEntry[]> {
    const data = (await this.request('/api/v1/ls', {
      uri: this.fullUri(userId, path),
      owner_space: userId,
      depth,
    })) as { entries: DirectoryEntry[] };

    return data.entries;
  }

  // Session operations for OpenViking session tracking

  async startSession(userId: string, sessionId: string): Promise<void> {
    await this.request('/api/v1/session/create', {
      session_id: sessionId,
      owner_space: userId,
      uri: `viking://user/${userId}/sessions/${sessionId}`,
    });
  }

  async appendSessionMessage(
    userId: string,
    sessionId: string,
    l0Summary: string
  ): Promise<void> {
    await this.request('/api/v1/session/append', {
      session_id: sessionId,
      owner_space: userId,
      l0: l0Summary,
    });
  }

  async closeSession(userId: string, sessionId: string): Promise<void> {
    await this.request('/api/v1/session/close', {
      session_id: sessionId,
      owner_space: userId,
    });
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/tests/services/context.test.ts --no-coverage`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/services/context.ts src/tests/services/context.test.ts
git commit -m "feat: add ContextService wrapping OpenViking HTTP API"
```

---

## Chunk 3: Role Guard + Grant Service + Connect Refactor

### Task 8: GrantService

**Files:**
- Create: `src/services/grant.ts`
- Create: `src/tests/services/grant.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/tests/services/grant.test.ts
import { GrantService, Permission } from '../../services/grant';

describe('GrantService', () => {
  describe('checkPermission', () => {
    const service = new GrantService();

    it('should allow tool role to recall and browse', () => {
      expect(service.hasPermission('tool', 'recall')).toBe(true);
      expect(service.hasPermission('tool', 'browse')).toBe(true);
    });

    it('should deny tool role from remember and forget', () => {
      expect(service.hasPermission('tool', 'remember')).toBe(false);
      expect(service.hasPermission('tool', 'content')).toBe(false);
      expect(service.hasPermission('tool', 'forget')).toBe(false);
      expect(service.hasPermission('tool', 'sessions')).toBe(false);
      expect(service.hasPermission('tool', 'grants')).toBe(false);
    });

    it('should allow assistant role read + write but not delete/grants', () => {
      expect(service.hasPermission('assistant', 'recall')).toBe(true);
      expect(service.hasPermission('assistant', 'browse')).toBe(true);
      expect(service.hasPermission('assistant', 'remember')).toBe(true);
      expect(service.hasPermission('assistant', 'content')).toBe(true);
      expect(service.hasPermission('assistant', 'sessions')).toBe(true);
      expect(service.hasPermission('assistant', 'forget')).toBe(false);
      expect(service.hasPermission('assistant', 'grants')).toBe(false);
    });

    it('should allow admin role everything', () => {
      expect(service.hasPermission('admin', 'recall')).toBe(true);
      expect(service.hasPermission('admin', 'remember')).toBe(true);
      expect(service.hasPermission('admin', 'forget')).toBe(true);
      expect(service.hasPermission('admin', 'grants')).toBe(true);
      expect(service.hasPermission('admin', 'sessions')).toBe(true);
    });
  });

  describe('permissionsForRole', () => {
    const service = new GrantService();

    it('should return correct permissions for each role', () => {
      expect(service.permissionsForRole('tool')).toEqual(['recall', 'browse']);
      expect(service.permissionsForRole('assistant')).toEqual(
        expect.arrayContaining(['recall', 'browse', 'remember', 'content', 'sessions'])
      );
      expect(service.permissionsForRole('admin')).toEqual(
        expect.arrayContaining([
          'recall',
          'browse',
          'remember',
          'content',
          'sessions',
          'forget',
          'grants',
        ])
      );
    });
  });

  describe('deriveScopesFromRole', () => {
    const service = new GrantService();

    it('should derive backward-compatible scopes', () => {
      expect(service.deriveScopesFromRole('tool')).toEqual(['vault.read']);
      expect(service.deriveScopesFromRole('assistant')).toEqual([
        'vault.read',
        'vault.write',
      ]);
      expect(service.deriveScopesFromRole('admin')).toEqual([
        'vault.read',
        'vault.write',
      ]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/services/grant.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement GrantService**

```typescript
// src/services/grant.ts
import { Role } from '@prisma/client';

export type Permission =
  | 'recall'
  | 'browse'
  | 'remember'
  | 'content'
  | 'forget'
  | 'sessions'
  | 'grants';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  tool: ['recall', 'browse'],
  assistant: ['recall', 'browse', 'remember', 'content', 'sessions'],
  admin: [
    'recall',
    'browse',
    'remember',
    'content',
    'sessions',
    'forget',
    'grants',
  ],
};

const ROLE_SCOPES: Record<Role, string[]> = {
  tool: ['vault.read'],
  assistant: ['vault.read', 'vault.write'],
  admin: ['vault.read', 'vault.write'],
};

export class GrantService {
  hasPermission(role: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role].includes(permission);
  }

  permissionsForRole(role: Role): Permission[] {
    return [...ROLE_PERMISSIONS[role]];
  }

  deriveScopesFromRole(role: Role): string[] {
    return [...ROLE_SCOPES[role]];
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/tests/services/grant.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/grant.ts src/tests/services/grant.test.ts
git commit -m "feat: add GrantService with role-based permission matrix"
```

---

### Task 9: Role Guard Plugin

**Files:**
- Create: `src/plugins/role-guard.ts`
- Create: `src/tests/plugins/role-guard.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/tests/plugins/role-guard.test.ts
import { rolePermissions, extractRoleFromToken } from '../../plugins/role-guard';

describe('role-guard', () => {
  describe('rolePermissions', () => {
    it('should map tool to read-only permissions', () => {
      expect(rolePermissions('tool')).toEqual(
        expect.arrayContaining(['recall', 'browse'])
      );
      expect(rolePermissions('tool')).not.toContain('remember');
    });

    it('should map admin to all permissions', () => {
      const perms = rolePermissions('admin');
      expect(perms).toContain('forget');
      expect(perms).toContain('grants');
    });
  });

  describe('extractRoleFromToken', () => {
    it('should return admin for direct JWT (owner)', () => {
      const decoded = { sub: 'user-1' };
      expect(extractRoleFromToken(decoded)).toBe('admin');
    });

    it('should return role from grant token', () => {
      const decoded = { sub: 'user-1', aud: 'client-1', role: 'tool' };
      expect(extractRoleFromToken(decoded)).toBe('tool');
    });

    it('should default to tool for grant without role', () => {
      const decoded = { sub: 'user-1', aud: 'client-1' };
      expect(extractRoleFromToken(decoded)).toBe('tool');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/plugins/role-guard.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement role-guard plugin**

```typescript
// src/plugins/role-guard.ts
import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '@prisma/client';
import { GrantService, Permission } from '../services/grant';

const grantService = new GrantService();

export function rolePermissions(role: Role): Permission[] {
  return grantService.permissionsForRole(role);
}

export function extractRoleFromToken(decoded: Record<string, unknown>): Role {
  // Direct JWT (user's own token) — no `aud` means owner
  if (!decoded.aud) {
    return 'admin';
  }
  // Grant token — use embedded role, default to tool
  return (decoded.role as Role) ?? 'tool';
}

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing token',
      });
      return;
    }

    const decoded = request.user as Record<string, unknown>;
    const role = extractRoleFromToken(decoded);

    if (!grantService.hasPermission(role, permission)) {
      reply.code(403).send({
        code: 'FORBIDDEN',
        message: `Role '${role}' does not have '${permission}' permission`,
      });
      return;
    }

    // Attach role and userId to request for downstream use
    (request as Record<string, unknown>).userRole = role;
    (request as Record<string, unknown>).userId = decoded.sub;
  };
}

const roleGuard: FastifyPluginAsync = async (_fastify) => {
  // Plugin registers the helpers; routes use requirePermission() as preHandler
};

export default fp(roleGuard);
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/tests/plugins/role-guard.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/role-guard.ts src/tests/plugins/role-guard.test.ts
git commit -m "feat: add role-guard plugin with permission checking"
```

---

### Task 10: Refactor Connect Routes to Role-Based

**Files:**
- Modify: `src/routes/connect.ts`

- [ ] **Step 1: Update connect.ts to use role instead of scopes**

Replace `src/routes/connect.ts` with:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient, Role } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { GrantService } from '../services/grant';

const prisma = new PrismaClient();
const grantService = new GrantService();

export const connectRoutes: FastifyPluginAsync = async (fastify) => {
  // Start authorization
  fastify.post('/authorize', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing token',
      });
      return;
    }

    const userId = (request.user as Record<string, unknown>).sub as string;
    const { client_id, role } = request.body as {
      client_id: string;
      role: Role;
    };

    const validRoles: Role[] = ['tool', 'assistant', 'admin'];
    if (!validRoles.includes(role)) {
      reply.code(400).send({
        code: 'INVALID_ROLE',
        message: `Role must be one of: ${validRoles.join(', ')}`,
      });
      return;
    }

    const client = await prisma.client.findUnique({
      where: { clientId: client_id },
    });

    if (!client) {
      reply.code(400).send({
        code: 'INVALID_CLIENT',
        message: 'Invalid client ID',
      });
      return;
    }

    const consentCode = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.grant.create({
      data: {
        userId,
        clientId: client_id,
        role,
        expiresAt,
        jwtId: consentCode,
      },
    });

    return { consent_code: consentCode };
  });

  // Exchange consent code for token
  fastify.post('/token', async (request, reply) => {
    const { consent_code, client_secret } = request.body as {
      consent_code: string;
      client_secret: string;
    };

    const grant = await prisma.grant.findUnique({
      where: { jwtId: consent_code },
      include: { client: true },
    });

    if (!grant) {
      reply.code(400).send({
        code: 'INVALID_CONSENT_CODE',
        message: 'Invalid consent code',
      });
      return;
    }

    if (grant.expiresAt < new Date()) {
      reply.code(400).send({
        code: 'EXPIRED_CONSENT_CODE',
        message: 'Consent code has expired',
      });
      return;
    }

    const clientSecretHash = createHash('sha256')
      .update(client_secret)
      .digest('hex');

    if (clientSecretHash !== grant.client.clientSecretHash) {
      reply.code(400).send({
        code: 'INVALID_CLIENT_SECRET',
        message: 'Invalid client secret',
      });
      return;
    }

    const token = fastify.jwt.sign(
      {
        sub: grant.userId,
        aud: grant.clientId,
        role: grant.role,
      },
      {
        expiresIn: '30d',
        jti: grant.jwtId,
      }
    );

    return {
      grant_token: token,
      role: grant.role,
      scopes: grantService.deriveScopesFromRole(grant.role),
    };
  });

  // Introspect token
  fastify.post('/introspect', async (request, reply) => {
    try {
      const token = request.headers.authorization!.split(' ')[1];
      const decoded = fastify.jwt.verify(token) as Record<string, unknown>;
      const role = (decoded.role as Role) ?? 'tool';

      return {
        active: true,
        role,
        permissions: grantService.permissionsForRole(role),
        scopes: grantService.deriveScopesFromRole(role),
        exp: decoded.exp,
      };
    } catch {
      reply.code(401).send({
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      });
    }
  });

  // List grants for user
  fastify.get('/grants', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing token',
      });
      return;
    }

    const userId = (request.user as Record<string, unknown>).sub as string;

    const grants = await prisma.grant.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      include: { client: { select: { name: true } } },
    });

    return {
      grants: grants.map((g) => ({
        id: g.id,
        clientName: g.client.name,
        clientId: g.clientId,
        role: g.role,
        createdAt: g.createdAt,
        expiresAt: g.expiresAt,
      })),
    };
  });

  // Revoke a grant
  fastify.delete('/grants/:id', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing token',
      });
      return;
    }

    const userId = (request.user as Record<string, unknown>).sub as string;
    const { id } = request.params as { id: string };

    const grant = await prisma.grant.findFirst({
      where: { id, userId },
    });

    if (!grant) {
      reply.code(404).send({
        code: 'GRANT_NOT_FOUND',
        message: 'Grant not found',
      });
      return;
    }

    await prisma.grant.delete({ where: { id } });
    reply.code(204).send();
  });
};
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS — no more scopes errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/connect.ts
git commit -m "refactor: replace scopes with role-based grants in connect flow"
```

---

## Chunk 4: Memory Service + Routes

### Task 11: MemoryService

**Files:**
- Create: `src/services/memory.ts`
- Create: `src/tests/services/memory.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/tests/services/memory.test.ts
import { MemoryService } from '../../services/memory';
import { StorageService } from '../../services/storage';
import { ContextService } from '../../services/context';

// Mock dependencies
jest.mock('../../services/storage');
jest.mock('../../services/context');

const mockPrisma = {
  memoryEntry: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
};

describe('MemoryService', () => {
  let service: MemoryService;
  let mockStorage: jest.Mocked<StorageService>;
  let mockContext: jest.Mocked<ContextService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage = new StorageService({} as never) as jest.Mocked<StorageService>;
    mockContext = new ContextService({} as never) as jest.Mocked<ContextService>;
    service = new MemoryService(
      mockPrisma as never,
      mockStorage,
      mockContext
    );
  });

  describe('remember', () => {
    it('should store L2 in S3, metadata in OV, record in Prisma', async () => {
      mockStorage.upload = jest.fn().mockResolvedValue(undefined);
      mockContext.write = jest.fn().mockResolvedValue(undefined);
      mockPrisma.memoryEntry.create.mockResolvedValue({
        id: 'mem-1',
        uri: 'prefs/theme',
        createdAt: new Date(),
      });

      const result = await service.remember('user-1', {
        uri: 'prefs/theme',
        l0: 'Theme preference',
        l1: '## Theme\n- Dark mode',
        encryptedL2: Buffer.from('encrypted'),
        sha256: 'abc123',
      });

      expect(mockStorage.upload).toHaveBeenCalledTimes(1);
      expect(mockContext.write).toHaveBeenCalledWith('user-1', 'prefs/theme', {
        l0: 'Theme preference',
        l1: '## Theme\n- Dark mode',
      });
      expect(mockPrisma.memoryEntry.create).toHaveBeenCalledTimes(1);
      expect(result.uri).toBe('prefs/theme');
    });

    it('should rollback S3 if OpenViking write fails', async () => {
      mockStorage.upload = jest.fn().mockResolvedValue(undefined);
      mockContext.write = jest.fn().mockRejectedValue(new Error('OV down'));
      mockStorage.delete = jest.fn().mockResolvedValue(undefined);

      await expect(
        service.remember('user-1', {
          uri: 'prefs/theme',
          l0: 'x',
          l1: 'y',
          encryptedL2: Buffer.from('enc'),
          sha256: 'abc',
        })
      ).rejects.toThrow('OV down');

      expect(mockStorage.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('recall', () => {
    it('should search via ContextService with offset', async () => {
      mockContext.find = jest.fn().mockResolvedValue({
        results: [
          { uri: 'prefs/theme', l0: 'Theme', l1: 'Dark', score: 0.9 },
        ],
        total: 42,
      });

      const results = await service.recall('user-1', {
        query: 'theme',
        limit: 10,
        offset: 0,
      });

      expect(mockContext.find).toHaveBeenCalledWith('user-1', 'theme', 10, 0);
      expect(results.data).toHaveLength(1);
      expect(results.total).toBe(42);
    });
  });

  describe('getContent', () => {
    it('should look up S3 key in Prisma and download', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue({
        s3Key: 'user-1/memories/prefs/theme.enc',
      });
      mockStorage.download = jest
        .fn()
        .mockResolvedValue(Buffer.from('encrypted'));

      const result = await service.getContent('user-1', 'prefs/theme');

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should throw if memory not found', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue(null);

      await expect(
        service.getContent('user-1', 'nonexistent')
      ).rejects.toThrow('Memory not found');
    });
  });

  describe('forget', () => {
    it('should delete from OV, S3, and Prisma', async () => {
      mockPrisma.memoryEntry.findUnique.mockResolvedValue({
        id: 'mem-1',
        s3Key: 'user-1/memories/prefs/theme.enc',
      });
      mockContext.delete = jest.fn().mockResolvedValue(undefined);
      mockStorage.delete = jest.fn().mockResolvedValue(undefined);
      mockPrisma.memoryEntry.delete.mockResolvedValue({});

      await service.forget('user-1', 'prefs/theme');

      expect(mockContext.delete).toHaveBeenCalledTimes(1);
      expect(mockStorage.delete).toHaveBeenCalledTimes(1);
      expect(mockPrisma.memoryEntry.delete).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/services/memory.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement MemoryService**

```typescript
// src/services/memory.ts
import { PrismaClient } from '@prisma/client';
import { StorageService } from './storage';
import { ContextService } from './context';

interface RememberInput {
  uri: string;
  l0: string;
  l1: string;
  encryptedL2: Buffer;
  sha256: string;
}

interface RecallInput {
  query: string;
  limit: number;
  offset: number;
}

interface RecallResult {
  data: Array<{ uri: string; l0: string; l1: string; score: number }>;
  total: number;
}

export class MemoryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
    private readonly context: ContextService
  ) {}

  private s3Key(userId: string, uri: string): string {
    return `${userId}/memories/${uri}.enc`;
  }

  async remember(
    userId: string,
    input: RememberInput
  ): Promise<{ uri: string; createdAt: Date }> {
    const key = this.s3Key(userId, input.uri);

    // Step 1: S3
    await this.storage.upload(key, input.encryptedL2, input.sha256);

    // Step 2: OpenViking (rollback S3 on failure)
    try {
      await this.context.write(userId, input.uri, {
        l0: input.l0,
        l1: input.l1,
      });
    } catch (error) {
      await this.storage.delete(key);
      throw error;
    }

    // Step 3: Prisma (rollback OV + S3 on failure)
    try {
      const entry = await this.prisma.memoryEntry.create({
        data: {
          userId,
          uri: input.uri,
          s3Key: key,
          sha256: input.sha256,
          sizeBytes: input.encryptedL2.length,
        },
      });

      return { uri: entry.uri, createdAt: entry.createdAt };
    } catch (error) {
      await this.context.delete(userId, input.uri);
      await this.storage.delete(key);
      throw error;
    }
  }

  async recall(userId: string, input: RecallInput): Promise<RecallResult> {
    const { results, total } = await this.context.find(
      userId,
      input.query,
      input.limit,
      input.offset
    );

    return { data: results, total };
  }

  async getContent(userId: string, uri: string): Promise<Buffer> {
    const entry = await this.prisma.memoryEntry.findUnique({
      where: { userId_uri: { userId, uri } },
    });

    if (!entry) {
      throw new Error('Memory not found');
    }

    return this.storage.download(entry.s3Key);
  }

  async forget(userId: string, uri: string): Promise<void> {
    const entry = await this.prisma.memoryEntry.findUnique({
      where: { userId_uri: { userId, uri } },
    });

    if (!entry) {
      throw new Error('Memory not found');
    }

    await this.context.delete(userId, uri);
    await this.storage.delete(entry.s3Key);
    await this.prisma.memoryEntry.delete({ where: { id: entry.id } });
  }

  async browse(
    userId: string,
    path: string,
    depth: number
  ): Promise<unknown[]> {
    return this.context.list(userId, path, depth);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/tests/services/memory.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/memory.ts src/tests/services/memory.test.ts
git commit -m "feat: add MemoryService orchestrating S3 + OpenViking + Prisma"
```

---

### Task 12: Memory Routes

**Files:**
- Create: `src/routes/memory.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create memory route handlers**

```typescript
// src/routes/memory.ts
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requirePermission } from '../plugins/role-guard';
import { MemoryService } from '../services/memory';
import { UsageService, UsageLimitError } from '../services/usage';

const rememberSchema = z.object({
  uri: z.string().min(1).max(500),
  l0: z.string().min(1).max(500),
  l1: z.string().min(1).max(10000),
  encryptedL2: z.string().min(1).refine(
    (s) => Buffer.byteLength(s, 'base64') <= 10 * 1024 * 1024,
    'Encrypted L2 exceeds 10MB limit'
  ),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const recallSchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

export function memoryRoutes(
  memoryService: MemoryService,
  usageService: UsageService
): FastifyPluginAsync {
  return async (fastify) => {
    // Remember
    fastify.post(
      '/remember',
      { preHandler: requirePermission('remember') },
      async (request, reply) => {
        const userId = (request as Record<string, unknown>).userId as string;
        const body = rememberSchema.parse(request.body);

        try {
          await usageService.checkMemoryLimit(userId, 1000);
        } catch (err) {
          if (err instanceof UsageLimitError) {
            reply.code(429).send({
              code: err.code,
              message: err.message,
            });
            return;
          }
          throw err;
        }

        const encryptedL2 = Buffer.from(body.encryptedL2, 'base64');
        const result = await memoryService.remember(userId, {
          uri: body.uri,
          l0: body.l0,
          l1: body.l1,
          encryptedL2,
          sha256: body.sha256,
        });

        await usageService.increment(userId, 'remember');

        return {
          success: true,
          data: result,
        };
      }
    );

    // Recall
    fastify.post(
      '/recall',
      { preHandler: requirePermission('recall') },
      async (request, reply) => {
        const userId = (request as Record<string, unknown>).userId as string;
        const body = recallSchema.parse(request.body);

        const results = await memoryService.recall(userId, body);
        await usageService.increment(userId, 'recall');

        return {
          success: true,
          data: results.data,
          meta: {
            total: results.total,
            page: Math.floor(body.offset / body.limit) + 1,
            limit: body.limit,
          },
        };
      }
    );

    // Content — uses wildcard because URIs contain slashes (e.g., preferences/editor-theme)
    fastify.get(
      '/content/*',
      { preHandler: requirePermission('content') },
      async (request, reply) => {
        const userId = (request as Record<string, unknown>).userId as string;
        const uri = (request.params as Record<string, string>)['*'];

        try {
          const content = await memoryService.getContent(userId, uri);
          await usageService.increment(userId, 'content_fetch');

          reply.header('Content-Type', 'application/octet-stream');
          return content;
        } catch {
          reply.code(404).send({
            code: 'MEMORY_NOT_FOUND',
            message: 'Memory not found',
          });
        }
      }
    );

    // Forget — wildcard for slash-separated URIs
    fastify.delete(
      '/forget/*',
      { preHandler: requirePermission('forget') },
      async (request, reply) => {
        const userId = (request as Record<string, unknown>).userId as string;
        const uri = (request.params as Record<string, string>)['*'];

        try {
          await memoryService.forget(userId, uri);
          reply.code(204).send();
        } catch {
          reply.code(404).send({
            code: 'MEMORY_NOT_FOUND',
            message: 'Memory not found',
          });
        }
      }
    );

    // Browse
    fastify.get(
      '/browse',
      { preHandler: requirePermission('browse') },
      async (request, reply) => {
        const userId = (request as Record<string, unknown>).userId as string;
        const { path, depth, page, limit } = request.query as {
          path?: string;
          depth?: string;
          page?: string;
          limit?: string;
        };

        const tree = await memoryService.browse(
          userId,
          path ?? '',
          parseInt(depth ?? '2')
        );

        await usageService.increment(userId, 'browse');

        return {
          success: true,
          data: { tree },
          meta: {
            total: tree.length,
            page: parseInt(page ?? '1'),
            limit: parseInt(limit ?? '50'),
          },
        };
      }
    );
  };
}
```

- [ ] **Step 2: Register memory routes in index.ts**

Add to `src/index.ts` after the existing route registrations (line 72):

Import at top:
```typescript
import { memoryRoutes } from './routes/memory';
import { sessionRoutes } from './routes/sessions';
import { MemoryService } from './services/memory';
import { SessionService } from './services/session';
import { StorageService } from './services/storage';
import { ContextService } from './services/context';
import { UsageService } from './services/usage';
import roleGuard from './plugins/role-guard';
```

After the s3 client initialization, add service initialization:
```typescript
const storageService = new StorageService({
  endpoint: process.env.S3_ENDPOINT!,
  region: process.env.S3_REGION!,
  accessKeyId: process.env.S3_ACCESS_KEY_ID!,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  bucket: process.env.S3_BUCKET!,
});

const contextService = new ContextService({
  baseUrl: process.env.OPENVIKING_URL ?? 'http://localhost:8000',
  apiKey: process.env.OV_API_KEY ?? 'dev-openviking-key',
});

const memoryService = new MemoryService(prisma, storageService, contextService);
const usageService = new UsageService(prisma);
```

Register plugin and routes (after existing route registrations):
```typescript
app.register(roleGuard);
app.register(memoryRoutes(memoryService, usageService), { prefix: '/v1/memory' });
```

Update the readiness check to include OpenViking:
```typescript
// Inside the /ready handler, add after S3 check:
await fetch(`${process.env.OPENVIKING_URL ?? 'http://localhost:8000'}/health`);
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS (or error about missing sessions routes — that's OK, we create those next)

- [ ] **Step 4: Commit**

```bash
git add src/routes/memory.ts src/index.ts
git commit -m "feat: add memory routes (remember, recall, content, forget, browse)"
```

---

## Chunk 5: Session Service + Routes

### Task 13: SessionService

**Files:**
- Create: `src/services/session.ts`
- Create: `src/tests/services/session.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/tests/services/session.test.ts
import { SessionService } from '../../services/session';
import { MemoryService } from '../../services/memory';
import { StorageService } from '../../services/storage';
import { ContextService } from '../../services/context';

jest.mock('../../services/memory');
jest.mock('../../services/storage');
jest.mock('../../services/context');

const mockPrisma = {
  session: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('SessionService', () => {
  let service: SessionService;
  let mockMemory: jest.Mocked<MemoryService>;
  let mockStorage: jest.Mocked<StorageService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMemory = new MemoryService(
      {} as never,
      {} as never,
      {} as never
    ) as jest.Mocked<MemoryService>;
    mockStorage = new StorageService({} as never) as jest.Mocked<StorageService>;
    service = new SessionService(
      mockPrisma as never,
      mockMemory,
      mockStorage
    );
  });

  describe('create', () => {
    it('should create session in Prisma', async () => {
      mockPrisma.session.create.mockResolvedValue({
        id: 'sess-1',
        status: 'active',
        createdAt: new Date(),
      });

      const result = await service.create('user-1', 'client-1');

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          clientId: 'client-1',
        }),
      });
      expect(result.id).toBe('sess-1');
    });
  });

  describe('appendMessage', () => {
    it('should store encrypted message in S3 and increment count', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        status: 'active',
        messageCount: 0,
      });
      mockStorage.upload = jest.fn().mockResolvedValue(undefined);
      mockPrisma.session.update.mockResolvedValue({ messageCount: 1 });

      await service.appendMessage('user-1', 'sess-1', {
        role: 'user',
        encryptedContent: Buffer.from('encrypted'),
        l0Summary: 'User asked about themes',
        sha256: 'abc123',
      });

      expect(mockStorage.upload).toHaveBeenCalledTimes(1);
      expect(mockPrisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { messageCount: { increment: 1 } },
        })
      );
    });

    it('should reject if session is closed', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        status: 'closed',
      });

      await expect(
        service.appendMessage('user-1', 'sess-1', {
          role: 'user',
          encryptedContent: Buffer.from('x'),
          l0Summary: 'x',
          sha256: 'abc',
        })
      ).rejects.toThrow('Session is closed');
    });
  });

  describe('close', () => {
    it('should store extracted memories and close session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        status: 'active',
        userId: 'user-1',
      });
      mockMemory.remember = jest.fn().mockResolvedValue({
        uri: 'extracted/mem1',
        createdAt: new Date(),
      });
      mockPrisma.session.update.mockResolvedValue({});

      const result = await service.close('user-1', 'sess-1', [
        {
          uri: 'extracted/mem1',
          l0: 'Summary',
          l1: 'Overview',
          encryptedL2: Buffer.from('enc'),
          sha256: 'hash1',
        },
      ]);

      expect(mockMemory.remember).toHaveBeenCalledTimes(1);
      expect(mockPrisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'closed',
          }),
        })
      );
      expect(result.memoriesExtracted).toBe(1);
    });

    it('should reject more than 50 memories', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        status: 'active',
        userId: 'user-1',
      });

      const memories = Array.from({ length: 51 }, (_, i) => ({
        uri: `mem/${i}`,
        l0: 'x',
        l1: 'y',
        encryptedL2: Buffer.from('z'),
        sha256: 'h',
      }));

      await expect(
        service.close('user-1', 'sess-1', memories)
      ).rejects.toThrow('Maximum 50 memories per session close');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tests/services/session.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement SessionService**

```typescript
// src/services/session.ts
import { PrismaClient } from '@prisma/client';
import { MemoryService } from './memory';
import { StorageService } from './storage';
import { ContextService } from './context';

interface AppendMessageInput {
  role: string;
  encryptedContent: Buffer;
  l0Summary: string;
  sha256: string;
}

interface ExtractedMemory {
  uri: string;
  l0: string;
  l1: string;
  encryptedL2: Buffer;
  sha256: string;
}

export class SessionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly memory: MemoryService,
    private readonly storage: StorageService,
    private readonly context: ContextService
  ) {}

  async create(
    userId: string,
    clientId?: string
  ): Promise<{ id: string; status: string; createdAt: Date }> {
    const session = await this.prisma.session.create({
      data: { userId, clientId },
    });

    await this.context.startSession(userId, session.id);

    return {
      id: session.id,
      status: session.status,
      createdAt: session.createdAt,
    };
  }

  async get(
    userId: string,
    sessionId: string
  ): Promise<{
    id: string;
    status: string;
    messageCount: number;
    createdAt: Date;
    closedAt: Date | null;
  }> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new Error('Session not found');
    }

    return {
      id: session.id,
      status: session.status,
      messageCount: session.messageCount,
      createdAt: session.createdAt,
      closedAt: session.closedAt,
    };
  }

  async appendMessage(
    userId: string,
    sessionId: string,
    input: AppendMessageInput
  ): Promise<{ messageIndex: number }> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new Error('Session not found');
    }

    if (session.status === 'closed') {
      throw new Error('Session is closed');
    }

    const msgKey = `${userId}/sessions/${sessionId}/msg-${session.messageCount}.enc`;
    await this.storage.upload(msgKey, input.encryptedContent, input.sha256);
    await this.context.appendSessionMessage(userId, sessionId, input.l0Summary);

    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: { messageCount: { increment: 1 } },
    });

    return { messageIndex: updated.messageCount - 1 };
  }

  async close(
    userId: string,
    sessionId: string,
    extractedMemories: ExtractedMemory[]
  ): Promise<{ memoriesExtracted: number }> {
    if (extractedMemories.length > 50) {
      throw new Error('Maximum 50 memories per session close');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new Error('Session not found');
    }

    if (session.status === 'closed') {
      throw new Error('Session already closed');
    }

    // Store each extracted memory
    for (const mem of extractedMemories) {
      await this.memory.remember(userId, {
        uri: mem.uri,
        l0: mem.l0,
        l1: mem.l1,
        encryptedL2: mem.encryptedL2,
        sha256: mem.sha256,
      });
    }

    // Close the session in OpenViking and Prisma
    await this.context.closeSession(userId, sessionId);
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'closed',
        closedAt: new Date(),
      },
    });

    return { memoriesExtracted: extractedMemories.length };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/tests/services/session.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/session.ts src/tests/services/session.test.ts
git commit -m "feat: add SessionService with client-driven memory extraction"
```

---

### Task 14: Session Routes + Wire Up Index

**Files:**
- Create: `src/routes/sessions.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create session route handlers**

```typescript
// src/routes/sessions.ts
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requirePermission } from '../plugins/role-guard';
import { SessionService } from '../services/session';
import { UsageService } from '../services/usage';

const appendSchema = z.object({
  role: z.string().min(1),
  encryptedContent: z.string().min(1),
  l0Summary: z.string().min(1).max(500),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const closeSchema = z.object({
  memories: z
    .array(
      z.object({
        uri: z.string().min(1).max(500),
        l0: z.string().min(1).max(500),
        l1: z.string().min(1).max(10000),
        encryptedL2: z.string().min(1),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
    )
    .max(50),
});

export function sessionRoutes(
  sessionService: SessionService,
  usageService: UsageService
): FastifyPluginAsync {
  return async (fastify) => {
    // Create session
    fastify.post(
      '/',
      { preHandler: requirePermission('sessions') },
      async (request) => {
        const userId = (request as Record<string, unknown>).userId as string;
        const { clientId } = (request.body as { clientId?: string }) ?? {};

        const session = await sessionService.create(userId, clientId);
        await usageService.increment(userId, 'session_create');

        return { success: true, data: session };
      }
    );

    // Append message
    fastify.post(
      '/:id/messages',
      { preHandler: requirePermission('sessions') },
      async (request, reply) => {
        const userId = (request as Record<string, unknown>).userId as string;
        const { id } = request.params as { id: string };
        const body = appendSchema.parse(request.body);

        try {
          const result = await sessionService.appendMessage(userId, id, {
            role: body.role,
            encryptedContent: Buffer.from(body.encryptedContent, 'base64'),
            l0Summary: body.l0Summary,
            sha256: body.sha256,
          });

          return { success: true, data: result };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          reply.code(400).send({ code: 'SESSION_ERROR', message });
        }
      }
    );

    // Close session
    fastify.post(
      '/:id/close',
      { preHandler: requirePermission('sessions') },
      async (request, reply) => {
        const userId = (request as Record<string, unknown>).userId as string;
        const { id } = request.params as { id: string };
        const body = closeSchema.parse(request.body);

        try {
          const memories = body.memories.map((m) => ({
            ...m,
            encryptedL2: Buffer.from(m.encryptedL2, 'base64'),
          }));

          const result = await sessionService.close(userId, id, memories);
          await usageService.increment(userId, 'session_close');

          return { success: true, data: result };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          reply.code(400).send({ code: 'SESSION_ERROR', message });
        }
      }
    );

    // Get session
    fastify.get(
      '/:id',
      { preHandler: requirePermission('sessions') },
      async (request, reply) => {
        const userId = (request as Record<string, unknown>).userId as string;
        const { id } = request.params as { id: string };

        try {
          const session = await sessionService.get(userId, id);
          return { success: true, data: session };
        } catch {
          reply.code(404).send({
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found',
          });
        }
      }
    );
  };
}
```

- [ ] **Step 2: Complete index.ts wiring**

In `src/index.ts`, add the session service initialization after the memory service:

```typescript
const sessionService = new SessionService(prisma, memoryService, storageService);
```

Register session routes after memory routes:
```typescript
app.register(sessionRoutes(sessionService, usageService), { prefix: '/v1/sessions' });
```

- [ ] **Step 3: Verify full typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/sessions.ts src/index.ts
git commit -m "feat: add session routes and complete index.ts wiring"
```

---

### Task 15: Run All Tests + Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx jest --no-coverage`
Expected: All new service tests pass. Existing e2e tests may need updates due to Grant schema change (scopes → role).

- [ ] **Step 2: Fix any e2e test failures**

The e2e test at `src/tests/e2e.test.ts` likely references `scopes` when creating grants. Update to use `role` instead. The exact changes depend on what's in the test, but replace `scopes: ['vault.read']` with `role: 'tool'` etc.

- [ ] **Step 3: Run full lint + typecheck + test suite**

Run: `npm run lint && npm run typecheck && npx jest --no-coverage`
Expected: All green

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: fix e2e tests for role-based grant migration"
```

---

## Summary

| Chunk | Tasks | Commits | What's testable after |
|---|---|---|---|
| 1: Schema + Infra | 1-3 | 4 | DB schema, OpenViking sidecar, master-key endpoints |
| 2: Service Foundation | 4-7 | 4 | StorageService, AuditService, UsageService, ContextService |
| 3: Role Guard + Connect | 8-10 | 3 | Permission checking, role-based Connect flow |
| 4: Memory | 11-12 | 2 | Full remember/recall/forget/browse API |
| 5: Sessions + Final | 13-15 | 3 | Sessions, full integration, all tests green |
| **Total** | **15 tasks** | **16 commits** | **Complete Phase 1** |
