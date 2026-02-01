import { useState, useRef, useEffect } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  references?: number // 参考资料数量
}

interface StreamMessage {
  type: 'start' | 'chunk' | 'done' | 'error'
  content?: string
  message?: string
  error?: string
}

export default function StreamChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set())
  const [dislikedMessages, setDislikedMessages] = useState<Set<string>>(new Set())
  const streamingBufferRef = useRef<string>('') // 存储待显示的字符
  const streamingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const currentMessageIdRef = useRef<string | null>(null) // 当前正在流式输出的消息 ID
  const hasReceivedChunkRef = useRef<boolean>(false) // 是否已收到第一个 chunk

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
              lastMsg.content += char
              // 使用 currentMessageIdRef 来判断是否还在流式输出
              lastMsg.isStreaming = streamingBufferRef.current.length > 0 || !!currentMessageIdRef.current
              // 每100个字符打印一次日志，避免日志过多
              if (lastMsg.content.length % 100 === 0) {
                console.log('⏰ 定时器更新消息，当前长度:', lastMsg.content.length, '缓冲区剩余:', streamingBufferRef.current.length)
              }
            } else {
              // 如果消息不匹配，打印调试信息
              if (bufferLength > 0 && bufferLength % 100 === 0) {
                console.warn('⚠️ 定时器：消息不匹配', {
                  lastMsgId: lastMsg?.id,
                  currentMessageId: messageId,
                  lastMsgRole: lastMsg?.role,
                  bufferLength: streamingBufferRef.current.length
                })
              }
            }
            return updated
          })
        } else {
          // 打印为什么定时器没有处理数据
          if (bufferLength > 0 && bufferLength % 100 === 0) {
            console.warn('⚠️ 定时器未处理数据', {
              bufferLength,
              messageId
            })
          }
          
          if (!currentMessageIdRef.current && streamingBufferRef.current.length === 0) {
            // 流式输出完成且缓冲区为空，清除定时器
            console.log('🛑 定时器停止，流式输出完成')
            if (streamingTimerRef.current) {
              clearInterval(streamingTimerRef.current)
              streamingTimerRef.current = null
            }
          }
        }
      }, 30) // 30ms 显示一个字符，可以根据需要调整速度
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
  }, [isStreaming]) // 只依赖 isStreaming，不依赖 streamingTrigger

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
      references: Math.floor(Math.random() * 15) + 5, // 随机 5-20 篇参考资料
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
      const response = await fetch('/api/samples/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: userMessage.content,
          model: 'deepseek-ai/DeepSeek-V3.2-Exp', // SiliconFlow 模型名称
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('响应体为空')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // 设置当前流式输出的消息 ID
      currentMessageIdRef.current = assistantMessage.id
      streamingBufferRef.current = ''
      hasReceivedChunkRef.current = false // 重置 chunk 接收标志
      console.log('🎬 开始流式请求，消息ID:', assistantMessage.id, 'isStreaming:', isStreaming)
      
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
                lastMsg.content += char
                // 使用 currentMessageIdRef 来判断是否还在流式输出
                lastMsg.isStreaming = streamingBufferRef.current.length > 0 || !!currentMessageIdRef.current
              }
              return updated
            })
          } else if (!currentMessageIdRef.current && streamingBufferRef.current.length === 0) {
            // 如果消息ID为空且缓冲区为空，停止定时器
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
        buffer += decoder.decode(value, { stream: true })

        // 处理完整的 SSE 消息
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const rawData = line.slice(6)
              console.log('📥 接收到原始数据:', rawData)
              const data: StreamMessage = JSON.parse(rawData)
              console.log('📦 解析后的数据:', data)
              
              switch (data.type) {
                case 'start':
                  console.log('🚀 处理 start 消息, message:', data.message)
                  hasReceivedChunkRef.current = false // 重置标志
                  // 清空缓冲区，确保定时器不会追加旧内容
                  streamingBufferRef.current = ''
                  setMessages(prev => {
                    const updated = [...prev]
                    const lastMsg = updated[updated.length - 1]
                    if (lastMsg && lastMsg.role === 'assistant') {
                      // 如果有 message 字段，显示它作为临时提示；否则清空内容
                      lastMsg.content = data.message || ''
                      console.log('✅ 设置消息内容为:', lastMsg.content)
                    }
                    return updated
                  })
                  break
                
                case 'chunk':
                  console.log('📝 处理 chunk 消息, content:', data.content, '缓冲区长度:', streamingBufferRef.current.length, '定时器状态:', !!streamingTimerRef.current)
                  if (data.content) {
                    // 如果是第一个 chunk，清空 start 消息设置的临时提示
                    if (!hasReceivedChunkRef.current) {
                      console.log('🔄 第一个 chunk，清空临时提示')
                      hasReceivedChunkRef.current = true
                      // 确保缓冲区为空，避免追加旧内容
                      streamingBufferRef.current = ''
                      setMessages(prev => {
                        const updated = [...prev]
                        const lastMsg = updated[updated.length - 1]
                        if (lastMsg && lastMsg.role === 'assistant') {
                          lastMsg.content = '' // 清空临时提示，准备显示实际内容
                        }
                        return updated
                      })
                      
                      // 确保定时器已启动（使用 currentMessageIdRef 检查，不依赖 isStreaming 闭包值）
                      // 如果定时器已经存在，先清除它，避免重复启动
                      if (streamingTimerRef.current) {
                        console.warn('⚠️ 定时器已存在，先清除旧定时器')
                        clearInterval(streamingTimerRef.current)
                        streamingTimerRef.current = null
                      }
                      
                      if (currentMessageIdRef.current) {
                        console.log('🔧 第一个 chunk 时启动定时器，messageId:', currentMessageIdRef.current)
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
                                lastMsg.content += char
                                // 使用 currentMessageIdRef 来判断是否还在流式输出
                                lastMsg.isStreaming = streamingBufferRef.current.length > 0 || !!currentMessageIdRef.current
                              }
                              return updated
                            })
                          } else if (!currentMessageIdRef.current && streamingBufferRef.current.length === 0) {
                            // 如果消息ID为空且缓冲区为空，停止定时器
                            if (streamingTimerRef.current) {
                              clearInterval(streamingTimerRef.current)
                              streamingTimerRef.current = null
                            }
                          }
                        }, 30)
                      }
                    }
                    // 将内容添加到缓冲区，等待逐字显示
                    streamingBufferRef.current += data.content
                    console.log('📊 添加到缓冲区后，缓冲区长度:', streamingBufferRef.current.length, '内容预览:', streamingBufferRef.current.substring(0, 50))
                  }
                  break
                
                case 'done':
                  console.log('✅ 处理 done 消息, message:', data.message, '缓冲区剩余:', streamingBufferRef.current.length, '定时器状态:', !!streamingTimerRef.current)
                  
                  // 如果定时器没有运行，直接将缓冲区内容全部追加到消息中
                  if (!streamingTimerRef.current && streamingBufferRef.current.length > 0 && currentMessageIdRef.current) {
                    console.warn('⚠️ 定时器未运行，直接追加缓冲区内容')
                    const remainingContent = streamingBufferRef.current
                    streamingBufferRef.current = ''
                    setMessages(prev => {
                      const updated = [...prev]
                      const lastMsg = updated[updated.length - 1]
                      if (lastMsg && lastMsg.id === currentMessageIdRef.current && lastMsg.role === 'assistant') {
                        lastMsg.content += remainingContent
                        lastMsg.isStreaming = false
                      }
                      return updated
                    })
                    setIsStreaming(false)
                    currentMessageIdRef.current = null
                  } else {
                    // 等待缓冲区内容全部显示完成，但设置超时机制
                    let lastBufferLength = streamingBufferRef.current.length
                    let checkCount = 0
                    const maxChecks = 100 // 最多检查100次（10秒）
                    
                    const waitForBuffer = () => {
                      const remaining = streamingBufferRef.current.length
                      checkCount++
                      
                      if (remaining > 0) {
                        // 如果缓冲区长度没有变化，说明定时器可能没有工作
                        if (remaining === lastBufferLength && checkCount > 5) {
                          console.warn('⚠️ 缓冲区长度未变化，定时器可能未工作，直接追加内容')
                          const remainingContent = streamingBufferRef.current
                          streamingBufferRef.current = ''
                          setMessages(prev => {
                            const updated = [...prev]
                            const lastMsg = updated[updated.length - 1]
                            if (lastMsg && lastMsg.id === currentMessageIdRef.current && lastMsg.role === 'assistant') {
                              lastMsg.content += remainingContent
                              lastMsg.isStreaming = false
                            }
                            return updated
                          })
                          setIsStreaming(false)
                          currentMessageIdRef.current = null
                          if (streamingTimerRef.current) {
                            clearInterval(streamingTimerRef.current)
                            streamingTimerRef.current = null
                          }
                          return
                        }
                        
                        // 如果检查次数过多，也直接追加
                        if (checkCount >= maxChecks) {
                          console.warn('⚠️ 等待超时，直接追加剩余内容')
                          const remainingContent = streamingBufferRef.current
                          streamingBufferRef.current = ''
                          setMessages(prev => {
                            const updated = [...prev]
                            const lastMsg = updated[updated.length - 1]
                            if (lastMsg && lastMsg.id === currentMessageIdRef.current && lastMsg.role === 'assistant') {
                              lastMsg.content += remainingContent
                              lastMsg.isStreaming = false
                            }
                            return updated
                          })
                          setIsStreaming(false)
                          currentMessageIdRef.current = null
                          if (streamingTimerRef.current) {
                            clearInterval(streamingTimerRef.current)
                            streamingTimerRef.current = null
                          }
                          return
                        }
                        
                        lastBufferLength = remaining
                        // 每500ms打印一次，避免日志过多
                        if (remaining % 50 === 0 || remaining < 10) {
                          console.log('⏳ 等待缓冲区清空，剩余:', remaining, '定时器运行中:', !!streamingTimerRef.current, '检查次数:', checkCount)
                        }
                        setTimeout(waitForBuffer, 100)
                      } else {
                        console.log('🎉 缓冲区已清空，完成流式输出')
                        setMessages(prev => {
                          const updated = [...prev]
                          const lastMsg = updated[updated.length - 1]
                          if (lastMsg && lastMsg.role === 'assistant') {
                            lastMsg.isStreaming = false
                            console.log('📄 最终消息内容长度:', lastMsg.content.length)
                          }
                          return updated
                        })
                        setIsStreaming(false)
                        currentMessageIdRef.current = null
                        // 确保定时器被清除
                        if (streamingTimerRef.current) {
                          clearInterval(streamingTimerRef.current)
                          streamingTimerRef.current = null
                        }
                      }
                    }
                    waitForBuffer()
                  }
                  break
                
                case 'error':
                  setError(data.error || '未知错误')
                  setIsStreaming(false)
                  streamingBufferRef.current = ''
                  hasReceivedChunkRef.current = false
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
        console.log('📋 处理剩余缓冲区数据:', buffer.substring(0, 200))
        const lines = buffer.split('\n\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const rawData = line.slice(6)
              console.log('📥 [剩余缓冲区] 接收到原始数据:', rawData)
              const data: StreamMessage = JSON.parse(rawData)
              console.log('📦 [剩余缓冲区] 解析后的数据:', data)
              switch (data.type) {
                case 'start':
                  hasReceivedChunkRef.current = false
                  setMessages(prev => {
                    const updated = [...prev]
                    const lastMsg = updated[updated.length - 1]
                    if (lastMsg && lastMsg.role === 'assistant') {
                      lastMsg.content = data.message || ''
                    }
                    return updated
                  })
                  streamingBufferRef.current = ''
                  break
                case 'chunk':
                  if (data.content) {
                    // 如果是第一个 chunk，清空 start 消息设置的临时提示
                    if (!hasReceivedChunkRef.current) {
                      hasReceivedChunkRef.current = true
                      setMessages(prev => {
                        const updated = [...prev]
                        const lastMsg = updated[updated.length - 1]
                        if (lastMsg && lastMsg.role === 'assistant') {
                          lastMsg.content = ''
                        }
                        return updated
                      })
                    }
                    streamingBufferRef.current += data.content
                  }
                  break
                case 'done':
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
                    }
                  }
                  waitForBuffer()
                  break
                case 'error':
                  setError(data.error || '未知错误')
                  setIsStreaming(false)
                  streamingBufferRef.current = ''
                  hasReceivedChunkRef.current = false
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

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('请求已取消')
      } else {
        setError(err instanceof Error ? err.message : '网络错误')
        setIsStreaming(false)
        streamingBufferRef.current = ''
        hasReceivedChunkRef.current = false
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
      abortControllerRef.current = null
    }
  }

  // 取消流式请求
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsStreaming(false)
      streamingBufferRef.current = ''
      hasReceivedChunkRef.current = false
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
    }
  }

  // 复制消息
  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      // 可以添加提示
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  // 重新生成
  const handleRegenerate = (messageId: string) => {
    const message = messages.find(m => m.id === messageId)
    if (!message || message.role !== 'assistant') return

    // 找到对应的用户消息
    const messageIndex = messages.findIndex(m => m.id === messageId)
    const userMessage = messages[messageIndex - 1]
    
    if (userMessage && userMessage.role === 'user') {
      // 删除旧的助手消息
      setMessages(prev => prev.slice(0, messageIndex))
      // 重新发送用户消息
      setInput(userMessage.content)
      setTimeout(() => {
        handleSend()
      }, 100)
    }
  }

  // 点赞/点踩
  const handleLike = (messageId: string) => {
    setLikedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
        setDislikedMessages(prevDislike => {
          const newDislikeSet = new Set(prevDislike)
          newDislikeSet.delete(messageId)
          return newDislikeSet
        })
      }
      return newSet
    })
  }

  const handleDislike = (messageId: string) => {
    setDislikedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
        setLikedMessages(prevLike => {
          const newLikeSet = new Set(prevLike)
          newLikeSet.delete(messageId)
          return newLikeSet
        })
      }
      return newSet
    })
  }

  // 朗读
  const handleSpeak = (content: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(content)
      utterance.lang = 'zh-CN'
      speechSynthesis.speak(utterance)
    }
  }

  // 分享
  const handleShare = async (content: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AI 对话',
          text: content,
        })
      } catch (err) {
        console.error('分享失败:', err)
      }
    } else {
      // 降级方案：复制到剪贴板
      handleCopy(content)
    }
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
                  {/* 交互按钮 */}
                  <div className="message-actions">
                    <button
                      onClick={() => handleSpeak(message.content)}
                      className="action-button"
                      title="朗读"
                    >
                      🔊
                    </button>
                    <button
                      onClick={() => handleCopy(message.content)}
                      className="action-button"
                      title="复制"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => handleRegenerate(message.id)}
                      className="action-button"
                      title="重新生成"
                    >
                      🔄
                    </button>
                    <button
                      onClick={() => handleLike(message.id)}
                      className={`action-button ${likedMessages.has(message.id) ? 'liked' : ''}`}
                      title="点赞"
                    >
                      👍
                    </button>
                    <button
                      onClick={() => handleDislike(message.id)}
                      className={`action-button ${dislikedMessages.has(message.id) ? 'disliked' : ''}`}
                      title="点踩"
                    >
                      👎
                    </button>
                    <button
                      onClick={() => handleShare(message.content)}
                      className="action-button"
                      title="分享"
                    >
                      🔗
                    </button>
                    <button
                      className="action-button"
                      title="更多"
                    >
                      ⋯
                    </button>
                  </div>

                  {/* 参考资料 */}
                  {message.references && (
                    <div className="message-references">
                      参考 {message.references} 篇资料
                    </div>
                  )}
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
            placeholder="发消息或输入 / 选择技能"
            className="chat-input"
            disabled={isStreaming}
            rows={1}
          />
          
          <div className="chat-input-buttons">
            <button className="input-action-button" title="附件">
              📎
            </button>
            <button className="input-action-button" title="深度思考">
              <span className="button-label">深度思考</span>
            </button>
            <button className="input-action-button" title="技能">
              <span className="button-label">技能</span>
            </button>
          </div>
        </div>

        <div className="chat-send-buttons">
          <button
            className="send-action-button"
            title="剪切"
            onClick={() => {
              // 剪切功能
            }}
          >
            ✂️
          </button>
          <button
            className="send-action-button"
            title="语音输入"
            onClick={() => {
              // 语音输入功能
            }}
          >
            🎤
          </button>
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

