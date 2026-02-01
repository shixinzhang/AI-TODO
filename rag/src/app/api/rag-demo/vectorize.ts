import path from "path";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { DATA_DIR, createEmbeddings } from "./shared";

export type VectorizeAction = "embedding" | "vector-store-memory" | "vector-store-chroma";

export async function handleVectorize(
  action: VectorizeAction,
  apiKey: string,
  dataDir: string = DATA_DIR
): Promise<Record<string, unknown>> {
  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY environment variable or x-openai-api-key header"
    );
  }

  switch (action) {
    case "embedding": {
      const embeddings = createEmbeddings(apiKey);
      const vector = await embeddings.embedQuery("Hello RAG");
      return {
        type: "OpenAIEmbeddings",
        model: "text-embedding-3-small",
        vectorLength: vector.length,
        vectorPreview: vector.slice(0, 5),
      };
    }

    case "vector-store-memory": {
      const loader = new TextLoader(path.join(dataDir, "sample.txt"));
      const docs = await loader.load();
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 50,
        chunkOverlap: 10,
      });
      const chunks = await splitter.splitDocuments(docs);
      const vectorStore = await MemoryVectorStore.fromDocuments(
        chunks,
        createEmbeddings(apiKey)
      );
      const results = await vectorStore.similaritySearch("RAG", 1);
      return {
        type: "MemoryVectorStore",
        status: "Success",
        storedCount: chunks.length,
        searchTest: results[0].pageContent,
      };
    }

    case "vector-store-chroma": {
      try {
        const loader = new TextLoader(path.join(dataDir, "sample.txt"));
        const docs = await loader.load();
        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: 50,
          chunkOverlap: 10,
        });
        const chunks = await splitter.splitDocuments(docs);
        const vectorStore = await Chroma.fromDocuments(
          chunks,
          createEmbeddings(apiKey),
          { collectionName: "rag-demo-collection" }
        );
        const results = await vectorStore.similaritySearch("LangChain", 1);
        return {
          type: "Chroma",
          status: "Success (Service Connected)",
          searchTest: results[0].pageContent,
        };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return {
          type: "Chroma",
          status: "Failed (Is ChromaDB running?)",
          error: message,
        };
      }
    }

    default:
      return { error: "Unknown vectorize action" };
  }
}
