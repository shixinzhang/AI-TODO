import { useState } from 'react'
import TodoList from '@/components/TodoList'
import PromptOptimizer from '@/components/PromptOptimizer'
import StreamChat from '@/components/StreamChat'

type TabType = 'todo' | 'prompt' | 'chat'

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('todo')

  return (
    <div className="min-h-screen paper-texture p-8">
      <div className="max-w-4xl mx-auto">
        {/* 手账页面 */}
        <div className="notebook-page">
          {/* Tab 切换 */}
          <div className="mb-8 flex gap-4 justify-center">
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
              onClick={() => setActiveTab('chat')}
              className={`notebook-tab ${activeTab === 'chat' ? 'active' : ''}`}
            >
              AI 聊天
            </button>
          </div>

          {/* Tab 内容 */}
          {activeTab === 'todo' && <TodoList />}
          {activeTab === 'prompt' && <PromptOptimizer />}
          {activeTab === 'chat' && <StreamChat />}
        </div>
      </div>
    </div>
  )
}

