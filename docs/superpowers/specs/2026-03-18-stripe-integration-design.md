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
enum PlanTier {
  free
  pro
}

model User {
  // ... existing fields ...
  stripeCustomerId  String?    @unique @map("stripe_customer_id")
  stripePlan        PlanTier   @default(free) @map("stripe_plan")
  planActivatedAt   DateTime?  @map("plan_activated_at")
}
```

- `stripeCustomerId` — created on first Checkout, Stripe is source of truth
- `stripePlan` — enum with `free` default. Webhook sets to `pro` or back to `free`.
- `planActivatedAt` — timestamp for support/audit trail. Set when plan changes to `pro`, cleared on downgrade.

Limit constants (in code, not DB):

```typescript
const PLAN_LIMITS = {
  free: { maxChests: 3, maxAgents: 2 },
  pro: { maxChests: Infinity, maxAgents: Infinity },
}
```

## API Endpoints

### `POST /v1/billing/checkout` (authenticated)

Creates Stripe Customer (if needed) + Checkout Session.

- Body: `{ interval: 'month' | 'year' }`
- Response: `{ url: "https://checkout.stripe.com/..." }`
- **Race-safe customer creation**: Uses `UPDATE users SET stripe_customer_id = $1 WHERE id = $2 AND stripe_customer_id IS NULL` + check rows affected. If 0 rows, re-read existing `stripeCustomerId`. Also pass `idempotencyKey: userId` to `stripe.customers.create()`.
- Checkout Session: `mode: 'subscription'`, `client_reference_id: userId`
- URLs use `FRONTEND_URL` env var (not hardcoded): `success_url: ${FRONTEND_URL}/settings?upgraded=true`, `cancel_url: ${FRONTEND_URL}/pricing`

### `POST /v1/billing/portal` (authenticated)

Creates Stripe Customer Portal Session.

- Response: `{ url: "https://billing.stripe.com/..." }`
- If `stripeCustomerId` is null → `400 { code: "NO_SUBSCRIPTION", message: "No billing account found. Subscribe first." }`

### `POST /v1/billing/webhook` (public, Stripe signature verification)

Handles Stripe webhook events. Verifies `stripe-signature` header.

Events handled:

| Event | Lookup | Action |
|-------|--------|--------|
| `checkout.session.completed` | `client_reference_id` → userId | Set `stripePlan: pro`, `planActivatedAt: now()` |
| `customer.subscription.updated` | `event.data.object.customer` → `stripeCustomerId` | If `status === "canceled" \|\| status === "unpaid"` → set `stripePlan: free`, clear `planActivatedAt`. Keep `pro` during `past_due` (Stripe retries). |
| `customer.subscription.deleted` | `event.data.object.customer` → `stripeCustomerId` | Set `stripePlan: free`, clear `planActivatedAt` |
| `invoice.payment_failed` | `event.data.object.customer` → `stripeCustomerId` | No plan change. Log for monitoring. Future: surface banner in PWA. |

**Important**: Subscription events look up user by `stripeCustomerId` field (not `client_reference_id` which is only on checkout sessions).

### `GET /v1/auth/me` (extended)

Add `plan` field to response:

```typescript
// Current: select: { id: true, email: true }
// Updated: select: { id: true, email: true, stripePlan: true }
return { userId: user.id, email: user.email, plan: user.stripePlan }
```

## Limit Enforcement

### Chest limit (free: 3)

- `ChestService.create()`: count user's chests. If >= 3 and `stripePlan === "free"` → `402 { code: "PLAN_LIMIT", resource: "chests", limit: 3, upgradeUrl: "/pricing" }`
- `ChestRouter.resolve()`: **before calling `upsertByName`**, check `chests.length` against plan limit. If would exceed, skip creation and fall back to default chest. Agent flow never breaks. This check uses the `chests` array already fetched on line 35 of `chest-router.ts`.

### Agent limit (free: 2)

- **After both auth branches** (API key and JWT) in `role-guard.ts` resolve `userId`: check `X-Agent-Name` header. If present, query `agentConnection.count({ where: { userId } })`. If new agent (no existing record for this name) and count >= 2 and `stripePlan === "free"` → `402 { code: "PLAN_LIMIT", resource: "agents", limit: 2, upgradeUrl: "/pricing" }`
- The check must run **after** line 31 (API key path) and **after** line 56 (JWT path) — both paths must flow into the same agent-limit logic.
- Existing agents continue working — limit only applies when a **new** agent first connects.

### Memory count

No change — unlimited for both tiers. Existing `checkMemoryLimit(userId, 1000)` remains as safety cap.

### Reading plan in middleware

`requirePermission()` already resolves `userId`. Extend the user lookup (both API key and JWT paths) to also fetch `stripePlan` and attach to request as `request.stripePlan`.

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
- Settings polls `GET /me` until `plan === "pro"` (max 60s, exponential backoff: 1s → 2s → 4s → ...)
- During polling: show "Your upgrade is being processed..." message with spinner
- After 60s timeout: show "Upgrade confirmed by Stripe. It may take a moment to activate. Refresh the page in a minute." (don't show error)
- Shows success toast when plan activates

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
- Webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

### Environment variables (Railway)

- `STRIPE_SECRET_KEY` — `sk_live_...`
- `STRIPE_WEBHOOK_SECRET` — `whsec_...`
- `STRIPE_PRICE_MONTHLY` — `price_...`
- `STRIPE_PRICE_YEARLY` — `price_...`
- `FRONTEND_URL` — `https://contextchest.com` (used for checkout success/cancel URLs)

## Security

- Webhook verifies `stripe-signature` via `stripe.webhooks.constructEvent()`
- No Stripe keys in client — PWA only redirects to URLs from API
- Checkout Session uses `client_reference_id: userId` for reliable mapping
- Raw request body preserved for webhook signature verification (Fastify `rawBody` option)
- Race-safe Stripe Customer creation via idempotency key + conditional DB write

## Scope Estimate

| Component | LoC |
|-----------|-----|
| Prisma migration (enum + 3 fields) | ~15 |
| `src/routes/billing.ts` (3 endpoints + webhook) | ~150 |
| Plan-aware limit enforcement in `role-guard.ts` | ~30 |
| `ChestRouter.resolve()` + `ChestService.create()` limit check | ~30 |
| `GET /me` extension | ~5 |
| PWA Settings + Pricing update | ~80 |
| MCP server 402 handling | ~15 |
| **Total** | **~325** |
