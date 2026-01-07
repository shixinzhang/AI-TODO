'use client';

/**
 * Vercel AI SDK 核心功能演示组件
 * 
 * 本组件展示了 Vercel AI SDK 的以下核心功能：
 * 
 * 1. useChat Hook - 聊天界面
 *    - 自动管理消息历史
 *    - 流式响应处理
 *    - 自动状态管理（loading, error）
 * 
 * 2. useCompletion Hook - 文本补全
 *    - 单次文本生成
 *    - 自动补全功能
 * 
 * 3. streamText - 流式文本生成（后端）
 *    - 实时流式输出
 *    - 更好的用户体验
 * 
 * 4. generateText - 文本生成（后端）
 *    - 一次性生成完整文本
 *    - 适合不需要流式的场景
 * 
 * 5. Tools/Function Calling - 工具调用
 *    - AI 可以调用外部函数
 *    - 实现更复杂的功能
 */

import { useChat, useCompletion } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, getToolName } from 'ai';
import { useState } from 'react';

export default function AISDKDemo() {
  const [activeDemo, setActiveDemo] = useState<'chat' | 'completion' | 'tools'>('chat');
  
  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto">
      {/* 标题 */}
      <div className="mb-6 text-center">
        <h2 className="handwriting-title text-3xl mb-2 text-gray-800">
          Vercel AI SDK 核心功能演示
        </h2>
        <p className="text-gray-600 text-sm">
          探索 AI SDK 的强大功能，了解如何快速构建 AI 应用
        </p>
      </div>

      {/* 功能切换 TAB */}
      <div className="mb-6 flex gap-2 justify-center border-b pb-2">
        <button
          onClick={() => setActiveDemo('chat')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeDemo === 'chat'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          💬 useChat - 聊天
        </button>
        <button
          onClick={() => setActiveDemo('completion')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeDemo === 'completion'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          ✍️ useCompletion - 文本补全
        </button>
        <button
          onClick={() => setActiveDemo('tools')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeDemo === 'tools'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🔧 Tools - 工具调用
        </button>
      </div>

      {/* 演示内容 */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white shadow-sm p-6">
        {activeDemo === 'chat' && <ChatDemo />}
        {activeDemo === 'completion' && <CompletionDemo />}
        {activeDemo === 'tools' && <ToolsDemo />}
      </div>
    </div>
  );
}

/**
 * useChat Hook 演示
 * 
 * useChat 是 Vercel AI SDK 最常用的 Hook，用于构建聊天界面。
 * 
 * 核心特性：
 * - 自动管理消息历史（messages）
 * - 自动处理流式响应（streaming）
 * - 自动管理加载状态（isLoading）
 * - 自动处理错误（error）
 * - 支持附件上传（attachments）
 * 
 * 使用场景：
 * - 聊天机器人
 * - 客服系统
 * - 对话式 AI 应用
 */
function ChatDemo() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/ai-sdk/chat',
    }),
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || status !== 'ready') return;
    sendMessage({ text: input });
    setInput('');
  };

  const handleClear = () => {
    setMessages([]);
  };

  const isLoading = status === 'submitted' || status === 'streaming';

  return (
    <div className="flex flex-col h-[500px]">
      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-bold text-blue-900 mb-2">💬 useChat Hook 演示</h3>
        <p className="text-sm text-blue-800 mb-2">
          <strong>核心特性：</strong>支持多轮对话，自动保留消息历史，AI 可以基于上下文回答。
        </p>
        <div className="text-xs text-blue-700 bg-blue-100 p-2 rounded mt-2">
          <strong>💡 试试这个：</strong>
          <ol className="list-decimal list-inside mt-1 space-y-1">
            <li>先问："你好，介绍一下你自己"</li>
            <li>再问："刚才你说你是什么？"（AI 会记住之前的对话）</li>
            <li>继续问："用一句话总结你的特点"（基于前面的对话）</li>
          </ol>
        </div>
      </div>

      {/* 消息历史计数 */}
      {messages.length > 0 && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-gray-600">
            消息历史：<strong>{messages.length}</strong> 条
          </span>
          <button
            onClick={handleClear}
            className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            清除历史
          </button>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 rounded-lg mb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <p className="text-lg mb-2">开始对话吧！</p>
            <p className="text-sm">试试问："你好，介绍一下你自己"</p>
          </div>
        )}

        {messages.map((m: any) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                m.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              }`}
            >
              <div className="whitespace-pre-wrap">
                {m.parts?.map((part: any, idx: number) => 
                  part.type === 'text' ? part.text : ``
                ).join('') || ''}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              handleSubmit(e);
            }
          }}
          placeholder="输入消息..."
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          发送
        </button>
      </form>
    </div>
  );
}

/**
 * useCompletion Hook 演示
 * 
 * useCompletion 用于单次文本补全，适合不需要对话历史的场景。
 * 
 * 核心特性：
 * - 单次输入输出
 * - 自动补全功能
 * - 流式响应支持
 * 
 * 使用场景：
 * - 文本补全
 * - 代码补全
 * - 单次问答
 * - 文本生成
 */
function CompletionDemo() {
  const { completion, input, handleInputChange, handleSubmit, isLoading, error, setCompletion } = useCompletion({
    api: '/api/ai-sdk/completion',
    streamProtocol: 'text', // 使用 'text' 协议以匹配 toTextStreamResponse() 返回的纯文本流
  });

  // 清除当前结果，开始新的生成
  const handleClear = () => {
    setCompletion('');
  };

  return (
    <div className="flex flex-col h-[500px]">
      <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
        <h3 className="font-bold text-green-900 mb-2">✍️ useCompletion Hook 演示</h3>
        <p className="text-sm text-green-800 mb-2">
          <strong>核心特性：</strong>单次输入输出，每次生成都是独立的，不保留历史。
        </p>
        <div className="text-xs text-green-700 bg-green-100 p-2 rounded mt-2">
          <strong>💡 试试这个：</strong>
          <ol className="list-decimal list-inside mt-1 space-y-1">
            <li>输入："写一首关于春天的诗" 并生成</li>
            <li>再输入："继续" 并生成（注意：AI 不知道"继续"什么，因为没有历史）</li>
            <li>每次生成都是全新的，不会记住之前的内容</li>
          </ol>
        </div>
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="输入提示词，例如：写一首关于春天的诗"
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
          >
            生成
          </button>
          {completion && (
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              title="清除当前结果，开始新的生成"
            >
              清除
            </button>
          )}
        </div>
      </form>

      {/* 输出区域 */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">
              <strong>错误：</strong>{error.message || '生成失败，请重试'}
            </p>
          </div>
        )}

        {/* 初始状态提示 */}
        {!completion && !isLoading && !error && (
          <div className="text-center text-gray-500 py-12">
            <p>输入提示词，点击"生成"按钮开始</p>
          </div>
        )}
        
        {/* 流式响应过程中显示加载动画（仅在还没有内容时） */}
        {isLoading && (!completion || completion.length === 0) && (
          <div className="flex justify-center items-center py-12">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
            </div>
          </div>
        )}

        {/* 显示生成的内容（包括流式响应过程中的部分内容） */}
        {(completion && completion.length > 0) && (
          <div className="space-y-2">
            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              <strong>提示：</strong>这是单次生成的结果，每次生成都是独立的，不会记住之前的内容。
            </div>
            <div className="whitespace-pre-wrap text-gray-900 bg-white p-4 rounded-lg border border-gray-200">
              {completion}
              {/* 流式响应过程中显示光标 */}
              {isLoading && (
                <span className="inline-block w-2 h-4 bg-gray-900 ml-1 animate-pulse" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Tools/Function Calling 演示
 * 
 * Tools 功能允许 AI 调用外部函数，实现更复杂的功能。
 * 
 * 核心特性：
 * - AI 可以决定何时调用工具
 * - 工具执行结果返回给 AI
 * - AI 基于工具结果生成最终回复
 * 
 * 使用场景：
 * - 获取实时数据（天气、股票等）
 * - 执行操作（发送邮件、创建任务等）
 * - 计算复杂问题
 * - 调用外部 API
 */
function ToolsDemo() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/ai-sdk/tools',
    }),
  });

  // 调试信息（开发环境）
  if (typeof window !== 'undefined') {
    console.log('ToolsDemo messages:', messages.map((m: any) => ({
      id: m.id,
      role: m.role,
      parts: m.parts?.map((p: any) => ({
        type: p.type,
        state: p.state,
        toolName: p.toolName || (p.type?.startsWith('tool-') ? p.type.replace('tool-', '') : undefined),
        input: p.input,
        output: p.output,
        text: p.text?.substring(0, 50)
      }))
    })));
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || status !== 'ready') return;
    sendMessage({ text: input });
    setInput('');
  };

  const isLoading = status === 'submitted' || status === 'streaming';

  return (
    <div className="flex flex-col h-[500px]">
      <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
        <h3 className="font-bold text-purple-900 mb-2">🔧 Tools/Function Calling 演示</h3>
        <p className="text-sm text-purple-800 mb-2">
          <strong>功能说明：</strong>Tools 允许 AI 调用外部函数。在这个演示中，AI 可以：
        </p>
        <ul className="text-sm text-purple-800 list-disc list-inside space-y-1">
          <li>获取当前时间（getCurrentTime）</li>
          <li>计算数学表达式（calculate）</li>
          <li>获取天气信息（getWeather）</li>
        </ul>
        <p className="text-sm text-purple-800 mt-2">
          试试问："现在几点了？" 或 "计算 123 * 456"
        </p>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 rounded-lg mb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <p className="text-lg mb-2">试试工具调用功能！</p>
            <p className="text-sm">问："现在几点了？" 或 "计算 123 * 456"</p>
          </div>
        )}

        {messages.map((m: any) => {
          const textContent = m.parts?.map((part: any) => 
            part.type === 'text' ? part.text : ''
          ).join('') || '';
          const toolParts = m.parts?.filter((part: any) => isToolUIPart(part)) || [];
          const hasContent = textContent.trim().length > 0 || toolParts.length > 0;
          
          if (!hasContent) return null;
          
          return (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  m.role === 'user'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                {/* 显示文本内容 */}
                {textContent && (
                  <div className="whitespace-pre-wrap">
                    {textContent}
                  </div>
                )}
                
                {/* 显示工具调用信息 */}
                {toolParts.map((part: any, idx: number) => {
                  const toolName = getToolName(part);
                  const state = part.state;
                  
                  return (
                    <div key={idx} className={`${textContent ? 'mt-2 pt-2 border-t border-gray-300' : ''}`}>
                      <div className="text-xs font-semibold mb-1">🔧 工具调用：{toolName}</div>
                      <div className="text-xs bg-gray-100 p-2 rounded mb-1">
                        {part.input && (
                          <div><strong>参数：</strong>{JSON.stringify(part.input, null, 2)}</div>
                        )}
                        {state === 'output-available' && part.output && (
                          <div className="mt-1"><strong>结果：</strong>{JSON.stringify(part.output, null, 2)}</div>
                        )}
                        {state === 'output-error' && part.errorText && (
                          <div className="mt-1 text-red-600"><strong>错误：</strong>{part.errorText}</div>
                        )}
                        {state === 'input-streaming' && (
                          <div className="mt-1 text-gray-500">正在接收参数...</div>
                        )}
                        {state === 'input-available' && (
                          <div className="mt-1 text-gray-500">参数已接收，等待执行...</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              handleSubmit(e);
            }
          }}
          placeholder="试试问：现在几点了？或 计算 123 * 456"
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
        >
          发送
        </button>
      </form>
    </div>
  );
}

