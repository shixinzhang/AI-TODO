// Next.js API 路由类型定义
import type { NextApiRequest, NextApiResponse } from 'next'
// 导入 OpenAI SDK（DeepSeek 兼容 OpenAI API 格式）
import OpenAI from 'openai'
// 导入 Supabase 客户端实例
import { supabase } from '@/lib/supabase'
// 导入 DeepSeek API 配置
import { DEEPSEEK_API_KEY, DEEPSEEK_API_BASE_URL } from '@/lib/config'
// 导入任务相关的类型定义
import type { Task, ApiResponse, CreateTaskRequest } from '@/types/task'

/**
 * POST /api/tasks/breakdown - 使用 DeepSeek AI 拆解任务
 * 将一个大任务拆解成 3-5 个可执行的小步骤
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Task[]>>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    })
  }

  try {
    const { taskId, taskTitle } = req.body

    // 验证参数
    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'taskId is required and must be a string'
      })
    }

    if (!taskTitle || typeof taskTitle !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'taskTitle is required and must be a string'
      })
    }

    // 验证任务是否存在
    const { data: existingTask, error: fetchError } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .single()

    if (fetchError || !existingTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      })
    }

    // 验证 DeepSeek API Key
    if (!DEEPSEEK_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'DeepSeek API Key is not configured'
      })
    }

    // 初始化 OpenAI 客户端（使用 DeepSeek API）
    const openai = new OpenAI({
      apiKey: DEEPSEEK_API_KEY,
      baseURL: DEEPSEEK_API_BASE_URL,
    })

    // 构建提示词，让 AI 拆解任务
    const prompt = `请将以下任务拆解成 3-5 个具体可执行的小步骤。要求：
1. 每个步骤应该是具体、可操作的
2. 步骤之间要有逻辑顺序
3. 返回格式为 JSON 数组，每个元素是一个步骤的标题
4. 只返回 JSON 数组，不要其他文字说明

任务：${taskTitle}

请返回 JSON 格式的数组，例如：["步骤1", "步骤2", "步骤3"]`

    // 调用 DeepSeek API
    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',  // DeepSeek 的模型名称
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,  // 控制输出的随机性
      max_tokens: 500,   // 最大 token 数
    })

    // 获取 AI 返回的内容
    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      return res.status(500).json({
        success: false,
        error: 'AI did not return a valid response'
      })
    }

    // 解析 AI 返回的 JSON
    let subtasks: string[] = []
    try {
      // 清理响应内容：移除 markdown 代码块标记
      let cleanedResponse = aiResponse.trim()
      cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '')
      cleanedResponse = cleanedResponse.replace(/^```\s*/i, '')
      cleanedResponse = cleanedResponse.replace(/\s*```$/i, '')
      cleanedResponse = cleanedResponse.trim()

      // 尝试直接解析 JSON
      const parsed = JSON.parse(cleanedResponse)
      if (Array.isArray(parsed)) {
        subtasks = parsed
      } else {
        // 如果不是数组，尝试从文本中提取数组
        const arrayMatch = cleanedResponse.match(/\[[\s\S]*?\]/)
        if (arrayMatch) {
          subtasks = JSON.parse(arrayMatch[0])
        }
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', aiResponse, parseError)
      
      // 如果 JSON 解析失败，尝试从文本中提取数组
      try {
        const arrayMatch = aiResponse.match(/\[[\s\S]*?\]/)
        if (arrayMatch) {
          const arrayStr = arrayMatch[0]
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim()
          subtasks = JSON.parse(arrayStr)
        }
      } catch (secondParseError) {
        console.error('Failed to parse array from response:', secondParseError)
        
        // 最后尝试：从文本中按行提取步骤
        const lines = aiResponse
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && line.length > 0)
          .filter(line => !line.match(/^(```|步骤|Step|Task|JSON)/i))  // 过滤掉标题和代码块标记
        
        subtasks = lines
          .map(line => {
            // 移除 JSON 数组中的引号、逗号等
            line = line.replace(/^["'\[,\s]+|["'\]\s,]+$/g, '')
            // 移除编号、符号等
            line = line.replace(/^[\d\-•\*\.]\s*/, '')
            return line.trim()
          })
          .filter(line => line.length > 3 && !line.match(/^[\[\],]+$/))  // 过滤太短的行和纯符号
          .slice(0, 5)  // 最多取 5 个
      }
    }

    // 清理子任务标题：移除多余的引号、逗号等
    subtasks = subtasks.map(task => {
      return task
        .replace(/^["'\[,\s]+|["'\]\s,]+$/g, '')  // 移除首尾的引号、逗号、方括号
        .replace(/\\"/g, '"')  // 处理转义的引号
        .trim()
    }).filter(task => task.length > 0)

    // 验证拆解结果
    if (!Array.isArray(subtasks) || subtasks.length === 0) {
      console.error('Invalid subtasks:', subtasks, 'Original response:', aiResponse)
      return res.status(400).json({
        success: false,
        error: 'AI did not return valid subtasks. Please try again.'
      })
    }

    // 确保子任务数量在 3-5 个之间
    if (subtasks.length < 3) {
      return res.status(400).json({
        success: false,
        error: `AI only returned ${subtasks.length} subtasks, expected 3-5`
      })
    }

    // 限制最多 5 个子任务
    const finalSubtasks = subtasks.slice(0, 5)

    // 批量创建子任务
    const taskDataList = finalSubtasks.map((subtask: string) => ({
      title: subtask.trim(),
      completed: false,
      priority: 'medium' as const,
      due_date: null,
      parent_id: taskId,  // 设置父任务 ID
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    // 插入所有子任务到数据库
    const { data: createdTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(taskDataList)
      .select()

    if (insertError) {
      console.error('Supabase error:', insertError)
      return res.status(500).json({
        success: false,
        error: insertError.message || 'Failed to create subtasks'
      })
    }

    // 返回创建的子任务
    return res.status(201).json({
      success: true,
      data: createdTasks || []
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    })
  }
}


