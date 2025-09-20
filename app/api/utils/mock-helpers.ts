/**
 * Mock API utilities for simulating realistic network behavior
 */

import { z } from 'zod';

export interface MockConfig {
  minDelay?: number;
  maxDelay?: number;
  failureRate?: number; // 0-1, probability of failure
  progressSteps?: number; // For upload progress simulation
}

/**
 * Simulate network delay with random variation
 */
export async function simulateDelay(config: MockConfig = {}) {
  const { minDelay = 100, maxDelay = 500 } = config;
  const delay = Math.random() * (maxDelay - minDelay) + minDelay;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Simulate occasional failures
 */
export function simulateFailure(config: MockConfig = {}): boolean {
  const { failureRate = 0.05 } = config; // 5% failure rate by default
  return Math.random() < failureRate;
}

/**
 * Generate realistic error messages
 */
export function getRandomError(): { status: number; message: string } {
  const errors = [
    { status: 413, message: "File too large" },
    { status: 429, message: "Rate limit exceeded" },
    { status: 500, message: "Internal server error" },
    { status: 503, message: "Service temporarily unavailable" },
  ];
  
  return errors[Math.floor(Math.random() * errors.length)];
}

// Zod schemas for validation
const FileMetadataSchema = z.object({
  filename: z.string()
    .min(1, "Filename cannot be empty")
    .max(255, "Filename too long (max 255 characters)")
    .regex(/^[^<>:"/\\|?*\x00-\x1f]*$/, "Filename contains invalid characters")
    .optional(),
  size: z.number()
    .int("File size must be an integer")
    .min(0, "File size cannot be negative")
    .max(1000 * 1024 * 1024, "File size exceeds 1000MB limit")
    .optional(),
  type: z.string()
    .min(1, "File type cannot be empty")
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/, "Invalid MIME type format")
    .optional()
});


// API request schemas
export const UploadUrlRequestSchema = z.object({
  filename: z.string()
    .min(1, "Filename is required")
    .max(255, "Filename too long (max 255 characters)")
    .regex(/^[^<>:"/\\|?*\x00-\x1f]*$/, "Filename contains invalid characters"),
  size: z.number()
    .int("File size must be an integer")
    .min(1, "File size must be greater than 0")
    .max(1000 * 1024 * 1024, "File size exceeds 1000MB limit"),
  type: z.string()
    .min(1, "File type is required")
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/, "Invalid MIME type format")
});

export const UploadCompleteRequestSchema = z.object({
  bytes: z.number()
    .int("Bytes must be an integer")
    .min(0, "Bytes cannot be negative")
    .optional(),
  success: z.boolean().default(true),
  error: z.string().optional()
});

export const UploadIdSchema = z.string()
  .min(1, "Upload ID is required")
  .regex(/^upload_\d+_[a-z0-9]+$/, "Invalid upload ID format");

/**
 * Validate file metadata using Zod schemas
 */
export function validateFileMetadata(metadata: {
  filename?: string;
  size?: number;
  type?: string;
}): { valid: boolean; error?: string; details?: z.ZodError } {
  try {
    // Validate basic metadata structure - all file types are now supported
    FileMetadataSchema.parse(metadata);
    
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return { 
        valid: false, 
        error: firstError.message,
        details: error
      };
    }
    
    return { 
      valid: false, 
      error: "Validation failed"
    };
  }
}

/**
 * Simulate upload progress with realistic patterns
 */
export async function simulateUploadProgress(
  totalBytes: number,
  onProgress: (loaded: number, total: number) => void,
  config: MockConfig = {}
) {
  const { progressSteps = 20 } = config;
  const stepSize = totalBytes / progressSteps;
  
  for (let i = 0; i <= progressSteps; i++) {
    const loaded = Math.min(i * stepSize, totalBytes);
    onProgress(loaded, totalBytes);
    
    if (i < progressSteps) {
      // Variable delay - slower at start, faster in middle, slower at end
      const progress = i / progressSteps;
      let delay: number;
      
      if (progress < 0.1) {
        delay = 200 + Math.random() * 300; // Slow start
      } else if (progress < 0.9) {
        delay = 50 + Math.random() * 100;  // Fast middle
      } else {
        delay = 150 + Math.random() * 250; // Slow finish
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Generate a realistic upload ID
 */
export function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}