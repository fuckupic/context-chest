import { PrismaClient } from '@prisma/client';
import { ContextService } from './context';

const BATCH_SIZE = 10;

export async function syncMemoriesToOpenViking(
  prisma: PrismaClient,
  context: ContextService
): Promise<void> {
  const healthy = await context.isHealthy();
  if (!healthy) {
    console.error('[ov-sync] OpenViking is not reachable — skipping sync');
    return;
  }

  const memories = await prisma.memoryEntry.findMany({
    where: {
      l0: { not: '' },
    },
    select: {
      userId: true,
      uri: true,
      l0: true,
      l1: true,
      chest: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (memories.length === 0) {
    console.error('[ov-sync] No memories to sync');
    return;
  }

  console.error(`[ov-sync] Starting sync of ${memories.length} memories...`);

  let synced = 0;
  let failed = 0;

  for (let i = 0; i < memories.length; i += BATCH_SIZE) {
    const batch = memories.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((m) =>
        context.writeWithRetry(
          m.userId,
          m.uri,
          { l0: m.l0, l1: m.l1 },
          m.chest?.name ?? 'default'
        )
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        synced++;
      } else {
        failed++;
      }
    }

    console.error(`[ov-sync] Progress: ${synced + failed}/${memories.length} (${synced} ok, ${failed} failed)`);
  }

  console.error(`[ov-sync] Done: ${synced} synced, ${failed} failed out of ${memories.length}`);
}
