import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient, Role } from '@prisma/client';
import { GrantService, Permission } from '../services/grant';
import { resolveApiKey } from '../routes/api-keys';

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
      // API keys get admin role (full access)
      (request as unknown as Record<string, unknown>).userRole = 'admin';
      (request as unknown as Record<string, unknown>).userId = apiKeyUser.userId;
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
  };
}

const roleGuard: FastifyPluginAsync = async (_fastify) => {
  // Plugin registers the helpers; routes use requirePermission() as preHandler
};

export default fp(roleGuard);
