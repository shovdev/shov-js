/**
 * Shov JavaScript SDK
 *
 * @version 1.0.0
 * @license MIT
 * @see https://shov.com/
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
      baseUrl: 'https://shov.com',
      ...config,
    };
  }

  private async request<T>(command: string, body: object, method: string = 'POST'): Promise<T> {
    // Handle commands that include path parameters (like forget/key or remove/id)
    const commandParts = command.split('/');
    const baseCommand = commandParts[0];
    const pathParam = commandParts[1];
    
    let url;
    if (pathParam) {
      // For commands like forget/key or remove/id, the URL should be /api/command/project/param
      url = `${this.config.baseUrl}/api/${baseCommand}/${this.config.projectName}/${pathParam}`;
    } else {
      // For regular commands, the URL is /api/command/project
      url = `${this.config.baseUrl}/api/${command}/${this.config.projectName}`;
    }

    const response = await fetch(url, {
      method,
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
    return this.request('add-many', { name: collection, items });
  }

  async where(collection: string, options?: { filter?: object; limit?: number; sort?: string }): Promise<{ items: ShovItem[] }> {
    const body: any = { name: collection };
    if (options?.filter) body.filter = options.filter;
    if (options?.limit) body.limit = options.limit;
    if (options?.sort) body.sort = options.sort;
    return this.request('where', body);
  }

  async search(query: string, options?: { collection?: string; topK?: number; minScore?: number; orgWide?: boolean; filters?: Record<string, any> }): Promise<{ items: ShovItem[] }> {
    const body: any = { query };
    if (options?.collection) body.collection = options.collection;
    if (options?.topK) body.topK = options.topK;
    if (options?.minScore) body.minScore = options.minScore;
    if (options?.orgWide) body.orgWide = options.orgWide;
    if (options?.filters) body.filters = options.filters;
    return this.request('search', body);
  }

  // Item Operations (require collection scoping)
  async update(collection: string, id: string, value: object): Promise<{ success: true }> {
    return this.request(`update/${id}`, { collection, value });
  }

  async remove(collection: string, id: string): Promise<{ success: true }> {
    return this.request(`remove/${id}`, { collection });
  }

  async clear(collection: string): Promise<{ success: true; count: number }> {
    return this.request('clear', { name: collection });
  }

  async forget(key: string): Promise<{ success: true }> {
    return this.request(`forget/${key}`, {}, 'DELETE');
  }

  async forgetFile(filename: string): Promise<{ success: true; count: number }> {
    return this.request(`forget-file/${filename}`, {}, 'DELETE');
  }

  // File Operations
  async getUploadUrl(fileName: string, mimeType?: string): Promise<{ uploadUrl: string; fileId: string; publicUrl?: string }> {
    const body: any = { fileName };
    if (mimeType) body.mimeType = mimeType;
    return this.request('upload-url', body);
  }

  async upload(file: File): Promise<{ success: true; id: string; url: string }> {
    // Get upload URL first
    const uploadUrlResponse = await this.getUploadUrl(file.name, file.type);
    const { uploadUrl, fileId, publicUrl } = uploadUrlResponse;
    
    // Upload file to the generated URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => 'Unknown error');
      throw new ShovError(`File upload failed: ${errorText}`, uploadResponse.status);
    }

    return {
      success: true,
      id: fileId,
      url: publicUrl || uploadResponse.url || uploadUrl,
    };
  }

  // Token Operations
  async createToken(
    type: string,
    data: any,
    options?: { expires_in?: number }
  ): Promise<{
    success: true;
    token: string;
    expires_in: number;
    expires_at: string;
    subscriptions?: number;
  }> {
    const body: any = { type };
    
    // Handle different token types
    if (type === 'streaming') {
      body.subscriptions = data;
    } else {
      body.data = data;
    }
    
    if (options?.expires_in) body.expires_in = options.expires_in;
    return this.request('token', body);
  }

  // Legacy method for backward compatibility
  async createStreamToken(
    subscriptions: Array<{
      collection?: string;
      key?: string;
      channel?: string;
      filters?: Record<string, any>;
    }>,
    options?: { expires_in?: number }
  ): Promise<{
    success: true;
    token: string;
    expires_in: number;
    expires_at: string;
    subscriptions: number;
  }> {
    return this.createToken('streaming', subscriptions, options);
  }

  async getContents(): Promise<{ contents: Array<{ id: string; name: string; type: string; value: any; created_at: string }> }> {
    return this.request('contents', {});
  }

  // Project-scoped Auth Operations
  /**
   * Sends a one-time password (OTP) to the given identifier (e.g., email) for this project.
   */
  async sendOtp(identifier: string): Promise<{ success: true; message: string }> {
    return this.request('send-otp', { identifier });
  }

  /**
   * Verifies a one-time password (OTP) for the given identifier for this project.
   */
  async verifyOtp(identifier: string, pin: string): Promise<{ success: boolean }> {
    return this.request('verify-otp', { identifier, pin });
  }

  // Real-time Streaming Operations
  /**
   * Broadcast a message to subscribers of a specific subscription.
   */
  async broadcast(
    subscription: {
      collection?: string;
      key?: string;
      channel?: string;
      filters?: Record<string, any>;
    },
    message: any
  ): Promise<{
    success: true;
    messageId: string;
    delivered: number;
  }> {
    return this.request('broadcast', { subscription, message });
  }

  /**
   * Subscribe to real-time updates using Server-Sent Events (SSE).
   * Returns an EventSource instance for handling the stream.
   */
  async subscribe(
    subscriptions: Array<{
      collection?: string;
      key?: string;
      channel?: string;
      filters?: Record<string, any>;
    }>,
    options?: { 
      expires_in?: number;
      onMessage?: (data: any) => void;
      onError?: (error: any) => void;
      onOpen?: () => void;
    }
  ): Promise<{
    eventSource: EventSource;
    token: string;
    close: () => void;
  }> {
    // First create a streaming token
    const tokenResponse = await this.createToken('streaming', subscriptions, {
      expires_in: options?.expires_in
    });

    // Create EventSource connection
    const subscriptionsParam = encodeURIComponent(JSON.stringify(subscriptions));
    const url = `${this.baseUrl}/subscribe/${this.projectName}?token=${tokenResponse.token}&subscriptions=${subscriptionsParam}`;
    
    const eventSource = new EventSource(url);

    // Set up event handlers
    eventSource.onopen = () => {
      options?.onOpen?.();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        options?.onMessage?.(data);
      } catch (error) {
        options?.onError?.(error);
      }
    };

    eventSource.onerror = (error) => {
      options?.onError?.(error);
    };

    return {
      eventSource,
      token: tokenResponse.token,
      close: () => {
        eventSource.close();
      }
    };
  }
}

export function createShov(config: ShovConfig): Shov {
  return new Shov(config);
}
