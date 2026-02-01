// Next.js API 路由类型定义
import type { NextApiRequest, NextApiResponse } from 'next'
// 导入 Supabase 客户端实例（已经在 lib/supabase.ts 中配置好）
import { supabase } from '@/lib/supabase'
// 导入任务相关的类型定义
import type { Task, ApiResponse, CreateTaskRequest } from '@/types/task'

/**
 * Next.js API 路由处理器
 * 这个文件处理 /api/tasks 端点的请求
 * 
 * @param req - Next.js 的请求对象，包含请求方法、请求体等信息
 * @param res - Next.js 的响应对象，用于返回 JSON 数据或状态码
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Task[]>>
) {
  // ========== GET 请求：获取所有任务 ==========
  if (req.method === 'GET') {
    try {
      /**
       * Supabase 查询语法说明：
       * 1. .from('tasks') - 指定要查询的表名（在 Supabase 中叫 table）
       * 2. .select('*') - 选择所有字段（* 表示所有列）
       *    也可以指定字段，如 .select('id, title, completed')
       * 3. .order('created_at', { ascending: false }) - 按 created_at 字段排序
       *    ascending: false 表示降序（最新的在前）
       * 
       * Supabase 的查询是链式调用的，最后通过 await 执行
       * 返回结果包含 { data, error } 两个属性
       */
      const { data, error } = await supabase
        .from('tasks')  // 从 tasks 表中查询
        .select('*')    // 选择所有字段
        .order('created_at', { ascending: false })  // 按创建时间倒序排列

      // 如果 Supabase 返回了错误（比如数据库连接失败、表不存在等）
      if (error) {
        console.error('Supabase error:', error)
        // 返回 500 服务器错误，并包含错误信息
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to fetch tasks'
        })
      }

      // 查询成功，返回 200 状态码和任务列表
      // data 可能是 null，所以用 || [] 确保返回数组
      return res.status(200).json({
        success: true,
        data: data || []
      })
    } catch (error) {
      // 捕获其他未预期的错误（比如代码逻辑错误）
      console.error('Unexpected error:', error)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      })
    }
  }

  // ========== POST 请求：创建新任务 ==========
  if (req.method === 'POST') {
    try {
      // 从请求体中获取任务数据
      const body: CreateTaskRequest = req.body

      // ========== 数据验证 ==========
      // 验证标题：必须存在、必须是字符串、不能为空
      if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Title is required and must be a non-empty string'
        })
      }

      // 验证优先级：如果提供了优先级，必须是 low、medium、high 之一
      if (body.priority && !['low', 'medium', 'high'].includes(body.priority)) {
        return res.status(400).json({
          success: false,
          error: 'Priority must be one of: low, medium, high'
        })
      }

      // ========== 准备要插入数据库的数据 ==========
      const taskData = {
        title: body.title.trim(),           // 去除首尾空格
        completed: false,                   // 新任务默认未完成
        priority: body.priority || 'medium', // 如果没有提供优先级，默认为 medium
        due_date: body.due_date || null,    // 截止日期，可选
        parent_id: body.parent_id || null,  // 父任务 ID，用于支持子任务
        // 使用 ISO 8601 格式的时间字符串（Supabase 推荐格式）
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      /**
       * Supabase 插入数据语法说明：
       * 1. .from('tasks') - 指定要插入的表名
       * 2. .insert([taskData]) - 插入数据，注意参数是数组格式
       *    可以插入多条：.insert([task1, task2, task3])
       * 3. .select() - 插入后返回插入的数据（默认不返回）
       * 4. .single() - 因为只插入一条，使用 single() 返回单个对象而不是数组
       * 
       * 如果不加 .select()，返回的 data 会是 null
       * 如果不加 .single()，返回的 data 会是数组 [{...}]
       */
      const { data, error } = await supabase
        .from('tasks')           // 插入到 tasks 表
        .insert([taskData])      // 插入数据（数组格式）
        .select()                // 返回插入的数据
        .single()                // 返回单个对象

      // 如果插入失败（比如字段类型不匹配、违反约束等）
      if (error) {
        console.error('Supabase error:', error)
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to create task'
        })
      }

      // 插入成功，返回 201 状态码（创建成功）和创建的任务数据
      return res.status(201).json({
        success: true,
        data
      })
    } catch (error) {
      // 捕获其他未预期的错误
      console.error('Unexpected error:', error)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      })
    }
  }

  // ========== 不支持的 HTTP 方法 ==========
  // 如果请求方法不是 GET 或 POST，返回 405 Method Not Allowed
  // 设置响应头，告诉客户端允许的方法
  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({
    success: false,
    error: `Method ${req.method} not allowed`
  })
}


