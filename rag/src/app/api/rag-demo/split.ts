import path from "path";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import {
  RecursiveCharacterTextSplitter,
  CharacterTextSplitter,
  TokenTextSplitter,
} from "@langchain/textsplitters";
import { DATA_DIR } from "./shared";

export async function handleSplitText(
  dataDir: string = DATA_DIR
): Promise<Record<string, unknown>> {
  const splitterLoader = new TextLoader(path.join(dataDir, "sample.txt"));
  const docsToSplit = await splitterLoader.load();

  const recursiveSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 50,
    chunkOverlap: 10,
  });
  const recursiveChunks =
    await recursiveSplitter.splitDocuments(docsToSplit);

  const charSplitter = new CharacterTextSplitter({
    separator: "\n",
    chunkSize: 50,
    chunkOverlap: 10,
  });
  const charChunks = await charSplitter.splitDocuments(docsToSplit);

  const tokenSplitter = new TokenTextSplitter({
    encodingName: "cl100k_base",
    chunkSize: 20,
    chunkOverlap: 5,
  });
  const tokenChunks = await tokenSplitter.splitDocuments(docsToSplit);

  return {
    type: "Text Splitters Comparison",
    originalLength: docsToSplit[0].pageContent.length,
    recursive: {
      desc: "智能递归切分 (推荐)",
      count: recursiveChunks.length,
      preview: recursiveChunks.map((c) => c.pageContent),
    },
    character: {
      desc: "简单字符切分",
      count: charChunks.length,
      preview: charChunks.map((c) => c.pageContent),
    },
    token: {
      desc: "Token 切分 (适合 LLM)",
      count: tokenChunks.length,
      preview: tokenChunks.map((c) => c.pageContent),
    },
  };
}
