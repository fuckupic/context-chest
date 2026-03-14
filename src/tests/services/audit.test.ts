import { AuditService } from '../../services/audit';

const mockCreate = jest.fn();
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    auditLog: { create: mockCreate },
  })),
}));

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService();
  });

  it('should create audit log with required fields', async () => {
    mockCreate.mockResolvedValueOnce({});
    await service.log('user-1', {
      route: '/v1/memory/remember',
      method: 'POST',
      ip: '127.0.0.1',
      status: 200,
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        route: '/v1/memory/remember',
        method: 'POST',
        ip: '127.0.0.1',
        status: 200,
      }),
    });
  });

  it('should include optional context fields', async () => {
    mockCreate.mockResolvedValueOnce({});
    await service.log('user-1', {
      route: '/v1/memory/remember',
      method: 'POST',
      ip: '127.0.0.1',
      status: 200,
      action: 'remember',
      uri: 'preferences/theme',
      clientId: 'agent-x',
      bytes: 1024,
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'remember',
        uri: 'preferences/theme',
        clientId: 'agent-x',
        bytes: 1024,
      }),
    });
  });
});
