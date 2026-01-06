# ChatTransport 接口文档

## 概述

`ChatTransport` 是 Vercel AI SDK 中用于处理聊天消息通信和流式传输的核心接口。它提供了对消息发送和响应处理的细粒度控制，支持多种通信协议，如 HTTP、WebSocket 或自定义后端集成。

## 接口定义

```typescript
interface ChatTransport<UI_MESSAGE extends UIMessage> {
  /**
   * 发送消息到聊天 API 端点并返回流式响应
   * 
   * 处理新消息提交和消息重新生成
   * 支持通过 UIMessageChunk 事件实时流式传输响应
   */
  sendMessages: (options: {
    trigger: 'submit-message' | 'regenerate-message';
    chatId: string;
    messageId: string | undefined;
    messages: UI_MESSAGE[];
    abortSignal: AbortSignal | undefined;
  } & ChatRequestOptions) => Promise<ReadableStream<UIMessageChunk>>;

  /**
   * 重新连接到指定聊天会话的现有流式响应
   * 
   * 用于在连接中断或恢复聊天会话时恢复流式传输
   * 特别适用于长时间运行的对话或从网络问题中恢复
   */
  reconnectToStream: (options: {
    chatId: string;
  } & ChatRequestOptions) => Promise<ReadableStream<UIMessageChunk> | null>;
}
```

## 实现类关系图

```
┌─────────────────────────────────────────────────────────────┐
│                    ChatTransport                            │
│                    (接口 Interface)                         │
│                                                             │
│  + sendMessages(): Promise<ReadableStream<UIMessageChunk>> │
│  + reconnectToStream(): Promise<ReadableStream<...> | null> │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ implements
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        │                                       │
┌───────────────────────┐          ┌──────────────────────────┐
│  HttpChatTransport    │          │  DirectChatTransport     │
│  (抽象基类)            │          │  (直接传输)              │
│                       │          │                          │
│  - api: string        │          │  - agent: Agent          │
│  - credentials        │          │  - agentOptions          │
│  - headers            │          │  - uiMessageStreamOptions │
│  - body               │          │                          │
│  - fetch              │          │  + sendMessages()        │
│                       │          │  + reconnectToStream()   │
│  + sendMessages()     │          │    (总是返回 null)       │
│  + reconnectToStream()│          └──────────────────────────┘
│  # processResponseStream()                                  │
│    (抽象方法)         │                                      │
└───────────────────────┘                                      │
        ▲                                                      │
        │ extends                                             │
        │                                                     │
┌───────┴───────────────┬──────────────────┐                 │
│                       │                  │                 │
│                       │                  │                 │
│  DefaultChatTransport │ TextStreamChatTransport            │
│  (默认 HTTP 传输)     │ (文本流传输)     │                 │
│                       │                  │                 │
│  + processResponseStream()                                 │
│    (处理 Data Stream 格式)                                 │
│                       │                  │                 │
│                       │  + processResponseStream()         │
│                       │    (处理 Text Stream 格式)         │
└───────────────────────┴──────────────────┘                 │
```

## 常用实现类详解

### 1. DefaultChatTransport（默认传输）

**作用**：
- 最常用的 HTTP 传输实现
- 处理标准的 Data Stream 格式响应
- 适用于大多数标准的聊天 API 端点

**使用场景**：
```typescript
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({
    api: '/api/ai-sdk/chat',
    headers: { 'Authorization': 'Bearer token' },
    body: { sessionId: '123' }
  }),
});
```

**特点**：
- 继承自 `HttpChatTransport`
- 自动处理 Data Stream 格式的响应
- 支持自定义 headers、body、credentials
- 支持请求准备函数（prepareSendMessagesRequest）

### 2. HttpChatTransport（HTTP 传输基类）

**作用**：
- 所有基于 HTTP 的传输实现的抽象基类
- 提供通用的 HTTP 请求处理逻辑
- 定义抽象方法供子类实现不同的响应流处理

**特点**：
- 抽象类，不能直接实例化
- 实现 `sendMessages` 和 `reconnectToStream` 的通用逻辑
- 子类需要实现 `processResponseStream` 方法来处理不同的响应格式

### 3. DirectChatTransport（直接传输）

**作用**：
- 直接与 Agent 进程内通信，不经过 HTTP
- 适用于服务器端渲染、测试或单进程应用

**使用场景**：
```typescript
import { useChat } from '@ai-sdk/react';
import { DirectChatTransport } from 'ai';
import { myAgent } from './my-agent';

const { messages, sendMessage } = useChat({
  transport: new DirectChatTransport({ 
    agent: myAgent 
  }),
});
```

**特点**：
- 不经过网络请求，性能更高
- 不支持 `reconnectToStream`（总是返回 null）
- 适用于 SSR 场景或测试环境

### 4. TextStreamChatTransport（文本流传输）

