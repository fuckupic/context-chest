import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient, Role } from '@prisma/client';
import { GrantService, Permission } from '../services/grant';
import { resolveApiKey } from '../routes/api-keys';
import { getPlanLimits } from '../lib/plan-limits';

const grantService = new GrantService();
const prisma = new PrismaClient();

export function rolePermissions(role: Role): Permission[] {
  return grantService.permissionsForRole(role);
}

export function extractRoleFromToken(decoded: Record<string, unknown>): Role {
  // Direct JWT (user's own token) — no `aud` means owner
  if (!decoded.aud) {
    return 'admin';
  }
  // Grant token — use embedded role, default to tool
  return (decoded.role as Role) ?? 'tool';
}

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Try API key auth first (cc_... tokens)
    const apiKeyUser = await resolveApiKey(prisma, request.headers.authorization);
    if (apiKeyUser) {
      const userWithPlan = await prisma.user.findUnique({
        where: { id: apiKeyUser.userId },
        select: { stripePlan: true },
      });
      // API keys get admin role (full access)
      (request as unknown as Record<string, unknown>).userRole = 'admin';
      (request as unknown as Record<string, unknown>).userId = apiKeyUser.userId;
      (request as unknown as Record<string, unknown>).stripePlan = userWithPlan?.stripePlan ?? 'free';
      const blocked = await checkAgentLimit(request, reply, apiKeyUser.userId, userWithPlan?.stripePlan ?? 'free');
      if (blocked) return;
      return;
    }

    // Fall back to JWT auth
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing token',
      });
    }

    const decoded = request.user as Record<string, unknown>;
    const role = extractRoleFromToken(decoded);

    if (!grantService.hasPermission(role, permission)) {
      return reply.code(403).send({
        code: 'FORBIDDEN',
        message: `Role '${role}' does not have '${permission}' permission`,
      });
    }

    // Attach role and userId to request for downstream use
    (request as unknown as Record<string, unknown>).userRole = role;
    (request as unknown as Record<string, unknown>).userId = decoded.sub;

    const userWithPlan = await prisma.user.findUnique({
      where: { id: decoded.sub as string },
      select: { stripePlan: true },
    });
    (request as unknown as Record<string, unknown>).stripePlan = userWithPlan?.stripePlan ?? 'free';
    const agentBlocked = await checkAgentLimit(request, reply, decoded.sub as string, userWithPlan?.stripePlan ?? 'free');
    if (agentBlocked) return;
  };
}

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
  if (existing) return false;

  const count = await prisma.agentConnection.count({ where: { userId } });
  if (count >= limits.maxAgents) {
    reply.code(402).send({
      code: 'PLAN_LIMIT',
      resource: 'agents',
      limit: limits.maxAgents,
      upgradeUrl: '/pricing',
    });
    return true;
  }
  return false;
}

const roleGuard: FastifyPluginAsync = async (_fastify) => {
  // Plugin registers the helpers; routes use requirePermission() as preHandler
};

export default fp(roleGuard);
