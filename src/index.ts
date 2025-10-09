/**
 * Shov JavaScript SDK
 *
 * @version 2.0.0
 * @license MIT
 * @see https://shov.com/
 */

export interface ShovConfig {
  projectName: string;
  apiKey: string;
  baseUrl?: string;
  useWebSocket?: boolean; // Enable WebSocket mode for <50ms latency
  useHTTP3?: boolean;     // Enable experimental HTTP/3 QUIC for Node.js
}

export interface ShovItem {
  id: string;
  value: any;
  createdAt: string;
  updatedAt: string;
  _score?: number; // For vector search results
}

// Advanced filter operators for JSON field filtering
export interface FilterOperators {
  $gt?: any;           // Greater than
  $gte?: any;          // Greater than or equal
  $lt?: any;           // Less than
  $lte?: any;          // Less than or equal
  $ne?: any;           // Not equal
  $in?: any[];         // In array
  $nin?: any[];        // Not in array
  $between?: [any, any]; // Between two values
  $like?: string;      // SQL LIKE pattern
  $ilike?: string;     // Case-insensitive LIKE pattern
  $regex?: string;     // GLOB pattern matching
  $exists?: boolean;   // Field exists (true) or is null (false)
}

// Logical operators for combining filters
export interface LogicalOperators {
  $or?: FilterObject[];  // OR logic - any of the conditions must match
  $and?: FilterObject[]; // AND logic - all conditions must match
}

// Complete filter object that can contain field filters and logical operators
export interface FilterObject extends LogicalOperators {
  [field: string]: FilterValue | FilterObject[] | undefined;
}

// Blocks system interfaces
export interface Block {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  isOfficial: boolean;
  isPublic: boolean;
  latestVersion: string;
  createdAt: string;
  updatedAt: string;
  totalDeployments: number;
  totalLikes: number;
  totalForks: number;
  author: {
    name: string;
    slug: string;
    isOfficial: boolean;
  };
}

export interface BlockVersion {
  version: string;
  versionNumber: number;
  readme?: string;
  changelog?: string;
  createdAt: string;
}

export interface BlockFunction {
  name: string;
  description?: string;
  code: string;
  methods: string[];
  path?: string;
  expectedPayload?: any;
  responseSchema?: any;
}

export interface BlockSecret {
  name: string;
  description?: string;
  required: boolean;
  defaultValue?: string;
}

export interface BlockCollection {
  name: string;
  description?: string;
  schema?: any;
}

export interface BlockDetail extends Block {
  version: BlockVersion;
  functions: BlockFunction[];
  secrets: BlockSecret[];
  collections: BlockCollection[];
}

// Filter can be direct values or operator objects
export type FilterValue = any | FilterOperators;
export type Filters = Record<string, FilterValue>;

export class ShovError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ShovError';
  }
}

// Import WebSocket client
import { ShovWebSocket } from './websocket';

export class Shov {
  private config: Required<ShovConfig>;
  private agent?: any; // HTTP agent for connection pooling
  private http3Client?: any; // HTTP/3 client for Node.js experimental support
  private requestQueue: Array<() => Promise<any>> = []; // Request queue for pipelining
  private isProcessingQueue = false;
  private pendingRequests = new Map<string, Promise<any>>(); // Deduplication map
  private requestCache = new Map<string, { data: any; timestamp: number }>(); // Request cache
  private readonly CACHE_TTL = 5000; // 5 second cache for reads
  private wsClient?: ShovWebSocket; // WebSocket client for persistent connection

  // Namespaced APIs
  public auth: {
    sendOtp: (identifier: string) => Promise<{ success: true; message: string }>;
    verifyOtp: (identifier: string, pin: string) => Promise<{ success: boolean }>;
  };

  public files: {
    upload: (file: File) => Promise<{ success: true; id: string; url: string }>;
    uploadUrl: (fileName: string, mimeType?: string) => Promise<{ uploadUrl: string; fileId: string; publicUrl?: string }>;
    list: () => Promise<{ success: true; files: Array<{ id: string; filename: string; mime_type: string; size: number; status: string; created_at: string; uploaded_at: string }> }>;
    forget: (filename: string) => Promise<{ success: true; count: number }>;
  };

