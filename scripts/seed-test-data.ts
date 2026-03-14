/**
 * Seeds test data for end-to-end testing.
 * Creates a user, stores a wrapped master key, encrypts and stores memories.
 *
 * Run: npx ts-node --transpile-only scripts/seed-test-data.ts
 * Requires: API server running on localhost:3002
 */

import { createHash, createHmac, randomBytes, createCipheriv, hkdfSync } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://context_chest:context_chest_dev@localhost:5433/context_chest';
const API_URL = process.env.API_URL ?? 'http://localhost:3002';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-prod';

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

// --- Crypto helpers (same spec as MCP server) ---

function generateMasterKey(): Buffer {
  return randomBytes(32);
}

function deriveWrappingKey(exportKey: Buffer, userId: string): Buffer {
  return Buffer.from(hkdfSync('sha256', exportKey, userId, 'context-chest-mk-wrap', 32));
}

function wrapMasterKey(mk: Buffer, wrappingKey: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', wrappingKey, iv);
  const encrypted = Buffer.concat([cipher.update(mk), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

function encryptL2(mk: Buffer, uri: string, plaintext: Buffer): string {
  const itemKey = Buffer.from(hkdfSync('sha256', mk, uri, 'context-chest-l2', 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', itemKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

function sha256hex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

// --- API helpers ---

async function apiPost(path: string, token: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return JSON.parse(text);
}

async function apiPut(path: string, token: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return JSON.parse(text);
}

// --- Main ---

async function main() {
  console.log('Cleaning existing test data...');
  await prisma.memoryEntry.deleteMany();
  await prisma.session.deleteMany();
  await prisma.usageRecord.deleteMany();
  await prisma.grant.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.blob.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();

  console.log('Creating test user...');
  const user = await prisma.user.create({
    data: {
      email: 'test@contextchest.dev',
      opaqueRecord: Buffer.from('placeholder-opaque-record'),
    },
  });
  console.log(`  User ID: ${user.id}`);

  // Generate JWT manually (no jsonwebtoken dependency)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  })).toString('base64url');
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  const token = `${header}.${payload}.${signature}`;
  console.log(`  JWT: ${token.slice(0, 30)}...`);

  // Generate and store master key
  const mk = generateMasterKey();
  const fakeExportKey = Buffer.alloc(32, 0x42); // deterministic for testing
  const wrappingKey = deriveWrappingKey(fakeExportKey, user.id);
  const wrappedMk = wrapMasterKey(mk, wrappingKey);

  await prisma.user.update({
    where: { id: user.id },
    data: { encryptedMasterKey: Buffer.from(wrappedMk, 'base64') },
  });
  console.log('  Master key stored');

  // Create test client (for grant testing)
  const clientSecret = 'test-client-secret';
  await prisma.client.create({
    data: {
      clientId: 'claude-code-test',
      name: 'Claude Code (Test)',
      redirectUri: 'http://localhost:5176/callback',
      clientSecretHash: createHash('sha256').update(clientSecret).digest('hex'),
    },
  });
  console.log('  Test client created');

  // Store memories via API
  const memories = [
    {
      uri: 'preferences/editor-theme',
      l0: 'User prefers dark mode in code editors',
      l1: '## Editor Preferences\n- Theme: dark mode (Dracula)\n- Font: JetBrains Mono, 14px\n- Tab size: 2 spaces\n- Line height: 1.6',
      content: 'I always use dark mode in my code editors. My preferred theme is Dracula. I use JetBrains Mono at 14px with 2-space tabs and 1.6 line height. I also enable ligatures and bracket pair colorization.',
    },
    {
      uri: 'preferences/terminal',
      l0: 'Uses iTerm2 with custom Dracula theme',
      l1: '## Terminal Setup\n- App: iTerm2\n- Theme: Dracula variant\n- Shell: zsh with Oh My Zsh\n- Font: Fira Code',
      content: 'My terminal setup is iTerm2 with a custom Dracula color scheme. I use zsh with Oh My Zsh and the powerlevel10k theme. Fira Code is my terminal font. I have aliases for git, docker, and kubectl.',
    },
    {
      uri: 'projects/context-chest/architecture',
      l0: 'Fastify + OpenViking orchestration layer architecture',
      l1: '## Context Chest Architecture\n- API: Fastify with TypeScript\n- Context Engine: OpenViking (sidecar)\n- Database: PostgreSQL + Prisma\n- Storage: S3 (MinIO for dev)\n- Auth: OPAQUE zero-knowledge protocol',
      content: 'Context Chest uses an orchestration layer pattern. The Fastify API server defines business operations (remember, recall, forget) and coordinates between OpenViking for context/search, S3 for encrypted content storage, and PostgreSQL via Prisma for relational state. OpenViking runs as a sidecar service.',
    },
    {
      uri: 'projects/context-chest/encryption',
      l0: 'AES-GCM 256 encryption with HKDF key derivation',
      l1: '## Encryption Model\n- Algorithm: AES-GCM 256\n- Key derivation: HKDF-SHA256\n- Master key: wrapped with OPAQUE export_key\n- Per-item keys: derived from MK + URI\n- IV: 96-bit random, prepended to ciphertext',
      content: 'The encryption model uses a hybrid approach. L0/L1 summaries are plaintext metadata for search. L2 full content is encrypted client-side with AES-GCM 256. Each memory gets a unique key derived via HKDF-SHA256 from the master key and the memory URI. The master key is wrapped with a key derived from the OPAQUE export_key.',
    },
    {
      uri: 'workflows/git-conventions',
      l0: 'Conventional commits with feat/fix/refactor types',
      l1: '## Git Workflow\n- Commit format: <type>: <description>\n- Types: feat, fix, refactor, docs, test, chore\n- Branch strategy: feature branches off main\n- PR required for all changes',
      content: 'We use conventional commits: feat for new features, fix for bug fixes, refactor for code changes, docs for documentation, test for tests, chore for maintenance. All work happens on feature branches. PRs are required and should include a test plan.',
    },
    {
      uri: 'workflows/tdd',
      l0: 'Test-driven development with 80% coverage target',
      l1: '## TDD Workflow\n- Write test first (RED)\n- Implement minimal code (GREEN)\n- Refactor (IMPROVE)\n- Coverage target: 80%+',
      content: 'We follow strict TDD: write the failing test first, implement just enough to make it pass, then refactor. Jest is our test framework. We aim for 80%+ code coverage. Unit tests for services, integration tests for routes, E2E tests for critical flows.',
    },
  ];

  console.log('\nStoring memories (Prisma + S3)...');

  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9002',
    region: 'us-east-1',
    credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' },
    forcePathStyle: true,
  });

  for (const mem of memories) {
    const plaintext = Buffer.from(mem.content, 'utf-8');
    const encrypted = encryptL2(mk, mem.uri, plaintext);
    const encBuf = Buffer.from(encrypted, 'base64');
    const hash = sha256hex(encBuf);
    const s3Key = `${user.id}/memories/${mem.uri}.enc`;

    await s3.send(new PutObjectCommand({
      Bucket: 'context-chest',
      Key: s3Key,
      Body: encBuf,
      ContentType: 'application/octet-stream',
    }));

    await prisma.memoryEntry.create({
      data: {
        userId: user.id,
        uri: mem.uri,
        s3Key,
        sha256: hash,
        sizeBytes: encBuf.length,
      },
    });
    console.log(`  Stored: ${mem.uri}`);
  }

  // Create a test session directly
  console.log('\nCreating test session...');
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      clientId: 'claude-code-test',
      status: 'closed',
      messageCount: 5,
      memoriesExtracted: 2,
      closedAt: new Date(),
    },
  });
  console.log(`  Session: ${session.id}`);

  // Create an active session too
  const session2 = await prisma.session.create({
    data: {
      userId: user.id,
      clientId: 'claude-code-test',
      status: 'active',
      messageCount: 3,
    },
  });
  console.log(`  Active session: ${session2.id}`);

  console.log('\n--- Test Data Summary ---');
  console.log(`API URL:     ${API_URL}`);
  console.log(`PWA URL:     http://localhost:5176`);
  console.log(`User email:  test@contextchest.dev`);
  console.log(`User ID:     ${user.id}`);
  console.log(`JWT token:   ${token}`);
  console.log(`Master key:  ${mk.toString('hex')}`);
  console.log(`Wrapped MK:  ${wrappedMk.slice(0, 30)}...`);
  console.log(`Memories:    ${memories.length} stored`);
  console.log('\nTo test in PWA: use "Dev mode: Skip login"');
  console.log('To test decrypt: the MK in dev mode is random, so decrypt will fail.');
  console.log('For real decrypt testing, use the JWT + MK above with curl or the MCP server.');
  console.log(`\nTest with curl:`);
  console.log(`  curl -s -H "Authorization: Bearer ${token}" ${API_URL}/v1/memory/recall -d '{"query":"editor","limit":5}' -H "Content-Type: application/json" | jq .`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
