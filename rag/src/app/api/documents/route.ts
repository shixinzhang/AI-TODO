import { NextRequest, NextResponse } from "next/server";
import { getRAGEngine } from "@/lib/rag";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");

    const rag = await getRAGEngine();
    const result = await rag.getDocuments(page, pageSize); 
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Documents fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
