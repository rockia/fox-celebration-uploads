import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  uploadsStorage, 
  FileCache, 
  fileCache, 
  STORAGE_KEYS,
  type SerializableUploadItem,
  type SerializableUploadsState 
} from '../localStorage';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock console.warn to test error handling
const consoleWarnMock = vi.fn();

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Setup localStorage mock
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
  
  // Setup console.warn mock
  Object.defineProperty(console, 'warn', {
    value: consoleWarnMock,
    writable: true,
  });
});

describe('uploadsStorage', () => {
  const mockKey = 'test-key';
  const mockInitialValue: SerializableUploadsState = {};
  const mockUploadItem: SerializableUploadItem = {
    id: 'test-id',
    fileName: 'test.txt',
    fileSize: 1024,
    fileType: 'text/plain',
    fileLastModified: Date.now(),
    progress: 50,
    status: 'uploading',
    error: undefined,
    remoteId: 'remote-123',
    uploadUrl: 'https://example.com/upload',
    method: 'PUT',
  };
  const mockUploadsState: SerializableUploadsState = {
    'test-id': mockUploadItem,
  };

  describe('getItem', () => {
    it('should return parsed data when localStorage has valid JSON', () => {
      const jsonData = JSON.stringify(mockUploadsState);
      localStorageMock.getItem.mockReturnValue(jsonData);

      const result = uploadsStorage.getItem(mockKey, mockInitialValue);

      expect(localStorageMock.getItem).toHaveBeenCalledWith(mockKey);
      expect(result).toEqual(mockUploadsState);
    });

    it('should return initial value when localStorage returns null', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = uploadsStorage.getItem(mockKey, mockInitialValue);

      expect(localStorageMock.getItem).toHaveBeenCalledWith(mockKey);
      expect(result).toBe(mockInitialValue);
    });

    it('should return initial value when localStorage returns empty string', () => {
      localStorageMock.getItem.mockReturnValue('');

      const result = uploadsStorage.getItem(mockKey, mockInitialValue);

      expect(result).toBe(mockInitialValue);
    });

    it('should handle JSON parse errors gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');

      const result = uploadsStorage.getItem(mockKey, mockInitialValue);

      expect(result).toBe(mockInitialValue);
      expect(consoleWarnMock).toHaveBeenCalledWith(
        'Failed to read from localStorage:',
        expect.any(Error)
      );
    });

    it('should handle localStorage access errors', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const result = uploadsStorage.getItem(mockKey, mockInitialValue);

      expect(result).toBe(mockInitialValue);
      expect(consoleWarnMock).toHaveBeenCalledWith(
        'Failed to read from localStorage:',
        expect.any(Error)
      );
    });
  });

  describe('setItem', () => {
    it('should stringify and store data in localStorage', () => {
      uploadsStorage.setItem(mockKey, mockUploadsState);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        mockKey,
        JSON.stringify(mockUploadsState)
      );
    });

    it('should handle localStorage write errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() => {
        uploadsStorage.setItem(mockKey, mockUploadsState);
      }).not.toThrow();

      expect(consoleWarnMock).toHaveBeenCalledWith(
        'Failed to write to localStorage:',
        expect.any(Error)
      );
    });

    it('should handle complex nested data structures', () => {
      const complexData: SerializableUploadsState = {
        'file1': { ...mockUploadItem, id: 'file1' },
        'file2': { ...mockUploadItem, id: 'file2', status: 'success' },
        'file3': { ...mockUploadItem, id: 'file3', error: 'Upload failed' },
      };

      uploadsStorage.setItem(mockKey, complexData);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        mockKey,
        JSON.stringify(complexData)
      );
    });
  });

  describe('removeItem', () => {
    it('should remove item from localStorage', () => {
      uploadsStorage.removeItem(mockKey);

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(mockKey);
    });

    it('should handle localStorage remove errors gracefully', () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      // Should not throw
      expect(() => {
        uploadsStorage.removeItem(mockKey);
      }).not.toThrow();

      expect(consoleWarnMock).toHaveBeenCalledWith(
        'Failed to remove from localStorage:',
        expect.any(Error)
      );
    });
  });

  describe('clear', () => {
    it('should clear all localStorage data', () => {
      uploadsStorage.clear();

      expect(localStorageMock.clear).toHaveBeenCalled();
    });

    it('should handle localStorage clear errors gracefully', () => {
      localStorageMock.clear.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      // Should not throw
      expect(() => {
        uploadsStorage.clear();
      }).not.toThrow();

      expect(consoleWarnMock).toHaveBeenCalledWith(
        'Failed to clear localStorage:',
        expect.any(Error)
      );
    });
  });

  describe('isAvailable', () => {
    it('should return true when localStorage is available', () => {
      localStorageMock.setItem.mockImplementation(() => {});
      localStorageMock.removeItem.mockImplementation(() => {});

      const result = uploadsStorage.isAvailable();

      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('__localStorage_test__', 'test');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('__localStorage_test__');
    });

    it('should return false when localStorage is not available', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const result = uploadsStorage.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false when localStorage setItem fails', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const result = uploadsStorage.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false when localStorage removeItem fails', () => {
      localStorageMock.setItem.mockImplementation(() => {});
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const result = uploadsStorage.isAvailable();

      expect(result).toBe(false);
    });
  });
});

