// Next.js API 路由类型定义
import type { NextApiRequest, NextApiResponse } from 'next'
// 导入 OpenAI SDK（DeepSeek 兼容 OpenAI API 格式）
import OpenAI from 'openai'
// 导入 DeepSeek API 配置
import { DEEPSEEK_API_KEY, DEEPSEEK_API_BASE_URL } from '@/lib/config'

/**
 * POST /api/samples/stream - 流式调用大模型 API
 * 
 * 使用 Server-Sent Events (SSE) 实现流式输出
 * 
 * 请求体：
 * {
 *   "prompt": "用户输入的提示词",
 *   "model": "deepseek-chat" // 可选，默认 deepseek-chat
 * }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    })
  }

  // 验证 DeepSeek API Key
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'DeepSeek API Key is not configured'
    })
  }

  try {
    // SiliconFlow 支持的模型列表，默认使用 GLM-4.7
    const { prompt, model = 'deepseek-ai/DeepSeek-V3.2-Exp' } = req.body

    // 验证参数
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'prompt is required and must be a non-empty string'
      })
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // 禁用 Nginx 缓冲

    // 初始化 OpenAI 客户端（使用 SiliconFlow API）
    const openai = new OpenAI({
      apiKey: DEEPSEEK_API_KEY,
      baseURL: DEEPSEEK_API_BASE_URL,
    })

    // 调用 SiliconFlow API，启用流式输出
    const stream = await openai.chat.completions.create({
      model, // 使用完整的模型路径，如 'Pro/zai-org/GLM-4.7'
      messages: [
        {
          role: 'user',
          content: prompt.trim(),
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      stream: true, // 启用流式输出
    })

    // 发送初始消息
    res.write(`data: ${JSON.stringify({ type: 'start', message: '开始生成...' })}\n\n`)

    // 处理流式响应
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      
      if (content) {
        // 发送数据块
        res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`)
      }
    }

    // 发送结束消息
    res.write(`data: ${JSON.stringify({ type: 'done', message: '生成完成' })}\n\n`)
    res.end()

  } catch (error: any) {
    console.error('Stream error:', error)
    
    // 获取详细的错误信息
    let errorMessage = '未知错误'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    // 如果是 OpenAI API 错误，尝试获取更多信息
    if (error?.status) {
      errorMessage = `API 错误 (${error.status}): ${errorMessage}`
      if (error?.response) {
        try {
          const errorData = await error.response.json()
          errorMessage += ` - ${JSON.stringify(errorData)}`
        } catch (e) {
          // 忽略 JSON 解析错误
        }
      }
    }
    
    // 发送错误消息
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: errorMessage
      })}\n\n`)
    }
    res.end()
  }
}

