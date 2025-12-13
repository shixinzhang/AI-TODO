# 项目介绍

本项目是[《转型 AI 工程师：重塑你的能力栈与思维》](https://xiaobot.net/creator/ai_1024) 第二篇《》的实战项目。

这是一个基于 Next.js 的全栈待办事项应用，使用 TypeScript 开发，前端采用 React + Tailwind CSS，后端使用 Next.js API Routes，数据库使用 Supabase，AI 功能集成 DeepSeek API。

我们要开发的是一个有 AI 能力的待办事项列表，AI 在其中的作用是帮助我们拆解任务。

很多时候，一件事迟迟不做、非得拖延到最后一刻才开始，是因为我们不知道如何下手，行动力被不确定性阻断，**通过 AI 把要做的事情拆解为具体的、可执行的小事，就可以大大提升执行效率**。

# 设置指南

## 1. 安装依赖

```bash
npm install
```

## 2. 配置 Supabase

1. 在 [Supabase](https://supabase.com) 创建新项目
2. 在 Supabase Dashboard -> Settings -> API 获取：
   - Project URL
   - anon/public key
3. 复制 `env.example` 为 `.env.local`：
   ```bash
   cp env.example .env.local
   ```
4. 在 `.env.local` 中填入 Supabase 配置：
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

## 3. 配置 DeepSeek API（用于 AI 任务拆解功能）

1. 访问 [uiuiapi Platform](https://sg.uiuiapi.com/register?aff=9ume) 注册账号
2. 在控制台中创建 API Key
3. 在 `.env.local` 中添加 DeepSeek API 配置：
   ```
   DEEPSEEK_API_KEY=your_deepseek_api_key
   ```
   
   > **注意**: DeepSeek API Key 用于任务拆解功能。如果不配置，拆解功能将无法使用，但其他功能（创建、更新、删除任务）仍然可以正常使用。

## 4. 创建数据库表

在 Supabase Dashboard -> SQL Editor 中执行 `supabase-schema.sql` 文件中的 SQL 语句。

## 5. 运行开发服务器

```bash
npm run dev
```

API 端点将在 `http://localhost:3000/api/tasks` 可用。

## 6. 测试 API

### 获取所有任务
```bash
curl http://localhost:3000/api/tasks
```

### 创建任务
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "测试任务", "priority": "high"}'
```

### 更新任务
```bash
curl -X PATCH http://localhost:3000/api/tasks/{task_id} \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

### 删除任务
```bash
curl -X DELETE http://localhost:3000/api/tasks/{task_id}
```

### 拆解任务（需要配置 DeepSeek API Key）
```bash
curl -X POST http://localhost:3000/api/tasks/breakdown \
  -H "Content-Type: application/json" \
  -d '{"taskId": "your_task_id", "taskTitle": "完成项目开发"}'
```

详细 API 文档请参考 `API_DOCUMENTATION.md`。