describe('FileCache class', () => {
  let cache: FileCache;
  let mockFile1: File;
  let mockFile2: File;

  beforeEach(() => {
    cache = new FileCache();
    mockFile1 = new File(['content1'], 'file1.txt', { type: 'text/plain' });
    mockFile2 = new File(['content2'], 'file2.txt', { type: 'text/plain' });
  });

  describe('set and get', () => {
    it('should store and retrieve files', () => {
      cache.set('id1', mockFile1);
      
      const retrieved = cache.get('id1');
      
      expect(retrieved).toBe(mockFile1);
      expect(retrieved?.name).toBe('file1.txt');
    });

    it('should return undefined for non-existent files', () => {
      const retrieved = cache.get('non-existent');
      
      expect(retrieved).toBeUndefined();
    });

    it('should overwrite existing files', () => {
      cache.set('id1', mockFile1);
      cache.set('id1', mockFile2);
      
      const retrieved = cache.get('id1');
      
      expect(retrieved).toBe(mockFile2);
      expect(retrieved?.name).toBe('file2.txt');
    });
  });

  describe('has', () => {
    it('should return true for existing files', () => {
      cache.set('id1', mockFile1);
      
      expect(cache.has('id1')).toBe(true);
    });

    it('should return false for non-existent files', () => {
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should return false after file is deleted', () => {
      cache.set('id1', mockFile1);
      cache.delete('id1');
      
      expect(cache.has('id1')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing files and return true', () => {
      cache.set('id1', mockFile1);
      
      const deleted = cache.delete('id1');
      
      expect(deleted).toBe(true);
      expect(cache.has('id1')).toBe(false);
      expect(cache.get('id1')).toBeUndefined();
    });

    it('should return false for non-existent files', () => {
      const deleted = cache.delete('non-existent');
      
      expect(deleted).toBe(false);
    });

    it('should not affect other files', () => {
      cache.set('id1', mockFile1);
      cache.set('id2', mockFile2);
      
      cache.delete('id1');
      
      expect(cache.has('id1')).toBe(false);
      expect(cache.has('id2')).toBe(true);
      expect(cache.get('id2')).toBe(mockFile2);
    });
  });

  describe('clear', () => {
    it('should remove all files from cache', () => {
      cache.set('id1', mockFile1);
      cache.set('id2', mockFile2);
      
      cache.clear();
      
      expect(cache.has('id1')).toBe(false);
      expect(cache.has('id2')).toBe(false);
      expect(cache.size()).toBe(0);
    });

    it('should work on empty cache', () => {
      expect(() => cache.clear()).not.toThrow();
      expect(cache.size()).toBe(0);
    });
  });

  describe('keys', () => {
    it('should return array of all file IDs', () => {
      cache.set('id1', mockFile1);
      cache.set('id2', mockFile2);
      
      const keys = cache.keys();
      
      expect(keys).toEqual(expect.arrayContaining(['id1', 'id2']));
      expect(keys).toHaveLength(2);
    });

    it('should return empty array for empty cache', () => {
      const keys = cache.keys();
      
      expect(keys).toEqual([]);
    });

    it('should update after adding/removing files', () => {
      cache.set('id1', mockFile1);
      expect(cache.keys()).toEqual(['id1']);
      
      cache.set('id2', mockFile2);
      expect(cache.keys()).toHaveLength(2);
      
      cache.delete('id1');
      expect(cache.keys()).toEqual(['id2']);
    });
  });

  describe('size', () => {
    it('should return correct count of cached files', () => {
      expect(cache.size()).toBe(0);
      
      cache.set('id1', mockFile1);
      expect(cache.size()).toBe(1);
      
      cache.set('id2', mockFile2);
      expect(cache.size()).toBe(2);
      
      cache.delete('id1');
      expect(cache.size()).toBe(1);
      
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string IDs', () => {
      cache.set('', mockFile1);
      
      expect(cache.has('')).toBe(true);
      expect(cache.get('')).toBe(mockFile1);
      expect(cache.keys()).toContain('');
    });

    it('should handle special character IDs', () => {
      const specialId = 'id-with-special-chars!@#$%^&*()';
      cache.set(specialId, mockFile1);
      
      expect(cache.has(specialId)).toBe(true);
      expect(cache.get(specialId)).toBe(mockFile1);
    });

    it('should handle very long IDs', () => {
      const longId = 'a'.repeat(1000);
      cache.set(longId, mockFile1);
      
      expect(cache.has(longId)).toBe(true);
      expect(cache.get(longId)).toBe(mockFile1);
    });
  });
});

describe('fileCache singleton', () => {
  beforeEach(() => {
    // Clear the singleton instance before each test
    fileCache.clear();
  });

  it('should be an instance of FileCache', () => {
    expect(fileCache).toBeInstanceOf(FileCache);
  });

  it('should maintain state across multiple accesses', () => {
    const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    
    fileCache.set('test-id', mockFile);
    
    // Access from different parts of code should return same file
    expect(fileCache.get('test-id')).toBe(mockFile);
    expect(fileCache.has('test-id')).toBe(true);
  });

  it('should be the same instance when imported multiple times', () => {
    // This tests the singleton pattern
    const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    
    fileCache.set('singleton-test', mockFile);
    
    // In a real scenario, this would be imported in different modules
    expect(fileCache.get('singleton-test')).toBe(mockFile);
  });
});

describe('STORAGE_KEYS', () => {
  it('should contain expected keys', () => {
    expect(STORAGE_KEYS.UPLOADS_QUEUE).toBe('fox-celebration-uploads-queue');
  });

  it('should be readonly (const assertion)', () => {
    // TypeScript should prevent this, but we can test the structure
    expect(typeof STORAGE_KEYS).toBe('object');
    expect(Object.isFrozen(STORAGE_KEYS)).toBe(false); // const assertion doesn't freeze at runtime
  });

  it('should have string values', () => {
    Object.values(STORAGE_KEYS).forEach(value => {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });
  });
});

describe('Type definitions', () => {
  it('should create valid SerializableUploadItem objects', () => {
    const uploadItem: SerializableUploadItem = {
      id: 'test-id',
      fileName: 'test.txt',
      fileSize: 1024,
      fileType: 'text/plain',
      fileLastModified: Date.now(),
      progress: 75,
      status: 'uploading',
      error: 'Test error',
      remoteId: 'remote-123',
      uploadUrl: 'https://example.com/upload',
      method: 'PUT',
    };

    // Should compile without errors and have correct types
    expect(typeof uploadItem.id).toBe('string');
    expect(typeof uploadItem.fileSize).toBe('number');
    expect(typeof uploadItem.progress).toBe('number');
    expect(['queued', 'reserving', 'ready', 'uploading', 'success', 'error', 'canceled']).toContain(uploadItem.status);
  });

  it('should create valid SerializableUploadsState objects', () => {
    const uploadsState: SerializableUploadsState = {
      'file1': {
        id: 'file1',
        fileName: 'file1.txt',
        fileSize: 1024,
        fileType: 'text/plain',
        fileLastModified: Date.now(),
        progress: 100,
        status: 'success',
      },
      'file2': {
        id: 'file2',
        fileName: 'file2.jpg',
        fileSize: 2048,
        fileType: 'image/jpeg',
        fileLastModified: Date.now(),
        progress: 50,
        status: 'uploading',
        uploadUrl: 'https://example.com/upload',
      },
    };

    expect(Object.keys(uploadsState)).toEqual(['file1', 'file2']);
    expect(uploadsState.file1.status).toBe('success');
    expect(uploadsState.file2.status).toBe('uploading');
  });
});
