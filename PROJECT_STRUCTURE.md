# 项目结构文档

## 项目概述

这是一个基于 Next.js 的全栈待办事项应用，使用 TypeScript 开发，前端采用 React + Tailwind CSS，后端使用 Next.js API Routes，数据库使用 Supabase，AI 功能集成 DeepSeek API。

## 技术栈

### 前端
- **框架**: Next.js 14 (React 18)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **UI 效果**: 磨砂玻璃效果（Glassmorphism）

### 后端
- **框架**: Next.js API Routes
- **数据库**: Supabase (PostgreSQL)
- **AI 服务**: DeepSeek API (使用 OpenAI SDK)

### 开发工具
- **包管理**: npm
- **模块系统**: ES Modules
- **构建工具**: Next.js 内置 Webpack

---

## 项目目录结构

```
to-do-list/
├── pages/                    # Next.js 页面和 API 路由
│   ├── _app.tsx             # 应用入口，全局样式引入
│   ├── index.tsx             # 前端首页（待办事项列表页面）
│   └── api/                  # API 路由目录
│       └── tasks/            # 任务相关 API
│           ├── index.ts      # GET/POST /api/tasks
│           ├── [id].ts       # PATCH/DELETE /api/tasks/[id]
│           └── breakdown.ts  # POST /api/tasks/breakdown
│
├── lib/                      # 工具库和配置
│   ├── config.ts            # 环境变量配置（API_BASE_URL, APP_ID, DeepSeek 配置）
│   └── supabase.ts          # Supabase 客户端初始化
│
├── types/                    # TypeScript 类型定义
│   └── task.ts              # 任务相关的类型定义
│
├── styles/                   # 全局样式
│   └── globals.css          # Tailwind CSS 和自定义样式
│
├── node_modules/            # 依赖包（自动生成）
│
├── .next/                    # Next.js 构建输出（自动生成，已忽略）
│
├── package.json             # 项目配置和依赖
├── package-lock.json        # 依赖锁定文件
├── tsconfig.json            # TypeScript 配置
├── next.config.js           # Next.js 配置
├── tailwind.config.cjs      # Tailwind CSS 配置
├── postcss.config.cjs       # PostCSS 配置
│
├── supabase-schema.sql      # 数据库表结构 SQL
├── env.example              # 环境变量示例文件
│
├── API_DOCUMENTATION.md     # API 接口文档
├── SETUP.md                 # 项目设置指南
├── PROJECT_STRUCTURE.md     # 本文件：项目结构文档
│
└── test-*.sh                 # 测试脚本
```

---

## 详细说明

### 1. 前端部分 (`pages/`)

#### `pages/_app.tsx`
- **作用**: Next.js 应用入口文件
- **功能**: 
  - 引入全局样式 (`styles/globals.css`)
  - 可以在这里添加全局布局、Provider 等

#### `pages/index.tsx`
- **作用**: 前端首页，待办事项列表页面
- **功能**:
  - 任务列表展示（支持层级关系，子任务缩进显示）
  - 添加新任务（输入框 + 添加按钮）
  - 任务操作：
    - 复选框：切换完成状态
    - 拆解按钮：调用 AI 拆解任务
    - 删除按钮：删除任务
  - 状态管理：使用 React Hooks (useState, useEffect, useCallback)
  - API 调用：与后端 API 交互
  - UI 特性：
    - 磨砂玻璃效果
    - 蓝色系配色
    - 响应式设计

### 2. 后端部分 (`pages/api/`)

#### `pages/api/tasks/index.ts`
- **路由**: `/api/tasks`
- **方法**: 
  - `GET`: 获取所有任务列表（按创建时间倒序）
  - `POST`: 创建新任务
- **功能**:
  - 查询 Supabase 数据库
  - 数据验证
  - 错误处理

