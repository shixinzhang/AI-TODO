#!/bin/bash

# API 测试脚本
# 使用前请确保：
# 1. 开发服务器正在运行 (npm run dev)
# 2. 已配置 Supabase 环境变量
# 3. 已在 Supabase 中创建 tasks 表

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "API 测试脚本"
echo "=========================================="
echo ""

# 1. 获取所有任务
echo "1. GET /api/tasks - 获取所有任务"
echo "----------------------------------------"
curl -X GET "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -w "\n状态码: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || curl -X GET "${BASE_URL}/api/tasks" -H "Content-Type: application/json" -w "\n状态码: %{http_code}\n"
echo ""
echo ""

# 2. 创建新任务
echo "2. POST /api/tasks - 创建新任务"
echo "----------------------------------------"
TASK_RESPONSE=$(curl -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试任务 - 完成项目",
    "priority": "high",
    "due_date": null
  }' \
  -w "\n状态码: %{http_code}" \
  -s)

echo "$TASK_RESPONSE" | jq '.' 2>/dev/null || echo "$TASK_RESPONSE"
echo ""

# 提取任务 ID（如果创建成功）
TASK_ID=$(echo "$TASK_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TASK_ID" ]; then
  echo "⚠️  无法提取任务 ID，请手动设置 TASK_ID 变量来测试更新和删除"
  echo "   例如: export TASK_ID='your-task-id'"
  echo ""
else
  echo "✓ 创建的任务 ID: $TASK_ID"
  echo ""
  
  # 3. 更新任务状态
  echo "3. PATCH /api/tasks/${TASK_ID} - 更新任务状态为已完成"
  echo "----------------------------------------"
  curl -X PATCH "${BASE_URL}/api/tasks/${TASK_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "completed": true
    }' \
    -w "\n状态码: %{http_code}\n" \
    -s | jq '.' 2>/dev/null || curl -X PATCH "${BASE_URL}/api/tasks/${TASK_ID}" \
      -H "Content-Type: application/json" \
      -d '{"completed": true}' \
      -w "\n状态码: %{http_code}\n"
  echo ""
  echo ""
  
  # 4. 更新任务其他信息
  echo "4. PATCH /api/tasks/${TASK_ID} - 更新任务标题和优先级"
  echo "----------------------------------------"
  curl -X PATCH "${BASE_URL}/api/tasks/${TASK_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "title": "更新后的任务标题",
      "priority": "medium"
    }' \
    -w "\n状态码: %{http_code}\n" \
    -s | jq '.' 2>/dev/null || curl -X PATCH "${BASE_URL}/api/tasks/${TASK_ID}" \
      -H "Content-Type: application/json" \
      -d '{"title": "更新后的任务标题", "priority": "medium"}' \
      -w "\n状态码: %{http_code}\n"
  echo ""
  echo ""
  
  # 5. 删除任务
  echo "5. DELETE /api/tasks/${TASK_ID} - 删除任务"
  echo "----------------------------------------"
  curl -X DELETE "${BASE_URL}/api/tasks/${TASK_ID}" \
    -H "Content-Type: application/json" \
    -w "\n状态码: %{http_code}\n" \
    -s | jq '.' 2>/dev/null || curl -X DELETE "${BASE_URL}/api/tasks/${TASK_ID}" \
      -H "Content-Type: application/json" \
      -w "\n状态码: %{http_code}\n"
  echo ""
  echo ""
fi

# 6. 再次获取所有任务（验证删除）
echo "6. GET /api/tasks - 再次获取所有任务（验证删除）"
echo "----------------------------------------"
curl -X GET "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -w "\n状态码: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || curl -X GET "${BASE_URL}/api/tasks" -H "Content-Type: application/json" -w "\n状态码: %{http_code}\n"
echo ""
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="

