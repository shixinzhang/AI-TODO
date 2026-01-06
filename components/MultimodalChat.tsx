'use client';

import { useChat } from '@ai-sdk/react';
import { useRef, useState, useEffect } from 'react';

interface Attachment {
  name: string;
  contentType: string;
  url: string;
}

export default function MultimodalChat() {
  const { 
    messages, 
    input, 
    setInput,
    handleInputChange, 
    handleSubmit, 
    isLoading,
    data,
    setData
  } = useChat({
    api: '/api/chat/multimodal',
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // 读取文件为 Data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      
      // 设置附件
      setData({
        ...data,
        attachments: [
          {
            name: file.name,
            contentType: file.type,
            url: dataUrl,
          }
        ]
      });
    };
    reader.readAsDataURL(file);
  };

  // 移除附件
  const removeAttachment = () => {
    setData({ ...data, attachments: [] });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        
        // 发送到后端转文字
        const formData = new FormData();
        formData.append('audio', blob);

        try {
          const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();
          if (result.text) {
            setInput(result.text); // 填入输入框
          }
        } catch (error) {
          console.error('语音转文字失败:', error);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('录音失败:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  // 监听 AI 回复完成，自动播放语音
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && !isLoading && lastMessage.content) {
      playAudio(lastMessage.content);
    }
  }, [messages, isLoading]);

  // 播放语音
  const playAudio = async (text: string) => {
    if (!text || isSpeaking) return;

    setIsSpeaking(true);

    try {
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('TTS API error');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        audioRef.current.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
      }
    } catch (error) {
      console.error('播放语音失败:', error);
      setIsSpeaking(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto h-[600px] border-2 border-dashed border-gray-300 rounded-lg bg-white shadow-sm">
      {/* 标题 */}
      <h2 className="handwriting-title text-2xl mb-4 text-center text-gray-800 p-4 border-b">
        多模态聊天
      </h2>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-12 handwriting text-lg">
            开始对话吧！可以发送文字、图片或语音...
          </div>
        )}

        {messages.map(m => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                m.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-900'
              }`}
            >
              {/* 渲染图片附件 */}
              {m.attachments?.map((attachment: Attachment, i: number) => (
                <img
                  key={i}
                  src={attachment.url}
                  alt={attachment.name}
                  className="max-w-full rounded mb-2"
                />
              ))}
              
              {/* 文本内容 */}
              <div className="whitespace-pre-wrap">{m.content}</div>

              {/* 显示正在播放状态 */}
              {m.role === 'assistant' && isSpeaking && m === messages[messages.length - 1] && (
                <div className="flex items-center space-x-2 mt-2 text-xs opacity-70">
                  <span>🔊</span>
                  <span>正在播放...</span>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 rounded-lg px-4 py-2">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 隐藏的音频播放器 */}
      <audio ref={audioRef} className="hidden" />

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        {/* 附件预览 */}
        {data?.attachments && data.attachments.length > 0 && (
          <div className="mb-2 p-2 bg-gray-100 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img
                src={(data.attachments[0] as Attachment).url}
                alt={(data.attachments[0] as Attachment).name}
                className="w-12 h-12 object-cover rounded"
              />
              <span className="text-sm text-gray-600">
                {(data.attachments[0] as Attachment).name}
              </span>
            </div>
            <button
              type="button"
              onClick={removeAttachment}
              className="text-gray-500 hover:text-gray-700 text-xl"
              title="移除附件"
            >
              ×
            </button>
          </div>
        )}
        
        <div className="flex space-x-2">
          {/* 文件上传按钮 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50"
            title="上传图片"
          >
            📎
          </button>
          
          {/* 录音按钮 */}
          <button
            type="button"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            className={`px-3 py-2 border rounded-lg ${
              isRecording ? 'bg-red-500 text-white' : 'hover:bg-gray-50'
            }`}
            title={isRecording ? '松开停止录音' : '按住说话'}
          >
            {isRecording ? '⏹' : '🎤'}
          </button>
          
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={isRecording ? '录音中...' : '输入消息...'}
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
        </div>
      </form>
    </div>
  );
}

