import { streamText, UIMessage } from 'ai';
import { deepseek } from '@/lib/ai/models';

/**
 * POST /api/ai-sdk/chat - useChat Hook 演示 API
 * 
 * 这个 API 展示了如何使用 Vercel AI SDK 的 streamText 函数
 * 来支持前端的 useChat Hook。
 * 
 * 核心功能：
 * 1. streamText - 流式文本生成，实时返回结果
 * 2. 自动处理消息历史
 * 3. 自动转换为 useChat 需要的格式
 * 
 * 使用方式：
 * 前端使用 useChat Hook，指定 api: '/api/ai-sdk/chat'
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
    const { messages }: { messages: UIMessage[] }  = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 将 UI 消息格式转换为标准的 Model 消息格式
    // useChat 发送的是 UI 消息格式（带 parts），需要转换为标准格式
    // 标准格式: { role: 'user' | 'assistant' | 'system', content: string }
    const modelMessages = messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => {
        // 提取文本内容
        let content = '';
        if (msg.parts && Array.isArray(msg.parts)) {
          // 从 parts 中提取文本
          content = msg.parts
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text || '')
            .join('');
        } else if (typeof (msg as any).content === 'string') {
          content = (msg as any).content;
        }
        
        return {
          role: msg.role as 'user' | 'assistant',
          content: content || ''
        };
      })
      .filter(msg => msg.content.trim().length > 0); // 过滤空消息

      console.log('chat_ before streamText', modelMessages);
    // 使用 streamText 生成流式响应
    // streamText 会自动处理消息历史，并生成流式输出
    const result = await streamText({
      model: deepseek,
      messages: modelMessages,
      system: '你是一个友好的 AI 助手，擅长用简洁明了的方式回答问题。',
    });

    console.log('chat_ after streamText', result);
    // 将结果转换为 useChat 需要的格式
    // toUIMessageStreamResponse() 会自动处理所有格式转换
    return result.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

