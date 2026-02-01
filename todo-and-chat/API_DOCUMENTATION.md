# API 文档

## 环境配置

1. 复制 `.env.example` 为 `.env.local`
2. 填入你的 Supabase 项目 URL 和 Anon Key
3. 在 Supabase Dashboard 的 SQL Editor 中执行 `supabase-schema.sql` 创建表结构

## API 端点

### 1. GET /api/tasks

获取所有任务（按创建时间倒序）

**请求：**
```bash
GET /api/tasks
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "任务标题",
      "completed": false,
      "priority": "medium",
      "due_date": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**错误响应：**
```json
{
  "success": false,
  "error": "错误信息"
}
```

---

### 2. POST /api/tasks

创建新任务

**请求：**
```bash
POST /api/tasks
Content-Type: application/json

{
  "title": "任务标题",
  "priority": "medium",  // 可选: "low" | "medium" | "high"
  "due_date": "2024-01-01T00:00:00Z"  // 可选: ISO 8601 格式或 null
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "任务标题",
    "completed": false,
    "priority": "medium",
    "due_date": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**验证错误：**
- `title` 是必需的，且必须是非空字符串
- `priority` 必须是 "low"、"medium" 或 "high" 之一

---

### 3. PATCH /api/tasks/[id]

更新任务状态或信息

**请求：**
```bash
PATCH /api/tasks/{task_id}
Content-Type: application/json

{
  "completed": true,  // 可选
  "title": "新标题",  // 可选
  "priority": "high",  // 可选: "low" | "medium" | "high"
  "due_date": "2024-01-01T00:00:00Z"  // 可选: ISO 8601 格式或 null
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "新标题",
    "completed": true,
    "priority": "high",
    "due_date": "2024-01-01T00:00:00Z",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**验证错误：**
- 请求体不能为空
- `completed` 必须是布尔值
- `title` 必须是非空字符串（如果提供）
- `priority` 必须是 "low"、"medium" 或 "high" 之一（如果提供）
- `due_date` 必须是字符串或 null（如果提供）

**404 错误：**
如果任务不存在，返回 404 状态码。

---

### 4. DELETE /api/tasks/[id]

删除任务

**请求：**
```bash
DELETE /api/tasks/{task_id}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "uuid"
  }
}
```

**404 错误：**
如果任务不存在，返回 404 状态码。

---

## 错误处理

所有 API 端点都包含完整的错误处理：

1. **400 Bad Request**: 请求参数验证失败
2. **404 Not Found**: 资源不存在
3. **405 Method Not Allowed**: 不支持的 HTTP 方法
4. **500 Internal Server Error**: 服务器内部错误或 Supabase 连接错误

所有错误响应都遵循以下格式：
```json
{
  "success": false,
  "error": "错误描述"
}
```

## 类型定义

所有类型定义在 `types/task.ts` 中：

- `Task`: 任务对象类型
- `CreateTaskRequest`: 创建任务请求类型
- `UpdateTaskRequest`: 更新任务请求类型
- `ApiResponse<T>`: API 响应包装类型









