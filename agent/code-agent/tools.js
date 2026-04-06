// tools.js
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { execSync, exec } from "child_process";
import { logger } from "./logger.js";

// 工具一：写文件
export const writeFileTool = tool(
  async ({ filename, content }) => {
    logger.info("tool.write_file.start", {
      filename,
      contentLength: typeof content === "string" ? content.length : undefined,
    });
    const dir = path.dirname(filename);
    await fs.mkdir(dir, { recursive: true }); // 自动创建目录
    await fs.writeFile(filename, content, "utf-8");
    logger.info("tool.write_file.done", { filename });
    return `✅ 文件已写入：${filename}`;
  },
  {
    name: "write_file",
    description: "将生成的代码写入指定文件。用于创建 HTML、CSS、JS 等前端文件。",
    schema: z.object({
      filename: z.string().describe("文件路径，如 'output/index.html'"),
      content: z.string().describe("要写入的完整文件内容"),
    }),
  }
);

// 工具二：执行命令
export const executeCommandTool = tool(
  ({ command }) => {
    logger.info("tool.execute_command.start", { command });
    try {
      const output = execSync(command, {
        encoding: "utf-8",
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      logger.info("tool.execute_command.done", {
        command,
        outputLength: typeof output === "string" ? output.length : undefined,
      });
      return `✅ 执行成功：\n${output || "(无输出)"}`;
    } catch (error) {
      logger.error("tool.execute_command.error", {
        command,
        message: error?.message,
      });
      // 错误返回给模型，让它自己决定下一步
      return `❌ 执行失败：${error.message}`;
    }
  },
  {
    name: "execute_command",
    description: "在终端执行 shell 命令。用于运行脚本、检查文件是否存在等。",
    schema: z.object({
      command: z.string().describe("要执行的命令，如 'node output/app.js' 或 'ls output/'"),
    }),
  }
);

// 工具三：打开浏览器
export const openBrowserTool = tool(
  ({ filepath }) => {
    logger.info("tool.open_browser.start", { filepath });
    const absolutePath = path.resolve(filepath);
    const url = `file://${absolutePath}`;
    const command =
      process.platform === "darwin"
        ? `open "${url}"`
        : process.platform === "win32"
        ? `start "${url}"`
        : `xdg-open "${url}"`;
    exec(command);
    logger.info("tool.open_browser.done", { url });
    return `✅ 已在浏览器中打开：${url}`;
  },
  {
    name: "open_browser",
    description: "在默认浏览器中打开 HTML 文件进行预览。在代码写完、验证通过后调用。",
    schema: z.object({
      filepath: z.string().describe("HTML 文件路径，如 'output/index.html'"),
    }),
  }
);
