# API 测试 curl 命令

## 基础配置
```bash
BASE_URL="http://localhost:3000"
```

---

## 1. GET /api/tasks - 获取所有任务

```bash
curl -X GET "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json"
```

**美化输出（需要安装 jq）：**
```bash
curl -X GET "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" | jq '.'
```

---

## 2. POST /api/tasks - 创建新任务

### 基本创建（仅标题）
```bash
curl -X POST "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "完成项目文档"
  }'
```

### 完整创建（包含所有字段）
```bash
curl -X POST "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "完成项目文档",
    "priority": "high",
    "due_date": "2024-12-31T23:59:59Z"
  }'
```

### 不同优先级的示例
```bash
# 低优先级
curl -X POST "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"title": "低优先级任务", "priority": "low"}'

# 中等优先级（默认）
curl -X POST "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"title": "中等优先级任务", "priority": "medium"}'

# 高优先级
curl -X POST "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"title": "高优先级任务", "priority": "high"}'
```

**保存任务 ID 以便后续测试：**
```bash
TASK_ID=$(curl -X POST "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"title": "测试任务"}' \
  -s | jq -r '.data.id')

echo "创建的任务 ID: $TASK_ID"
```

---

## 3. PATCH /api/tasks/[id] - 更新任务

### 更新任务状态为已完成
```bash
curl -X PATCH "http://localhost:3000/api/tasks/{TASK_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "completed": true
  }'
```

### 更新任务状态为未完成
```bash
curl -X PATCH "http://localhost:3000/api/tasks/{TASK_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "completed": false
  }'
```

### 更新任务标题
```bash
curl -X PATCH "http://localhost:3000/api/tasks/{TASK_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "更新后的任务标题"
  }'
```

### 更新优先级
```bash
curl -X PATCH "http://localhost:3000/api/tasks/{TASK_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "high"
  }'
```

### 更新截止日期
```bash
curl -X PATCH "http://localhost:3000/api/tasks/{TASK_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "due_date": "2024-12-31T23:59:59Z"
  }'
```

### 清除截止日期
```bash
curl -X PATCH "http://localhost:3000/api/tasks/{TASK_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "due_date": null
  }'
```

### 同时更新多个字段
```bash
curl -X PATCH "http://localhost:3000/api/tasks/{TASK_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "completed": true,
    "title": "更新后的标题",
    "priority": "medium",
    "due_date": "2024-12-31T23:59:59Z"
  }'
```

**替换 {TASK_ID} 为实际的任务 ID**

---

## 4. DELETE /api/tasks/[id] - 删除任务

```bash
curl -X DELETE "http://localhost:3000/api/tasks/{TASK_ID}" \
  -H "Content-Type: application/json"
```

**替换 {TASK_ID} 为实际的任务 ID**

---

## 完整测试流程示例

```bash
# 1. 获取所有任务
curl -X GET "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" | jq '.'

# 2. 创建新任务并保存 ID
TASK_ID=$(curl -X POST "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"title": "测试任务", "priority": "high"}' \
  -s | jq -r '.data.id')

echo "创建的任务 ID: $TASK_ID"

# 3. 获取刚创建的任务（通过获取所有任务）
curl -X GET "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" | jq '.'

# 4. 更新任务状态
curl -X PATCH "http://localhost:3000/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -d '{"completed": true}' | jq '.'

# 5. 更新任务标题
curl -X PATCH "http://localhost:3000/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -d '{"title": "更新后的任务标题"}' | jq '.'

# 6. 删除任务
curl -X DELETE "http://localhost:3000/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" | jq '.'

# 7. 验证删除（应该找不到该任务）
curl -X GET "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" | jq '.'
```

---

## 错误测试示例

### 测试无效的请求方法
```bash
curl -X PUT "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json"
```

### 测试缺少必填字段
```bash
curl -X POST "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 测试无效的优先级值
```bash
curl -X POST "http://localhost:3000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"title": "测试", "priority": "invalid"}'
```

### 测试不存在的任务 ID
```bash
curl -X PATCH "http://localhost:3000/api/tasks/00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

---

## 使用测试脚本

项目包含一个自动化测试脚本 `test-api.sh`：

```bash
# 赋予执行权限
chmod +x test-api.sh

# 运行测试
./test-api.sh
```

---

## 提示

1. **安装 jq 美化 JSON 输出：**
   ```bash
   # macOS
   brew install jq
   
   # Ubuntu/Debian
   sudo apt-get install jq
   ```

2. **查看 HTTP 状态码：**
   ```bash
   curl -X GET "http://localhost:3000/api/tasks" \
     -H "Content-Type: application/json" \
     -w "\nHTTP 状态码: %{http_code}\n"
   ```

3. **查看详细请求信息：**
   ```bash
   curl -v -X GET "http://localhost:3000/api/tasks" \
     -H "Content-Type: application/json"
   ```