**作用**：
- 处理纯文本流格式的响应
- 适用于不支持 Data Stream 格式的旧版 API

**特点**：
- 继承自 `HttpChatTransport`
- 处理 Text Stream 格式而非 Data Stream
- 兼容性更好，但功能较少

## 数据流图

```
用户操作
   │
   ├─ 发送新消息 (submit-message)
   │   │
   │   └─> sendMessages()
   │       │
   │       ├─> HTTP 请求 (DefaultChatTransport)
   │       │   └─> /api/chat
   │       │
   │       ├─> 直接调用 (DirectChatTransport)
   │       │   └─> Agent.send()
   │       │
   │       └─> 返回 ReadableStream<UIMessageChunk>
   │           │
   │           ├─> text-start
   │           ├─> text-delta (流式文本块)
   │           ├─> text-end
   │           ├─> tool-input-start
   │           ├─> tool-input-delta
   │           ├─> tool-input-available
   │           ├─> data-part-start
   │           ├─> data-part-delta
   │           ├─> data-part-available
   │           └─> error
   │
   └─ 重新连接 (reconnect)
       │
       └─> reconnectToStream()
           │
           └─> 返回 ReadableStream<UIMessageChunk> | null
```

## 核心方法说明

### sendMessages

**功能**：发送消息到聊天 API 并获取流式响应

**参数**：
- `trigger`: 消息提交类型
  - `'submit-message'`: 提交新用户消息
  - `'regenerate-message'`: 重新生成助手响应
- `chatId`: 聊天会话的唯一标识符
- `messageId`: 要重新生成的消息 ID（regenerate 时）或 undefined（新消息）
- `messages`: UI 消息数组，表示对话历史
- `abortSignal`: 用于取消请求的信号
- `headers`: 额外的 HTTP 头
- `body`: 额外的 JSON 属性
- `metadata`: 自定义元数据

**返回**：`Promise<ReadableStream<UIMessageChunk>>`

**流式事件类型**：
- `text-start`, `text-delta`, `text-end`: 流式文本内容
- `tool-input-start`, `tool-input-delta`, `tool-input-available`: 工具调用
- `data-part-start`, `data-part-delta`, `data-part-available`: 数据部分
- `error`: 错误处理

### reconnectToStream

**功能**：重新连接到现有流式响应

**参数**：
- `chatId`: 要重新连接的聊天会话 ID
- `headers`: 额外的 HTTP 头
- `body`: 额外的 JSON 属性
- `metadata`: 自定义元数据

**返回**：
- `ReadableStream<UIMessageChunk>`: 如果找到活动流并可以恢复
- `null`: 如果没有活动流（例如响应已完成）

## 使用示例

### 示例 1: 使用默认传输

```typescript
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

function ChatComponent() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/ai-sdk/chat',
      headers: {
        'Authorization': 'Bearer token'
      },
      body: {
        sessionId: 'user-123'
      }
    }),
  });

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <button onClick={() => sendMessage({ text: 'Hello' })}>
        Send
      </button>
    </div>
  );
}
```

### 示例 2: 使用直接传输

```typescript
import { useChat } from '@ai-sdk/react';
import { DirectChatTransport } from 'ai';
import { createAgent } from 'ai';

const agent = createAgent({
  model: myModel,
  tools: { /* ... */ }
});

function ChatComponent() {
  const { messages, sendMessage } = useChat({
    transport: new DirectChatTransport({ agent }),
  });

  // ... 使用方式相同
}
```

### 示例 3: 自定义传输实现

```typescript
import { ChatTransport, UIMessage, UIMessageChunk } from 'ai';

class WebSocketChatTransport implements ChatTransport<UIMessage> {
  private ws: WebSocket;

  constructor(url: string) {
    this.ws = new WebSocket(url);
  }

  async sendMessages(options: {
    trigger: 'submit-message' | 'regenerate-message';
    chatId: string;
    messageId: string | undefined;
    messages: UIMessage[];
    abortSignal: AbortSignal | undefined;
  }): Promise<ReadableStream<UIMessageChunk>> {
    // 实现 WebSocket 发送逻辑
    // 返回 ReadableStream<UIMessageChunk>
  }

  async reconnectToStream(options: {
    chatId: string;
  }): Promise<ReadableStream<UIMessageChunk> | null> {
    // 实现 WebSocket 重连逻辑
  }
}
```

## 总结

`ChatTransport` 接口提供了灵活的聊天消息传输抽象，使得开发者可以：

1. **使用默认实现**：`DefaultChatTransport` 适用于大多数标准 HTTP API
2. **使用直接传输**：`DirectChatTransport` 适用于 SSR 或测试场景
3. **自定义实现**：实现 `ChatTransport` 接口以支持 WebSocket、自定义协议等

这种设计模式使得 Vercel AI SDK 能够灵活适应不同的部署场景和通信需求，同时保持统一的 API 接口。

