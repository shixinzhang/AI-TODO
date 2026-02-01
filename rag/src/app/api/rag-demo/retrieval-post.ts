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
    const cohereKey = options.cohereApiKey;
    if (!cohereKey) {
      return {
        error:
          "Missing COHERE_API_KEY. Please provide it in header 'x-cohere-api-key' or env.",
      };
    }
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
    const cohereRerank = new CohereRerank({
      apiKey: cohereKey as string,
      model: "rerank-english-v3.0",
      topN: 3,
    });
    const retriever = new ContextualCompressionRetriever({
      baseCompressor: cohereRerank,
      baseRetriever: baseRetriever,
      verbose: true,
    });
    const query = "LangChain 的核心价值";
    console.log(`--- Cohere Rerank: Invoking with query "${query}" ---`);
    const results = await retriever.invoke(query);
    console.log(`--- Cohere Rerank: Found ${results.length} results ---`);
    results.forEach((doc, i) => {
      console.log(
        `[Result ${i + 1}] (Score: ${doc.metadata.relevanceScore}) ${doc.pageContent.slice(0, 100)}...`
      );
    });
    return {
      type: "Cohere Re-ranking",
      query: "LangChain 的核心价值",
      matchCount: results.length,
      matches: results.map((d) => ({
        content: d.pageContent,
        metadata: d.metadata,
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
