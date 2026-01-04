import type { NextApiRequest, NextApiResponse } from 'next';
import { streamText } from 'ai';
import { deepseek, gemini } from '@/lib/ai/models';

/**
 * POST /api/chat/multimodal - 多模态聊天 API（使用 Vercel AI SDK）
 * 
 * 支持：
 * - 文本对话（DeepSeek）
 * - 图片理解（Gemini）
 * - 附件上传
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
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // 检查最后一条消息是否包含图片
    const lastMessage = messages[messages.length - 1];
    const hasImage = lastMessage?.attachments?.some(
      (attachment: any) => attachment.contentType?.startsWith('image/')
    );

    // 如果有图片，使用 Gemini（支持视觉）；否则使用 DeepSeek（更便宜）
    const model = hasImage ? gemini : deepseek;

    const result = await streamText({
      model,
      messages,
      system: hasImage
        ? '你是一个视觉理解专家，能够准确描述图片内容。'
        : '你是一个有帮助的 AI 助手。',
    });

    // 将 Vercel AI SDK 的 Response 转换为 Next.js 响应
    const response = result.toDataStreamResponse();
    
    // 设置响应头（Vercel AI SDK 使用 text/plain; charset=utf-8）
    const contentType = response.headers.get('Content-Type') || 'text/plain; charset=utf-8';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲

    // 流式传输响应体
    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: 'Failed to create stream' });
    }

    const decoder = new TextDecoder();

    // 流式传输数据
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
      res.end();
    } catch (streamError: any) {
      console.error('Stream error:', streamError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      } else {
        res.end();
      }
    }
  } catch (error: any) {
    console.error('Chat API error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}

