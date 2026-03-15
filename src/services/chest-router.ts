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

interface OvScanResult {
  match: Chest | null;
  reachable: boolean;
}

export class ChestRouter {
  constructor(
    private readonly chestService: ChestService,
    private readonly contextService: ContextService
  ) {}

  async resolve(userId: string, l0: string, l1: string): Promise<ResolveResult> {
    const chests = await this.chestService.list(userId);

    // Step 1: Try OpenViking similarity (skip if too many chests)
    let ovReachable = true;
    if (chests.length > 0 && chests.length <= MAX_CHESTS_FOR_OV_SCAN) {
      const { match, reachable } = await this.scanChestsByOV(userId, chests, l0, l1);
      ovReachable = reachable;
      if (match) {
        return { chestName: match.name, chestId: match.id, isNew: false };
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

    // Step 3: Create new chest from l0 slug — only when OV was reachable (or skipped due to count)
    // When OV was unreachable we skip slug creation and fall back to default for safety
    if (ovReachable) {
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
    }

    // Final fallback: default chest
    const defaultChest = await this.chestService.getOrCreateDefault(userId);
    return { chestName: defaultChest.name, chestId: defaultChest.id, isNew: false };
  }

  private async scanChestsByOV(
    userId: string,
    chests: Chest[],
    l0: string,
    l1: string
  ): Promise<OvScanResult> {
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
        // OpenViking unreachable — signal caller to skip slug creation
        return { match: null, reachable: false };
      }
    }

    return { match: bestChest, reachable: true };
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
