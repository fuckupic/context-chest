import { saveCredentials, loadCredentials, tokenExpiresWithin } from './auth';

interface ClientConfig {
  baseUrl: string;
  token: string;
  refreshToken?: string;
}

interface RememberInput {
  uri: string;
  l0: string;
  l1: string;
  encryptedL2: string;
  sha256: string;
}

interface RecallResult {
  data: Array<{ uri: string; l0: string; l1: string; score: number }>;
  meta: { total: number; page: number; limit: number };
}

interface SessionMemory {
  uri: string;
  l0: string;
  l1: string;
  encryptedL2: string;
  sha256: string;
}

const REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export class ContextChestClient {
  private readonly baseUrl: string;
  private token: string;
  private refreshToken: string | undefined;
  private refreshing: Promise<void> | null = null;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.refreshToken = config.refreshToken;
  }

  setToken(token: string): void {
    this.token = token;
  }

  setRefreshToken(refreshToken: string): void {
    this.refreshToken = refreshToken;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
      'X-Agent-Name': 'Claude Code',
    };
  }

  private async ensureFreshToken(): Promise<void> {
    if (!this.refreshToken) return;
    if (!tokenExpiresWithin(this.token, REFRESH_MARGIN_MS)) return;

    // Deduplicate concurrent refresh calls
    if (this.refreshing) {
      await this.refreshing;
      return;
    }

    this.refreshing = this.doRefresh();
    try {
      await this.refreshing;
    } finally {
      this.refreshing = null;
    }
  }

  private async doRefresh(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        process.stderr.write(`[context-chest] Token refresh failed: HTTP ${response.status}\n`);
        return;
      }

      const data = (await response.json()) as { token: string; refreshToken: string };
      this.token = data.token;
      this.refreshToken = data.refreshToken;

      // Persist the new tokens to credentials file
      const creds = loadCredentials();
      if (creds) {
        saveCredentials({
          ...creds,
          jwt: data.token,
          refreshToken: data.refreshToken,
        });
      }

      process.stderr.write('[context-chest] Token refreshed successfully\n');
    } catch (err) {
      process.stderr.write(`[context-chest] Token refresh error: ${(err as Error).message}\n`);
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    await this.ensureFreshToken();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });

    // If we get a 401, try one refresh and retry
    if (response.status === 401 && this.refreshToken) {
      await this.doRefresh();
      const retry = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!retry.ok) {
        const error = await retry.json().catch(() => ({ code: 'UNKNOWN', message: `HTTP ${retry.status}` }));
        throw new Error((error as Record<string, string>).code ?? `HTTP ${retry.status}`);
      }

      if (retry.status === 204) return undefined as T;
      return retry.json() as Promise<T>;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ code: 'UNKNOWN', message: `HTTP ${response.status}` }));
      throw new Error((error as Record<string, string>).code ?? `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private async requestBinary(path: string): Promise<Buffer> {
    await this.ensureFreshToken();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}`, 'X-Agent-Name': 'Claude Code' },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ code: 'UNKNOWN' }));
      throw new Error((error as Record<string, string>).code ?? `HTTP ${response.status}`);
    }

    const arrayBuf = await response.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async remember(input: RememberInput) {
    return this.request<{ success: boolean; data: { uri: string; createdAt: string } }>(
      'POST', '/v1/memory/remember', input
    );
  }

  async recall(query: string, limit: number, offset: number) {
    return this.request<{ success: boolean } & RecallResult>(
      'POST', '/v1/memory/recall', { query, limit, offset }
    );
  }

  async getContent(uri: string): Promise<Buffer> {
    return this.requestBinary(`/v1/memory/content/${uri}`);
  }

  async forget(uri: string) {
    return this.request<void>('DELETE', `/v1/memory/forget/${uri}`);
  }

  async browse(path: string = '', depth: number = 2) {
    return this.request<{ success: boolean; data: { tree: unknown[] } }>(
      'GET', `/v1/memory/browse?path=${encodeURIComponent(path)}&depth=${depth}`
    );
  }

  async createSession(clientId?: string) {
    return this.request<{ success: boolean; data: { id: string } }>(
      'POST', '/v1/sessions', clientId ? { clientId } : {}
    );
  }

  async appendMessage(sessionId: string, input: { role: string; encryptedContent: string; l0Summary: string; sha256: string }) {
    return this.request<{ success: boolean; data: { messageIndex: number } }>(
      'POST', `/v1/sessions/${sessionId}/messages`, input
    );
  }

  async closeSession(sessionId: string, memories: SessionMemory[]) {
    return this.request<{ success: boolean; data: { memoriesExtracted: number } }>(
      'POST', `/v1/sessions/${sessionId}/close`, { memories }
    );
  }

  async putMasterKey(encryptedMasterKey: string) {
    return this.request<{ success: boolean }>('PUT', '/v1/auth/master-key', { encryptedMasterKey });
  }

  async getMasterKey(): Promise<string> {
    const result = await this.request<{ encryptedMasterKey: string }>('GET', '/v1/auth/master-key');
    return result.encryptedMasterKey;
  }
}