#### `pages/api/tasks/[id].ts`
- **路由**: `/api/tasks/[id]` (动态路由)
- **方法**:
  - `PATCH`: 更新任务（完成状态、标题、优先级、截止日期等）
  - `DELETE`: 删除任务
- **功能**:
  - 根据任务 ID 操作
  - 验证任务是否存在
  - 更新/删除数据库记录

#### `pages/api/tasks/breakdown.ts`
- **路由**: `/api/tasks/breakdown`
- **方法**: `POST`
- **功能**:
  - 接收任务 ID 和任务标题
  - 调用 DeepSeek API 使用 AI 拆解任务
  - 将拆解后的 3-5 个子任务存入数据库
  - 设置子任务的 `parent_id` 为原任务 ID
  - 返回创建的子任务列表

### 3. 工具库 (`lib/`)

#### `lib/config.ts`
- **作用**: 统一管理环境变量配置
- **导出**:
  - `API_BASE_URL`: API 基础地址
  - `APP_ID`: 应用 ID
  - `DEEPSEEK_API_KEY`: DeepSeek API 密钥
  - `DEEPSEEK_API_BASE_URL`: DeepSeek API 地址

#### `lib/supabase.ts`
- **作用**: Supabase 客户端初始化
- **功能**:
  - 从环境变量读取 Supabase URL 和 Anon Key
  - 创建并导出 Supabase 客户端实例
  - 用于所有数据库操作

### 4. 类型定义 (`types/`)

#### `types/task.ts`
- **作用**: 定义任务相关的 TypeScript 类型
- **类型**:
  - `Task`: 任务实体类型
  - `CreateTaskRequest`: 创建任务请求类型
  - `UpdateTaskRequest`: 更新任务请求类型
  - `ApiResponse<T>`: API 响应通用类型

### 5. 样式文件 (`styles/`)

#### `styles/globals.css`
- **作用**: 全局样式文件
- **内容**:
  - Tailwind CSS 指令 (`@tailwind base/components/utilities`)
  - 自定义样式（磨砂玻璃效果类 `.glass` 和 `.glass-dark`）
  - 全局字体和基础样式

### 6. 配置文件

#### `package.json`
- **作用**: 项目依赖和脚本配置
- **主要依赖**:
  - `next`: Next.js 框架
  - `react`, `react-dom`: React 库
  - `@supabase/supabase-js`: Supabase 客户端
  - `openai`: OpenAI SDK（用于调用 DeepSeek API）
  - `tailwindcss`: Tailwind CSS
- **脚本**:
  - `npm run dev`: 启动开发服务器
  - `npm run build`: 构建生产版本
  - `npm run start`: 启动生产服务器
  - `npm run lint`: 代码检查

#### `tsconfig.json`
- **作用**: TypeScript 编译配置
- **特性**: 路径别名 `@/` 指向项目根目录

#### `next.config.js`
- **作用**: Next.js 框架配置
- **配置**: React 严格模式

#### `tailwind.config.cjs`
- **作用**: Tailwind CSS 配置
- **配置**:
  - 内容路径（扫描哪些文件）
  - 自定义颜色（蓝色系）
  - 自定义样式扩展

#### `postcss.config.cjs`
- **作用**: PostCSS 配置
- **插件**: tailwindcss, autoprefixer

### 7. 数据库相关

#### `supabase-schema.sql`
- **作用**: 数据库表结构定义
- **内容**:
  - `tasks` 表结构（包含 `parent_id` 字段支持子任务）
  - 索引创建
  - 触发器（自动更新 `updated_at`）
  - Row Level Security (RLS) 策略

### 8. 环境配置

#### `env.example`
- **作用**: 环境变量示例文件
- **包含**:
  - Supabase 配置（URL, Anon Key）
  - API 配置（API_BASE_URL, APP_ID）
  - DeepSeek API 配置（DEEPSEEK_API_KEY）

---

## 数据流

