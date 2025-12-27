// Next.js API 路由类型定义
import type { NextApiRequest, NextApiResponse } from 'next'
// 导入 OpenAI SDK（硅基流动兼容 OpenAI API 格式）
import OpenAI from 'openai'
// 导入 p-retry 用于重试
import pRetry from 'p-retry'
// 导入 tiktoken 用于计算 token
import { encodingForModel } from 'js-tiktoken'
// 导入配置
import { DEEPSEEK_API_KEY, DEEPSEEK_API_BASE_URL } from '@/lib/config'

// DeepSeek-V3.2 价格（元/百万tokens）
const INPUT_PRICE_PER_MILLION = 2
const OUTPUT_PRICE_PER_MILLION = 3

// 模型名称
const MODEL_NAME = 'deepseek-ai/DeepSeek-V3.2-Exp'

/**
 * POST /api/chat/stream - 流式调用硅基流动 AI 聊天 API
 * 
 * 使用 Server-Sent Events (SSE) 实现流式输出
 * 支持 p-retry 重试、token 计算、成本统计、429 错误处理
 * 
 * 请求体：
 * {
 *   "messages": [
 *     { "role": "user", "content": "用户消息" }
 *   ]
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

  // 验证 API Key
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'API Key is not configured'
    })
  }

  try {
    const { messages } = req.body

    // 验证参数
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'messages is required and must be a non-empty array'
      })
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // 禁用 Nginx 缓冲

    // 初始化 tiktoken 编码器（使用 gpt-4 编码，DeepSeek-V3.2 兼容）
    const encoding = encodingForModel('gpt-4')

    // 计算输入 token 数
    const inputText = messages.map(m => `${m.role}: ${m.content}`).join('\n')
    const inputTokens = encoding.encode(inputText).length

    // 计算输入成本
    const inputCost = (inputTokens / 1_000_000) * INPUT_PRICE_PER_MILLION

    // 初始化 OpenAI 客户端（使用硅基流动 API）
    const openai = new OpenAI({
      apiKey: DEEPSEEK_API_KEY,
      baseURL: DEEPSEEK_API_BASE_URL,
      timeout: 120000, // 120秒超时
    })

    // 使用 p-retry 包装 API 调用，处理重试逻辑
    let outputTokens = 0
    let outputText = ''

    await pRetry(
      async () => {
        try {
          // 调用硅基流动 API，启用流式输出
          const stream = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: messages.map((msg: any) => ({
              role: msg.role,
              content: msg.content,
            })),
            temperature: 0.8,
            max_tokens: 65535,
            // seed: 42, // 注释掉，稍后测试开启
            stream: true, // 启用流式输出
          })

          // 发送初始消息（包含 token 统计信息）
          const startMessage = {
            type: 'start',
            message: '开始生成...',
            stats: {
              inputTokens,
              inputCost: inputCost.toFixed(6),
            }
          }
          console.log('📤 [API] 发送 start 消息:', JSON.stringify(startMessage))
          res.write(`data: ${JSON.stringify(startMessage)}\n\n`)

          // 处理流式响应
          try {
            let chunkCount = 0
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || ''
              
              if (content) {
                outputText += content
                chunkCount++
                // 发送数据块
                const chunkMessage = { type: 'chunk', content }
                if (chunkCount % 10 === 0 || chunkCount <= 3) {
                  console.log(`📤 [API] 发送 chunk #${chunkCount}，内容长度: ${content.length}，累计输出: ${outputText.length}`)
                }
                res.write(`data: ${JSON.stringify(chunkMessage)}\n\n`)
              }
            }
            console.log(`📤 [API] 流式响应完成，共 ${chunkCount} 个 chunk，总输出长度: ${outputText.length}`)
          } catch (streamError: any) {
            // 流式读取过程中的错误
            if (streamError?.status === 429) {
              throw streamError // 重新抛出，让外层处理
            }
            throw streamError
          }

          // 计算输出 token 数和成本
          outputTokens = encoding.encode(outputText).length
          const outputCost = (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_MILLION
          const totalCost = inputCost + outputCost

          // 发送结束消息（包含完整的统计信息）
          const doneMessage = {
            type: 'done',
            message: '生成完成',
            stats: {
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
              inputCost: inputCost.toFixed(6),
              outputCost: outputCost.toFixed(6),
              totalCost: totalCost.toFixed(6),
            }
          }
          console.log('📤 [API] 发送 done 消息:', JSON.stringify(doneMessage))
          res.write(`data: ${JSON.stringify(doneMessage)}\n\n`)
          res.end()
          console.log('✅ [API] 响应流已结束')

        } catch (error: any) {
          // 处理 429 错误（限流）
          if (error?.status === 429) {
            // 从错误对象中获取 Retry-After 头
            // OpenAI SDK 的错误对象结构可能不同，尝试多种方式获取
            let retryAfter: string | undefined
            
            // 方式1: 从 error.headers 获取
            if (error?.headers?.['retry-after']) {
              retryAfter = error.headers['retry-after']
            }
            // 方式2: 从 error.response?.headers 获取
            else if (error?.response?.headers?.['retry-after']) {
              retryAfter = error.response.headers['retry-after']
            }
            // 方式3: 从 error.response?.headers?.get 获取
            else if (error?.response?.headers?.get) {
              retryAfter = error.response.headers.get('retry-after') || undefined
            }
            
            if (retryAfter) {
              const waitTime = parseInt(retryAfter) * 1000 // 转换为毫秒
              console.log(`触发限流，${waitTime}ms 后重试 (Retry-After: ${retryAfter})`)
              
              // 等待指定时间后抛出错误，让 p-retry 重试
              await new Promise(resolve => setTimeout(resolve, waitTime))
            } else {
              // 如果没有 Retry-After 头，等待 5 秒
              console.log('触发限流，但未找到 Retry-After 头，5秒后重试')
              await new Promise(resolve => setTimeout(resolve, 5000))
            }
            
            // 抛出错误，触发 p-retry 重试
            throw new Error(`Rate limit exceeded (429), retrying...`)
          }
          
          // 其他错误直接抛出
          throw error
        }
      },
      {
        retries: 5, // 最多重试 5 次
        onFailedAttempt: (error) => {
          console.log(`重试尝试 ${error.attemptNumber}/${error.retriesLeft + error.attemptNumber}，错误:`, error)
        },
      }
    )

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

