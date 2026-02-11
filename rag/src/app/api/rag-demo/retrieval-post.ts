import path from "path";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { ContextualCompressionRetriever } from "@langchain/classic/retrievers/contextual_compression";
import { LLMChainExtractor } from "@langchain/classic/retrievers/document_compressors/chain_extract";
import { CohereRerank } from "@langchain/cohere";
import { ParentDocumentRetriever } from "@langchain/classic/retrievers/parent_document";
import { InMemoryStore } from "@langchain/core/stores";
import { DATA_DIR, createEmbeddings, createChatLLM } from "./shared";

export type RetrievalPostAction =
  | "retrieval-contextual-compression"
  | "retrieval-rerank"
  | "retrieval-parent-document";

export interface RetrievalPostOptions {
  apiKey: string;
  dataDir?: string;
  cohereApiKey?: string | null;
}

export async function handleRetrievalPost(
  action: RetrievalPostAction,
  options: RetrievalPostOptions
): Promise<Record<string, unknown>> {
  const { apiKey, dataDir = DATA_DIR } = options;
  if (!apiKey) {
    throw new Error("Missing API Key");
  }

  if (action === "retrieval-contextual-compression") {
    const loader = new TextLoader(path.join(dataDir, "sample.txt"));
    const docs = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 200,
      chunkOverlap: 20,
    });
    const chunks = await splitter.splitDocuments(docs);
    const vectorStore = await MemoryVectorStore.fromDocuments(
      chunks,
      createEmbeddings(apiKey)
    );
    const baseRetriever = vectorStore.asRetriever();
    const llm = createChatLLM(apiKey);
    const compressor = LLMChainExtractor.fromLLM(llm);
    const retriever = new ContextualCompressionRetriever({
      baseCompressor: compressor,
      baseRetriever: baseRetriever,
      verbose: true,
    });
    const query = "LangChain 的主要组件";
    console.log(
      `--- ContextualCompression: Invoking with query "${query}" ---`
    );
    const results = await retriever.invoke(query);
    console.log(
      `--- ContextualCompression: Found ${results.length} results ---`
    );
    results.forEach((doc, i) => {
      console.log(`[Result ${i + 1}] ${doc.pageContent.slice(0, 100)}...`);
    });
    return {
      type: "Contextual Compression",
      query: "LangChain 的主要组件",
      matchCount: results.length,
      matches: results.map((d) => d.pageContent),
    };
  }

  if (action === "retrieval-rerank") {
    const loader = new TextLoader(path.join(dataDir, "sample.txt"));
    const docs = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 200,
      chunkOverlap: 20,
    });
    const chunks = await splitter.splitDocuments(docs);
    const vectorStore = await MemoryVectorStore.fromDocuments(
      chunks,
      createEmbeddings(apiKey)
    );
    const baseRetriever = vectorStore.asRetriever(10);
    
    // Custom Rerank using LLM
    const llm = createChatLLM(apiKey);
    
    const query = "LangChain 的核心价值";
    console.log(`--- LLM Rerank: Invoking with query "${query}" ---`);
    
    // 1. First retrieval (Recall)
    const initialDocs = await baseRetriever.invoke(query);
    console.log(`--- LLM Rerank: Initial recall count: ${initialDocs.length} ---`);

    // 2. Rerank Logic
    const rerankedDocs = [];
    for (const doc of initialDocs) {
      const prompt = `
      你是一个文档相关性评分专家。
      请判断以下文档片段与用户问题的相关性，并给出 0-10 的评分。
      
      用户问题: ${query}
      文档片段: ${doc.pageContent}
      
      请只输出一个数字（0-10），不要包含其他文字。
      `;
      
      try {
        const scoreStr = await llm.invoke(prompt);
        // Extract number from response
        const scoreMatch = typeof scoreStr === 'string' ? scoreStr.match(/\d+(\.\d+)?/) : String(scoreStr.content).match(/\d+(\.\d+)?/);
        const score = scoreMatch ? parseFloat(scoreMatch[0]) : 0;
        
        console.log(`[Score: ${score}] ${doc.pageContent.slice(0, 50)}...`);
        
        if (score >= 6) { // Filter threshold
          doc.metadata.relevanceScore = score;
          rerankedDocs.push(doc);
        }
      } catch (e) {
        console.error("Rerank error for doc:", e);
      }
    }

    // Sort by score desc
    rerankedDocs.sort((a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore);
    const topDocs = rerankedDocs.slice(0, 3); // Top 3

    console.log(`--- LLM Rerank: Final count after rerank: ${topDocs.length} ---`);
    topDocs.forEach((doc, i) => {
      console.log(
        `[Result ${i + 1}] (Score: ${doc.metadata.relevanceScore}) ${doc.pageContent.slice(0, 100)}...`
      );
    });

    return {
      type: "LLM Re-ranking (Custom)",
      query: query,
      initialCount: initialDocs.length,
      finalCount: topDocs.length,
      matches: topDocs.map((d) => ({
        content: d.pageContent,
        score: d.metadata.relevanceScore,
      })),
    };
  }

  if (action === "retrieval-parent-document") {
    const loader = new TextLoader(path.join(dataDir, "sample.txt"));
    const docs = await loader.load();
    const vectorStore = new MemoryVectorStore(createEmbeddings(apiKey));
    const docstore = new InMemoryStore();
    const parentSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const childSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 100,
      chunkOverlap: 10,
    });
    const retriever = new ParentDocumentRetriever({
      vectorstore: vectorStore,
      docstore: docstore,
      parentSplitter: parentSplitter,
      childSplitter: childSplitter,
      childK: 3,
      parentK: 1,
      verbose: true,
    });
    console.log("--- ParentDocumentRetriever: Adding documents ---");
    await retriever.addDocuments(docs);
    const query = "LangChain";
    console.log(
      `--- ParentDocumentRetriever: Invoking with query "${query}" ---`
    );
    const results = await retriever.invoke(query);
    console.log(
      `--- ParentDocumentRetriever: Found ${results.length} results ---`
    );
    results.forEach((doc, i) => {
      console.log(`[Result ${i + 1}] ${doc.pageContent.slice(0, 100)}...`);
    });
    return {
      type: "Parent Document Retriever",
      query: "LangChain",
      matchCount: results.length,
      matches: results.map((d) => ({
        content: d.pageContent.slice(0, 200) + "...",
        fullLength: d.pageContent.length,
      })),
    };
  }

  return { error: "Unknown retrieval-post action" };
}
