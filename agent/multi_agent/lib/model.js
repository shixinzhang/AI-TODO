import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { logger } from "./logger.js";

const modelName  = process.env.OPENAI_MODEL     || "gpt-4o";
const timeoutRaw = Number.parseInt(process.env.OPENAI_TIMEOUT_MS || "120000", 10);
const timeoutMs  = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 120000;

export function createModel(options = {}) {
  return new ChatOpenAI({
    model: modelName,
    apiKey: process.env.OPENAI_API_KEY,
    timeout: timeoutMs,
    maxRetries: 0,
    temperature: 0,
    configuration: process.env.OPENAI_API_BASE_URL
      ? { baseURL: process.env.OPENAI_API_BASE_URL }
      : undefined,
    ...options,
  });
}

logger.info("model.init", {
  model: modelName,
  baseURL: process.env.OPENAI_API_BASE_URL,
  timeoutMs,
  hasApiKey: Boolean(process.env.OPENAI_API_KEY),
});
