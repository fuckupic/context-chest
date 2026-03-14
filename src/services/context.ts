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

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private async request(path: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`OpenViking error: ${response.status}`);
    }
    return response.json();
  }

  async write(userId: string, relativePath: string, payload: WritePayload): Promise<void> {
    await this.request('/api/v1/write', {
      uri: this.fullUri(userId, relativePath),
      owner_space: userId,
      l0: payload.l0,
      l1: payload.l1,
    });
  }

  async find(
    userId: string,
    query: string,
    limit: number,
    offset: number = 0,
  ): Promise<{ results: SearchResult[]; total: number }> {
    const data = (await this.request('/api/v1/find', {
      query,
      scope: this.userRoot(userId),
      owner_space: userId,
      limit,
      offset,
    })) as { results: SearchResult[]; total: number };
    return { results: data.results, total: data.total };
  }

  async read(userId: string, relativePath: string): Promise<{ l0: string; l1: string }> {
    const data = (await this.request('/api/v1/read', {
      uri: this.fullUri(userId, relativePath),
      owner_space: userId,
    })) as { l0: string; l1: string };
    return data;
  }

  async delete(userId: string, relativePath: string): Promise<void> {
    await this.request('/api/v1/delete', {
      uri: this.fullUri(userId, relativePath),
      owner_space: userId,
    });
  }

  async list(userId: string, path: string, depth: number): Promise<DirectoryEntry[]> {
    const data = (await this.request('/api/v1/ls', {
      uri: this.fullUri(userId, path),
      owner_space: userId,
      depth,
    })) as { entries: DirectoryEntry[] };
    return data.entries;
  }

  async startSession(userId: string, sessionId: string): Promise<void> {
    await this.request('/api/v1/session/create', {
      session_id: sessionId,
      owner_space: userId,
      uri: `viking://user/${userId}/sessions/${sessionId}`,
    });
  }

  async appendSessionMessage(userId: string, sessionId: string, l0Summary: string): Promise<void> {
    await this.request('/api/v1/session/append', {
      session_id: sessionId,
      owner_space: userId,
      l0: l0Summary,
    });
  }

  async closeSession(userId: string, sessionId: string): Promise<void> {
    await this.request('/api/v1/session/close', {
      session_id: sessionId,
      owner_space: userId,
    });
  }
}
