import { createOpenAI } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

// DeepSeek 配置（兼容 OpenAI 接口）
export const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
})('deepseek-chat');

// Gemini 配置
export const gemini = google('gemini-1.5-pro', {
  apiKey: process.env.GOOGLE_API_KEY,
});

