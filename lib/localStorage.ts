/**
 * localStorage utility functions for handling upload queue persistence
 */

export type SerializableUploadItem = {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileLastModified: number;
  progress: number; // 0..100
  status: 'queued' | 'reserving' | 'ready' | 'uploading' | 'success' | 'error' | 'canceled';
  error?: string;

  // reserved target info
  remoteId?: string;
  uploadUrl?: string;
  method?: "PUT" | "POST";
};

export type SerializableUploadsState = Record<string, SerializableUploadItem>;

/**
 * Safe localStorage operations with error handling
 */
export const uploadsStorage = {
  /**
   * Get item from localStorage with fallback to initial value
   */
  getItem: (key: string, initialValue: SerializableUploadsState): SerializableUploadsState => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
      return initialValue;
    }
  },

  /**
   * Set item in localStorage with error handling
   */
  setItem: (key: string, value: SerializableUploadsState): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to write to localStorage:', error);
    }
  },

  /**
   * Remove item from localStorage with error handling
   */
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  },

  /**
   * Clear all items from localStorage with error handling
   */
  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  },

  /**
   * Check if localStorage is available
   */
  isAvailable: (): boolean => {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * File cache for storing actual File objects (not persisted across page refreshes)
 * This is separate from localStorage since File objects cannot be serialized
 */
export class FileCache {
  private cache = new Map<string, File>();

  /**
   * Store a file in the cache
   */
  set(id: string, file: File): void {
    this.cache.set(id, file);
  }

  /**
   * Retrieve a file from the cache
   */
  get(id: string): File | undefined {
    return this.cache.get(id);
  }

  /**
   * Check if a file exists in the cache
   */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Remove a file from the cache
   */
  delete(id: string): boolean {
    return this.cache.delete(id);
  }

  /**
   * Clear all files from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get all cached file IDs
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get the number of cached files
   */
  size(): number {
    return this.cache.size;
  }
}

// Export a singleton instance of the file cache
export const fileCache = new FileCache();

// Constants for localStorage keys
export const STORAGE_KEYS = {
  UPLOADS_QUEUE: 'fox-celebration-uploads-queue',
} as const;
