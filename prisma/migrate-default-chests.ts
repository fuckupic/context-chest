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
