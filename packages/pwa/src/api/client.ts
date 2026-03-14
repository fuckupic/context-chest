interface RememberInput {
  uri: string;
  l0: string;
  l1: string;
  encryptedL2: string;
  sha256: string;
}

interface RecallResult {
  uri: string;
  l0: string;
  l1: string;
  score: number;
}

interface GrantItem {
  id: string;
  clientName: string;
  clientId: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

interface SessionItem {
  id: string;
  status: string;
  messageCount: number;
  memoriesExtracted: number;
  clientId: string | null;
  createdAt: string;
  closedAt: string | null;
}

interface BrowseEntry {
  uri: string;
  l0: string;
  type: 'file' | 'directory';
  children?: BrowseEntry[];
}

export class ApiClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ code: 'UNKNOWN' }));
      throw new Error((err as Record<string, string>).code ?? `HTTP ${response.status}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  // Auth — simple email + password
  async registerSimple(email: string, password: string): Promise<{ token: string; userId: string; exportKey: string }> {
    const res = await fetch('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      throw new Error(err.message ?? err.code ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  async loginSimple(email: string, password: string): Promise<{ token: string; userId: string; exportKey: string }> {
    const res = await fetch('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      throw new Error(err.message ?? err.code ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  async putMasterKey(encryptedMasterKey: string) {
    return this.request<{ success: boolean }>('PUT', '/v1/auth/master-key', { encryptedMasterKey });
  }

  async getMasterKey(): Promise<string> {
    const result = await this.request<{ encryptedMasterKey: string }>('GET', '/v1/auth/master-key');
    return result.encryptedMasterKey;
  }

  // Memory
  async browse(path: string = '', depth: number = 2) {
    return this.request<{ success: boolean; data: { tree: BrowseEntry[] }; meta: { total: number } }>(
      'GET', `/v1/memory/browse?path=${encodeURIComponent(path)}&depth=${depth}`
    );
  }

  async recall(query: string, limit: number = 10, offset: number = 0) {
    return this.request<{ success: boolean; data: RecallResult[]; meta: { total: number; page: number; limit: number } }>(
      'POST', '/v1/memory/recall', { query, limit, offset }
    );
  }

  async listMemories(page: number = 1, limit: number = 100) {
    return this.request<{ success: boolean; data: Array<{ uri: string; sha256: string; sizeBytes: number; createdAt: string }>; meta: { total: number } }>(
      'GET', `/v1/memory/list?page=${page}&limit=${limit}`
    );
  }

  async getContent(uri: string): Promise<ArrayBuffer> {
    const response = await fetch(`/v1/memory/content/${uri}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  }

  // Grants
  async listGrants() {
    return this.request<{ grants: GrantItem[] }>('GET', '/v1/connect/grants');
  }

  async revokeGrant(id: string) {
    return this.request<void>('DELETE', `/v1/connect/grants/${id}`);
  }

  // Sessions
  async listSessions(status?: string, page: number = 1, limit: number = 50) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    return this.request<{ success: boolean; data: SessionItem[]; meta: { total: number; page: number; limit: number } }>(
      'GET', `/v1/sessions?${params}`
    );
  }
}
