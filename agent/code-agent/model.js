// model.js
import "dotenv/config";
import { ChatOpenAICompletions, ChatOpenAIResponses } from "@langchain/openai";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { logger } from "./logger.js";

const modelName = process.env.OPENAI_MODEL || "gpt-5-codex-high";
const timeoutMsRaw = Number.parseInt(process.env.OPENAI_TIMEOUT_MS || "120000", 10);
const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 120000;
const useResponsesApi = (process.env.OPENAI_USE_RESPONSES_API || "false").toLowerCase() === "true";

const llmLog = BaseCallbackHandler.fromMethods({
  handleLLMStart(llm, prompts, runId, parentRunId, extraParams) {
    const inv = extraParams?.invocation_params;
    logger.info("========== LLM.REQUEST ==========", {
      runId,
      parentRunId,
      llm: llm?.id,
      model: modelName,
      baseURL: process.env.OPENAI_API_BASE_URL,
      timeoutMs,
      promptCount: Array.isArray(prompts) ? prompts.length : 0,
      promptChars: Array.isArray(prompts) ? prompts.join("\n").length : undefined,
      promptPreview: Array.isArray(prompts) ? truncate(prompts.join("\n"), 280) : undefined,
      invocation: inv
        ? {
            model: inv.model,
            temperature: inv.temperature,
            stream: inv.stream,
            max_tokens: inv.max_tokens,
            tool_choice: inv.tool_choice,
            toolsCount: Array.isArray(inv.tools) ? inv.tools.length : undefined,
          }
        : undefined,
      extraKeys: extraParams ? Object.keys(extraParams) : [],
    });
  },
  handleChatModelStart(llm, messages, runId, parentRunId, extraParams) {
    const inv = extraParams?.invocation_params;
    const flat = Array.isArray(messages)
      ? messages.flat().map((m) => {
          const type = typeof m?._getType === "function" ? m._getType() : undefined;
          const content = typeof m?.content === "string" ? m.content : JSON.stringify(m?.content);
          return {
            type,
            contentLength: typeof content === "string" ? content.length : undefined,
            preview: typeof content === "string" ? truncate(content, 140) : undefined,
          };
        })
      : [];
    logger.info("========== LLM.CHAT_REQUEST ==========", {
      runId,
      parentRunId,
      llm: llm?.id,
      model: modelName,
      baseURL: process.env.OPENAI_API_BASE_URL,
      timeoutMs,
      messageCount: flat.length,
      messages: flat.slice(0, 8),
      invocation: inv
        ? {
            model: inv.model,
            temperature: inv.temperature,
            stream: inv.stream,
            max_tokens: inv.max_tokens,
            tool_choice: inv.tool_choice,
            toolsCount: Array.isArray(inv.tools) ? inv.tools.length : undefined,
          }
        : undefined,
      extraKeys: extraParams ? Object.keys(extraParams) : [],
    });
  },
  handleLLMEnd(output, runId, parentRunId) {
    const gen0 = output?.generations?.[0]?.[0];
    const content =
      typeof gen0?.message?.content === "string"
        ? gen0.message.content
        : typeof gen0?.text === "string"
        ? gen0.text
        : undefined;
    const toolCalls = gen0?.message?.additional_kwargs?.tool_calls;
    logger.info("========== LLM.RESPONSE ==========", {
      runId,
      parentRunId,
      model: modelName,
      hasToolCalls: Array.isArray(toolCalls) ? toolCalls.length > 0 : Boolean(toolCalls),
      outputChars: typeof content === "string" ? content.length : undefined,
      outputPreview: typeof content === "string" ? truncate(content, 280) : undefined,
      generations: Array.isArray(output?.generations) ? output.generations.length : undefined,
    });
  },
  handleLLMError(err, runId, parentRunId) {
    logger.error("========== LLM.ERROR ==========", {
      runId,
      parentRunId,
      model: modelName,
      message: err?.message,
      name: err?.name,
    });
  },
});

const ModelClass = useResponsesApi ? ChatOpenAIResponses : ChatOpenAICompletions;

export const model = new ModelClass({
  model: modelName,
  apiKey: process.env.OPENAI_API_KEY,
  timeout: timeoutMs,
  maxRetries: 0,
  callbacks: [llmLog],
  configuration: process.env.OPENAI_API_BASE_URL
    ? {
        basePath: process.env.OPENAI_API_BASE_URL,
        baseURL: process.env.OPENAI_API_BASE_URL,
      }
    : undefined,
  temperature: 0,
});

logger.info("model.init", {
  model: modelName,
  baseURL: process.env.OPENAI_API_BASE_URL,
  timeoutMs,
  useResponsesApi,
  hasBaseURL: Boolean(process.env.OPENAI_API_BASE_URL),
  hasApiKey: Boolean(process.env.OPENAI_API_KEY),
});

function truncate(text, maxLen) {
  if (typeof text !== "string") return text;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

// 验证一下（直接运行此文件时）
if (process.argv[1]?.endsWith("model.js")) {
  logger.info("model.selftest.start");
  const result = await model.invoke([
    { role: "user", content: "用一句话介绍你自己" },
  ]);
  console.log(result.content);
  logger.info("model.selftest.done", {
    outputLength: typeof result?.content === "string" ? result.content.length : undefined,
  });
}
