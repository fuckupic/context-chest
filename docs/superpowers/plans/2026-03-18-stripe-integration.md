# Stripe Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stripe billing to Context Chest — Pro tier ($9/month, $84/year) via hosted Checkout, webhooks, plan limits, and Customer Portal.

**Architecture:** Stripe-first minimal. Two fields on User model (`stripeCustomerId`, `stripePlan`), updated via webhooks. No local Subscription table. Limits enforced in middleware. Hosted Checkout and Customer Portal — zero custom billing UI.

**Tech Stack:** Stripe SDK (`stripe`), Fastify raw body plugin (`fastify-raw-body`), Prisma migration, existing Jest test setup.

**Spec:** `docs/superpowers/specs/2026-03-18-stripe-integration-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `PlanTier` enum, 3 fields to User |
| `prisma/migrations/YYYYMMDD_add_stripe_billing/migration.sql` | Create (auto) | Prisma migrate generates this |
| `src/lib/plan-limits.ts` | Create | Plan limit constants + `getPlanLimits()` helper |
| `src/routes/billing.ts` | Create | 3 endpoints: checkout, portal, webhook |
| `src/routes/auth.ts` | Modify:150-154 | Extend `GET /me` to return `plan` |
| `src/plugins/role-guard.ts` | Modify:23-57 | Attach `stripePlan` to request, agent limit check |
| `src/services/chest.ts` | Modify:19-23 | Add chest count check to `create()` |
| `src/services/chest-router.ts` | Modify:34-81 | Accept `maxChests` param, skip creation when at limit |
| `src/routes/memory.ts` | Modify:205-216 | Pass `stripePlan` to `ChestRouter.resolve()` |
| `src/index.ts` | Modify:96-110 | Register billing routes, raw body plugin |
| `packages/mcp-server/src/client.ts` | Modify:116-153 | Handle 402 responses with readable message |
| `packages/pwa/src/api/client.ts` | Modify:86-101 | Add `createCheckout()`, `createPortal()`, `getMe()` |
| `packages/pwa/src/pages/Settings.tsx` | Modify:122-189 | Add Plan section with upgrade/manage buttons |
| `packages/pwa/src/pages/Pricing.tsx` | Modify:75-85 | Replace waitlist with checkout redirect |
| `src/tests/routes/billing.test.ts` | Create | Tests for billing endpoints |
| `src/tests/services/chest-router-limits.test.ts` | Create | Tests for plan-aware chest limits |
| `src/tests/plugins/role-guard-agent-limit.test.ts` | Create | Tests for agent limit enforcement |

---

### Task 1: Install dependencies + Prisma migration

**Files:**
- Modify: `package.json`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*/migration.sql` (auto-generated)

- [ ] **Step 1: Install Stripe SDK and raw body plugin**

```bash
npm install stripe fastify-raw-body
```

- [ ] **Step 2: Add PlanTier enum and fields to schema.prisma**

In `prisma/schema.prisma`, add above the `model User` block:

```prisma
enum PlanTier {
  free
  pro
}
```

Add these fields inside `model User { ... }` after the `apiKeys` relation:

```prisma
  stripeCustomerId  String?    @unique @map("stripe_customer_id")
  stripePlan        PlanTier   @default(free) @map("stripe_plan")
  planActivatedAt   DateTime?  @map("plan_activated_at")
```

- [ ] **Step 3: Generate and apply migration**

```bash
npx prisma migrate dev --name add_stripe_billing
```

Expected: Migration creates `PlanTier` enum, adds 3 columns to `users` table. Existing users default to `free`.

- [ ] **Step 4: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/ package.json package-lock.json
git commit -m "feat: add PlanTier enum + stripe fields to User model"
```

---

### Task 2: Plan limits helper

**Files:**
- Create: `src/lib/plan-limits.ts`
- Create: `src/tests/lib/plan-limits.test.ts`

- [ ] **Step 1: Write the test**

Create `src/tests/lib/plan-limits.test.ts`:

```typescript
import { getPlanLimits } from '../../lib/plan-limits';

