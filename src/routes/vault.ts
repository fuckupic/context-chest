import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';

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

export const vaultRoutes: FastifyPluginAsync = async (fastify) => {
  // Upload blob
  fastify.put('/blob', async (request, reply) => {
    const userId = request.user.sub;
    const blob = await request.file();
    const sha256 = request.headers['x-blob-sha256'] as string;

    if (!blob || !sha256) {
      reply.code(400).send({
        code: 'INVALID_REQUEST',
        message: 'Missing blob or SHA-256 hash',
      });
      return;
    }

    // Verify SHA-256
    const hash = createHash('sha256');
    const chunks: Buffer[] = [];
    for await (const chunk of blob) {
      chunks.push(chunk);
      hash.update(chunk);
    }
    const calculatedHash = hash.digest('hex');

    if (calculatedHash !== sha256) {
      reply.code(400).send({
        code: 'HASH_MISMATCH',
        message: 'Blob hash does not match provided SHA-256',
      });
      return;
    }

    const buffer = Buffer.concat(chunks);
    const s3Key = `${userId}/active.blob`;

    // Upload to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: 'application/octet-stream',
      })
    );

    // Update database
    await prisma.blob.upsert({
      where: { userId },
      create: {
        userId,
        s3Key,
        sha256,
      },
      update: {
        s3Key,
        sha256,
        uploadedAt: new Date(),
      },
    });

    return { success: true };
  });

  // Download blob
  fastify.get('/blob', async (request, reply) => {
    const userId = request.user.sub;

    const blob = await prisma.blob.findUnique({
      where: { userId },
    });

    if (!blob) {
      reply.code(404).send({
        code: 'BLOB_NOT_FOUND',
        message: 'No blob found for this user',
      });
      return;
    }

    const s3Object = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: blob.s3Key,
      })
    );

    if (!s3Object.Body) {
      reply.code(404).send({
        code: 'BLOB_NOT_FOUND',
        message: 'Blob not found in storage',
      });
      return;
    }

    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', 'attachment');
    reply.header('X-BLOB-SHA256', blob.sha256);

    return s3Object.Body;
  });
}; 