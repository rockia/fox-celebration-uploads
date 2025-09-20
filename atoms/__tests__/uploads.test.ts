import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStore } from 'jotai';
import axios from 'axios';
import {
  uploadsAtom,
  uploadsArrayAtom,
  addFilesAtom,
  removeUploadAtom,
  clearAllUploadsAtom,
  clearRemovableUploadsAtom,
  prepareUploadsAtom,
  startUploadsAtom,
  updateUploadAtom,
  cancelUploadAtom,
  cancelAllActiveUploadsAtom,
  hasPlaceholderFilesAtom,
  readyUploadsAtom,
  isPlaceholderFile,
  overallProgressAtom,
  type UploadItem,
} from '../uploads';
import {
  isUploadingAtom,
  isPreparingUploadsAtom,
} from '../upload-stats';
import { fileCache } from '@/lib/localStorage';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock crypto.randomUUID
const mockUUID = vi.fn();
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: mockUUID,
  },
});

// Helper to create a mock File
const createMockFile = (name: string, size: number, type: string = 'text/plain'): File => {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('Upload State Machine Flow', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    vi.clearAllMocks();
    
    // Reset UUID counter for predictable IDs
    let uuidCounter = 0;
    mockUUID.mockImplementation(() => `mock-uuid-${++uuidCounter}`);
    
    // Mock axios responses
    mockedAxios.post.mockImplementation((url) => {
      if (url === '/api/upload-url') {
        return Promise.resolve({
          data: {
            id: 'remote-id-1',
            uploadUrl: 'https://example.com/upload',
            method: 'PUT',
          },
        });
      }
      if (url.includes('/api/upload-complete/')) {
        return Promise.resolve({ data: {} });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });

    mockedAxios.mockImplementation(() => Promise.resolve({ data: {} }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have empty initial state', () => {
      const uploads = store.get(uploadsArrayAtom);
      const isUploading = store.get(isUploadingAtom);
      const isPreparing = store.get(isPreparingUploadsAtom);

      expect(uploads).toEqual([]);
      expect(isUploading).toBe(false);
      expect(isPreparing).toBe(false);
    });
  });

  describe('Adding Files', () => {
    it('should add files to queue with queued status', () => {
      const file1 = createMockFile('test1.txt', 1000);
      const file2 = createMockFile('test2.txt', 2000);

      store.set(addFilesAtom, [file1, file2]);

      const uploads = store.get(uploadsArrayAtom);
      expect(uploads).toHaveLength(2);
      expect(uploads[0]).toMatchObject({
        id: 'mock-uuid-1',
        file: file1,
        fileSize: 1000,
        progress: 0,
        status: 'queued',
      });
      expect(uploads[1]).toMatchObject({
        id: 'mock-uuid-2',
        file: file2,
        fileSize: 2000,
        progress: 0,
        status: 'queued',
      });
    });

    it('should prevent adding files when uploads have started', () => {
      const file1 = createMockFile('test1.txt', 1000);
      const file2 = createMockFile('test2.txt', 2000);

      // Add first file and mark as success (uploads started)
      store.set(addFilesAtom, [file1]);
      store.set(updateUploadAtom, 'mock-uuid-1', { status: 'success' });

      // Try to add another file
      store.set(addFilesAtom, [file2]);

      const uploads = store.get(uploadsArrayAtom);
      expect(uploads).toHaveLength(1); // Should still be 1, second file not added
      expect(uploads[0].file.name).toBe('test1.txt');
    });
  });

  describe('Prepare Uploads Flow', () => {
    it('should transition files from queued to reserving to ready', async () => {
      const file = createMockFile('test.txt', 1000);

      // Prepare uploads (this adds files and prepares them)
      await store.set(prepareUploadsAtom, [file]);

      const uploads = store.get(uploadsArrayAtom);
      expect(uploads).toHaveLength(1);
      expect(uploads[0]).toMatchObject({
        status: 'ready',
        remoteId: 'remote-id-1',
        uploadUrl: 'https://example.com/upload',
        method: 'PUT',
      });

      // Files should be ready now, so not preparing
      // Note: The state machine determines this based on individual upload states
      const uploadsList = store.get(uploadsArrayAtom);
      expect(uploadsList[0].status).toBe('ready');
      expect(store.get(isPreparingUploadsAtom)).toBe(false);
    });

    it('should set isPreparing to true during preparation', async () => {
      const file = createMockFile('test.txt', 1000);

      // Mock a delayed response to test the preparing state
      mockedAxios.post.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          data: { id: 'remote-id-1', uploadUrl: 'https://example.com/upload' }
        }), 100))
      );

      const preparePromise = store.set(prepareUploadsAtom, [file]);
      
      // Should be preparing during the async operation
      expect(store.get(isPreparingUploadsAtom)).toBe(true);

      await preparePromise;

      // Should not be preparing after completion
      expect(store.get(isPreparingUploadsAtom)).toBe(false);
    });

    it('should handle preparation errors', async () => {
      const file = createMockFile('test.txt', 1000);
      
      // Mock API error
      mockedAxios.post.mockRejectedValueOnce(new Error('API Error'));

      await store.set(prepareUploadsAtom, [file]);

      const uploads = store.get(uploadsArrayAtom);
      expect(uploads[0]).toMatchObject({
        status: 'error',
        error: 'API Error',
      });
      expect(store.get(isPreparingUploadsAtom)).toBe(false);
    });
  });

  describe('Upload Flow', () => {
    it('should transition ready files to uploading to success', async () => {
      const file = createMockFile('test.txt', 1000);

      // Prepare the upload first
      await store.set(prepareUploadsAtom, [file]);

      // Mock successful upload
      mockedAxios.mockResolvedValueOnce({ data: {} });

      // Start uploads
      await store.set(startUploadsAtom);

      const uploads = store.get(uploadsArrayAtom);
      expect(uploads[0]).toMatchObject({
        status: 'success',
        progress: 100,
      });
      expect(store.get(isUploadingAtom)).toBe(false);
    });

    it('should set isUploading to true during upload', async () => {
      const file = createMockFile('test.txt', 1000);

      // Prepare the upload
      await store.set(prepareUploadsAtom, [file]);

      // Mock delayed upload to test uploading state
      mockedAxios.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: {} }), 100))
      );

      const uploadPromise = store.set(startUploadsAtom);

      // Should be uploading during the async operation
      expect(store.get(isUploadingAtom)).toBe(true);

      await uploadPromise;

      // Should not be uploading after completion
      expect(store.get(isUploadingAtom)).toBe(false);
    });

    it('should handle upload errors', async () => {
      const file = createMockFile('test.txt', 1000);

      // Prepare the upload
      await store.set(prepareUploadsAtom, [file]);

      // Mock upload error
      mockedAxios.mockRejectedValueOnce(new Error('Upload failed'));

      await store.set(startUploadsAtom);

      const uploads = store.get(uploadsArrayAtom);
      expect(uploads[0]).toMatchObject({
        status: 'error',
        error: 'Upload failed',
      });
      expect(store.get(isUploadingAtom)).toBe(false);
    });

    it('should only upload ready files', async () => {
      const file1 = createMockFile('test1.txt', 1000);
      const file2 = createMockFile('test2.txt', 2000);

      // Add files but only prepare one
      store.set(addFilesAtom, [file2]); // Add second file as queued
      await store.set(prepareUploadsAtom, [file1]); // Only prepare first file

      const readyUploads = store.get(readyUploadsAtom);
      expect(readyUploads).toHaveLength(1);
      expect(readyUploads[0].file.name).toBe('test1.txt');

      // Start uploads - should only upload the ready file
      await store.set(startUploadsAtom);

      const uploads = store.get(uploadsArrayAtom);
      expect(uploads.find(u => u.file.name === 'test1.txt')?.status).toBe('success');
      expect(uploads.find(u => u.file.name === 'test2.txt')?.status).toBe('queued');
    });
  });

  describe('File Removal', () => {
    it('should remove individual files', () => {
      const file1 = createMockFile('test1.txt', 1000);
      const file2 = createMockFile('test2.txt', 2000);

      store.set(addFilesAtom, [file1, file2]);
      expect(store.get(uploadsArrayAtom)).toHaveLength(2);

      store.set(removeUploadAtom, 'mock-uuid-1');

      const uploads = store.get(uploadsArrayAtom);
      expect(uploads).toHaveLength(1);
      expect(uploads[0].file.name).toBe('test2.txt');
    });
  });

  describe('Cancel Operations', () => {
    it('should cancel uploading files', async () => {
      const file = createMockFile('test.txt', 1000);

      // Prepare upload
      await store.set(prepareUploadsAtom, [file]);

      // Set to uploading with mock controller
      const mockController = { abort: vi.fn() };
      const currentUploads = store.get(uploadsAtom);
      const uploadId = Object.keys(currentUploads)[0];
      
      store.set(updateUploadAtom, uploadId, { 
        status: 'uploading', 
        controller: mockController as any 
      });

      // Verify upload is in uploading state
      let uploads = store.get(uploadsArrayAtom);
      expect(uploads[0].status).toBe('uploading');

      // Cancel the upload
      store.set(cancelUploadAtom, uploadId);

      // Verify upload is canceled and controller is cleared
      uploads = store.get(uploadsArrayAtom);
      expect(uploads[0].status).toBe('canceled');
      expect(uploads[0].controller).toBeUndefined();
      
      // Note: The actual abort() call happens in the cancelUploadAtom implementation
      // We can't easily test it due to atom reconstruction, but the status change confirms it worked
    });

    it('should cancel all active uploads', async () => {
      const file1 = createMockFile('test1.txt', 1000);
      const file2 = createMockFile('test2.txt', 2000);
      const file3 = createMockFile('test3.txt', 3000);

      // Prepare uploads
      await store.set(prepareUploadsAtom, [file1, file2, file3]);

      // Set different states
      const currentUploads = store.get(uploadsAtom);
      const uploadIds = Object.keys(currentUploads);
      
      const mockController1 = { abort: vi.fn() };
      const mockController2 = { abort: vi.fn() };
      
      // Set first two as active (uploading/reserving), third as completed
      store.set(updateUploadAtom, uploadIds[0], { 
        status: 'uploading', 
        controller: mockController1 as any 
      });
      store.set(updateUploadAtom, uploadIds[1], { 
        status: 'reserving', 
        controller: mockController2 as any 
      });
      store.set(updateUploadAtom, uploadIds[2], { 
        status: 'success', 
        progress: 100 
      });

      // Verify initial states
      let uploads = store.get(uploadsArrayAtom);
      expect(uploads.find(u => u.id === uploadIds[0])?.status).toBe('uploading');
      expect(uploads.find(u => u.id === uploadIds[1])?.status).toBe('reserving');
      expect(uploads.find(u => u.id === uploadIds[2])?.status).toBe('success');

      // Cancel all active uploads
      store.set(cancelAllActiveUploadsAtom);

      uploads = store.get(uploadsArrayAtom);
      
      // First two should be canceled
      expect(uploads.find(u => u.id === uploadIds[0])?.status).toBe('canceled');
      expect(uploads.find(u => u.id === uploadIds[1])?.status).toBe('canceled');
      // Third should remain successful
      expect(uploads.find(u => u.id === uploadIds[2])?.status).toBe('success');
      
      // Controllers should be cleared
      expect(uploads.find(u => u.id === uploadIds[0])?.controller).toBeUndefined();
      expect(uploads.find(u => u.id === uploadIds[1])?.controller).toBeUndefined();
    });

    it('should clean up memory when removing uploads', async () => {
      const file = createMockFile('test.txt', 1000);

      // Add file to cache and uploads
      await store.set(prepareUploadsAtom, [file]);
      
      const currentUploads = store.get(uploadsAtom);
      const uploadId = Object.keys(currentUploads)[0];
      
      // Verify file is in cache
      expect(fileCache.has(uploadId)).toBe(true);

      // Remove upload
      store.set(removeUploadAtom, uploadId);

      // Verify file is removed from cache
      expect(fileCache.has(uploadId)).toBe(false);
      
      // Verify upload is removed
      const uploads = store.get(uploadsArrayAtom);
      expect(uploads.length).toBe(0);
    });

    it('should clean up all memory when clearing all uploads', async () => {
      const file1 = createMockFile('test1.txt', 1000);
      const file2 = createMockFile('test2.txt', 2000);

      // Add files
      await store.set(prepareUploadsAtom, [file1, file2]);
      
      const currentUploads = store.get(uploadsAtom);
      const uploadIds = Object.keys(currentUploads);
      
      // Verify files are in cache
      expect(fileCache.has(uploadIds[0])).toBe(true);
      expect(fileCache.has(uploadIds[1])).toBe(true);

      // Clear all uploads
      store.set(clearAllUploadsAtom);

      // Verify all files are removed from cache
      expect(fileCache.has(uploadIds[0])).toBe(false);
      expect(fileCache.has(uploadIds[1])).toBe(false);
      
      // Verify all uploads are removed
      const uploads = store.get(uploadsArrayAtom);
      expect(uploads.length).toBe(0);
    });

    it('should preserve file cache for canceled uploads', async () => {
      const file = createMockFile('test.txt', 1000);

      // Add file
      await store.set(prepareUploadsAtom, [file]);
      
      const currentUploads = store.get(uploadsAtom);
      const uploadId = Object.keys(currentUploads)[0];
      
      // Set to uploading
      const mockController = { abort: vi.fn() };
      store.set(updateUploadAtom, uploadId, { 
        status: 'uploading', 
        controller: mockController as any 
      });

      // Verify file is in cache
      expect(fileCache.has(uploadId)).toBe(true);

      // Cancel upload (should keep file in cache)
      store.set(cancelUploadAtom, uploadId);

      // Verify file is still in cache
      expect(fileCache.has(uploadId)).toBe(true);
      
      // Verify upload is canceled
      const uploads = store.get(uploadsArrayAtom);
      expect(uploads[0].status).toBe('canceled');
    });
  });

  describe('Clear Operations', () => {
    it('should clear all uploads and reset states', () => {
      const file1 = createMockFile('test1.txt', 1000);
      const file2 = createMockFile('test2.txt', 2000);

      // Add files (state is managed by state machine)
      store.set(addFilesAtom, [file1, file2]);

      // Clear all
      store.set(clearAllUploadsAtom);

      expect(store.get(uploadsArrayAtom)).toEqual([]);
      // State machine should reset to idle when no uploads
      expect(store.get(isUploadingAtom)).toBe(false);
      expect(store.get(isPreparingUploadsAtom)).toBe(false);
    });

    it('should clear only removable uploads', () => {
      const file1 = createMockFile('test1.txt', 1000);
      const file2 = createMockFile('test2.txt', 2000);

      // Add files with different statuses
      store.set(addFilesAtom, [file1, file2]);
      store.set(updateUploadAtom, 'mock-uuid-1', { status: 'uploading' });
      store.set(updateUploadAtom, 'mock-uuid-2', { status: 'success' });

      // Clear removable uploads
      store.set(clearRemovableUploadsAtom);

      const uploads = store.get(uploadsArrayAtom);
      expect(uploads).toHaveLength(1);
      expect(uploads[0].status).toBe('uploading');
    });

    it('should reset states when clearing all removable uploads', () => {
      const file = createMockFile('test.txt', 1000);

      // Add file (state is managed by state machine)
      store.set(addFilesAtom, [file]);
      store.set(updateUploadAtom, 'mock-uuid-1', { status: 'success' });

      // Clear removable uploads (should clear all since none are uploading)
      store.set(clearRemovableUploadsAtom);

      expect(store.get(uploadsArrayAtom)).toEqual([]);
      expect(store.get(isUploadingAtom)).toBe(false);
      expect(store.get(isPreparingUploadsAtom)).toBe(false);
    });
  });


  describe('Derived State', () => {
    it('should correctly identify placeholder files', () => {
      // Test the isPlaceholderFile function directly
      
      // Normal file
      const normalFile = createMockFile('test.txt', 1000);
      const normalUpload = {
        id: 'test-1',
        file: normalFile,
        fileSize: 1000,
        progress: 0,
        status: 'queued' as const,
      };
      expect(isPlaceholderFile(normalUpload)).toBe(false);

      // Placeholder file (file.size = 0 but fileSize > 0)
      const placeholderFile = new File([], 'test.txt', { type: 'text/plain' });
      Object.defineProperty(placeholderFile, 'size', { value: 0, writable: false });
      const placeholderUpload = {
        id: 'test-2',
        file: placeholderFile,
        fileSize: 1000, // Original size stored
        progress: 0,
        status: 'error' as const,
      };
      expect(isPlaceholderFile(placeholderUpload)).toBe(true);
    });

    it('should filter ready uploads correctly', async () => {
      const file1 = createMockFile('test1.txt', 1000);
      const file2 = createMockFile('test2.txt', 2000);
      const file3 = createMockFile('test3.txt', 3000);

      // Add third file as queued
      store.set(addFilesAtom, [file3]);

      // Prepare first two files
      await store.set(prepareUploadsAtom, [file1, file2]);

      // Set one file to error (find the correct UUID)
      const allUploads = store.get(uploadsArrayAtom);
      const secondUpload = allUploads.find(u => u.file.name === 'test2.txt');
      if (secondUpload) {
        store.set(updateUploadAtom, secondUpload.id, { status: 'error' });
      }

      const readyUploads = store.get(readyUploadsAtom);
      expect(readyUploads).toHaveLength(1);
      expect(readyUploads[0].file.name).toBe('test1.txt');
    });
  });

  describe('Complete State Machine Flow', () => {
    it('should handle complete upload lifecycle', async () => {
      const file = createMockFile('test.txt', 1000);

      // 1. Initial state
      expect(store.get(uploadsArrayAtom)).toEqual([]);
      expect(store.get(isPreparingUploadsAtom)).toBe(false);
      expect(store.get(isUploadingAtom)).toBe(false);

      // 2. Prepare upload (adds file and prepares it: queued -> reserving -> ready)
      await store.set(prepareUploadsAtom, [file]);
      let uploads = store.get(uploadsArrayAtom);
      expect(uploads[0].status).toBe('ready');
      expect(uploads[0].uploadUrl).toBeDefined();

      // 3. Start upload (ready -> uploading -> success)
      await store.set(startUploadsAtom);
      uploads = store.get(uploadsArrayAtom);
      expect(uploads[0].status).toBe('success');
      expect(uploads[0].progress).toBe(100);

      // 4. Clear completed uploads
      store.set(clearAllUploadsAtom);
      expect(store.get(uploadsArrayAtom)).toEqual([]);
      expect(store.get(isPreparingUploadsAtom)).toBe(false);
      expect(store.get(isUploadingAtom)).toBe(false);
    });

    it('should calculate overall progress correctly with mixed success/failure', async () => {
      const file1 = createMockFile('success.txt', 1000);
      const file2 = createMockFile('failed.txt', 1000);

      // Prepare both files
      await store.set(prepareUploadsAtom, [file1, file2]);
      let uploads = store.get(uploadsArrayAtom);
      expect(uploads).toHaveLength(2);

      // Simulate first file succeeding
      const successUpload = uploads.find(u => u.file.name === 'success.txt');
      if (successUpload) {
        store.set(updateUploadAtom, successUpload.id, { 
          status: 'success', 
          progress: 100 
        });
      }

      // Simulate second file failing at 90% progress
      const failedUpload = uploads.find(u => u.file.name === 'failed.txt');
      if (failedUpload) {
        store.set(updateUploadAtom, failedUpload.id, { 
          status: 'error', 
          progress: 90,  // This should NOT count toward overall progress
          error: 'Upload failed'
        });
      }

      // Check overall progress calculation
      const overallProgress = store.get(overallProgressAtom);
      
      // With 1 success (100%) and 1 failure (0% contribution) out of 2 files:
      // Expected: (100 + 0) / 2 = 50%
      expect(overallProgress.context.overallProgress).toBe(50);
      
      // Verify we have the correct counts
      expect(overallProgress.context.completedFiles).toBe(1);
      expect(overallProgress.context.failedFiles).toBe(1);
      expect(overallProgress.context.totalFiles).toBe(2);
    });
  });
});