  public code: {
    write: (name: string, code: string, options?: { description?: string }) => Promise<{ success: true; name: string; url: string; version: number }>;
    read: (name: string) => Promise<{ success: true; code: string; name: string; deployedAt: string }>;
    list: () => Promise<{ success: true; functions: Array<{ name: string; url: string; size: string; deployedAt: string; version?: number }> }>;
    delete: (name: string) => Promise<{ success: true; message: string }>;
    rollback: (name: string, version?: number) => Promise<{ success: true; message: string; currentVersion: number; rolledBackToVersion: number }>;
    logs: (name: string, options?: { follow?: boolean; limit?: number }) => Promise<{ success: true; logs: Array<{ timestamp: string; level: string; message: string; metadata?: any }> }>;
  };

  public secrets: {
    list: () => Promise<{ success: true; secrets: Array<{ name: string; createdAt: string; updatedAt: string }> }>;
    set: (name: string, value: string, options?: { functions?: string }) => Promise<{ success: true; message: string }>;
    setMany: (secrets: Array<{ name: string; value: string }>, options?: { functions?: string }) => Promise<{ success: true; count: number; message: string }>;
    delete: (name: string, options?: { functions?: string }) => Promise<{ success: true; message: string }>;
  };

  public streaming: {
    broadcast: (subscription: { collection?: string; key?: string; channel?: string; filters?: Record<string, any> }, message: any) => Promise<{ success: true; messageId: string; delivered: number }>;
    subscribe: (subscriptions: Array<{ collection?: string; key?: string; channel?: string; filters?: Record<string, any> }>, options?: { expires_in?: number; onMessage?: (data: any) => void; onError?: (error: any) => void; onOpen?: () => void }) => Promise<{ eventSource: EventSource; token: string; close: () => void }>;
    token: (subscriptions: Array<{ collection?: string; key?: string; channel?: string; filters?: Record<string, any> }>, options?: { expires_in?: number }) => Promise<{ success: true; token: string; expiresAt: string }>;
  };

  public events: {
    track: (eventName: string, properties?: Record<string, any>, options?: { environment?: string }) => Promise<{ success: true; eventId: string }>;
    query: (options: { event?: string; environment?: string; filters?: Record<string, any>; timeRange?: string; limit?: number }) => Promise<{ success: true; events: Array<any>; total: number }>;
    tail: (options: { event?: string; limit?: number; follow?: boolean }) => Promise<{ success: true; events: Array<any> }>;
  };

