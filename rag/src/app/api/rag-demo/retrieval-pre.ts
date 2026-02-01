import path from "path";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { MultiQueryRetriever } from "@langchain/classic/retrievers/multi_query";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { DATA_DIR, createEmbeddings, createChatLLM } from "./shared";

export type RetrievalPreAction = "retrieval-multi-query" | "retrieval-hyde";

export async function handleRetrievalPre(
  action: RetrievalPreAction,
  apiKey: string,
  dataDir: string = DATA_DIR
): Promise<Record<string, unknown>> {
  if (!apiKey) {
    throw new Error("Missing API Key");
  }

  if (action === "retrieval-multi-query") {
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
    const llm = createChatLLM(apiKey);
    console.log("--- MultiQueryRetriever: Initializing ---");
    const retriever = MultiQueryRetriever.fromLLM({
      retriever: vectorStore.asRetriever(),
      llm: llm,
      verbose: true,
    });
    const query = "RAG 框架";
    console.log(
      `--- MultiQueryRetriever: Invoking with query "${query}" ---`
    );
    const results = await retriever.invoke(query);
    console.log(`--- MultiQueryRetriever: Found ${results.length} results ---`);
    results.forEach((doc, i) => {
      console.log(`[Result ${i + 1}] ${doc.pageContent.slice(0, 100)}...`);
    });
    return {
      type: "MultiQueryRetriever",
      query: "RAG 框架",
      matchCount: results.length,
      matches: results.map((d) => d.pageContent),
    };
  }

  if (action === "retrieval-hyde") {
    const loader = new TextLoader(path.join(dataDir, "sample.txt"));
    const docs = await loader.load();
    const chunks = await new RecursiveCharacterTextSplitter({
      chunkSize: 50,
      chunkOverlap: 10,
    }).splitDocuments(docs);
    const vectorStore = await MemoryVectorStore.fromDocuments(
      chunks,
      createEmbeddings(apiKey)
    );
    const baseRetriever = vectorStore.asRetriever();
    const llm = createChatLLM(apiKey);
    const template =
      "请撰写一段与以下问题相关的回答（假设）：\n问题：{question}\n回答：";
    const promptHyde = ChatPromptTemplate.fromTemplate(template);
    const hydeChain = RunnableSequence.from([
      promptHyde,
      llm,
      new StringOutputParser(),
      (generatedDoc: string) => {
        console.log(
          `--- HyDE Generated Document: ---\n${generatedDoc}\n------------------------------`
        );
        return baseRetriever.invoke(generatedDoc);
      },
    ]);
    const query = "LangChain 的作用";
    console.log(`--- HyDE: Invoking with query "${query}" ---`);
    const results = await hydeChain.invoke({ question: query });
    console.log(`--- HyDE: Found ${results.length} results ---`);
    results.forEach((doc, i) => {
      console.log(`[Result ${i + 1}] ${doc.pageContent.slice(0, 100)}...`);
    });
    return {
      type: "HyDE Retrieval",
      query: "LangChain 的作用",
      matchCount: results.length,
      matches: results.map((d) => d.pageContent),
    };
  }

  return { error: "Unknown retrieval-pre action" };
}
