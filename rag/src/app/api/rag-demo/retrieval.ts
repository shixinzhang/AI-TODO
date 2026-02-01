import path from "path";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { DATA_DIR, createEmbeddings } from "./shared";

export async function handleRetrieval(
  apiKey: string,
  dataDir: string = DATA_DIR
): Promise<Record<string, unknown>> {
  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY environment variable or x-openai-api-key header"
    );
  }
  const rLoader = new TextLoader(path.join(dataDir, "sample.txt"));
  const rDocs = await rLoader.load();
  const rSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 50,
    chunkOverlap: 10,
  });
  const rChunks = await rSplitter.splitDocuments(rDocs);
  const vectorStore = await MemoryVectorStore.fromDocuments(
    rChunks,
    createEmbeddings(apiKey)
  );
  const retriever = vectorStore.asRetriever();
  const query = "LangChain";
  console.log(`--- Basic Retrieval: Invoking with query "${query}" ---`);
  const retrievedDocs = await retriever.invoke(query);
  console.log(
    `--- Basic Retrieval: Found ${retrievedDocs.length} results ---`
  );
  retrievedDocs.forEach((doc, i) => {
    console.log(`[Result ${i + 1}] ${doc.pageContent.slice(0, 100)}...`);
  });
  return {
    type: "Retrieval",
    query: "LangChain",
    matchCount: retrievedDocs.length,
    matches: retrievedDocs.map((d: Document) => d.pageContent),
  };
}
