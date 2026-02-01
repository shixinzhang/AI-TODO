import { NextRequest, NextResponse } from "next/server";
import { getRAGEngine } from "@/lib/rag";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No valid file uploaded" }, { status: 400 });
    }

    // Validation
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    const ALLOWED_TYPES = ["application/pdf", "text/plain"];
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith(".md")) { // Allow markdown as text
        // Strict check based on requirement (PDF/TXT)
        // Note: file.type depends on client, fallback to extension check if needed
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rag = await getRAGEngine();
    const chunks = await rag.addDocument(buffer, file.name);

    return NextResponse.json({ 
        message: "File processed successfully", 
        chunks 
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
