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

  private userRoot(userId: string): string {
    return `viking://user/${userId}/memories`;
  }

  private fullUri(userId: string, relativePath: string): string {
    return `${this.userRoot(userId)}/${relativePath}`;
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
  async write(userId: string, relativePath: string, payload: WritePayload): Promise<void> {
    const uri = this.fullUri(userId, relativePath);
    // Use the resources endpoint to add content
    // OpenViking treats resources as files that get indexed
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
  ): Promise<{ results: SearchResult[]; total: number }> {
    const data = (await this.postJson('/api/v1/search/find', {
      query,
      target_uri: this.userRoot(userId),
      limit,
    })) as { results?: Array<{ uri?: string; abstract?: string; overview?: string; score?: number }>; total?: number };

    const results: SearchResult[] = (data.results ?? []).map((r) => ({
      uri: (r.uri ?? '').replace(this.userRoot(userId) + '/', ''),
      l0: r.abstract ?? '',
      l1: r.overview ?? '',
      score: r.score ?? 0,
    }));

    return { results: results.slice(offset), total: data.total ?? results.length };
  }

  // Read content metadata
  async read(userId: string, relativePath: string): Promise<{ l0: string; l1: string }> {
    const uri = this.fullUri(userId, relativePath);
    const data = (await this.getJson('/api/v1/content/read', { uri })) as {
      content?: string;
      abstract?: string;
      overview?: string;
    };
    return { l0: data.abstract ?? '', l1: data.overview ?? data.content ?? '' };
  }

  // Delete a resource
  async delete(userId: string, relativePath: string): Promise<void> {
    const uri = this.fullUri(userId, relativePath);
    await this.deleteRequest('/api/v1/fs', { uri, recursive: 'true' });
  }

  // List directory contents
  async list(userId: string, path: string, depth: number): Promise<DirectoryEntry[]> {
    const uri = this.fullUri(userId, path);
    const data = (await this.getJson('/api/v1/fs/ls', {
      uri,
      recursive: depth > 1 ? 'true' : 'false',
      simple: 'true',
      limit: '100',
    })) as { entries?: Array<{ uri?: string; name?: string; type?: string; abstract?: string }> };

    return (data.entries ?? []).map((e) => ({
      uri: (e.uri ?? e.name ?? '').replace(this.userRoot(userId) + '/', ''),
      l0: e.abstract ?? '',
      type: (e.type === 'directory' ? 'directory' : 'file') as 'file' | 'directory',
    }));
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
