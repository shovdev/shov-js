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
    const url = `${this.config.baseUrl}/api/${command}/${this.config.projectName}`;

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

  async search(query: string, options?: { collection?: string; topK?: number; minScore?: number; orgWide?: boolean }): Promise<{ items: ShovItem[] }> {
    const body: any = { query };
    if (options?.collection) body.collection = options.collection;
    if (options?.topK) body.topK = options.topK;
    if (options?.minScore) body.minScore = options.minScore;
    if (options?.orgWide) body.orgWide = options.orgWide;
    return this.request('search', body);
  }

  // Item Operations (require collection scoping)
  async update(collection: string, id: string, value: object): Promise<{ success: true }> {
    return this.request(`update/${id}`, { collection, value });
  }

  async remove(collection: string, id: string): Promise<{ success: true }> {
    return this.request(`remove/${id}`, { collection });
  }

  async forget(key: string): Promise<{ success: true }> {
    return this.request(`forget/${key}`, {}, 'DELETE');
  }

  async forgetFile(filename: string): Promise<{ success: true; count: number }> {
    return this.request(`forget-file/${filename}`, {}, 'DELETE');
  }

  // File Operations
  async getUploadUrl(fileName: string, mimeType?: string): Promise<{ uploadUrl: string; fileId: string }> {
    const body: any = { fileName };
    if (mimeType) body.mimeType = mimeType;
    return this.request('upload-url', body);
  }

  async upload(file: File): Promise<{ success: true; id: string; url: string }> {
    // Get upload URL first
    const { uploadUrl, fileId } = await this.getUploadUrl(file.name, file.type);
    
    // Upload file to the generated URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new ShovError('File upload failed', uploadResponse.status);
    }

    return {
      success: true,
      id: fileId,
      url: uploadResponse.url || uploadUrl,
    };
  }

  async deleteFile(fileId: string): Promise<{ success: true }> {
    return this.request(`files-delete/${fileId}`, {}, 'DELETE');
  }

  async listFiles(): Promise<{ files: Array<{ id: string; filename: string; mime_type: string; size: number; status: string; created_at: string; uploaded_at?: string }> }> {
    return this.request('files-list', {});
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
}

export function createShov(config: ShovConfig): Shov {
  return new Shov(config);
}
