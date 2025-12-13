import { useState, useEffect, useCallback } from 'react'
import type { Task } from '@/types/task'

// API 响应类型
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export default function Home() {
  // 状态管理
  const [tasks, setTasks] = useState<Task[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [breakdownLoading, setBreakdownLoading] = useState<string | null>(null) // 正在拆解的任务 ID

  // 获取所有任务
  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/tasks')
      const result: ApiResponse<Task[]> = await response.json()
      
      if (result.success && result.data) {
        setTasks(result.data)
      } else {
        setError(result.error || '获取任务失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误')
    } finally {
      setLoading(false)
    }
  }, [])

  // 组件挂载时获取任务
  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // 创建新任务
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: inputValue.trim(),
          priority: 'medium',
        }),
      })

      const result: ApiResponse<Task> = await response.json()

      if (result.success && result.data) {
        setInputValue('')
        await fetchTasks() // 重新获取任务列表
      } else {
        setError(result.error || '创建任务失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 切换任务完成状态
  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completed: !completed,
        }),
      })

      const result: ApiResponse<Task> = await response.json()

      if (result.success) {
        await fetchTasks() // 重新获取任务列表
      } else {
        setError(result.error || '更新任务失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误')
    }
  }

  // 删除任务
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？')) return

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })

      const result: ApiResponse<Task> = await response.json()

      if (result.success) {
        await fetchTasks() // 重新获取任务列表
      } else {
        setError(result.error || '删除任务失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误')
    }
  }

  // AI 拆解任务
  const handleBreakdownTask = async (taskId: string, taskTitle: string) => {
    setBreakdownLoading(taskId)
    setError(null)
    try {
      const response = await fetch('/api/tasks/breakdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          taskTitle,
        }),
      })

      const result: ApiResponse<Task[]> = await response.json()

      if (result.success) {
        await fetchTasks() // 重新获取任务列表
      } else {
        setError(result.error || '拆解任务失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误')
    } finally {
      setBreakdownLoading(null)
    }
  }

  // 构建任务树结构（父子关系）
  const buildTaskTree = (tasks: Task[]): Task[] => {
    const taskMap = new Map<string, Task & { children?: Task[] }>()
    const rootTasks: Task[] = []

    // 先创建所有任务的映射
    tasks.forEach(task => {
      taskMap.set(task.id, { ...task, children: [] })
    })

    // 构建树结构
    tasks.forEach(task => {
      const taskWithChildren = taskMap.get(task.id)!
      if (task.parent_id) {
        const parent = taskMap.get(task.parent_id)
        if (parent) {
          if (!parent.children) parent.children = []
          parent.children.push(taskWithChildren)
        } else {
          // 父任务不存在，当作根任务处理
          rootTasks.push(taskWithChildren)
        }
      } else {
        rootTasks.push(taskWithChildren)
      }
    })

    return rootTasks
  }

  // 渲染任务项（递归渲染子任务）
  const renderTask = (task: Task & { children?: Task[] }, level: number = 0) => {
    const isBreakdownLoading = breakdownLoading === task.id
    const indentStyle = level > 0 ? { marginLeft: `${level * 2}rem` } : {}
    // 使用任务 ID 的哈希值来决定装饰类型，确保同一任务总是显示相同的装饰
    const decorationType = task.id.charCodeAt(0) % 2 === 0 ? 'pin' : 'tape'

    return (
      <div key={task.id} className="mb-3" style={indentStyle}>
        <div className={`task-item ${task.completed ? 'completed' : ''}`}>
          {/* 完成任务的装饰（图钉或胶带） */}
          {task.completed && (
            <>
              {decorationType === 'pin' ? (
                <div className="pin-decoration" />
              ) : (
                <div className="tape-decoration" />
              )}
            </>
          )}

          <div className="flex items-center gap-3">
            {/* 手绘复选框 */}
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => handleToggleComplete(task.id, task.completed)}
              className="hand-drawn-checkbox flex-shrink-0"
            />

            {/* 任务标题 */}
            <span
              className={`handwriting flex-1 text-lg ${
                task.completed
                  ? 'handwritten-strikethrough text-gray-600'
                  : 'text-gray-800'
              }`}
            >
              {task.title}
            </span>

            {/* 操作按钮 */}
            <div className="flex gap-2 flex-shrink-0">
              {/* 拆解按钮 */}
              <button
                onClick={() => handleBreakdownTask(task.id, task.title)}
                disabled={isBreakdownLoading || task.completed}
                className="notebook-button text-sm disabled:opacity-50"
              >
                {isBreakdownLoading ? '拆解中...' : '拆解'}
              </button>

              {/* 删除按钮 */}
              <button
                onClick={() => handleDeleteTask(task.id)}
                className="notebook-button text-sm"
                style={{ 
                  background: '#c97a7a', 
                  borderColor: '#a85a5a' 
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>

        {/* 递归渲染子任务 */}
        {task.children && task.children.length > 0 && (
          <div className="mt-2" style={{ marginLeft: '2rem' }}>
            {task.children.map(child => renderTask(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const taskTree = buildTaskTree(tasks)

  return (
    <div className="min-h-screen paper-texture p-8">
      <div className="max-w-4xl mx-auto">
        {/* 手账页面 */}
        <div className="notebook-page">
          {/* 标题 */}
          <h1 className="handwriting-title text-5xl mb-8 text-center text-gray-800" style={{ transform: 'rotate(-1deg)' }}>
            待办事项
          </h1>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-4 bg-red-100 border-2 border-dashed border-red-400 text-red-700 handwriting">
              {error}
            </div>
          )}

          {/* 输入框和添加按钮 */}
          <form onSubmit={handleCreateTask} className="mb-8">
            <div className="flex gap-3 items-center">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="写下新任务..."
                className="notebook-input flex-1"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !inputValue.trim()}
                className="notebook-button"
              >
                {loading ? '添加中...' : '添加'}
              </button>
            </div>
          </form>

          {/* 任务列表 */}
          <div>
            {loading && tasks.length === 0 ? (
              <div className="text-center text-gray-600 py-8 handwriting text-xl">加载中...</div>
            ) : taskTree.length === 0 ? (
              <div className="text-center text-gray-600 py-8 handwriting text-xl">
                暂无任务，添加一个开始吧！
              </div>
            ) : (
              <div>
                {taskTree.map(task => renderTask(task))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

