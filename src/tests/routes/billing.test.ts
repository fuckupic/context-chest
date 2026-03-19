import { billingRoutes } from '../../routes/billing';

// --- Stripe mock -----------------------------------------------------------

const mockCustomersCreate = jest.fn();
const mockCheckoutSessionsCreate = jest.fn();
const mockPortalSessionsCreate = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: { create: mockCustomersCreate },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: mockPortalSessionsCreate } },
    webhooks: { constructEvent: mockConstructEvent },
  }));
});

// --- role-guard mock --------------------------------------------------------

jest.mock('../../plugins/role-guard', () => ({
  requirePermission: () => async (request: Record<string, unknown>) => {
    // Simulate authenticated user — tests override userId via decorator
    request.userId = request.userId ?? 'user-1';
  },
}));

// --- Prisma mock ------------------------------------------------------------

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateMany = jest.fn();
const mockExecuteRaw = jest.fn();

const mockPrisma = {
  user: {
    findUnique: mockFindUnique,
    update: mockUpdate,
    updateMany: mockUpdateMany,
  },
  $executeRaw: mockExecuteRaw,
} as never;

// --- Fastify test harness ---------------------------------------------------

import Fastify from 'fastify';
import rawBody from 'fastify-raw-body';

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(rawBody, { field: 'rawBody', global: false, runFirst: true });
  app.register(billingRoutes(mockPrisma), { prefix: '/v1/billing' });
  return app;
}

// Set required env vars for the route module
beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_PRICE_MONTHLY = 'price_monthly_123';
  process.env.STRIPE_PRICE_YEARLY = 'price_yearly_456';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.FRONTEND_URL = 'http://localhost:5173';
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// CHECKOUT
// ---------------------------------------------------------------------------

