import { useState } from 'react'

// API 响应类型
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export default function PromptOptimizer() {
  const [userPrompt, setUserPrompt] = useState('')
  const [optimizedPrompt, setOptimizedPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 优化提示词
  const handleOptimize = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userPrompt.trim()) return

    setLoading(true)
    setError(null)
    setOptimizedPrompt('')
    
    try {
      const response = await fetch('/api/prompts/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userPrompt: userPrompt.trim(),
        }),
      })

      const result: ApiResponse<{ optimizedPrompt: string }> = await response.json()

      if (result.success && result.data) {
        setOptimizedPrompt(result.data.optimizedPrompt)
      } else {
        setError(result.error || '优化提示词失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 复制优化后的提示词
  const handleCopy = async () => {
    if (!optimizedPrompt) return
    
    try {
      await navigator.clipboard.writeText(optimizedPrompt)
      // 可以添加一个提示，但为了保持简洁，这里不添加
    } catch (err) {
      setError('复制失败，请手动复制')
    }
  }

  // 清空内容
  const handleClear = () => {
    setUserPrompt('')
    setOptimizedPrompt('')
    setError(null)
  }

  return (
    <div className="prompt-optimizer">
      {/* 标题 */}
      <h2 className="handwriting-title text-4xl mb-6 text-center text-gray-800" style={{ transform: 'rotate(-1deg)' }}>
        提示词优化
      </h2>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border-2 border-dashed border-red-400 text-red-700 handwriting">
          {error}
        </div>
      )}

      {/* 输入区域 */}
      <form onSubmit={handleOptimize} className="mb-6">
        <div className="mb-4">
          <label className="block mb-2 handwriting text-lg text-gray-700">
            输入你的提示词：
          </label>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="在这里输入你想要优化的提示词..."
            className="notebook-textarea w-full"
            rows={6}
            disabled={loading}
          />
        </div>
        
        <div className="flex gap-3 items-center">
          <button
            type="submit"
            disabled={loading || !userPrompt.trim()}
            className="notebook-button"
          >
            {loading ? '优化中...' : '开始优化'}
          </button>
          
          {optimizedPrompt && (
            <button
              type="button"
              onClick={handleCopy}
              className="notebook-button"
              style={{ 
                background: '#7a9c7a', 
                borderColor: '#5a7a5a' 
              }}
            >
              复制结果
            </button>
          )}
          
          {(userPrompt || optimizedPrompt) && (
            <button
              type="button"
              onClick={handleClear}
              className="notebook-button"
              style={{ 
                background: '#c97a7a', 
                borderColor: '#a85a5a' 
              }}
            >
              清空
            </button>
          )}
        </div>
      </form>

      {/* 输出区域 */}
      {loading && (
        <div className="text-center text-gray-600 py-8 handwriting text-xl">
          正在优化中，请稍候...
        </div>
      )}

      {optimizedPrompt && !loading && (
        <div className="optimized-prompt-container">
          <div className="mb-3">
            <label className="handwriting text-lg text-gray-700">
              优化后的提示词：
            </label>
          </div>
          <div className="notebook-textarea optimized-result relative">
            <div className="tape-decoration-small" />
            <pre className="handwriting whitespace-pre-wrap text-gray-800">
              {optimizedPrompt}
            </pre>
          </div>
        </div>
      )}

      {!loading && !optimizedPrompt && !userPrompt && (
        <div className="text-center text-gray-600 py-8 handwriting text-xl">
          输入你的提示词，让 AI 帮你优化吧！
        </div>
      )}
    </div>
  )
}

