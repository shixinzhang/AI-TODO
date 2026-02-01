import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase'
import type { Task, ApiResponse, UpdateTaskRequest } from '@/types/task'

// PATCH /api/tasks/[id] - 更新任务状态
// DELETE /api/tasks/[id] - 删除任务
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Task>>
) {
  const { id } = req.query

  // 验证 ID
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Task ID is required'
    })
  }

  // PATCH /api/tasks/[id] - 更新任务
  if (req.method === 'PATCH') {
    try {
      const body: UpdateTaskRequest = req.body

      // 验证请求体不为空
      if (!body || Object.keys(body).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Request body cannot be empty'
        })
      }

      // 类型检查和验证
      if (body.completed !== undefined && typeof body.completed !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'completed must be a boolean'
        })
      }

      if (body.title !== undefined) {
        if (typeof body.title !== 'string' || body.title.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: 'title must be a non-empty string'
          })
        }
      }

      if (body.priority !== undefined && !['low', 'medium', 'high'].includes(body.priority)) {
        return res.status(400).json({
          success: false,
          error: 'priority must be one of: low, medium, high'
        })
      }

      if (body.due_date !== undefined && body.due_date !== null && typeof body.due_date !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'due_date must be a string or null'
        })
      }

      // 构建更新对象
      const updateData: Partial<Task> = {
        updated_at: new Date().toISOString()
      }

      if (body.completed !== undefined) {
        updateData.completed = body.completed
      }
      if (body.title !== undefined) {
        updateData.title = body.title.trim()
      }
      if (body.priority !== undefined) {
        updateData.priority = body.priority
      }
      if (body.due_date !== undefined) {
        updateData.due_date = body.due_date
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        // 检查是否是记录不存在
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Task not found'
          })
        }
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to update task'
        })
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        })
      }

      return res.status(200).json({
        success: true,
        data
      })
    } catch (error) {
      console.error('Unexpected error:', error)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      })
    }
  }

  // DELETE /api/tasks/[id] - 删除任务
  if (req.method === 'DELETE') {
    try {
      // 先检查任务是否存在
      const { data: existingTask, error: fetchError } = await supabase
        .from('tasks')
        .select('id')
        .eq('id', id)
        .single()

      if (fetchError || !existingTask) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        })
      }

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Supabase error:', error)
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to delete task'
        })
      }

      return res.status(200).json({
        success: true,
        data: existingTask as Task
      })
    } catch (error) {
      console.error('Unexpected error:', error)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      })
    }
  }

  // 不支持的方法
  res.setHeader('Allow', ['PATCH', 'DELETE'])
  return res.status(405).json({
    success: false,
    error: `Method ${req.method} not allowed`
  })
}