describe('POST /v1/billing/checkout', () => {
  it('creates Stripe customer when stripeCustomerId is null', async () => {
    const app = buildApp();

    mockFindUnique
      .mockResolvedValueOnce({
        stripeCustomerId: null,
        email: 'alice@example.com',
        stripePlan: 'free',
      });

    mockCustomersCreate.mockResolvedValueOnce({ id: 'cus_new_123' });
    mockExecuteRaw.mockResolvedValueOnce(1); // row updated
    mockCheckoutSessionsCreate.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/session' });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/checkout',
      payload: { interval: 'month' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ url: 'https://checkout.stripe.com/session' });
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' }),
      expect.objectContaining({ idempotencyKey: 'customer_user-1' }),
    );
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_new_123',
        mode: 'subscription',
        client_reference_id: 'user-1',
      }),
    );

    await app.close();
  });

  it('reuses existing stripeCustomerId', async () => {
    const app = buildApp();

    mockFindUnique.mockResolvedValueOnce({
      stripeCustomerId: 'cus_existing_789',
      email: 'bob@example.com',
      stripePlan: 'free',
    });

    mockCheckoutSessionsCreate.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/existing' });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/checkout',
      payload: { interval: 'year' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ url: 'https://checkout.stripe.com/existing' });
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing_789' }),
    );

    await app.close();
  });

  it('returns 400 when already on Pro plan', async () => {
    const app = buildApp();

    mockFindUnique.mockResolvedValueOnce({
      stripeCustomerId: 'cus_pro_user',
      email: 'pro@example.com',
      stripePlan: 'pro',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/checkout',
      payload: { interval: 'month' },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual(
      expect.objectContaining({ code: 'ALREADY_PRO' }),
    );
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();

    await app.close();
  });

  it('handles race condition — executeRaw returns 0, falls back to fresh lookup', async () => {
    const app = buildApp();

    mockFindUnique
      .mockResolvedValueOnce({
        stripeCustomerId: null,
        email: 'race@example.com',
        stripePlan: 'free',
      })
      .mockResolvedValueOnce({ stripeCustomerId: 'cus_race_winner' });

    mockCustomersCreate.mockResolvedValueOnce({ id: 'cus_race_loser' });
    mockExecuteRaw.mockResolvedValueOnce(0); // another request won the race
    mockCheckoutSessionsCreate.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/race' });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/checkout',
      payload: { interval: 'month' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_race_winner' }),
    );

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// PORTAL
// ---------------------------------------------------------------------------

describe('POST /v1/billing/portal', () => {
  it('returns portal URL when customer exists', async () => {
    const app = buildApp();

    mockFindUnique.mockResolvedValueOnce({ stripeCustomerId: 'cus_portal_user' });
    mockPortalSessionsCreate.mockResolvedValueOnce({ url: 'https://billing.stripe.com/portal' });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/portal',
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ url: 'https://billing.stripe.com/portal' });
    expect(mockPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_portal_user',
        return_url: 'http://localhost:5173/settings',
      }),
    );

    await app.close();
  });

  it('returns 400 when stripeCustomerId is null', async () => {
    const app = buildApp();

    mockFindUnique.mockResolvedValueOnce({ stripeCustomerId: null });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/portal',
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual(
      expect.objectContaining({ code: 'NO_SUBSCRIPTION' }),
    );
    expect(mockPortalSessionsCreate).not.toHaveBeenCalled();

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// WEBHOOK
// ---------------------------------------------------------------------------

describe('POST /v1/billing/webhook', () => {
  it('rejects request without stripe-signature header', async () => {
    const app = buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/webhook',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual(
      expect.objectContaining({ code: 'MISSING_SIGNATURE' }),
    );

    await app.close();
  });

  it('rejects request with invalid signature', async () => {
    const app = buildApp();

    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error('Signature verification failed');
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'bad_sig' },
      payload: '{}',
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual(
      expect.objectContaining({ code: 'INVALID_SIGNATURE' }),
    );

    await app.close();
  });

  it('sets stripePlan to pro on checkout.session.completed', async () => {
    const app = buildApp();

    mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: 'user-upgrade-1' } },
    });
    mockUpdate.mockResolvedValueOnce({});

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'valid_sig' },
      payload: '{}',
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ received: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'user-upgrade-1' },
      data: { stripePlan: 'pro', planActivatedAt: expect.any(Date) },
    });

    await app.close();
  });

  it('sets stripePlan to free on customer.subscription.deleted', async () => {
    const app = buildApp();

    mockConstructEvent.mockReturnValueOnce({
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_deleted_sub' } },
    });
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'valid_sig' },
      payload: '{}',
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ received: true });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_deleted_sub' },
      data: { stripePlan: 'free', planActivatedAt: null },
    });

    await app.close();
  });

  it('downgrades on subscription.updated with canceled status', async () => {
    const app = buildApp();

    mockConstructEvent.mockReturnValueOnce({
      type: 'customer.subscription.updated',
      data: { object: { customer: 'cus_canceled', status: 'canceled' } },
    });
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'valid_sig' },
      payload: '{}',
    });

    expect(res.statusCode).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_canceled' },
      data: { stripePlan: 'free', planActivatedAt: null },
    });

    await app.close();
  });

  it('keeps pro on subscription.updated with past_due status (should NOT downgrade)', async () => {
    const app = buildApp();

    mockConstructEvent.mockReturnValueOnce({
      type: 'customer.subscription.updated',
      data: { object: { customer: 'cus_past_due', status: 'past_due' } },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'valid_sig' },
      payload: '{}',
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ received: true });
    // Should NOT call updateMany — past_due is not a downgrade trigger
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();

    await app.close();
  });

  it('handles invoice.payment_failed without changing plan', async () => {
    const app = buildApp();

    mockConstructEvent.mockReturnValueOnce({
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_failed_payment' } },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'valid_sig' },
      payload: '{}',
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ received: true });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();

    await app.close();
  });

  it('handles unrecognized event types gracefully', async () => {
    const app = buildApp();

    mockConstructEvent.mockReturnValueOnce({
      type: 'some.unknown.event',
      data: { object: {} },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'valid_sig' },
      payload: '{}',
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ received: true });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();

    await app.close();
  });
});
