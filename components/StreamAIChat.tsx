import { useState, useRef, useEffect } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  stats?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    inputCost?: string
    outputCost?: string
    totalCost?: string
  }
}

interface StreamMessage {
  type: 'start' | 'chunk' | 'done' | 'error'
  content?: string
  message?: string
  error?: string
  stats?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    inputCost?: string
    outputCost?: string
    totalCost?: string
  }
}

export default function StreamAIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const streamingBufferRef = useRef<string>('') // 存储待显示的字符
  const streamingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const currentMessageIdRef = useRef<string | null>(null) // 当前正在流式输出的消息 ID
  const displayedLengthRef = useRef<number>(0) // 已显示的字符长度，用于避免重复

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 自动调整输入框高度
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  // 逐字显示效果 - 启动定时器
  useEffect(() => {
    // 只在开始流式输出时创建定时器，且定时器不存在时
    if (isStreaming && currentMessageIdRef.current && !streamingTimerRef.current) {
      console.log('⏰ [useEffect] 启动定时器，isStreaming:', isStreaming, 'currentMessageId:', currentMessageIdRef.current)
      // 确保缓冲区为空，避免追加旧内容
      streamingBufferRef.current = ''
      displayedLengthRef.current = 0
      // 创建定时器，每 30ms 显示一个字符
      streamingTimerRef.current = setInterval(() => {
        const bufferLength = streamingBufferRef.current.length
        const messageId = currentMessageIdRef.current
        
        if (bufferLength > 0 && messageId) {
          const char = streamingBufferRef.current[0]
          streamingBufferRef.current = streamingBufferRef.current.slice(1)

          setMessages(prev => {
            const updated = [...prev]
            const lastMsg = updated[updated.length - 1]
            if (lastMsg && lastMsg.id === messageId && lastMsg.role === 'assistant') {
              // 确保不重复添加字符
              const currentLength = lastMsg.content.length
              if (currentLength === displayedLengthRef.current) {
                lastMsg.content += char
                displayedLengthRef.current++
              }
              // 使用 currentMessageIdRef 来判断是否还在流式输出
              lastMsg.isStreaming = streamingBufferRef.current.length > 0 || !!currentMessageIdRef.current
            }
            return updated
          })
        } else if (!currentMessageIdRef.current && streamingBufferRef.current.length === 0) {
          // 流式输出完成且缓冲区为空，清除定时器
          console.log('🛑 定时器停止，流式输出完成')
          if (streamingTimerRef.current) {
            clearInterval(streamingTimerRef.current)
            streamingTimerRef.current = null
          }
        }
      }, 30) // 30ms 显示一个字符
    } else if (!isStreaming && streamingBufferRef.current.length === 0) {
      // 流式输出完成且缓冲区为空，清除定时器
      if (streamingTimerRef.current) {
        clearInterval(streamingTimerRef.current)
        streamingTimerRef.current = null
      }
    }

    // 清理函数
    return () => {
      // 组件卸载时清理定时器
      if (streamingTimerRef.current) {
        clearInterval(streamingTimerRef.current)
        streamingTimerRef.current = null
      }
    }
  }, [isStreaming])

  // 开始流式请求
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isStreaming) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    }

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    setInput('')
    setIsStreaming(true)
    setError(null)
    
    // 重置输入框高度
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    // 创建 AbortController 用于取消请求
    abortControllerRef.current = new AbortController()

    try {
      // 构建消息历史（包含当前用户消息）
      const messageHistory = [
        ...messages.filter(m => m.role === 'user' || (m.role === 'assistant' && !m.isStreaming)),
        { role: 'user', content: userMessage.content }
      ].map(m => ({
        role: m.role,
        content: m.content,
      }))

      console.log('📤 发送请求，消息历史长度:', messageHistory.length)
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messageHistory,
        }),
        signal: abortControllerRef.current.signal,
      })

      console.log('📥 收到响应，status:', response.status, 'headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ HTTP 错误响应:', errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        console.error('❌ 响应体为空')
        throw new Error('响应体为空')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // 设置当前流式输出的消息 ID
      currentMessageIdRef.current = assistantMessage.id
      streamingBufferRef.current = ''
      displayedLengthRef.current = 0
      console.log('🎬 开始流式请求，消息ID:', assistantMessage.id)
      
      // 确保定时器已启动（如果 useEffect 没有触发）
      if (currentMessageIdRef.current && !streamingTimerRef.current) {
        console.log('🔧 手动启动定时器，messageId:', currentMessageIdRef.current)
        streamingTimerRef.current = setInterval(() => {
          const bufferLength = streamingBufferRef.current.length
          const messageId = currentMessageIdRef.current
          
          if (bufferLength > 0 && messageId) {
            const char = streamingBufferRef.current[0]
            streamingBufferRef.current = streamingBufferRef.current.slice(1)

            setMessages(prev => {
              const updated = [...prev]
              const lastMsg = updated[updated.length - 1]
              if (lastMsg && lastMsg.id === messageId && lastMsg.role === 'assistant') {
                const currentLength = lastMsg.content.length
                if (currentLength === displayedLengthRef.current) {
                  lastMsg.content += char
                  displayedLengthRef.current++
                }
                lastMsg.isStreaming = streamingBufferRef.current.length > 0 || !!currentMessageIdRef.current
              }
              return updated
            })
          } else if (!currentMessageIdRef.current && streamingBufferRef.current.length === 0) {
            if (streamingTimerRef.current) {
              clearInterval(streamingTimerRef.current)
              streamingTimerRef.current = null
            }
          }
        }, 30)
      }

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        // 解码数据块
        const decodedChunk = decoder.decode(value, { stream: true })
        buffer += decodedChunk
        console.log('📥 接收到原始数据块，长度:', decodedChunk.length, '内容预览:', decodedChunk.substring(0, 100))

        // 处理完整的 SSE 消息
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const rawData = line.slice(6)
              console.log('📦 解析 SSE 行，原始数据:', rawData.substring(0, 200))
              const data: StreamMessage = JSON.parse(rawData)
              console.log('✅ 解析后的数据:', JSON.stringify(data, null, 2))
              
              switch (data.type) {
                case 'start':
                  console.log('🚀 处理 start 消息，stats:', data.stats)
                  streamingBufferRef.current = ''
                  displayedLengthRef.current = 0
                  setMessages(prev => {
                    const updated = [...prev]
                    const lastMsg = updated[updated.length - 1]
                    if (lastMsg && lastMsg.role === 'assistant') {
                      // 保留现有内容，只更新 stats
                      if (data.stats) {
                        lastMsg.stats = data.stats
                      }
                      console.log('✅ start 消息处理完成，消息内容长度:', lastMsg.content.length)
                    }
                    return updated
                  })
                  // 确保定时器已启动
                  if (currentMessageIdRef.current && !streamingTimerRef.current) {
                    streamingTimerRef.current = setInterval(() => {
                      const bufferLength = streamingBufferRef.current.length
                      const messageId = currentMessageIdRef.current
                      
                      if (bufferLength > 0 && messageId) {
                        const char = streamingBufferRef.current[0]
                        streamingBufferRef.current = streamingBufferRef.current.slice(1)

                        setMessages(prev => {
                          const updated = [...prev]
                          const lastMsg = updated[updated.length - 1]
                          if (lastMsg && lastMsg.id === messageId && lastMsg.role === 'assistant') {
                            const currentLength = lastMsg.content.length
                            if (currentLength === displayedLengthRef.current) {
                              lastMsg.content += char
                              displayedLengthRef.current++
                            }
                            lastMsg.isStreaming = streamingBufferRef.current.length > 0 || !!currentMessageIdRef.current
                          }
                          return updated
                        })
                      } else if (!currentMessageIdRef.current && streamingBufferRef.current.length === 0) {
                        if (streamingTimerRef.current) {
                          clearInterval(streamingTimerRef.current)
                          streamingTimerRef.current = null
                        }
                      }
                    }, 30)
                  }
                  break
                
                case 'chunk':
                  if (data.content) {
                    // 将内容添加到缓冲区，等待逐字显示
                    const beforeLength = streamingBufferRef.current.length
                    streamingBufferRef.current += data.content
                    const afterLength = streamingBufferRef.current.length
                    console.log('📝 处理 chunk 消息，内容长度:', data.content.length, '缓冲区: ', beforeLength, '->', afterLength, '内容预览:', data.content.substring(0, 50))
                    
                    // 确保定时器正在运行
                    if (!streamingTimerRef.current && currentMessageIdRef.current) {
                      console.warn('⚠️ chunk 收到但定时器未运行，立即启动定时器')
                      streamingTimerRef.current = setInterval(() => {
                        const bufferLength = streamingBufferRef.current.length
                        const messageId = currentMessageIdRef.current
                        
                        if (bufferLength > 0 && messageId) {
                          const char = streamingBufferRef.current[0]
                          streamingBufferRef.current = streamingBufferRef.current.slice(1)

                          setMessages(prev => {
                            const updated = [...prev]
                            const lastMsg = updated[updated.length - 1]
                            if (lastMsg && lastMsg.id === messageId && lastMsg.role === 'assistant') {
                              const currentLength = lastMsg.content.length
                              if (currentLength === displayedLengthRef.current) {
                                lastMsg.content += char
                                displayedLengthRef.current++
                              }
                              lastMsg.isStreaming = streamingBufferRef.current.length > 0 || !!currentMessageIdRef.current
                            }
                            return updated
                          })
                        } else if (!currentMessageIdRef.current && streamingBufferRef.current.length === 0) {
                          if (streamingTimerRef.current) {
                            clearInterval(streamingTimerRef.current)
                            streamingTimerRef.current = null
                          }
                        }
                      }, 30)
                    }
                  } else {
                    console.warn('⚠️ chunk 消息但没有 content 字段')
                  }
                  break
                
                case 'done':
                  console.log('✅ 处理 done 消息，缓冲区剩余:', streamingBufferRef.current.length)
                  
                  // 更新统计信息
                  if (data.stats) {
                    setMessages(prev => {
                      const updated = [...prev]
                      const lastMsg = updated[updated.length - 1]
                      if (lastMsg && lastMsg.role === 'assistant') {
                        lastMsg.stats = data.stats
                      }
                      return updated
                    })
                  }
                  
                  // 等待缓冲区内容全部显示完成
                  const waitForBuffer = () => {
                    if (streamingBufferRef.current.length > 0) {
                      setTimeout(waitForBuffer, 100)
                    } else {
                      setMessages(prev => {
                        const updated = [...prev]
                        const lastMsg = updated[updated.length - 1]
                        if (lastMsg && lastMsg.role === 'assistant') {
                          lastMsg.isStreaming = false
                        }
                        return updated
                      })
                      setIsStreaming(false)
                      currentMessageIdRef.current = null
                      displayedLengthRef.current = 0
                      if (streamingTimerRef.current) {
                        clearInterval(streamingTimerRef.current)
                        streamingTimerRef.current = null
                      }
                    }
                  }
                  waitForBuffer()
                  break
                
                case 'error':
                  setError(data.error || '未知错误')
                  setIsStreaming(false)
                  streamingBufferRef.current = ''
                  displayedLengthRef.current = 0
                  if (streamingTimerRef.current) {
                    clearInterval(streamingTimerRef.current)
                    streamingTimerRef.current = null
                  }
                  setMessages(prev => {
                    const updated = [...prev]
                    const lastMsg = updated[updated.length - 1]
                    if (lastMsg && lastMsg.role === 'assistant') {
                      lastMsg.isStreaming = false
                    }
                    return updated
                  })
                  currentMessageIdRef.current = null
                  break
              }
            } catch (parseError) {
              console.error('解析 SSE 数据失败:', parseError)
            }
          }
        }
      }

      // 处理剩余的缓冲区数据
      if (buffer.trim()) {
        const lines = buffer.split('\n\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const rawData = line.slice(6)
              const data: StreamMessage = JSON.parse(rawData)
              // 处理剩余数据（与上面相同的逻辑）
              if (data.type === 'chunk' && data.content) {
                streamingBufferRef.current += data.content
              } else if (data.type === 'done') {
                if (data.stats) {
                  setMessages(prev => {
                    const updated = [...prev]
                    const lastMsg = updated[updated.length - 1]
                    if (lastMsg && lastMsg.role === 'assistant') {
                      lastMsg.stats = data.stats
                    }
                    return updated
                  })
                }
              }
            } catch (parseError) {
              console.error('解析 SSE 数据失败:', parseError)
            }
          }
        }
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 请求被取消，这是正常情况，不需要显示错误
        console.log('请求已取消')
        // 确保状态已清理（handleCancel 已经处理了，但这里再确保一下）
        setIsStreaming(false)
        streamingBufferRef.current = ''
        displayedLengthRef.current = 0
        if (streamingTimerRef.current) {
          clearInterval(streamingTimerRef.current)
          streamingTimerRef.current = null
        }
        setMessages(prev => {
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.isStreaming = false
          }
          return updated
        })
        currentMessageIdRef.current = null
      } else {
        setError(err instanceof Error ? err.message : '网络错误')
        setIsStreaming(false)
        streamingBufferRef.current = ''
        displayedLengthRef.current = 0
        setMessages(prev => {
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.isStreaming = false
          }
          return updated
        })
      }
    } finally {
      // 确保 abortControllerRef 被清空
      if (abortControllerRef.current) {
        abortControllerRef.current = null
      }
    }
  }

  // 取消流式请求
  const handleCancel = () => {
    if (abortControllerRef.current) {
      // 先清理状态
      setIsStreaming(false)
      streamingBufferRef.current = ''
      displayedLengthRef.current = 0
      if (streamingTimerRef.current) {
        clearInterval(streamingTimerRef.current)
        streamingTimerRef.current = null
      }
      setMessages(prev => {
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.isStreaming = false
        }
        return updated
      })
      currentMessageIdRef.current = null
      
      // 最后 abort，提供原因避免 "signal is aborted without reason" 错误
      const controller = abortControllerRef.current
      abortControllerRef.current = null // 先清空引用，避免重复 abort
      try {
        controller.abort('用户取消请求')
      } catch (err) {
        // 忽略 abort 错误（可能已经被 abort 过了）
        console.log('取消请求:', err)
      }
    }
  }

  // 复制消息
  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  // 清空对话
  const handleClear = () => {
    setMessages([])
    setError(null)
  }

  return (
    <div className="stream-chat-container">
      {/* 消息列表 */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-12 handwriting text-lg" style={{ color: '#8b7355' }}>
            开始对话吧！输入你的问题...
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-item ${message.role === 'user' ? 'message-user' : 'message-assistant'}`}
          >
            {message.role === 'assistant' && (
              <div className="message-header">
                <div className="message-avatar">AI</div>
              </div>
            )}
            
            <div className="message-content">
              <div className="message-text">
                {message.content}
                {message.isStreaming && (
                  <span className="streaming-cursor">|</span>
                )}
              </div>

              {message.role === 'assistant' && message.content && (
                <>
                  {/* Token 统计和成本信息 */}
                  {message.stats && (
                    <div className="message-stats" style={{ 
                      fontSize: '12px', 
                      color: '#666', 
                      marginTop: '8px',
                      padding: '4px 8px',
                      backgroundColor: '#f5f5f5',
                      borderRadius: '4px'
                    }}>
                      {message.stats.inputTokens && (
                        <span>输入: {message.stats.inputTokens} tokens</span>
                      )}
                      {message.stats.outputTokens && (
                        <span style={{ marginLeft: '12px' }}>
                          输出: {message.stats.outputTokens} tokens
                        </span>
                      )}
                      {message.stats.totalTokens && (
                        <span style={{ marginLeft: '12px' }}>
                          总计: {message.stats.totalTokens} tokens
                        </span>
                      )}
                      {message.stats.totalCost && (
                        <span style={{ marginLeft: '12px', fontWeight: 'bold' }}>
                          成本: ¥{message.stats.totalCost}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 交互按钮 */}
                  <div className="message-actions">
                    <button
                      onClick={() => handleCopy(message.content)}
                      className="action-button"
                      title="复制"
                    >
                      📋
                    </button>
                  </div>
                </>
              )}
            </div>

            {message.role === 'user' && (
              <div className="message-header">
                <div className="message-avatar user-avatar">我</div>
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="chat-error">
          {error}
        </div>
      )}

      {/* 输入区域 */}
      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="发消息..."
            className="chat-input"
            disabled={isStreaming}
            rows={1}
          />
        </div>

        <div className="chat-send-buttons">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="send-action-button"
              title="清空对话"
              disabled={isStreaming}
            >
              🗑️
            </button>
          )}
          <button
            onClick={isStreaming ? handleCancel : () => handleSend()}
            className="send-button"
            disabled={!input.trim() && !isStreaming}
            title={isStreaming ? '取消' : '发送'}
          >
            {isStreaming ? '⏹' : '➤'}
          </button>
        </div>
      </div>
    </div>
  )
}

