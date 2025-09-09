/**
 * Shov SDK for JavaScript/TypeScript
 *
 * @version 1.0.0
 * @license MIT
 * @see https://shov.com/docs
 */

export interface ShovConfig {
  projectName: string;
  apiKey: string;
  baseUrl?: string;
}

export interface ShovItem {
  id: string;
  value: any;
  createdAt: string;
  updatedAt: string;
  _score?: number; // For vector search results
}

export class ShovError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ShovError';
  }
}

export class Shov {
  private config: Required<ShovConfig>;

  constructor(config: ShovConfig) {
    if (!config.projectName) {
      throw new ShovError('projectName is required');
    }
    if (!config.apiKey) {
      throw new ShovError('apiKey is required');
    }

    this.config = {
      baseUrl: 'https://shov-worker.domm-9cd.workers.dev',
      ...config,
    };
  }

  private async request<T>(command: string, body: object): Promise<T> {
    const url = `${this.config.baseUrl}/api/${command}/${this.config.projectName}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ShovError(data.error || 'An unknown error occurred', response.status);
    }

    return data;
  }

  // Key/Value Operations
  async set(name: string, value: any): Promise<{ success: true; id: string }> {
    return this.request('set', { name, value });
  }

  async get(name: string): Promise<ShovItem | null> {
    return this.request('get', { name });
  }

  // Collection Operations
  async add(collection: string, value: object): Promise<{ success: true; id: string }> {
    return this.request('add', { name: collection, value });
  }

  async addMany(collection: string, items: object[]): Promise<{ success: true; ids: string[] }> {
    return this.request('addmany', { name: collection, items });
  }

  async list(collection: string): Promise<{ items: ShovItem[] }> {
    return this.request('list', { name: collection });
  }

  async find(collection: string, filter: object): Promise<{ items: ShovItem[] }> {
    return this.request('find', { name: collection, filter });
  }

  async search(collection: string, query: string, topK: number = 5): Promise<{ items: ShovItem[] }> {
    return this.request('search', { name: collection, query, topK });
  }

  // Item Operations
  async update(id: string, value: object): Promise<{ success: true }> {
    return this.request('update', { id, value });
  }

  async delete(id: string): Promise<{ success: true }> {
    return this.request('delete', { id });
  }

  // File Operations
  async getUploadUrl(fileName: string, contentType: string): Promise<{ success: true; url: string; method: 'PUT'; id: string }> {
    return this.request('upload-url', { fileName, contentType });
  }

  // Note: Direct file upload is not implemented in the SDK as it's best handled
  // in a Node.js environment with fs access or directly from a browser with the pre-signed URL.
  // We can add a Node-specific SDK later if needed.

  // Auth Operations
  async issueOtp(identifier: string, digits: 4 | 6 = 6): Promise<{ success: true }> {
    return this.request('otp_issue', { identifier, digits });
  }

  async verifyOtp(identifier: string, pin: string): Promise<{ success: true }> {
    return this.request('otp_verify', { identifier, pin });
  }
}

export function createShov(config: ShovConfig): Shov {
  return new Shov(config);
}
