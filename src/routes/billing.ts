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
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
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

          const result = await prisma.$executeRaw`
            UPDATE users SET stripe_customer_id = ${customer.id}
            WHERE id = ${userId} AND stripe_customer_id IS NULL
          `;

          if (result === 0) {
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
