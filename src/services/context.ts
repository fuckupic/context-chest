interface ContextConfig {
  baseUrl: string;
  apiKey: string;
}

interface WritePayload {
  l0: string;
  l1: string;
}

interface SearchResult {
  uri: string;
  l0: string;
  l1: string;
  score: number;
}

interface DirectoryEntry {
  uri: string;
  l0: string;
  type: 'file' | 'directory';
  children?: DirectoryEntry[];
}

export class ContextService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ContextConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  private userRoot(userId: string, chestName: string = 'default'): string {
    return `viking://user/${userId}/chests/${chestName}/memories`;
  }

  private fullUri(userId: string, relativePath: string, chestName: string = 'default'): string {
    return `${this.userRoot(userId, chestName)}/${relativePath}`;
  }

  private authHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
      'X-OpenViking-Account': 'default',
      'X-OpenViking-User': 'default',
    };
  }

  private async postJson(path: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`OpenViking error: ${response.status} ${text.slice(0, 200)}`);
    }
    return response.json();
  }

  private async getJson(path: string, params: Record<string, string> = {}): Promise<unknown> {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${this.baseUrl}${path}?${qs}` : `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`OpenViking error: ${response.status} ${text.slice(0, 200)}`);
    }
    return response.json();
  }

  private async deleteRequest(path: string, params: Record<string, string> = {}): Promise<void> {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${this.baseUrl}${path}?${qs}` : `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`OpenViking error: ${response.status} ${text.slice(0, 200)}`);
    }
  }

  // Write content as a resource to OpenViking
  async write(userId: string, relativePath: string, payload: WritePayload, chestName: string = 'default'): Promise<void> {
    const uri = this.fullUri(userId, relativePath, chestName);
    await this.postJson('/api/v1/resources', {
      path: uri,
      reason: payload.l0,
      instruction: payload.l1,
      wait: true,
    });
  }

  // Search using OpenViking's find endpoint
  async find(
    userId: string,
    query: string,
    limit: number,
    offset: number = 0,
    chestName: string = 'default',
  ): Promise<{ results: SearchResult[]; total: number }> {
    const root = this.userRoot(userId, chestName);
    const data = (await this.postJson('/api/v1/search/find', {
      query,
      target_uri: root,
      limit,
    })) as { results?: Array<{ uri?: string; abstract?: string; overview?: string; score?: number }>; total?: number };

    const results: SearchResult[] = (data.results ?? []).map((r) => ({
      uri: (r.uri ?? '').replace(root + '/', ''),
      l0: r.abstract ?? '',
      l1: r.overview ?? '',
      score: r.score ?? 0,
    }));

    return { results: results.slice(offset), total: data.total ?? results.length };
  }

  // Read content metadata
  async read(userId: string, relativePath: string, chestName: string = 'default'): Promise<{ l0: string; l1: string }> {
    const uri = this.fullUri(userId, relativePath, chestName);
    const data = (await this.getJson('/api/v1/content/read', { uri })) as {
      content?: string;
      abstract?: string;
      overview?: string;
    };
    return { l0: data.abstract ?? '', l1: data.overview ?? data.content ?? '' };
  }

  // Delete a resource
  async delete(userId: string, relativePath: string, chestName: string = 'default'): Promise<void> {
    const uri = this.fullUri(userId, relativePath, chestName);
    await this.deleteRequest('/api/v1/fs', { uri, recursive: 'true' });
  }

  // List directory contents
  async list(userId: string, path: string, depth: number, chestName: string = 'default'): Promise<DirectoryEntry[]> {
    const uri = this.fullUri(userId, path, chestName);
    const root = this.userRoot(userId, chestName);
    let data: { entries?: Array<{ uri?: string; name?: string; type?: string; abstract?: string }> };
    try {
      data = (await this.getJson('/api/v1/fs/ls', {
        uri,
        recursive: depth > 1 ? 'true' : 'false',
        simple: 'true',
        limit: '100',
      })) as typeof data;
    } catch (err) {
      if (err instanceof Error && err.message.includes('no such directory')) {
        return [];
      }
      throw err;
    }

    return (data.entries ?? []).map((e) => ({
      uri: (e.uri ?? e.name ?? '').replace(root + '/', ''),
      l0: e.abstract ?? '',
      type: (e.type === 'directory' ? 'directory' : 'file') as 'file' | 'directory',
    }));
  }

  // Categorize a memory path using vector search with keyword fallback
  async categorize(userId: string, chestName: string, l0: string, l1: string): Promise<string> {
    const categories = ['profile', 'preferences', 'entities', 'events', 'cases', 'patterns'];

    try {
      const { results } = await this.find(userId, `${l0} ${l1}`, 5, 0, chestName);
      if (results.length > 0) {
        const topCategory = results[0].uri.split('/')[0];
        if (categories.includes(topCategory)) {
          const slug = l0.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
          return `${topCategory}/${slug}`;
        }
      }
    } catch {
      // OpenViking unavailable — fall through to keyword heuristic
    }

    const lower = l0.toLowerCase();
    let category = 'entities';
    if (lower.includes('prefer') || lower.includes('setting')) category = 'preferences';
    else if (lower.includes('profile') || lower.includes('role')) category = 'profile';
    else if (lower.includes('event') || lower.includes('meeting')) category = 'events';
    else if (lower.includes('pattern') || lower.includes('rule')) category = 'patterns';
    else if (lower.includes('bug') || lower.includes('issue')) category = 'cases';

    const slug = l0.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    return `${category}/${slug}`;
  }

  // Session operations
  async startSession(userId: string, sessionId: string): Promise<void> {
    await this.postJson('/api/v1/sessions', {
      session_id: sessionId,
    });
  }

  async appendSessionMessage(userId: string, sessionId: string, l0Summary: string): Promise<void> {
    await this.postJson(`/api/v1/sessions/${sessionId}/messages`, {
      role: 'user',
      content: l0Summary,
    });
  }

  async closeSession(userId: string, sessionId: string): Promise<void> {
    await this.postJson(`/api/v1/sessions/${sessionId}/commit`, {
      wait: true,
    });
  }
}
