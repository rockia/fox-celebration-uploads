import { NextRequest, NextResponse } from "next/server";
import { 
  simulateDelay, 
  simulateFailure, 
  getRandomError, 
  generateUploadId,
  UploadUrlRequestSchema
} from "../utils/mock-helpers";

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body with Zod
    const body = await req.json().catch(() => ({}));
    
    // Validate request body using Zod schema
    const validationResult = UploadUrlRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json({ 
        error: firstError.message,
        field: firstError.path.join('.'),
        details: validationResult.error.issues
      }, { status: 400 });
    }
    
    // Simulate network delay
    await simulateDelay({ 
      minDelay: 200, 
      maxDelay: 800 
    });
    
    // Simulate very rare failures for URL generation (should be highly reliable)
    if (simulateFailure({ failureRate: 0.01 })) { // 1% failure rate - URL generation should rarely fail
      const error = getRandomError();
      return NextResponse.json({ 
        error: error.message 
      }, { status: error.status });
    }
    
    // Generate upload URL
    const id = generateUploadId();
    const uploadUrl = `/api/upload/${id}`;
    
    
    return NextResponse.json({ id, uploadUrl });
  } catch (e: unknown) {
    console.error('❌ Upload URL generation failed:', e);
    return NextResponse.json({ 
      error: e instanceof Error ? e.message : "Failed to generate upload URL" 
    }, { status: 500 });
  }
}
