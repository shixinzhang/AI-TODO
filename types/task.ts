export interface Task {
  id: string
  title: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  parent_id: string | null  // 父任务 ID，用于支持子任务层级关系
  created_at: string
  updated_at: string
}

export interface CreateTaskRequest {
  title: string
  priority?: 'low' | 'medium' | 'high'
  due_date?: string | null
  parent_id?: string | null  // 可选：创建子任务时指定父任务 ID
}

export interface UpdateTaskRequest {
  completed?: boolean
  title?: string
  priority?: 'low' | 'medium' | 'high'
  due_date?: string | null
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}


