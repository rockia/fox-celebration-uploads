import { NextRequest, NextResponse } from "next/server";
import { 
  simulateDelay, 
  simulateFailure, 
  getRandomError,
  UploadCompleteRequestSchema,
  UploadIdSchema
} from "../../utils/mock-helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    
    // Validate upload ID parameter
    const idValidation = UploadIdSchema.safeParse(resolvedParams.id);
    if (!idValidation.success) {
      return NextResponse.json({ 
        error: "Invalid upload ID format",
        details: idValidation.error.issues
      }, { status: 400 });
    }
    
    // Parse and validate request body with Zod
    const body = await req.json().catch(() => ({}));
    
    // Validate request body using Zod schema
    const validationResult = UploadCompleteRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json({ 
        error: firstError.message,
        field: firstError.path.join('.'),
        details: validationResult.error.issues
      }, { status: 400 });
    }
    
    const { success, error } = validationResult.data;

    // Simulate post-processing delay (thumbnails, virus scanning, etc.)
    await simulateDelay({ 
      minDelay: 50, 
      maxDelay: 300 
    });

    // Simulate occasional post-processing failures
    if (simulateFailure({ failureRate: 0.02 })) { // 2% failure rate
      const processingError = getRandomError();
      console.error(`❌ Post-processing failed for ${resolvedParams.id}: ${processingError.message}`);
      return NextResponse.json({ 
        error: `Post-processing failed: ${processingError.message}` 
      }, { status: processingError.status });
    }

    // Handle failure notifications from client
    if (!success && error) {
      console.error(`📝 Upload failure notification for ${resolvedParams.id}: ${error}`);
      // Log the failure but still return success since notification was received
    } else {
      
      // Simulate additional post-processing tasks
      setTimeout(() => {
      }, 100);
    }

    return new NextResponse(null, { status: 200 });
  } catch (e: unknown) {
    const resolvedParams = await params;
    console.error(`❌ Completion notification failed for ${resolvedParams.id}:`, e);
    return NextResponse.json({ 
      error: e instanceof Error ? e.message : "Completion notification failed" 
    }, { status: 500 });
  }
}
