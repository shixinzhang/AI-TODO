
'use client';

import { useState, useEffect } from 'react';

type ActionType = 
  | 'load-text'
  | 'load-json'
  | 'load-csv'
  | 'load-web'
  | 'load-pdf'
  | 'load-pdf-web'
  | 'load-directory'
  | 'split-text'
  | 'embedding'
  | 'vector-store-memory'
  | 'vector-store-chroma'
  | 'retrieval'
  | 'retrieval-multi-query'
  | 'retrieval-hyde'
  | 'retrieval-contextual-compression'
  | 'retrieval-rerank'
  | 'retrieval-parent-document'
  | 'generation'
  | 'generation-json';

interface DemoSection {
  title: string;
  actions: { label: string; action: ActionType; description: string }[];
}

const SECTIONS: DemoSection[] = [
  {
    title: '1. 数据加载 (Data Loading)',
    actions: [
      { label: 'Policy Loader', action: 'load-text', description: '加载售后政策 (Markdown/Text)' },
      { label: 'Product Loader', action: 'load-csv', description: '加载商品库存表 (CSV)' },
      { label: 'JSONLoader', action: 'load-json', description: '加载并解析 JSON 文件' },
      { label: 'WebLoader', action: 'load-web', description: '加载网页内容' },
      { label: 'DirectoryLoader', action: 'load-directory', description: '批量加载目录' },
    ]
  },
  {
    title: '1.5 PDF 高级解析 (Advanced PDF)',
    actions: [
      { label: 'PDFLoader', action: 'load-pdf', description: '标准加载 (基于 pdf-parse)' },
      { label: 'WebPDFLoader', action: 'load-pdf-web', description: '高级加载 (基于 pdfjs-dist)' },
    ]
  },
  {
    title: '2. 文本处理 (Text Processing)',
    actions: [
      { label: 'Text Splitters', action: 'split-text', description: '对比 Recursive, Character, Token 三种切分方式' },
    ]
  },
  {
    title: '3. 向量化与存储 (Embedding & Vector Store)',
    actions: [
      { label: 'OpenAI Embedding', action: 'embedding', description: '将文本转换为向量' },
      { label: 'Memory Store', action: 'vector-store-memory', description: '存入内存向量库 (MemoryVectorStore)' },
      { label: 'Chroma DB', action: 'vector-store-chroma', description: '存入 Chroma (需本地服务)' },
    ]
  },
  {
    title: '4. 检索 (Retrieval)',
    actions: [
      { label: 'Basic Retrieval', action: 'retrieval', description: '基于向量相似度的检索' },
      { label: 'Multi-Query', action: 'retrieval-multi-query', description: '多角度查询 (查询重写)' },
      { label: 'HyDE', action: 'retrieval-hyde', description: '假设文档嵌入 (Hypothetical Document Embedding)' },
      { label: 'Contextual Compression', action: 'retrieval-contextual-compression', description: '上下文压缩 (只保留相关内容)' },
      { label: 'LLM Re-ranking', action: 'retrieval-rerank', description: 'LLM 重排 (自实现 Rerank)' },
      { label: 'Parent Document', action: 'retrieval-parent-document', description: '父文档检索 (切小块搜，回大块文)' },
    ]
  },
  {
    title: '5. 生成 (Generation)',
    actions: [
      { label: 'Basic Generation', action: 'generation', description: '基于上下文的回答生成' },
      { label: 'JSON Output', action: 'generation-json', description: '结构化输出 (JSON Output Parser)' },
    ]
  }
];

export default function RagDemoPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    const storedKey = localStorage.getItem("openai-api-key");
    if (storedKey) setApiKey(storedKey);
  }, []);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem("openai-api-key", apiKey);
    }
  }, [apiKey]);

  const handleAction = async (action: ActionType) => {
    setLoading(action);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['x-openai-api-key'] = apiKey;
      }
      
      const res = await fetch('/api/rag-demo', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setResults(prev => ({ ...prev, [action]: data }));
    } catch (err: any) {
      setError(err.message);
      setResults(prev => ({ ...prev, [action]: { error: err.message } }));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-blue-800">电商智能客服 RAG 实战演示</h1>
        <p className="mb-4 text-gray-600">
          基于 Next.js 和 LangChain 的 RAG 全流程分步演示：从商品数据加载到智能客服问答。
          <br />
          <a href="https://xiaobot.net/p/ai_1024" target="_blank" className="text-sm text-blue-600 hover:text-blue-800">对应教程：RAG 实战｜电商智能客服</a>
        </p>
        
        <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key (Optional if env var set)
            </label>
            <input 
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Key 会保存在本地浏览器 (localStorage)，不会上传到服务器。</p>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <div key={section.title} className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">{section.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.actions.map(({ label, action, description }) => (
                  <div key={action} className="border rounded p-4 hover:bg-gray-50 transition">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium">{label}</h3>
                      <button
                        onClick={() => handleAction(action)}
                        disabled={loading !== null}
                        className={`px-3 py-1 rounded text-sm font-semibold text-white 
                          ${loading === action ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        {loading === action ? '运行中...' : '运行'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{description}</p>
                    
                    {results[action] && (
                      <div className="mt-2 bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto font-mono">
                        <pre>{JSON.stringify(results[action], null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
