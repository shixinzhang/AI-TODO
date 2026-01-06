import type { NextApiRequest, NextApiResponse } from 'next';
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
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required and must be a string' });
    }

    // 使用 streamText 生成流式响应
    // 注意：这里使用 prompt 而不是 messages
    const result = await streamText({
      model: deepseek,
      prompt,
      system: '你是一个专业的文本生成助手，能够根据提示词生成高质量的内容。',
    });

    // 转换为 useCompletion 需要的格式
    const response = result.toDataStreamResponse();
    
    // 设置响应头
    const contentType = response.headers.get('Content-Type') || 'text/plain; charset=utf-8';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 流式传输响应体
    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: 'Failed to create reader' });
    }

    // 将流式数据传递给客户端
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } catch (error) {
        console.error('Stream error:', error);
        res.end();
      }
    };

    pump();

  } catch (error: any) {
    console.error('Completion API error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}

