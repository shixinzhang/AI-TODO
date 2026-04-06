import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import path from "path";
import { model } from "./model.js";
import { writeFileTool, executeCommandTool, openBrowserTool } from "./tools.js";
import { logger } from "./logger.js";

export function createProjectInfo() {
  return {
    workdir: process.cwd(),
    createdFiles: [],
  };
}

export function createTaskTools(taskOutputDir, projectInfo) {
  const taskDir = path.resolve(taskOutputDir);
  let toolCallCount = 0;
  let previewed = false;

  const rewriteOutputPath = (filePath) => {
    if (!filePath || typeof filePath !== "string") return filePath;

    if (path.isAbsolute(filePath)) {
      const abs = path.resolve(filePath);
      if (abs === taskDir || abs.startsWith(taskDir + path.sep)) return abs;
      return path.join(taskDir, path.basename(abs));
    }

    const normalized = filePath.replaceAll("\\\\", "/").replace(/^\.\//, "");
    if (normalized === "output" || normalized === "output/") {
      return taskDir;
    }

    if (normalized.startsWith("output/")) {
      const rest = normalized.slice("output/".length);
      const restParts = rest.split("/").filter(Boolean);
      if (restParts.length === 0) return taskDir;
      const relative = restParts.length >= 2 ? restParts.slice(1).join("/") : restParts.join("/");
      return path.join(taskDir, relative);
    }

    return path.join(taskDir, normalized);
  };

  const wrap = (t) =>
    tool(
      async (args) => {
        toolCallCount += 1;
        if (toolCallCount > 12) {
          logger.warn("tool.budget.exceeded", { tool: t.name, toolCallCount, taskDir });
          return "❌ 工具调用次数过多，已停止继续调用工具。请直接给出最终结果并结束。";
        }

        if (previewed && t.name !== "open_browser") {
          return "✅ 已打开预览页面。不要再调用工具，请总结你完成了什么并结束。";
        }

        if (t.name === "write_file") {
          const filename = rewriteOutputPath(args?.filename);
          logger.info("output.rewrite", { from: args?.filename, to: filename });
          const result = await t.invoke({ ...args, filename });
          try {
            const rel = path.relative(process.cwd(), filename);
            if (!projectInfo.createdFiles.includes(rel)) {
              projectInfo.createdFiles.push(rel);
            }
          } catch {}
          return result;
        }

        if (t.name === "open_browser") {
          const filepath = rewriteOutputPath(args?.filepath);
          logger.info("output.rewrite", { from: args?.filepath, to: filepath });
          const result = await t.invoke({ ...args, filepath });
          previewed = true;
          return result;
        }

        return t.invoke(args);
      },
      {
        name: t.name,
        description: t.description,
        schema: t.schema ?? z.any(),
      }
    );

  return [wrap(writeFileTool), wrap(executeCommandTool), wrap(openBrowserTool)];
}

export function createAgentForTask(taskOutputDir, checkpointSaver, projectInfo) {
  return createAgent({
    model,
    tools: createTaskTools(taskOutputDir, projectInfo),
    prompt: `你是一个前端开发助手。
当前工作目录：${projectInfo.workdir}
本次任务输出目录：${taskOutputDir}

重要规则：
1) 你生成的所有文件必须写入“本次任务输出目录”下（例如 ${taskOutputDir}/index.html）。
2) 不要把文件直接写到 output/ 根目录。
3) 如果需要多个文件（HTML/CSS/JS），都放在同一个任务目录内。
4) 一旦 open_browser 成功打开预览页面，立即停止调用任何工具，直接输出最终总结并结束。`,
    checkpointer: checkpointSaver,
  });
}

