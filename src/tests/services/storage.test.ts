import { StorageService } from '../../services/storage';

jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn();
  return {
    S3Client: jest.fn(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn((params) => ({ ...params, _type: 'Put' })),
    GetObjectCommand: jest.fn((params) => ({ ...params, _type: 'Get' })),
    DeleteObjectCommand: jest.fn((params) => ({ ...params, _type: 'Delete' })),
    __mockSend: mockSend,
  };
});

const { __mockSend: mockSend } = jest.requireMock('@aws-sdk/client-s3');

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StorageService({
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      accessKeyId: 'test',
      secretAccessKey: 'test',
      bucket: 'test-bucket',
    });
  });

  describe('upload', () => {
    it('should upload buffer to S3 with correct key', async () => {
      mockSend.mockResolvedValueOnce({});
      const buffer = Buffer.from('test data');
      await service.upload('user1/memories/test.enc', buffer, 'abc123');
      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.Key).toBe('user1/memories/test.enc');
      expect(cmd.Bucket).toBe('test-bucket');
    });
  });

  describe('download', () => {
    it('should fetch buffer from S3', async () => {
      const bodyStream = {
        transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      };
      mockSend.mockResolvedValueOnce({ Body: bodyStream });
      const result = await service.download('user1/memories/test.enc');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(3);
    });

    it('should throw if key not found', async () => {
      mockSend.mockResolvedValueOnce({ Body: undefined });
      await expect(service.download('nonexistent')).rejects.toThrow('Object not found');
    });
  });

  describe('delete', () => {
    it('should delete object from S3', async () => {
      mockSend.mockResolvedValueOnce({});
      await service.delete('user1/memories/test.enc');
      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.Key).toBe('user1/memories/test.enc');
    });
  });
});
