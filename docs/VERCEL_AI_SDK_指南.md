# Vercel AI SDK 核心功能指南（小白版）

## 📚 目录

1. [什么是 Vercel AI SDK？](#什么是-vercel-ai-sdk)
2. [核心功能概览](#核心功能概览)
3. [useChat Hook - 聊天功能](#usechat-hook---聊天功能)
4. [useCompletion Hook - 文本补全](#usecompletion-hook---文本补全)
5. [streamText - 流式文本生成](#streamtext---流式文本生成)
6. [generateText - 文本生成](#generatetext---文本生成)
7. [Tools/Function Calling - 工具调用](#toolsfunction-calling---工具调用)
8. [快速开始](#快速开始)
9. [常见问题](#常见问题)

---

## 什么是 Vercel AI SDK？

**Vercel AI SDK** 是一个全栈 AI 开发工具包，让你用最少的代码快速构建 AI 应用。

### 为什么选择它？

✅ **简单易用** - 几行代码就能实现复杂的 AI 功能  
✅ **统一接口** - 一套代码支持 OpenAI、Anthropic、Google、DeepSeek 等所有主流模型  
✅ **自动处理** - 自动处理流式响应、错误处理、状态管理等复杂逻辑  
✅ **TypeScript 支持** - 完整的类型定义，开发体验更好  
✅ **Next.js 优化** - 专为 Next.js 优化，开箱即用

---

## 核心功能概览

Vercel AI SDK 提供了以下核心功能：

| 功能 | Hook/函数 | 用途 | 适用场景 |
|------|-----------|------|----------|
| 💬 聊天 | `useChat` | 对话式 AI | 聊天机器人、客服系统 |
| ✍️ 文本补全 | `useCompletion` | 单次文本生成 | 文本补全、代码生成 |
| 🌊 流式生成 | `streamText` | 实时流式输出 | 需要实时反馈的场景 |
| 📝 文本生成 | `generateText` | 一次性生成 | 不需要流式的场景 |
| 🔧 工具调用 | `tools` | AI 调用外部函数 | 获取实时数据、执行操作 |

---

## useChat Hook - 聊天功能

### 什么是 useChat？

`useChat` 是用于构建聊天界面的 Hook，它会自动管理：
- ✅ 消息历史
- ✅ 流式响应
- ✅ 加载状态
- ✅ 错误处理

### 前端使用示例

```typescript
import { useChat } from 'ai/react';

function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat', // 后端 API 地址
  });

  return (
    <div>
      {/* 显示消息列表 */}
      {messages.map(m => (
        <div key={m.id}>
          {m.role === 'user' ? '你' : 'AI'}: {m.content}
        </div>
      ))}

      {/* 输入框 */}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="输入消息..."
        />
        <button disabled={isLoading}>发送</button>
      </form>
    </div>
  );
}
```

### 后端 API 示例

```typescript
import { streamText } from 'ai';
import { deepseek } from '@/lib/ai/models';

export default async function handler(req, res) {
  const { messages } = req.body;

  // 使用 streamText 生成流式响应
  const result = await streamText({
    model: deepseek,
    messages,
  });

  // 转换为 useChat 需要的格式
  const response = result.toDataStreamResponse();
  
  // 流式传输给客户端
  const reader = response.body?.getReader();
  // ... 传输逻辑
}
```

### 核心优势

- **零配置** - 不需要手动管理状态
- **自动流式** - 自动处理流式响应
- **类型安全** - 完整的 TypeScript 支持

---

## useCompletion Hook - 文本补全

### 什么是 useCompletion？

`useCompletion` 用于单次文本补全，不需要维护对话历史。

### 适用场景

- 📝 文本生成（写文章、写诗等）
- 💻 代码补全
- ✨ 单次问答
- 🎨 创意生成

### 前端使用示例

```typescript
import { useCompletion } from 'ai/react';

function CompletionComponent() {
  const { completion, input, handleInputChange, handleSubmit, isLoading } = useCompletion({
    api: '/api/completion',
  });

  return (
    <div>
      {/* 输入框 */}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="输入提示词..."
        />
        <button disabled={isLoading}>生成</button>
      </form>

      {/* 显示生成结果 */}
      {completion && <div>{completion}</div>}
    </div>
  );
}
```

### 后端 API 示例

```typescript
import { streamText } from 'ai';

export default async function handler(req, res) {
  const { prompt } = req.body; // 注意：这里是 prompt，不是 messages

  const result = await streamText({
    model: deepseek,
    prompt, // 单次输入
  });

  // ... 流式传输逻辑
}
```

### useChat vs useCompletion

| 特性 | useChat | useCompletion |
|------|---------|---------------|
| 消息历史 | ✅ 自动管理 | ❌ 不需要 |
| 对话上下文 | ✅ 支持 | ❌ 不支持 |
| 适用场景 | 对话式应用 | 单次生成 |

---

## streamText - 流式文本生成

### 什么是 streamText？

`streamText` 是后端函数，用于生成流式文本响应。它会实时返回结果，而不是等待全部生成完成。

### 为什么需要流式？

- ⚡ **更快响应** - 用户不需要等待全部内容生成
- 💡 **更好体验** - 看到内容逐步生成，体验更好
- 🎯 **实时反馈** - 可以实时显示生成进度

### 使用示例

```typescript
import { streamText } from 'ai';

const result = await streamText({
  model: deepseek,
  messages: [
    { role: 'user', content: '写一首关于春天的诗' }
  ],
});

// 转换为流式响应
const response = result.toDataStreamResponse();
```

### 流式 vs 非流式

| 方式 | 优点 | 缺点 |
|------|------|------|
| 流式（streamText） | 响应快、体验好 | 实现稍复杂 |
| 非流式（generateText） | 实现简单 | 需要等待全部生成 |

---

## generateText - 文本生成

### 什么是 generateText？

`generateText` 是一次性生成完整文本，不需要流式输出。

### 适用场景

- 📊 数据分析（需要完整结果）
- 🔍 文本分类（一次性返回结果）
- 📝 批量生成（不需要实时反馈）

### 使用示例

```typescript
import { generateText } from 'ai';

const result = await generateText({
  model: deepseek,
  prompt: '分析这段文本的情感倾向',
});

console.log(result.text); // 完整的结果
console.log(result.usage); // Token 使用情况
```

---

## Tools/Function Calling - 工具调用

### 什么是 Tools？

Tools 允许 AI 调用外部函数，实现更复杂的功能。

### 为什么需要 Tools？

AI 模型本身无法：
- ❌ 获取实时数据（天气、股票等）
- ❌ 执行操作（发送邮件、创建任务等）
- ❌ 调用外部 API
- ❌ 访问数据库

通过 Tools，AI 可以：
- ✅ 获取实时数据
- ✅ 执行操作
- ✅ 调用外部 API
- ✅ 实现复杂功能

### 使用示例

#### 1. 定义工具

```typescript
import { z } from 'zod';

const getWeather = {
  description: '获取指定城市的天气信息',
  parameters: z.object({
    city: z.string().describe('城市名称'),
  }),
  execute: async ({ city }) => {
    // 调用天气 API
    const weather = await fetch(`https://api.weather.com/${city}`);
    return weather.json();
  },
};
```

#### 2. 在 streamText 中使用

```typescript
const result = await streamText({
  model: deepseek,
  messages: [{ role: 'user', content: '北京今天天气怎么样？' }],
  tools: {
    getWeather, // 注册工具
  },
});
```

#### 3. AI 自动调用

当用户问"北京今天天气怎么样？"时，AI 会：
1. 识别需要调用 `getWeather` 工具
2. 提取参数 `{ city: '北京' }`
3. 执行工具函数
4. 基于结果生成回复

### Tools 的优势

- 🤖 **AI 自动决策** - AI 决定何时调用工具
- 🔧 **灵活扩展** - 可以添加任意工具
- 🎯 **精准执行** - 参数自动提取和验证

---

## 快速开始

### 1. 安装依赖

```bash
npm install ai @ai-sdk/openai
```

### 2. 创建后端 API

```typescript
// pages/api/chat.ts
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  const { messages } = req.body;
  
  const result = await streamText({
    model: openai('gpt-4'),
    messages,
  });

  const response = result.toDataStreamResponse();
  // ... 传输逻辑
}
```

### 3. 前端使用

```typescript
// components/Chat.tsx
import { useChat } from 'ai/react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button>发送</button>
      </form>
    </div>
  );
}
```

### 4. 完成！

就这么简单！你已经创建了一个完整的 AI 聊天应用。

---

## 常见问题

### Q1: useChat 和 useCompletion 有什么区别？

**A:** 
- `useChat` 用于对话式应用，自动管理消息历史
- `useCompletion` 用于单次文本生成，不需要历史记录

### Q2: streamText 和 generateText 有什么区别？

**A:**
- `streamText` 流式输出，实时返回结果
- `generateText` 一次性返回完整结果

### Q3: 如何支持多模态（图片、语音）？

**A:** 
使用 `useChat` 的 `attachments` 功能：

```typescript
const { messages, setData } = useChat();

// 添加附件
setData({
  attachments: [{
    name: 'image.jpg',
    contentType: 'image/jpeg',
    url: 'data:image/jpeg;base64,...'
  }]
});
```

### Q4: 如何自定义模型？

**A:**
在 API 中指定模型：

```typescript
import { createOpenAI } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

// OpenAI
const openai = createOpenAI({ apiKey: '...' });

// Google Gemini
const gemini = google('gemini-1.5-pro', { apiKey: '...' });

// 使用
const result = await streamText({
  model: openai('gpt-4'), // 或 gemini
  messages,
});
```

### Q5: 如何处理错误？

**A:**
`useChat` 和 `useCompletion` 都提供了 `error` 状态：

```typescript
const { error } = useChat();

if (error) {
  return <div>错误：{error.message}</div>;
}
```

### Q6: 如何获取 Token 使用情况？

**A:**
在 `generateText` 中：

```typescript
const result = await generateText({ ... });
console.log(result.usage); // { promptTokens, completionTokens, totalTokens }
```

---

## 总结

Vercel AI SDK 让 AI 开发变得简单：

1. **useChat** - 构建聊天应用
2. **useCompletion** - 单次文本生成
3. **streamText** - 流式文本生成
4. **generateText** - 一次性文本生成
5. **Tools** - 工具调用，扩展 AI 能力

选择合适的功能，几行代码就能实现强大的 AI 应用！

---

## 更多资源

- 📖 [官方文档](https://sdk.vercel.ai/docs)
- 💻 [GitHub 仓库](https://github.com/vercel/ai)
- 🎓 [示例项目](https://github.com/vercel/ai/tree/main/examples)

---

**最后更新：** 2025-01-04  
**作者：** AI SDK Demo Project

