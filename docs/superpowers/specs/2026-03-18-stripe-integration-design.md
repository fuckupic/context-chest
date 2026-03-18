# Stripe Integration Design — Context Chest Pro

**Date:** 2026-03-18
**Status:** Approved
**Approach:** Stripe-first minimal (Approach A)

## Summary

Add Stripe billing to Context Chest to monetize the Pro tier ($9/month or $84/year). Stripe is source of truth for subscription status. No local Subscription table — just two fields on User model updated via webhooks.

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Stripe account | Existing uhumdrum s.r.o. account | One Stripe account, multiple products |
| Billing cycles | Monthly ($9) + Yearly ($84, save 22%) | User choice B |
| Cancellation | Immediate downgrade to free limits | Stripe handles dunning/retry internally |
| Checkout | Stripe Checkout (hosted) | Zero PCI scope, minimal frontend code |
| Billing management | Stripe Customer Portal | Zero custom billing UI |
| Limit enforcement | Hard limits + graceful degradation | Auto-chest falls back to default, agents get 402 |

## Data Model

Two fields added to `User`:

```prisma
model User {
  // ... existing fields ...
  stripeCustomerId  String?  @unique @map("stripe_customer_id")
  stripePlan        String?  @map("stripe_plan")  // null = free, "pro" = paid
}
```

Limit constants (in code, not DB):

```typescript
const FREE_LIMITS = { maxChests: 3, maxAgents: 2 }
const PRO_LIMITS = { maxChests: Infinity, maxAgents: Infinity }
```

## API Endpoints

### `POST /v1/billing/checkout` (authenticated)

Creates Stripe Customer (if needed) + Checkout Session.

- Body: `{ interval: 'month' | 'year' }`
- Response: `{ url: "https://checkout.stripe.com/..." }`
- Creates Stripe Customer if `stripeCustomerId` is null, saves it
- Checkout Session: `mode: 'subscription'`, `client_reference_id: userId`
- `success_url`: `https://contextchest.com/settings?upgraded=true`
- `cancel_url`: `https://contextchest.com/pricing`

### `POST /v1/billing/portal` (authenticated)

Creates Stripe Customer Portal Session.

- Response: `{ url: "https://billing.stripe.com/..." }`
- Requires `stripeCustomerId` to exist (user must have subscribed at some point)

### `POST /v1/billing/webhook` (public, Stripe signature verification)

Handles Stripe webhook events. Verifies `stripe-signature` header.

Events handled:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set `stripePlan: "pro"` on user (lookup by `client_reference_id`) |
| `customer.subscription.updated` | If `status !== "active"` and `status !== "trialing"`, set `stripePlan: null` |
| `customer.subscription.deleted` | Set `stripePlan: null` |

## Limit Enforcement

### Chest limit (free: 3)

- `ChestService.create()`: count user's chests. If >= 3 and `stripePlan` is null → `402 { code: "PLAN_LIMIT", resource: "chests", limit: 3, upgradeUrl: "/pricing" }`
- `ChestRouter.resolve()`: when auto-chest would create 4th chest for free user, **fall back to default chest** instead of error. Agent flow never breaks.

### Agent limit (free: 2)

- In `role-guard.ts`: on request with `X-Agent-Name` header, check `agentConnection.count()`. If new agent (no existing record) and count >= 2 and `stripePlan` is null → `402 { code: "PLAN_LIMIT", resource: "agents", limit: 2, upgradeUrl: "/pricing" }`
- Existing agents continue working — limit only applies when a **new** agent first connects.

### Memory count

No change — unlimited for both tiers. Existing `checkMemoryLimit(userId, 1000)` remains as safety cap.

### Reading plan in middleware

`requirePermission()` already resolves `userId`. Extend to also fetch `stripePlan` and attach to request as `request.stripePlan`.

## PWA Changes

### Settings page

- New "Plan" section showing current tier
- Free: "UPGRADE TO PRO" button → `POST /v1/billing/checkout` → redirect
- Pro: "MANAGE BILLING" button → `POST /v1/billing/portal` → redirect
- Monthly/yearly toggle before checkout

### Pricing page

- Authenticated free user: "JOIN WAITLIST" → "UPGRADE NOW"
- Authenticated Pro user: "CURRENT PLAN" badge, CTA disabled
- Unauthenticated: "SIGN UP" → login → back to pricing

### Success flow

- Checkout redirects to `/settings?upgraded=true`
- Settings polls `GET /me` until `plan !== "free"` (max 10s, 1s interval)
- Shows success toast

### MCP 402 handling

MCP server receives 402 from API → returns readable message to agent:
`"Free plan limit reached (3 chests). Upgrade at contextchest.com/pricing"`

## Stripe Configuration (manual)

### Dashboard

- Product: "Context Chest Pro"
- Price 1: $9/month (recurring monthly)
- Price 2: $7/month (recurring yearly, billed $84)
- Customer Portal: enable self-service (cancel, switch plan, update payment, invoices)
- Webhook endpoint: `https://<railway-url>/v1/billing/webhook`
- Webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### Environment variables (Railway)

- `STRIPE_SECRET_KEY` — `sk_live_...`
- `STRIPE_WEBHOOK_SECRET` — `whsec_...`
- `STRIPE_PRICE_MONTHLY` — `price_...`
- `STRIPE_PRICE_YEARLY` — `price_...`

## Security

- Webhook verifies `stripe-signature` via `stripe.webhooks.constructEvent()`
- No Stripe keys in client — PWA only redirects to URLs from API
- Checkout Session uses `client_reference_id: userId` for reliable mapping
- Raw request body preserved for webhook signature verification

## Scope Estimate

| Component | LoC |
|-----------|-----|
| Prisma migration (2 fields) | ~10 |
| `src/routes/billing.ts` (3 endpoints) | ~120 |
| Plan guard + limit enforcement | ~80 |
| `role-guard.ts` extension | ~20 |
| `ChestRouter` + `ChestService` limit check | ~30 |
| PWA Settings + Pricing update | ~60 |
| MCP server 402 handling | ~15 |
| **Total** | **~335** |
