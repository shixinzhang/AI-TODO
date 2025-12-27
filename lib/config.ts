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



