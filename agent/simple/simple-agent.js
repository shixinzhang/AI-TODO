/**
 * 执行方式（在 11.code 目录下）：
 * 1. npm install
 * 2. 配置环境变量后启动交互（stdin 输入，stdout 为最终回复；调试日志在 stderr）：
 *    export OPENAI_API_KEY="…"     # 必填
 *    export OPENAI_BASE_URL="…"   # 使用 OpenAI 兼容网关时填写，否则可省略（走官方 api.openai.com）
 *    export OPENAI_MODEL="…"      # 可选，不设则用本文件里的默认 model
 *    npm run agent
 *    或：npm run agent:env        # Node 20.6+，从当前目录 .env 读入上述变量
 * 3. 管道单次提问示例：printf '你好\n' | npm run agent
 */
import OpenAI from "openai";
import { execSync } from "child_process";
import { printLlmTurn } from "./simple-agent-log.js";

// OpenAI 官方 SDK；通过 OPENAI_BASE_URL 可对接国内常见的「OpenAI 兼容」网关
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

// 工具定义：sh，执行 shell。parameters 里 c 故意不写 type/description，与正文 Anthropic 版同样「极简」
const tools = [
  {
    type: "function",
    function: {
      name: "sh",
      description: "Run a shell command",
      parameters: { type: "object", properties: { c: {} } },
    },
  },
];

const messages = [];

// 仅用于 role + content 的扁平消息（user 文本）
const pushMessage = (role, content) => messages.push({ role, content });

// 主循环：stdin 每来一个数据块 = 一轮用户输入（多行粘贴仍是一块）
for await (const chunk of process.stdin) {
  const userInput = chunk + "";
  let llmTurn = 0;

  // ReAct 内循环：一直请求模型，直到回复里不再带 tool_calls
  for (pushMessage("user", userInput); ; ) {
    llmTurn += 1;
    const { choices } = await client.chat.completions.create({
      model,
      max_tokens: 4000,
      messages,
      tools,
    });

    const assistantMessage = choices[0].message;
    printLlmTurn(llmTurn, assistantMessage); // stderr：含 choices[0].message 完整 JSON，见 simple-agent-log.js
    // OpenAI 要求把 assistant 整条存进历史（可能同时含 content 与 tool_calls）
    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls?.length) {
      // 没有工具调用 = 本轮 Thought 结束，打印回复并打出下一提示符
      process.stdout.write((assistantMessage.content ?? "") + "\n> ");
      break;
    }

    // 有工具调用：执行 shell，把结果作为 tool 消息塞回（可多工具并行，逐个回写）
    for (const toolCall of assistantMessage.tool_calls) {
      let command;
      try {
        command = JSON.parse(toolCall.function.arguments || "{}").c;
      } catch {
        command = "";
      }
      // ';:' 保证退出码为 0，避免 execSync 在命令失败时抛异常（与正文写法一致）
      const result = execSync(String(command ?? "") + ";:") + "";
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
    // 继续内循环，进入下一轮 Thought + Action
  }
}
