import fs from "fs/promises";
import path from "path";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { createAgentForTask, createProjectInfo } from "./mycode_agent.js";

const checkpointDbPath = process.env.CHECKPOINT_DB_PATH || "./.local/memory.db";
await fs.mkdir(path.dirname(path.resolve(checkpointDbPath)), { recursive: true });
const checkpointSaver = SqliteSaver.fromConnString(checkpointDbPath);

const projectInfo = createProjectInfo();
const taskOutputDir = path.resolve("output", "agent-demo");
await fs.mkdir(taskOutputDir, { recursive: true });

const agent = createAgentForTask(taskOutputDir, checkpointSaver, projectInfo);

const result = await agent.invoke(
  {
    messages: [
      {
        role: "system",
        content: `本次任务所有文件都必须写入：${taskOutputDir}（不要写到 output/ 根目录；目录名需使用英文且贴合任务；避免使用绝对路径，统一使用该目录下的相对文件名）。`,
      },
      { role: "user", content: "帮我写一个漂亮的个人主页，包含姓名、简介和技能列表" },
    ],
  },
  {
    configurable: {
      thread_id: `${process.env.THREAD_ID || "session-001"}:agent-demo`,
      checkpoint_ns: "agent-demo",
    },
    recursionLimit: Number.parseInt(process.env.RECURSION_LIMIT || "50", 10),
  }
);

console.log("\n--- 最终回复 ---");
console.log(result.messages.at(-1).content);
