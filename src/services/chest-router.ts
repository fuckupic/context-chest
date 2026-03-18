import { Chest } from '@prisma/client';
import { ChestService } from './chest';
import { ContextService } from './context';

const CHEST_SIMILARITY_THRESHOLD = 0.4;
const MAX_CHESTS_FOR_OV_SCAN = 50;

const SEED_CHESTS = [
  { name: 'work', keywords: ['project', 'client', 'meeting', 'deadline', 'team', 'sprint', 'deploy', 'prod', 'company', 'office', 'manager', 'employee', 'business', 'revenue', 'startup', 'product', 'roadmap', 'stakeholder'] },
  { name: 'personal', keywords: ['family', 'friend', 'hobby', 'vacation', 'home', 'birthday', 'wife', 'husband', 'kids', 'dog', 'cat', 'travel', 'recipe', 'movie', 'music', 'gift'] },
  { name: 'health', keywords: ['doctor', 'dentist', 'gym', 'workout', 'diet', 'sleep', 'medication', 'hospital', 'therapy', 'weight', 'exercise', 'vitamin', 'allergy', 'appointment', 'prescription', 'symptom'] },
  { name: 'finance', keywords: ['budget', 'invest', 'salary', 'tax', 'expense', 'payment', 'subscription', 'bank', 'savings', 'mortgage', 'rent', 'insurance', 'portfolio', 'stock', 'crypto', 'invoice', 'price', 'cost'] },
  { name: 'learning', keywords: ['course', 'book', 'tutorial', 'study', 'skill', 'certificate', 'lecture', 'lesson', 'university', 'school', 'class', 'exam', 'research', 'paper', 'read', 'learn'] },
  { name: 'tools', keywords: ['config', 'setup', 'editor', 'plugin', 'workflow', 'terminal', 'dotfiles', 'vscode', 'vim', 'git', 'docker', 'npm', 'cli', 'alias', 'shortcut', 'extension', 'keybinding'] },
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

  async resolve(userId: string, keywords: string[], maxChests: number = Infinity): Promise<ResolveResult> {
    const chests = await this.chestService.list(userId);
    const keywordText = keywords.join(' ').toLowerCase();

    // Step 1: Try OpenViking similarity using keywords as query
    let ovReachable = true;
    if (chests.length > 0 && chests.length <= MAX_CHESTS_FOR_OV_SCAN) {
      const { match, reachable } = await this.scanChestsByOV(userId, chests, keywordText);
      ovReachable = reachable;
      if (match) {
        return { chestName: match.name, chestId: match.id, isNew: false };
      }
    }

    // Step 2: Try seed keyword match against actual content keywords
    const seedMatch = this.findSeedMatch(keywords);
    if (seedMatch) {
      const existing = chests.find((c) => c.name === seedMatch);
      if (existing) {
        return { chestName: existing.name, chestId: existing.id, isNew: false };
      }
      if (chests.length >= maxChests) {
        const defaultChest = await this.chestService.getOrCreateDefault(userId);
        return { chestName: defaultChest.name, chestId: defaultChest.id, isNew: false };
      }
      const created = await this.chestService.upsertByName(userId, {
        name: seedMatch,
        isPublic: true,
        isAutoCreated: true,
      });
      return { chestName: created.name, chestId: created.id, isNew: true };
    }

    // Step 3: Create new chest from the most distinctive keyword
    if (ovReachable && keywords.length > 0) {
      const slug = this.deriveChestSlug(keywords);
      if (slug.length >= 2) {
        const existing = chests.find((c) => c.name === slug);
        if (existing) {
          return { chestName: existing.name, chestId: existing.id, isNew: false };
        }
        if (chests.length >= maxChests) {
          const defaultChest = await this.chestService.getOrCreateDefault(userId);
          return { chestName: defaultChest.name, chestId: defaultChest.id, isNew: false };
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
    query: string
  ): Promise<OvScanResult> {
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
        return { match: null, reachable: false };
      }
    }

    return { match: bestChest, reachable: true };
  }

  private findSeedMatch(keywords: string[]): string | null {
    let bestSeed: string | null = null;
    let bestCount = 0;

    for (const seed of SEED_CHESTS) {
      const count = keywords.filter((kw) =>
        seed.keywords.some((sk) => kw.includes(sk) || sk.includes(kw))
      ).length;
      if (count > bestCount) {
        bestCount = count;
        bestSeed = seed.name;
      }
    }

    return bestCount > 0 ? bestSeed : null;
  }

  private deriveChestSlug(keywords: string[]): string {
    // Use the first 2-3 most distinctive keywords as the chest name
    const slug = keywords
      .filter((kw) => kw.length >= 3)
      .slice(0, 3)
      .join('-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    return slug;
  }
}
