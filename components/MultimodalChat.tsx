'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { isToolUIPart, getToolName } from 'ai';
import { useRef, useState, useEffect } from 'react';

interface Attachment {
  name: string;
  contentType: string;
  url: string;
}

export default function MultimodalChat() {
  const { 
    messages, 
    sendMessage, 
    status
  } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/ai-sdk/multimodal',
    }),
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  const isLoading = status === 'submitted' || status === 'streaming';

  // 调试：打印所有消息（开发环境）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('📨 所有消息:', messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        partsCount: m.parts?.length || 0,
        parts: m.parts?.map((p: any) => ({
          type: p.type,
          state: p.state,
          toolName: p.toolName || (isToolUIPart(p) ? getToolName(p) : null),
          hasOutput: !!p.output,
          outputKeys: p.output && typeof p.output === 'object' ? Object.keys(p.output) : null,
          outputSuccess: p.output?.success,
          outputImageUrl: p.output?.imageUrl ? `${p.output.imageUrl.substring(0, 50)}...` : null,
        })),
      })));
    }
  }, [messages]);

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
      setAttachments([
        {
          name: file.name,
          contentType: file.type,
          url: dataUrl,
        }
      ]);
    };
    reader.readAsDataURL(file);
  };

  // 移除附件
  const removeAttachment = () => {
    setAttachments([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // 处理表单提交
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || status !== 'ready') return;
    
    // 暂时不传递附件，专注于文本、图片和视频生成
    // TODO: 后续可以添加附件上传功能
    sendMessage({ 
      text: input,
    });
    setInput('');
    setAttachments([]);
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
    if (lastMessage && lastMessage.role === 'assistant' && !isLoading) {
      // 提取文本内容
      let textContent = '';
      if (lastMessage.parts) {
        textContent = lastMessage.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text || '')
          .join('');
      }
      if (textContent) {
        playAudio(textContent);
      }
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

  // 处理文本复制
  const handleTextCopy = async (text: string) => {
    if (!text) {
      console.error('文本内容为空');
      return;
    }

    try {
      // 检查浏览器是否支持 Clipboard API
      if (!navigator.clipboard) {
        // 降级方案：使用传统的复制方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('文本已复制到剪贴板');
        return;
      }

      await navigator.clipboard.writeText(text);
      alert('文本已复制到剪贴板');
    } catch (error: any) {
      console.error('复制文本失败:', error);
      const errorMessage = error.message || '复制失败';
      alert(`复制失败: ${errorMessage}`);
    }
  };

  // 处理图片操作
  const handleImageAction = async (action: 'copy' | 'download', imageUrl: string) => {
    if (!imageUrl) {
      console.error('图片 URL 为空');
      return;
    }

    if (action === 'copy') {
      try {
        // 检查浏览器是否支持 Clipboard API
        if (!navigator.clipboard || !window.ClipboardItem) {
          alert('您的浏览器不支持复制图片功能，请使用下载功能');
          return;
        }

        // 复制图片到剪贴板
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) {
          throw new Error('无效的图片格式');
        }

        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        alert('图片已复制到剪贴板');
      } catch (error: any) {
        console.error('复制图片失败:', error);
        const errorMessage = error.message || '复制失败';
        alert(`复制失败: ${errorMessage}，请尝试下载`);
      }
    } else if (action === 'download') {
      try {
        // 下载图片
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `generated-image-${Date.now()}.png`;
        link.target = '_blank'; // 在新标签页打开，避免阻塞
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('下载图片失败:', error);
        alert('下载失败，请检查浏览器设置');
      }
    }
  };

  // 处理视频操作
  const handleVideoAction = (action: 'download', videoUrl: string) => {
    if (!videoUrl) {
      console.error('视频 URL 为空');
      return;
    }

    if (action === 'download') {
      try {
        // 下载视频
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `generated-video-${Date.now()}.mp4`;
        link.target = '_blank'; // 在新标签页打开，避免阻塞
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('下载视频失败:', error);
        alert('下载失败，请检查浏览器设置');
      }
    }
  };

  // 渲染消息内容（支持工具调用结果）
  const renderMessageContent = (message: any) => {
    const content: React.ReactNode[] = [];
    
    // 调试：打印消息结构（开发环境）
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('渲染消息:', {
        id: message.id,
        role: message.role,
        parts: message.parts?.map((p: any) => ({
          type: p.type,
          state: p.state,
          toolName: p.toolName || getToolName(p),
          hasOutput: !!p.output,
          output: p.output ? (typeof p.output === 'object' ? Object.keys(p.output) : typeof p.output) : null,
        })),
      });
    }
    
    // 处理工具调用结果（图片和视频）
    if (message.parts && Array.isArray(message.parts)) {
      message.parts.forEach((part: any, index: number) => {
        if (isToolUIPart(part)) {
          const toolName = getToolName(part);
          
          // 调试：打印工具调用信息
          if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.log('工具调用 part:', {
              toolName,
              state: part.state,
              output: part.output,
              outputType: typeof part.output,
            });
          }
          
          // 图片生成工具
          if (toolName === 'generateImage') {
            if (part.state === 'output-available') {
              const result = part.output as any;
              
              // 调试：打印结果（开发环境）
              if (typeof window !== 'undefined') {
                const imageUrl = result?.imageUrl;
                const imageUrlStr = typeof imageUrl === 'string' ? imageUrl : String(imageUrl);
                const isBase64 = imageUrlStr.startsWith('data:image/');
                const isHttp = imageUrlStr.startsWith('http');
                const base64Data = isBase64 ? imageUrlStr.match(/base64,([A-Za-z0-9+\/=]+)/)?.[1] : null;
                const base64Length = base64Data?.length || 0;
                const isBase64Complete = base64Data ? (base64Data.endsWith('==') || base64Data.endsWith('=') || base64Data.length % 4 === 0) : false;
                
                console.log('🔍 图片生成工具 - 调试信息:', {
                  state: part.state,
                  success: result?.success,
                  hasImageUrl: !!imageUrl,
                  imageUrlType: typeof imageUrl,
                  imageUrlLength: imageUrlStr?.length || 0,
                  imageUrlStart: imageUrlStr?.substring(0, 50) || null,
                  imageUrlEnd: imageUrlStr?.substring(imageUrlStr.length - 30) || null,
                  isBase64Format: isBase64,
                  isHttpFormat: isHttp,
                  base64DataLength: base64Length,
                  isBase64Complete: isBase64Complete,
                  base64DataEnd: base64Data?.substring(base64Data.length - 10) || null,
                });
              }
              
              if (result?.success && result?.imageUrl) {
                // 确保 imageUrl 是完整的 base64 字符串
                const imageUrl = result.imageUrl.trim();
                const isBase64 = imageUrl.startsWith('data:image/');
                const isHttp = imageUrl.startsWith('http');
                
                if (!isBase64 && !isHttp) {
                  console.warn('⚠️ 图片 URL 格式异常:', imageUrl.substring(0, 100));
                } else if (isBase64) {
                  // 验证 base64 字符串的完整性
                  const base64Match = imageUrl.match(/base64,([A-Za-z0-9+\/=]+)/);
                  if (base64Match) {
                    const base64Data = base64Match[1];
                    const isComplete = base64Data.endsWith('==') || base64Data.endsWith('=') || base64Data.length % 4 === 0;
                    if (!isComplete) {
                      console.warn('⚠️ Base64 字符串可能不完整:', {
                        base64Length: base64Data.length,
                        base64End: base64Data.substring(base64Data.length - 10),
                        imageUrlLength: imageUrl.length,
                      });
                    }
                  }
                }
                
                content.push(
                  <div key={`tool-image-${index}`} className="my-2">
                    <img
                      src={result.imageUrl.trim()}
                      alt={result.prompt || '生成的图片'}
                      className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                      onClick={() => setExpandedImage(result.imageUrl.trim())}
                      onError={(e) => {
                        console.error('❌ 图片加载失败:', {
                          src: (e.target as HTMLImageElement).src.substring(0, 100),
                          error: e,
                        });
                        alert('图片加载失败，请检查图片 URL 格式');
                      }}
                      onLoad={() => {
                        console.log('✅ 图片加载成功');
                      }}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleImageAction('copy', result.imageUrl)}
                        className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                      >
                        复制
                      </button>
                      <button
                        onClick={() => handleImageAction('download', result.imageUrl)}
                        className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                      >
                        下载
                      </button>
                    </div>
                  </div>
                );
              } else if (result?.error) {
                const errorMessage = result.error || '未知错误';
                content.push(
                  <div key={`tool-image-error-${index}`} className="my-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                    <div className="font-semibold">图片生成失败</div>
                    <div className="mt-1">{errorMessage}</div>
                    {result.debug && (
                      <div className="mt-2 text-xs text-gray-500 font-mono bg-gray-100 p-1 rounded">
                        调试信息: {result.debug}
                      </div>
                    )}
                  </div>
                );
              }
            } else if (part.state === 'input-streaming' || part.state === 'input-available') {
              content.push(
                <div key={`tool-image-loading-${index}`} className="my-2 text-gray-500 text-sm">
                  正在生成图片...
                </div>
              );
            }
          }
          
          // 视频生成工具
          if (toolName === 'generateVideo') {
            if (part.state === 'output-available') {
              const result = part.output as any;
              if (result?.success && result?.videoUrl) {
                content.push(
                  <div key={`tool-video-${index}`} className="my-2">
                    <video
                      src={result.videoUrl}
                      controls
                      className="max-w-xs max-h-48 rounded-lg cursor-pointer hover:opacity-90"
                      onClick={() => setExpandedVideo(result.videoUrl)}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setExpandedVideo(result.videoUrl)}
                        className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                      >
                        放大查看
                      </button>
                      <button
                        onClick={() => handleVideoAction('download', result.videoUrl)}
                        className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                      >
                        下载
                      </button>
                    </div>
                  </div>
                );
              } else if (result?.error) {
                const errorMessage = result.error || '未知错误';
                content.push(
                  <div key={`tool-video-error-${index}`} className="my-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                    <div className="font-semibold">视频生成失败</div>
                    <div className="mt-1">{errorMessage}</div>
                    {result.debug && (
                      <div className="mt-2 text-xs text-gray-500 font-mono bg-gray-100 p-1 rounded">
                        调试信息: {result.debug}
                      </div>
                    )}
                  </div>
                );
              }
            } else if (part.state === 'input-streaming' || part.state === 'input-available') {
              content.push(
                <div key={`tool-video-loading-${index}`} className="my-2 text-gray-500 text-sm">
                  正在生成视频...
                </div>
              );
            }
          }
        } else if (part.type === 'text') {
          const textContent = part.text || '';
          content.push(
            <div key={`text-${index}`} className="my-2">
              <div className="whitespace-pre-wrap">{textContent}</div>
              {textContent && (
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => handleTextCopy(textContent)}
                    className="px-2 py-1 text-xs bg-gray-300 rounded hover:bg-gray-400 transition-colors"
                    title="复制文本"
                  >
                    复制
                  </button>
                </div>
              )}
            </div>
          );
        }
      });
    } else {
      // 如果没有 parts，尝试从其他字段获取内容
      const textParts = message.parts?.filter((p: any) => p.type === 'text') || [];
      if (textParts.length > 0) {
        textParts.forEach((part: any, index: number) => {
          const textContent = part.text || '';
          content.push(
            <div key={`text-fallback-${index}`} className="my-2">
              <div className="whitespace-pre-wrap">{textContent}</div>
              {textContent && (
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => handleTextCopy(textContent)}
                    className="px-2 py-1 text-xs bg-gray-300 rounded hover:bg-gray-400 transition-colors"
                    title="复制文本"
                  >
                    复制
                  </button>
                </div>
              )}
            </div>
          );
        });
      }
    }
    
    return content;
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto h-[600px] border-2 border-dashed border-gray-300 rounded-lg bg-white shadow-sm">
      {/* 标题 */}
      {/* <h2 className="handwriting-title text-2xl mb-4 text-center text-gray-800 p-4 border-b">
        多模态聊天
      </h2> */}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-12 handwriting text-lg">
            开始对话吧！可以发送文字、生成图片或视频...
          </div>
        )}

        {messages.map((m: any) => {
          // 只渲染 assistant 消息中的工具调用结果
          // user 消息不需要渲染工具调用
          if (m.role === 'user') {
            const userText = m.parts?.find((p: any) => p.type === 'text')?.text || m.content || '';
            return (
              <div
                key={m.id}
                className="flex justify-end"
              >
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-blue-500 text-white">
                  <div className="whitespace-pre-wrap">{userText}</div>
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => handleTextCopy(userText)}
                      className="px-2 py-1 text-xs bg-blue-600 rounded hover:bg-blue-700 opacity-80 hover:opacity-100 transition-opacity"
                      title="复制文本"
                    >
                      复制
                    </button>
                  </div>
                </div>
              </div>
            );
          }
          
          // assistant 消息：渲染工具调用结果和文本
          return (
            <div
              key={m.id}
              className="flex justify-start"
            >
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-200 text-gray-900">
                {/* 渲染消息内容（支持工具调用结果） */}
                {renderMessageContent(m)}

              {/* 显示正在播放状态 */}
              {m.role === 'assistant' && isSpeaking && m === messages[messages.length - 1] && (
                <div className="flex items-center space-x-2 mt-2 text-xs opacity-70">
                  <span>🔊</span>
                  <span>正在播放...</span>
                </div>
              )}
              </div>
            </div>
          );
        })}
        
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

      {/* 图片放大模态框 */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="放大图片"
            className="max-w-[90%] max-h-[90%] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 视频放大模态框 */}
      {expandedVideo && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setExpandedVideo(null)}
        >
          <div className="max-w-[90%] max-h-[90%] rounded-lg" onClick={(e) => e.stopPropagation()}>
            <video
              src={expandedVideo}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-lg"
            />
          </div>
        </div>
      )}

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        {/* 附件预览 */}
        {attachments.length > 0 && (
          <div className="mb-2 p-2 bg-gray-100 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img
                src={attachments[0].url}
                alt={attachments[0].name}
                className="w-12 h-12 object-cover rounded"
              />
              <span className="text-sm text-gray-600">
                {attachments[0].name}
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
            onChange={(e) => setInput(e.target.value)}
            placeholder={isRecording ? '录音中...' : '输入消息...（可以要求生成图片或视频）'}
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

