import { NextResponse } from "next/server";
import { getRAGEngine } from "@/lib/rag";

export async function GET() {
  try {
    const rag = await getRAGEngine();
    // Add a dummy document to force collection creation
    const buffer = Buffer.from("Milvus Collection Initialized. This is a system document.", "utf-8");
    await rag.addDocument(buffer, "system_init.txt");
    
    return NextResponse.json({ message: "Collection initialized successfully" });
  } catch (error: any) {
    console.error("Init DB Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
