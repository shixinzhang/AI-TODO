// cli.jsx
// 运行方式：npx tsx cli.jsx  或  npm start
import React, { useState, useCallback } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import fs from "fs/promises";
import path from "path";
import { writeFileTool, executeCommandTool, openBrowserTool } from "./tools.js";
import { logger } from "./logger.js";
import { createAgentForTask, createProjectInfo } from "./mycode_agent.js";

// --- 初始化记忆 ---

// 短期记忆：对话历史持久化到本地 SQLite
const checkpointDbPath = process.env.CHECKPOINT_DB_PATH || "./.local/memory.db";
await fs.mkdir(path.dirname(path.resolve(checkpointDbPath)), { recursive: true });
const checkpointSaverRaw = SqliteSaver.fromConnString(checkpointDbPath);
const checkpointSaver = new Proxy(checkpointSaverRaw, {
  get(target, prop, receiver) {
    if (prop === "getTuple") {
      return async (config) => {
        logger.info("checkpoint.getTuple.start", {
          thread_id: config?.configurable?.thread_id,
          checkpoint_ns: config?.configurable?.checkpoint_ns,
          checkpoint_id: config?.configurable?.checkpoint_id,
        });
        const tuple = await target.getTuple(config);
        if (tuple?.checkpoint && typeof tuple.checkpoint === "object") {
          if (!Array.isArray(tuple.checkpoint.pending_sends)) {
            tuple.checkpoint.pending_sends = [];
          }
        }
        logger.info("checkpoint.getTuple.done", {
          found: Boolean(tuple),
          hasPendingSends: Boolean(tuple?.checkpoint?.pending_sends),
          pendingSendsIsArray: Array.isArray(tuple?.checkpoint?.pending_sends),
        });
        return tuple;
      };
    }
    if (prop === "put") {
      return async (config, checkpoint, metadata) => {
        if (checkpoint && typeof checkpoint === "object") {
          if (!Array.isArray(checkpoint.pending_sends)) {
            checkpoint.pending_sends = [];
          }
        }
        logger.info("checkpoint.put", {
          thread_id: config?.configurable?.thread_id,
          checkpoint_ns: config?.configurable?.checkpoint_ns,
          checkpoint_id: checkpoint?.id,
        });
        return target.put(config, checkpoint, metadata);
      };
    }
    const value = Reflect.get(target, prop, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

const projectInfo = createProjectInfo();

const appMeta = await loadAppMeta();

logger.info("cli.init", {
  node: process.version,
  cwd: process.cwd(),
  hasProjectInfo: true,
});

const baseThreadId = process.env.THREAD_ID || "session-001";
const recursionLimitRaw = Number.parseInt(process.env.RECURSION_LIMIT || "50", 10);
const recursionLimit =
  Number.isFinite(recursionLimitRaw) && recursionLimitRaw > 0 ? recursionLimitRaw : 50;

function suggestTaskSlug(input) {
  const text = String(input || "").toLowerCase();
  const rules = [
    { match: [/todolist/, /todo\b/, /待办/, /清单/], slug: "todolist" },
    { match: [/portfolio/, /个人主页/, /主页/, /作品集/], slug: "portfolio" },
    { match: [/landing/, /落地页/], slug: "landing-page" },
    { match: [/resume/, /简历/], slug: "resume" },
    { match: [/dashboard/, /仪表盘/], slug: "dashboard" },
    { match: [/chat/, /聊天/], slug: "chat-app" },
    { match: [/calculator/, /计算器/], slug: "calculator" },
    { match: [/login/, /register/, /auth/, /登录/, /注册/], slug: "auth-page" },
    { match: [/blog/, /博客/], slug: "blog" },
  ];
  for (const rule of rules) {
    if (rule.match.some((re) => re.test(text))) return rule.slug;
  }
  return `task-${shortHash(text)}`;
}

function shortHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).slice(0, 8);
}

async function loadAppMeta() {
  let version = "0.0.0";
  try {
    const raw = await fs.readFile(new URL("./package.json", import.meta.url), "utf8");
    const pkg = JSON.parse(raw);
    if (typeof pkg?.version === "string") version = pkg.version;
  } catch {}

  let recent = [];
  try {
    const outputDir = path.resolve("output");
    const entries = await fs.readdir(outputDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    const stats = await Promise.all(
      dirs.map(async (name) => {
        const p = path.join(outputDir, name);
        const st = await fs.stat(p);
        return { name, mtimeMs: st.mtimeMs };
      })
    );
    recent = stats
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, 5)
      .map((x) => x.name);
  } catch {}

  let baseHost;
  try {
    if (process.env.OPENAI_API_BASE_URL) {
      baseHost = new URL(process.env.OPENAI_API_BASE_URL).host;
    }
  } catch {}

  return {
    name: "MyCode",
    version,
    model: process.env.OPENAI_MODEL || "gpt-5-codex-high",
    baseHost,
    cwd: process.cwd(),
    recent,
  };
}

async function ensureUniqueOutputDir(baseDir) {
  const resolved = path.resolve(baseDir);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const exists = async (p) => {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  };
  if (!(await exists(resolved))) {
    await fs.mkdir(resolved, { recursive: true });
    return resolved;
  }
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${resolved}-${i}`;
    if (!(await exists(candidate))) {
      await fs.mkdir(candidate, { recursive: true });
      return candidate;
    }
  }
  await fs.mkdir(resolved, { recursive: true });
  return resolved;
}

function createAgentForTaskLocal(taskOutputDir) {
  return createAgentForTask(taskOutputDir, checkpointSaver, projectInfo);
}

// --- 消息展示组件 ---
const Message = ({ msg }) => {
  const colors = { user: "cyan", agent: "white", tool: "yellow", error: "red" };
  const prefixes = { user: "You  ", agent: "Agent", tool: "Tool ", error: "Err  " };
  return (
    <Box marginBottom={1}>
      <Text color={colors[msg.type]} bold={msg.type === "user"}>
        [{prefixes[msg.type]}] {msg.text}
      </Text>
    </Box>
  );
};

const mascotArt = [
  "   (｡•ᴗ•｡)      ",
  "   |  -  |      ",
  "   | o o |      ",
];

const WelcomePanel = () => {
  const leftWidth = 30;
  const rightWidth = 68;

  return (
    <Box borderStyle="round" borderColor="red" paddingX={2} paddingY={1} marginBottom={1}>
      <Box flexDirection="column" width={leftWidth}>
        <Text color="red">
          {appMeta.name} v{appMeta.version}
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text bold>Welcome back!</Text>
          <Box marginTop={1} flexDirection="column">
            {mascotArt.map((line, idx) => (
              <Text key={idx} color="cyan">
                {line}
              </Text>
            ))}
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">
              {appMeta.model}
              {appMeta.baseHost ? ` · ${appMeta.baseHost}` : ""}
            </Text>
            <Text color="gray">{appMeta.cwd}</Text>
          </Box>
        </Box>
      </Box>

      <Box width={1} marginLeft={1} marginRight={2}>
        <Text color="red">│</Text>
      </Box>

      <Box flexDirection="column" width={rightWidth}>
        <Text color="yellow" bold>
          Tips for getting started
        </Text>
        <Text>输入需求，Enter 发送，Ctrl+C 退出</Text>
        <Text>输出会写入 output/&lt;task&gt;/，日志在 .local/runtime.log</Text>
        <Text>
          Note: 建议在项目目录内运行（当前目录：{path.basename(appMeta.cwd)}）
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Text color="gray" bold>
            Recent activity
          </Text>
          {appMeta.recent.length === 0 ? (
            <Text color="gray">No recent activity</Text>
          ) : (
            appMeta.recent.slice(0, 5).map((name) => (
              <Text key={name} color="gray">
                {name}
              </Text>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
};

// --- 主应用组件 ---
const App = () => {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  useInput((_, key) => {
    if (key.ctrl && key.name === "c") exit();
  });

  const addMessage = (type, text) =>
    setMessages((prev) => [...prev, { type, text }]);

  const handleSubmit = useCallback(
    async (userInput) => {
      if (!userInput.trim() || loading) return;
      setInput("");
      addMessage("user", userInput);
      setLoading(true);

      logger.info("ui.submit", {
        thread_id: baseThreadId,
        recursionLimit,
        inputLength: userInput.length,
      });

      const taskSlug = suggestTaskSlug(userInput);
      const taskOutputDir = await ensureUniqueOutputDir(path.join("output", taskSlug));
      const taskRunId = path.basename(taskOutputDir);
      const runThreadId = `${baseThreadId}:${taskRunId}`;
      logger.info("task.output_dir", {
        thread_id: baseThreadId,
        taskSlug,
        taskOutputDir,
        taskRunId,
        runThreadId,
      });

      const agent = createAgentForTaskLocal(taskOutputDir);
      const systemMessage = {
        role: "system",
        content: `本次任务所有文件都必须写入：${taskOutputDir}（不要写到 output/ 根目录；目录名需使用英文且贴合任务；避免使用绝对路径，统一使用该目录下的相对文件名）。`,
      };

      const runConfig = {
        configurable: {
          thread_id: runThreadId,
          checkpoint_ns: taskRunId,
        },
        recursionLimit,
      };

      let heartbeat;
      const toolsUsed = new Set();

      try {
        const streamStartedAt = Date.now();
        let lastEventAt = Date.now();
        let chunkCount = 0;
        heartbeat = setInterval(() => {
          const now = Date.now();
          if (now - lastEventAt >= 10000) {
            logger.warn("agent.stream.waiting", {
              thread_id: baseThreadId,
              checkpoint_ns: taskRunId,
              runThreadId,
              elapsedMs: now - streamStartedAt,
              sinceLastEventMs: now - lastEventAt,
              chunkCount,
            });
          }
        }, 2000);

        logger.info("agent.stream.start", {
          thread_id: baseThreadId,
          checkpoint_ns: taskRunId,
          runThreadId,
        });

        const stream = agent.stream(
          { messages: [systemMessage, { role: "user", content: userInput }] },
          { ...runConfig, streamMode: "updates" }
        );

        let agentText = "";
        for await (const chunk of await stream) {
          chunkCount += 1;
          lastEventAt = Date.now();
          if (chunkCount <= 3 || chunkCount % 25 === 0) {
            logger.info("agent.stream.chunk", {
              thread_id: baseThreadId,
              checkpoint_ns: taskRunId,
              runThreadId,
              chunkCount,
              keys: chunk && typeof chunk === "object" ? Object.keys(chunk) : [],
            });
          }
          // Agent 的文字回复：累积后实时更新，实现打字机效果
          if (chunk.agent?.messages?.[0]?.content) {
            agentText += chunk.agent.messages[0].content;
            setMessages((prev) => {
              const next = [...prev];
              if (next.at(-1)?.type === "agent") {
                next[next.length - 1] = { type: "agent", text: agentText };
              } else {
                next.push({ type: "agent", text: agentText });
              }
              return next;
            });
          }
          // 工具调用日志：每次工具返回结果都追加一条
          if (chunk.tools?.messages) {
            for (const toolMsg of chunk.tools.messages) {
              if (toolMsg?.name) toolsUsed.add(toolMsg.name);
              logger.info("agent.tool.message", {
                thread_id: baseThreadId,
                checkpoint_ns: taskRunId,
                runThreadId,
                name: toolMsg?.name,
                contentLength:
                  typeof toolMsg?.content === "string" ? toolMsg.content.length : undefined,
              });
              addMessage("tool", `${toolMsg.name}: ${toolMsg.content}`);
            }
          }
        }

        logger.info("agent.stream.done", {
          thread_id: baseThreadId,
          checkpoint_ns: taskRunId,
          runThreadId,
          chunkCount,
          outputLength: agentText.length,
          elapsedMs: Date.now() - streamStartedAt,
        });

        if (!toolsUsed.has("open_browser")) {
          const previewPath = await findPreviewHtml(taskOutputDir);
          if (previewPath) {
            logger.info("auto.open_browser", {
              thread_id: baseThreadId,
              checkpoint_ns: taskRunId,
              runThreadId,
              previewPath,
            });
            addMessage("tool", `auto_open_browser: ${previewPath}`);
            try {
              const res = await openBrowserTool.invoke({ filepath: previewPath });
              addMessage("tool", `open_browser: ${res}`);
            } catch (e) {
              logger.error("auto.open_browser.error", {
                thread_id: baseThreadId,
                checkpoint_ns: taskRunId,
                runThreadId,
                message: e?.message,
              });
            }
          }
        }

      } catch (err) {
        logger.error("ui.submit.error", {
          thread_id: baseThreadId,
          checkpoint_ns: taskRunId,
          message: err?.message,
          stack: err?.stack,
        });
        const msg = typeof err?.message === "string" ? err.message : "Unknown error";
        const isTimeout = msg.toLowerCase().includes("timed out");
        const isMissingToolOutput = msg.includes("No tool output found for function call");
        const canFallback =
          isTimeout &&
          !toolsUsed.has("open_browser") &&
          !toolsUsed.has("write_file");

        if (isTimeout && toolsUsed.has("write_file") && !toolsUsed.has("open_browser")) {
          const previewPath = await findPreviewHtml(taskOutputDir);
          if (previewPath) {
            logger.warn("timeout.auto_open_browser", {
              thread_id: baseThreadId,
              checkpoint_ns: taskRunId,
              runThreadId,
              previewPath,
            });
            addMessage(
              "tool",
              `模型请求超时，但文件已生成，自动打开预览：${previewPath}`
            );
            try {
              const res = await openBrowserTool.invoke({ filepath: previewPath });
              addMessage("tool", `open_browser: ${res}`);
            } catch (e) {
              logger.error("timeout.auto_open_browser.error", {
                thread_id: baseThreadId,
                checkpoint_ns: taskRunId,
                runThreadId,
                message: e?.message,
              });
            }
          }
        }

        if (isMissingToolOutput && toolsUsed.size === 0) {
          logger.warn("agent.fallback.new_thread", {
            thread_id: baseThreadId,
            checkpoint_ns: taskRunId,
            runThreadId,
          });
          addMessage(
            "tool",
            "检测到断点数据与工具调用链不一致（缺少 tool output），已自动切换新 thread 重试一次..."
          );
          try {
            const retryConfig = {
              ...runConfig,
              configurable: {
                ...runConfig.configurable,
                thread_id: `${runThreadId}:retry`,
              },
            };
            const result = await agent.invoke(
              { messages: [systemMessage, { role: "user", content: userInput }] },
              retryConfig
            );
            const finalText = result?.messages?.at(-1)?.content;
            if (typeof finalText === "string" && finalText.trim()) {
              addMessage("agent", finalText);
              return;
            }
          } catch (e3) {
            logger.error("agent.fallback.new_thread.error", {
              thread_id: baseThreadId,
              checkpoint_ns: taskRunId,
              message: e3?.message,
              stack: e3?.stack,
            });
          }
        }

        if (canFallback) {
          logger.warn("agent.fallback.invoke", {
            thread_id: baseThreadId,
            checkpoint_ns: taskRunId,
            toolsUsed: Array.from(toolsUsed),
          });
          addMessage(
            "tool",
            "stream 超时，自动降级为 invoke（非流式）重试一次..."
          );
          try {
            const result = await agent.invoke(
              { messages: [systemMessage, { role: "user", content: userInput }] },
              runConfig
            );
            const finalText = result?.messages?.at(-1)?.content;
            if (typeof finalText === "string" && finalText.trim()) {
              addMessage("agent", finalText);
              return;
            }
          } catch (e2) {
            logger.error("agent.fallback.invoke.error", {
              thread_id: baseThreadId,
              checkpoint_ns: taskRunId,
              runThreadId,
              message: e2?.message,
              stack: e2?.stack,
            });
          }
        }

        addMessage("error", msg);
      } finally {
        try {
          if (typeof heartbeat !== "undefined") clearInterval(heartbeat);
        } catch {}
        setLoading(false);
        logger.info("ui.submit.finally", {
          thread_id: baseThreadId,
          checkpoint_ns: taskRunId,
          runThreadId,
        });
      }
    },
    [loading]
  );

  return (
    <Box flexDirection="column" padding={1}>
      {messages.length === 0 ? <WelcomePanel /> : null}
      {messages.map((msg, i) => (
        <Message key={i} msg={msg} />
      ))}
      <Box borderStyle="round" borderColor={loading ? "gray" : "green"}>
        <Text color="green">{loading ? "⏳ " : "› "}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={loading ? "Agent 思考中..." : "输入需求，Enter 发送，Ctrl+C 退出"}
        />
      </Box>
    </Box>
  );
};

render(<App />, { patchConsole: false });

async function findPreviewHtml(taskDir) {
  const candidates = [
    path.join(taskDir, "index.html"),
    path.join(taskDir, "pomodoro.html"),
  ];
  for (const p of candidates) {
    if (await fileExists(p)) return p;
  }
  return findFirstFileByExt(taskDir, ".html", 3);
}

async function fileExists(p) {
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

async function findFirstFileByExt(dir, ext, depth) {
  if (depth < 0) return null;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const ent of entries) {
    if (ent.isFile() && ent.name.toLowerCase().endsWith(ext)) {
      return path.join(dir, ent.name);
    }
  }
  for (const ent of entries) {
    if (ent.isDirectory()) {
      const found = await findFirstFileByExt(path.join(dir, ent.name), ext, depth - 1);
      if (found) return found;
    }
  }
  return null;
}
