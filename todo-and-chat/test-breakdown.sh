#!/bin/bash

# 测试任务拆解接口的脚本
# 使用前请确保：
# 1. 开发服务器正在运行 (npm run dev)
# 2. 已配置 Supabase 环境变量
# 3. 已配置 DEEPSEEK_API_KEY
# 4. 已在 Supabase 中创建 tasks 表（包含 parent_id 字段）

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "测试任务拆解接口"
echo "=========================================="
echo ""

# 1. 先创建一个测试任务
echo "1. 创建测试任务..."
echo "----------------------------------------"
TASK_RESPONSE=$(curl -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "完成一个待办事项应用开发",
    "priority": "high"
  }' \
  -w "\n状态码: %{http_code}" \
  -s)

echo "$TASK_RESPONSE" | jq '.' 2>/dev/null || echo "$TASK_RESPONSE"
echo ""

# 提取任务 ID
TASK_ID=$(echo "$TASK_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TASK_ID" ]; then
  echo "❌ 无法提取任务 ID，请检查任务创建是否成功"
  echo "   如果任务已存在，可以手动设置 TASK_ID 变量"
  echo "   例如: export TASK_ID='your-task-id'"
  exit 1
fi

echo "✓ 创建的任务 ID: $TASK_ID"
echo ""

# 2. 调用拆解接口
echo "2. 调用拆解接口..."
echo "----------------------------------------"
BREAKDOWN_RESPONSE=$(curl -X POST "${BASE_URL}/api/tasks/breakdown" \
  -H "Content-Type: application/json" \
  -d "{
    \"taskId\": \"$TASK_ID\",
    \"taskTitle\": \"完成一个待办事项应用开发\"
  }" \
  -w "\n状态码: %{http_code}" \
  -s)

echo "$BREAKDOWN_RESPONSE" | jq '.' 2>/dev/null || echo "$BREAKDOWN_RESPONSE"
echo ""

# 3. 验证拆解结果
echo "3. 获取所有任务（查看拆解结果）..."
echo "----------------------------------------"
curl -X GET "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -w "\n状态码: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || curl -X GET "${BASE_URL}/api/tasks" -H "Content-Type: application/json" -w "\n状态码: %{http_code}\n"
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="

