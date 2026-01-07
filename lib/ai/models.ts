import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// DeepSeek 配置（兼容 OpenAI 接口）
export const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://sg.uiuiapi.com/v1',
}).chat('doubao-seed-1-6-250615');

// DeepSeek 配置（兼容 OpenAI 接口）
// 使用 .chat() 方法调用传统的 /chat/completions 端点
// 而不是默认的 /responses 端点（SiliconFlow 可能不支持）
// export const deepseek = createOpenAI({
//   apiKey: process.env.DEEPSEEK_API_KEY,
//   baseURL: 'https://api.siliconflow.cn/v1',
// }).chat('Pro/zai-org/GLM-4.7');

// Gemini 配置
export const gemini = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
})('gemini-1.5-pro');

// 图片生成模型（Gemini 3 Pro Image Preview）
export const nanobanana = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://sg.uiuiapi.com/v1',
}).chat('gemini-3-pro-image-preview');

// 视频生成模型（Veo3）
export const veo3 = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://sg.uiuiapi.com/v1',
}).chat('veo3');