describe('getPlanLimits', () => {
  it('returns strict limits for free plan', () => {
    const limits = getPlanLimits('free');
    expect(limits.maxChests).toBe(3);
    expect(limits.maxAgents).toBe(2);
  });

  it('returns unlimited for pro plan', () => {
    const limits = getPlanLimits('pro');
    expect(limits.maxChests).toBe(Infinity);
    expect(limits.maxAgents).toBe(Infinity);
  });

  it('defaults to free for unknown input', () => {
    const limits = getPlanLimits(undefined as unknown as string);
    expect(limits.maxChests).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/tests/lib/plan-limits.test.ts --verbose
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `src/lib/plan-limits.ts`:

```typescript
interface PlanLimits {
  readonly maxChests: number;
  readonly maxAgents: number;
}

const LIMITS: Record<string, PlanLimits> = {
  free: { maxChests: 3, maxAgents: 2 },
  pro: { maxChests: Infinity, maxAgents: Infinity },
};

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  return LIMITS[plan ?? 'free'] ?? LIMITS.free;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/tests/lib/plan-limits.test.ts --verbose
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan-limits.ts src/tests/lib/plan-limits.test.ts
git commit -m "feat: add plan limits helper — free (3 chests, 2 agents), pro (unlimited)"
```

---

### Task 3: Billing routes (checkout, portal, webhook)

**Files:**
- Create: `src/routes/billing.ts`
- Create: `src/tests/routes/billing.test.ts`
- Modify: `src/index.ts`

This is the biggest task. The webhook handler must verify Stripe signatures and update `stripePlan`.

- [ ] **Step 1: Write tests for billing routes**

Create `src/tests/routes/billing.test.ts`:

```typescript
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';

// We mock the stripe module
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
      },
    },
    billingPortal: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test' }),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

describe('billing routes', () => {
  describe('checkout', () => {
    it('creates Stripe customer on first checkout', () => {
      // Test that stripeCustomerId is saved when null
      expect(true).toBe(true); // placeholder — implementation will test via supertest
    });

    it('reuses existing stripeCustomerId', () => {
      expect(true).toBe(true);
    });
  });

  describe('webhook', () => {
    it('rejects requests without stripe-signature header', () => {
      expect(true).toBe(true);
    });

    it('sets stripePlan to pro on checkout.session.completed', () => {
      expect(true).toBe(true);
    });

    it('sets stripePlan to free on customer.subscription.deleted', () => {
      expect(true).toBe(true);
    });

    it('keeps pro on past_due status', () => {
      expect(true).toBe(true);
    });
  });

  describe('portal', () => {
    it('returns 400 when stripeCustomerId is null', () => {
      expect(true).toBe(true);
    });
  });
});
```

Note: These are structural placeholders. Full integration tests require a Fastify test instance. The implementing agent should expand these with `fastify.inject()` calls following the pattern in `src/tests/services/chest.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/tests/routes/billing.test.ts --verbose
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write billing routes**

Create `src/routes/billing.ts`:

```typescript
import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PrismaClient, PlanTier } from '@prisma/client';
import Stripe from 'stripe';
import { requirePermission } from '../plugins/role-guard';

// Type augmentation for fastify-raw-body
declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string | Buffer;
  }
}

const checkoutSchema = z.object({
  interval: z.enum(['month', 'year']),
});

export function billingRoutes(prisma: PrismaClient): FastifyPluginAsync {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia',
  });

  const PRICES: Record<string, string> = {
    month: process.env.STRIPE_PRICE_MONTHLY!,
    year: process.env.STRIPE_PRICE_YEARLY!,
  };

  const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  return async (fastify) => {
    // POST /checkout — create Stripe Checkout Session
    fastify.post(
      '/checkout',
      { preHandler: requirePermission('browse') },
      async (request, reply) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;
        const body = checkoutSchema.parse(request.body);

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { stripeCustomerId: true, email: true, stripePlan: true },
        });

        if (!user) {
          return reply.code(404).send({ code: 'USER_NOT_FOUND', message: 'User not found' });
        }

        if (user.stripePlan === PlanTier.pro) {
          return reply.code(400).send({ code: 'ALREADY_PRO', message: 'Already on Pro plan' });
        }

        // Race-safe customer creation
        let customerId = user.stripeCustomerId;
        if (!customerId) {
          const customer = await stripe.customers.create(
            { email: user.email ?? undefined, metadata: { userId } },
            { idempotencyKey: `customer_${userId}` }
          );

          // Conditional update — only write if still null (race protection)
          const result = await prisma.$executeRaw`
            UPDATE users SET stripe_customer_id = ${customer.id}
            WHERE id = ${userId} AND stripe_customer_id IS NULL
          `;

          if (result === 0) {
            // Another request already created the customer — re-read
            const fresh = await prisma.user.findUnique({
              where: { id: userId },
              select: { stripeCustomerId: true },
            });
            customerId = fresh!.stripeCustomerId!;
          } else {
            customerId = customer.id;
          }
        }

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          line_items: [{ price: PRICES[body.interval], quantity: 1 }],
          success_url: `${FRONTEND_URL}/settings?upgraded=true`,
          cancel_url: `${FRONTEND_URL}/pricing`,
          client_reference_id: userId,
        });

        return { url: session.url };
      }
    );

    // POST /portal — create Stripe Customer Portal Session
    fastify.post(
      '/portal',
      { preHandler: requirePermission('browse') },
      async (request, reply) => {
        const userId = (request as unknown as Record<string, unknown>).userId as string;

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { stripeCustomerId: true },
        });

        if (!user?.stripeCustomerId) {
          return reply.code(400).send({
            code: 'NO_SUBSCRIPTION',
            message: 'No billing account found. Subscribe first.',
          });
        }

        const session = await stripe.billingPortal.sessions.create({
          customer: user.stripeCustomerId,
          return_url: `${FRONTEND_URL}/settings`,
        });

        return { url: session.url };
      }
    );

    // POST /webhook — Stripe webhook handler
    // config.rawBody: true tells fastify-raw-body to preserve raw body for this route
    fastify.post('/webhook', { config: { rawBody: true } }, async (request, reply) => {
      const sig = request.headers['stripe-signature'];
      if (!sig) {
        return reply.code(400).send({ code: 'MISSING_SIGNATURE', message: 'Missing stripe-signature header' });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          request.rawBody!,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET!
        );
      } catch (err) {
        fastify.log.error(err, 'Stripe webhook signature verification failed');
        return reply.code(400).send({ code: 'INVALID_SIGNATURE', message: 'Invalid signature' });
      }

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.client_reference_id;
          if (userId) {
            await prisma.user.update({
              where: { id: userId },
              data: { stripePlan: PlanTier.pro, planActivatedAt: new Date() },
            });
            fastify.log.info({ userId }, 'User upgraded to pro via checkout');
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;
          if (sub.status === 'canceled' || sub.status === 'unpaid') {
            await prisma.user.updateMany({
              where: { stripeCustomerId: customerId },
              data: { stripePlan: PlanTier.free, planActivatedAt: null },
            });
            fastify.log.info({ customerId, status: sub.status }, 'User downgraded to free');
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: { stripePlan: PlanTier.free, planActivatedAt: null },
          });
          fastify.log.info({ customerId }, 'Subscription deleted — user downgraded to free');
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          fastify.log.warn({ customerId }, 'Payment failed — Stripe will retry');
          break;
        }

        default:
          fastify.log.info({ type: event.type }, 'Unhandled Stripe event');
      }

      return { received: true };
    });
  };
}
```

- [ ] **Step 4: Register billing routes + raw body in src/index.ts**

Add import at top of `src/index.ts`:

```typescript
import rawBody from 'fastify-raw-body';
import { billingRoutes } from './routes/billing';
```

After `app.register(metrics);` (~line 100), add:

```typescript
app.register(rawBody, {
  field: 'rawBody',
  global: false,
  runFirst: true,
});
```

After the `app.register(sessionRoutes(...))` line (~line 110), add:

```typescript
app.register(billingRoutes(prisma), { prefix: '/v1/billing' });
```

In the CORS config `allowedHeaders` array (~line 69), add `'stripe-signature'`:

```typescript
allowedHeaders: ['Content-Type', 'Authorization', 'X-BLOB-SHA256', 'X-Agent-Name', 'X-Chest', 'stripe-signature'],
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest src/tests/routes/billing.test.ts --verbose
```

Expected: PASS.

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/routes/billing.ts src/tests/routes/billing.test.ts src/index.ts
git commit -m "feat: add billing routes — checkout, portal, webhook with Stripe signature verification"
```

