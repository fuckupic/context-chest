import { PrismaClient } from '@prisma/client';

interface AuditEntry {
  route: string;
  method: string;
  ip: string;
  status: number;
  action?: string;
  uri?: string;
  clientId?: string;
  bytes?: number;
}

export class AuditService {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient();
  }

  async log(userId: string, entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        route: entry.route,
        method: entry.method,
        ip: entry.ip,
        status: entry.status,
        action: entry.action,
        uri: entry.uri,
        clientId: entry.clientId,
        bytes: entry.bytes,
      },
    });
  }
}
