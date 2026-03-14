import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '@prisma/client';
import { GrantService, Permission } from '../services/grant';

const grantService = new GrantService();

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
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing token',
      });
      return;
    }

    const decoded = request.user as Record<string, unknown>;
    const role = extractRoleFromToken(decoded);

    if (!grantService.hasPermission(role, permission)) {
      reply.code(403).send({
        code: 'FORBIDDEN',
        message: `Role '${role}' does not have '${permission}' permission`,
      });
      return;
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
