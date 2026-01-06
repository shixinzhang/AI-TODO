import type { NextApiRequest, NextApiResponse } from 'next';
import { streamText } from 'ai';
import { z } from 'zod';
import { deepseek } from '@/lib/ai/models';

/**
 * POST /api/ai-sdk/tools - Tools/Function Calling 演示 API
 * 
 * 这个 API 展示了如何使用 Vercel AI SDK 的 Tools 功能。
 * 
 * 核心功能：
 * 1. 定义工具（tools）- 使用 zod schema 定义参数
 * 2. 实现工具函数（tool functions）
 * 3. AI 自动决定何时调用工具
 * 4. 工具执行结果返回给 AI，AI 基于结果生成回复
 * 
 * Tools 的优势：
 * - AI 可以获取实时数据（天气、时间等）
 * - AI 可以执行操作（发送邮件、创建任务等）
 * - AI 可以调用外部 API
 * - 实现更复杂的功能
 * 
 * 使用方式：
 * 前端使用 useChat Hook，指定 api: '/api/ai-sdk/tools'
 * AI 会自动识别需要调用工具的场景
 */

// 获取当前时间的工具
const getCurrentTime = {
  description: '获取当前北京时间',
  parameters: z.object({}),
  execute: async () => {
    // 获取北京时间（UTC+8）
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return {
      time: beijingTime.toLocaleString('zh-CN', { 
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      timestamp: beijingTime.getTime(),
    };
  },
};

// 计算数学表达式的工具
const calculate = {
  description: '计算数学表达式，支持加减乘除和基本数学函数',
  parameters: z.object({
    expression: z.string().describe('要计算的数学表达式，例如：123 * 456'),
  }),
  execute: async ({ expression }: { expression: string }) => {
    try {
      // 安全的数学表达式计算
      // 只允许数字、运算符和基本数学函数
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
      if (sanitized !== expression.replace(/\s/g, '')) {
        throw new Error('表达式包含非法字符');
      }
      // 使用 eval 计算（仅用于演示，实际项目中应使用更安全的计算库）
      // eslint-disable-next-line no-eval
      const result = eval(sanitized);
      return {
        expression,
        result,
        success: true,
      };
    } catch (error: any) {
      return {
        expression,
        error: error.message,
        success: false,
      };
    }
  },
};

// 获取天气信息的工具（模拟）
const getWeather = {
  description: '获取指定城市的天气信息',
  parameters: z.object({
    city: z.string().describe('城市名称，例如：北京、上海'),
  }),
  execute: async ({ city }: { city: string }) => {
    // 模拟天气数据（实际项目中应该调用真实的天气 API）
    const weatherData: Record<string, any> = {
      北京: { temperature: '15°C', condition: '晴', humidity: '45%' },
      上海: { temperature: '18°C', condition: '多云', humidity: '60%' },
      深圳: { temperature: '25°C', condition: '晴', humidity: '70%' },
    };
    
    const weather = weatherData[city] || { 
      temperature: '20°C', 
      condition: '未知', 
      humidity: '50%' 
    };
    
    return {
      city,
      ...weather,
      note: '这是模拟数据，实际项目中应该调用真实的天气 API',
    };
  },
};

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

    // 使用 streamText 并配置 tools
    // AI 会根据用户的问题自动决定是否需要调用工具
    const result = await streamText({
      model: deepseek,
      messages,
      system: '你是一个友好的 AI 助手。当用户询问时间、需要计算或查询天气时，使用相应的工具。',
      tools: {
        getCurrentTime,
        calculate,
        getWeather,
      },
    });

    // 转换为 useChat 需要的格式
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
    console.error('Tools API error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}

