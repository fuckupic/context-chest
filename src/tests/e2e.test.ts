import { PrismaClient } from '@prisma/client';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';
import app from '../index';

const prisma = new PrismaClient();
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
});

describe('E2E Tests', () => {
  let server: any;
  let testUser: any;
  let testClient: any;
  let testBlob: Buffer;
  let testToken: string;
  let testGrantToken: string;

  beforeAll(async () => {
    // Start server
    server = await app.listen({ port: 0 });

    // Create test bucket
    await s3.send(
      new CreateBucketCommand({
        Bucket: process.env.S3_BUCKET!,
      })
    );

    // Create test client
    testClient = await prisma.client.create({
      data: {
        clientId: 'test_client',
        name: 'Test Client',
        redirectUri: 'https://test-client.example.com/callback',
        clientSecretHash: createHash('sha256')
          .update('test_secret')
          .digest('hex'),
      },
    });

    // Create test blob
    testBlob = randomBytes(1024); // 1KB test blob
  });

  afterAll(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany();
    await prisma.grant.deleteMany();
    await prisma.blob.deleteMany();
    await prisma.user.deleteMany();
    await prisma.client.deleteMany();
    await prisma.$disconnect();
    await server.close();
  });

  it('should register a new user', async () => {
    const response = await fetch(`${server.url}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.registration_response).toBeDefined();
  });

  it('should complete registration', async () => {
    const response = await fetch(`${server.url}/v1/auth/register/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        msg: 'test_opaque_message',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.token).toBeDefined();
    expect(data.refresh_token).toBeDefined();
    testToken = data.token;
  });

  it('should upload a blob', async () => {
    const sha256 = createHash('sha256').update(testBlob).digest('hex');
    const response = await fetch(`${server.url}/v1/vault/blob`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': `Bearer ${testToken}`,
        'X-BLOB-SHA256': sha256,
      },
      body: testBlob,
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('should download a blob', async () => {
    const response = await fetch(`${server.url}/v1/vault/blob`, {
      headers: {
        'Authorization': `Bearer ${testToken}`,
      },
    });

    expect(response.status).toBe(200);
    const blob = await response.arrayBuffer();
    const downloadedBlob = Buffer.from(blob);
    expect(downloadedBlob).toEqual(testBlob);
  });

  it('should authorize a client', async () => {
    const response = await fetch(`${server.url}/v1/connect/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        client_id: 'test_client',
        requested_scopes: ['vault.read'],
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.consent_code).toBeDefined();
  });

  it('should exchange consent code for token', async () => {
    const response = await fetch(`${server.url}/v1/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consent_code: 'test_consent_code',
        client_secret: 'test_secret',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.grant_token).toBeDefined();
    testGrantToken = data.grant_token;
  });

  it('should introspect token', async () => {
    const response = await fetch(`${server.url}/v1/connect/introspect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testGrantToken}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.active).toBe(true);
    expect(data.scopes).toContain('vault.read');
  });
}); 