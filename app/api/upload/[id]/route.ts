import { NextRequest, NextResponse } from "next/server";
import { 
  simulateDelay, 
  simulateFailure, 
  getRandomError,
  UploadIdSchema
} from "../../utils/mock-helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    
    const buf = await req.arrayBuffer();
    const bytes = buf.byteLength;

    // Validate file size
    if (bytes === 0) {
      return NextResponse.json({ 
        error: "Empty file not allowed" 
      }, { status: 400 });
    }

    // Simulate early failure (network issues, etc.)
    if (simulateFailure({ failureRate: 0.05 })) { // 5% failure rate
      const error = getRandomError();
      console.error(`❌ Upload failed for ${resolvedParams.id}: ${error.message}`);
      return NextResponse.json({ 
        error: error.message 
      }, { status: error.status });
    }

    // Simulate realistic upload processing time based on file size
    const baseDelay = 300;
    const sizeDelay = Math.min(bytes / (1024 * 1024) * 200, 2000); // 200ms per MB, max 2s
    const randomDelay = Math.random() * 500;
    const totalDelay = baseDelay + sizeDelay + randomDelay;

    
    await simulateDelay({ 
      minDelay: totalDelay * 0.8, 
      maxDelay: totalDelay * 1.2 
    });

    // Simulate late failure (storage issues, processing errors, etc.)
    if (simulateFailure({ failureRate: 0.03 })) { // 3% late failure rate
      const error = getRandomError();
      console.error(`❌ Upload processing failed for ${resolvedParams.id}: ${error.message}`);
      return NextResponse.json({ 
        error: error.message 
      }, { status: error.status });
    }

    return new NextResponse(null, { status: 200 });
  } catch (e: unknown) {
    const resolvedParams = await params;
    console.error(`❌ Upload failed for ${resolvedParams.id}:`, e);
    return NextResponse.json({ 
      error: e instanceof Error ? e.message : "Upload failed" 
    }, { status: 500 });
  }
}

// If you want to support POST + multipart instead:
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const resolvedParams = await ctx.params;
  const form = await req.formData();
  const f = form.get("file");
  const bytes = f instanceof File ? f.size : 0;
  await new Promise((r) => setTimeout(r, 300));
  return NextResponse.json({ ok: true, id: resolvedParams.id, bytes, via: "multipart" });
}
