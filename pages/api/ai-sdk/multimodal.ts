import { streamText, generateText, tool, UIMessage } from 'ai';
import { z } from 'zod';
import { deepseek, nanobanana, veo3 } from '@/lib/ai/models';
import { VIDEO_GENERATION_METHOD, DOUBAO_API_BASE_URL, DOUBAO_API_TOKEN, DOUBAO_VIDEO_MODEL } from '@/lib/config';

export const config = {
  runtime: 'edge',
};

// 图片生成工具
const generateImage = tool({
  description: `根据用户描述生成手绘风格的知识图片。

触发条件（满足以下任一条件即可）：
- 用户明确说"生成图片"、"画一张"、"帮我生成一张图"、"创建图片"、"制作图片"
- 用户说"我想要一张..."、"给我画一个..."、"帮我画..."
- 用户询问"能生成图片吗？"、"可以画图吗？"（需要确认后调用）

使用场景：
- 用户想要生成知识图谱、概念图、示意图等
- 用户想要生成手绘风格的图片
- 用户想要可视化某个概念或想法

注意：只有当用户明确表达生成图片的意图时，才调用此工具。如果用户只是询问"什么是图片生成"，不要调用工具，而是用文本解释。`,
  inputSchema: z.object({
    prompt: z.string()
      .min(1, '提示词不能为空')
      .max(500, '提示词长度不能超过500个字符')
      .describe('图片生成提示词，描述用户想要生成的图片内容。从用户输入中提取，如果用户没有明确说明，可以基于对话上下文推断。例如："一只可爱的小猫"、"知识图谱展示机器学习流程"等。'),
  }),
  execute: async ({ prompt }) => {
    // 输入验证
    if (!prompt || prompt.trim().length === 0) {
      return {
        success: false,
        error: '提示词不能为空',
      };
    }

    if (prompt.length > 500) {
      return {
        success: false,
        error: '提示词长度不能超过500个字符',
      };
    }

    try {
      // 使用 generateText 获取完整响应（比 streamText 更简洁）
      const result = await generateText({
        model: nanobanana,
        prompt: `生成手绘风格的知识图片：${prompt.trim()}`,
      });

      let imageUrl: string | null = null;

      // 方法1：优先从 result.files 中获取图片（AI SDK 标准方式）
      if (result.files?.length) {
        const imageFile = result.files.find(f => f.mediaType.startsWith('image/'));
        if (imageFile) {
          imageUrl = `data:${imageFile.mediaType};base64,${imageFile.base64}`;
        }
      }

      // 方法2：如果 files 为空，从 text 中提取（兼容不支持 files 的代理）
      if (!imageUrl && result.text) {
        const fullText = result.text;

        // 尝试匹配 base64 data URL
        const base64Match = fullText.match(/data:image\/[^;]+;base64,[A-Za-z0-9+\/=]+/);
        if (base64Match) {
          imageUrl = base64Match[0];
        }

        // 尝试匹配 HTTP URL
        if (!imageUrl) {
          const httpMatch = fullText.match(/https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp)/i);
          if (httpMatch) {
            imageUrl = httpMatch[0];
          }
        }
      }

      // 调试日志（开发环境）
      if (process.env.NODE_ENV === 'development') {
        console.log('图片生成调试信息:', {
          hasFiles: !!result.files?.length,
          filesCount: result.files?.length || 0,
          textLength: result.text?.length || 0,
          imageUrlFound: !!imageUrl,
          imageUrlPreview: imageUrl ? `${imageUrl.substring(0, 50)}...` : null,
        });
      }

      if (!imageUrl) {
        const isDevelopment = process.env.NODE_ENV === 'development';
        return {
          success: false,
          error: '图片生成失败，未返回图片数据',
          ...(isDevelopment && { debug: result.text?.substring(0, 200) }),
        };
      }

      return {
        success: true,
        imageUrl,
        prompt: prompt.trim(),
      };
    } catch (error: any) {
      console.error('图片生成失败:', error);

      let errorMessage = '图片生成失败';
      if (error.message) {
        if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
          errorMessage = '图片生成超时，请稍后重试';
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = '请求过于频繁，请稍后重试';
        } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
          errorMessage = 'API 认证失败，请检查配置';
        } else {
          const isDevelopment = process.env.NODE_ENV === 'development';
          errorMessage = isDevelopment ? error.message : '图片生成失败，请稍后重试';
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

// 视频生成函数：使用 Veo3 模型（旧方式）
async function generateVideoWithVeo3(prompt: string): Promise<{ success: boolean; videoUrl?: string; error?: string; prompt?: string }> {
  try {
    // 使用 generateText 获取完整响应
    const result = await generateText({
      model: veo3,
      prompt: prompt.trim(),
    });

    let videoUrl: string | null = null;

    // 方法1：优先从 result.files 中获取视频（AI SDK 标准方式）
    if (result.files?.length) {
      const videoFile = result.files.find(f => f.mediaType.startsWith('video/'));
      if (videoFile) {
        videoUrl = `data:${videoFile.mediaType};base64,${videoFile.base64}`;
      }
    }

    // 方法2：如果 files 为空，从 text 中提取（兼容不支持 files 的代理）
    if (!videoUrl && result.text) {
      const fullText = result.text;

      // 尝试匹配 base64 data URL
      const base64Match = fullText.match(/data:video\/[^;]+;base64,[A-Za-z0-9+\/=]+/);
      if (base64Match) {
        videoUrl = base64Match[0];
      }

      // 尝试匹配 HTTP URL
      if (!videoUrl) {
        const httpMatch = fullText.match(/https?:\/\/[^\s"'<>]+\.(mp4|webm|mov|avi)/i);
        if (httpMatch) {
          videoUrl = httpMatch[0];
        }
      }
    }

    // 调试日志（开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.log('视频生成调试信息:', {
        hasFiles: !!result.files?.length,
        filesCount: result.files?.length || 0,
        textLength: result.text?.length || 0,
        videoUrlFound: !!videoUrl,
        videoUrlPreview: videoUrl ? `${videoUrl.substring(0, 50)}...` : null,
      });
    }

    if (!videoUrl) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      return {
        success: false,
        error: '视频生成失败，未返回视频数据',
        ...(isDevelopment && { debug: result.text?.substring(0, 200) }),
      };
    }

    return {
      success: true,
      videoUrl,
      prompt: prompt.trim(),
    };
  } catch (error: any) {
    console.error('视频生成失败:', error);

    let errorMessage = '视频生成失败';
    if (error.message) {
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        errorMessage = '视频生成超时，请稍后重试';
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        errorMessage = '请求过于频繁，请稍后重试';
      } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
        errorMessage = 'API 认证失败，请检查配置';
      } else {
        const isDevelopment = process.env.NODE_ENV === 'development';
        errorMessage = isDevelopment ? error.message : '视频生成失败，请稍后重试';
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// 视频生成函数：使用豆包（Doubao）API（新方式）
async function generateVideoWithDoubao(
  prompt: string,
  imageUrl?: string
): Promise<{ success: boolean; videoUrl?: string; error?: string; prompt?: string }> {
  const startTime = Date.now();
  console.log('[豆包视频生成] 开始执行，参数:', {
    prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
    promptLength: prompt.length,
    hasImageUrl: !!imageUrl,
    imageUrl: imageUrl ? imageUrl.substring(0, 100) + '...' : null,
    apiBaseUrl: DOUBAO_API_BASE_URL,
    model: DOUBAO_VIDEO_MODEL,
  });

  try {
    // 检查配置
    if (!DOUBAO_API_TOKEN) {
      console.error('[豆包视频生成] 配置错误: DOUBAO_API_TOKEN 未配置');
      return {
        success: false,
        error: '豆包 API Token 未配置',
      };
    }

    // 构建请求内容
    const content: any[] = [
      {
        type: 'text',
        text: prompt.trim(),
      },
    ];

    // 如果提供了图片 URL，添加图片内容（图生视频）
    if (imageUrl) {
      content.push({
        type: 'image_url',
        image_url: {
          url: imageUrl,
        },
      });
      console.log('[豆包视频生成] 图生视频模式，已添加图片 URL');
    } else {
      console.log('[豆包视频生成] 文本生成视频模式');
    }

    // 步骤1：创建视频生成任务
    const createTaskUrl = `${DOUBAO_API_BASE_URL}/api/v3/contents/generations/tasks`;
    const createTaskBody = {
      model: DOUBAO_VIDEO_MODEL,
      content: content,
    };

    console.log('[豆包视频生成] 创建任务请求:', {
      url: createTaskUrl,
      model: DOUBAO_VIDEO_MODEL,
      contentTypes: content.map(c => c.type),
      contentLength: JSON.stringify(createTaskBody).length,
    });

    const createTaskResponse = await fetch(createTaskUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DOUBAO_API_TOKEN}`,
      },
      body: JSON.stringify(createTaskBody),
    });

    console.log('[豆包视频生成] 创建任务响应:', {
      status: createTaskResponse.status,
      statusText: createTaskResponse.statusText,
      ok: createTaskResponse.ok,
    });

    if (!createTaskResponse.ok) {
      const errorData = await createTaskResponse.text();
      console.error('[豆包视频生成] 创建任务失败:', {
        status: createTaskResponse.status,
        statusText: createTaskResponse.statusText,
        errorData: errorData.substring(0, 500),
      });
      return {
        success: false,
        error: `创建任务失败: ${createTaskResponse.status} ${createTaskResponse.statusText}`,
      };
    }

    const taskData = await createTaskResponse.json();
    const taskId = taskData.id || taskData.task_id;

    console.log('[豆包视频生成] 任务创建成功:', {
      taskId,
      taskData: JSON.stringify(taskData).substring(0, 500),
    });

    if (!taskId) {
      console.error('[豆包视频生成] 创建任务失败，未返回任务 ID:', taskData);
      return {
        success: false,
        error: '创建任务失败，未返回任务 ID',
      };
    }

    // 步骤2：轮询查询任务状态，直到完成或失败
    const maxAttempts = 60; // 最多轮询60次
    const pollInterval = 2000; // 每次间隔2秒
    let attempts = 0;

    console.log('[豆包视频生成] 开始轮询任务状态:', {
      taskId,
      maxAttempts,
      pollInterval,
    });

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;

      const queryTaskUrl = `${DOUBAO_API_BASE_URL}/api/v3/contents/generations/tasks/${taskId}`;
      console.log(`[豆包视频生成] 轮询任务状态 (${attempts}/${maxAttempts}):`, {
        taskId,
        url: queryTaskUrl,
      });

      const queryTaskResponse = await fetch(queryTaskUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DOUBAO_API_TOKEN}`,
        },
      });

      if (!queryTaskResponse.ok) {
        const errorData = await queryTaskResponse.text();
        console.error('[豆包视频生成] 查询任务状态失败:', {
          attempt: attempts,
          status: queryTaskResponse.status,
          statusText: queryTaskResponse.statusText,
          errorData: errorData.substring(0, 500),
        });
        return {
          success: false,
          error: `查询任务状态失败: ${queryTaskResponse.status} ${queryTaskResponse.statusText}`,
        };
      }

      const taskStatus = await queryTaskResponse.json();
      const status = taskStatus.status || taskStatus.state;

      console.log(`[豆包视频生成] 任务状态 (${attempts}/${maxAttempts}):`, {
        taskId,
        status,
        taskStatus: JSON.stringify(taskStatus).substring(0, 500),
      });

      // 任务完成（根据实际返回结构，status 为 'succeeded' 时成功）
      if (status === 'succeeded' || status === 'completed' || status === 'success' || status === 'done') {
        // 提取视频 URL（根据实际返回结构，video_url 在 content.video_url 中）
        const videoUrl = taskStatus.content?.video_url ||
                        taskStatus.video_url || 
                        taskStatus.result?.video_url || 
                        taskStatus.output?.video_url ||
                        taskStatus.data?.video_url;

        console.log('[豆包视频生成] 任务完成:', {
          taskId,
          status,
          hasVideoUrl: !!videoUrl,
          videoUrl: videoUrl ? videoUrl.substring(0, 100) + '...' : null,
          contentKeys: taskStatus.content ? Object.keys(taskStatus.content) : null,
          elapsedTime: Date.now() - startTime,
        });

        if (!videoUrl) {
          console.error('[豆包视频生成] 任务完成但未返回视频 URL:', {
            taskStatus: JSON.stringify(taskStatus).substring(0, 1000),
          });
          return {
            success: false,
            error: '任务完成但未返回视频 URL',
          };
        }

        console.log('[豆包视频生成] 视频生成成功，总耗时:', Date.now() - startTime, 'ms');
        return {
          success: true,
          videoUrl,
          prompt: prompt.trim(),
        };
      }

      // 任务失败
      if (status === 'failed' || status === 'error' || status === 'cancelled') {
        const errorMsg = taskStatus.error || taskStatus.message || '任务执行失败';
        console.error('[豆包视频生成] 任务失败:', {
          taskId,
          status,
          errorMsg,
          taskStatus: JSON.stringify(taskStatus).substring(0, 500),
          elapsedTime: Date.now() - startTime,
        });
        return {
          success: false,
          error: `视频生成失败: ${errorMsg}`,
        };
      }

      // 任务进行中，继续轮询
      if (status === 'pending' || status === 'processing' || status === 'running' || status === 'in_progress') {
        if (attempts % 10 === 0) {
          // 每10次轮询记录一次进度
          console.log(`[豆包视频生成] 任务进行中 (${attempts}/${maxAttempts}):`, {
            taskId,
            status,
            elapsedTime: Date.now() - startTime,
          });
        }
        continue;
      }

      // 未知状态，记录日志并继续
      console.warn('[豆包视频生成] 未知任务状态:', {
        taskId,
        status,
        taskStatus: JSON.stringify(taskStatus).substring(0, 500),
      });
    }

    // 超时
    console.error('[豆包视频生成] 轮询超时:', {
      taskId,
      attempts,
      maxAttempts,
      elapsedTime: Date.now() - startTime,
    });
    return {
      success: false,
      error: '视频生成超时，请稍后重试',
    };
  } catch (error: any) {
    console.error('[豆包视频生成] 异常错误:', {
      error: error.message,
      stack: error.stack,
      elapsedTime: Date.now() - startTime,
    });
    
    // 根据错误类型返回不同的错误信息
    let errorMessage = '视频生成失败';
    if (error.message) {
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        errorMessage = '视频生成超时，请稍后重试';
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        errorMessage = '请求过于频繁，请稍后重试';
      } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
        errorMessage = 'API 认证失败，请检查配置';
      } else {
        // 生产环境不暴露详细错误信息
        const isDevelopment = process.env.NODE_ENV === 'development';
        errorMessage = isDevelopment ? error.message : '视频生成失败，请稍后重试';
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// 视频生成工具
const generateVideo = tool({
  description: `根据用户描述生成视频。

触发条件（满足以下任一条件即可）：
- 用户明确说"生成视频"、"做一个视频"、"帮我生成一个视频"、"创建视频"、"制作视频"
- 用户说"我想要一个视频..."、"给我做一个..."、"帮我做一个视频..."
- 用户询问"能生成视频吗？"、"可以制作视频吗？"（需要确认后调用）

使用场景：
- 用户想要生成动态场景视频
- 用户想要生成演示视频
- 用户想要可视化某个动态过程

注意：只有当用户明确表达生成视频的意图时，才调用此工具。如果用户只是询问"什么是视频生成"，不要调用工具，而是用文本解释。`,
  inputSchema: z.object({
    prompt: z.string()
      .min(1, '提示词不能为空')
      .max(500, '提示词长度不能超过500个字符')
      .describe('视频生成提示词，描述用户想要生成的视频内容。从用户输入中提取，如果用户没有明确说明，可以基于对话上下文推断。例如："海浪拍打海岸"、"日出场景"、"机器人在工厂工作"等。'),
  }),
  execute: async ({ prompt }) => {
    // 输入验证
    if (!prompt || prompt.trim().length === 0) {
      return {
        success: false,
        error: '提示词不能为空',
      };
    }

    if (prompt.length > 500) {
      return {
        success: false,
        error: '提示词长度不能超过500个字符',
      };
    }

    // 根据配置选择视频生成方式
    if (VIDEO_GENERATION_METHOD === 'doubao') {
      // 使用豆包 API（新方式）
      return await generateVideoWithDoubao(prompt.trim());
    } else {
      // 使用 Veo3 模型（旧方式，默认）
      return await generateVideoWithVeo3(prompt.trim());
    }
  },
});

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      { 
        status: 405,
        headers: { 'Allow': 'POST', 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 将 UI 消息格式转换为标准的 Model 消息格式
    const modelMessages = messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => {
        let content = '';
        if (msg.parts && Array.isArray(msg.parts)) {
          content = msg.parts
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text || '')
            .join('');
        } else if (typeof (msg as any).content === 'string') {
          content = (msg as any).content;
        }
        
        return {
          role: msg.role as 'user' | 'assistant',
          content: (content || '').trim()
        };
      })
      .filter(msg => msg.content.length > 0)
      .slice(-20); // 限制消息历史长度，避免 token 过多

    // 使用 streamText 生成流式响应，并注册工具
    const result = await streamText({
      model: deepseek,
      messages: modelMessages,
      system: `你是一个多模态 AI 助手，可以帮助用户：
1. 进行文本对话
2. 生成手绘风格的知识图片
3. 生成视频

工具使用规则：
- generateImage: 当用户明确要求生成图片时使用（关键词：生成图片、画一张、帮我生成一张图、创建图片等）
- generateVideo: 当用户明确要求生成视频时使用（关键词：生成视频、做一个视频、帮我生成一个视频、创建视频等）
- 其他情况：使用普通文本回复

重要提示：
- 只有当用户明确表达生成图片或视频的意图时，才调用工具
- 如果用户只是询问"什么是图片生成"或"什么是视频生成"，不要调用工具，而是用文本解释
- 如果用户说"我想看看图片"或"我想看看视频"，不要调用工具，而是询问用户想看什么内容
- 从用户输入中提取 prompt 参数时，要准确理解用户的意图，不要遗漏关键信息`,
      tools: {
        generateImage,
        generateVideo,
      },
    });

    // 转换为 useChat 需要的格式
    return result.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error('Multimodal API error:', error);
    
    // 根据错误类型返回不同的状态码和错误信息
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    
    if (error.message) {
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        statusCode = 504;
        errorMessage = '请求超时，请稍后重试';
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        statusCode = 429;
        errorMessage = '请求过于频繁，请稍后重试';
      } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
        statusCode = 401;
        errorMessage = 'API 认证失败';
      } else if (error.message.includes('400') || error.message.includes('bad request')) {
        statusCode = 400;
        errorMessage = '请求参数错误';
      }
    }
    
    // 生产环境不暴露详细错误信息
    const isDevelopment = process.env.NODE_ENV === 'development';
    const finalErrorMessage = isDevelopment ? error.message || errorMessage : errorMessage;
    
    return new Response(
      JSON.stringify({ 
        error: finalErrorMessage
      }),
      { 
        status: statusCode, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

