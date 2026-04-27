import "dotenv/config";
import { writingGraph } from "./graph.js";
import { logger } from "./lib/logger.js";
import fs from "fs/promises";
import path from "path";
import { Command, INTERRUPT, isInterrupted } from "@langchain/langgraph";
import readline from "readline/promises";

const topic =
  process.argv[2] ||
  "OpenClaw 功能和使用介绍";

const configuredThreadId = process.env.THREAD_ID;
const isPlaceholderThreadId = configuredThreadId === "article-session-001";
const threadId = configuredThreadId && !isPlaceholderThreadId
  ? configuredThreadId
  : `article-${Date.now()}`;

console.log("\n🚀 启动四人写作助手");
console.log(`📌 主题：${topic}`);
console.log(`🧵 会话 ID：${threadId}\n`);

try {
  const articleDir = path.resolve("./article-output", safeFilename(threadId));
  process.env.ARTICLE_OUTPUT_DIR = articleDir;

  const interactiveHitl = process.env.HITL_INTERACTIVE === "1";
  const config = { configurable: { thread_id: threadId } };

  let input = { topic };
  let result = await writingGraph.invoke(input, config);

  while (isInterrupted(result)) {
    const first = result[INTERRUPT]?.[0];
    const value = first?.value;
    const decision = interactiveHitl
      ? await promptHumanDecision(value)
      : { action: process.env.HITL_AUTO_ACTION || "revise" };

    input = new Command({ resume: decision });
    result = await writingGraph.invoke(input, config);
  }

  const finalArticle = stripOuterMarkdownFence(result.articleWithImages || result.draft || "");
  await fs.mkdir(articleDir, { recursive: true });
  const mdPath = path.join(articleDir, "article.md");
  await fs.writeFile(mdPath, `${finalArticle}\n`, "utf8");
  console.log(`\n💾 已输出 Markdown：${mdPath}`);
  logger.info("article.saved", { mdPath, threadId, topic, length: finalArticle.length });

  console.log("\n────────────────────────────────────────");
  console.log("📄 最终文章（含配图）：\n");
  console.log(finalArticle);
  console.log("\n────────────────────────────────────────");
  console.log(`🖼️  共生成配图：${result.generatedImages.length} 张`);
  console.log(`📊 总迭代次数：${result.iterationCount}`);
  console.log(`✅ 评审状态：${result.approved ? "通过" : "未通过（已达迭代上限）"}`);
} catch (err) {
  console.error("❌ 运行出错：", err.message);
  logger.error("main.error", { message: err.message, stack: err.stack });
  process.exit(1);
} finally {
  await logger.flush();
}

function safeFilename(input) {
  const raw = typeof input === "string" && input.length ? input : `article-${Date.now()}`;
  return raw
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function stripOuterMarkdownFence(text) {
  if (typeof text !== "string") return "";
  const trimmedStart = text.trimStart();
  if (!trimmedStart.startsWith("```")) return text;

  const firstNewline = trimmedStart.indexOf("\n");
  if (firstNewline === -1) return text;

  const closeIdx = trimmedStart.lastIndexOf("\n```");
  if (closeIdx === -1 || closeIdx <= firstNewline) return text;

  const inner = trimmedStart.slice(firstNewline + 1, closeIdx);
  const after = trimmedStart.slice(closeIdx + "\n```".length);
  return `${inner}${after}`.trimEnd();
}

async function promptHumanDecision(interruptValue) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const feedback = typeof interruptValue?.feedback === "string" ? interruptValue.feedback : "";
    console.log("\n🛑 HITL：评审未通过，等待人工决策");
    if (feedback) console.log(`\n评审意见：\n${feedback}\n`);

    const actionRaw = await rl.question(
      "选择动作 revise/accept/abort/edit（默认 revise）："
    );
    const action = (actionRaw || "revise").trim() || "revise";

    if (action === "edit") {
      const draft = await rl.question("粘贴新的 draft（单行；留空则保持原稿）：");
      const review = await rl.question("可选：补充 review（单行；留空则不变）：");
      return { action, draft, review };
    }

    if (action === "revise") {
      const instruction = await rl.question("可选：补充修改要求（单行；留空则不加）：");
      return { action, instruction };
    }

    return { action };
  } finally {
    rl.close();
  }
}