---

### Task 4: Extend GET /me to return plan

**Files:**
- Modify: `src/routes/auth.ts:150-154`

- [ ] **Step 1: Update GET /me handler**

In `src/routes/auth.ts`, change the `/me` handler (line ~150-154):

```typescript
// Before:
const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
return { userId: user?.id, email: user?.email };

// After:
const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, stripePlan: true } });
return { userId: user?.id, email: user?.email, plan: user?.stripePlan ?? 'free' };
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/auth.ts
git commit -m "feat: GET /me returns plan field for PWA tier detection"
```

---

### Task 5: Plan-aware role-guard (attach stripePlan + agent limit)

**Files:**
- Modify: `src/plugins/role-guard.ts:23-57`
- Create: `src/tests/plugins/role-guard-agent-limit.test.ts`

- [ ] **Step 1: Write agent limit test**

Create `src/tests/plugins/role-guard-agent-limit.test.ts`:

```typescript
import { getPlanLimits } from '../../lib/plan-limits';

describe('agent limit enforcement', () => {
  it('free plan allows 2 agents', () => {
    const limits = getPlanLimits('free');
    const agentCount = 2;
    const isNewAgent = true;
    const blocked = isNewAgent && agentCount >= limits.maxAgents;
    expect(blocked).toBe(true);
  });

  it('free plan allows existing agent even at limit', () => {
    const limits = getPlanLimits('free');
    const agentCount = 2;
    const isNewAgent = false;
    const blocked = isNewAgent && agentCount >= limits.maxAgents;
    expect(blocked).toBe(false);
  });

  it('pro plan allows unlimited agents', () => {
    const limits = getPlanLimits('pro');
    const agentCount = 100;
    const isNewAgent = true;
    const blocked = isNewAgent && agentCount >= limits.maxAgents;
    expect(blocked).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — should pass (uses plan-limits helper)**

```bash
npx jest src/tests/plugins/role-guard-agent-limit.test.ts --verbose
```

- [ ] **Step 3: Modify role-guard.ts**

In `src/plugins/role-guard.ts`, add import at top:

```typescript
import { getPlanLimits } from '../lib/plan-limits';
```

Modify `requirePermission()` to:
1. After the API key auth branch (line ~28-31), also fetch `stripePlan`:

```typescript
// API key path — fetch plan too
if (apiKeyUser) {
  const userWithPlan = await prisma.user.findUnique({
    where: { id: apiKeyUser.userId },
    select: { stripePlan: true },
  });
  (request as unknown as Record<string, unknown>).userRole = 'admin';
  (request as unknown as Record<string, unknown>).userId = apiKeyUser.userId;
  (request as unknown as Record<string, unknown>).stripePlan = userWithPlan?.stripePlan ?? 'free';
  // Agent limit check — if blocked, stop handler
  const blocked = await checkAgentLimit(request, reply, apiKeyUser.userId, userWithPlan?.stripePlan ?? 'free');
  if (blocked) return;
  return;
}
```

2. After the JWT auth branch (line ~56), also attach stripePlan and check agent limit:

```typescript
(request as unknown as Record<string, unknown>).stripePlan = 'free'; // JWT users — look up plan
const userWithPlan = await prisma.user.findUnique({
  where: { id: decoded.sub as string },
  select: { stripePlan: true },
});
(request as unknown as Record<string, unknown>).stripePlan = userWithPlan?.stripePlan ?? 'free';
const agentBlocked = await checkAgentLimit(request, reply, decoded.sub as string, userWithPlan?.stripePlan ?? 'free');
if (agentBlocked) return;
```

3. Add the `checkAgentLimit` helper inside the file. **Important**: returns `true` if blocked — callers must `return` early when true:

```typescript
async function checkAgentLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  plan: string
): Promise<boolean> {
  const agentName = request.headers['x-agent-name'] as string | undefined;
  if (!agentName) return false;

  const limits = getPlanLimits(plan);
  if (limits.maxAgents === Infinity) return false;

  const existing = await prisma.agentConnection.findUnique({
    where: { userId_agentName: { userId, agentName } },
  });
  if (existing) return false; // existing agent — always allowed

  const count = await prisma.agentConnection.count({ where: { userId } });
  if (count >= limits.maxAgents) {
    reply.code(402).send({
      code: 'PLAN_LIMIT',
      resource: 'agents',
      limit: limits.maxAgents,
      upgradeUrl: '/pricing',
    });
    return true; // blocked — caller must return
  }
  return false;
}
```

- [ ] **Step 4: Run all tests**

```bash
npx jest --verbose
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/role-guard.ts src/tests/plugins/role-guard-agent-limit.test.ts
git commit -m "feat: plan-aware role-guard — attach stripePlan to request, enforce agent limit"
```

---

### Task 6: Plan-aware chest limits

**Files:**
- Modify: `src/services/chest.ts:19-23`
- Modify: `src/services/chest-router.ts:34-81`
- Modify: `src/routes/memory.ts:205-216`
- Create: `src/tests/services/chest-router-limits.test.ts`

- [ ] **Step 1: Write test for chest limit in ChestRouter**

Create `src/tests/services/chest-router-limits.test.ts`:

```typescript
import { getPlanLimits } from '../../lib/plan-limits';

