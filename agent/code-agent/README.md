# claude-code-lite

一个基于 LangGraph.js + Ink 的命令行“代码助手”Demo：在终端里输入需求，Agent 会流式思考并调用工具（写文件 / 执行命令 / 打开浏览器）来完成简单的前端任务。

**详细实现讲解文章 [第 20 讲｜用 LangChain 造一个精简版 Claude Code](https://xiaobot.net/post/b8fb773d-e0fb-4d14-af28-50fef3291dd2)**

## 依赖

- Node.js 18+（推荐 20+）
- npm

## 安装

```bash
npm install
```

## 配置

复制 `.env.example` 为 `.env`，并填写必要变量：

- `OPENAI_API_KEY`：你的 key
- `OPENAI_API_BASE_URL`：自定义网关/代理（可选）
- `OPENAI_MODEL`：模型名（默认 `gpt-5-codex-high`）

可选：

- `LOG_FILE`：日志文件路径（默认 `./.local/runtime.log`）
- `LOG_LEVEL`：`debug|info|warn|error`（默认 `info`）
- `CHECKPOINT_DB_PATH`：SQLite 路径（默认 `./.local/memory.db`）

## 运行

```bash
npm start
```

启动后在终端输入需求，回车发送，`Ctrl+C` 退出。

## 数据与日志位置

为了避免把本地运行产物混进仓库：

- SQLite checkpoint：`./.local/memory.db`（以及对应的 `-wal` / `-shm` 文件）
- 运行日志：`./.local/runtime.log`

## 输出目录规则（重要）

Agent 生成的前端文件不会直接写到 `output/` 根目录，而是每次任务都会在 `output/` 下创建一个英文子目录（例如 `output/todolist/`、`output/landing-page/`），并把该任务的所有文件写到这个目录里。

## 常见问题

### 一直显示 “Agent 思考中...”

这通常意味着“模型请求没有返回任何流式 chunk”。建议：

1. `tail -f .local/runtime.log` 看是否持续出现 `agent.stream.waiting`
2. 直接运行 `node model.js` 做连通性自测（会发起一次简单请求）
3. 如果出现 `502 Service temporarily unavailable`，说明上游网关/服务端暂时不可用或不支持当前模型

## 相关文档

- checkpoint 原理与本项目报错说明：`checkpoint-原理与报错.md`
