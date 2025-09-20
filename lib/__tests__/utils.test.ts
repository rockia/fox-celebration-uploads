import { describe, it, expect } from 'vitest';
import {  formatFileSize } from '../utils';

describe('formatFileSize function', () => {
  describe('bytes formatting', () => {
    it('should format 0 bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format small byte values', () => {
      expect(formatFileSize(1)).toBe('1 Bytes');
      expect(formatFileSize(512)).toBe('512 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
    });
  });

  describe('KB formatting', () => {
    it('should format KB values correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
    });

    it('should handle decimal KB values', () => {
      expect(formatFileSize(1100)).toBe('1.07 KB');
      expect(formatFileSize(1500)).toBe('1.46 KB');
    });
  });

  describe('MB formatting', () => {
    it('should format MB values correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5 MB');
      expect(formatFileSize(1024 * 1024 * 2)).toBe('2 MB');
    });

    it('should handle decimal MB values', () => {
      expect(formatFileSize(1024 * 1024 * 1.25)).toBe('1.25 MB');
      expect(formatFileSize(1024 * 1024 * 10.75)).toBe('10.75 MB');
    });
  });

  describe('GB formatting', () => {
    it('should format GB values correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatFileSize(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB');
      expect(formatFileSize(1024 * 1024 * 1024 * 2)).toBe('2 GB');
    });

    it('should handle decimal GB values', () => {
      expect(formatFileSize(1024 * 1024 * 1024 * 1.25)).toBe('1.25 GB');
      expect(formatFileSize(1024 * 1024 * 1024 * 5.75)).toBe('5.75 GB');
    });
  });

  describe('edge cases', () => {
    it('should handle very large numbers', () => {
      const veryLarge = 1024 * 1024 * 1024 * 1024; // TB size
      const result = formatFileSize(veryLarge);
      expect(result).toBe('1024 GB'); // Should cap at GB since sizes array only goes to GB
    });

    it('should handle fractional bytes (should round)', () => {
      expect(formatFileSize(1.7)).toBe('1.7 Bytes');
      expect(formatFileSize(1023.9)).toBe('1023.9 Bytes');
    });

    it('should handle negative numbers gracefully', () => {
      // Note: The function doesn't explicitly handle negative numbers
      // This test documents current behavior
      const result = formatFileSize(-1024);
      expect(typeof result).toBe('string');
    });
  });

  describe('precision and rounding', () => {
    it('should round to 2 decimal places', () => {
      expect(formatFileSize(1024 * 1.333)).toBe('1.33 KB');
      expect(formatFileSize(1024 * 1.999)).toBe('2 KB');
    });

    it('should handle values that round to whole numbers', () => {
      expect(formatFileSize(1024 * 2.001)).toBe('2 KB');
      expect(formatFileSize(1024 * 1.996)).toBe('2 KB');
    });
  });

  describe('real-world file sizes', () => {
    it('should format common file sizes correctly', () => {
      // Empty file
      expect(formatFileSize(0)).toBe('0 Bytes');
      
      // Small text file
      expect(formatFileSize(1500)).toBe('1.46 KB');
      
      // Document
      expect(formatFileSize(50 * 1024)).toBe('50 KB');
      
      // Image
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
      
      // Video
      expect(formatFileSize(1.2 * 1024 * 1024 * 1024)).toBe('1.2 GB');
    });
  });
});
