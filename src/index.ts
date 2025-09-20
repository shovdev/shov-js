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
  private requestCache = new Map<string, { data: any; timestamp: number }>(); // Request cache
  private readonly CACHE_TTL = 5000; // 5 second cache for reads
  private wsClient?: ShovWebSocket; // WebSocket client for persistent connection

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
        const http3 = require('node:http3');
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
        const https = require('https');
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

  private async request<T>(command: string, body: object, method: string = 'POST'): Promise<T> {
    // Use WebSocket if available for ultra-low latency
    if (this.wsClient) {
      try {
        return await this.wsClient.request<T>(command, body);
      } catch (error) {
        console.warn('WebSocket request failed, falling back to HTTP:', error);
        // Fall through to HTTP
      }
    }

    // Check cache for read operations (HTTP only, WebSocket is fast enough)
    const cacheKey = `${command}:${JSON.stringify(body)}`;
    const isReadOperation = ['get', 'where', 'search', 'count'].some(op => command.startsWith(op));
    
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
        'User-Agent': 'shov-js/2.0.0 (WebSocket+HTTP3)', // Identify optimized version
      },
      body: JSON.stringify(body),
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

    const response = await fetch(url, fetchOptions);

    const data = await response.json();

    if (!response.ok) {
      throw new ShovError(data.error || 'An unknown error occurred', response.status);
    }

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

        req.on('data', (chunk: Buffer) => {
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
    type: 'set' | 'get' | 'add' | 'update' | 'remove' | 'forget' | 'clear';
    name?: string;
    collection?: string;
    id?: string;
    value?: any;
    excludeFromVector?: boolean;
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
    const url = `${this.config.baseUrl}/api/subscribe/${this.config.projectName}?token=${tokenResponse.token}&subscriptions=${subscriptionsParam}`;
    
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