  constructor(config: ShovConfig) {
    if (!config.projectName) {
      throw new ShovError('projectName is required');
    }
    if (!config.apiKey) {
      throw new ShovError('apiKey is required');
    }

    this.config = {
      baseUrl: 'https://shov.com',
      useWebSocket: false,
      useHTTP3: false,
      ...config,
    };

    // Initialize WebSocket client if enabled
    if (this.config.useWebSocket) {
      try {
        this.wsClient = new ShovWebSocket({
          projectName: this.config.projectName,
          apiKey: this.config.apiKey,
          baseUrl: this.config.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://')
        });
        // Pre-connect for better performance
        this.wsClient.connect().catch(err => {
          console.warn('WebSocket pre-connect failed, will retry on first request:', err);
          // Don't disable WebSocket here, let it retry on actual requests
        });
      } catch (e) {
        console.warn('WebSocket not available:', (e as Error).message);
        this.wsClient = undefined;
      }
    }

    // Initialize HTTP/3 client for Node.js experimental support
    if (this.config.useHTTP3 && !this.config.useWebSocket && typeof window === 'undefined') {
      try {
        // Try to load Node.js experimental HTTP/3 module
        const http3 = eval('require')('node:http3');
        this.http3Client = http3.connect(this.config.baseUrl, {
          rejectUnauthorized: true,
          // HTTP/3 specific options
          maxHeaderListSize: 65536,
          maxHeaderSize: 16384,
        });
        console.log('🚀 HTTP/3 QUIC client initialized');
      } catch (e) {
        console.warn('HTTP/3 not available, falling back to HTTP/2:', (e as Error).message);
        this.http3Client = undefined;
      }
    }

    // Initialize HTTP agent for connection pooling (Node.js only)
    if (!this.config.useWebSocket && !this.http3Client && typeof window === 'undefined') {
      try {
        const https = eval('require')('https');
        this.agent = new https.Agent({
          keepAlive: true,
          keepAliveMsecs: 30000, // 30 seconds
          maxSockets: 50,        // Max concurrent connections
          maxFreeSockets: 10,    // Keep 10 connections open
          timeout: 60000,        // 60 second timeout
          scheduling: 'fifo'     // First in, first out
        });
      } catch (e) {
        // Fallback for environments without https module
        this.agent = undefined;
      }
    }

    // Initialize namespaced APIs - these are the ONLY public API methods
    this.auth = {
      sendOtp: (identifier: string) => this.request('send-otp', { identifier }),
      verifyOtp: (identifier: string, pin: string) => this.request('verify-otp', { identifier, pin }),
    };

    this.files = {
      upload: this.upload.bind(this),
      uploadUrl: this.getUploadUrl.bind(this),
      list: this.listFiles.bind(this),
      forget: this.forgetFile.bind(this),
    };

    this.code = {
      write: (name: string, code: string, config?: { timeout?: number; description?: string }) => 
        this.request('code-write', { name, code, config: { timeout: 10000, description: `Code function: ${name}`, ...config } }),
      read: (name: string) => this.request('code-read', { name }),
      list: () => this.request('code-list', {}),
      delete: (name: string) => this.request('code-delete', { name }),
      rollback: (name: string, version?: number) => this.request('code-rollback', { name, version }),
      logs: (functionName?: string) => this.request('code-logs', { functionName }),
    };

    this.secrets = {
      list: () => this.request('secrets-list', {}),
      set: (name: string, value: string, functions?: string[]) => 
        this.request('secrets-set', { name, value, functions: functions || [] }),
      setMany: (secrets: Array<{ name: string; value: string }>, functions?: string[]) => 
        this.request('secrets-set-many', { secrets, functions: functions || [] }),
      delete: (name: string, functions?: string[]) => 
        this.request('secrets-delete', { name, functions: functions || [] }),
    };

    this.streaming = {
      broadcast: (subscription: { collection?: string; key?: string; channel?: string; filters?: Record<string, any> }, message: any) =>
        this.request('broadcast', { subscription, message }),
      subscribe: async (subscriptions: Array<{ collection?: string; key?: string; channel?: string; filters?: Record<string, any> }>, options?: { expires_in?: number; onMessage?: (data: any) => void; onError?: (error: any) => void; onOpen?: () => void }) => {
        const tokenResponse = await this.createToken('streaming', subscriptions, { expires_in: options?.expires_in });
        const subscriptionsParam = encodeURIComponent(JSON.stringify(subscriptions));
        const url = `${this.config.baseUrl}/api/subscribe/${this.config.projectName}?token=${tokenResponse.token}&subscriptions=${subscriptionsParam}`;
        const eventSource = new EventSource(url);
        eventSource.onopen = () => options?.onOpen?.();
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            options?.onMessage?.(data);
          } catch (error) {
            options?.onError?.(error);
          }
        };
        eventSource.onerror = (error) => options?.onError?.(error);
        return { eventSource, token: tokenResponse.token, close: () => eventSource.close() };
      },
      token: this.createStreamToken.bind(this),
    };

    this.events = {
      track: this.eventsTrack.bind(this),
      query: this.eventsQuery.bind(this),
      tail: this.eventsTail.bind(this),
    };
  }

  // Warm up connections for better performance
  async warmup(): Promise<void> {
    try {
      // Make a lightweight request to establish connection
      // Use where with a limit of 0 to avoid fetching any data
      await this.where('__warmup__', { limit: 0 });
    } catch (e) {
      // Expected to fail, we just want to establish the connection
    }
  }

  /**
   * Invalidate cache entries that might be affected by write operations
   */
  private invalidateCache(command: string, body: any): void {
    const commandParts = command.split('/');
    const baseCommand = commandParts[0];
    const pathParam = commandParts[1];

    // For key operations (set, forget), invalidate get cache for that key
    if (baseCommand === 'set' || baseCommand === 'forget') {
      const keyName = pathParam || (body as any).name;
      if (keyName) {
        const getCacheKey = `get:${JSON.stringify({ name: keyName })}`;
        this.requestCache.delete(getCacheKey);
        console.log(`🗑️ Invalidated SDK cache for key: ${keyName}`);
      }
    }

    // For collection operations (add, update, remove, clear), clear entire cache to be safe
    if (['add', 'update', 'remove', 'clear'].includes(baseCommand)) {
      const collectionName = (body as any).collection;
      if (collectionName) {
        // Clear entire cache for collection operations to prevent any stale data
        // This is more aggressive but ensures consistency
        const cacheSize = this.requestCache.size;
        this.requestCache.clear();
        console.log(`🗑️ Cleared entire SDK cache (${cacheSize} entries) for collection operation: ${collectionName}`);
      }
    }

    // For batch operations, invalidate based on the operations in the batch
    if (baseCommand === 'batch' && (body as any).operations) {
      const operations = (body as any).operations;
      for (const op of operations) {
        // Recursively invalidate for each operation in the batch
        this.invalidateCache(op.type, op);
      }
    }
  }

  private async request<T>(command: string, body: object, method: string = 'POST'): Promise<T> {
    // Request deduplication for identical requests
    const requestKey = `${command}:${method}:${JSON.stringify(body)}`;
    if (this.pendingRequests.has(requestKey)) {
      console.log(`🔄 Deduplicating request: ${command}`);
      return await this.pendingRequests.get(requestKey)!;
    }

    // Use WebSocket if available for ultra-low latency
    if (this.wsClient) {
      try {
        const wsPromise = this.wsClient.request<T>(command, body);
        this.pendingRequests.set(requestKey, wsPromise);
        const result = await wsPromise;
        this.pendingRequests.delete(requestKey);
        return result;
      } catch (error) {
        this.pendingRequests.delete(requestKey);
        console.warn('WebSocket request failed, falling back to HTTP:', error);
        // Fall through to HTTP
      }
    }

    // Check cache for read operations (HTTP only, WebSocket is fast enough)
    const cacheKey = `${command}:${JSON.stringify(body)}`;
    const isReadOperation = ['get', 'where', 'search', 'count'].some(op => command.startsWith(op));
    const isWriteOperation = ['set', 'add', 'update', 'forget', 'remove', 'clear', 'batch'].some(op => command.startsWith(op));
    
    if (isReadOperation && method === 'POST') {
      const cached = this.requestCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

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

    const fetchOptions: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Accept-Encoding': 'gzip, deflate, br', // Enable compression
        'Connection': 'keep-alive', // Explicit keep-alive
        'User-Agent': 'shov-js/2.1.0 (V3-Optimized+HTTP3)', // Identify V3 optimized version
        'Cache-Control': 'no-cache', // Ensure fresh data for writes
        'CF-Cache-Status': 'DYNAMIC', // Hint to Cloudflare for dynamic content
        'CF-Worker': 'v3-optimized' // Help CF route to optimized workers
      },
      body: JSON.stringify(body),
      // Additional fetch optimizations
      keepalive: true, // Enable keep-alive at fetch level
      signal: AbortSignal.timeout(30000), // 30 second timeout
    };

    // Use HTTP/3 if available (Node.js experimental)
    if (this.http3Client) {
      try {
        return await this.makeHTTP3Request<T>(url, fetchOptions, cacheKey, isReadOperation);
      } catch (error) {
        console.warn('HTTP/3 request failed, falling back to HTTP/2:', error);
        // Fall through to regular HTTP
      }
    }

    // Use HTTP agent for connection pooling in Node.js
    if (this.agent) {
      fetchOptions.agent = this.agent;
    }

    // Create HTTP request promise and add to deduplication map
    const httpPromise = (async () => {
      try {
        const response = await fetch(url, fetchOptions);
        const data = await response.json();

        if (!response.ok) {
          throw new ShovError(data.error || 'An unknown error occurred', response.status);
        }

        return data;
      } finally {
        // Clean up deduplication map
        this.pendingRequests.delete(requestKey);
      }
    })();

    this.pendingRequests.set(requestKey, httpPromise);
    const data = await httpPromise;

    // Cache successful read operations
    if (isReadOperation && method === 'POST') {
      this.requestCache.set(cacheKey, { data, timestamp: Date.now() });
      
      // Clean up old cache entries (simple LRU)
      if (this.requestCache.size > 100) {
        const oldestKey = this.requestCache.keys().next().value;
        if (oldestKey) {
          this.requestCache.delete(oldestKey);
        }
      }
    }

    // Invalidate cache for write operations to prevent stale reads
    if (isWriteOperation) {
      this.invalidateCache(command, body);
    }

    return data;
  }

  private async makeHTTP3Request<T>(url: string, fetchOptions: any, cacheKey: string, isReadOperation: boolean): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(url);
        const path = urlObj.pathname + (urlObj.search || '');
        
        const req = this.http3Client.request({
          ':method': fetchOptions.method,
          ':path': path,
          ':scheme': 'https',
          ':authority': urlObj.host,
          'content-type': fetchOptions.headers['Content-Type'],
          'authorization': fetchOptions.headers['Authorization'],
          'accept-encoding': fetchOptions.headers['Accept-Encoding'],
          'user-agent': fetchOptions.headers['User-Agent'],
        });

        let responseData = '';
        let statusCode = 200;

        req.on('response', (headers: any) => {
          statusCode = parseInt(headers[':status']) || 200;
        });

        req.on('data', (chunk: any) => {
          responseData += chunk.toString();
        });

        req.on('end', () => {
          try {
            const data = JSON.parse(responseData);
            
            if (statusCode >= 400) {
              reject(new ShovError(data.error || 'HTTP/3 request failed', statusCode));
              return;
            }

            // Cache successful read operations
            if (isReadOperation && fetchOptions.method === 'POST') {
              this.requestCache.set(cacheKey, { data, timestamp: Date.now() });
              
              // Clean up old cache entries (simple LRU)
              if (this.requestCache.size > 100) {
                const oldestKey = this.requestCache.keys().next().value;
                if (oldestKey) {
                  this.requestCache.delete(oldestKey);
                }
              }
            }

            resolve(data);
          } catch (parseError) {
            reject(new ShovError('Failed to parse HTTP/3 response', 500));
          }
        });

        req.on('error', (error: Error) => {
          reject(new ShovError(`HTTP/3 request error: ${error.message}`, 500));
        });

        // Send the request body
        if (fetchOptions.body) {
          req.write(fetchOptions.body);
        }
        req.end();

      } catch (error) {
        reject(new ShovError(`HTTP/3 setup error: ${(error as Error).message}`, 500));
      }
    });
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

  async upsert(collection: string, matchFields: object, data: object, options?: { insertOnly?: boolean }): Promise<{ success: true; id: string; created: boolean; updated: boolean }> {
    const body: any = { collection, matchFields, data };
    if (options?.insertOnly) body.insertOnly = options.insertOnly;
    return this.request('upsert', body);
  }

  async where(collection: string, options?: { filter?: FilterObject; limit?: number; sort?: string }): Promise<{ items: ShovItem[] }> {
    const body: any = { name: collection };
    if (options?.filter) body.filter = options.filter;
    if (options?.limit) body.limit = options.limit;
    if (options?.sort) body.sort = options.sort;
    return this.request('where', body);
  }

  async count(collection: string, options?: { filter?: FilterObject }): Promise<{ success: true; count: number; collection: string }> {
    const body: any = { name: collection };
    if (options?.filter) body.filter = options.filter;
    return this.request('count', body);
  }

  async search(query: string, options?: { collection?: string; topK?: number; minScore?: number; orgWide?: boolean; filters?: FilterObject }): Promise<{ items: ShovItem[] }> {
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

  // Batch Operations
  async batch(operations: Array<{
    type: 'set' | 'get' | 'add' | 'upsert' | 'update' | 'remove' | 'forget' | 'clear';
    name?: string;
    collection?: string;
    id?: string;
    matchFields?: object;
    data?: any;
    value?: any;
    excludeFromVector?: boolean;
    insertOnly?: boolean;
  }>): Promise<{
    success: true;
    results: Array<{ success: boolean; id?: string; operation: string; error?: string }>;
    transactionId: string;
    operationsExecuted: number;
  }> {
    if (!Array.isArray(operations)) {
      throw new ShovError('Operations must be an array');
    }
    
    if (operations.length === 0) {
      throw new ShovError('Operations array cannot be empty');
    }
    
    if (operations.length > 50) {
      throw new ShovError('Maximum 50 operations allowed per batch');
    }

    return this.request('batch', { operations });
  }

  async forget(key: string): Promise<{ success: true }> {
    return this.request(`forget/${key}`, {}, 'DELETE');
  }

  async forgetFile(filename: string): Promise<{ success: true; count: number }> {
    return this.request(`forget-file/${filename}`, {}, 'DELETE');
  }

  async listFiles(): Promise<{ success: true; files: Array<{ id: string; filename: string; mime_type: string; size: number; status: string; created_at: string; uploaded_at: string }> }> {
    return this.request('files-list', {});
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
    
    // Token endpoint requires API key in body (not header)
    body.api_key = this.config.apiKey;
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
    subscriptions?: number;
  }> {
    return this.createToken('streaming', subscriptions, options);
  }

  async getContents(): Promise<{ contents: Array<{ id: string; name: string; type: string; value: any; created_at: string }> }> {
    return this.request('contents', {});
  }

  /**
   * @deprecated Use shov.auth.sendOtp() instead. Direct methods are removed in favor of namespaced API.
   * @throws {Error} Always throws - use namespaced API
   */
  async sendOtp(): Promise<never> {
    throw new ShovError('sendOtp() is removed. Use shov.auth.sendOtp() instead.');
  }

  /**
   * @deprecated Use shov.auth.verifyOtp() instead. Direct methods are removed in favor of namespaced API.
   * @throws {Error} Always throws - use namespaced API
   */
  async verifyOtp(): Promise<never> {
    throw new ShovError('verifyOtp() is removed. Use shov.auth.verifyOtp() instead.');
  }

  /**
   * @deprecated Use shov.streaming.broadcast() instead. Direct methods are removed in favor of namespaced API.
   * @throws {Error} Always throws - use namespaced API
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
    throw new ShovError('broadcast() is removed. Use shov.streaming.broadcast() instead.');
  }

  /**
   * @deprecated Use shov.streaming.subscribe() instead. Direct methods are removed in favor of namespaced API.
   * @throws {Error} Always throws - use namespaced API
   */
  async subscribe(): Promise<never> {
    throw new ShovError('subscribe() is removed. Use shov.streaming.subscribe() instead.');
  }

  // All code functions, secrets, and streaming methods have been moved to namespaces
  // Use shov.code.*, shov.secrets.*, and shov.streaming.* instead

  // ============================================================================
  // BLOCKS MANAGEMENT
  // ============================================================================

  /**
   * List available blocks with optional filtering.
   */
  async listBlocks(options?: {
    category?: string;
    author?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    success: true;
    blocks: Block[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.author) params.append('author', options.author);
    if (options?.search) params.append('search', options.search);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    
    // Use a custom command for blocks list since it's a GET request with params
    return this.request('blocks-list', options || {}, 'GET');
  }

  /**
   * Get details of a specific block.
   */
  async getBlock(
    slug: string,
    version?: string
  ): Promise<{
    success: true;
    block: BlockDetail;
  }> {
    const params = new URLSearchParams();
    if (version) params.append('version', version);
    
    return this.request('blocks-get', { slug, version }, 'GET');
  }

  /**
   * Deploy a block to your project.
   */
  async deployBlock(
    slug: string,
    options?: {
      version?: string;
      project?: string;
    }
  ): Promise<{
    success: true;
    message: string;
    functionsDeployed: string[];
    secretsCreated: string[];
    deploymentId: string;
  }> {
    const params = new URLSearchParams();
    if (options?.version) params.append('version', options.version);
    if (options?.project) params.append('project', options.project);
    
    return this.request('blocks-deploy', { slug, ...options }, 'POST');
  }

  /**
   * Create a new block.
   */
  async createBlock(data: {
    slug: string;
    name: string;
    description?: string;
    category: string;
    organizationId: string;
    readme?: string;
    functions?: BlockFunction[];
    secrets?: BlockSecret[];
    collections?: BlockCollection[];
    version?: string;
  }): Promise<{
    success: true;
    blockId: string;
    slug: string;
    version: string;
    message: string;
  }> {
    return this.request('blocks-create', data, 'POST');
  }

  /**
   * Get version history of a block.
   */
  async getBlockVersions(slug: string): Promise<{
    success: true;
    versions: BlockVersion[];
    latestVersion: string;
  }> {
    return this.request('blocks-versions', { slug }, 'GET');
  }

  /**
   * Like or unlike a block.
   */
  async toggleBlockLike(slug: string): Promise<{
    success: true;
    liked: boolean;
    totalLikes: number;
  }> {
    return this.request('blocks-like', { slug }, 'POST');
  }

  /**
   * Add a comment to a block.
   */
  async addBlockComment(
    slug: string,
    comment: string
  ): Promise<{
    success: true;
    commentId: string;
    message: string;
  }> {
    return this.request('blocks-comment', { slug, comment }, 'POST');
  }

  // Events API Methods
  
  /**
   * Track a custom event
   * @param eventName - Name of the event to track
   * @param properties - Optional properties object
   * @param options - Optional configuration (environment)
   * @returns Promise with event ID and success status
   */
  async eventsTrack(
    eventName: string,
    properties: Record<string, any> = {},
    options: { environment?: string } = {}
  ): Promise<{
    success: boolean;
    eventId: string;
  }> {
    return this.request('events-track', {
      event: eventName,
      properties,
      environment: options.environment || 'production'
    }, 'POST');
  }

  /**
   * Query historical events
   * @param options - Query options including filters, time range, and limit
   * @returns Promise with array of events and metadata
   */
  async eventsQuery(options: {
    filters?: Record<string, any>;
    timeRange?: '1h' | '6h' | '12h' | '24h' | '7d' | '30d';
    limit?: number;
    eventName?: string;
    environment?: string;
  } = {}): Promise<{
    success: boolean;
    events: Array<{
      eventId: string;
      eventName: string;
      properties: Record<string, any>;
      timestamp: number;
      projectId: string;
      environment: string;
    }>;
    sources: {
      kv: number;
      analytics: number;
      total: number;
    };
  }> {
    return this.request('events-query', {
      filters: options.filters || {},
      timeRange: options.timeRange || '24h',
      limit: options.limit || 100,
      eventName: options.eventName,
      environment: options.environment
    }, 'POST');
  }

  /**
   * Tail recent events in real-time (past 60 seconds)
   * @param options - Tail options including event filter and limit
   * @returns Promise with array of recent events
   */
  async eventsTail(options: {
    event?: string;
    limit?: number;
  } = {}): Promise<{
    success: boolean;
    events: Array<{
      eventId: string;
      eventName: string;
      properties: Record<string, any>;
      timestamp: number;
      projectId: string;
      organizationId: string;
      environment: string;
    }>;
    count: number;
  }> {
    const params = new URLSearchParams();
    if (options.event) params.append('event', options.event);
    if (options.limit) params.append('limit', options.limit.toString());
    
    const url = `/events/${this.config.projectName}/tail${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(`${this.config.baseUrl}${url}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to tail events' }));
      throw new ShovError(error.error || 'Failed to tail events', response.status);
    }
    
    return response.json();
  }

  /**
   * Convenience namespace for events API
   */
  events = {
    /**
     * Track a custom event
     */
    track: (eventName: string, properties: Record<string, any> = {}, options: { environment?: string } = {}) => 
      this.eventsTrack(eventName, properties, options),
    
    /**
     * Query historical events
     */
    query: (options: {
      filters?: Record<string, any>;
      timeRange?: '1h' | '6h' | '12h' | '24h' | '7d' | '30d';
      limit?: number;
      eventName?: string;
      environment?: string;
    } = {}) => this.eventsQuery(options),
    
    /**
     * Tail recent events
     */
    tail: (options: { event?: string; limit?: number } = {}) => 
      this.eventsTail(options)
  };
}

export function createShov(config: ShovConfig): Shov {
  return new Shov(config);
}
