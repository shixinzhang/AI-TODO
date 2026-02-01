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
      query: "生成一个虚构的用户画像，包含 name, age, interests",
    });
    return {
      type: "Generation (JSON)",
      query: "生成一个虚构的用户画像...",
      output: jsonResult,
    };
  }

  if (action === "generation") {
    const llm = createChatLLM(apiKey);
    const prompt = PromptTemplate.fromTemplate(
      "Answer the question based on the context.\nContext: {context}\nQuestion: {question}"
    );
    const chain = prompt
      .pipe(llm)
      .pipe(new StringOutputParser());
    const answer = await chain.invoke({
      context: "RAG stands for Retrieval-Augmented Generation.",
      question: "What does RAG stand for?",
    });
    return {
      type: "Generation",
      question: "What does RAG stand for?",
      context: "RAG stands for Retrieval-Augmented Generation.",
      answer: answer,
    };
  }

  return { error: "Unknown generation action" };
}
