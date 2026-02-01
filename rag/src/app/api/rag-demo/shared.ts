import path from "path";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";

/** 模拟数据目录 */
export const DATA_DIR = path.join(process.cwd(), "demo-data");

export function createEmbeddings(apiKey: string): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    apiKey: apiKey,
    configuration: {
      baseURL: "https://sg.uiuiapi.com/v1",
    },
  });
}

/** 统一创建 Chat LLM（temperature=0，baseURL 固定） */
export function createChatLLM(apiKey: string): ChatOpenAI {
  return new ChatOpenAI({
    temperature: 0,
    apiKey: apiKey,
    configuration: { baseURL: "https://sg.uiuiapi.com/v1" },
  });
}
