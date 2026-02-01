import { useState } from 'react'
import TodoList from '@/components/TodoList'
import PromptOptimizer from '@/components/PromptOptimizer'
import StreamAIChat from '@/components/StreamAIChat'
import MultimodalChat from '@/components/MultimodalChat'
import AISDKDemo from '@/components/AISDKDemo'

type TabType = 'todo' | 'prompt' | 'stream-ai' | 'multimodal-chat' | 'ai-sdk'

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('multimodal-chat')

  return (
    <div className="min-h-screen paper-texture p-8">
      <div className="max-w-4xl mx-auto">
        {/* 手账页面 */}
        <div className="notebook-page">
          {/* Tab 切换 */}
          <div className="mb-8 flex gap-4 justify-center">
            <button
              onClick={() => setActiveTab('multimodal-chat')}
              className={`notebook-tab ${activeTab === 'multimodal-chat' ? 'active' : ''}`}
            >
              多模态聊天
            </button>
            <button
              onClick={() => setActiveTab('todo')}
              className={`notebook-tab ${activeTab === 'todo' ? 'active' : ''}`}
            >
              待办事项
            </button>
            <button
              onClick={() => setActiveTab('prompt')}
              className={`notebook-tab ${activeTab === 'prompt' ? 'active' : ''}`}
            >
              提示词生成
            </button>
            <button
              onClick={() => setActiveTab('stream-ai')}
              className={`notebook-tab ${activeTab === 'stream-ai' ? 'active' : ''}`}
            >
              流式AI
            </button>
            <button
              onClick={() => setActiveTab('ai-sdk')}
              className={`notebook-tab ${activeTab === 'ai-sdk' ? 'active' : ''}`}
            >
              AI SDK
            </button>
          </div>

          {/* Tab 内容 */}
          {activeTab === 'todo' && <TodoList />}
          {activeTab === 'prompt' && <PromptOptimizer />}
          {activeTab === 'stream-ai' && <StreamAIChat />}
          {activeTab === 'multimodal-chat' && <MultimodalChat />}
          {activeTab === 'ai-sdk' && <AISDKDemo />}
        </div>
      </div>
    </div>
  )
}

