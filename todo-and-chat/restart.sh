#!/bin/bash

# 重启 Next.js 开发服务器脚本

echo "🛑 正在停止当前运行的开发服务器..."
pkill -f "next dev" || echo "   (没有找到运行中的服务器)"

# 等待进程完全停止
sleep 1

echo "🚀 正在启动开发服务器..."
npm run dev