### 前端到后端
1. 用户在 `pages/index.tsx` 中操作
2. 调用 `fetch()` 发送 HTTP 请求到 `/api/tasks/*`
3. Next.js API Routes 处理请求
4. 调用 `lib/supabase.ts` 中的客户端操作数据库
5. 返回 JSON 响应
6. 前端更新状态并重新渲染

### AI 拆解流程
1. 用户点击"拆解"按钮
2. 前端调用 `/api/tasks/breakdown`
3. 后端验证任务存在
4. 调用 DeepSeek API（通过 `openai` SDK）
5. 解析 AI 返回的子任务列表
6. 批量插入子任务到数据库（设置 `parent_id`）
7. 返回创建的子任务列表
8. 前端刷新任务列表，显示层级关系

---

## 关键特性

### 1. 全栈架构
- 前后端代码在同一个项目中
- 使用 Next.js 的文件路由系统
- API Routes 自动处理 CORS

### 2. 类型安全
- 全面使用 TypeScript
- 统一的类型定义
- API 请求/响应类型检查

### 3. 数据库设计
- 支持任务层级关系（父子任务）
- 使用外键约束保证数据完整性
- 自动更新时间戳

### 4. AI 集成
- 使用 OpenAI SDK 兼容 DeepSeek API
- 智能任务拆解
- 容错解析逻辑

### 5. UI/UX
- 现代化设计（磨砂玻璃效果）
- 响应式布局
- 良好的用户体验

---

## 开发指南

### 添加新功能

1. **添加新的 API 端点**:
   - 在 `pages/api/` 下创建新文件
   - 导出 `handler` 函数处理请求

2. **添加新的前端页面**:
   - 在 `pages/` 下创建新文件
   - 导出 React 组件

3. **添加新的类型**:
   - 在 `types/` 下创建或修改类型文件
   - 在需要的地方导入使用

4. **添加新的工具函数**:
   - 在 `lib/` 下创建新文件
   - 导出可复用的函数

### 环境变量配置

复制 `env.example` 为 `.env.local`，填入实际值：
```bash
cp env.example .env.local
```

### 数据库迁移

在 Supabase Dashboard 的 SQL Editor 中执行 `supabase-schema.sql`

---

## 项目依赖说明

### 生产依赖
- `next`: Next.js 框架，提供 SSR、API Routes 等功能
- `react`, `react-dom`: React 库
- `@supabase/supabase-js`: Supabase JavaScript 客户端
- `openai`: OpenAI SDK，用于调用 DeepSeek API

### 开发依赖
- `typescript`: TypeScript 编译器
- `@types/*`: TypeScript 类型定义
- `tailwindcss`: CSS 框架
- `postcss`, `autoprefixer`: CSS 处理工具

---

## 文件命名规范

- **页面文件**: 使用小写，如 `index.tsx`, `_app.tsx`
- **API 路由**: 使用小写，如 `index.ts`, `[id].ts`
- **工具库**: 使用小写，如 `config.ts`, `supabase.ts`
- **类型文件**: 使用小写，如 `task.ts`
- **配置文件**: 使用约定名称，如 `package.json`, `tsconfig.json`
- **配置文件（ES Module）**: 使用 `.cjs` 扩展名，如 `tailwind.config.cjs`

---

## 注意事项

1. **模块系统**: 项目使用 ES Modules (`"type": "module"`)，配置文件需要使用 `.cjs` 扩展名
2. **路径别名**: 使用 `@/` 作为项目根目录的别名
3. **环境变量**: 客户端可访问的变量需要以 `NEXT_PUBLIC_` 开头
4. **数据库**: 确保 Supabase 表结构已创建（执行 `supabase-schema.sql`）
5. **AI API**: 需要配置 `DEEPSEEK_API_KEY` 环境变量

---

## 相关文档

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API 接口详细文档
- [SETUP.md](./SETUP.md) - 项目设置和安装指南
- [supabase-schema.sql](./supabase-schema.sql) - 数据库表结构

---

*最后更新: 2024-12-13*

