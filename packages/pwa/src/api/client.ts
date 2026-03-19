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

interface AgentItem {
  id: string;
  agentName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  requestCount: number;
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

interface ChestItem {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isAutoCreated: boolean;
  createdAt: string;
  _count?: { memories: number };
}

interface ChestPermissionItem {
  id: string;
  chestId: string;
  agentName: string;
  canRead: boolean;
  canWrite: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiClient {
  private token: string;
  private chestName: string = 'default';

  constructor(token: string) {
    this.token = token;
  }

  setToken(token: string) {
    this.token = token;
  }

  setChestName(name: string) {
    this.chestName = name;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
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
    const res = await fetch(`${API_BASE}/v1/auth/register`, {
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
    const res = await fetch(`${API_BASE}/v1/auth/login`, {
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

  // Chests
  async listChests() {
    return this.request<{ success: boolean; data: ChestItem[] }>('GET', '/v1/chests');
  }

  async createChest(name: string, description?: string, isPublic?: boolean) {
    return this.request<{ success: boolean; data: ChestItem }>('POST', '/v1/chests', { name, description, isPublic });
  }

  async deleteChest(id: string) {
    return this.request<void>('DELETE', `/v1/chests/${id}`);
  }

  async getChestPermissions(chestId: string) {
    return this.request<{ success: boolean; data: ChestPermissionItem[] }>('GET', `/v1/chests/${chestId}/permissions`);
  }

  async setChestPermissions(chestId: string, permissions: Array<{ agentName: string; canRead: boolean; canWrite: boolean }>) {
    return this.request<{ success: boolean; data: ChestPermissionItem[] }>('PUT', `/v1/chests/${chestId}/permissions`, { permissions });
  }

  // Memory
  async browse(path: string = '', depth: number = 2) {
    return this.request<{ success: boolean; data: { tree: BrowseEntry[] }; meta: { total: number } }>(
      'GET', `/v1/memory/browse?path=${encodeURIComponent(path)}&depth=${depth}&chest=${encodeURIComponent(this.chestName)}`
    );
  }

  async recall(query: string, limit: number = 10, offset: number = 0) {
    return this.request<{ success: boolean; data: RecallResult[]; meta: { total: number; page: number; limit: number } }>(
      'POST', `/v1/memory/recall?chest=${encodeURIComponent(this.chestName)}`, { query, limit, offset }
    );
  }

  async listMemories(page: number = 1, limit: number = 100) {
    return this.request<{ success: boolean; data: Array<{ uri: string; sha256: string; sizeBytes: number; createdAt: string }>; meta: { total: number } }>(
      'GET', `/v1/memory/list?page=${page}&limit=${limit}&chest=${encodeURIComponent(this.chestName)}`
    );
  }

  async getContent(uri: string): Promise<ArrayBuffer> {
    const response = await fetch(`${API_BASE}/v1/memory/content/${uri}?chest=${encodeURIComponent(this.chestName)}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  }

  async updateMemory(uri: string, data: { l0: string; l1: string; encryptedL2: string; sha256: string }) {
    return this.request<{ success: boolean }>(
      'PUT', `/v1/memory/content/${uri}?chest=${encodeURIComponent(this.chestName)}`,
      { ...data, encryptionVersion: 2 }
    );
  }

  async remember(data: RememberInput & { chest?: string }) {
    const { chest, ...body } = data;
    const chestParam = chest ?? this.chestName;
    return this.request<{ success: boolean; data: { uri: string } }>(
      'POST', `/v1/memory/remember?chest=${encodeURIComponent(chestParam)}`,
      body
    );
  }

  // Grants
  async listGrants() {
    return this.request<{ grants: GrantItem[] }>('GET', '/v1/connect/grants');
  }

  async revokeGrant(id: string) {
    return this.request<void>('DELETE', `/v1/connect/grants/${id}`);
  }

  // Agents
  async listAgents() {
    return this.request<{ agents: AgentItem[] }>('GET', '/v1/connect/agents');
  }

  async disconnectAgent(id: string) {
    return this.request<void>('DELETE', `/v1/connect/agents/${id}`);
  }

  // Sessions
  async listSessions(status?: string, page: number = 1, limit: number = 50) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), chest: this.chestName });
    if (status) params.set('status', status);
    return this.request<{ success: boolean; data: SessionItem[]; meta: { total: number; page: number; limit: number } }>(
      'GET', `/v1/sessions?${params}`
    );
  }

  // Billing
  async getMe() {
    return this.request<{ userId: string; email: string; plan: string }>('GET', '/v1/auth/me');
  }

  async createCheckout(interval: 'month' | 'year') {
    return this.request<{ url: string }>('POST', '/v1/billing/checkout', { interval });
  }

  async createPortal() {
    return this.request<{ url: string }>('POST', '/v1/billing/portal');
  }
}
