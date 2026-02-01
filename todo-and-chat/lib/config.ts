// 支持 Next.js 和 Vite 环境变量
// 在 Next.js 中，服务端和客户端都可以访问 process.env.NEXT_PUBLIC_*
export const API_BASE_URL = 
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VITE_API_BASE_URL || 'https://api.example.com';

export const APP_ID = 
  process.env.NEXT_PUBLIC_APP_ID || process.env.VITE_APP_ID || '';

// DeepSeek API 配置
// DeepSeek API 地址：https://api.deepseek.com
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
// export const DEEPSEEK_API_BASE_URL = 'https://sg.uiuiapi.com/v1';
export const DEEPSEEK_API_BASE_URL = 'https://api.siliconflow.cn/v1';

// 豆包（Doubao）视频生成 API 配置
export const DOUBAO_API_BASE_URL = process.env.DOUBAO_API_BASE_URL || 'https://ark.cn-beijing.volces.com';
export const DOUBAO_API_TOKEN = process.env.DOUBAO_API_TOKEN || '';
export const DOUBAO_VIDEO_MODEL = process.env.DOUBAO_VIDEO_MODEL || 'doubao-seedance-1-5-pro-251215';

// 视频生成方式配置：'veo3' | 'doubao'
export const VIDEO_GENERATION_METHOD = process.env.VIDEO_GENERATION_METHOD || 'doubao';



