import { NextRequest, NextResponse } from "next/server";
import { getRAGEngine } from "@/lib/rag";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const rag = await getRAGEngine();
    const { answer, sources } = await rag.chat(query);

    return NextResponse.json({ answer, sources });
  } catch (error: any) {
    // Handle expected "empty knowledge base" error gracefully
    if (error.message === "Knowledge base is empty. Please upload documents first.") {
      return NextResponse.json({ 
        answer: "📚 知识库为空，请先在右侧上传教师档案 PDF 文档，然后我才能回答您的问题。" 
      });
    }

    console.error("Chat error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
