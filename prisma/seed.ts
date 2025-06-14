import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';
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

async function main() {
  // Create demo client
  const client = await prisma.client.create({
    data: {
      clientId: 'demo_app',
      name: 'Demo App',
      redirectUri: 'https://demo-app.example.com/callback',
      clientSecretHash: createHash('sha256')
        .update('demo_secret')
        .digest('hex'),
    },
  });

  console.log('Created demo client:', client);

  // Create demo user
  const user = await prisma.user.create({
    data: {
      email: 'demo@example.com',
      opaqueRecord: randomBytes(32), // Placeholder OPAQUE record
    },
  });

  console.log('Created demo user:', user);

  // Create demo blob
  const blob = randomBytes(10 * 1024); // 10KB demo blob
  const sha256 = createHash('sha256').update(blob).digest('hex');
  const s3Key = `${user.id}/active.blob`;

  // Upload to S3
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: s3Key,
      Body: blob,
      ContentType: 'application/octet-stream',
    })
  );

  // Create blob record
  const blobRecord = await prisma.blob.create({
    data: {
      userId: user.id,
      s3Key,
      sha256,
    },
  });

  console.log('Created demo blob:', blobRecord);

  // Create demo grant
  const grant = await prisma.grant.create({
    data: {
      userId: user.id,
      clientId: client.clientId,
      scopes: ['vault.read', 'vault.write'],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      jwtId: randomBytes(32).toString('hex'),
    },
  });

  console.log('Created demo grant:', grant);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 