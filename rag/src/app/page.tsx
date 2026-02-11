"use client";

import { useState } from "react";
import { Upload, Trash2, Send, FileText, Bot, User, Database } from "lucide-react";
import DocumentsModal from "./components/DocumentsModal";

interface Message {
  role: "user" | "assistant" | "error";
  content: string;
  sources?: any[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [sourceDocs, setSourceDocs] = useState<any[]>([]);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalDocs, setTotalDocs] = useState(0);

  const SUGGESTIONS = [
    "推荐一款降噪耳机",
    "人体工学椅 V2 多少钱？",
    "七天无理由退货的条件是什么？",
    "数码产品保修期多久？"
  ];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    setUploadStatus("Uploading...");
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadStatus(`Success: ${data.message} (${data.chunks} chunks)`);
    } catch (err: any) {
      setUploadStatus(`Error: ${err.message}`);
    }
  };

  const handleFetchDocuments = async (page = 1) => {
    // If called from an event handler, page might be an event object, so check type or default to 1
    const pageNum = typeof page === 'number' ? page : 1;
    
    try {
      const res = await fetch(`/api/documents?page=${pageNum}&pageSize=${pageSize}`);
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
        setTotalDocs(data.total || 0);
        setCurrentPage(pageNum);
        setShowDocsModal(true);
      } else {
        alert("No documents found or failed to fetch.");
      }
    } catch (err: any) {
      alert(`Failed to fetch documents: ${err.message}`);
    }
  };

  const sendMessage = async (userMsg: string) => {
    if (!userMsg.trim()) return;

    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, sources: data.sources }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "error", content: err.message }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset the knowledge base?")) return;
    try {
      await fetch("/api/reset", { method: "POST" });
      setUploadStatus("Knowledge base reset.");
      setMessages([]);
      setDocuments([]); // Clear local docs
    } catch (err: any) {
      setUploadStatus(`Reset failed: ${err.message}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-2 sticky top-0 z-10">
        <Bot className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold">睿智商城智能客服</h1>
      </header>

      <main className="flex-1 flex flex-col md:flex-row max-w-6xl mx-auto w-full p-4 gap-6">
        {/* Sidebar */}
        <aside className="w-full md:w-80 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload Profile
            </h2>
            <div className="flex flex-col gap-3">
              <label className="block">
                <span className="sr-only">Choose file</span>
                <input
                  type="file"
                  accept=".pdf,.txt,.csv,.md"
                  onChange={handleUpload}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                  "
                />
              </label>
              {uploadStatus && (
                <p className="text-xs text-gray-600 break-all bg-gray-50 p-2 rounded">
                  {uploadStatus}
                </p>
              )}
              
              <button
                onClick={() => handleFetchDocuments(1)}
                className="mt-2 w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <Database className="w-4 h-4" /> View Knowledge Base
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <h2 className="font-semibold mb-4 text-red-600 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Danger Zone
            </h2>
            <button
              onClick={handleReset}
              className="w-full py-2 px-4 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
            >
              Reset Knowledge Base
            </button>
          </div>
        </aside>

        {/* Chat Area */}
        <section className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-[600px] md:h-auto">
          {/* ... existing chat UI ... */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                <FileText className="w-12 h-12 opacity-20" />
                <p>👋 您好，我是睿智商城的智能客服。请问有什么可以帮您？</p>
                <p className="text-xs">您可以问我：这款耳机有降噪吗？怎么退货？</p>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 max-w-[85%] ${
                  msg.role === "user" ? "self-end flex-row-reverse" : "self-start"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === "user" ? "bg-blue-600 text-white" : "bg-green-600 text-white"
                  }`}
                >
                  {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div
                  data-testid={msg.role === "user" ? "user-message" : msg.role === "error" ? "error-message" : "assistant-message"}
                  className={`p-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : msg.role === "error"
                      ? "bg-red-50 text-red-600 border border-red-100"
                      : "bg-gray-100 text-gray-800 rounded-tl-none"
                  }`}
                >
                  {msg.content}
                  {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200/50">
                          <button
                            onClick={() => {
                                setSourceDocs(msg.sources || []);
                                setShowSourceModal(true);
                            }}
                            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                          >
                              <Database className="w-3 h-3" />
                              View {msg.sources.length} Sources
                          </button>
                      </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 self-start">
                 <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center">
                    <Bot className="w-5 h-5" />
                 </div>
                 <div className="bg-gray-100 p-3 rounded-2xl rounded-tl-none text-sm text-gray-500 animate-pulse">
                    Thinking...
                 </div>
              </div>
            )}
          </div>

          <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
            {SUGGESTIONS.map((text, i) => (
              <button
                key={i}
                onClick={() => sendMessage(text)}
                disabled={isLoading}
                className="whitespace-nowrap text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200 hover:text-gray-900 transition-colors disabled:opacity-50 border border-gray-200"
              >
                {text}
              </button>
            ))}
          </div>

          <form onSubmit={handleChat} className="p-4 border-t bg-gray-50 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about the AI Shop..."
              className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </section>
      </main>

      {/* Documents Modal */}
      <DocumentsModal
        isOpen={showDocsModal}
        onClose={() => setShowDocsModal(false)}
        title="Knowledge Base"
        documents={documents}
        pagination={{
          currentPage,
          pageSize,
          totalDocs,
          onPageChange: handleFetchDocuments,
        }}
      />

      {/* Source Documents Modal */}
      <DocumentsModal
        isOpen={showSourceModal}
        onClose={() => setShowSourceModal(false)}
        title="Query Sources"
        documents={sourceDocs}
      />
    </div>
  );
}
