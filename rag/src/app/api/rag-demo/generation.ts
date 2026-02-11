import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser, JsonOutputParser } from "@langchain/core/output_parsers";
import { createChatLLM } from "./shared";

export type GenerationAction = "generation" | "generation-json";

export async function handleGeneration(
  action: GenerationAction,
  apiKey: string
): Promise<Record<string, unknown>> {
  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY environment variable or x-openai-api-key header"
    );
  }

  if (action === "generation-json") {
    const llm = createChatLLM(apiKey);
    const parser = new JsonOutputParser();
    const prompt = new PromptTemplate({
      template:
        "回答用户问题。\n{format_instructions}\n必须严格按照 JSON 格式输出，不要包含任何其他文字。\n问题：{query}",
      inputVariables: ["query"],
      partialVariables: {
        format_instructions: parser.getFormatInstructions(),
      },
    });
    const chain = prompt.pipe(llm).pipe(parser);
    const jsonResult = await chain.invoke({
      query: "生成一个虚构的电商用户画像，包含 name, age, recent_purchases, preference",
    });
    return {
      type: "Generation (JSON)",
      query: "生成一个虚构的电商用户画像...",
      output: jsonResult,
    };
  }

  if (action === "generation") {
    const llm = createChatLLM(apiKey);
    const prompt = PromptTemplate.fromTemplate(
      "你是一名专业的电商智能客服。请基于以下上下文（商品信息或政策）回答用户问题。\n如果不知道，请礼貌地引导用户转人工。\n上下文：{context}\n用户问题：{question}"
    );
    const chain = prompt
      .pipe(llm)
      .pipe(new StringOutputParser());
    const answer = await chain.invoke({
      context: "商品名称: 极客降噪耳机 Pro\n价格: 1299\n核心卖点: 40dB主动降噪，30小时续航",
      question: "这款耳机续航多久？",
    });
    return {
      type: "Generation",
      question: "这款耳机续航多久？",
      context: "商品名称: 极客降噪耳机 Pro...",
      answer: answer,
    };
  }

  return { error: "Unknown generation action" };
}