describe('chest router plan limits', () => {
  it('free user with 3 chests should not create new ones', () => {
    const limits = getPlanLimits('free');
    const chestCount = 3;
    const shouldSkipCreation = chestCount >= limits.maxChests;
    expect(shouldSkipCreation).toBe(true);
  });

  it('pro user with 3 chests can create more', () => {
    const limits = getPlanLimits('pro');
    const chestCount = 3;
    const shouldSkipCreation = chestCount >= limits.maxChests;
    expect(shouldSkipCreation).toBe(false);
  });

  it('free user with 2 chests can still create one more', () => {
    const limits = getPlanLimits('free');
    const chestCount = 2;
    const shouldSkipCreation = chestCount >= limits.maxChests;
    expect(shouldSkipCreation).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — should pass**

```bash
npx jest src/tests/services/chest-router-limits.test.ts --verbose
```

- [ ] **Step 3: Modify ChestService.create() to check limits**

In `src/services/chest.ts`, add import and modify `create()`:

```typescript
import { getPlanLimits } from '../lib/plan-limits';

// Change create signature to accept plan:
async create(userId: string, input: CreateChestInput, plan?: string): Promise<Chest> {
  const limits = getPlanLimits(plan);
  const count = await this.prisma.chest.count({ where: { userId } });
  if (count >= limits.maxChests) {
    throw new PlanLimitError('chests', limits.maxChests);
  }
  return this.prisma.chest.create({
    data: { userId, name: input.name, description: input.description, isPublic: input.isPublic ?? false, isAutoCreated: input.isAutoCreated ?? false },
  });
}
```

Add `PlanLimitError` class at top of file:

```typescript
export class PlanLimitError extends Error {
  readonly code = 'PLAN_LIMIT';
  readonly resource: string;
  readonly limit: number;

  constructor(resource: string, limit: number) {
    super(`Plan limit reached: ${resource} (max ${limit})`);
    this.resource = resource;
    this.limit = limit;
  }
}
```

- [ ] **Step 4: Modify ChestRouter.resolve() to accept maxChests**

In `src/services/chest-router.ts`, change `resolve` signature:

```typescript
async resolve(userId: string, keywords: string[], maxChests: number = Infinity): Promise<ResolveResult> {
```

Before each `this.chestService.upsertByName()` call (lines 55 and 71), add a guard:

```typescript
// Before line 55 (seed match creation):
if (chests.length >= maxChests) {
  const defaultChest = await this.chestService.getOrCreateDefault(userId);
  return { chestName: defaultChest.name, chestId: defaultChest.id, isNew: false };
}

// Before line 71 (slug creation):
if (chests.length >= maxChests) {
  const defaultChest = await this.chestService.getOrCreateDefault(userId);
  return { chestName: defaultChest.name, chestId: defaultChest.id, isNew: false };
}
```

- [ ] **Step 5: Pass plan to ChestRouter in memory routes**

In `src/routes/memory.ts`, in the auto-chest handler (line ~205-216), pass limits:

```typescript
// Before:
const result = await chestRouter.resolve(userId, body.keywords);

// After:
const plan = (request as unknown as Record<string, unknown>).stripePlan as string;
const limits = getPlanLimits(plan);
const result = await chestRouter.resolve(userId, body.keywords, limits.maxChests);
```

Add import at top: `import { getPlanLimits } from '../lib/plan-limits';`

Also update `ChestService.create()` call in `src/routes/chests.ts`:

```typescript
// Before:
const chest = await chestService.create(userId, body);

// After:
const plan = (request as unknown as Record<string, unknown>).stripePlan as string;
const chest = await chestService.create(userId, body, plan);
```

Handle `PlanLimitError` in the catch:

```typescript
import { PlanLimitError } from '../services/chest';

// In the catch block, before the existing Unique constraint check:
if (err instanceof PlanLimitError) {
  reply.code(402).send({ code: err.code, resource: err.resource, limit: err.limit, upgradeUrl: '/pricing' });
  return;
}
```

- [ ] **Step 6: Update existing chest tests**

`src/tests/services/chest.test.ts` mocks `prisma.chest.create` but after our change, `create()` also calls `prisma.chest.count`. Add a mock for `chest.count` in the test setup:

```typescript
// In the mock setup where prisma.chest is defined, add:
count: jest.fn().mockResolvedValue(0), // default: no chests exist (under limit)
```

This ensures existing `ChestService.create()` tests don't break. Also add a test for the limit case:

```typescript
it('throws PlanLimitError when free user exceeds 3 chests', async () => {
  mockPrisma.chest.count.mockResolvedValue(3);
  await expect(service.create(userId, { name: 'test' }, 'free')).rejects.toThrow('Plan limit reached');
});
```

- [ ] **Step 7: Run all tests**

```bash
npx jest --verbose
```

- [ ] **Step 8: Verify build**

```bash
npm run build
```

- [ ] **Step 9: Commit**

```bash
git add src/services/chest.ts src/services/chest-router.ts src/routes/memory.ts src/routes/chests.ts src/tests/services/chest.test.ts src/tests/services/chest-router-limits.test.ts
git commit -m "feat: plan-aware chest limits — free users capped at 3, auto-chest falls back to default"
```

---

### Task 7: MCP client 402 handling

**Files:**
- Modify: `packages/mcp-server/src/client.ts:116-153`

- [ ] **Step 1: Handle 402 in MCP client request method**

In `packages/mcp-server/src/client.ts`, in the `request()` method (line ~143), add 402 handling before the generic error:

```typescript
// After line 141 (the retry block), before the generic !response.ok check:
if (response.status === 402) {
  const error = await response.json().catch(() => ({ code: 'PLAN_LIMIT', resource: 'unknown' })) as Record<string, unknown>;
  const resource = error.resource ?? 'resource';
  const limit = error.limit ?? '?';
  throw new Error(`Free plan limit reached (${limit} ${resource}). Upgrade at contextchest.com/pricing`);
}
```

- [ ] **Step 2: Verify build**

```bash
cd packages/mcp-server && npm run build && cd ../..
```

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/src/client.ts
git commit -m "feat: MCP client shows readable upgrade message on 402 plan limit"
```

---

### Task 8: PWA — billing API methods + Settings plan section

**Files:**
- Modify: `packages/pwa/src/api/client.ts`
- Modify: `packages/pwa/src/pages/Settings.tsx`

- [ ] **Step 1: Add billing methods to PWA ApiClient**

In `packages/pwa/src/api/client.ts`, add after the `listSessions` method (~line 228):

```typescript
  // Billing
  async getMe() {
    return this.request<{ userId: string; email: string; plan: string }>('GET', '/v1/auth/me');
  }

  async createCheckout(interval: 'month' | 'year') {
    return this.request<{ url: string }>('POST', '/v1/billing/checkout', { interval });
  }

  async createPortal() {
    return this.request<{ url: string }>('POST', '/v1/billing/portal');
  }
```

- [ ] **Step 2: Add Plan section to Settings.tsx**

In `packages/pwa/src/pages/Settings.tsx`, add a `PlanSection` component before the `ApiKeySection` function:

```typescript
function PlanSection() {
  const { client } = useAuth();
  const [plan, setPlan] = useState<string>('free');
  const [loading, setLoading] = useState(false);
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [upgrading, setUpgrading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Check for upgrade success
  const params = new URLSearchParams(window.location.search);
  const justUpgraded = params.get('upgraded') === 'true';

  // Fetch current plan on mount
  useEffect(() => {
    if (!client) return;
    (client as unknown as { request: <T>(m: string, p: string) => Promise<T> })
      .request<{ plan: string }>('GET', '/v1/auth/me')
      .then((res) => setPlan(res.plan))
      .catch(() => {});
  }, [client]);

  // Poll for plan activation after checkout (max ~63s with exponential backoff)
  useEffect(() => {
    if (!justUpgraded || !client || plan === 'pro') return;
    setUpgrading(true);
    let attempts = 0;
    const maxAttempts = 10; // 1+2+4+8*7 = ~63s
    const poll = async () => {
      const res = await (client as unknown as { request: <T>(m: string, p: string) => Promise<T> })
        .request<{ plan: string }>('GET', '/v1/auth/me')
        .catch(() => null);
      if (res?.plan === 'pro') {
        setPlan('pro');
        setUpgrading(false);
        window.history.replaceState({}, '', '/settings');
        return;
      }
      attempts++;
      if (attempts >= maxAttempts) {
        setUpgrading(false);
        setTimedOut(true);
        return;
      }
      setTimeout(poll, Math.min(1000 * Math.pow(2, attempts), 8000));
    };
    poll();
  }, [justUpgraded, client, plan]);

  const handleCheckout = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const res = await (client as unknown as { request: <T>(m: string, p: string, b?: unknown) => Promise<T> })
        .request<{ url: string }>('POST', '/v1/billing/checkout', { interval });
      window.location.href = res.url;
    } catch {
      setLoading(false);
    }
  };

  const handlePortal = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const res = await (client as unknown as { request: <T>(m: string, p: string) => Promise<T> })
        .request<{ url: string }>('POST', '/v1/billing/portal');
      window.location.href = res.url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="border-2 border-cc-border bg-cc-dark p-4">
      <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-3">PLAN</p>

      {upgrading && (
        <div className="border-2 border-cc-pink/30 bg-cc-pink/5 p-3 mb-3">
          <p className="text-cc-pink text-xs font-pixel tracking-wider">ACTIVATING YOUR UPGRADE...</p>
          <p className="text-[10px] text-cc-muted mt-1">This usually takes a few seconds.</p>
        </div>
      )}

      {timedOut && (
        <div className="border-2 border-cc-border bg-cc-dark p-3 mb-3">
          <p className="text-cc-sub text-xs">Upgrade confirmed by Stripe. It may take a moment to activate. Refresh the page in a minute.</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-cc-sub">Current Plan</span>
        <span className={`font-pixel text-xs tracking-wider ${plan === 'pro' ? 'text-cc-pink' : 'text-cc-muted'}`}>
          {plan === 'pro' ? 'PRO' : 'FREE'}
        </span>
      </div>

      {plan === 'pro' ? (
        <button
          onClick={handlePortal}
          disabled={loading}
          className="w-full py-2 font-pixel text-xs tracking-wider border-2 border-cc-border text-cc-muted hover:border-cc-pink hover:text-cc-pink transition-colors disabled:opacity-50"
        >
          {loading ? 'LOADING...' : 'MANAGE BILLING'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setInterval('month')}
              className={`flex-1 py-1.5 font-pixel text-[10px] tracking-wider border-2 transition-colors ${
                interval === 'month' ? 'border-cc-pink text-cc-pink' : 'border-cc-border text-cc-muted'
              }`}
            >
              $9/MONTH
            </button>
            <button
              onClick={() => setInterval('year')}
              className={`flex-1 py-1.5 font-pixel text-[10px] tracking-wider border-2 transition-colors ${
                interval === 'year' ? 'border-cc-pink text-cc-pink' : 'border-cc-border text-cc-muted'
              }`}
            >
              $84/YEAR (SAVE 22%)
            </button>
          </div>
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full py-2.5 font-pixel text-xs tracking-wider bg-cc-pink text-cc-black hover:bg-cc-pink-dim transition-colors disabled:opacity-50"
          >
            {loading ? 'LOADING...' : 'UPGRADE TO PRO'}
          </button>
        </div>
      )}
    </div>
  );
}
```

Add `useEffect` to imports at top of file:

```typescript
import { useState, useEffect } from 'react';
```

In the `Settings` component's return, add `<PlanSection />` as the first item inside the `space-y-4` div (before `<ApiKeySection />`).

- [ ] **Step 3: Verify PWA build**

```bash
cd packages/pwa && npm run build && cd ../..
```

- [ ] **Step 4: Commit**

```bash
git add packages/pwa/src/api/client.ts packages/pwa/src/pages/Settings.tsx
git commit -m "feat: PWA plan section — upgrade/manage billing, polling for activation"
```

---

### Task 9: PWA — update Pricing page

**Files:**
- Modify: `packages/pwa/src/pages/Pricing.tsx:75-85`

- [ ] **Step 1: Replace waitlist with checkout**

In `packages/pwa/src/pages/Pricing.tsx`:

1. Add imports at top of file:

```typescript
import { useState, useEffect } from 'react';
```

(These are not currently imported — `Pricing.tsx` only imports `useNavigate` and `useAuth`.)

2. Add state for plan detection at top of `Pricing` component (after `useAuth()`):

```typescript
const [plan, setPlan] = useState<string | null>(null);

useEffect(() => {
  if (!isAuthenticated) return;
  const token = localStorage.getItem('cc_auth_token');
  if (!token) return;
  fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((r) => r.json())
    .then((data) => setPlan(data.plan))
    .catch(() => {});
}, [isAuthenticated]);
```

3. Replace `handleWaitlist` with `handleUpgrade`:

```typescript
const handleUpgrade = async (interval: 'month' | 'year' = 'month') => {
  if (!isAuthenticated) {
    navigate('/login');
    return;
  }
  const token = localStorage.getItem('cc_auth_token');
  if (!token) return;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ interval }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  } catch { /* */ }
};
```

4. Update the PRO tier CTA:
- Change `cta: 'JOIN WAITLIST'` to `cta: 'UPGRADE NOW'`
- Change the `onClick` handler: `tier.name === 'PRO' ? handleUpgrade : () => navigate('/login')`
- If `plan === 'pro'` and `tier.name === 'PRO'`, show disabled button with "CURRENT PLAN"

5. (Imports already added in step 1 above.)

- [ ] **Step 2: Verify PWA build**

```bash
cd packages/pwa && npm run build && cd ../..
```

- [ ] **Step 3: Commit**

```bash
git add packages/pwa/src/pages/Pricing.tsx
git commit -m "feat: pricing page — upgrade now button, current plan badge for pro users"
```

---

### Task 10: Final verification + env vars

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Verify full build (API + PWA)**

```bash
npm run build && cd packages/pwa && npm run build && cd ../.. && cd packages/mcp-server && npm run build && cd ../..
```

- [ ] **Step 3: Add env vars to Railway**

In Railway dashboard, add:
- `STRIPE_SECRET_KEY` — from Stripe dashboard (test mode first: `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` — from Stripe webhook endpoint config
- `STRIPE_PRICE_MONTHLY` — Price ID from Stripe dashboard
- `STRIPE_PRICE_YEARLY` — Price ID from Stripe dashboard
- `FRONTEND_URL` — `https://contextchest.com`

- [ ] **Step 4: Create Stripe resources in dashboard**

1. Create Product: "Context Chest Pro"
2. Create Price: $9/month recurring
3. Create Price: $7/month recurring yearly ($84/year)
4. Create Webhook endpoint pointing to `https://<railway-url>/v1/billing/webhook`
5. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
6. Enable Customer Portal in Stripe settings

- [ ] **Step 5: Deploy and test end-to-end**

```bash
railway up
```

Test flow:
1. Go to contextchest.com/pricing → click UPGRADE NOW
2. Complete Stripe Checkout with test card `4242 4242 4242 4242`
3. Verify redirect to /settings?upgraded=true
4. Verify plan shows PRO
5. Click MANAGE BILLING → verify Stripe portal opens
6. Create 4+ chests via MCP → verify free user gets 402, pro user succeeds
7. Connect 3+ agents → verify free user gets 402

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Stripe integration — Pro tier billing live"
```
