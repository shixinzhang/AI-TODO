// Next.js API 路由类型定义
import type { NextApiRequest, NextApiResponse } from 'next'
// 导入 OpenAI SDK（DeepSeek 兼容 OpenAI API 格式）
import OpenAI from 'openai'
// 导入 DeepSeek API 配置
import { DEEPSEEK_API_KEY, DEEPSEEK_API_BASE_URL } from '@/lib/config'
// 导入文件系统模块（用于读取提示词模板）
import fs from 'fs'
import path from 'path'

// API 响应类型
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * POST /api/prompts/optimize - 使用 DeepSeek AI 优化用户提示词
 * 基于元提示词模板优化用户的提示词
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ optimizedPrompt: string }>>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    })
  }

  try {
    const { userPrompt } = req.body

    // 验证参数
    if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userPrompt is required and must be a non-empty string'
      })
    }

    // 验证 DeepSeek API Key
    if (!DEEPSEEK_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'DeepSeek API Key is not configured'
      })
    }

    // 读取提示词模板文件
    let metaPromptTemplate = ''
    try {
      const templatePath = path.join(process.cwd(), 'prompts', '第四讲-元提示词.md')
      metaPromptTemplate = fs.readFileSync(templatePath, 'utf-8')
    } catch (error) {
      console.error('Failed to read meta-prompt template:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to load meta-prompt template'
      })
    }

    // 替换模板中的占位符
    const metaPrompt = metaPromptTemplate
      .replace(/\{\{user_request\}\}/g, userPrompt.trim())
      .replace(/\{\{user_input\}\}/g, userPrompt.trim())

    // 初始化 OpenAI 客户端（使用 DeepSeek API）
    const openai = new OpenAI({
      apiKey: DEEPSEEK_API_KEY,
      baseURL: DEEPSEEK_API_BASE_URL,
    })

    // 调用 DeepSeek API
    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',  // DeepSeek 的模型名称
      messages: [
        {
          role: 'user',
          content: metaPrompt,
        },
      ],
      temperature: 0.7,  // 控制输出的随机性
      max_tokens: 2000,   // 最大 token 数（提示词优化可能需要更多 token）
    })

    // 获取 AI 返回的内容
    const optimizedPrompt = completion.choices[0]?.message?.content
    if (!optimizedPrompt) {
      return res.status(500).json({
        success: false,
        error: 'AI did not return a valid response'
      })
    }

    // 清理响应内容：移除可能的 markdown 代码块标记
    let cleanedPrompt = optimizedPrompt.trim()
    cleanedPrompt = cleanedPrompt.replace(/^```(?:markdown|text|prompt)?\s*/i, '')
    cleanedPrompt = cleanedPrompt.replace(/^```\s*/i, '')
    cleanedPrompt = cleanedPrompt.replace(/\s*```$/i, '')
    cleanedPrompt = cleanedPrompt.trim()

    // 返回优化后的提示词
    return res.status(200).json({
      success: true,
      data: {
        optimizedPrompt: cleanedPrompt
      }
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    })
  }
}

