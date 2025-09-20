/**
 * WebSocket-based high-performance Shov client
 * Maintains persistent connection for <50ms latency after initial connection
 */

import { EventEmitter } from 'events';

// Dynamic WebSocket import for Node.js/Browser compatibility
let WebSocketImpl: typeof WebSocket | undefined;
if (typeof WebSocket !== 'undefined') {
  // Browser environment
  WebSocketImpl = WebSocket;
} else if (typeof global !== 'undefined' && typeof require !== 'undefined') {
  // Node.js environment - try to load ws package
  try {
    const ws = require('ws');
    WebSocketImpl = ws.WebSocket || ws;
  } catch (e) {
    // ws package not available
    WebSocketImpl = undefined;
  }
}

interface WebSocketMessage {
  id: string;
  command: string;
  body: any;
}

interface WebSocketResponse {
  type: 'response' | 'error' | 'ping' | 'connected' | 'batch_response';
  id?: string;
  command?: string;
  data?: any;
  error?: string;
  timestamp: number;
  duration?: number;
}

export function isWebSocketAvailable(): boolean {
  return WebSocketImpl !== undefined;
}

export class ShovWebSocket extends EventEmitter {
  private ws?: any; // Use any to support both WebSocket and ws
  private url: string;
  private apiKey: string;
  private projectName: string;
  private isConnected = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private messageQueue: WebSocketMessage[] = [];
  private pendingRequests = new Map<string, { resolve: Function; reject: Function; timer?: NodeJS.Timeout }>();
  private requestTimeout = 30000; // 30 second timeout
  private keepAliveInterval?: NodeJS.Timeout;
  private lastPingTime = 0;
  private connectionPromise?: Promise<void>;

  constructor(config: { projectName: string; apiKey: string; baseUrl?: string }) {
    super();
    this.projectName = config.projectName;
    this.apiKey = config.apiKey;
    const baseUrl = config.baseUrl || 'wss://shov.com';
    this.url = `${baseUrl}/api/ws/${this.projectName}`;
  }

  /**
   * Connect to WebSocket (auto-reconnects on failure)
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;
    if (this.isConnecting) return this.connectionPromise;

    this.isConnecting = true;
    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  private async _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!WebSocketImpl) {
          throw new Error('WebSocket not available. Install the "ws" package for Node.js support.');
        }

        // Create WebSocket with auth header
        const options = typeof window === 'undefined' 
          ? { headers: { 'Authorization': `Bearer ${this.apiKey}` } }  // Node.js with ws package
          : undefined;  // Browser doesn't support headers in constructor
        
        this.ws = new (WebSocketImpl as any)(this.url, options);

        this.ws!.onopen = () => {
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Start keep-alive
          this.startKeepAlive();
          
          // Process queued messages
          this.processQueue();
          
          this.emit('connected');
          resolve();
        };

        this.ws!.onmessage = (event: any) => {
          try {
            const message: WebSocketResponse = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws!.onerror = (error: any) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          if (this.isConnecting) {
            reject(error);
          }
        };

        this.ws!.onclose = (event: any) => {
          this.isConnected = false;
          this.isConnecting = false;
          this.stopKeepAlive();
          
          // Reject all pending requests
          for (const [id, pending] of this.pendingRequests) {
            if (pending.timer) clearTimeout(pending.timer);
            pending.reject(new Error('WebSocket connection closed'));
          }
          this.pendingRequests.clear();
          
          this.emit('disconnected', event.code, event.reason);
          
          // Auto-reconnect unless explicitly closed
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private handleMessage(message: WebSocketResponse) {
    // Handle ping/pong
    if (message.type === 'ping') {
      this.lastPingTime = message.timestamp;
      this.send({ type: 'pong', timestamp: Date.now() });
      return;
    }

    // Handle connection confirmation
    if (message.type === 'connected') {
      console.log('WebSocket connected to Shov:', message);
      return;
    }

    // Handle responses
    if (message.type === 'response' || message.type === 'error') {
      const pending = this.pendingRequests.get(message.id!);
      if (pending) {
        if (pending.timer) clearTimeout(pending.timer);
        this.pendingRequests.delete(message.id!);
        
        if (message.type === 'error') {
          pending.reject(new Error(message.error));
        } else {
          pending.resolve(message.data);
        }
      }
    }

    // Handle batch responses
    if (message.type === 'batch_response') {
      const pending = this.pendingRequests.get(message.id!);
      if (pending) {
        if (pending.timer) clearTimeout(pending.timer);
        this.pendingRequests.delete(message.id!);
        pending.resolve(message);
      }
    }
  }

  private startKeepAlive() {
    this.keepAliveInterval = setInterval(() => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        // Check if we've received a ping recently
        if (Date.now() - this.lastPingTime > 60000) {
          // No ping for 60 seconds, reconnect
          console.warn('No ping received for 60 seconds, reconnecting...');
          this.ws?.close();
          this.connect();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = undefined;
    }
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private processQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift()!;
      this.send(message);
    }
  }

  private send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Execute a command through WebSocket
   */
  async request<T>(command: string, body: any): Promise<T> {
    // Ensure connected
    if (!this.isConnected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      // Set timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout for ${command}`));
      }, this.requestTimeout);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timer });

      // Send or queue message
      const message: WebSocketMessage = { id, command, body };
      
      if (this.isConnected) {
        this.send(message);
      } else {
        this.messageQueue.push(message);
        // Try to connect if not already
        this.connect().catch(reject);
      }
    });
  }

  /**
   * Execute multiple commands in a single batch
   */
  async batch(requests: Array<{ command: string; body: any }>): Promise<any> {
    // Ensure connected
    if (!this.isConnected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      // Set timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Batch request timeout'));
      }, this.requestTimeout);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timer });

      // Prepare batch message
      const batchMessage = {
        type: 'batch',
        id,
        requests: requests.map((req, index) => ({
          id: `${id}_${index}`,
          command: req.command,
          body: req.body
        }))
      };

      if (this.isConnected) {
        this.send(batchMessage);
      } else {
        reject(new Error('Not connected'));
      }
    });
  }

  /**
   * Close the WebSocket connection
   */
  close() {
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    if (this.ws) {
      this.ws.close(1000, 'Client closing connection');
    }
    this.stopKeepAlive();
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}
