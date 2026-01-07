import { streamText } from 'ai';
import { deepseek } from '@/lib/ai/models';

/**
 * POST /api/ai-sdk/completion - useCompletion Hook 演示 API
 * 
 * 这个 API 展示了如何使用 Vercel AI SDK 的 streamText 函数
 * 来支持前端的 useCompletion Hook。
 * 
 * 核心功能：
 * 1. streamText - 流式文本生成
 * 2. 单次输入输出，不需要消息历史
 * 3. 适合文本补全、代码生成等场景
 * 
 * 与 chat API 的区别：
 * - chat 需要 messages 数组（对话历史）
 * - completion 只需要 prompt（单次输入）
 * 
 * 使用方式：
 * 前端使用 useCompletion Hook，指定 api: '/api/ai-sdk/completion'
 * SDK 会自动处理所有请求和响应
 * 
 * 注意：使用 Edge Runtime 以支持直接返回 Response 对象
 */
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      { 
        status: 405,
        headers: { 'Allow': 'POST', 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const { prompt }: { prompt: string } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'prompt is required and must be a string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 使用 streamText 生成流式响应
    // 注意：这里使用 prompt 而不是 messages
    const result = await streamText({
      model: deepseek,
      prompt,
      system: '你是一个专业的文本生成助手，能够根据提示词生成高质量的内容。',
    });

    // 将结果转换为 useCompletion 需要的格式
    // toTextStreamResponse() 会自动处理所有格式转换
    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('Completion API error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

